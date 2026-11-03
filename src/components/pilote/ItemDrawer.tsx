import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { confirmAction } from '../../lib/confirm';
import { addLink, allowedKinds, descendantsOf, ITEM_KIND_LABEL, LINK_MODE_LABEL, parentKindsFor, piloteError, removeLink, PRIORITY_LABEL, saveItemMembers, type GanttData, type ItemKind, type ProjectPriority } from '../../lib/pilote';
import Button from '../common/Button';
import Modal from '../common/Modal';
import DateInput, { DateRangeInput } from '../common/DateInput';

export type ItemTarget = { mode: 'edit'; itemId: string } | { mode: 'new'; projectId?: string; parentId?: string | null; kind?: ItemKind };

interface Props {
  data: GanttData;
  target: ItemTarget | null;
  canUpdate: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

interface CheckLine { id?: string; label: string; done: boolean }
interface FormState {
  projectId: string; kind: ItemKind; parentId: string; name: string; status_id: string; priority: '' | ProjectPriority;
  starts_on: string; ends_on: string; description: string; members: string[];
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-70';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// Fiche d'un élément : création, modification, suppression ; responsables (plusieurs) et liste à cocher
const ItemDrawer: React.FC<Props> = ({ data, target, canUpdate, canCreate, canDelete, onClose, onSaved }) => {
  const { users } = useApp();
  const [form, setForm] = useState<FormState | null>(null);
  const [checks, setChecks] = useState<CheckLine[]>([]);
  const [initialChecks, setInitialChecks] = useState<CheckLine[]>([]);
  const [newCheck, setNewCheck] = useState('');
  const [saving, setSaving] = useState(false);
  const [newPred, setNewPred] = useState('');
  const datesTouched = useRef(false);
  const people = useMemo(() => users.filter(u => u.active !== false).sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'fr')), [users]);
  const edited = target?.mode === 'edit' ? data.items.find(i => i.id === target.itemId) ?? null : null;
  const isNew = target?.mode === 'new';
  const readOnly = !!edited && !canUpdate;

