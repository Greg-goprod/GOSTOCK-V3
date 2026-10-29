import { supabase } from './supabase';

export interface CatalogProduct {
  id: string;
  supplier_id: string;
  reference: string;
  name: string;
  family: 'machine' | 'accessory';
  categories: string[];
  ean: string | null;
  short_title: string | null;
  description: string | null;
  image_url: string | null;
  images: string[];
  specs: { spec: string; value: string }[];
  supplied_accessories: { sku: string; name: string; qty?: number }[];
  url: string | null;
}

export type CatalogRow = Omit<CatalogProduct, 'id' | 'supplier_id'>;

// Produit tel qu'exporté du site Makita CH (makita_ch_catalogue.json)
interface SourceProduct {
  slug: string;
  name: string;
  categories?: string[];
  ean?: string | null;
  short_title?: string | null;
  short_description?: string | null;
  marketing_text?: string | null;
  specs?: { spec: string; value: string }[];
  supplied_accessories?: { sku: string; name: string; qty?: number }[];
  gallery_images?: string[];
  url?: string | null;
}

const MACHINE_ROOT = 'MACHINES';
const BATCH_SIZE = 250;

const toRow = (p: SourceProduct): CatalogRow => {
  const categories = p.categories ?? [];
  const family = categories.includes(MACHINE_ROOT) ? 'machine' : 'accessory';
  // Le chemin commence par la racine du site et la famille, et finit par le nom du produit
  const path = categories.filter((c, i) => i > 0 && c !== MACHINE_ROOT && c !== 'ACCESSOIRES' && !(i === categories.length - 1 && c === p.name));
  const description = [p.short_description, p.marketing_text].filter(Boolean).join('\n\n') || null;
  const images = p.gallery_images ?? [];
  return {
    reference: p.slug.trim(),
    name: p.name.trim(),
    family,
    categories: path,
    ean: p.ean || null,
    short_title: p.short_title || null,
    description,
    image_url: images[0] ?? null,
    images,
    specs: (p.specs ?? []).map(({ spec, value }) => ({ spec, value })),
    supplied_accessories: p.supplied_accessories ?? [],
    url: p.url ?? null,
  };
};

// Lit un fichier catalogue JSON ({ products: [...] } ou directement la liste)
export function parseCatalogJson(text: string): CatalogRow[] {
  const data = JSON.parse(text);
  const products: SourceProduct[] = Array.isArray(data) ? data : data?.products;
  if (!Array.isArray(products)) throw new Error('Fichier non reconnu : la liste « products » est introuvable');

  const rows = new Map<string, CatalogRow>();
  for (const p of products) {
    if (!p?.slug || !p?.name) continue;
    const row = toRow(p);
    rows.set(row.reference.toLowerCase(), row);
  }
  return [...rows.values()];
}

// Envoie le catalogue par paquets ; réimporter met à jour les fiches existantes
export async function importCatalog(rows: CatalogRow[], supplierId: string, onProgress: (done: number) => void) {
  if (!supabase) throw new Error('Supabase client not initialized');
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map(row => ({ ...row, supplier_id: supplierId, updated_at: new Date().toISOString() }));
    const { error } = await supabase
      .from('catalog_products')
      .upsert(batch, { onConflict: 'organization_id,supplier_id,reference' });
    if (error) throw error;
    onProgress(Math.min(i + BATCH_SIZE, rows.length));
  }
}

// Recherche par code EAN, ou par mots de la référence, du nom ou du résumé (tous doivent figurer)
export async function searchCatalog(query: string, family?: CatalogProduct['family']): Promise<CatalogProduct[]> {
  if (!supabase) return [];
  const words = query.trim().replace(/[%_,()\\]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  let request = supabase.from('catalog_products').select('*').limit(20);
  if (family) request = request.eq('family', family);

  if (words.length === 1 && /^\d{8,14}$/.test(words[0])) {
    request = request.eq('ean', words[0]);
  } else {
    for (const word of words) request = request.ilike('search_text', `%${word.toLowerCase()}%`);
  }

  const { data, error } = await request.order('name');
  if (error) throw error;
  return (data || []) as CatalogProduct[];
}

// Description d'une fiche d'équipement remplie depuis le catalogue
export const catalogDescription = (product: CatalogProduct) => {
  const specs = product.specs.slice(0, 12).map(s => `${s.spec} : ${s.value}`).join('\n');
  const supplied = product.supplied_accessories.length
    ? `Livré avec : ${product.supplied_accessories.map(a => a.name).join(', ')}`
    : '';
  return [product.description, specs, supplied].filter(Boolean).join('\n\n');
};
