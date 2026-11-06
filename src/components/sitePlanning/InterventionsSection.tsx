import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Copy, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { confirmAction } from '../../lib/confirm';
import { issueText, planningError, type PlanIntervention, type PlanSite, type PlanningRights, type SitePlanningData } from '../../lib/sitePlanning';
import { formatDay, isoToWall } from '../../lib/zurichTime';
import Button from '../common/Button';
import DateInput from '../common/DateInput';
import { EntityTable } from '../common/EntityTable';
import { MxBadge } from '../mx/MxBadge';
import { MxCardGrid } from '../mx/MxCardGrid';
import { MxEmpty } from '../mx/MxEmpty';
import { MxEntityViewToggle } from '../mx/MxEntityViewToggle';
import { readMxViewMode, writeMxViewMode } from '../mx/mxViewModeStorage';
import { InterventionCard } from './InterventionCard';
import InterventionForm, { type InterventionTarget } from './InterventionForm';
import CopyDayModal from './CopyDayModal';

interface Props {
  site: PlanSite;
  data: SitePlanningData;
  rights: PlanningRights;
  locked: boolean;
  onChanged: () => Promise<void>;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';

const InterventionsSection: React.FC<Props> = ({ site, data, rights, locked, onChanged }) => {
  const { zones, teams, phases, contractors, interventions } = data;
  const [viewMode, setViewModeState] = useState<'cards' | 'list'>(() => readMxViewMode('gomat-view-interventions', ['cards', 'list'] as const, 'list'));
  const setViewMode = (mode: 'cards' | 'list') => { setViewModeState(mode); writeMxViewMode('gomat-view-interventions', mode); };
  const [zoneFilter, setZoneFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [target, setTarget] = useState<InterventionTarget | null>(null);
  const [copying, setCopying] = useState(false);
  const warningsOf = (id: string) => data.issues.filter(x => x.intervention_id === id).map(issueText);
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

  const open = (row: PlanIntervention | 'new') => setTarget(row === 'new' ? { mode: 'new' } : { mode: 'edit', row });

  const remove = async (row: PlanIntervention) => {
    if (!(await confirmAction(`Supprimer l'intervention « ${row.title} » ?`))) return;
    const { error } = await supabase.from('cp_site_interventions').delete().eq('id', row.id);
    if (error) return void toast.error(planningError(error));
    toast.success('Intervention supprimée');
    await onChanged();
  };

  const blocking = zones.length === 0 || teams.length === 0;

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
          {rights.create && writable && <Button variant="outline" icon={<Copy size={16} />} onClick={() => setCopying(true)} disabled={blocking}>Copier un jour</Button>}
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
            { id: 'title', label: 'Intervention', render: i => (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="font-medium">{i.title}</span>
                {i.series_id && <span title="Fait partie d'une série" aria-label="Série"><Repeat size={13} aria-hidden /></span>}
                {warningsOf(i.id).length > 0 && <span className="inline-flex items-center gap-1 text-tone-warning" title={warningsOf(i.id).join('\n')}><AlertTriangle size={13} aria-hidden /><span className="text-xs">Matériel</span></span>}
              </span>
            ) },
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
              team={teamLabel(i.team_id)} phase={i.phase_id ? phaseById.get(i.phase_id)?.name ?? null : null} notes={i.notes} inSeries={!!i.series_id} warnings={warningsOf(i.id)}
              onEdit={rights.update && writable ? () => open(i) : undefined} onDelete={rights.delete && writable ? () => void remove(i) : undefined}
            />
          )}
        />
      )}

      <InterventionForm site={site} data={data} target={target} onClose={() => setTarget(null)} onSaved={onChanged} teamLabel={teamLabel} />
      <CopyDayModal site={site} data={data} open={copying} defaultDay={dayFilter || (interventions[0] ? isoToWall(interventions[0].starts_at).day : site.start_on ?? new Date().toISOString().slice(0, 10))} onClose={() => setCopying(false)} onDone={onChanged} />
    </div>
  );
};

export default InterventionsSection;
