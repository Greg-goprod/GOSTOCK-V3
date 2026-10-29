import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Minus, Plus, Trash2, Undo2, UserRound, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import QRCodeScanner from '../components/QRCode/QRCodeScanner';
import PhotoInput from '../components/common/PhotoInput';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useSiteSuggestions } from '../lib/sites';
import { findEquipmentByCode } from '../lib/scan';
import { isBadgeCode } from '../lib/badges';
import { errorMessage, toLocalInput } from '../lib/requests';
import { Equipment, EquipmentInstance, User } from '../types';

type Mode = 'auto' | 'out' | 'in';

type Condition = 'ok' | 'dirty' | 'incomplete' | 'to_repair' | 'broken';
interface ReturnCheck {
  condition: Condition;
  notes: string;
  photos: string[];
}
const CONDITIONS: { id: Condition; label: string; className: string }[] = [
  { id: 'ok', label: 'OK', className: 'bg-success-600 text-white' },
  { id: 'dirty', label: 'Sale', className: 'bg-warning-500 text-white' },
  { id: 'incomplete', label: 'Incomplet', className: 'bg-warning-600 text-white' },
  { id: 'to_repair', label: 'À réparer', className: 'bg-danger-500 text-white' },
  { id: 'broken', label: 'Cassé', className: 'bg-danger-700 text-white' },
];
const DEFAULT_CHECK: ReturnCheck = { condition: 'ok', notes: '', photos: [] };

interface CartLine {
  key: string;
  equipment: Equipment;
  instance?: EquipmentInstance;
  quantity: number;
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
  const { users, equipment, equipmentInstances, checkouts, depots, refreshData } = useApp();
  const { profile } = useAuth();
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

  const held = useMemo(
    () => (owner ? checkouts.filter(c => c.userId === owner.id && (c.status === 'active' || c.status === 'overdue')) : []),
    [checkouts, owner]
  );
  const itemName = (id: string) => equipment.find(e => e.id === id)?.name ?? 'Article';

  const reset = () => {
    setCart([]);
    setReturns([]);
    setChecks({});
    setDestination('');
  };

  const selectPerson = (user: User) => {
    if (person && person.id !== user.id && (cart.length || returns.length)) {
      if (!window.confirm(`Passer à ${user.first_name} ${user.last_name} ? Le panier en cours sera vidé.`)) return;
    }
    if (person?.id !== user.id) {
      reset();
      setBeneficiary(null);
    }
    setPerson(user);
    setPickerOpen(false);
  };

