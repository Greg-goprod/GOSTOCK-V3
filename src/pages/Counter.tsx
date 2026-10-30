import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, CheckCircle2, Plug, Inbox, UploadCloud, Minus, Plus, Trash2, Undo2, UserRound, WifiOff, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import QRCodeScanner from '../components/QRCode/QRCodeScanner';
import PhotoInput from '../components/common/PhotoInput';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useSiteSuggestions } from '../lib/sites';
import { useSignatureRule } from '../lib/signature';
import Modal from '../components/common/Modal';
import SignaturePad from '../components/common/SignaturePad';
import { findEquipmentByCode, normalizeScannedCode } from '../lib/scan';
import { isBadgeCode } from '../lib/badges';
import { Kit, isKitCode, kitCodeOf } from '../lib/kits';
import {
  CounterOperation, NetworkDown, dropQueued, enqueue, flushQueue, isNetworkError, loadQueue, loadSnapshot, saveSnapshot, submitOperation,
} from '../lib/offlineCounter';
import { errorMessage, toLocalInput } from '../lib/requests';
import { CheckoutRecord, Equipment, EquipmentInstance, User } from '../types';
import { DateTimeInput } from '../components/common/DateInput';
import { confirmAction } from '../lib/confirm';
import SiteNotice from '../components/common/SiteNotice';
import { canBorrowNow } from '../lib/people';
import { MxSegmented } from '../components/mx/MxSegmented';

type Mode = 'auto' | 'out' | 'in';

type Condition = 'ok' | 'dirty' | 'incomplete' | 'to_repair' | 'broken';
interface ReturnCheck {
  condition: Condition;
  notes: string;
  photos: string[];
}
const CONDITIONS: { id: Condition; label: string; className: string }[] = [
  { id: 'ok', label: 'OK', className: 'mx-fill-success' },
  { id: 'dirty', label: 'Sale', className: 'mx-fill-warning' },
  { id: 'incomplete', label: 'Incomplet', className: 'mx-fill-warning' },
  { id: 'to_repair', label: 'À réparer', className: 'mx-fill-danger' },
  { id: 'broken', label: 'Cassé', className: 'mx-fill-danger' },
];
const DEFAULT_CHECK: ReturnCheck = { condition: 'ok', notes: '', photos: [] };

