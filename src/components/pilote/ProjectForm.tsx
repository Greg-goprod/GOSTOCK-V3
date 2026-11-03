import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { LINK_MODE_LABEL, piloteError, PRIORITY_LABEL, saveMembers, TYPE_LABEL, TYPE_ORDER, type CpProject, type LinkMode, type PiloteData, type ProjectPriority, type ProjectType } from '../../lib/pilote';
import { ZONE_COLORS } from '../../lib/sitePlanning';
import Button from '../common/Button';
import Modal from '../common/Modal';
import { DateRangeInput } from '../common/DateInput';

export type ProjectTarget = { mode: 'edit'; row: CpProject } | { mode: 'new' };

interface Props {
  data: PiloteData;
  target: ProjectTarget | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

interface FormState {
  name: string; type: ProjectType; program_id: string; status_id: string; priority: '' | ProjectPriority;
  starts_on: string; ends_on: string; color: string; description: string; site_id: string; members: string[];
  link_mode: LinkMode; link_skip_weekends: boolean;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// Création / modification d'un projet : type, état, programme, dates, responsables (plusieurs), chantier de Logistique (type chantier)
const ProjectForm: React.FC<Props> = ({ data, target, onClose, onSaved }) => {
  const { users } = useApp();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const people = useMemo(() => users.filter(u => u.active !== false).sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'fr')), [users]);
  const editedRow = target?.mode === 'edit' ? target.row : null;

  useEffect(() => {
    if (!target) { setForm(null); return; }
    const base = data.statuses.find(s => s.is_system && s.family === 'not_started')?.id ?? data.statuses[0]?.id ?? '';
    if (target.mode === 'edit') {
      const r = target.row;
      setForm({
        name: r.name, type: r.type, program_id: r.program_id ?? '', status_id: r.status_id, priority: r.priority ?? '', starts_on: r.starts_on ?? '', ends_on: r.ends_on ?? '',
        color: r.color, description: r.description ?? '', site_id: r.site_id ?? '', members: data.members.filter(m => m.project_id === r.id).map(m => m.user_id),
        link_mode: r.link_mode ?? 'overlap', link_skip_weekends: r.link_skip_weekends ?? true,
      });
    } else {
      setForm({ name: '', type: 'site', program_id: '', status_id: base, priority: '', starts_on: '', ends_on: '', color: ZONE_COLORS[1], description: '', site_id: '', members: [], link_mode: 'overlap', link_skip_weekends: true });
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
  const toggleMember = (id: string) => set({ members: form?.members.includes(id) ? form.members.filter(x => x !== id) : [...(form?.members ?? []), id] });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !form || !target) return;
    const payload = {
      name: form.name.trim(), type: form.type, program_id: form.program_id || null, status_id: form.status_id, priority: form.priority || null,
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
        const { error } = await supabase.from('cp_projects').update(payload).eq('id', id);
        if (error) throw error;
      }
      await saveMembers(id, form.members);
      toast.success(target.mode === 'new' ? 'Projet créé' : 'Projet modifié');
      onClose();
      await onSaved();
    } catch (error) {
      toast.error(piloteError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={!!target} onClose={onClose} title={target?.mode === 'edit' ? 'Modifier le projet' : 'Nouveau projet'}>
      {form && (
        <form onSubmit={save} className="space-y-3">
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
              <select id="prj-status" className={inputClass} value={form.status_id} onChange={e => set({ status_id: e.target.value })}>
                {data.statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="prj-program" className={labelClass}>Programme</label>
              <select id="prj-program" className={inputClass} value={form.program_id} onChange={e => set({ program_id: e.target.value })}>
                <option value="">— Aucun</option>
                {data.programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
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
              <DateRangeInput id="prj-period" className={inputClass} start={form.starts_on} end={form.ends_on} onChange={(a, b) => set({ starts_on: a, ends_on: b })} placeholder="Choisir le début et la fin" />
            </div>
          </div>
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
          <fieldset>
            <legend className={labelClass}>Responsables</legend>
            {people.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Aucune personne active.</p> : (
              <ul className="grid max-h-40 gap-1 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 p-2 sm:grid-cols-2">
                {people.map(u => (
                  <li key={u.id}>
                    <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                      <input type="checkbox" checked={form.members.includes(u.id)} onChange={() => toggleMember(u.id)} />
                      {u.first_name} {u.last_name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
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
              Éviter les week-ends (un élément décalé automatiquement ne commence pas un samedi ou un dimanche)
            </label>
          </fieldset>
          <div>
            <label htmlFor="prj-desc" className={labelClass}>Description</label>
            <textarea id="prj-desc" rows={3} className={inputClass} value={form.description} onChange={e => set({ description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit" loading={saving}>Enregistrer</Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ProjectForm;
