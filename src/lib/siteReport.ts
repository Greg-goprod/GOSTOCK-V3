import { supabase } from './supabase';

export interface ReportLine {
  source: 'consumable' | 'tool' | 'rental';
  equipment_id: string | null;
  name: string;
  unit: string | null;
  quantity: number;
  unit_cost: number;
  amount: number;
  at: string;
}

export interface ReportSite {
  id: string;
  name: string;
  client: string | null;
  address: string | null;
  start_on: string | null;
  end_on: string | null;
  budget: number | null;
}

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const chf = (n: number) => n.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-CH') : '…');

export async function loadSiteLines(siteId: string): Promise<ReportLine[]> {
  const { data, error } = await supabase.from('site_report_lines').select('*').eq('site_id', siteId);
  if (error) throw error;
  return ((data || []) as ReportLine[]).map(l => ({ ...l, quantity: Number(l.quantity), unit_cost: Number(l.unit_cost), amount: Number(l.amount) }));
}

// Regroupe par article (et prix) : une ligne par consommable, par outil, par location
const group = (lines: ReportLine[]) => {
  const map = new Map<string, ReportLine>();
  for (const l of lines) {
    const key = `${l.source}|${l.equipment_id ?? l.name}|${l.unit_cost}`;
    const g = map.get(key);
    if (g) {
      g.quantity += l.quantity;
      g.amount += l.amount;
    } else map.set(key, { ...l });
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
};

// Rapport imprimable (« Enregistrer en PDF » dans la fenêtre d'impression), à joindre à la facture du client
export async function printSiteReport(site: ReportSite) {
  const win = window.open('', '_blank');
  if (!win) throw new Error('Autorisez les fenêtres pour imprimer le rapport');
  const [lines, org, logo] = await Promise.all([
    loadSiteLines(site.id),
    supabase.from('organizations').select('name').limit(1).maybeSingle(),
    supabase.from('system_settings').select('value').eq('id', 'company_logo').maybeSingle(),
  ]);
  const sections: [ReportLine['source'], string, string][] = [
    ['consumable', 'Consommables', 'Quantité'],
    ['tool', 'Outils (jours de mise à disposition)', 'Jours'],
    ['rental', 'Matériel loué', 'Jours'],
  ];
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const body = sections.map(([source, title, qtyLabel]) => {
    const rows = group(lines.filter(l => l.source === source));
    if (!rows.length) return '';
    const subtotal = rows.reduce((s, l) => s + l.amount, 0);
    return `<h2>${title}</h2><table><thead><tr><th>Article</th><th class="n">${qtyLabel}</th><th class="n">Prix unitaire</th><th class="n">Montant CHF</th></tr></thead><tbody>
      ${rows.map(l => `<tr><td>${escape(l.name)}</td><td class="n">${l.quantity.toLocaleString('fr-CH')} ${escape(source === 'consumable' ? l.unit ?? '' : '')}</td><td class="n">${chf(l.unit_cost)}</td><td class="n">${chf(l.amount)}</td></tr>`).join('')}
      <tr class="sub"><td colspan="3">Sous-total ${title.toLowerCase()}</td><td class="n">${chf(subtotal)}</td></tr></tbody></table>`;
  }).join('');
  const company = org.data?.name ?? '';
  win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Rapport matériel ${escape(site.name)}</title>
    <style>
      @page { margin: 16mm; }
      body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 12px; }
      header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
      header img { max-height: 48px; max-width: 160px; }
      h1 { font-size: 20px; margin: 0; } h2 { font-size: 14px; margin: 18px 0 6px; }
      table { width: 100%; border-collapse: collapse; } th, td { border-bottom: 1px solid #bbb; padding: 4px; text-align: left; }
      th { font-size: 10px; text-transform: uppercase; } .n { text-align: right; white-space: nowrap; }
      .sub td { font-weight: bold; border-bottom: 1px solid #000; } .total { margin-top: 16px; font-size: 16px; text-align: right; font-weight: bold; }
      .meta { color: #333; } footer { margin-top: 24px; font-size: 10px; color: #555; }
    </style></head><body>
    <header><div><h1>Rapport matériel · ${escape(site.name)}</h1>
      <p class="meta">${[site.client, site.address].filter(Boolean).map(v => escape(v!)).join(' · ')}<br>Période : du ${date(site.start_on)} au ${date(site.end_on)}</p></div>
      <div style="text-align:right">${logo.data?.value ? `<img src="${escape(logo.data.value)}" alt="">` : ''}<p>${escape(company)}</p></div></header>
    ${body || '<p>Aucune consommation enregistrée sur ce chantier.</p>'}
    <p class="total">Total matériel : CHF ${chf(total)}${site.budget ? ` <span style="font-weight:normal;font-size:12px">(budget CHF ${chf(site.budget)})</span>` : ''}</p>
    <footer>Établi le ${new Date().toLocaleDateString('fr-CH')} avec GO-Mat. Tarifs internes de mise à disposition et prix d'achat des consommables.</footer>
    </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// Liste de matériel d'un chantier, pour préparer une demande semblable
export async function similarSiteItems(siteId: string, totals: (equipmentId: string) => number) {
  const lines = await loadSiteLines(siteId);
  const tools = new Map<string, number>();
  const consumables = new Map<string, number>();
  for (const l of lines) {
    if (!l.equipment_id) continue;
    if (l.source === 'tool') tools.set(l.equipment_id, (tools.get(l.equipment_id) ?? 0) + 1);
    if (l.source === 'consumable') consumables.set(l.equipment_id, (consumables.get(l.equipment_id) ?? 0) + l.quantity);
  }
  return [
    ...[...tools].map(([id, n]) => ({ kind: 'tool' as const, id, quantity: Math.max(1, Math.min(n, totals(id) || n)) })),
    ...[...consumables].map(([id, q]) => ({ kind: 'consumable' as const, id, quantity: Math.ceil(q) })),
  ];
}
