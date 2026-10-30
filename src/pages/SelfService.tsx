import React, { useEffect, useMemo, useState } from 'react';
import { Inbox, Minus, PackageMinus, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import QRCodeScanner from '../components/QRCode/QRCodeScanner';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/requests';
import { findEquipmentByCode } from '../lib/scan';
import { useSiteSuggestions } from '../lib/sites';

interface TakeLine {
  equipment_id: string;
  name: string;
  unit: string;
  quantity: number;
  max: number | null;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// Sur le téléphone du collaborateur : prendre des consommables en libre-service, déposer ses outils dans la boîte de retour
const SelfService: React.FC = () => {
  const { equipment, equipmentInstances, checkouts, depots, refreshData } = useApp();
  const { profile } = useAuth();
  const sites = useSiteSuggestions();
  const [tab, setTab] = useState<'take' | 'return'>('take');
  const [selfService, setSelfService] = useState<Record<string, number | null>>({});
  const [lines, setLines] = useState<TakeLine[]>([]);
  const [depotId, setDepotId] = useState('');
  const [destination, setDestination] = useState('');
  const [toReturn, setToReturn] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('equipment').select('id, self_service_max').eq('self_service', true)
      .then(({ data }) => setSelfService(Object.fromEntries((data || []).map(r => [r.id, r.self_service_max === null ? null : Number(r.self_service_max)]))));
  }, []);

  useEffect(() => {
    if (!depotId && depots.length) setDepotId(depots.find(d => d.isDefault)?.id || depots[0].id);
  }, [depotId, depots]);

  const mine = useMemo(
    () => checkouts.filter(c => c.userId === profile?.id && (c.status === 'active' || c.status === 'overdue')),
    [checkouts, profile]
  );
  const [dropped, setDropped] = useState<string[]>([]);
  useEffect(() => {
    if (!profile) return;
    supabase.from('checkouts').select('id').eq('user_id', profile.id).not('dropped_at', 'is', null).in('status', ['active', 'overdue'])
      .then(({ data }) => setDropped((data || []).map(r => r.id)));
  }, [profile, checkouts]);
  const returnable = mine.filter(c => !dropped.includes(c.id));
  const itemName = (id: string) => equipment.find(e => e.id === id)?.name ?? 'Article';
  const qr = (id?: string) => (id ? equipmentInstances.find(i => i.id === id)?.qrCode : undefined);

  const onScanTake = async (text: string) => {
    const found = await findEquipmentByCode(text);
    if (!found) {
      toast.error(`Code inconnu : ${text}`);
      throw new Error('Inconnu');
    }
    const item = found.equipment;
    if (!(item.id in selfService)) {
      toast.error(`« ${item.name} » n'est pas en libre-service : passez au magasin`);
      throw new Error('Pas libre-service');
    }
    setLines(ls => {
      const existing = ls.find(l => l.equipment_id === item.id);
      if (existing) return ls.map(l => (l.equipment_id === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...ls, { equipment_id: item.id, name: item.name, unit: item.unit ?? '', quantity: 1, max: selfService[item.id] }];
    });
    toast.success(item.name);
  };

  const onScanReturn = async (text: string) => {
    const found = await findEquipmentByCode(text);
    const match = found && returnable.find(c => c.equipmentId === found.equipment.id && (!found.instance || c.instanceId === found.instance.id) && !toReturn.includes(c.id));
    if (!match) {
      toast.error(found ? `Vous n'avez pas « ${found.equipment.name} » (ou déjà coché)` : `Code inconnu : ${text}`);
      throw new Error('Pas emprunté');
    }
    setToReturn(ids => [...ids, match.id]);
    toast.success(itemName(match.equipmentId));
  };

  const take = async () => {
    const tooMuch = lines.find(l => l.max !== null && l.quantity > l.max);
    if (tooMuch) return toast.error(`${tooMuch.name} : au plus ${tooMuch.max} ${tooMuch.unit} par prise`);
    setBusy(true);
    const { error } = await supabase.rpc('self_service_take', {
      p_depot_id: depotId,
      p_items: lines.map(l => ({ equipment_id: l.equipment_id, quantity: l.quantity })),
      p_destination: destination.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success('Pris en libre-service : c\'est noté à votre nom');
    setLines([]);
    await refreshData();
  };

  const drop = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('drop_box_return', { p_checkout_ids: toReturn, p_note: note.trim() || null });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(`${data} outil${data > 1 ? 's' : ''} déposé${data > 1 ? 's' : ''} : le magasin contrôlera l'état`);
    setToReturn([]);
    setNote('');
    await refreshData();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="mx-page-title">Libre-service</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Prenez les consommables de l'armoire ou déposez vos outils dans la boîte de retour, avec votre téléphone.</p>
      </div>

      <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden" role="tablist">
        {([['take', 'Prendre'], ['return', `Rendre${returnable.length ? ` (${returnable.length})` : ''}`]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`px-4 py-2 min-h-[44px] text-sm font-semibold ${tab === id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'take' && (
        <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-4">
          {Object.keys(selfService).length === 0 && <p className="text-sm text-warning-700 dark:text-warning-300">Aucun consommable n'est encore en libre-service (fiche de l'article, côté magasin).</p>}
          <QRCodeScanner onScan={onScanTake} disableAutoFocus />
          {lines.length > 0 && (
            <ul className="space-y-2">
              {lines.map(l => (
                <li key={l.equipment_id} className="flex items-center gap-2 rounded-md bg-gray-50 dark:bg-gray-700/40 px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                  <span className="flex-1 min-w-0 truncate">{l.name}</span>
                  <Button size="sm" variant="outline" icon={<Minus size={14} />} ariaLabel="Un de moins" onClick={() => setLines(ls => ls.map(x => (x.equipment_id === l.equipment_id ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))} />
                  <span className="w-10 text-center font-mono">{l.quantity}</span>
                  <Button size="sm" variant="outline" icon={<Plus size={14} />} ariaLabel="Un de plus" disabled={l.max !== null && l.quantity >= l.max}
                    onClick={() => setLines(ls => ls.map(x => (x.equipment_id === l.equipment_id ? { ...x, quantity: x.quantity + 1 } : x)))} />
                  <span className="text-xs text-gray-500 w-12">{l.unit}</span>
                  <Button size="sm" variant="outline" icon={<Trash2 size={14} />} ariaLabel={`Retirer ${l.name}`} onClick={() => setLines(ls => ls.filter(x => x.equipment_id !== l.equipment_id))} />
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ss-depot" className={labelClass}>Armoire du dépôt</label>
              <select id="ss-depot" value={depotId} onChange={e => setDepotId(e.target.value)} className={inputClass}>
                {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ss-site" className={labelClass}>Pour le chantier</label>
              <input id="ss-site" list="ss-sites" autoComplete="off" value={destination} onChange={e => setDestination(e.target.value)} className={inputClass} placeholder="ex. Chantier Renens" />
              <datalist id="ss-sites">{sites.map(s => <option key={s} value={s} />)}</datalist>
            </div>
          </div>
          <div className="flex justify-end">
            <Button icon={<PackageMinus size={16} />} onClick={take} loading={busy} disabled={!lines.length || !depotId}>Je prends</Button>
          </div>
        </section>
      )}

      {tab === 'return' && (
        <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">Le magasin est fermé ? Déposez l'outil dans la boîte, scannez-le (ou cochez-le). Il reste à votre nom jusqu'au contrôle du magasin, mais vous n'êtes plus relancé.</p>
          {returnable.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Vous n'avez rien à rendre.</p> : (
            <>
              <QRCodeScanner onScan={onScanReturn} disableAutoFocus />
              <ul className="space-y-1">
                {returnable.map(c => (
                  <li key={c.id}>
                    <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 min-h-[40px]">
                      <input type="checkbox" checked={toReturn.includes(c.id)} onChange={() => setToReturn(ids => (ids.includes(c.id) ? ids.filter(x => x !== c.id) : [...ids, c.id]))}
                        className="h-5 w-5 rounded border-gray-300 text-primary-600" />
                      <span className="flex-1 truncate">{itemName(c.equipmentId)}{qr(c.instanceId) ? ` · ${qr(c.instanceId)}` : ''}</span>
                      <span className={`text-xs ${new Date(c.dueDate).getTime() < Date.now() ? 'text-danger-700 dark:text-danger-300 font-semibold' : 'text-gray-500'}`}>
                        {new Date(c.dueDate).getTime() < Date.now() ? 'en retard' : `→ ${new Date(c.dueDate).toLocaleDateString('fr-CH')}`}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div>
                <label htmlFor="drop-note" className={labelClass}>Remarque pour le magasin</label>
                <input id="drop-note" value={note} onChange={e => setNote(e.target.value)} className={inputClass} placeholder="ex. disque usé, batterie vide" />
              </div>
              <div className="flex justify-end">
                <Button icon={<Inbox size={16} />} onClick={drop} loading={busy} disabled={!toReturn.length}>Déposé dans la boîte</Button>
              </div>
            </>
          )}
          {dropped.length > 0 && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Déjà dans la boîte, en attente du contrôle : {mine.filter(c => dropped.includes(c.id)).map(c => itemName(c.equipmentId)).join(', ')}.
            </p>
          )}
        </section>
      )}
    </div>
  );
};

export default SelfService;
