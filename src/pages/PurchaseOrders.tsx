import React, { useEffect, useMemo, useState } from 'react';
import { Mail, PackageCheck, Printer, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/requests';
import { confirmAction } from '../lib/confirm';

type OrderStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';

interface OrderLine {
  id: string;
  equipment_id: string;
  quantity: number;
  received: number;
  unit_price: number | null;
}

interface PurchaseOrder {
  id: string;
  number: string;
  supplier_id: string;
  depot_id: string;
  status: OrderStatus;
  created_at: string;
  sent_at: string | null;
  expected_at: string | null;
  notes: string | null;
  purchase_order_lines: OrderLine[];
}

const STATUS: Record<OrderStatus, { label: string; className: string }> = {
  draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' },
  sent: { label: 'Envoyée', className: 'bg-info-100 text-info-600 dark:bg-info-900 dark:text-info-100' },
  partial: { label: 'Reçue en partie', className: 'bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-200' },
  received: { label: 'Reçue', className: 'bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-200' },
  cancelled: { label: 'Annulée', className: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
};

const chf = (n: number) => n.toLocaleString('fr-CH', { style: 'currency', currency: 'CHF' });
const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('fr-CH', { maximumFractionDigits: 2 }));
const inputClass = 'rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-gray-100';

// Bons de commande fournisseurs : brouillon → envoyé → reçu (en partie ou en totalité)
const PurchaseOrders: React.FC = () => {
  const { suppliers, depots } = useApp();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [opened, setOpened] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, purchase_order_lines(*)')
      .order('created_at', { ascending: false });
    if (error) toast.error(errorMessage(error));
    setOrders(((data || []) as PurchaseOrder[]).map(o => ({
      ...o,
      purchase_order_lines: o.purchase_order_lines.map(l => ({ ...l, quantity: Number(l.quantity), received: Number(l.received), unit_price: l.unit_price === null ? null : Number(l.unit_price) })),
    })));
  };

  useEffect(() => {
    load();
  }, []);

  const shown = filter === 'open' ? orders.filter(o => ['draft', 'sent', 'partial'].includes(o.status)) : orders;
  const supplierName = (id: string) => suppliers.find(s => s.id === id)?.name ?? 'Fournisseur';
  const depotName = (id: string) => depots.find(d => d.id === id)?.name ?? '';
  const total = (o: PurchaseOrder) => o.purchase_order_lines.reduce((sum, l) => sum + (l.unit_price ?? 0) * l.quantity, 0);
  const current = orders.find(o => o.id === opened) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3 print:hidden">
        <div>
          <h1 className="mx-page-title">Commandes fournisseurs</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Créées depuis la feuille de commande, envoyées par e-mail, réceptionnées ligne à ligne.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={filter === 'open' ? 'primary' : 'outline'} onClick={() => setFilter('open')}>En cours</Button>
          <Button size="sm" variant={filter === 'all' ? 'primary' : 'outline'} onClick={() => setFilter('all')}>Toutes</Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-6 text-gray-700 dark:text-gray-300 print:hidden">
          Aucune commande. Créez-les depuis la feuille de commande (« Créer les bons de commande »).
        </div>
      ) : (
        <ul className="space-y-2 print:hidden">
          {shown.map(o => (
            <li key={o.id}>
              <button type="button" onClick={() => setOpened(o.id)} className="w-full text-left rounded-lg bg-white dark:bg-gray-800 shadow p-4 hover:ring-2 hover:ring-primary-400 flex flex-wrap justify-between gap-2">
                <span>
                  <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{o.number}</span>{' '}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[o.status].className}`}>{STATUS[o.status].label}</span>
                  <span className="block font-bold text-gray-900 dark:text-white">{supplierName(o.supplier_id)}</span>
                  <span className="block text-xs text-gray-600 dark:text-gray-400">{depotName(o.depot_id)} · {o.purchase_order_lines.length} ligne{o.purchase_order_lines.length > 1 ? 's' : ''} · créée le {new Date(o.created_at).toLocaleDateString('fr-CH')}</span>
                </span>
                <span className="font-mono text-sm text-gray-900 dark:text-gray-100 self-center">{chf(total(o))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {current && <OrderModal order={current} onClose={() => setOpened(null)} onChanged={load} />}
    </div>
  );
};

/* ------------------------------------------------------------------------ */

const OrderModal: React.FC<{ order: PurchaseOrder; onClose: () => void; onChanged: () => Promise<void> }> = ({ order, onClose, onChanged }) => {
  const { suppliers, depots, equipment, refreshData } = useApp();
  const [receiving, setReceiving] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const supplier = suppliers.find(s => s.id === order.supplier_id);
  const depot = depots.find(d => d.id === order.depot_id);
  const item = (id: string) => equipment.find(e => e.id === id);
  const editable = order.status === 'draft';
  const receivable = ['sent', 'partial', 'draft'].includes(order.status);
  const total = useMemo(() => order.purchase_order_lines.reduce((s, l) => s + (l.unit_price ?? 0) * l.quantity, 0), [order]);

  const run = async (fn: () => PromiseLike<{ error: unknown }>, success?: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      toast.error(errorMessage(error));
      return false;
    }
    if (success) toast.success(success);
    await onChanged();
    return true;
  };

  const updateLine = (line: OrderLine, change: Partial<OrderLine>) =>
    run(() => supabase.from('purchase_order_lines').update(change).eq('id', line.id));

  const removeLine = (line: OrderLine) =>
    run(() => supabase.from('purchase_order_lines').delete().eq('id', line.id), 'Ligne retirée');

  const setStatus = (status: OrderStatus, success: string) =>
    run(() => supabase.from('purchase_orders').update({ status, ...(status === 'sent' ? { sent_at: new Date().toISOString() } : {}) }).eq('id', order.id), success);

  // Le bon part par la messagerie de la personne : pas besoin du serveur d'envoi de GO-Mat
  const sendByEmail = async () => {
    const lines = order.purchase_order_lines.map(l => {
      const e = item(l.equipment_id);
      return `- ${qty(l.quantity)} ${e?.unit ?? 'pce'} · ${e?.supplierReference ? `${e.supplierReference} · ` : ''}${e?.name ?? 'Article'}`;
    }).join('\n');
    const body = `Bonjour,\n\nMerci de nous livrer la commande ${order.number} au dépôt ${depot?.name ?? ''} :\n\n${lines}\n\nMerci de confirmer le délai de livraison.\n\nMeilleures salutations`;
    window.location.href = `mailto:${encodeURIComponent(supplier?.email ?? '')}?subject=${encodeURIComponent(`Commande ${order.number}`)}&body=${encodeURIComponent(body)}`;
    if (order.status === 'draft') await setStatus('sent', `Commande ${order.number} marquée envoyée`);
  };

  const receive = async (line: OrderLine) => {
    const value = Number((receiving[line.id] ?? '').replace(',', '.'));
    if (!value || value <= 0) return toast.error('Indiquez la quantité reçue');
    const ok = await run(() => supabase.rpc('receive_order_line', { p_line_id: line.id, p_quantity: value }), `${qty(value)} reçu(s) : entrée en stock`);
    if (ok) {
      setReceiving(r => ({ ...r, [line.id]: '' }));
      await refreshData();
    }
  };

  const receiveAll = async () => {
    for (const line of order.purchase_order_lines.filter(l => l.received < l.quantity)) {
      const { error } = await supabase.rpc('receive_order_line', { p_line_id: line.id, p_quantity: line.quantity - line.received });
      if (error) {
        toast.error(errorMessage(error));
        break;
      }
    }
    toast.success(`Commande ${order.number} réceptionnée`);
    await onChanged();
    await refreshData();
  };

  return (
    <Modal isOpen onClose={onClose} title={`${order.number} · ${supplier?.name ?? ''}`} size="xl">
      <div className="space-y-4">
        <div className="print:hidden flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[order.status].className}`}>{STATUS[order.status].label}</span>
          <span>Livraison : {depot?.name}</span>
          {supplier?.email && <span>· {supplier.email}</span>}
          {order.sent_at && <span>· envoyée le {new Date(order.sent_at).toLocaleDateString('fr-CH')}</span>}
        </div>

        {/* Bon imprimable */}
        <div className="hidden print:block text-black">
          <h1 className="text-xl font-bold">Bon de commande {order.number}</h1>
          <p className="text-sm">{new Date(order.created_at).toLocaleDateString('fr-CH')} · Fournisseur : {supplier?.name} · Livraison : {depot?.name}{depot?.address ? `, ${depot.address}` : ''}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-2 py-2">Réf.</th>
                <th className="px-2 py-2">Article</th>
                <th className="px-2 py-2 text-right">Quantité</th>
                <th className="px-2 py-2 text-right">Prix unit.</th>
                <th className="px-2 py-2 text-right print:hidden">Reçu</th>
                <th className="px-2 py-2 print:hidden" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
              {order.purchase_order_lines.map(line => {
                const e = item(line.equipment_id);
                const left = line.quantity - line.received;
                return (
                  <tr key={line.id}>
                    <td className="px-2 py-2 font-mono">{e?.supplierReference ?? '—'}</td>
                    <td className="px-2 py-2">{e?.name ?? 'Article'}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      {editable ? (
                        <input type="number" min={0.01} step="any" defaultValue={line.quantity} aria-label={`Quantité ${e?.name}`} onBlur={ev => Number(ev.target.value) > 0 && Number(ev.target.value) !== line.quantity && updateLine(line, { quantity: Number(ev.target.value) })} className={`${inputClass} w-20 text-right font-mono print:hidden`} />
                      ) : null}
                      <span className={editable ? 'hidden print:inline font-mono' : 'font-mono'}>{qty(line.quantity)}</span> {e?.unit}
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      {editable ? (
                        <input type="number" min={0} step="any" defaultValue={line.unit_price ?? ''} aria-label={`Prix ${e?.name}`} onBlur={ev => updateLine(line, { unit_price: ev.target.value === '' ? null : Number(ev.target.value) })} className={`${inputClass} w-24 text-right font-mono print:hidden`} />
                      ) : null}
                      <span className={editable ? 'hidden print:inline font-mono' : 'font-mono'}>{line.unit_price !== null ? chf(line.unit_price) : '—'}</span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono print:hidden">{qty(line.received)}</td>
                    <td className="px-2 py-2 print:hidden">
                      <div className="flex justify-end gap-1">
                        {receivable && left > 0 && (
                          <>
                            <input type="number" min={0.01} step="any" placeholder={qty(left)} value={receiving[line.id] ?? ''} onChange={ev => setReceiving(r => ({ ...r, [line.id]: ev.target.value }))} aria-label={`Quantité reçue ${e?.name}`} className={`${inputClass} w-20 text-right font-mono`} />
                            <Button size="sm" variant="outline" icon={<PackageCheck size={14} />} onClick={() => receive(line)} disabled={busy}>Reçu</Button>
                          </>
                        )}
                        {editable && <Button size="sm" variant="outline" icon={<Trash2 size={14} />} ariaLabel={`Retirer ${e?.name}`} onClick={() => removeLine(line)} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700">
                <td className="px-2 py-2" colSpan={3}>Total estimé</td>
                <td className="px-2 py-2 text-right font-mono">{chf(total)}</td>
                <td className="print:hidden" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap justify-end gap-2 print:hidden">
          {['draft', 'sent', 'partial'].includes(order.status) && (
            <Button variant="outline" icon={<X size={16} />} onClick={async () => { if (await confirmAction(`Annuler la commande ${order.number} ?`)) setStatus('cancelled', 'Commande annulée'); }} disabled={busy}>Annuler la commande</Button>
          )}
          <Button variant="outline" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimer</Button>
          {order.status === 'draft' && <Button variant="outline" onClick={() => setStatus('sent', 'Marquée envoyée')} disabled={busy}>Marquer envoyée</Button>}
          {['draft', 'sent'].includes(order.status) && <Button icon={<Mail size={16} />} onClick={sendByEmail} disabled={busy}>Envoyer par e-mail</Button>}
          {['sent', 'partial'].includes(order.status) && <Button icon={<PackageCheck size={16} />} onClick={receiveAll} disabled={busy}>Tout réceptionner</Button>}
        </div>
      </div>
    </Modal>
  );
};

export default PurchaseOrders;