  const addToCart = (item: Equipment, instance?: EquipmentInstance) => {
    setCart(lines => {
      if (instance) {
        if (lines.some(l => l.instance?.id === instance.id)) {
          toast(`${instance.qrCode} est déjà dans le panier`);
          return lines;
        }
        return [...lines, { key: instance.id, equipment: item, instance, quantity: 1 }];
      }
      const existing = lines.find(l => l.key === item.id);
      if (existing) return lines.map(l => (l.key === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...lines, { key: item.id, equipment: item, quantity: 1 }];
    });
  };

  // Un emprunt en cours de cette personne pour cet article (et cet exemplaire), pas encore coché
  const heldMatch = (item: Equipment, instance?: EquipmentInstance) =>
    held.find(c => c.equipmentId === item.id && (!instance || c.instanceId === instance.id) && !returns.includes(c.id));

  const onScan = async (text: string) => {
    if (isBadgeCode(text)) {
      const { data, error } = await supabase.rpc('find_user_by_badge', { p_code: text });
      if (error) throw new Error(errorMessage(error));
      const user = users.find(u => u.id === data);
      if (!user) throw new Error('Badge inconnu ou accès suspendu');
      selectPerson(user);
      toast.success(`${user.first_name} ${user.last_name}`);
      return;
    }

    if (!person) {
      toast.error("Scannez d'abord le badge de la personne");
      throw new Error('Aucune personne');
    }

    const found = await findEquipmentByCode(text);
    if (!found) {
      toast.error(`Code inconnu : ${text}`);
      throw new Error('Code inconnu');
    }
    const item = equipment.find(e => e.id === found.equipment.id);
    if (!item) throw new Error('Article introuvable');
    const instance = found.instance ? equipmentInstances.find(i => i.id === found.instance!.id) : undefined;

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
    addToCart(item, instance);
    toast.success(`Sortie : ${item.name}`);
  };

  const toolLines = cart.filter(l => l.equipment.itemType !== 'consumable');
  const consumableLines = cart.filter(l => l.equipment.itemType === 'consumable');

  const validate = async () => {
    if (!person) return;
    setBusy(true);
    const done: string[] = [];
    try {
      const damaged = returns.filter(id => ['to_repair', 'broken'].includes(checkOf(id).condition)).length;
      for (const id of returns) {
        const check = checkOf(id);
        if (check.condition !== 'ok' && check.condition !== 'dirty' && !check.notes.trim() && !check.photos.length) {
          throw new Error('Décrivez le problème (remarque ou photo) pour chaque retour non conforme');
        }
        const { error } = await supabase.rpc('return_with_check', {
          p_checkout_id: id,
          p_condition: check.condition,
          p_notes: check.notes.trim() || null,
          p_photos: check.photos,
        });
        if (error) throw error;
      }
      if (returns.length) done.push(`${returns.length} retour${returns.length > 1 ? 's' : ''}${damaged ? ` (dont ${damaged} en maintenance)` : ''}`);

      let noteId: string | null = null;
      if (toolLines.length) {
        const { data, error } = await supabase.rpc('create_checkout', {
          p_user_id: owner!.id,
          p_due_date: new Date(due).toISOString(),
          p_items: toolLines.map(l => (l.instance
            ? { equipment_id: l.equipment.id, instance_id: l.instance.id }
            : { equipment_id: l.equipment.id, quantity: l.quantity })),
          p_notes: [destination.trim(), beneficiary ? `retiré par ${person.first_name} ${person.last_name}` : ''].filter(Boolean).join(' · ') || null,
        });
        if (error) throw error;
        noteId = data?.id ?? null;
        done.push(`bon ${data?.note_number ?? ''}`.trim());
      }

      for (const line of consumableLines) {
        const { error } = await supabase.rpc('consume_stock', {
          p_equipment_id: line.equipment.id,
          p_depot_id: depotId,
          p_quantity: line.quantity,
          p_user_id: owner!.id,
          p_destination: destination.trim() || null,
          p_notes: beneficiary ? `Sortie au comptoir, retirée par ${person.first_name} ${person.last_name}` : 'Sortie au comptoir',
          p_delivery_note_id: noteId,
        });
        if (error) throw error;
      }
      if (consumableLines.length) done.push(`${consumableLines.length} consommable${consumableLines.length > 1 ? 's' : ''}`);

      toast.success(`${owner!.first_name} ${owner!.last_name} : ${done.join(', ')}`);
      reset();
      setPerson(null);
      setBeneficiary(null);
    } catch (error) {
      toast.error(`${done.length ? `Fait : ${done.join(', ')}. ` : ''}Arrêt : ${errorMessage(error)}`);
    } finally {
      setBusy(false);
      await refreshData();
    }
  };

  const filteredUsers = users
    .filter(u => u.active !== false)
    .filter(u => `${u.first_name} ${u.last_name} ${u.department ?? ''}`.toLowerCase().includes(pickerSearch.toLowerCase()))
    .slice(0, 30);

  const count = returns.length + cart.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white tracking-tight uppercase">Comptoir</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Badge de la personne, puis les articles. Un article qu'elle a déjà part en retour.</p>
        </div>
        <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden" role="group" aria-label="Mode de scan">
          {([['auto', 'Auto'], ['out', 'Sortie'], ['in', 'Retour']] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`px-3 py-2 min-h-[44px] text-sm font-semibold ${mode === m ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

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
                <p className="text-sm">Scannez le badge (carte ou téléphone), ou <button type="button" className="text-primary-700 dark:text-primary-300 underline" onClick={() => setPickerOpen(o => !o)}>choisissez la personne</button>.</p>
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
                  {users.filter(u => u.active !== false).map(u => (
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
                          <span className={`ml-auto shrink-0 text-xs ${late ? 'text-danger-700 dark:text-danger-300 font-semibold' : 'text-gray-500'}`}>
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

          {count === 0 && <p className="text-sm text-gray-600 dark:text-gray-400">Rien pour l'instant. Scannez les articles.</p>}

          {returns.length > 0 && (
            <ul className="space-y-1">
              {returns.map(id => {
                const c = held.find(x => x.id === id);
                const check = checkOf(id);
                return (
                  <li key={id} className="rounded-md bg-info-50 dark:bg-info-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 space-y-2">
                    <div className="flex items-center gap-2">
                      <Undo2 size={16} aria-hidden="true" className="text-info-600 dark:text-info-100" />
                      <span className="flex-1 truncate">Retour · {c ? itemName(c.equipmentId) : 'Article'}</span>
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
                        <PhotoInput folder="retours" value={check.photos} onChange={photos => setCheck(id, { photos })} />
                        {(check.condition === 'to_repair' || check.condition === 'broken') && (
                          <p className="text-xs text-danger-700 dark:text-danger-300">L'outil passera en maintenance{check.condition === 'broken' ? ' et un incident sera ouvert' : ''}.</p>
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
                  <input id="counter-due" type="datetime-local" value={due} onChange={e => setDue(e.target.value)} className={inputClass} />
                </div>
              )}
              <div>
                <label htmlFor="counter-dest" className={labelClass}>Chantier ou service</label>
                <input id="counter-dest" list="counter-dest-sites" autoComplete="off" value={destination} onChange={e => setDestination(e.target.value)} className={inputClass} placeholder="ex. Chantier Renens" />
            <datalist id="counter-dest-sites">{sites.map(site => <option key={site} value={site} />)}</datalist>
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
            <Button icon={<CheckCircle2 size={16} />} onClick={validate} loading={busy} disabled={!person || count === 0}>
              Valider
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Counter;
