import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { confirmAction } from '../../lib/confirm';
import { workingDaysBetween } from '../../lib/holidays';
import { addLink, allowedKinds, descendantsOf, ITEM_KIND_LABEL, LINK_MODE_LABEL, parentKindsFor, piloteError, removeLink, PRIORITY_LABEL, isConflict, saveItemMembers, TEAM_ROLE_LABEL, updateIfUnchanged, type GanttData, type ItemKind, type ProjectPriority } from '../../lib/pilote';
import Button from '../common/Button';
import Modal from '../common/Modal';
import MenuButton from '../common/MenuButton';
import StatusPicker from './StatusPicker';
import DiscussionSection from './DiscussionSection';
import DocumentsSection from './DocumentsSection';
import HistorySection from './HistorySection';
import ResourcesSection from './ResourcesSection';
import ExternalsSection from './ExternalsSection';
import TimeSection from './TimeSection';
import RepeatSection from './RepeatSection';
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
  // Arrivée par un avis de message : la discussion s'ouvre et vient à l'écran
  focus?: 'discussion';
}

interface CheckLine { id?: string; label: string; done: boolean }
interface FormState {
  projectId: string; kind: ItemKind; parentId: string; name: string; status_id: string; priority: '' | ProjectPriority;
  starts_on: string; ends_on: string; description: string; members: string[];
  estimate: string;   // heures estimées (texte saisi ; vide = non estimé)
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-70';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// Fiche d'un élément : création, modification, suppression ; personnes assignées (de l'équipe du projet, plusieurs) et liste à cocher
const ItemDrawer: React.FC<Props> = ({ data, target, canUpdate, canCreate, canDelete, onClose, onSaved, focus }) => {
  const { users } = useApp();
  const [form, setForm] = useState<FormState | null>(null);
  const [checks, setChecks] = useState<CheckLine[]>([]);
  const [initialChecks, setInitialChecks] = useState<CheckLine[]>([]);
  const [newCheck, setNewCheck] = useState('');
  const [saving, setSaving] = useState(false);
  const [newPred, setNewPred] = useState('');
  // « Afficher les détails » : parent, liste à cocher, dépendances (repliés par défaut, comme le panneau de Notion)
  const [showDetails, setShowDetails] = useState(false);
  const detailsAutoOpened = useRef(false);
  const datesTouched = useRef(false);
  // Version de l'élément à l'ouverture de la fiche : on n'enregistre que si personne ne l'a modifié depuis (voir updateIfUnchanged)
  const version = useRef<string | null>(null);
  const estimateInitial = useRef('');
  // Une dépendance ajoutée ou retirée DEPUIS cette fiche modifie l'élément elle-même : au prochain enregistrement, on repart de la version rechargée
  const versionStale = useRef(false);
  const people = useMemo(() => users.filter(u => u.active !== false).sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'fr')), [users]);
  // Seules les personnes de l'équipe du projet peuvent être assignées (règle de la base) ; responsables en premier
  const nonWorking = useMemo(() => new Set((data.calendarDays ?? []).map(d => d.day)), [data.calendarDays]);
  const team = useMemo(() => {
    const roleOf = new Map(data.members.filter(m => m.project_id === form?.projectId).map(m => [m.user_id, m.role]));
    return people.filter(u => roleOf.has(u.id)).map(u => ({ ...u, role: roleOf.get(u.id) })).sort((a, b) => Number(b.role === 'lead') - Number(a.role === 'lead'));
  }, [people, data.members, form?.projectId]);
  const edited = target?.mode === 'edit' ? data.items.find(i => i.id === target.itemId) ?? null : null;
  const isNew = target?.mode === 'new';
  const readOnly = !!edited && !canUpdate;

