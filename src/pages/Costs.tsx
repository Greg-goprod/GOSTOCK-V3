import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { downloadWorkbook } from '../lib/excel';
import { errorMessage } from '../lib/requests';
import PageTitle from '../components/common/PageTitle';
import { PageCommands } from '../components/Layout/ModuleHeader';

interface CostLine {
  source: 'consumable' | 'tool' | 'rental';
  site: string;
  at: string;
  equipment_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  unit_cost: number;
  amount: number;
  user_id: string | null;
}

interface StockValue {
  depot_id: string;
  item_type: 'consumable' | 'tool';
  items: number;
  value: number;
}

const chf = (n: number) => n.toLocaleString('fr-CH', { style: 'currency', currency: 'CHF' });
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const inputClass = 'rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';

// Coûts par chantier (consommables + jours d'outils) et valeur du stock par dépôt
const Costs: React.FC = () => {
  const { depots, users } = useApp();
  const [month, setMonth] = useState(monthKey(new Date()));
  const [lines, setLines] = useState<CostLine[]>([]);
  const [values, setValues] = useState<StockValue[]>([]);
  const [openSite, setOpenSite] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const [y, m] = month.split('-').map(Number);
    const from = new Date(y, m - 1, 1).toISOString();
    const to = new Date(y, m, 1).toISOString();
    setLoading(true);
    Promise.all([
      supabase.from('site_cost_lines').select('*').gte('at', from).lt('at', to).order('at'),
      supabase.from('stock_value').select('*'),
    ]).then(([costRes, valueRes]) => {
      setLoading(false);
      if (costRes.error) toast.error(errorMessage(costRes.error));
      setLines((costRes.data || []).map(l => ({ ...l, quantity: Number(l.quantity), unit_cost: Number(l.unit_cost), amount: Number(l.amount) })) as CostLine[]);
      setValues((valueRes.data || []).map(v => ({ ...v, items: Number(v.items), value: Number(v.value) })) as StockValue[]);
    });
  }, [month]);

  const bySite = useMemo(() => {
    const map = new Map<string, { consumables: number; tools: number; rentals: number; lines: CostLine[] }>();
    for (const l of lines) {
      // « Chantier Renens » et « chantier renens » : même chantier
      const key = l.site.trim().replace(/\s+/g, ' ');
      const k = [...map.keys()].find(x => x.toLowerCase() === key.toLowerCase()) ?? key;
      const t = map.get(k) ?? { consumables: 0, tools: 0, rentals: 0, lines: [] };
      if (l.source === 'consumable') t.consumables += l.amount;
      else if (l.source === 'rental') t.rentals += l.amount;
      else t.tools += l.amount;
      t.lines.push(l);
      map.set(k, t);
    }
    return [...map.entries()].sort((a, b) => (b[1].consumables + b[1].tools + b[1].rentals) - (a[1].consumables + a[1].tools + a[1].rentals));
  }, [lines]);

  const total = bySite.reduce((s, [, t]) => s + t.consumables + t.tools + t.rentals, 0);
  const userName = (id: string | null) => {
    const u = users.find(x => x.id === id);
    return u ? `${u.first_name} ${u.last_name}` : '';
  };
  const missingRates = lines.some(l => l.source === 'tool' && l.unit_cost === 0);
  const missingPrices = lines.some(l => l.source === 'consumable' && l.unit_cost === 0);

  const exportExcel = () => downloadWorkbook([
    {
      name: 'Par chantier',
      rows: bySite.map(([site, t]) => ({ Chantier: site, Consommables: Number(t.consumables.toFixed(2)), Outils: Number(t.tools.toFixed(2)), Locations: Number(t.rentals.toFixed(2)), Total: Number((t.consumables + t.tools + t.rentals).toFixed(2)) })),
      widths: [30, 15, 15, 15, 15],
    },
    {
      name: 'Détail',
      rows: lines.map(l => ({
        Date: new Date(l.at).toLocaleDateString('fr-CH'), Chantier: l.site, Type: l.source === 'tool' ? 'Outil' : l.source === 'rental' ? 'Location' : 'Consommable',
        Article: l.name, Quantité: l.quantity, Unité: l.unit ?? '', 'Prix unitaire': l.unit_cost, Montant: Number(l.amount.toFixed(2)), Personne: userName(l.user_id),
      })),
      widths: [12, 25, 12, 30, 10, 8, 12, 12, 20],
    },
  ], `GO-Mat_couts_${month}.xlsx`);

  const valueByDepot = depots.map(d => {
    const rows = values.filter(v => v.depot_id === d.id);
    return {
      depot: d,
      consumables: rows.find(r => r.item_type === 'consumable')?.value ?? 0,
      tools: rows.find(r => r.item_type === 'tool')?.value ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <div>
          <PageTitle>Coûts</PageTitle>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Consommables (quantité × prix d'achat) et outils (jours × tarif interne) par chantier.</p>
      </div>
      <PageCommands filters={<input type="month" value={month} onChange={e => setMonth(e.target.value)} aria-label="Mois" className={inputClass} />}
        primary={<Button icon={<Download size={16} />} onClick={exportExcel} disabled={lines.length === 0}>Exporter Excel</Button>} />

      {(missingRates || missingPrices) && (
        <p className="rounded-md bg-warning-50 dark:bg-warning-900/30 text-tone-warning text-sm p-3">
          {missingPrices && 'Certains consommables n\'ont pas de prix d\'achat. '}
          {missingRates && 'Certains outils n\'ont pas de tarif interne par jour (à renseigner dans leur fiche). '}
          Ils comptent pour 0.
        </p>
      )}

      <section className="rounded-lg bg-white dark:bg-gray-800 shadow overflow-hidden">
        {loading ? (
          <p className="p-4 text-gray-600 dark:text-gray-400">Chargement…</p>
        ) : bySite.length === 0 ? (
          <p className="p-4 text-gray-600 dark:text-gray-400">Aucune sortie ce mois-ci.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2">Chantier</th>
                <th className="px-4 py-2 text-right">Consommables</th>
                <th className="px-4 py-2 text-right">Outils</th>
                <th className="px-4 py-2 text-right">Locations</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
              {bySite.map(([site, t]) => (
                <React.Fragment key={site}>
                  <tr className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40" onClick={() => setOpenSite(openSite === site ? null : site)}>
                    <td className="px-4 py-2 font-medium" style={openSite === site ? { boxShadow: 'inset 3px 0 0 var(--mx-accent)' } : undefined}>
                      <button type="button" aria-expanded={openSite === site} className="flex items-center gap-2 text-left">
                        <ChevronDown size={16} aria-hidden="true" className={`shrink-0 transition-transform ${openSite === site ? 'rotate-180 text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
                        {site}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{chf(t.consumables)}</td>
                    <td className="px-4 py-2 text-right font-mono">{chf(t.tools)}</td>
                    <td className="px-4 py-2 text-right font-mono">{chf(t.rentals)}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{chf(t.consumables + t.tools + t.rentals)}</td>
                  </tr>
                  {openSite === site && t.lines.map((l, i) => (
                    <tr key={`${site}-${i}`} className="bg-gray-50/60 dark:bg-gray-900/40 text-xs text-gray-700 dark:text-gray-300">
                      <td className="px-6 py-1.5">{new Date(l.at).toLocaleDateString('fr-CH')} · {l.name} · {userName(l.user_id)}</td>
                      <td className="px-4 py-1.5 text-right font-mono" colSpan={3}>{l.quantity.toLocaleString('fr-CH')} {l.unit ?? ''} × {chf(l.unit_cost)}</td>
                      <td className="px-4 py-1.5 text-right font-mono">{chf(l.amount)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-gray-700 font-bold text-gray-900 dark:text-gray-100">
                <td className="px-4 py-2" colSpan={4}>Total du mois</td>
                <td className="px-4 py-2 text-right font-mono">{chf(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-4">
        <h2 className="font-bold text-gray-900 dark:text-white mb-3">Valeur du stock (au prix d'achat)</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {valueByDepot.map(v => (
            <div key={v.depot.id} className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{v.depot.name}</p>
              <p className="font-mono text-xl font-semibold text-gray-900 dark:text-white mt-1">{chf(v.consumables + v.tools)}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Outils {chf(v.tools)} · Consommables {chf(v.consumables)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Costs;
