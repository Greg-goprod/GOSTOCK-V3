import React, { useMemo, useState } from 'react';
import { FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { confirmAction } from '../../lib/confirm';
import { FAMILY_LABEL, FAMILY_ORDER, formatPeriod, PRIORITY_LABEL, piloteError, TYPE_LABEL, TYPE_ORDER, type CpProject, type PiloteData, type PiloteRights, type ProjectType, type StatusFamily } from '../../lib/pilote';
import { formatDay } from '../../lib/zurichTime';
import Button from '../common/Button';
import { EntityTable } from '../common/EntityTable';
import { MxBadge } from '../mx/MxBadge';
import { MxCardGrid } from '../mx/MxCardGrid';
import { MxEmpty } from '../mx/MxEmpty';
import { MxEntityViewToggle } from '../mx/MxEntityViewToggle';
import { readMxViewMode, writeMxViewMode } from '../mx/mxViewModeStorage';
import { ProjectCard } from './ProjectCard';
import ProjectForm, { type ProjectTarget } from './ProjectForm';

interface Props {
  data: PiloteData;
  rights: PiloteRights;
  onChanged: () => Promise<void>;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const TONE: Record<StatusFamily, 'neutral' | 'info' | 'success' | 'danger'> = { not_started: 'neutral', in_progress: 'info', done: 'success', cancelled: 'danger' };

const ProjectsSection: React.FC<Props> = ({ data, rights, onChanged }) => {
  const { users } = useApp();
  const [viewMode, setViewModeState] = useState<'cards' | 'list'>(() => readMxViewMode('gomat-view-projets', ['cards', 'list'] as const, 'cards'));
  const setViewMode = (mode: 'cards' | 'list') => { setViewModeState(mode); writeMxViewMode('gomat-view-projets', mode); };
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | ProjectType>('');
  const [familyFilter, setFamilyFilter] = useState<'' | StatusFamily>('');
  const [programFilter, setProgramFilter] = useState('');
  const [target, setTarget] = useState<ProjectTarget | null>(null);

  const statusById = useMemo(() => new Map(data.statuses.map(s => [s.id, s])), [data.statuses]);
  const programById = useMemo(() => new Map(data.programs.map(p => [p.id, p])), [data.programs]);
  const siteById = useMemo(() => new Map(data.sites.map(s => [s.id, s])), [data.sites]);
  const userName = useMemo(() => new Map(users.map(u => [u.id, `${u.first_name} ${u.last_name}`.trim()])), [users]);
  // Responsables en clair, puis le nombre de membres de l'équipe (morceaux séparés pour que chacun soit traduit)
  const teamOf = (projectId: string) => {
    const team = data.members.filter(m => m.project_id === projectId);
    const leads = team.filter(m => m.role === 'lead').map(m => userName.get(m.user_id) ?? '—').join(', ');
    return { leads, others: team.length - team.filter(m => m.role === 'lead').length };
  };
  const teamNode = (projectId: string, empty: string) => {
    const { leads, others } = teamOf(projectId);
    if (!leads && others === 0) return <span>{empty}</span>;
    return <>{leads && <span>{leads}</span>}{leads && others > 0 && ' · '}{others > 0 && <span>{`${others} membre${others > 1 ? 's' : ''}`}</span>}</>;
  };

  const counts = useMemo(() => {
    const c: Record<StatusFamily, number> = { not_started: 0, in_progress: 0, done: 0, cancelled: 0 };
    for (const p of data.projects) c[statusById.get(p.status_id)?.family ?? 'not_started']++;
    return c;
  }, [data.projects, statusById]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.projects.filter(p => {
      if (typeFilter && p.type !== typeFilter) return false;
      if (familyFilter && statusById.get(p.status_id)?.family !== familyFilter) return false;
      if (programFilter === '_none' ? p.program_id !== null : programFilter && p.program_id !== programFilter) return false;
      if (q && !`${p.name} ${p.description ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.projects, search, typeFilter, familyFilter, programFilter, statusById]);

  const remove = async (row: CpProject) => {
    if (!(await confirmAction(`Supprimer le projet « ${row.name} » ? Ses responsables seront détachés.`))) return;
    const { error } = await supabase.from('cp_projects').delete().eq('id', row.id);
    if (error) return void toast.error(piloteError(error));
    toast.success('Projet supprimé');
    await onChanged();
  };

  const fmt = (d: string | null) => formatDay(d);
  const cardOf = (p: CpProject) => {
    const status = statusById.get(p.status_id);
    return {
      status, program: p.program_id ? programById.get(p.program_id)?.name ?? null : null,
      members: teamNode(p.id, 'Aucune équipe'), site: p.site_id ? siteById.get(p.site_id)?.name ?? null : null,
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" aria-label="Projets par état">
        {FAMILY_ORDER.map(f => (
          <button key={f} type="button" aria-pressed={familyFilter === f} onClick={() => setFamilyFilter(familyFilter === f ? '' : f)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${familyFilter === f ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-200' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
            {`${FAMILY_LABEL[f]} (${counts[f]})`}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Recherche
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom ou description" className={`${inputClass} mt-1 min-w-52`} />
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as '' | ProjectType)} className={`${inputClass} mt-1 min-w-40`}>
              <option value="">Tous</option>
              {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Programme
            <select value={programFilter} onChange={e => setProgramFilter(e.target.value)} className={`${inputClass} mt-1 min-w-44`}>
              <option value="">Tous</option>
              <option value="_none">Sans programme</option>
              {data.programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <MxEntityViewToggle value={viewMode} onChange={setViewMode} aria-label="Affichage des projets" />
          {rights.create && <Button icon={<Plus size={16} />} onClick={() => setTarget({ mode: 'new' })}>Nouveau projet</Button>}
        </div>
      </div>

      {shown.length === 0 ? (
        <MxEmpty icon={FolderKanban} title="Aucun projet" description={data.projects.length === 0 ? 'Les projets (chantier, R&D, conception, recrutement…) apparaîtront ici.' : 'Aucun projet ne correspond à ces filtres.'} />
      ) : viewMode === 'list' ? (
        <EntityTable
          items={shown}
          getKey={p => p.id}
          caption="Projets"
          columns={[
            { id: 'name', label: 'Projet', render: p => (
              <span className="inline-flex items-center gap-2"><span aria-hidden className="h-3 w-3 rounded-full" style={{ background: p.color }} /><span className="font-medium">{p.name}</span></span>
            ) },
            { id: 'type', label: 'Type', render: p => TYPE_LABEL[p.type] },
            { id: 'status', label: 'État', render: p => {
              const s = statusById.get(p.status_id);
              return <MxBadge tone={TONE[s?.family ?? 'not_started']}>{s?.name ?? '—'}</MxBadge>;
            } },
            { id: 'program', label: 'Programme', hideOnMobile: true, render: p => (p.program_id ? programById.get(p.program_id)?.name ?? '—' : '—') },
            { id: 'period', label: 'Période', hideOnMobile: true, render: p => <span className="whitespace-nowrap">{formatPeriod(p.starts_on, p.ends_on, fmt)}</span> },
            { id: 'members', label: 'Équipe', hideOnMobile: true, render: p => teamNode(p.id, '—') },
            { id: 'actions', label: 'Actions', render: p => (
              <span className="inline-flex gap-2">
                {rights.update && <Button size="sm" variant="outline" icon={<Pencil size={14} />} onClick={() => setTarget({ mode: 'edit', row: p })}>Modifier</Button>}
                {rights.delete && <Button size="sm" variant="outline" icon={<Trash2 size={14} />} onClick={() => void remove(p)}>Supprimer</Button>}
              </span>
            ) },
          ]}
        />
      ) : (
        <MxCardGrid
          items={shown}
          getItemKey={p => p.id}
          renderItem={p => {
            const c = cardOf(p);
            return (
              <ProjectCard
                name={p.name} typeLabel={TYPE_LABEL[p.type]} color={p.color} statusName={c.status?.name ?? '—'} statusTone={TONE[c.status?.family ?? 'not_started']}
                program={c.program} period={formatPeriod(p.starts_on, p.ends_on, fmt)} members={c.members} site={c.site}
                priority={p.priority ? PRIORITY_LABEL[p.priority] : null} description={p.description}
                onEdit={rights.update ? () => setTarget({ mode: 'edit', row: p }) : undefined} onDelete={rights.delete ? () => void remove(p) : undefined}
              />
            );
          }}
        />
      )}

      <ProjectForm data={data} target={target} onClose={() => setTarget(null)} onSaved={onChanged} />
    </div>
  );
};

export default ProjectsSection;
