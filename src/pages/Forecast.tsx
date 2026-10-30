import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/requests';
import { downloadWorkbook } from '../lib/excel';

interface ForecastRow {
  equipment_id: string;
  depot_id: string;
  depot_name: string;
  name: string;
  unit: string | null;
  article_number: string | null;
  supplier_name: string | null;
  lead_time_days: number | null;
  purchase_price: number | null;
  stock: number;
  min_quantity: number;
  usual_30: number;
  planned_30: number;
  on_order: number;
  need_30: number;
  to_order: number;
}

const chf = (n: number) => n.toLocaleString('fr-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 });
const num = (n: number) => n.toLocaleString('fr-CH', { maximumFractionDigits: 1 });

// Prévision d'achat du mois prochain : consommation habituelle + demandes à venir, face au stock
const Forecast: React.FC = () => {
  const { depots } = useApp();
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [depotId, setDepotId] = useState('');
  const [onlyToOrder, setOnlyToOrder] = useState(true);

  useEffect(() => {
    supabase.from('purchase_forecast').select('*').then(({ data, error }) => {
      if (error) toast.error(errorMessage(error));
      setRows(((data || []) as ForecastRow[]).map(r => ({
        ...r,
        stock: Number(r.stock), min_quantity: Number(r.min_quantity), usual_30: Number(r.usual_30), planned_30: Number(r.planned_30),
        on_order: Number(r.on_order), need_30: Number(r.need_30), to_order: Number(r.to_order), purchase_price: r.purchase_price === null ? null : Number(r.purchase_price),
      })));
    });
  }, []);

  const shown = useMemo(() => rows
    .filter(r => !depotId || r.depot_id === depotId)
    .filter(r => !onlyToOrder || r.to_order > 0)
    .sort((a, b) => (a.supplier_name ?? '~').localeCompare(b.supplier_name ?? '~', 'fr') || b.to_order - a.to_order), [rows, depotId, onlyToOrder]);
  const budget = shown.reduce((s, r) => s + r.to_order * (r.purchase_price ?? 0), 0);
  const planned = shown.filter(r => r.planned_30 > 0).length;

  const exportExcel = () => downloadWorkbook([{
    name: 'Prévision',
    rows: shown.map(r => ({
      Fournisseur: r.supplier_name ?? '', Article: r.name, 'N° article': r.article_number ?? '', Dépôt: r.depot_name, Unité: r.unit ?? '',
      'En stock': r.stock, Seuil: r.min_quantity, 'Conso. habituelle (30 j)': r.usual_30, 'Demandes à venir': r.planned_30,
      'Déjà commandé': r.on_order, 'À commander': r.to_order, 'Prix unitaire': r.purchase_price ?? '', Montant: Math.round(r.to_order * (r.purchase_price ?? 0) * 100) / 100,
    })),
    widths: [20, 35, 16, 18, 8, 10, 8, 14, 14, 12, 12, 12, 12],
  }], `GO-Mat_prevision_${new Date().toISOString().slice(0, 7)}.xlsx`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="mx-page-title">Prévision d'achat</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Pour le mois prochain : consommation des 3 derniers mois, demandes déjà saisies, seuil, stock et commandes en cours.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={depotId} onChange={e => setDepotId(e.target.value)} aria-label="Dépôt"
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
            <option value="">Tous les dépôts</option>
            {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Button variant="outline" icon={<Download size={16} />} onClick={exportExcel} disabled={!shown.length}>Excel</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="font-mono text-2xl font-semibold text-gray-900 dark:text-white">{shown.filter(r => r.to_order > 0).length}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">Articles à commander</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="font-mono text-2xl font-semibold text-gray-900 dark:text-white">{chf(budget)}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">Budget estimé</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 col-span-2 lg:col-span-1">
          <p className="font-mono text-2xl font-semibold text-gray-900 dark:text-white">{planned}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">Articles déjà demandés pour des chantiers à venir</p>
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={onlyToOrder} onChange={e => setOnlyToOrder(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
        Seulement ce qu'il faut commander
      </label>

      <div className="rounded-lg bg-white dark:bg-gray-800 shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">
            <tr>
              <th className="px-3 py-2">Article</th>
              <th className="px-3 py-2">Fournisseur</th>
              <th className="px-3 py-2 text-right">Stock</th>
              <th className="px-3 py-2 text-right">Habituel 30 j</th>
              <th className="px-3 py-2 text-right">Demandes</th>
              <th className="px-3 py-2 text-right">Commandé</th>
              <th className="px-3 py-2 text-right">À commander</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
            {shown.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-gray-600 dark:text-gray-400">{rows.length ? 'Rien à commander pour le mois prochain.' : 'Pas encore de consommation enregistrée.'}</td></tr>}
            {shown.map(r => (
              <tr key={`${r.equipment_id}:${r.depot_id}`}>
                <td className="px-3 py-2">{r.name}<span className="block text-xs text-gray-500">{r.depot_name}{r.article_number ? ` · ${r.article_number}` : ''}</span></td>
                <td className="px-3 py-2">{r.supplier_name ?? <span className="text-gray-500">—</span>}{r.lead_time_days ? <span className="block text-xs text-gray-500">délai {r.lead_time_days} j</span> : null}</td>
                <td className={`px-3 py-2 text-right font-mono ${r.stock <= r.min_quantity ? 'text-danger-700 dark:text-danger-300' : ''}`}>{num(r.stock)}<span className="block text-xs text-gray-500">seuil {num(r.min_quantity)}</span></td>
                <td className="px-3 py-2 text-right font-mono">{num(r.usual_30)}</td>
                <td className="px-3 py-2 text-right font-mono">{r.planned_30 ? num(r.planned_30) : '—'}</td>
                <td className="px-3 py-2 text-right font-mono">{r.on_order ? num(r.on_order) : '—'}</td>
                <td className="px-3 py-2 text-right font-mono font-bold">{r.to_order ? `${num(r.to_order)} ${r.unit ?? ''}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Pour passer commande : <Link to="/commandes" className="underline text-primary-700 dark:text-primary-300">Commandes</Link> (la feuille de commande reprend ce qui est sous le seuil).
      </p>
    </div>
  );
};

export default Forecast;
