import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, FileStack, Flag } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { LINK_MODE_LABEL, piloteError, isConflict, PRIORITY_LABEL, saveTeam, TEAM_ROLE_LABEL, updateIfUnchanged, TYPE_LABEL, TYPE_ORDER, type CpProject, type LinkMode, type PiloteData, type ProjectPriority, type ProjectType, type TeamRole } from '../../lib/pilote';
import { ZONE_COLORS } from '../../lib/sitePlanning';
import Button from '../common/Button';
import Modal from '../common/Modal';
import StatusPicker from './StatusPicker';
import DiscussionSection from './DiscussionSection';
import DocumentsSection from './DocumentsSection';
import { DateRangeInput } from '../common/DateInput';

// Création : l'état ou le type peuvent être préremplis (création depuis un groupe du Gantt)
export type ProjectTarget = { mode: 'edit'; row: CpProject } | { mode: 'new'; status_id?: string; type?: ProjectType };

interface Props {
  data: PiloteData;
  target: ProjectTarget | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  // Lecteur : la fiche s'ouvre pour consulter, sans pouvoir rien modifier (la base refuse de toute façon l'écriture)
  readOnly?: boolean;
  // Modification d'un projet existant : propose « Dupliquer… » (le parent ouvre la fenêtre de copie)
  onDuplicate?: (row: CpProject) => void;
  // « Enregistrer comme modèle… » (droit de création) : copie le projet en modèle, sans équipe ni assignation
  onSaveAsTemplate?: (row: CpProject) => void;
  // Ligne de base (droits de création, modification et suppression) : figer les dates actuelles comme plan de référence, ou l'effacer
  onFreezeBaseline?: (row: CpProject) => void;
  onClearBaseline?: (row: CpProject) => void;
  // Projets qui ont une ligne de base (le bouton « Effacer » ne s'affiche que pour eux)
  baselineProjectIds?: ReadonlySet<string>;
  // Arrivée par un avis de message : la discussion s'ouvre et vient à l'écran
  focus?: 'discussion';
}