  useEffect(() => {
    if (!target) { setForm(null); setChecks([]); setInitialChecks([]); setNewCheck(''); return; }
    const notStarted = data.statuses.find(s => s.is_system && s.family === 'not_started')?.id ?? data.statuses[0]?.id ?? '';
    setNewCheck('');
    setNewPred('');
    setShowDetails(false);
    detailsAutoOpened.current = false;
    datesTouched.current = false;
    versionStale.current = false;
    if (target.mode === 'edit') {
      const it = data.items.find(i => i.id === target.itemId);
      if (!it) return;
      version.current = it.updated_at ?? null;
      setForm({
        projectId: it.project_id, kind: it.kind, parentId: it.parent_id ?? '', name: it.name, status_id: it.status_id, priority: it.priority ?? '',
        starts_on: it.starts_on ?? '', ends_on: it.ends_on ?? '', description: it.description ?? '',
        members: data.itemMembers.filter(m => m.item_id === it.id).map(m => m.user_id),
        estimate: it.estimate_hours === null || it.estimate_hours === undefined ? '' : String(it.estimate_hours),
      });
      estimateInitial.current = it.estimate_hours === null || it.estimate_hours === undefined ? '' : String(it.estimate_hours);
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
        priority: '', starts_on: '', ends_on: '', description: '', members: [], estimate: '',
      });
      estimateInitial.current = '';
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
  // Si l'élément a déjà une liste à cocher ou des dépendances, les détails s'ouvrent d'eux-mêmes (une fois par ouverture de fiche)
  useEffect(() => {
    if (detailsAutoOpened.current || !edited) return;
    if (checks.length > 0 || predLinks.length > 0 || succLinks.length > 0) { detailsAutoOpened.current = true; setShowDetails(true); }
  }, [edited, checks.length, predLinks.length, succLinks.length]);
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
    versionStale.current = true;
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
    // L'estimation n'est envoyée que si elle a changé : tant que la mise à jour de la base qui l'ajoute n'est pas appliquée, le reste de la fiche s'enregistre normalement
    const estimateText = form.estimate.trim().replace(',', '.');
    const estimate = estimateText === '' ? null : Number(estimateText);
    if (estimate !== null && (!Number.isFinite(estimate) || estimate < 0 || estimate > 9999)) return void toast.error('Estimation : un nombre d\'heures entre 0 et 9 999');
    const payload: Record<string, unknown> = {
      name: form.name.trim(), parent_id: form.parentId || null, status_id: form.status_id, priority: form.priority || null,
      starts_on: start || null, ends_on: end || null, description: form.description.trim() || null,
    };
    if (form.estimate.trim() !== estimateInitial.current.trim()) payload.estimate_hours = estimate === null ? null : Math.round(estimate * 10) / 10;
    setSaving(true);
    try {
      let id = edited?.id ?? '';
      if (target.mode === 'new') {
        const { data: row, error } = await supabase.from('cp_items').insert({ ...payload, project_id: form.projectId, kind: form.kind }).select('id').single();
        if (error) throw error;
        id = row.id as string;
      } else {
        await updateIfUnchanged('cp_items', id, versionStale.current ? edited?.updated_at : version.current, payload);
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
      // Conflit : on ferme et on recharge, sinon la fiche rouverte montrerait la même version périmée
      if (isConflict(error)) { onClose(); await onSaved(); }
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
  const personName = (id: string) => { const u = people.find(x => x.id === id); return u ? `${u.first_name} ${u.last_name}`.trim() : '—'; };
  const toggleMember = (id: string) => set({ members: form?.members.includes(id) ? (form?.members ?? []).filter(x => x !== id) : [...(form?.members ?? []), id] });

  return (
    <Modal isOpen={!!target} onClose={onClose} title={title} size="lg">
      {form && (
        <form onSubmit={save} className="space-y-4">
          {/* Titre en grand, puis une ligne de contexte : « Tâche · Projet X » */}
          <div>
            <label htmlFor="itm-name" className="sr-only">Nom</label>
            <input id="itm-name" required value={form.name} disabled={readOnly} placeholder="Nom de l'élément" onChange={e => set({ name: e.target.value })}
              className={`${inputClass} text-base font-semibold`} />
            {(!isNew || presetParent) && project && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{`${ITEM_KIND_LABEL[form.kind]} · ${project.name}`}</p>}
          </div>

          {/* Les propriétés qui comptent : à la création le projet, le type (et la tâche parente d'une sous-tâche) ; puis état, priorité, période, assignés */}
          <div className="grid gap-3 sm:grid-cols-2">
            {isNew && !presetParent && (
              <div className="sm:col-span-2">
                <label htmlFor="itm-project" className={labelClass}>Projet</label>
                <select id="itm-project" className={inputClass} value={form.projectId} onChange={e => set({ projectId: e.target.value, parentId: '', members: [] })} required>
                  {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            {isNew && (
              <div className={needsParent ? '' : 'sm:col-span-2'}>
                <label htmlFor="itm-kind" className={labelClass}>Type</label>
                <select id="itm-kind" className={inputClass} value={form.kind} onChange={e => changeKind(e.target.value as ItemKind)}>
                  {kindChoices.map(k => <option key={k} value={k}>{ITEM_KIND_LABEL[k]}</option>)}
                </select>
              </div>
            )}
            {needsParent && (
              <div>
                <label htmlFor="itm-parent" className={labelClass}>Rangé sous</label>
                <select id="itm-parent" className={inputClass} value={form.parentId} disabled={readOnly || (isNew && !!presetParent)} required onChange={e => set({ parentId: e.target.value })}>
                  <option value="">— Choisis une tâche</option>
                  {parentOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="itm-status" className={labelClass}>État</label>
              <StatusPicker id="itm-status" statuses={data.statuses} value={form.status_id} disabled={readOnly} onChange={v => set({ status_id: v })} />
            </div>
            <div>
              <label htmlFor="itm-priority" className={labelClass}>Priorité</label>
              <select id="itm-priority" className={inputClass} value={form.priority} disabled={readOnly} onChange={e => set({ priority: e.target.value as FormState['priority'] })}>
                <option value="">—</option>
                {(Object.keys(PRIORITY_LABEL) as ProjectPriority[]).map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </div>
            {form.kind !== 'milestone' && (
              <div>
                <label htmlFor="itm-estimate" className={labelClass}>Estimation (heures)</label>
                <input id="itm-estimate" type="number" inputMode="decimal" min={0} max={9999} step={0.1} className={inputClass} value={form.estimate} disabled={readOnly}
                  onChange={e => set({ estimate: e.target.value })} placeholder="Non estimé" />
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Pour la vue « Charge » : réparti sur les jours ouvrés, partagé entre les assignés.</p>
              </div>
            )}
            {form.kind === 'milestone' ? (
              <div className="sm:col-span-2">
                <label htmlFor="itm-start" className={labelClass}>Date du jalon</label>
                <DateInput id="itm-start" className={inputClass} value={form.starts_on} disabled={readOnly} onChange={e => { datesTouched.current = true; set({ starts_on: e.target.value }); }} />
              </div>
            ) : (
              <div className="sm:col-span-2">
                <label htmlFor="itm-period" className={labelClass}>Période (début et fin)</label>
                <DateRangeInput id="itm-period" className={inputClass} start={form.starts_on} end={form.ends_on} disabled={readOnly} onChange={(a, b) => { datesTouched.current = true; set({ starts_on: a, ends_on: b }); }} placeholder="Choisir le début et la fin" />
                {form.starts_on && form.ends_on && form.ends_on >= form.starts_on && (
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400" data-working-days>
                    {(() => { const n = workingDaysBetween(form.starts_on, form.ends_on, nonWorking); return `${n} jour${n > 1 ? 's' : ''} ouvré${n > 1 ? 's' : ''} (sans week-ends ni jours non travaillés)`; })()}
                  </p>
                )}
              </div>
            )}
            <div className="sm:col-span-2">
              <label htmlFor="itm-assign" className={labelClass}>Assignés</label>
              {team.length === 0 && form.members.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">L'équipe de ce projet est vide : ajoute d'abord des personnes à l'équipe (Projets › Modifier le projet) pour pouvoir leur assigner des tâches.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {form.members.map(id => <span key={id} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-100">{personName(id)}</span>)}
                  {form.members.length === 0 && <span className="text-sm text-gray-500 dark:text-gray-400">Personne</span>}
                  {!readOnly && team.length > 0 && (
                    <MenuButton id="itm-assign-menu" buttonId="itm-assign" menuLabel="Assigner des personnes" icon={<Plus size={14} />} value={form.members.length ? 'Modifier' : 'Assigner'}
                      groups={[{ id: 'team', items: team.map(u => ({
                        id: u.id, closeOnSelect: false, checked: form.members.includes(u.id), onSelect: () => toggleMember(u.id),
                        label: `${u.first_name} ${u.last_name}${u.role === 'lead' ? ` · ${TEAM_ROLE_LABEL.lead.toLowerCase()}` : ''}`,
                      })) }]} />
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="itm-desc" className={labelClass}>Description</label>
            <textarea id="itm-desc" rows={3} className={inputClass} value={form.description} disabled={readOnly} placeholder="Ajouter une description…" onChange={e => set({ description: e.target.value })} />
          </div>

          <button type="button" aria-expanded={showDetails} onClick={() => setShowDetails(v => !v)}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
            {showDetails ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            {showDetails ? 'Masquer les détails' : 'Afficher les détails'}
          </button>

          {showDetails && (
            <div className="space-y-4 rounded-md border border-gray-200 p-3 dark:border-gray-700">
              {!needsParent && form.kind !== 'phase' && (
                <div>
                  <label htmlFor="itm-parent" className={labelClass}>Rangé sous</label>
                  <select id="itm-parent" className={inputClass} value={form.parentId} disabled={readOnly || (isNew && !!presetParent)} onChange={e => set({ parentId: e.target.value })}>
                    <option value="">Directement sous le projet</option>
                    {parentOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
              )}
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
                      <Button variant="outline" size="sm" ariaLabel="Ajouter la dépendance" icon={<Plus size={14} />} disabled={!newPred} onClick={() => void changeLink(async () => { await addLink(newPred, edited.id); setNewPred(''); })}>Ajouter</Button>
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
            </div>
          )}

          {edited && <ResourcesSection itemId={edited.id} canEdit={canUpdate} hasDates={!!(edited.starts_on || edited.ends_on)} issueCount={(data.resourceIssues ?? []).filter(i => i.item_id === edited.id).length} onChanged={onSaved} />}
          {edited && <ExternalsSection itemId={edited.id} canEdit={canUpdate} />}
          {edited && <TimeSection itemId={edited.id} estimateHours={edited.estimate_hours === null || edited.estimate_hours === undefined ? null : Number(edited.estimate_hours)} />}
          {edited && <RepeatSection item={edited} items={data.items} canCreate={canCreate && canUpdate} canDelete={canDelete} onChanged={async () => { versionStale.current = true; await onSaved(); }} />}
          {edited && <DocumentsSection projectId={edited.project_id} itemId={edited.id} />}
          {edited && <DiscussionSection projectId={edited.project_id} itemId={edited.id} autoOpen={focus === 'discussion'} />}
          {edited && <HistorySection kind="item" id={edited.id} statuses={data.statuses} itemName={i => data.items.find(x => x.id === i)?.name} />}

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
