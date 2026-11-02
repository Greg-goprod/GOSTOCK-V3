import React, { useEffect, useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { confirmAction } from '../../lib/confirm';
import { DEFAULT_CONFIG, planningError, type PlanSite, type PlanningRights, type SitePlanningData } from '../../lib/sitePlanning';
import { formatDay, shortTime } from '../../lib/zurichTime';
import Card from '../common/Card';
import Button from '../common/Button';
import DateInput, { TimeInput } from '../common/DateInput';
import { EntityTable } from '../common/EntityTable';

interface Props {
  site: PlanSite;
  data: SitePlanningData;
  rights: PlanningRights;
  locked: boolean;
  onChanged: () => Promise<void>;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// Réglages du chantier : heures de la journée, 24 h/24, pas de planification, jours bloqués
const ConfigSection: React.FC<Props> = ({ site, data, rights, locked, onChanged }) => {
  const current = data.config ?? { ...DEFAULT_CONFIG, site_id: site.id };
  const [form, setForm] = useState({ day_start: shortTime(current.day_start), day_end: shortTime(current.day_end), all_day: current.all_day, step_minutes: String(current.step_minutes) });
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState({ day: '', reason: '' });
  useEffect(() => {
    setForm({ day_start: shortTime(current.day_start), day_end: shortTime(current.day_end), all_day: current.all_day, step_minutes: String(current.step_minutes) });
  }, [current.day_start, current.day_end, current.all_day, current.step_minutes]);

  const canSave = !locked && (data.config ? rights.update : rights.create);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const payload = { day_start: form.day_start, day_end: form.day_end, all_day: form.all_day, step_minutes: Number(form.step_minutes) };
    setSaving(true);
    const { error } = data.config
      ? await supabase.from('cp_site_config').update(payload).eq('site_id', site.id)
      : await supabase.from('cp_site_config').insert({ ...payload, site_id: site.id });
    setSaving(false);
    if (error) return void toast.error(planningError(error));
    toast.success('Réglages enregistrés');
    await onChanged();
  };

  const addBlocked = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!blocked.day) return;
    const { error } = await supabase.from('cp_site_blocked_days').insert({ site_id: site.id, day: blocked.day, reason: blocked.reason.trim() || null });
    if (error) return void toast.error(planningError(error));
    toast.success('Jour bloqué');
    setBlocked({ day: '', reason: '' });
    await onChanged();
  };

  const removeBlocked = async (id: string, day: string) => {
    if (!(await confirmAction(`Débloquer le ${formatDay(day)} ?`))) return;
    const { error } = await supabase.from('cp_site_blocked_days').delete().eq('id', id);
    if (error) return void toast.error(planningError(error));
    await onChanged();
  };

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={save} className="space-y-4" aria-label="Réglages du planning">
          <h2 className="font-bold text-gray-900 dark:text-white">Heures et pas de planification</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {`Période du chantier : du ${formatDay(site.start_on)} au ${formatDay(site.end_on)} (elle se modifie dans la fiche du chantier). Les interventions doivent rester dans cette période.`}
          </p>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={form.all_day} disabled={!canSave} onChange={e => setForm({ ...form, all_day: e.target.checked })} />
            Chantier en 24 h/24
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="cfg-start" className={labelClass}>Début de journée</label>
              <TimeInput id="cfg-start" value={form.day_start} disabled={!canSave || form.all_day} onChange={e => setForm({ ...form, day_start: e.target.value })} />
            </div>
            <div>
              <label htmlFor="cfg-end" className={labelClass}>Fin de journée</label>
              <TimeInput id="cfg-end" value={form.day_end} disabled={!canSave || form.all_day} onChange={e => setForm({ ...form, day_end: e.target.value })} />
            </div>
            <div>
              <label htmlFor="cfg-step" className={labelClass}>Pas de planification</label>
              <select id="cfg-step" className={inputClass} value={form.step_minutes} disabled={!canSave} onChange={e => setForm({ ...form, step_minutes: e.target.value })}>
                {[5, 15, 30, 60].map(n => <option key={n} value={n}>{`${n} minutes`}</option>)}
              </select>
            </div>
          </div>
          {canSave && <Button type="submit" loading={saving}>Enregistrer les réglages</Button>}
        </form>
      </Card>

      <div className="space-y-3">
        <h2 className="font-bold text-gray-900 dark:text-white">Jours bloqués</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Aucune intervention ne peut être planifiée un jour bloqué (dimanche, jour férié, jour de montage impossible…).</p>
        {rights.create && !locked && (
          <form onSubmit={addBlocked} className="flex flex-wrap items-end gap-3" aria-label="Bloquer un jour">
            <div className="w-44">
              <label htmlFor="blk-day" className={labelClass}>Jour</label>
              <DateInput id="blk-day" className={inputClass} value={blocked.day} onChange={e => setBlocked({ ...blocked, day: e.target.value })} required />
            </div>
            <div className="min-w-48 flex-1">
              <label htmlFor="blk-reason" className={labelClass}>Raison (facultatif)</label>
              <input id="blk-reason" className={inputClass} value={blocked.reason} onChange={e => setBlocked({ ...blocked, reason: e.target.value })} />
            </div>
            <Button type="submit" icon={<Plus size={14} />}>Bloquer ce jour</Button>
          </form>
        )}
        {data.blockedDays.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"><CalendarOff size={16} aria-hidden /> Aucun jour bloqué.</p>
        ) : (
          <EntityTable
            items={data.blockedDays}
            getKey={b => b.id}
            caption="Jours bloqués"
            columns={[
              { id: 'day', label: 'Jour', render: b => <span className="font-medium">{formatDay(b.day)}</span> },
              { id: 'reason', label: 'Raison', render: b => b.reason ?? '—' },
              { id: 'actions', label: 'Actions', render: b => (rights.delete && !locked
                ? <Button size="sm" variant="outline" icon={<Trash2 size={14} />} onClick={() => void removeBlocked(b.id, b.day)}>Débloquer</Button> : null) },
            ]}
          />
        )}
      </div>
    </div>
  );
};

export default ConfigSection;
