import React, { useEffect, useMemo, useState } from 'react';
import { HardHat, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import SignaturePad from '../components/common/SignaturePad';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/requests';
import { confirmAction } from '../lib/confirm';
import PageTitle from '../components/common/PageTitle';

interface PpeType {
  id: string;
  name: string;
  sizes: string[];
  renewal_months: number | null;
  returnable: boolean;
  equipment_id: string | null;
}

interface PpeIssue {
  id: string;
  user_id: string;
  ppe_type_id: string;
  size: string | null;
  quantity: number;
  issued_on: string;
  renew_on: string | null;
  returned_on: string | null;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const DAY = 24 * 60 * 60 * 1000;
const fmt = (d: string) => new Date(d).toLocaleDateString('fr-CH');
const EMPTY_TYPE = { name: '', sizes: '', renewal_months: '', returnable: false, equipment_id: '' };

// EPI : remise par personne avec taille et signature, et renouvellements à venir
const Ppe: React.FC = () => {
  const { users, equipment, depots, refreshData } = useApp();
  const { profile, can } = useAuth();
  const canManageTypes = can('manage_people') || can('manage_stock');
  const canIssue = can('scan') || can('manage_people');
  const [types, setTypes] = useState<PpeType[]>([]);
  const [issues, setIssues] = useState<PpeIssue[]>([]);
  const [sizes, setSizes] = useState<{ user_id: string; ppe_type_id: string; size: string }[]>([]);
  const [editingType, setEditingType] = useState<PpeType | 'new' | null>(null);
  const [typeForm, setTypeForm] = useState(EMPTY_TYPE);
  const [issue, setIssue] = useState({ user_id: '', ppe_type_id: '', size: '', quantity: '1', depot_id: '', notes: '' });
  const [signature, setSignature] = useState<string | null>(null);
  const [padKey, setPadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [person, setPerson] = useState('');

  const load = async () => {
    const [t, i, s] = await Promise.all([
      supabase.from('ppe_types').select('*').order('name'),
      supabase.from('ppe_issues').select('id, user_id, ppe_type_id, size, quantity, issued_on, renew_on, returned_on').order('issued_on', { ascending: false }),
      supabase.from('user_ppe_sizes').select('*'),
    ]);
    if (t.error) toast.error(errorMessage(t.error));
    setTypes((t.data || []) as PpeType[]);
    setIssues((i.data || []) as PpeIssue[]);
    setSizes(s.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const myDepot = profile?.depot_ids?.[0] ?? depots.find(d => d.isDefault)?.id ?? '';
    setIssue(f => (f.depot_id ? f : { ...f, depot_id: myDepot }));
  }, [depots, profile]);

  const userName = (id: string) => {
    const u = users.find(x => x.id === id);
    return u ? `${u.first_name} ${u.last_name}` : 'Personne supprimée';
  };
  const typeOf = (id: string) => types.find(t => t.id === id);
  const selectedType = typeOf(issue.ppe_type_id);

  // Taille connue de la personne pour ce type d'EPI
  useEffect(() => {
    if (!issue.user_id || !issue.ppe_type_id) return;
    const known = sizes.find(s => s.user_id === issue.user_id && s.ppe_type_id === issue.ppe_type_id)?.size;
    setIssue(f => ({ ...f, size: known ?? '' }));
  }, [issue.user_id, issue.ppe_type_id, sizes]);

  // Dernière remise par personne et type : c'est elle qui fixe le prochain renouvellement
  const latest = useMemo(() => {
    const map = new Map<string, PpeIssue>();
    for (const i of issues) {
      const key = `${i.user_id}:${i.ppe_type_id}`;
      if (!map.has(key)) map.set(key, i);
    }
    return [...map.values()];
  }, [issues]);
  const due = latest
    .filter(i => i.renew_on && !i.returned_on && new Date(i.renew_on).getTime() - Date.now() <= 30 * DAY)
    .filter(i => users.find(u => u.id === i.user_id)?.active !== false)
    .sort((a, b) => (a.renew_on ?? '').localeCompare(b.renew_on ?? ''));

  const openType = (t: PpeType | 'new') => {
    setEditingType(t);
    setTypeForm(t === 'new' ? EMPTY_TYPE : {
      name: t.name, sizes: t.sizes.join(', '), renewal_months: t.renewal_months === null ? '' : String(t.renewal_months),
      returnable: t.returnable, equipment_id: t.equipment_id ?? '',
    });
  };

  const saveType = async (event: React.FormEvent) => {
    event.preventDefault();
    const row = {
      name: typeForm.name.trim(),
      sizes: typeForm.sizes.split(/[,;]/).map(s => s.trim()).filter(Boolean),
      renewal_months: typeForm.renewal_months === '' ? null : Number(typeForm.renewal_months),
      returnable: typeForm.returnable,
      equipment_id: typeForm.equipment_id || null,
    };
    const { error } = editingType === 'new'
      ? await supabase.from('ppe_types').insert(row)
      : await supabase.from('ppe_types').update(row).eq('id', (editingType as PpeType).id);
    if (error) return toast.error(error.code === '23505' ? 'Ce type d\'EPI existe déjà' : errorMessage(error));
    setEditingType(null);
    await load();
  };

  const removeType = async (t: PpeType) => {
    if (!await confirmAction(`Supprimer « ${t.name} » et tout son historique de remises ?`)) return;
    const { error } = await supabase.from('ppe_types').delete().eq('id', t.id);
    if (error) return toast.error(errorMessage(error));
    await load();
  };

  const give = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedType?.sizes.length && !issue.size) return toast.error('Choisis la taille');
    setBusy(true);
    const { error } = await supabase.rpc('issue_ppe', {
      p_user_id: issue.user_id,
      p_ppe_type_id: issue.ppe_type_id,
      p_size: issue.size || null,
      p_quantity: Number(issue.quantity) || 1,
      p_depot_id: selectedType?.equipment_id ? issue.depot_id || null : null,
      p_signature: signature,
      p_notes: issue.notes.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(`${selectedType?.name} remis à ${userName(issue.user_id)}`);
    setIssue(f => ({ ...f, ppe_type_id: '', size: '', quantity: '1', notes: '' }));
    setSignature(null);
    setPadKey(k => k + 1);
    await Promise.all([load(), selectedType?.equipment_id ? refreshData() : Promise.resolve()]);
  };

  const renew = (i: PpeIssue) => {
    setIssue(f => ({ ...f, user_id: i.user_id, ppe_type_id: i.ppe_type_id }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const personIssues = person ? issues.filter(i => i.user_id === person) : [];
  const consumables = equipment.filter(e => e.itemType === 'consumable');

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>EPI</PageTitle>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Équipements de protection remis à chacun : taille, signature, et rappel avant le renouvellement.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {canIssue && (
          <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-3">
            <h2 className="font-bold text-gray-900 dark:text-white">Remettre un EPI</h2>
            {types.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Crée d'abord les types d'EPI (à droite).</p> : (
              <form onSubmit={give} className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="ppe-user" className={labelClass}>Personne</label>
                  <select id="ppe-user" value={issue.user_id} onChange={e => setIssue({ ...issue, user_id: e.target.value })} className={inputClass} required>
                    <option value="">Choisir…</option>
                    {users.filter(u => u.active !== false).map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ppe-type" className={labelClass}>EPI</label>
                  <select id="ppe-type" value={issue.ppe_type_id} onChange={e => setIssue({ ...issue, ppe_type_id: e.target.value })} className={inputClass} required>
                    <option value="">Choisir…</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                {selectedType && selectedType.sizes.length > 0 && (
                  <div>
                    <label htmlFor="ppe-size" className={labelClass}>Taille</label>
                    <select id="ppe-size" value={issue.size} onChange={e => setIssue({ ...issue, size: e.target.value })} className={inputClass} required>
                      <option value="">Choisir…</option>
                      {selectedType.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor="ppe-qty" className={labelClass}>Quantité</label>
                  <input id="ppe-qty" type="number" min={1} value={issue.quantity} onChange={e => setIssue({ ...issue, quantity: e.target.value })} className={`${inputClass} font-mono`} />
                </div>
                {selectedType?.equipment_id && (
                  <div>
                    <label htmlFor="ppe-depot" className={labelClass}>Pris dans le stock de</label>
                    <select id="ppe-depot" value={issue.depot_id} onChange={e => setIssue({ ...issue, depot_id: e.target.value })} className={inputClass}>
                      {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label htmlFor="ppe-notes" className={labelClass}>Remarque</label>
                  <input id="ppe-notes" value={issue.notes} onChange={e => setIssue({ ...issue, notes: e.target.value })} className={inputClass} />
                </div>
                {issue.user_id && (
                  <div className="sm:col-span-2">
                    <SignaturePad key={padKey} label={`Signature de ${userName(issue.user_id)} (facultatif)`} onChange={setSignature} />
                  </div>
                )}
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" icon={<HardHat size={16} />} loading={busy}>Remettre</Button>
                </div>
              </form>
            )}
          </section>
        )}

        <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-3 self-start">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-gray-900 dark:text-white">Types d'EPI</h2>
            {canManageTypes && <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => openType('new')}>Ajouter</Button>}
          </div>
          {types.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-400">Exemples : casque (renouvelé tous les 4 ans), chaussures S3 (tailles 38 à 47, 1 an), harnais (à rendre au départ).</p>}
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            {types.map(t => (
              <li key={t.id} className="py-2 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{t.name}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {[t.sizes.length ? `tailles ${t.sizes.join(', ')}` : 'taille unique', t.renewal_months ? `renouvelé tous les ${t.renewal_months} mois` : 'sans échéance',
                      t.returnable ? 'à rendre au départ' : '', t.equipment_id ? `stock : ${equipment.find(e => e.id === t.equipment_id)?.name ?? ''}` : ''].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {canManageTypes && (
                  <>
                    <Button size="sm" variant="outline" icon={<Pencil size={14} />} ariaLabel={`Modifier ${t.name}`} onClick={() => openType(t)} />
                    <Button size="sm" variant="outline" icon={<Trash2 size={14} />} ariaLabel={`Supprimer ${t.name}`} onClick={() => removeType(t)} />
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-2">
        <h2 className="font-bold text-gray-900 dark:text-white">À renouveler dans les 30 jours ({due.length})</h2>
        {due.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Rien à renouveler.</p> : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            {due.map(i => {
              const late = new Date(i.renew_on!).getTime() < Date.now();
              return (
                <li key={i.id} className="py-2 flex flex-wrap items-center gap-2">
                  <span className="flex-1 min-w-[12rem] text-gray-900 dark:text-gray-100">{userName(i.user_id)} · {typeOf(i.ppe_type_id)?.name}{i.size ? ` · ${i.size}` : ''}</span>
                  <span className={`text-xs font-semibold ${late ? 'text-tone-danger' : 'text-tone-warning'}`}>{late ? 'échu le' : 'le'} {fmt(i.renew_on!)}</span>
                  {canIssue && <Button size="sm" variant="outline" onClick={() => renew(i)}>Renouveler</Button>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-bold text-gray-900 dark:text-white flex-1">Dotation d'une personne</h2>
          <select value={person} onChange={e => setPerson(e.target.value)} aria-label="Personne" className={`${inputClass} w-auto`}>
            <option value="">Choisir…</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
          </select>
        </div>
        {person && (personIssues.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Aucun EPI remis.</p> : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            {personIssues.map(i => (
              <li key={i.id} className="py-1.5 flex flex-wrap justify-between gap-2 text-gray-800 dark:text-gray-200">
                <span>{i.quantity > 1 ? `${i.quantity} × ` : ''}{typeOf(i.ppe_type_id)?.name}{i.size ? ` · ${i.size}` : ''}</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  remis le {fmt(i.issued_on)}{i.renew_on ? ` · à renouveler le ${fmt(i.renew_on)}` : ''}{i.returned_on ? ` · rendu le ${fmt(i.returned_on)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ))}
      </section>

      <Modal isOpen={editingType !== null} onClose={() => setEditingType(null)} title={editingType === 'new' ? 'Nouveau type d\'EPI' : 'Modifier le type d\'EPI'}>
        <form onSubmit={saveType} className="space-y-3">
          <div>
            <label htmlFor="ppe-type-name" className={labelClass}>Nom</label>
            <input id="ppe-type-name" value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })} className={inputClass} required placeholder="ex. Chaussures de sécurité S3" />
          </div>
          <div>
            <label htmlFor="ppe-type-sizes" className={labelClass}>Tailles (séparées par des virgules)</label>
            <input id="ppe-type-sizes" value={typeForm.sizes} onChange={e => setTypeForm({ ...typeForm, sizes: e.target.value })} className={inputClass} placeholder="ex. 39, 40, 41, 42, 43, 44, 45 ou S, M, L, XL" />
          </div>
          <div>
            <label htmlFor="ppe-type-months" className={labelClass}>Renouvellement (mois)</label>
            <input id="ppe-type-months" type="number" min={1} value={typeForm.renewal_months} onChange={e => setTypeForm({ ...typeForm, renewal_months: e.target.value })} className={`${inputClass} font-mono`} placeholder="vide = sans échéance" />
          </div>
          <div>
            <label htmlFor="ppe-type-article" className={labelClass}>Décompter du stock (facultatif)</label>
            <select id="ppe-type-article" value={typeForm.equipment_id} onChange={e => setTypeForm({ ...typeForm, equipment_id: e.target.value })} className={inputClass}>
              <option value="">Non suivi en stock</option>
              {consumables.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
            <input type="checkbox" checked={typeForm.returnable} onChange={e => setTypeForm({ ...typeForm, returnable: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
            À rendre au départ de la personne (harnais, appareil respiratoire…)
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditingType(null)}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Ppe;
