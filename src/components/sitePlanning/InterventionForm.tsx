import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Repeat, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { confirmAction } from '../../lib/confirm';
import { createSeries, DEFAULT_CONFIG, firstUsefulDay, issueText, planningError, saveNeeds, WEEKDAYS, type PlanIntervention, type PlanSite, type SitePlanningData } from '../../lib/sitePlanning';
import { isoToWall, shortTime, wallToIso } from '../../lib/zurichTime';
import { dayToNumber } from '../../lib/timelineMath';
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
  const [needs, setNeeds] = useState<{ equipment_id: string; quantity: string }[]>([]);
  const [repeat, setRepeat] = useState<{ on: boolean; last: string; weekdays: number[] }>({ on: false, last: '', weekdays: [1, 2, 3, 4, 5] });
  const { equipment } = useApp();
  // Seuls les outils (pas les consommables) se planifient : leur disponibilité vient des réservations de GO-Mat
  const tools = useMemo(() => equipment.filter(e => e.itemType !== 'consumable' && e.status !== 'retired').sort((a, b) => a.name.localeCompare(b.name, 'fr')), [equipment]);
  const editedRow = target?.mode === 'edit' ? target.row : null;
  const issues = editedRow ? data.issues.filter(i => i.intervention_id === editedRow.id) : [];
  const seriesSize = editedRow?.series_id ? data.interventions.filter(i => i.series_id === editedRow.series_id).length : 0;

  useEffect(() => {
    if (!target) { setForm(null); return; }
    setRepeat({ on: false, last: '', weekdays: [1, 2, 3, 4, 5] });
    if (target.mode === 'edit') {
      const row = target.row, a = isoToWall(row.starts_at), b = isoToWall(row.ends_at);
      setForm({ title: row.title, zone_id: row.zone_id, team_id: row.team_id, phase_id: row.phase_id ?? '', day: a.day, start: a.time, endDay: b.day, end: b.time, notes: row.notes ?? '' });
      setNeeds(data.needs.filter(n => n.intervention_id === row.id).map(n => ({ equipment_id: n.equipment_id, quantity: String(n.quantity) })));
    } else {
      const start = shortTime(cfg.day_start), day = firstUsefulDay(site);
      setForm({ title: '', zone_id: zones[0]?.id ?? '', team_id: teams[0]?.id ?? '', phase_id: '', day, start, endDay: day, end: addHour(start), notes: '', ...target.prefill });
      setNeeds([]);
    }
    // Le formulaire repart de zéro à chaque ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const needInputs = () => needs.filter(n => n.equipment_id).map(n => ({ equipment_id: n.equipment_id, quantity: Math.max(1, Number(n.quantity) || 1) }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !form || !target) return;
    if (!form.day || !form.start || !form.end) return void toast.error('Indique le jour et les heures');
    const endDay = cfg.all_day ? form.endDay : form.day;
    const base = { title: form.title.trim(), zone_id: form.zone_id, team_id: form.team_id, phase_id: form.phase_id || null, notes: form.notes.trim() || null };
    const wanted = needInputs();
    if (new Set(wanted.map(n => n.equipment_id)).size !== wanted.length) return void toast.error('Un même article ne peut figurer qu\'une fois');
    setSaving(true);
    try {
      if (target.mode === 'new' && repeat.on) {
        if (!repeat.last) throw new Error('Indique le dernier jour de la série');
        const result = await createSeries({
          site_id: site.id, ...base, first_day: form.day, last_day: repeat.last, weekdays: repeat.weekdays, start: form.start, end: form.end,
          end_day_offset: cfg.all_day ? dayToNumber(endDay) - dayToNumber(form.day) : 0, needs: wanted,
        });
        toast.success(result.skipped_blocked > 0 ? `${result.created} interventions créées (${result.skipped_blocked} jour(s) bloqué(s) sauté(s))` : `${result.created} interventions créées`);
      } else if (target.mode === 'new') {
        const { data: row, error } = await supabase.from('cp_site_interventions').insert({ ...base, site_id: site.id, starts_at: wallToIso(form.day, form.start), ends_at: wallToIso(endDay, form.end) }).select('id').single();
        if (error) throw error;
        if (wanted.length) await saveNeeds((row as { id: string }).id, wanted);
        toast.success('Intervention ajoutée');
      } else {
        const { error } = await supabase.from('cp_site_interventions').update({ ...base, starts_at: wallToIso(form.day, form.start), ends_at: wallToIso(endDay, form.end) }).eq('id', target.row.id);
        if (error) throw error;
        await saveNeeds(target.row.id, wanted);
        toast.success('Intervention modifiée');
      }
      onClose();
      await onSaved();
    } catch (error) {
      toast.error(planningError(error));
    } finally {
      setSaving(false);
    }
  };

  const removeSeries = async () => {
    if (!editedRow?.series_id) return;
    if (!(await confirmAction(`Supprimer les ${seriesSize} interventions de cette série ?`))) return;
    const { error } = await supabase.from('cp_site_interventions').delete().eq('series_id', editedRow.series_id);
    if (error) return void toast.error(planningError(error));
    toast.success('Série supprimée');
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
          <fieldset className="sm:col-span-2 space-y-2">
            <legend className={labelClass}>Matériel nécessaire (facultatif)</legend>
            {needs.map((n, index) => (
              <div key={index} className="flex items-center gap-2">
                <select aria-label="Article" className={inputClass} value={n.equipment_id} onChange={e => setNeeds(needs.map((x, k) => (k === index ? { ...x, equipment_id: e.target.value } : x)))}>
                  <option value="">—</option>
                  {tools.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input aria-label="Quantité" type="number" min={1} className={`${inputClass} w-20 font-mono`} value={n.quantity} onChange={e => setNeeds(needs.map((x, k) => (k === index ? { ...x, quantity: e.target.value } : x)))} />
                <Button size="sm" variant="outline" ariaLabel="Retirer cet article" icon={<Trash2 size={14} />} onClick={() => setNeeds(needs.filter((_, k) => k !== index))} />
              </div>
            ))}
            <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => setNeeds([...needs, { equipment_id: '', quantity: '1' }])}>Ajouter du matériel</Button>
            {issues.length > 0 && (
              <ul className="space-y-1 text-sm text-tone-warning" aria-label="Avertissements de matériel">
                {issues.map(i => (
                  <li key={i.equipment_id} className="flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />{issueText(i)}</li>
                ))}
              </ul>
            )}
          </fieldset>
          {target?.mode === 'new' && (
            <fieldset className="sm:col-span-2 space-y-2 rounded-md border border-gray-200 dark:border-gray-700 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={repeat.on} onChange={e => setRepeat({ ...repeat, on: e.target.checked, last: repeat.last || form.day })} />
                <Repeat size={14} aria-hidden /> Répéter sur plusieurs jours
              </label>
              {repeat.on && (
                <div className="space-y-2">
                  <div className="w-48">
                    <label htmlFor="itv-last" className={labelClass}>Jusqu'au (inclus)</label>
                    <DateInput id="itv-last" className={inputClass} value={repeat.last} min={form.day} onChange={e => setRepeat({ ...repeat, last: e.target.value })} />
                  </div>
                  <div className="flex flex-wrap gap-3" role="group" aria-label="Jours de la semaine">
                    {WEEKDAYS.map(d => (
                      <label key={d.n} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" checked={repeat.weekdays.includes(d.n)} onChange={e => setRepeat({ ...repeat, weekdays: e.target.checked ? [...repeat.weekdays, d.n] : repeat.weekdays.filter(x => x !== d.n) })} />
                        {d.label}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Les jours bloqués sont sautés. Si un jour est refusé (équipe déjà occupée, hors période…), rien n'est créé et le jour concerné est indiqué.</p>
                </div>
              )}
            </fieldset>
          )}
          {editedRow?.series_id && (
            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 dark:bg-gray-900/40 p-3 text-sm text-gray-700 dark:text-gray-300">
              <span className="flex items-center gap-2"><Repeat size={14} aria-hidden />{`Cette intervention fait partie d'une série de ${seriesSize} interventions.`}</span>
              <Button size="sm" variant="outline" icon={<Trash2 size={14} />} onClick={() => void removeSeries()}>Supprimer toute la série</Button>
            </div>
          )}
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
