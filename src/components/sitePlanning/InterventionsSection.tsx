import React, { useMemo, useState } from 'react';
import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { confirmAction } from '../../lib/confirm';
import { DEFAULT_CONFIG, planningError, type PlanIntervention, type PlanSite, type PlanningRights, type SitePlanningData } from '../../lib/sitePlanning';
import { formatDay, isoToWall, shortTime, wallToIso } from '../../lib/zurichTime';
import Button from '../common/Button';
import Modal from '../common/Modal';
import DateInput, { TimeInput } from '../common/DateInput';
import { EntityTable } from '../common/EntityTable';
import { MxBadge } from '../mx/MxBadge';
import { MxCardGrid } from '../mx/MxCardGrid';
import { MxEmpty } from '../mx/MxEmpty';
import { MxEntityViewToggle } from '../mx/MxEntityViewToggle';
import { readMxViewMode, writeMxViewMode } from '../mx/mxViewModeStorage';
import { InterventionCard } from './InterventionCard';

interface Props {
  site: PlanSite;
  data: SitePlanningData;
  rights: PlanningRights;
  locked: boolean;
  onChanged: () => Promise<void>;
}

interface FormState { title: string; zone_id: string; team_id: string; phase_id: string; day: string; start: string; endDay: string; end: string; notes: string }

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const addHour = (time: string) => `${String(Math.min(23, Number(time.slice(0, 2)) + 1)).padStart(2, '0')}:${time.slice(3, 5)}`;

