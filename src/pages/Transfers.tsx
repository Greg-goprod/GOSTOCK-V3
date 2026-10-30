import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, PackageCheck, Plus, Send, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import QRCodeScanner from '../components/QRCode/QRCodeScanner';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/requests';
import { findEquipmentByCode } from '../lib/scan';

interface TransferLine {
  id: string;
  equipment_id: string;
  quantity: number;
  received: number;
}

interface Transfer {
  id: string;
  number: string;
  from_depot_id: string;
  to_depot_id: string;
  status: 'in_transit' | 'received' | 'cancelled';
  sent_by: string | null;
  sent_at: string;
  received_at: string | null;
  notes: string | null;
  transfer_lines: TransferLine[];
}

interface DraftLine {
  equipment_id: string;
  quantity: number;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const STATUS = { in_transit: 'En route', received: 'Réceptionné', cancelled: 'Annulé' };

// Transferts entre dépôts : envoi, puis réception au scanner à l'arrivée
const Transfers: React.FC = () => {
  const { depots, equipment, consumableStock, users, refreshData } = useApp();
  const { profile } = useAuth();
  const myDepotIds = profile?.depot_ids?.length ? profile.depot_ids : depots.map(d => d.id);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [creating, setCreating] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [receiving, setReceiving] = useState<Transfer | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('transfers').select('*, transfer_lines(*)').order('sent_at', { ascending: false }).limit(200);
    if (error) toast.error(errorMessage(error));
    const list = ((data || []) as Transfer[]).map(t => ({
      ...t, transfer_lines: t.transfer_lines.map(l => ({ ...l, quantity: Number(l.quantity), received: Number(l.received) })),
    }));
    setTransfers(list);
    setReceiving(current => (current ? list.find(t => t.id === current.id) ?? null : null));
  };

  useEffect(() => {
    load();
  }, []);

  const depotName = (id: string) => depots.find(d => d.id === id)?.name ?? 'Dépôt';
  const item = (id: string) => equipment.find(e => e.id === id);
  const userName = (id: string | null) => {
    const u = users.find(x => x.id === id);
    return u ? `${u.first_name} ${u.last_name}` : '';
  };
  const stockAt = (equipmentId: string, depotId: string) => consumableStock.find(s => s.equipmentId === equipmentId && s.depotId === depotId)?.quantity ?? 0;

  const shown = filter === 'open' ? transfers.filter(t => t.status === 'in_transit') : transfers;

  const openCreate = () => {
    const first = depots.find(d => myDepotIds.includes(d.id));
    setFrom(first?.id ?? '');
    setTo(depots.find(d => d.id !== first?.id)?.id ?? '');
    setLines([]);
    setNotes('');
    setSearch('');
    setCreating(true);
  };