  useEffect(() => {
    if (!target) { setForm(null); setChecks([]); setInitialChecks([]); setNewCheck(''); return; }
    const notStarted = data.statuses.find(s => s.is_system && s.family === 'not_started')?.id ?? data.statuses[0]?.id ?? '';
    setNewCheck('');
    setNewPred('');
    datesTouched.current = false;
    if (target.mode === 'edit') {
      const it = data.items.find(i => i.id === target.itemId);
      if (!it) return;
      setForm({
        projectId: it.project_id, kind: it.kind, parentId: it.parent_id ?? '', name: it.name, status_id: it.status_id, priority: it.priority ?? '',
        starts_on: it.starts_on ?? '', ends_on: it.ends_on ?? '', description: it.description ?? '',
        members: data.itemMembers.filter(m => m.item_id === it.id).map(m => m.user_id),
      });
      setChecks([]); setInitialChecks([]);
      void supabase.from('cp_item_checks').select('id, label, done, position').eq('item_id', it.id).order('position').order('created_at').then(({ data: rows, error }) => {
        if (error) return void toast.error(piloteError(error));
        const lines = (rows || []).map(r => ({ id: r.id as string, label: r.label as string, done: Boolean(r.done) }));
        setChecks(lines); setInitialChecks(lines);
      });
    } else {
      const parent = target.parentId ? data.items.find(i => i.id === target.parentId) ?? null : null;
      const kinds = allowedKinds(parent?.kind ?? null);
      const projectId = target.projectId ?? parent?.project_id ?? data.projects[0]?.id ?? '';
      setForm({
        projectId, kind: target.kind && kinds.includes(target.kind) ? target.kind : kinds[0] ?? 'task', parentId: target.parentId ?? '', name: '', status_id: notStarted,
        priority: '', starts_on: '', ends_on: '', description: '', members: [],
      });
      setChecks([]); setInitialChecks([]);
    }
    // Le formulaire repart de zéro à chaque ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const set = (patch: Partial<FormState>) => setForm(f => (f ? { ...f, ...patch } : f));

  // Parents possibles selon le type choisi (migration 49) : aucun (sous le projet), une phase ou une tâche du même projet
  const parentOptions = useMemo(() => {
    if (!form) return [] as { id: string; label: string }[];
    const kinds = parentKindsFor(form.kind);
    return data.items.filter(i => i.project_id === form.projectId && kinds.includes(i.kind) && i.id !== edited?.id)
      .map(i => ({ id: i.id, label: `${ITEM_KIND_LABEL[i.kind]} · ${i.name}` }));
  }, [data.items, form, edited]);
  const needsParent = form?.kind === 'subtask';
  const projectKinds = useMemo<ItemKind[]>(() => allowedKinds(null).concat('subtask'), []);

  // Types proposés : en création sous un parent fixé, seuls ceux que ce parent accepte ; sinon tous (le parent s'adapte)
  const presetParent = target?.mode === 'new' && target.parentId ? data.items.find(i => i.id === target.parentId) ?? null : null;
  const kindChoices: ItemKind[] = presetParent ? allowedKinds(presetParent.kind) : projectKinds;

  const changeKind = (kind: ItemKind) => {
    if (!form) return;
    const valid = data.items.some(i => i.id === form.parentId && parentKindsFor(kind).includes(i.kind));
    set({ kind, parentId: valid ? form.parentId : '', ...(kind === 'milestone' ? { ends_on: form.starts_on || form.ends_on, starts_on: form.starts_on || form.ends_on } : {}) });
  };

  // Une dépendance ajoutée ou retirée peut décaler CET élément (s'il est le successeur) : les dates affichées suivent, tant qu'on ne les a pas modifiées soi-même
  useEffect(() => {
    if (!edited || !form || datesTouched.current) return;
    if ((edited.starts_on ?? '') !== form.starts_on || (edited.ends_on ?? '') !== form.ends_on) set({ starts_on: edited.starts_on ?? '', ends_on: edited.ends_on ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edited?.starts_on, edited?.ends_on]);

  const projectOfItem = edited ? data.projects.find(p => p.id === edited.project_id) ?? null : null;
  const predLinks = edited ? data.links.filter(l => l.successor_id === edited.id) : [];
  const succLinks = edited ? data.links.filter(l => l.predecessor_id === edited.id) : [];
  const itemName = (id: string) => data.items.find(i => i.id === id)?.name ?? '—';
  // Éléments proposables comme prédécesseur : du même projet, ni lui-même, ni déjà lié ; la base refuse parenté et boucles avec un message clair
  const predOptions = useMemo(() => {
    if (!edited) return [] as { id: string; label: string }[];
    const taken = new Set(predLinks.map(l => l.predecessor_id));
    // Ni ses parents ni ce qu'il contient (la base les refuse de toute façon)
    const related = new Set<string>();
    for (let up = data.items.find(i => i.id === edited.parent_id); up; up = data.items.find(i => i.id === up!.parent_id)) related.add(up.id);
    const below = (id: string) => { for (const c of data.items.filter(i => i.parent_id === id)) { related.add(c.id); below(c.id); } };
    below(edited.id);
    return data.items.filter(i => i.project_id === edited.project_id && i.id !== edited.id && !taken.has(i.id) && !related.has(i.id))
      .map(i => ({ id: i.id, label: `${ITEM_KIND_LABEL[i.kind]} · ${i.name}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.items, data.links, edited]);
  const changeLink = async (action: () => Promise<void>) => {
    try { await action(); await onSaved(); } catch (error) { toast.error(piloteError(error)); }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !form || !target || readOnly) return;
    const milestone = form.kind === 'milestone';
    const start = milestone ? form.starts_on : form.starts_on;
    const end = milestone ? form.starts_on : form.ends_on;
    if (start && end && end < start) return void toast.error('La fin doit être après le début');
    if (needsParent && !form.parentId) return void toast.error('Choisis la tâche de cette sous-tâche');
    const payload = {
      name: form.name.trim(), parent_id: form.parentId || null, status_id: form.status_id, priority: form.priority || null,
      starts_on: start || null, ends_on: end || null, description: form.description.trim() || null,
    };
    setSaving(true);
    try {
      let id = edited?.id ?? '';
      if (target.mode === 'new') {
        const { data: row, error } = await supabase.from('cp_items').insert({ ...payload, project_id: form.projectId, kind: form.kind }).select('id').single();
        if (error) throw error;
        id = row.id as string;
      } else {
        const { error } = await supabase.from('cp_items').update(payload).eq('id', id);
        if (error) throw error;
      }
      await saveItemMembers(id, form.members);
      // Liste à cocher : on applique la différence avec ce qui était enregistré
      const keep = new Set(checks.filter(c => c.id).map(c => c.id));
      const gone = initialChecks.filter(c => c.id && !keep.has(c.id));
      if (gone.length) { const r = await supabase.from('cp_item_checks').delete().in('id', gone.map(c => c.id!)); if (r.error) throw r.error; }
      for (const [position, c] of checks.entries()) {
        if (!c.label.trim()) continue;
        if (!c.id) { const r = await supabase.from('cp_item_checks').insert({ item_id: id, label: c.label.trim(), done: c.done, position }); if (r.error) throw r.error; }
        else {
          const before = initialChecks.find(x => x.id === c.id);
          if (!before || before.label !== c.label || before.done !== c.done) { const r = await supabase.from('cp_item_checks').update({ label: c.label.trim(), done: c.done, position }).eq('id', c.id); if (r.error) throw r.error; }
        }
      }
      toast.success(target.mode === 'new' ? 'Élément créé' : 'Élément modifié');
      onClose();
      await onSaved();
    } catch (error) {
      toast.error(piloteError(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!edited) return;
    const n = descendantsOf(data.items, edited.id);
    const message = n > 0 ? `Supprimer « ${edited.name} » et ses ${n} élément${n > 1 ? 's' : ''} en dessous ?` : `Supprimer « ${edited.name} » ?`;
    if (!(await confirmAction(message))) return;
    const { error } = await supabase.from('cp_items').delete().eq('id', edited.id);
    if (error) return void toast.error(piloteError(error));
    toast.success('Élément supprimé');
    onClose();
    await onSaved();
  };

  const addCheck = () => {
    const label = newCheck.trim();
    if (!label) return;
    setChecks(c => [...c, { label, done: false }]);
    setNewCheck('');
  };

  const title = isNew ? 'Nouvel élément' : readOnly ? (edited?.name ?? 'Élément') : 'Modifier l\'élément';
  const project = form ? data.projects.find(p => p.id === form.projectId) : null;

  return (
    <Modal isOpen={!!target} onClose={onClose} title={title} size="lg">
      {form && (
        <form onSubmit={save} className="space-y-3">
          {isNew && !presetParent && (
            <div>
              <label htmlFor="itm-project" className={labelClass}>Projet</label>
              <select id="itm-project" className={inputClass} value={form.projectId} onChange={e => set({ projectId: e.target.value, parentId: '' })} required>
                {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          {(!isNew || presetParent) && project && <p className="text-sm text-gray-600 dark:text-gray-400">{`Projet : ${project.name}`}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="itm-kind" className={labelClass}>Type</label>
              <select id="itm-kind" className={inputClass} value={form.kind} disabled={!isNew || readOnly} onChange={e => changeKind(e.target.value as ItemKind)}>
                {(isNew ? kindChoices : [form.kind]).map(k => <option key={k} value={k}>{ITEM_KIND_LABEL[k]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="itm-parent" className={labelClass}>Rangé sous</label>
              <select id="itm-parent" className={inputClass} value={form.parentId} disabled={readOnly || (isNew && !!presetParent) || form.kind === 'phase'} required={needsParent} onChange={e => set({ parentId: e.target.value })}>
                {!needsParent && <option value="">Directement sous le projet</option>}
                {needsParent && <option value="">— Choisis une tâche</option>}
                {parentOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="itm-name" className={labelClass}>Nom</label>
            <input id="itm-name" className={inputClass} required value={form.name} disabled={readOnly} onChange={e => set({ name: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="itm-status" className={labelClass}>État</label>
              <select id="itm-status" className={inputClass} value={form.status_id} disabled={readOnly} onChange={e => set({ status_id: e.target.value })}>
                {data.statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="itm-priority" className={labelClass}>Priorité</label>
              <select id="itm-priority" className={inputClass} value={form.priority} disabled={readOnly} onChange={e => set({ priority: e.target.value as FormState['priority'] })}>
                <option value="">—</option>
                {(Object.keys(PRIORITY_LABEL) as ProjectPriority[]).map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </div>
            {form.kind === 'milestone' ? (
              <div className="sm:col-span-2">
                <label htmlFor="itm-start" className={labelClass}>Date du jalon</label>
                <DateInput id="itm-start" className={inputClass} value={form.starts_on} disabled={readOnly} onChange={e => { datesTouched.current = true; set({ starts_on: e.target.value }); }} />
              </div>
            ) : (
              <>
                <div className="sm:col-span-2">
                  <label htmlFor="itm-period" className={labelClass}>Période (début et fin)</label>
                  <DateRangeInput id="itm-period" className={inputClass} start={form.starts_on} end={form.ends_on} disabled={readOnly} onChange={(a, b) => { datesTouched.current = true; set({ starts_on: a, ends_on: b }); }} placeholder="Choisir le début et la fin" />
                </div>
              </>
            )}
          </div>
          <fieldset disabled={readOnly}>
            <legend className={labelClass}>Responsables</legend>
            {people.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Aucune personne active.</p> : (
              <ul className="grid max-h-40 gap-1 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 p-2 sm:grid-cols-2">
                {people.map(u => (
                  <li key={u.id}>
                    <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                      <input type="checkbox" checked={form.members.includes(u.id)} onChange={() => set({ members: form.members.includes(u.id) ? form.members.filter(x => x !== u.id) : [...form.members, u.id] })} />
                      {u.first_name} {u.last_name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          <div>
            <label htmlFor="itm-desc" className={labelClass}>Description</label>
            <textarea id="itm-desc" rows={3} className={inputClass} value={form.description} disabled={readOnly} onChange={e => set({ description: e.target.value })} />
          </div>
          <fieldset disabled={readOnly}>
            <legend className={labelClass}>Liste à cocher</legend>
            <ul className="space-y-1">
              {checks.map((c, i) => (
                <li key={c.id ?? `n${i}`} className="flex items-center gap-2">
                  <input type="checkbox" aria-label={`Fait : ${c.label}`} checked={c.done} onChange={e => setChecks(list => list.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} />
                  <input aria-label={`Ligne ${i + 1}`} className={`${inputClass} ${c.done ? 'line-through text-gray-500' : ''}`} value={c.label} onChange={e => setChecks(list => list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  {!readOnly && <button type="button" aria-label={`Supprimer la ligne ${i + 1}`} onClick={() => setChecks(list => list.filter((_, j) => j !== i))} className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 size={14} aria-hidden /></button>}
                </li>
              ))}
            </ul>
            {!readOnly && (
              <div className="mt-2 flex gap-2">
                <input aria-label="Nouvelle ligne" className={inputClass} placeholder="Ajouter une étape" value={newCheck} onChange={e => setNewCheck(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCheck(); } }} />
                <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={addCheck}>Ajouter</Button>
              </div>
            )}
          </fieldset>
          {edited && (
            <fieldset disabled={!canCreate && !canDelete}>
              <legend className={labelClass}>Dépendances</legend>
              <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
                {projectOfItem && <>Un élément qui « commence après » un autre est décalé automatiquement. Réglage du projet : <span>{LINK_MODE_LABEL[projectOfItem.link_mode ?? 'overlap']}</span>.</>}
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Commence après</p>
              {predLinks.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Aucun élément.</p> : (
                <ul className="space-y-1">
                  {predLinks.map(l => (
                    <li key={l.id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                      <span className="min-w-0 flex-1 truncate">{itemName(l.predecessor_id)}</span>
                      {canDelete && <button type="button" aria-label={`Retirer la dépendance avec ${itemName(l.predecessor_id)}`} onClick={() => void changeLink(() => removeLink(l.id))} className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 size={14} aria-hidden /></button>}
                    </li>
                  ))}
                </ul>
              )}
              {canCreate && (
                <div className="mt-2 flex gap-2">
                  <select aria-label="Commence après l'élément" className={inputClass} value={newPred} onChange={e => setNewPred(e.target.value)}>
                    <option value="">— Choisis un élément</option>
                    {predOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                  <Button variant="outline" size="sm" icon={<Plus size={14} />} disabled={!newPred} onClick={() => void changeLink(async () => { await addLink(newPred, edited.id); setNewPred(''); })}>Ajouter</Button>
                </div>
              )}
              {succLinks.length > 0 && (
                <>
                  <p className="mt-3 text-sm font-medium text-gray-800 dark:text-gray-200">Débloque (commencent après lui)</p>
                  <ul className="space-y-1">
                    {succLinks.map(l => (
                      <li key={l.id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                        <span className="min-w-0 flex-1 truncate">{itemName(l.successor_id)}</span>
                        {canDelete && <button type="button" aria-label={`Retirer la dépendance avec ${itemName(l.successor_id)}`} onClick={() => void changeLink(() => removeLink(l.id))} className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 size={14} aria-hidden /></button>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </fieldset>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div>{edited && canDelete && <Button variant="outline" icon={<Trash2 size={14} />} onClick={() => void remove()}>Supprimer</Button>}</div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>{readOnly ? 'Fermer' : 'Annuler'}</Button>
              {!readOnly && <Button type="submit" loading={saving}>Enregistrer</Button>}
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ItemDrawer;