interface FormState {
  name: string; type: ProjectType; status_id: string; priority: '' | ProjectPriority;
  starts_on: string; ends_on: string; color: string; description: string; site_id: string; team: Record<string, TeamRole>;
  link_mode: LinkMode; link_skip_weekends: boolean;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// Création / modification d'un projet : type, état, dates, équipe (responsables et membres), chantier de Logistique (type chantier)
const ProjectForm: React.FC<Props> = ({ data, target, onClose, onSaved, readOnly = false, onDuplicate, onSaveAsTemplate, onFreezeBaseline, onClearBaseline, baselineProjectIds, focus }) => {
  const { users } = useApp();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  // « Afficher les détails » : chantier lié, couleur, dépendances (repliés par défaut, comme la fiche d'un élément)
  const [showDetails, setShowDetails] = useState(false);
  // Version du projet à l'ouverture de la fiche : on n'enregistre que si personne ne l'a modifié depuis (voir updateIfUnchanged)
  const version = useRef<string | null>(null);
  const people = useMemo(() => users.filter(u => u.active !== false).sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'fr')), [users]);
  const editedRow = target?.mode === 'edit' ? target.row : null;

  useEffect(() => {
    if (!target) { setForm(null); setShowDetails(false); return; }
    const base = data.statuses.find(s => s.is_system && s.family === 'not_started')?.id ?? data.statuses[0]?.id ?? '';
    if (target.mode === 'edit') {
      const r = target.row;
      version.current = r.updated_at ?? null;
      setForm({
        name: r.name, type: r.type, status_id: r.status_id, priority: r.priority ?? '', starts_on: r.starts_on ?? '', ends_on: r.ends_on ?? '',
        color: r.color, description: r.description ?? '', site_id: r.site_id ?? '', team: Object.fromEntries(data.members.filter(m => m.project_id === r.id).map(m => [m.user_id, m.role])),
        link_mode: r.link_mode ?? 'overlap', link_skip_weekends: r.link_skip_weekends ?? true,
      });
      // Les détails s'ouvrent d'eux-mêmes si un réglage n'est pas celui par défaut
      setShowDetails(!!r.site_id || (r.link_mode ?? 'overlap') !== 'overlap' || (r.link_skip_weekends ?? true) !== true);
    } else {
      setShowDetails(false);
      const presetStatus = target.status_id && data.statuses.some(s => s.id === target.status_id) ? target.status_id : base;
      setForm({ name: '', type: target.type ?? 'site', status_id: presetStatus, priority: '', starts_on: '', ends_on: '', color: ZONE_COLORS[1], description: '', site_id: '', team: {}, link_mode: 'overlap', link_skip_weekends: true });
    }
    // Le formulaire repart de zéro à chaque ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // Chantiers encore libres (un chantier n'a qu'un projet), plus celui du projet modifié
  const freeSites = useMemo(() => {
    const taken = new Set(data.projects.filter(p => p.site_id && p.id !== editedRow?.id).map(p => p.site_id));
    return data.sites.filter(s => !taken.has(s.id));
  }, [data, editedRow]);

  const set = (patch: Partial<FormState>) => setForm(f => (f ? { ...f, ...patch } : f));
  // '' = hors équipe
  const setRole = (id: string, role: '' | TeamRole) => setForm(f => {
    if (!f) return f;
    const team = { ...f.team };
    if (role === '') delete team[id]; else team[id] = role;
    return { ...f, team };
  });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !form || !target || readOnly) return;
    const payload = {
      name: form.name.trim(), type: form.type, status_id: form.status_id, priority: form.priority || null,
      starts_on: form.starts_on || null, ends_on: form.ends_on || null, color: form.color, description: form.description.trim() || null,
      site_id: form.type === 'site' && form.site_id ? form.site_id : null,
      link_mode: form.link_mode, link_skip_weekends: form.link_skip_weekends,
    };
    if (payload.starts_on && payload.ends_on && payload.ends_on < payload.starts_on) return void toast.error('La fin doit être après le début');
    setSaving(true);
    try {
      let id = editedRow?.id ?? '';
      if (target.mode === 'new') {
        const { data: row, error } = await supabase.from('cp_projects').insert(payload).select('id').single();
        if (error) throw error;
        id = row.id as string;
      } else {
        await updateIfUnchanged('cp_projects', id, version.current, payload);
      }
      await saveTeam(id, form.team);
      toast.success(target.mode === 'new' ? 'Projet créé' : 'Projet modifié');
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

  return (
    <Modal isOpen={!!target} onClose={onClose} title={target?.mode === 'edit' ? (readOnly ? (editedRow?.name ?? 'Projet') : 'Modifier le projet') : 'Nouveau projet'}>
      {form && (
        <form onSubmit={save} className="space-y-3">
          <fieldset disabled={readOnly} className="m-0 min-w-0 space-y-3 border-0 p-0">
          <div>
            <label htmlFor="prj-name" className={labelClass}>Nom du projet</label>
            <input id="prj-name" className={inputClass} required value={form.name} onChange={e => set({ name: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="prj-type" className={labelClass}>Type</label>
              <select id="prj-type" className={inputClass} value={form.type} onChange={e => set({ type: e.target.value as ProjectType, site_id: e.target.value === 'site' ? form.site_id : '' })}>
                {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="prj-status" className={labelClass}>État</label>
              <StatusPicker id="prj-status" statuses={data.statuses} value={form.status_id} disabled={readOnly} onChange={v => set({ status_id: v })} />
            </div>
            <div>
              <label htmlFor="prj-priority" className={labelClass}>Priorité</label>
              <select id="prj-priority" className={inputClass} value={form.priority} onChange={e => set({ priority: e.target.value as FormState['priority'] })}>
                <option value="">—</option>
                {(Object.keys(PRIORITY_LABEL) as ProjectPriority[]).map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="prj-period" className={labelClass}>Période (début et fin)</label>
              <DateRangeInput id="prj-period" className={inputClass} start={form.starts_on} end={form.ends_on} disabled={readOnly} onChange={(a, b) => set({ starts_on: a, ends_on: b })} placeholder="Choisir le début et la fin" />
            </div>
          </div>
          <fieldset>
            <legend className={labelClass}>Équipe</legend>
            {people.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Aucune personne active.</p> : (
              <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 p-2">
                {people.map(u => (
                  <li key={u.id} className="flex items-center justify-between gap-2 text-sm text-gray-800 dark:text-gray-200">
                    <span className="min-w-0 truncate">{u.first_name} {u.last_name}</span>
                    <select aria-label={`Rôle de ${u.first_name} ${u.last_name}`} className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                      value={form.team[u.id] ?? ''} onChange={e => setRole(u.id, e.target.value as '' | TeamRole)}>
                      <option value="">Pas dans l'équipe</option>
                      <option value="member">{TEAM_ROLE_LABEL.member}</option>
                      <option value="lead">{TEAM_ROLE_LABEL.lead}</option>
                    </select>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Les tâches ne s'assignent qu'aux personnes de l'équipe. Retirer quelqu'un de l'équipe le désassigne aussi de toutes les tâches du projet.</p>
          </fieldset>
          <div>
            <label htmlFor="prj-desc" className={labelClass}>Description</label>
            <textarea id="prj-desc" rows={3} className={inputClass} value={form.description} onChange={e => set({ description: e.target.value })} />
          </div>
          </fieldset>
          <button type="button" aria-expanded={showDetails} onClick={() => setShowDetails(v => !v)}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
            {showDetails ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            {showDetails ? 'Masquer les détails' : 'Afficher les détails'}
          </button>
          {showDetails && (
            <fieldset disabled={readOnly} className="m-0 min-w-0 space-y-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
            {form.type === 'site' && (
              <div>
                <label htmlFor="prj-site" className={labelClass}>Chantier de Logistique (facultatif)</label>
                <select id="prj-site" className={inputClass} value={form.site_id} onChange={e => set({ site_id: e.target.value })}>
                  <option value="">— Aucun</option>
                  {freeSites.map(s => <option key={s.id} value={s.id}>{s.status === 'closed' ? `${s.name} (clôturé)` : s.name}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Relie ce projet au chantier déjà suivi dans Logistique. Un chantier n'a qu'un projet.</p>
              </div>
            )}
            <div>
              <span className={labelClass}>Couleur</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Couleur">
                {ZONE_COLORS.map(c => (
                  <button key={c} type="button" role="radio" aria-checked={form.color === c} aria-label={c} onClick={() => set({ color: c })}
                    className={`h-7 w-7 rounded-full border-2 ${form.color === c ? 'border-gray-900 dark:border-white' : 'border-transparent'}`} style={{ background: c }} />
                ))}
              </div>
            </div>
            <fieldset className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
              <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">Dépendances entre éléments</legend>
              <label htmlFor="prj-linkmode" className={labelClass}>Décalage automatique du successeur</label>
              <select id="prj-linkmode" className={inputClass} value={form.link_mode} onChange={e => set({ link_mode: e.target.value as LinkMode })}>
                {(Object.keys(LINK_MODE_LABEL) as LinkMode[]).map(m => <option key={m} value={m}>{LINK_MODE_LABEL[m]}</option>)}
              </select>
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input type="checkbox" checked={form.link_skip_weekends} onChange={e => set({ link_skip_weekends: e.target.checked })} />
                Éviter les week-ends et les jours non travaillés (un élément décalé automatiquement ne commence ni un samedi, ni un dimanche, ni un jour férié ou une fermeture du calendrier de travail)
              </label>
            </fieldset>
            </fieldset>
          )}
          {editedRow && <DocumentsSection projectId={editedRow.id} itemId={null} />}
          {editedRow && <DiscussionSection projectId={editedRow.id} itemId={null} autoOpen={focus === 'discussion'} />}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap gap-2">
              {editedRow && onDuplicate && !readOnly && <Button variant="outline" icon={<Copy size={14} />} onClick={() => onDuplicate(editedRow)}>Dupliquer…</Button>}
              {editedRow && onFreezeBaseline && !readOnly && <Button variant="outline" icon={<Flag size={14} />} onClick={() => onFreezeBaseline(editedRow)}>Figer la ligne de base…</Button>}
              {editedRow && onClearBaseline && !readOnly && baselineProjectIds?.has(editedRow.id) && <Button variant="outline" onClick={() => onClearBaseline(editedRow)}>Effacer la ligne de base…</Button>}
              {editedRow && onSaveAsTemplate && !readOnly && <Button variant="outline" icon={<FileStack size={14} />} onClick={() => onSaveAsTemplate(editedRow)}>Enregistrer comme modèle…</Button>}
            </div>
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

export default ProjectForm;
