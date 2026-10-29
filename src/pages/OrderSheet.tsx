import React, { useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { LowStockItem } from '../types';

const formatQty = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toLocaleString('fr-CH', { maximumFractionDigits: 2 });

const formatChf = (value: number) =>
  value.toLocaleString('fr-CH', { style: 'currency', currency: 'CHF' });

// Feuille de commande : consommables sous leur seuil, regroupés par fournisseur, imprimable à tout moment
const OrderSheet: React.FC = () => {
  const { depots } = useApp();
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [depotFilter, setDepotFilter] = useState('all');
  // Quantités à commander modifiables avant impression (non enregistrées)
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('low_stock_items')
      .select('*')
      .order('supplier_name')
      .order('name');
    setLoading(false);
    if (error) {
      toast.error('Impossible de charger la feuille de commande');
      return;
    }
    setItems((data || []).map(row => ({
      ...row,
      quantity: Number(row.quantity),
      min_quantity: Number(row.min_quantity),
      quantity_to_order: Number(row.quantity_to_order),
      purchase_price: row.purchase_price === null ? undefined : Number(row.purchase_price),
    })));
  };

  useEffect(() => {
    load();
  }, []);

  const bySupplier = useMemo(() => {
    const groups = new Map<string, LowStockItem[]>();
    items
      .filter(i => depotFilter === 'all' || i.depot_id === depotFilter)
      .forEach(i => {
        const key = i.supplier_name;
        groups.set(key, [...(groups.get(key) || []), i]);
      });
    return [...groups.entries()];
  }, [items, depotFilter]);

  const toOrder = (item: LowStockItem) => {
    const value = Number((overrides[item.stock_id] ?? '').replace(',', '.'));
    return overrides[item.stock_id] !== undefined && !Number.isNaN(value) ? value : item.quantity_to_order;
  };

  const depotName = depotFilter === 'all' ? 'Tous les dépôts' : depots.find(d => d.id === depotFilter)?.name;

  return (
    <div className="order-sheet space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white tracking-tight uppercase">Feuille de commande</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Consommables sous leur seuil minimum, par fournisseur</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={depotFilter}
            onChange={e => setDepotFilter(e.target.value)}
            aria-label="Dépôt"
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="all">Tous les dépôts</option>
            {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Button variant="outline" icon={<RefreshCw size={16} />} onClick={load} loading={loading}>Actualiser</Button>
          <Button icon={<Printer size={16} />} onClick={() => window.print()} disabled={bySupplier.length === 0}>Imprimer</Button>
        </div>
      </div>

      {/* En-tête imprimé */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Feuille de commande</h1>
        <p className="text-sm">{depotName} · {format(new Date(), "d MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-600 dark:text-gray-400">Chargement…</div>
      ) : bySupplier.length === 0 ? (
        <div className="py-12 text-center text-gray-600 dark:text-gray-400">Aucun consommable sous son seuil : rien à commander.</div>
      ) : (
        bySupplier.map(([supplier, lines]) => {
          const contact = lines[0];
          const total = lines.reduce((sum, l) => sum + (l.purchase_price ? l.purchase_price * toOrder(l) : 0), 0);
          return (
            <section key={supplier} className="bg-white dark:bg-gray-800 rounded-lg shadow print:shadow-none print:rounded-none overflow-hidden break-inside-avoid">
              <div className="flex flex-wrap justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-bold text-gray-900 dark:text-white">{supplier}</h2>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {[contact.supplier_email, contact.supplier_phone].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className="px-4 py-2">Référence</th>
                      <th className="px-4 py-2">Article</th>
                      <th className="px-4 py-2">Dépôt</th>
                      <th className="px-4 py-2 text-right">Stock / seuil</th>
                      <th className="px-4 py-2 text-right">À commander</th>
                      <th className="px-4 py-2 text-right">Prix unit.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
                    {lines.map(line => (
                      <tr key={line.stock_id}>
                        <td className="px-4 py-2 font-mono">{line.supplier_reference || '—'}</td>
                        <td className="px-4 py-2">{line.name}</td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{line.depot_name}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums">{formatQty(line.quantity)} / {formatQty(line.min_quantity)}</td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            inputMode="decimal"
                            aria-label={`Quantité à commander : ${line.name}`}
                            value={overrides[line.stock_id] ?? String(line.quantity_to_order)}
                            onChange={e => setOverrides(prev => ({ ...prev, [line.stock_id]: e.target.value }))}
                            className="w-20 text-right font-mono rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 print:hidden"
                          />
                          <span className="hidden print:inline font-mono">{formatQty(toOrder(line))}</span>{' '}
                          <span className="text-gray-600 dark:text-gray-400">{line.unit}</span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums">{line.purchase_price ? formatChf(line.purchase_price) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  {total > 0 && (
                    <tfoot>
                      <tr className="border-t border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-gray-100">
                        <td className="px-4 py-2" colSpan={5}>Total estimé</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums">{formatChf(total)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
};

export default OrderSheet;