  // Articles transférables depuis le dépôt de départ : consommables en stock, outils rattachés (ou sans dépôt)
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2 || !from) return [];
    const isDefault = depots.find(d => d.id === from)?.isDefault;
    return equipment
      .filter(e => e.status !== 'retired' && !lines.some(l => l.equipment_id === e.id))
      .filter(e => (e.itemType === 'consumable' ? stockAt(e.id, from) > 0 : (e.depotId === from || (!e.depotId && isDefault))))
      .filter(e => `${e.name} ${e.articleNumber ?? ''} ${e.serialNumber ?? ''}`.toLowerCase().includes(q))
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, from, equipment, lines, consumableStock, depots]);

  const send = async () => {
    if (!lines.length) return toast.error('Ajoutez au moins un article');
    setBusy(true);
    const { data, error } = await supabase.rpc('send_transfer', { p_from: from, p_to: to, p_lines: lines, p_notes: notes.trim() || null });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(`Transfert ${data?.number ?? ''} en route vers ${depotName(to)}`);
    setCreating(false);
    await Promise.all([load(), refreshData()]);
  };

  const receiveLine = async (line: TransferLine, quantity?: number) => {
    const { error } = await supabase.rpc('receive_transfer_line', { p_line_id: line.id, p_quantity: quantity ?? null });
    if (error) throw new Error(errorMessage(error));
    await load();
  };

  const onScan = async (text: string) => {
    if (!receiving) return;
    const found = await findEquipmentByCode(text);
    const line = found && receiving.transfer_lines.find(l => l.equipment_id === found.equipment.id && l.received < l.quantity);
    if (!found || !line) {
      toast.error(found ? `« ${found.equipment.name} » ne fait pas partie de ce transfert (ou déjà reçu)` : `Code inconnu : ${text}`);
      throw new Error('Hors transfert');
    }
    const it = item(line.equipment_id);
    if (it?.itemType === 'consumable') {
      const rest = line.quantity - line.received;
      const answer = window.prompt(`${it.name} : quantité reçue (${rest} ${it.unit ?? ''} attendu)`, String(rest));
      if (answer === null) throw new Error('Annulé');
      const qty = Number(answer.replace(',', '.'));
      if (!(qty > 0)) {
        toast.error('Quantité invalide');
        throw new Error('Quantité');
      }
      await receiveLine(line, Math.min(qty, rest));
    } else {
      await receiveLine(line);
    }
    toast.success(`Reçu : ${it?.name ?? 'article'}`);
  };

  const close = async (transfer: Transfer, cancel: boolean) => {
    const missing = transfer.transfer_lines.filter(l => l.received < l.quantity).length;
    const message = cancel
      ? `Annuler le transfert ${transfer.number} ? Les consommables reviennent au ${depotName(transfer.from_depot_id)}.`
      : `Clôturer la réception de ${transfer.number} ?${missing ? ` ${missing} ligne(s) incomplète(s) seront signalées comme écart.` : ''}`;
    if (!window.confirm(message)) return;
    const { error } = await supabase.rpc('close_transfer', { p_transfer_id: transfer.id, p_cancel: cancel });
    if (error) return toast.error(errorMessage(error));
    toast.success(cancel ? 'Transfert annulé' : 'Réception clôturée');
    setReceiving(null);
    await Promise.all([load(), refreshData()]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white tracking-tight uppercase">Transferts</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Du matériel part d'un dépôt ; le dépôt d'arrivée le réceptionne au scanner. Un outil en route ne peut pas sortir.</p>
        </div>
        {depots.length > 1 && <Button icon={<Plus size={16} />} onClick={openCreate}>Nouveau transfert</Button>}
      </div>

      <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden" role="group" aria-label="Filtre">
        {([['open', 'En route'], ['all', 'Historique']] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
            className={`px-3 py-2 min-h-[40px] text-sm font-semibold ${filter === id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      <ul className="rounded-lg bg-white dark:bg-gray-800 shadow divide-y divide-gray-200 dark:divide-gray-700">
        {shown.length === 0 && <li className="p-4 text-sm text-gray-600 dark:text-gray-400">{depots.length > 1 ? 'Aucun transfert.' : 'Un seul dépôt : créez-en un autre dans Paramètres pour transférer du matériel.'}</li>}
        {shown.map(t => {
          const done = t.transfer_lines.filter(l => l.received >= l.quantity).length;
          const canReceive = t.status === 'in_transit' && myDepotIds.includes(t.to_depot_id);
          return (
            <li key={t.id} className="p-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 flex flex-wrap items-center gap-2">
                  <span className="font-mono">{t.number}</span>
                  <span className="inline-flex items-center gap-1">{depotName(t.from_depot_id)} <ArrowRight size={14} aria-hidden="true" /> {depotName(t.to_depot_id)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.status === 'in_transit' ? 'bg-info-100 text-info-800 dark:bg-info-900 dark:text-info-100' : t.status === 'received' ? 'bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-200' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>{STATUS[t.status]}</span>
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Envoyé le {new Date(t.sent_at).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' })}{t.sent_by ? ` par ${userName(t.sent_by)}` : ''}
                  {' · '}{t.transfer_lines.map(l => `${item(l.equipment_id)?.itemType === 'consumable' ? `${l.quantity} ` : ''}${item(l.equipment_id)?.name ?? 'Article'}`).join(', ')}
                </p>
                {t.status === 'in_transit' && <p className="text-xs text-gray-600 dark:text-gray-400">{done} / {t.transfer_lines.length} ligne(s) reçue(s)</p>}
                {t.notes && <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line">{t.notes}</p>}
              </div>
              {t.status === 'in_transit' && (
                <div className="flex flex-wrap gap-2 shrink-0">
                  {canReceive && <Button size="sm" icon={<PackageCheck size={14} />} onClick={() => setReceiving(t)}>Réceptionner</Button>}
                  {myDepotIds.includes(t.from_depot_id) && done === 0 && (
                    <Button size="sm" variant="outline" icon={<X size={14} />} onClick={() => close(t, true)}>Annuler</Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Modal isOpen={creating} onClose={() => setCreating(false)} title="Nouveau transfert" size="lg">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="trf-from" className={labelClass}>Depuis</label>
              <select id="trf-from" value={from} onChange={e => { setFrom(e.target.value); setLines([]); }} className={inputClass}>
                {depots.filter(d => myDepotIds.includes(d.id)).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="trf-to" className={labelClass}>Vers</label>
              <select id="trf-to" value={to} onChange={e => setTo(e.target.value)} className={inputClass}>
                {depots.filter(d => d.id !== from).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <p className={labelClass}>Articles</p>
            {lines.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-400">Aucun article.</p>}
            <ul className="space-y-2">
              {lines.map(line => {
                const it = item(line.equipment_id);
                const consumable = it?.itemType === 'consumable';
                return (
                  <li key={line.equipment_id} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 p-2 text-sm">
                    <span className="flex-1 min-w-[10rem] text-gray-900 dark:text-gray-100">{it?.name}</span>
                    {consumable ? (
                      <>
                        <input type="number" min={1} max={stockAt(line.equipment_id, from)} value={line.quantity} aria-label="Quantité"
                          onChange={e => setLines(ls => ls.map(l => (l.equipment_id === line.equipment_id ? { ...l, quantity: Math.max(1, Number(e.target.value) || 1) } : l)))}
                          className={`${inputClass} w-24 font-mono`} />
                        <span className="text-xs text-gray-500">{it?.unit} · {stockAt(line.equipment_id, from)} en stock</span>
                      </>
                    ) : <span className="text-xs text-gray-500">outil entier ({it?.totalQuantity ?? 1} ex.)</span>}
                    <Button size="sm" variant="outline" icon={<Trash2 size={14} />} ariaLabel="Retirer" onClick={() => setLines(ls => ls.filter(l => l.equipment_id !== line.equipment_id))} />
                  </li>
                );
              })}
            </ul>
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ajouter : nom ou numéro…" aria-label="Ajouter un article" className={`${inputClass} mt-2`} />
            {candidates.length > 0 && (
              <ul className="mt-1 rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                {candidates.map(e => (
                  <li key={e.id}>
                    <button type="button" onClick={() => { setLines(ls => [...ls, { equipment_id: e.id, quantity: 1 }]); setSearch(''); }}
                      className="w-full text-left px-3 py-2 min-h-[40px] text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100">
                      {e.name}<span className="text-xs text-gray-500"> · {e.itemType === 'consumable' ? `${stockAt(e.id, from)} ${e.unit ?? ''} en stock` : 'outil'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label htmlFor="trf-notes" className={labelClass}>Remarque</label>
            <input id="trf-notes" value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} placeholder="ex. camion de mardi, chauffeur Marc" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreating(false)}>Annuler</Button>
            <Button icon={<Send size={16} />} onClick={send} loading={busy} disabled={!from || !to || !lines.length}>Envoyer</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={receiving !== null} onClose={() => setReceiving(null)} title={receiving ? `Réception ${receiving.number}` : 'Réception'} size="lg">
        {receiving && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">Scannez chaque article arrivé à {depotName(receiving.to_depot_id)}.</p>
            {receiving.status === 'in_transit' && <QRCodeScanner onScan={onScan} />}
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              {receiving.transfer_lines.map(l => {
                const it = item(l.equipment_id);
                const complete = l.received >= l.quantity;
                return (
                  <li key={l.id} className="py-2 flex flex-wrap items-center gap-2">
                    <span className={`flex-1 min-w-[10rem] ${complete ? 'text-success-700 dark:text-success-300' : 'text-gray-900 dark:text-gray-100'}`}>{complete ? '✓ ' : ''}{it?.name}</span>
                    <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{l.received} / {l.quantity} {it?.itemType === 'consumable' ? it.unit : ''}</span>
                    {!complete && receiving.status === 'in_transit' && (
                      <Button size="sm" variant="outline" onClick={() => receiveLine(l).then(() => toast.success(`Reçu : ${it?.name}`)).catch(e => toast.error(errorMessage(e)))}>Reçu</Button>
                    )}
                  </li>
                );
              })}
            </ul>
            {receiving.status === 'in_transit' && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => close(receiving, false)}>Clôturer la réception</Button>
              </div>
            )}
            {receiving.status === 'received' && <p className="text-sm font-semibold text-success-700 dark:text-success-300">Tout est arrivé : transfert réceptionné.</p>}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Transfers;
