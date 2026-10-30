import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Lock, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import QRCodeScanner from '../components/QRCode/QRCodeScanner';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { findEquipmentByCode } from '../lib/scan';
import { errorMessage } from '../lib/requests';
import { confirmAction } from '../lib/confirm';

interface CountLine {
  id: string;
  equipment_id: string;
  expected: number;
  counted: number | null;
  added: boolean;
  reason: string | null;
}

interface InventoryCount {
  id: string;
  depot_id: string;
  status: 'open' | 'closed';
  started_at: string;
  closed_at: string | null;
  inventory_count_lines: CountLine[];
}

const REASONS = ['Casse', 'Vol / perte', 'Sortie non enregistrée', 'Réception non enregistrée', 'Erreur de saisie', 'Autre'];
const inputClass = 'rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100';
const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('fr-CH', { maximumFractionDigits: 2 }));

// Inventaire tournant : une vingtaine d'articles par passage, comptés au scanner, écarts expliqués
const Inventory: React.FC = () => {
  const { depots, equipment, refreshData } = useApp();
  const { profile, can } = useAuth();
  const myDepots = profile?.depot_ids?.length ? depots.filter(d => profile.depot_ids.includes(d.id)) : depots;
  const [depotId, setDepotId] = useState(myDepots.find(d => d.isDefault)?.id || myDepots[0]?.id || '');
  const [size, setSize] = useState(20);
  const [session, setSession] = useState<InventoryCount | null>(null);
  const [history, setHistory] = useState<InventoryCount[]>([]);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);

  // Les dépôts arrivent après le premier affichage : on choisit le dépôt par défaut dès qu'ils sont là
  useEffect(() => {
    if (!depotId && myDepots.length) setDepotId(myDepots.find(d => d.isDefault)?.id || myDepots[0].id);
  }, [depotId, myDepots]);

  const load = async () => {
    if (!depotId) return;
    const { data, error } = await supabase
      .from('inventory_counts')
      .select('*, inventory_count_lines(*)')
      .eq('depot_id', depotId)
      .order('started_at', { ascending: false })
      .limit(10);
    if (error) toast.error(errorMessage(error));
    const list = ((data || []) as InventoryCount[]).map(c => ({
      ...c,
      inventory_count_lines: c.inventory_count_lines.map(l => ({ ...l, expected: Number(l.expected), counted: l.counted === null ? null : Number(l.counted) })),
    }));
    setSession(list.find(c => c.status === 'open') ?? null);
    setHistory(list.filter(c => c.status === 'closed'));
  };

  useEffect(() => {
    setReview(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depotId]);

  const item = (id: string) => equipment.find(e => e.id === id);
  const lines = useMemo(
    () => [...(session?.inventory_count_lines ?? [])].sort((a, b) => (item(a.equipment_id)?.name ?? '').localeCompare(item(b.equipment_id)?.name ?? '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, equipment]
  );
  const counted = lines.filter(l => l.counted !== null).length;
  const gaps = lines.filter(l => l.counted !== null && l.counted !== l.expected);

  const start = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('start_inventory_count', { p_depot_id: depotId, p_size: size });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success('Inventaire lancé : comptez les articles de la liste');
    await load();
  };

  const record = async (equipmentId: string, change: { counted?: number; increment?: number; reason?: string }) => {
    if (!session) return;
    const { error } = await supabase.rpc('record_inventory_count', {
      p_count_id: session.id,
      p_equipment_id: equipmentId,
      p_counted: change.counted ?? null,
      p_increment: change.increment ?? null,
      p_reason: change.reason ?? null,
    });
    if (error) throw new Error(errorMessage(error));
    await load();
  };

  const onScan = async (text: string) => {
    const found = await findEquipmentByCode(text);
    if (!found) {
      toast.error(`Code inconnu : ${text}`);
      throw new Error('Code inconnu');
    }
    await record(found.equipment.id, { increment: 1 });
    const line = session?.inventory_count_lines.find(l => l.equipment_id === found.equipment.id);
    toast.success(`${found.equipment.name} : ${qty((line?.counted ?? 0) + 1)}${line ? '' : ' (hors liste, ajouté)'}`);
  };

  const close = async () => {
    if (!session) return;
    const missing = lines.length - counted;
    if (missing > 0 && !await confirmAction(`${missing} article(s) non compté(s) : ils restent inchangés. Clôturer quand même ?`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('close_inventory_count', { p_count_id: session.id });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(`Inventaire clôturé : ${data} écart${Number(data) > 1 ? 's' : ''} appliqué${Number(data) > 1 ? 's' : ''} ou signalé${Number(data) > 1 ? 's' : ''}`);
    setReview(false);
    await load();
    await refreshData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="mx-page-title">Inventaire tournant</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Quelques articles à chaque passage, les moins récemment comptés d'abord. Comptage à l'aveugle, écarts expliqués à la clôture.</p>
        </div>
        <select value={depotId} onChange={e => setDepotId(e.target.value)} aria-label="Dépôt" className={inputClass}>
          {myDepots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {!session ? (
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-5 space-y-4">
          <p className="text-gray-800 dark:text-gray-200">Aucun inventaire en cours dans ce dépôt.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="inv-size" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre d'articles</label>
              <input id="inv-size" type="number" min={1} max={200} value={size} onChange={e => setSize(Math.max(1, Number(e.target.value) || 20))} className={`${inputClass} w-24 font-mono`} />
            </div>
            <Button icon={<Play size={16} />} onClick={start} loading={busy} disabled={!depotId}>Lancer l'inventaire</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Démarré le {new Date(session.started_at).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' })} · <span className="font-mono">{counted}/{lines.length}</span> compté{counted > 1 ? 's' : ''}
            </p>
            <QRCodeScanner onScan={onScan} disableAutoFocus={review} />
            <p className="text-xs text-gray-600 dark:text-gray-400">Chaque scan compte une unité (une boîte, un outil). Pour un lot, saisissez la quantité dans la liste.</p>
          </div>

          <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><ClipboardList size={18} aria-hidden="true" /> Articles à compter</h2>
              {can('manage_stock') && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setReview(r => !r)}>{review ? 'Masquer les quantités attendues' : 'Vérifier les écarts'}</Button>
                  {review && <Button size="sm" icon={<Lock size={14} />} onClick={close} loading={busy}>Clôturer</Button>}
                </div>
              )}
            </div>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {lines.map(line => {
                const e = item(line.equipment_id);
                const gap = line.counted !== null ? line.counted - line.expected : null;
                return (
                  <li key={line.id} className="py-2 flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-[160px]">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{e?.name ?? 'Article'}{line.added ? <span className="ml-1 text-xs text-info-600 dark:text-info-100">(hors liste)</span> : null}</p>
                      <p className="font-mono text-xs text-gray-600 dark:text-gray-400">{e?.articleNumber}{review ? ` · attendu ${qty(line.expected)}` : ''}</p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      defaultValue={line.counted ?? ''}
                      key={`${line.id}-${line.counted}`}
                      placeholder="?"
                      aria-label={`Quantité comptée ${e?.name}`}
                      onBlur={ev => ev.target.value !== '' && Number(ev.target.value) !== line.counted && record(line.equipment_id, { counted: Number(ev.target.value) }).catch(err => toast.error(err.message))}
                      className={`${inputClass} w-20 text-right font-mono`}
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400 w-10">{e?.unit ?? 'pce'}</span>
                    {review && gap !== null && gap !== 0 && (
                      <>
                        <span className={`font-mono text-xs font-semibold ${gap < 0 ? 'text-tone-danger' : 'text-tone-success'}`}>{gap > 0 ? '+' : ''}{qty(gap)}</span>
                        <select
                          value={line.reason ?? ''}
                          onChange={ev => record(line.equipment_id, { counted: line.counted ?? 0, reason: ev.target.value }).catch(err => toast.error(err.message))}
                          aria-label={`Motif de l'écart ${e?.name}`}
                          className={inputClass}
                        >
                          <option value="">Motif…</option>
                          {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            {review && (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {gaps.length === 0 ? 'Aucun écart.' : `${gaps.length} écart${gaps.length > 1 ? 's' : ''} : les consommables seront corrigés (en tenant compte des sorties pendant le comptage), les écarts d'outils seront signalés.`}
              </p>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-4">
          <h2 className="font-bold text-gray-900 dark:text-white mb-2">Derniers inventaires</h2>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            {history.map(h => {
              const n = h.inventory_count_lines.filter(l => l.counted !== null && Number(l.counted) !== Number(l.expected)).length;
              return (
                <li key={h.id} className="py-1.5 flex justify-between text-gray-800 dark:text-gray-200">
                  <span>{new Date(h.closed_at ?? h.started_at).toLocaleDateString('fr-CH')} · {h.inventory_count_lines.length} articles</span>
                  <span className={n ? 'text-tone-warning' : 'text-tone-success'}>{n ? `${n} écart${n > 1 ? 's' : ''}` : 'sans écart'}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
};

export default Inventory;