interface CartLine {
  key: string;
  equipment: Equipment;
  instance?: EquipmentInstance;
  quantity: number;
  kitId?: string;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const at17 = (daysFromToday: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(17, 0, 0, 0);
  return d;
};
const endOfWeek = () => {
  const d = new Date();
  const toFriday = (5 - d.getDay() + 7) % 7;
  return at17(toFriday);
};

// Comptoir du magasin : badge de la personne, puis les articles ; sorties et retours en une validation
const Counter: React.FC = () => {
  const sites = useSiteSuggestions();
  const app = useApp();
  const { depots, refreshData } = app;
  const { profile } = useAuth();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [kits, setKits] = useState<Kit[]>([]);
  // Accessoires à rappeler quand un outil sort (chargeur, batteries…)
  const [accessories, setAccessories] = useState<{ equipment_id: string; accessory_id: string }[]>([]);
  const [badges, setBadges] = useState<Record<string, string>>({});
  const [queue, setQueue] = useState<CounterOperation[]>(loadQueue);
  const [syncing, setSyncing] = useState(false);
  const needsSignature = useSignatureRule();
  const [signing, setSigning] = useState(false);
  const [signatureDraft, setSignatureDraft] = useState<string | null>(null);

  // Hors ligne dès l'ouverture : on travaille sur la dernière copie locale (personnes, articles, emprunts)
  const snapshot = useMemo(loadSnapshot, []);
  const live = app.users.length > 0 && app.equipment.length > 0;
  const users = live ? app.users : ((snapshot?.users ?? []) as unknown as User[]);
  const equipment = live ? app.equipment : ((snapshot?.equipment ?? []) as unknown as Equipment[]);
  const equipmentInstances = live ? app.equipmentInstances : ((snapshot?.instances ?? []) as unknown as EquipmentInstance[]);
  const checkouts = useMemo(
    () => (live ? app.checkouts : ((snapshot?.held ?? []) as unknown as CheckoutRecord[])),
    [live, app.checkouts, snapshot]
  );
  const kitList = kits.length ? kits : snapshot?.kits ?? [];
  const badgeMap = Object.keys(badges).length ? badges : snapshot?.badges ?? {};
  const [person, setPerson] = useState<User | null>(null);
  // « Pour le compte de » : un chef d'équipe retire pour quelqu'un, qui reste responsable du matériel
  const [beneficiary, setBeneficiary] = useState<User | null>(null);
  const owner = beneficiary ?? person;
  const [mode, setMode] = useState<Mode>('auto');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [returns, setReturns] = useState<string[]>([]);
  // État constaté au retour, par emprunt (OK par défaut)
  const [checks, setChecks] = useState<Record<string, ReturnCheck>>({});
  const checkOf = (id: string) => checks[id] ?? DEFAULT_CHECK;
  const setCheck = (id: string, change: Partial<ReturnCheck>) => setChecks(c => ({ ...c, [id]: { ...checkOf(id), ...change } }));
  const [due, setDue] = useState(toLocalInput(at17(1)));
  const [destination, setDestination] = useState('');
  const myDepots = profile?.depot_ids?.length ? depots.filter(d => profile.depot_ids.includes(d.id)) : depots;
  const [depotId, setDepotId] = useState(myDepots.find(d => d.isDefault)?.id || myDepots[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Les dépôts arrivent après le premier affichage : dépôt par défaut dès qu'ils sont là
  useEffect(() => {
    if (!depotId && myDepots.length) setDepotId(myDepots.find(d => d.isDefault)?.id || myDepots[0].id);
  }, [depotId, myDepots]);
  const [pickerSearch, setPickerSearch] = useState('');

  useEffect(() => {
    supabase.from('kits').select('*, kit_items(*)').eq('active', true).then(({ data }) => { if (data) setKits(data as Kit[]); });
    supabase.from('equipment_accessories').select('equipment_id, accessory_id').then(({ data }) => { if (data) setAccessories(data); });
    supabase.from('user_badges').select('user_id, code').then(({ data }) => {
      if (data) setBadges(Object.fromEntries(data.map(b => [String(b.code).toLowerCase(), b.user_id as string])));
    });
  }, []);

  // Copie locale tenue à jour tant que le réseau est là
  useEffect(() => {
    if (!live) return;
    saveSnapshot({
      savedAt: new Date().toISOString(),
      users: app.users.map(({ id, first_name, last_name, department, active }) => ({ id, first_name, last_name, department, active })),
      badges,
      equipment: app.equipment.map(({ id, name, itemType, unit, articleNumber, serialNumber, availableQuantity, status }) => ({ id, name, itemType, unit, articleNumber, serialNumber, availableQuantity, status })),
      instances: app.equipmentInstances.map(({ id, equipmentId, qrCode }) => ({ id, equipmentId, qrCode })),
      held: app.checkouts.filter(c => c.status === 'active' || c.status === 'overdue')
        .map(({ id, equipmentId, userId, instanceId, kitId, dueDate, status }) => ({ id, equipmentId, userId, instanceId, kitId, dueDate, status })),
      kits,
    });
  }, [live, app.users, app.equipment, app.equipmentInstances, app.checkouts, kits, badges]);

  const sync = async () => {
    if (syncing || !loadQueue().length) return;
    setSyncing(true);
    const result = await flushQueue();
    setQueue(loadQueue());
    setSyncing(false);
    if (result.sent) toast.success(`${result.sent} opération${result.sent > 1 ? 's' : ''} faite${result.sent > 1 ? 's' : ''} hors ligne envoyée${result.sent > 1 ? 's' : ''}`);
    if (result.failed) toast.error(`${result.failed} opération${result.failed > 1 ? 's' : ''} refusée${result.failed > 1 ? 's' : ''} : voir « En attente d'envoi »`);
    if (result.sent || result.failed) await refreshData();
  };

  useEffect(() => {
    const up = () => { setOnline(true); sync(); };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    if (navigator.onLine) sync();
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const held = useMemo(
    () => (owner ? checkouts.filter(c => c.userId === owner.id && (c.status === 'active' || c.status === 'overdue')) : []),
    [checkouts, owner]
  );
  const itemName = (id: string) => equipment.find(e => e.id === id)?.name ?? 'Article';
  const outNow = checkouts.filter(c => c.status === 'active' || c.status === 'overdue');
  const droppedBox = outNow.filter(c => c.droppedAt);
  const kitName = (id?: string) => (id ? kitList.find(k => k.id === id)?.name : undefined);

  const reset = () => {
    setCart([]);
    setReturns([]);
    setChecks({});
    setDestination('');
  };

  // Renvoie false si la personne garde son panier (changement refusé)
  const selectPerson = async (user: User) => {
    if (person && person.id !== user.id && (cart.length || returns.length)) {
      if (!await confirmAction(`Passer à ${user.first_name} ${user.last_name} ? Le panier en cours sera vidé.`)) return false;
    }
    if (person?.id !== user.id) {
      reset();
      setBeneficiary(null);
    }
    setPerson(user);
    setPickerOpen(false);
  };

  const addToCart = (item: Equipment, instance?: EquipmentInstance, kitId?: string, quantity = 1) => {
    setCart(lines => {
      if (instance) {
        if (lines.some(l => l.instance?.id === instance.id)) {
          toast(`${instance.qrCode} est déjà dans le panier`);
          return lines;
        }
        return [...lines, { key: instance.id, equipment: item, instance, quantity: 1, kitId }];
      }
      const key = kitId ? `${kitId}:${item.id}` : item.id;
      const existing = lines.find(l => l.key === key);
      if (existing) return lines.map(l => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l));
      return [...lines, { key, equipment: item, quantity, kitId }];
    });
  };

  // Recherche dans la copie locale (hors ligne) : identifiant, QR d'exemplaire, n° d'article ou de série
  const findLocal = (text: string): { item: Equipment; instance?: EquipmentInstance } | null => {
    const code = normalizeScannedCode(text).toLowerCase();
    const byId = equipment.find(e => e.id === code);
    if (byId) return { item: byId };
    const instance = equipmentInstances.find(i => i.qrCode.toLowerCase() === code);
    if (instance) {
      const item = equipment.find(e => e.id === instance.equipmentId);
      return item ? { item, instance } : null;
    }
    for (const field of ['articleNumber', 'serialNumber'] as const) {
      const matches = equipment.filter(e => (e[field] ?? '').toLowerCase() === code);
      if (matches.length === 1) return { item: matches[0] };
    }
    return null;
  };

  const findByCode = async (text: string) => {
    if (navigator.onLine) {
      try {
        const found = await findEquipmentByCode(text);
        if (!found) return null;
        const item = equipment.find(e => e.id === found.equipment.id);
        if (!item) throw new Error('Article introuvable');
        return { item, instance: found.instance ? equipmentInstances.find(i => i.id === found.instance!.id) : undefined };
      } catch (error) {
        if (!isNetworkError(error)) throw error;
      }
    }
    return findLocal(text);
  };

  const scanKit = (text: string) => {
    const kit = kitList.find(k => k.code.toUpperCase() === kitCodeOf(text));
    if (!kit) {
      toast.error('Kit inconnu ou désactivé');
      throw new Error('Kit inconnu');
    }
    const heldKit = held.filter(c => c.kitId === kit.id && !returns.includes(c.id));
    if (mode === 'in' || (mode === 'auto' && heldKit.length)) {
      if (!heldKit.length) {
        toast.error(`${owner?.first_name ?? ''} n'a pas le kit « ${kit.name} »`);
        throw new Error('Kit pas emprunté');
      }
      setReturns(ids => [...ids, ...heldKit.map(c => c.id)]);
      toast(`Kit « ${kit.name} » : ${heldKit.length} outil${heldKit.length > 1 ? 's' : ''} en retour. Retire du panier ce qui manque : cela restera à son nom.`, { duration: 7000, icon: <Briefcase size={18} aria-hidden="true" /> });
      return;
    }
    const problems: string[] = [];
    for (const line of kit.kit_items) {
      const item = equipment.find(e => e.id === line.equipment_id);
      if (!item) continue;
      if (line.instance_id) {
        const instance = equipmentInstances.find(i => i.id === line.instance_id);
        if (!instance || outNow.some(c => c.instanceId === line.instance_id)) {
          problems.push(`${item.name}${instance ? ` (${instance.qrCode})` : ''} déjà sorti`);
          continue;
        }
        addToCart(item, instance, kit.id);
      } else {
        if ((item.availableQuantity ?? line.quantity) < line.quantity) problems.push(`${item.name} : ${item.availableQuantity ?? 0} sur ${line.quantity} disponibles`);
        addToCart(item, undefined, kit.id, line.quantity);
      }
    }
    if (problems.length) toast.error(`Kit « ${kit.name} » incomplet : ${problems.join(', ')}`, { duration: 8000 });
    else toast.success(`Sortie : kit « ${kit.name} »`);
  };

  // Un emprunt en cours de cette personne pour cet article (et cet exemplaire), pas encore coché
  const heldMatch = (item: Equipment, instance?: EquipmentInstance) =>
    held.find(c => c.equipmentId === item.id && (!instance || c.instanceId === instance.id) && !returns.includes(c.id));

  const onScan = async (text: string) => {
    if (isBadgeCode(text)) {
      let userId: string | null = null;
      const code = text.trim().replace(/^GOMAT-USER:/i, '').toLowerCase();
      if (navigator.onLine) {
        const { data, error } = await supabase.rpc('find_user_by_badge', { p_code: text });
        if (error && !isNetworkError(error)) throw new Error(errorMessage(error));
        userId = error ? badgeMap[code] ?? null : (data as string | null);
      } else {
        userId = badgeMap[code] ?? null;
      }
      let user = users.find(u => u.id === userId);
      // Personne créée depuis l'ouverture du comptoir : on la lit directement, puis on rafraîchit les listes
      if (!user && userId) {
        const { data: row } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
        if (row) user = { ...row, dateCreated: row.created_at } as User;
        void app.refreshData();
      }
      if (!user && !userId && navigator.onLine) {
        // Motif exact : accès échu (avec la date), personne partie, badge inconnu
        const { data: reason } = await supabase.rpc('badge_problem', { p_code: text });
        if (reason) throw new Error(reason as string);
      }
      if (!user) throw new Error(userId ? 'Personne introuvable' : 'Badge inconnu, accès suspendu ou personne partie');
      selectPerson(user);
      toast.success(`${user.first_name} ${user.last_name}`);
      return;
    }

    if (!person) {
      toast.error("Scanne d'abord le badge de la personne");
      throw new Error('Aucune personne');
    }

    if (isKitCode(text)) return scanKit(text);

    const found = await findByCode(text);
    if (!found) {
      toast.error(`Code inconnu : ${text}`);
      throw new Error('Code inconnu');
    }
    const { item, instance } = found;

    if (item.itemType === 'consumable') {
      if (mode === 'in') {
        toast.error('Un consommable ne se rend pas : il est décompté à la sortie');
        throw new Error('Consommable');
      }
      addToCart(item);
      return;
    }

    const match = heldMatch(item, instance);
    if (mode === 'in' || (mode === 'auto' && match)) {
      if (!match) {
        toast.error(`${owner?.first_name ?? person.first_name} n'a pas « ${item.name} »`);
        throw new Error('Pas emprunté');
      }
      setReturns(ids => [...ids, match.id]);
      toast.success(`Retour : ${item.name}`);
      return;
    }
    // Refus dès le scan, avec le vrai motif (sinon la base refuse seulement à la validation)
    if (item.status === 'retired') {
      toast.error(item.rentalId ? `« ${item.name} » est rendu au loueur : il ne peut plus sortir` : `« ${item.name} » est retiré du service`);
      throw new Error('Retiré');
    }
    if (item.rentalUntil && due.slice(0, 10) > item.rentalUntil) {
      toast.error(`« ${item.name} » est loué jusqu'au ${new Date(`${item.rentalUntil}T12:00:00`).toLocaleDateString('fr-CH')} : choisis un retour avant`);
      throw new Error('Location');
    }
    if (item.requiredTrainingId && navigator.onLine && owner) {
      const { data: problem } = await supabase.rpc('training_problem', {
        p_user_id: owner.id, p_equipment_id: item.id, p_until: new Date(due).toISOString(),
      });
      if (problem) {
        toast.error(problem as string, { duration: 8000 });
        throw new Error('Permis');
      }
    }
    addToCart(item, instance);
    toast.success(`Sortie : ${item.name}`);
    const reminders = accessories
      .filter(a => a.equipment_id === item.id && !cart.some(l => l.equipment.id === a.accessory_id))
      .map(a => equipment.find(e => e.id === a.accessory_id)?.name)
      .filter(Boolean);
    if (reminders.length) toast(`Avec cet outil : ${reminders.join(', ')}`, { icon: <Plug size={18} aria-hidden="true" />, duration: 6000 });
  };

  const toolLines = cart.filter(l => l.equipment.itemType !== 'consumable');
  const consumableLines = cart.filter(l => l.equipment.itemType === 'consumable');

  const validate = async (signature?: string) => {
    if (!person || !owner) return;
    // Matériel de valeur : la personne qui le reçoit signe avant l'enregistrement
    const valuable = toolLines.filter(l => needsSignature(l.equipment));
    if (valuable.length && !signature) {
      setSignatureDraft(null);
      setSigning(true);
      return;
    }
    setSigning(false);
    for (const id of returns) {
      const check = checkOf(id);
      if (check.condition !== 'ok' && check.condition !== 'dirty' && !check.notes.trim() && !check.photos.length) {
        toast.error('Décris le problème (remarque ou photo) pour chaque retour non conforme');
        return;
      }
    }
    const damaged = returns.filter(id => ['to_repair', 'broken'].includes(checkOf(id).condition)).length;
    const op: CounterOperation = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ownerId: owner.id,
      ownerName: `${owner.first_name} ${owner.last_name}`,
      pickedUpBy: beneficiary ? `${person.first_name} ${person.last_name}` : null,
      returns: returns.map(id => {
        const check = checkOf(id);
        const c = held.find(x => x.id === id);
        return { checkoutId: id, label: c ? itemName(c.equipmentId) : 'article', condition: check.condition, notes: check.notes.trim() || null, photos: check.photos };
      }),
      tools: toolLines.map(l => (l.instance
        ? { equipment_id: l.equipment.id, instance_id: l.instance.id, kit_id: l.kitId }
        : { equipment_id: l.equipment.id, quantity: l.quantity, kit_id: l.kitId })),
      toolLabels: toolLines.map(l => `${l.quantity > 1 ? `${l.quantity} × ` : ''}${l.equipment.name}`),
      consumables: consumableLines.map(l => ({ equipment_id: l.equipment.id, quantity: l.quantity, label: `${l.quantity} ${l.equipment.unit ?? ''} ${l.equipment.name}`.replace(/\s+/g, ' ') })),
      due,
      destination: destination.trim() || null,
      depotId,
      signature: signature ?? null,
      signedName: signature ? `${person.first_name} ${person.last_name}` : null,
    };

    const finish = () => {
      reset();
      setPerson(null);
      setBeneficiary(null);
    };
    const keepForLater = (doneSteps: string[]) => {
      enqueue(op);
      setQueue(loadQueue());
      toast(`Pas de réseau : ${doneSteps.length ? `fait ${doneSteps.join(', ')} ; ` : ''}le reste est gardé sur cet appareil et partira tout seul au retour du réseau.`, { icon: <WifiOff size={18} aria-hidden="true" />, duration: 7000 });
      finish();
    };

    if (!navigator.onLine) {
      keepForLater([]);
      return;
    }

    setBusy(true);
    const done: string[] = [];
    try {
      await submitOperation(op, false, done);
      const summary = [
        returns.length ? `${returns.length} retour${returns.length > 1 ? 's' : ''}${damaged ? ` (dont ${damaged} en maintenance)` : ''}` : '',
        ...done.filter(d => d.startsWith('bon')),
        consumableLines.length ? `${consumableLines.length} consommable${consumableLines.length > 1 ? 's' : ''}` : '',
      ].filter(Boolean);
      toast.success(`${op.ownerName} : ${summary.join(', ')}`);
      finish();
    } catch (error) {
      if (error instanceof NetworkDown) keepForLater(done);
      else toast.error(`${done.length ? `Fait : ${done.join(', ')}. ` : ''}Arrêt : ${errorMessage(error)}`);
    } finally {
      setBusy(false);
      await refreshData();
    }
  };

  const filteredUsers = users
    .filter(canBorrowNow)
    .filter(u => `${u.first_name} ${u.last_name} ${u.department ?? ''}`.toLowerCase().includes(pickerSearch.toLowerCase()))
    .slice(0, 30);

  const count = returns.length + cart.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="mx-page-title">Comptoir</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Badge de la personne, puis les articles ou le QR d'un kit. Un article qu'elle a déjà part en retour.</p>
        </div>
        <MxSegmented aria-label="Mode de scan" value={mode} onChange={v => setMode(v as Mode)}
          options={[{ value: 'auto', label: 'Auto' }, { value: 'out', label: 'Sortie' }, { value: 'in', label: 'Retour' }]} />
      </div>

      {!online && (
        <div role="status" className="flex items-start gap-3 rounded-lg bg-warning-100 dark:bg-warning-900/40 px-4 py-3 text-sm text-warning-900 dark:text-warning-100">
          <WifiOff size={20} aria-hidden="true" className="shrink-0 mt-0.5" />
          <p>
            <strong>Hors ligne.</strong> Les scans continuent avec la copie locale
            {snapshot ? ` du ${new Date(snapshot.savedAt).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' })}` : ''} ;
            chaque validation est gardée sur cet appareil et part toute seule au retour du réseau. Photos indisponibles.
          </p>
        </div>
      )}

      {!person && droppedBox.length > 0 && (
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-2">
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Inbox size={18} aria-hidden="true" /> Boîte de retour ({droppedBox.length})</h2>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            {[...new Set(droppedBox.map(c => c.userId))].map(userId => {
              const u = users.find(x => x.id === userId);
              const items = droppedBox.filter(c => c.userId === userId);
              return (
                <li key={userId} className="py-2 flex flex-wrap items-center gap-2">
                  <span className="flex-1 min-w-[12rem] text-gray-800 dark:text-gray-200">
                    <span className="font-medium">{u ? `${u.first_name} ${u.last_name}` : 'Personne'}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400"> · {items.map(c => itemName(c.equipmentId)).join(', ')} · déposé le {new Date(items[0].droppedAt!).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </span>
                  {u && (
                    <Button size="sm" variant="outline" onClick={async () => { if (await selectPerson(u)) setReturns(items.map(c => c.id)); }}>Contrôler</Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {queue.length > 0 && (
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-gray-900 dark:text-white">En attente d'envoi ({queue.length})</h2>
            <Button size="sm" variant="outline" icon={<UploadCloud size={14} />} onClick={sync} loading={syncing} disabled={!online}>Envoyer maintenant</Button>
          </div>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            {queue.map(op => (
              <li key={op.id} className="py-2 flex items-start gap-2">
                <div className="flex-1 min-w-0 text-gray-800 dark:text-gray-200">
                  <p>
                    <span className="font-medium">{op.ownerName}</span>
                    <span className="text-xs text-gray-500"> · {new Date(op.createdAt).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 break-words">
                    {[
                      op.returns.length ? `Retours : ${op.returns.map(r => r.label).join(', ')}` : '',
                      op.toolLabels.length ? `Sorties : ${op.toolLabels.join(', ')}` : '',
                      op.consumables.length ? `Consommables : ${op.consumables.map(c => c.label).join(', ')}` : '',
                    ].filter(Boolean).join(' · ')}
                  </p>
                  {op.error && <p className="text-xs text-tone-danger">Refusé : {op.error}</p>}
                </div>
                {op.error && (
                  <Button size="sm" variant="outline" icon={<Trash2 size={14} />} ariaLabel="Abandonner cette opération"
                    onClick={async () => {
                      if (!await confirmAction('Abandonner cette opération ? Elle ne sera pas enregistrée.')) return;
                      dropQueued(op.id);
                      setQueue(loadQueue());
                    }} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-4">
          <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-4">
            <QRCodeScanner onScan={onScan} />
          </div>

          <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-3">
            {person ? (
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-11 w-11 shrink-0 rounded-full bg-primary-600 text-white flex items-center justify-center font-black">
                    {person.first_name[0]}{person.last_name[0]}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">{person.first_name} {person.last_name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{person.department || 'Aucun service'} · {held.length} article{held.length > 1 ? 's' : ''} en sa possession</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" icon={<X size={14} />} ariaLabel="Changer de personne" onClick={() => { reset(); setPerson(null); }} />
              </div>
            ) : (
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <UserRound size={22} aria-hidden="true" />
                <p className="text-sm">Scanne le badge (carte ou téléphone), ou <button type="button" className="text-primary-700 dark:text-primary-300 underline inline-flex items-center min-h-[44px] lg:min-h-0 px-1" onClick={() => setPickerOpen(o => !o)}>choisis la personne</button>.</p>
              </div>
            )}

            {pickerOpen && !person && (
              <div className="space-y-2">
                <input type="search" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Nom ou service…" aria-label="Rechercher une personne" className={inputClass} autoFocus />
                <ul className="max-h-64 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700 rounded-md border border-gray-200 dark:border-gray-700">
                  {filteredUsers.map(u => (
                    <li key={u.id}>
                      <button type="button" onClick={() => selectPerson(u)} className="w-full text-left px-3 py-2 min-h-[44px] text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100">
                        {u.first_name} {u.last_name}{u.department ? <span className="text-gray-500"> · {u.department}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {person && (
              <div>
                <label htmlFor="counter-for" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Pour le compte de</label>
                <select
                  id="counter-for"
                  value={beneficiary?.id ?? person.id}
                  onChange={e => {
                    const target = users.find(u => u.id === e.target.value) ?? null;
                    setBeneficiary(target && target.id !== person.id ? target : null);
                    setReturns([]);
                  }}
                  className={inputClass}
                >
                  {users.filter(u => canBorrowNow(u) || u.id === person.id).map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name}{u.id === person.id ? ' (lui-même)' : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {person && held.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">En sa possession (cocher pour rendre)</p>
                <ul className="space-y-1">
                  {held.map(c => {
                    const instance = c.instanceId ? equipmentInstances.find(i => i.id === c.instanceId) : undefined;
                    const late = new Date(c.dueDate).getTime() < Date.now();
                    return (
                      <li key={c.id}>
                        <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 min-h-[36px]">
                          <input
                            type="checkbox"
                            checked={returns.includes(c.id)}
                            onChange={() => setReturns(ids => (ids.includes(c.id) ? ids.filter(x => x !== c.id) : [...ids, c.id]))}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="truncate">{itemName(c.equipmentId)}{instance ? ` · ${instance.qrCode}` : ''}</span>
                          <span className={`ml-auto shrink-0 text-xs ${late ? 'text-tone-danger font-semibold' : 'text-gray-500'}`}>
                            {late ? 'en retard' : `→ ${new Date(c.dueDate).toLocaleDateString('fr-CH')}`}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-4">
          <h2 className="font-bold text-gray-900 dark:text-white">Panier ({count})</h2>

          {count === 0 && <p className="text-sm text-gray-600 dark:text-gray-400">Rien pour l'instant. Scanne les articles.</p>}

          {returns.length > 0 && (
            <ul className="space-y-1">
              {returns.map(id => {
                const c = held.find(x => x.id === id);
                const check = checkOf(id);
                return (
                  <li key={id} className="rounded-md bg-info-50 dark:bg-info-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 space-y-2">
                    <div className="flex items-center gap-2">
                      <Undo2 size={16} aria-hidden="true" className="text-info-600 dark:text-info-100" />
                      <span className="flex-1 truncate">
                        Retour · {c ? itemName(c.equipmentId) : 'Article'}
                        {c?.kitId && <span className="ml-1 inline-flex items-center gap-1 text-xs text-primary-700 dark:text-primary-300"><Briefcase size={12} aria-hidden="true" />{kitName(c.kitId)}</span>}
                      </span>
                      <Button size="sm" variant="outline" icon={<X size={14} />} ariaLabel="Retirer du panier" onClick={() => setReturns(ids => ids.filter(x => x !== id))} />
                    </div>
                    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="État au retour">
                      {CONDITIONS.map(cond => (
                        <button
                          key={cond.id}
                          type="button"
                          role="radio"
                          aria-checked={check.condition === cond.id}
                          onClick={() => setCheck(id, { condition: cond.id })}
                          className={`rounded-full px-3 py-1 min-h-[32px] text-xs font-semibold ${check.condition === cond.id ? cond.className : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'}`}
                        >
                          {cond.label}
                        </button>
                      ))}
                    </div>
                    {check.condition !== 'ok' && (
                      <div className="space-y-2">
                        <input
                          value={check.notes}
                          onChange={e => setCheck(id, { notes: e.target.value })}
                          placeholder={check.condition === 'incomplete' ? 'Ce qui manque…' : 'Ce qui ne va pas…'}
                          aria-label="Remarque sur l'état"
                          className={inputClass}
                        />
                        {online && <PhotoInput folder="retours" value={check.photos} onChange={photos => setCheck(id, { photos })} />}
                        {(check.condition === 'to_repair' || check.condition === 'broken') && (
                          <p className="text-xs text-tone-danger">L'outil passera en maintenance{check.condition === 'broken' ? ' et un incident sera ouvert' : ''}.</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {cart.length > 0 && (
            <ul className="space-y-1">
              {cart.map(line => (
                <li key={line.key} className="flex items-center gap-2 rounded-md bg-success-50 dark:bg-success-900/30 px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                  <span className="flex-1 min-w-0 truncate">
                    Sortie · {line.equipment.name}
                    {line.instance ? <span className="font-mono text-xs"> · {line.instance.qrCode}</span> : null}
                    {line.kitId && <span className="ml-1 inline-flex items-center gap-1 text-xs text-primary-700 dark:text-primary-300"><Briefcase size={12} aria-hidden="true" />{kitName(line.kitId)}</span>}
                  </span>
                  {!line.instance && (
                    <span className="inline-flex items-center gap-1">
                      <Button size="sm" variant="outline" icon={<Minus size={14} />} ariaLabel="Un de moins" onClick={() => setCart(ls => ls.map(l => (l.key === line.key ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l)))} />
                      <span className="w-8 text-center font-mono">{line.quantity}</span>
                      <Button size="sm" variant="outline" icon={<Plus size={14} />} ariaLabel="Un de plus" onClick={() => setCart(ls => ls.map(l => (l.key === line.key ? { ...l, quantity: l.quantity + 1 } : l)))} />
                    </span>
                  )}
                  {line.equipment.itemType === 'consumable' && <span className="text-xs text-gray-600 dark:text-gray-400">{line.equipment.unit}</span>}
                  <Button size="sm" variant="outline" icon={<Trash2 size={14} />} ariaLabel={`Retirer ${line.equipment.name}`} onClick={() => setCart(ls => ls.filter(l => l.key !== line.key))} />
                </li>
              ))}
            </ul>
          )}

          {cart.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {toolLines.length > 0 && (
                <div className="sm:col-span-2">
                  <label htmlFor="counter-due" className={labelClass}>Retour prévu</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Button size="sm" variant="outline" onClick={() => setDue(toLocalInput(at17(0)))}>Ce soir</Button>
                    <Button size="sm" variant="outline" onClick={() => setDue(toLocalInput(at17(1)))}>Demain</Button>
                    <Button size="sm" variant="outline" onClick={() => setDue(toLocalInput(endOfWeek()))}>Vendredi</Button>
                    <Button size="sm" variant="outline" onClick={() => setDue(toLocalInput(at17(7)))}>+ 1 semaine</Button>
                  </div>
                  <DateTimeInput id="counter-due" value={due} onChange={e => setDue(e.target.value)} className={inputClass} />
                </div>
              )}
              <div>
                <label htmlFor="counter-dest" className={labelClass}>Chantier ou service</label>
                <input id="counter-dest" list="counter-dest-sites" autoComplete="off" value={destination} onChange={e => setDestination(e.target.value)} className={inputClass} placeholder="ex. Chantier Renens" />
            <datalist id="counter-dest-sites">{sites.map(site => <option key={site.name} value={site.name} label={site.registered ? 'Chantier' : 'Sans fiche chantier'} />)}</datalist>
            <SiteNotice value={destination} />
              </div>
              {consumableLines.length > 0 && (
                <div>
                  <label htmlFor="counter-depot" className={labelClass}>Dépôt des consommables</label>
                  <select id="counter-depot" value={depotId} onChange={e => setDepotId(e.target.value)} className={inputClass}>
                    {myDepots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            {count > 0 && <Button variant="secondary" onClick={reset} disabled={busy}>Vider</Button>}
            <Button icon={<CheckCircle2 size={16} />} onClick={() => validate()} loading={busy} disabled={!person || count === 0}>
              Valider
            </Button>
          </div>
        </div>
      </div>

      <Modal isOpen={signing} onClose={() => setSigning(false)} title="Signature à la remise">
        <div className="space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {person ? `${person.first_name} ${person.last_name}` : 'La personne'} reçoit du matériel de valeur et signe pour en accuser réception :
          </p>
          <ul className="text-sm text-gray-900 dark:text-gray-100 list-disc pl-5">
            {toolLines.filter(l => needsSignature(l.equipment)).map(l => (
              <li key={l.key}>{l.quantity > 1 ? `${l.quantity} × ` : ''}{l.equipment.name}{l.instance ? ` · ${l.instance.qrCode}` : ''}</li>
            ))}
          </ul>
          {signing && <SignaturePad label="Signature" onChange={setSignatureDraft} />}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSigning(false)}>Annuler</Button>
            <Button icon={<CheckCircle2 size={16} />} disabled={!signatureDraft} onClick={() => validate(signatureDraft ?? undefined)}>Valider la remise</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Counter;
