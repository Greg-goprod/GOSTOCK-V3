import { supabase } from './supabase';
import { readSheetRows } from './excel';
import { CatalogRow, parsePrice } from './catalog';

// Mise à jour d'un catalogue fournisseur : comparaison avec ce qui est déjà importé, puis application

export interface PriceListRow {
  reference: string;
  name: string;
  price?: number;
}

export interface CatalogChange {
  reference: string;
  name: string;
  oldName?: string;
  oldPrice?: number | null;
  newPrice?: number | null;
}

export interface CatalogDiff {
  added: CatalogChange[];
  priceChanged: CatalogChange[];
  renamed: CatalogChange[];
  missing: CatalogChange[];
  unchanged: number;
}

const HEADERS = {
  reference: ['référence', 'reference', 'réf', 'ref', 'n° article', 'no article', 'article', 'sku', 'slug', 'code'],
  name: ['désignation', 'designation', 'description', 'nom', 'name', 'libellé', 'libelle', 'produit'],
  price: ['prix', 'price', 'pvc', 'chf', 'tarif'],
};

const findHeader = (headers: string[], candidates: string[]) =>
  candidates.map(c => headers.find(h => h.toLowerCase().trim() === c)).find(Boolean)
  ?? candidates.map(c => headers.find(h => h.toLowerCase().includes(c))).find(Boolean);

// Liste de prix Excel : colonnes reconnues par leur titre (Référence, Désignation, Prix…)
export async function parsePriceListExcel(file: File): Promise<PriceListRow[]> {
  const rows = await readSheetRows(file);
  if (!rows.length) return [];
  const headers = Object.keys(rows.reduce((all, r) => ({ ...all, ...r }), {}));
  const refKey = findHeader(headers, HEADERS.reference);
  const nameKey = findHeader(headers, HEADERS.name);
  const priceKey = findHeader(headers, HEADERS.price);
  if (!refKey) throw new Error('Colonne de référence introuvable (Référence, Article, SKU…)');
  const result = new Map<string, PriceListRow>();
  for (const r of rows) {
    const reference = (r[refKey] ?? '').trim();
    if (!reference) continue;
    const price = priceKey ? parsePrice(r[priceKey]) : undefined;
    result.set(reference.toLowerCase(), { reference, name: (nameKey && r[nameKey]?.trim()) || reference, ...(price != null ? { price } : {}) });
  }
  return [...result.values()];
}

async function existingProducts(supplierId: string) {
  const all: { id: string; reference: string; name: string; price: number | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('catalog_products').select('id, reference, name, price')
      .eq('supplier_id', supplierId).order('reference').range(from, from + 999);
    if (error) throw error;
    all.push(...(data || []).map(p => ({ ...p, price: p.price === null ? null : Number(p.price) })));
    if (!data || data.length < 1000) break;
  }
  return all;
}

export async function diffCatalog(rows: (CatalogRow | PriceListRow)[], supplierId: string): Promise<CatalogDiff> {
  const existing = await existingProducts(supplierId);
  const byRef = new Map(existing.map(p => [p.reference.toLowerCase(), p]));
  const seen = new Set<string>();
  const diff: CatalogDiff = { added: [], priceChanged: [], renamed: [], missing: [], unchanged: 0 };
  for (const row of rows) {
    const key = row.reference.toLowerCase();
    seen.add(key);
    const old = byRef.get(key);
    const newPrice = 'price' in row ? row.price : undefined;
    if (!old) {
      diff.added.push({ reference: row.reference, name: row.name, newPrice });
      continue;
    }
    let changed = false;
    if (newPrice !== undefined && newPrice !== null && Math.abs((old.price ?? -1) - newPrice) > 0.004) {
      diff.priceChanged.push({ reference: row.reference, name: row.name, oldPrice: old.price, newPrice });
      changed = true;
    }
    if (row.name && row.name !== old.name) {
      diff.renamed.push({ reference: row.reference, name: row.name, oldName: old.name });
      changed = true;
    }
    if (!changed) diff.unchanged++;
  }
  for (const p of existing) {
    if (!seen.has(p.reference.toLowerCase())) diff.missing.push({ reference: p.reference, name: p.name, oldPrice: p.price });
  }
  return diff;
}

// Liste de prix : met à jour nom et prix des produits connus, ajoute les nouveaux (fiche minimale)
export async function applyPriceList(rows: PriceListRow[], supplierId: string, onProgress: (done: number) => void) {
  const existing = new Set((await existingProducts(supplierId)).map(p => p.reference.toLowerCase()));
  const known = rows.filter(r => existing.has(r.reference.toLowerCase()));
  const fresh = rows.filter(r => !existing.has(r.reference.toLowerCase()));
  let done = 0;
  for (let i = 0; i < known.length; i += 250) {
    const batch = known.slice(i, i + 250).map(r => ({
      supplier_id: supplierId, reference: r.reference, name: r.name, ...(r.price !== undefined ? { price: r.price } : {}), updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('catalog_products').upsert(batch, { onConflict: 'organization_id,supplier_id,reference', defaultToNull: false });
    if (error) throw error;
    onProgress(done += batch.length);
  }
  for (let i = 0; i < fresh.length; i += 250) {
    const batch = fresh.slice(i, i + 250).map(r => ({ supplier_id: supplierId, reference: r.reference, name: r.name, family: 'accessory', price: r.price ?? null }));
    const { error } = await supabase.from('catalog_products').insert(batch);
    if (error) throw error;
    onProgress(done += batch.length);
  }
}

// Reporte les nouveaux prix sur les fiches d'outils et consommables créées depuis le catalogue
export async function updateLinkedPurchasePrices(changes: CatalogChange[], supplierId: string): Promise<number> {
  if (!changes.length) return 0;
  const priceByRef = new Map(changes.map(c => [c.reference.toLowerCase(), c.newPrice]));
  const products = (await existingProducts(supplierId)).filter(p => priceByRef.has(p.reference.toLowerCase()));
  let updated = 0;
  for (let i = 0; i < products.length; i += 200) {
    const slice = products.slice(i, i + 200);
    const { data, error } = await supabase.from('equipment').select('id, catalog_product_id').in('catalog_product_id', slice.map(p => p.id));
    if (error) throw error;
    for (const item of data || []) {
      const product = slice.find(p => p.id === item.catalog_product_id);
      const price = product ? priceByRef.get(product.reference.toLowerCase()) : undefined;
      if (price == null) continue;
      const { error: upError } = await supabase.from('equipment').update({ purchase_price: price }).eq('id', item.id);
      if (upError) throw upError;
      updated++;
    }
  }
  return updated;
}
