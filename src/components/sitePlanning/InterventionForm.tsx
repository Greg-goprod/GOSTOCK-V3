import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { DEFAULT_CONFIG, firstUsefulDay, planningError, type PlanIntervention, type PlanSite, type SitePlanningData } from '../../lib/sitePlanning';
import { isoToWall, shortTime, wallToIso } from '../../lib/zurichTime';
import Button from '../common/Button';
import Modal from '../common/Modal';
import DateInput, { TimeInput } from '../common/DateInput';

export interface FormState { title: string; zone_id: string; team_id: string; phase_id: string; day: string; start: string; endDay: string; end: string; notes: string }

// Ce que le formulaire doit faire : modifier une intervention existante, ou en créer une (éventuellement pré-remplie depuis la frise)
export type InterventionTarget = { mode: 'edit'; row: PlanIntervention } | { mode: 'new'; prefill?: Partial<FormState> };

interface Props {
  site: PlanSite;
  data: SitePlanningData;
  target: InterventionTarget | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  teamLabel: (teamId: string) => string;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const addHour = (time: string) => `${String(Math.min(23, Number(time.slice(0, 2)) + 1)).padStart(2, '0')}:${time.slice(3, 5)}`;

const InterventionForm: React.FC<Props> = ({ site, data, target, onClose, onSaved, teamLabel }) => {
  const { zones, teams, phases, config } = data;
  const cfg = config ?? { ...DEFAULT_CONFIG, site_id: site.id };
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) { setForm(null); return; }
    if (target.mode === 'edit') {
      const row = target.row, a = isoToWall(row.starts_at), b = isoToWall(row.ends_at);
      setForm({ title: row.title, zone_id: row.zone_id, team_id: row.team_id, phase_id: row.phase_id ?? '', day: a.day, start: a.time, endDay: b.day, end: b.time, notes: row.notes ?? '' });
    } else {
      const start = shortTime(cfg.day_start), day = firstUsefulDay(site);
      setForm({ title: '', zone_id: zones[0]?.id ?? '', team_id: teams[0]?.id ?? '', phase_id: '', day, start, endDay: day, end: addHour(start), notes: '', ...target.prefill });
    }
    // Le formulaire repart de zéro à chaque ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !form || !target) return;
    if (!form.day || !form.start || !form.end) return void toast.error('Indique le jour et les heures');
    const endDay = cfg.all_day ? form.endDay : form.day;
    const payload = {
      title: form.title.trim(), zone_id: form.zone_id, team_id: form.team_id, phase_id: form.phase_id || null, notes: form.notes.trim() || null,
      starts_at: wallToIso(form.day, form.start), ends_at: wallToIso(endDay, form.end),
    };
    setSaving(true);
    const { error } = target.mode === 'new'
      ? await supabase.from('site_interventions').insert({ ...payload, site_id: site.id })
      : await supabase.from('site_interventions').update(payload).eq('id', target.row.id);
    setSaving(false);
    if (error) return void toast.error(planningError(error));
    toast.success(target.mode === 'new' ? 'Intervention ajoutée' : 'Intervention modifiée');
    onClose();
    await onSaved();
  };

  return (
    <Modal isOpen={target !== null && form !== null} onClose={onClose} title={target?.mode === 'edit' ? "Modifier l'intervention" : 'Nouvelle intervention'}>
      {form && (
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="itv-title" className={labelClass}>Intitulé</label>
            <input id="itv-title" className={inputClass} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="ex. Pose des structures" />
          </div>
          <div>
            <label htmlFor="itv-zone" className={labelClass}>Zone</label>
            <select id="itv-zone" className={inputClass} value={form.zone_id} onChange={e => setForm({ ...form, zone_id: e.target.value })} required>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="itv-team" className={labelClass}>Équipe</label>
            <select id="itv-team" className={inputClass} value={form.team_id} onChange={e => setForm({ ...form, team_id: e.target.value })} required>
              {teams.map(t => <option key={t.id} value={t.id}>{teamLabel(t.id)}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="itv-phase" className={labelClass}>Phase (facultatif)</label>
            <select id="itv-phase" className={inputClass} value={form.phase_id} onChange={e => setForm({ ...form, phase_id: e.target.value })}>
              <option value="">—</option>
              {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="itv-day" className={labelClass}>{cfg.all_day ? 'Début : jour' : 'Jour'}</label>
            <DateInput id="itv-day" className={inputClass} value={form.day} onChange={e => setForm({ ...form, day: e.target.value, endDay: cfg.all_day && form.endDay < e.target.value ? e.target.value : form.endDay })} required />
          </div>
          <div>
            <label htmlFor="itv-start" className={labelClass}>{cfg.all_day ? 'Début : heure' : 'De'}</label>
            <TimeInput id="itv-start" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} required />
          </div>
          {cfg.all_day && (
            <div>
              <label htmlFor="itv-endday" className={labelClass}>Fin : jour</label>
              <DateInput id="itv-endday" className={inputClass} value={form.endDay} min={form.day} onChange={e => setForm({ ...form, endDay: e.target.value })} required />
            </div>
          )}
          <div className={cfg.all_day ? '' : 'sm:col-start-2'}>
            <label htmlFor="itv-end" className={labelClass}>{cfg.all_day ? 'Fin : heure' : 'À'}</label>
            <TimeInput id="itv-end" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} required />
          </div>
          <p className="sm:col-span-2 text-xs text-gray-600 dark:text-gray-400">
            {cfg.all_day ? `Chantier en 24 h/24 · pas de ${cfg.step_minutes} minutes · heures de Suisse.` : `Heures du chantier : ${shortTime(cfg.day_start)} à ${shortTime(cfg.day_end)} · pas de ${cfg.step_minutes} minutes · heures de Suisse.`}
          </p>
          <div className="sm:col-span-2">
            <label htmlFor="itv-notes" className={labelClass}>Remarques</label>
            <textarea id="itv-notes" rows={2} className={inputClass} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit" loading={saving}>Enregistrer</Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default InterventionForm;