const InterventionsSection: React.FC<Props> = ({ site, data, rights, locked, onChanged }) => {
  const { zones, teams, phases, contractors, config, interventions } = data;
  const cfg = config ?? { ...DEFAULT_CONFIG, site_id: site.id };
  const [viewMode, setViewModeState] = useState<'cards' | 'list'>(() => readMxViewMode('gomat-view-interventions', ['cards', 'list'] as const, 'list'));
  const setViewMode = (mode: 'cards' | 'list') => { setViewModeState(mode); writeMxViewMode('gomat-view-interventions', mode); };
  const [zoneFilter, setZoneFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [editing, setEditing] = useState<PlanIntervention | 'new' | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const writable = !locked;

  const zoneById = useMemo(() => new Map(zones.map(z => [z.id, z])), [zones]);
  const teamById = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);
  const phaseById = useMemo(() => new Map(phases.map(p => [p.id, p])), [phases]);
  const contractorById = useMemo(() => new Map(contractors.map(c => [c.id, c])), [contractors]);

  const shown = useMemo(() => interventions.filter(i => {
    if (zoneFilter && i.zone_id !== zoneFilter) return false;
    if (teamFilter && i.team_id !== teamFilter) return false;
    if (dayFilter) {
      const from = isoToWall(i.starts_at).day, to = isoToWall(new Date(new Date(i.ends_at).getTime() - 1000).toISOString()).day;
      if (dayFilter < from || dayFilter > to) return false;
    }
    return true;
  }), [interventions, zoneFilter, teamFilter, dayFilter]);

  const whenOf = (i: PlanIntervention) => {
    const a = isoToWall(i.starts_at), b = isoToWall(i.ends_at);
    return a.day === b.day ? `${formatDay(a.day)} · ${a.time}–${b.time}` : `${formatDay(a.day)} ${a.time} → ${formatDay(b.day)} ${b.time}`;
  };
  const teamLabel = (teamId: string) => {
    const t = teamById.get(teamId);
    const c = t?.contractor_id ? contractorById.get(t.contractor_id) : null;
    return t ? (c ? `${t.name} (${c.name})` : t.name) : '—';
  };

  const open = (row: PlanIntervention | 'new') => {
    const start = shortTime(cfg.day_start);
    const today = new Date().toISOString().slice(0, 10);
    const firstDay = site.start_on && today < site.start_on ? site.start_on : site.end_on && today > site.end_on ? site.end_on : today;
    if (row === 'new') setForm({ title: '', zone_id: zones[0]?.id ?? '', team_id: teams[0]?.id ?? '', phase_id: '', day: firstDay, start, endDay: firstDay, end: addHour(start), notes: '' });
    else {
      const a = isoToWall(row.starts_at), b = isoToWall(row.ends_at);
      setForm({ title: row.title, zone_id: row.zone_id, team_id: row.team_id, phase_id: row.phase_id ?? '', day: a.day, start: a.time, endDay: b.day, end: b.time, notes: row.notes ?? '' });
    }
    setEditing(row);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !form || editing === null) return;
    if (!form.day || !form.start || !form.end) return void toast.error('Indique le jour et les heures');
    const endDay = cfg.all_day ? form.endDay : form.day;
    const payload = {
      title: form.title.trim(), zone_id: form.zone_id, team_id: form.team_id, phase_id: form.phase_id || null, notes: form.notes.trim() || null,
      starts_at: wallToIso(form.day, form.start), ends_at: wallToIso(endDay, form.end),
    };
    setSaving(true);
    const { error } = editing === 'new'
      ? await supabase.from('site_interventions').insert({ ...payload, site_id: site.id })
      : await supabase.from('site_interventions').update(payload).eq('id', editing.id);
    setSaving(false);
    if (error) return void toast.error(planningError(error));
    toast.success(editing === 'new' ? 'Intervention ajoutée' : 'Intervention modifiée');
    setEditing(null);
    await onChanged();
  };

  const remove = async (row: PlanIntervention) => {
    if (!(await confirmAction(`Supprimer l'intervention « ${row.title} » ?`))) return;
    const { error } = await supabase.from('site_interventions').delete().eq('id', row.id);
    if (error) return void toast.error(planningError(error));
    toast.success('Intervention supprimée');
    await onChanged();
  };

  const blocking = zones.length === 0 || teams.length === 0;
  const canAdd = rights.create && writable && !blocking;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Zone
            <select value={zoneFilter} onChange={e => setZoneFilter(e.target.value)} className={`${inputClass} mt-1 min-w-40`}>
              <option value="">Toutes</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Équipe
            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className={`${inputClass} mt-1 min-w-40`}>
              <option value="">Toutes</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            <span className="block mb-1">Jour</span>
            <div className="flex items-center gap-2">
              <div className="w-44"><DateInput aria-label="Filtrer par jour" value={dayFilter} onChange={e => setDayFilter(e.target.value)} className={inputClass} /></div>
              {dayFilter && <Button size="sm" variant="outline" onClick={() => setDayFilter('')}>Tous les jours</Button>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <MxEntityViewToggle value={viewMode} onChange={setViewMode} aria-label="Affichage des interventions" />
          {rights.create && writable && <Button icon={<Plus size={16} />} onClick={() => open('new')} disabled={blocking}>Nouvelle intervention</Button>}
        </div>
      </div>

      {blocking && rights.create && writable && (
        <p className="text-sm text-gray-700 dark:text-gray-300" role="status">Ajoute d'abord au moins une zone et une équipe (onglets Zones et Équipes) pour planifier des interventions.</p>
      )}

      {shown.length === 0 ? (
        <MxEmpty icon={CalendarClock} title="Aucune intervention" description={interventions.length === 0 ? 'Les interventions planifiées de ce chantier apparaîtront ici.' : 'Aucune intervention ne correspond à ces filtres.'} />
      ) : viewMode === 'list' ? (
        <EntityTable
          items={shown}
          getKey={i => i.id}
          caption="Interventions"
          columns={[
            { id: 'when', label: 'Quand', render: i => <span className="whitespace-nowrap">{whenOf(i)}</span> },
            { id: 'title', label: 'Intervention', render: i => <span className="font-medium">{i.title}</span> },
            { id: 'zone', label: 'Zone', render: i => (
              <span className="inline-flex items-center gap-2"><span aria-hidden className="h-3 w-3 rounded-full" style={{ background: zoneById.get(i.zone_id)?.color }} />{zoneById.get(i.zone_id)?.name ?? '—'}</span>
            ) },
            { id: 'team', label: 'Équipe', hideOnMobile: true, render: i => teamLabel(i.team_id) },
            { id: 'phase', label: 'Phase', hideOnMobile: true, render: i => (i.phase_id ? <MxBadge tone="info">{phaseById.get(i.phase_id)?.name ?? '—'}</MxBadge> : '—') },
            { id: 'actions', label: 'Actions', render: i => (
              <span className="inline-flex gap-2">
                {rights.update && writable && <Button size="sm" variant="outline" icon={<Pencil size={14} />} onClick={() => open(i)}>Modifier</Button>}
                {rights.delete && writable && <Button size="sm" variant="outline" icon={<Trash2 size={14} />} onClick={() => void remove(i)}>Supprimer</Button>}
              </span>
            ) },
          ]}
        />
      ) : (
        <MxCardGrid
          items={shown}
          getItemKey={i => i.id}
          renderItem={i => (
            <InterventionCard
              title={i.title} when={whenOf(i)} zone={zoneById.get(i.zone_id)?.name ?? '—'} zoneColor={zoneById.get(i.zone_id)?.color ?? '#6366f1'}
              team={teamLabel(i.team_id)} phase={i.phase_id ? phaseById.get(i.phase_id)?.name ?? null : null} notes={i.notes}
              onEdit={rights.update && writable ? () => open(i) : undefined} onDelete={rights.delete && writable ? () => void remove(i) : undefined}
            />
          )}
        />
      )}

      <Modal isOpen={editing !== null && form !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nouvelle intervention' : "Modifier l'intervention"}>
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
              <Button variant="secondary" onClick={() => setEditing(null)}>Annuler</Button>
              <Button type="submit" loading={saving} disabled={!canAdd && editing === 'new'}>Enregistrer</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default InterventionsSection;
