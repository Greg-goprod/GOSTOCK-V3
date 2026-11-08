import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, FolderKanban, Gauge, Hourglass, TimerOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../contexts/AppContext';
import { buildDashboard, type Health } from '../lib/dashboardModel';
import { loadGantt, loadPiloteRights, piloteError, type GanttData, type PiloteRights } from '../lib/pilote';
import { formatDay } from '../lib/zurichTime';
import { MxEmpty } from '../components/mx/MxEmpty';
import ItemDrawer, { type ItemTarget } from '../components/pilote/ItemDrawer';
import { usePiloteLive } from '../components/pilote/usePiloteLive';
import ProjectForm, { type ProjectTarget } from '../components/pilote/ProjectForm';

const NO_RIGHTS: PiloteRights = { create: false, update: false, delete: false };
const EMPTY: GanttData = { statuses: [], projects: [], templates: [], members: [], sites: [], items: [], itemMembers: [], links: [], calendarDays: [], capacities: [], baselines: [] };
const todayZurich = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
const HEALTH_LABEL: Record<Health, string> = { red: 'À risque', orange: 'À surveiller', green: 'Dans les temps', closed: 'Clos' };
const HEALTH_CLASS: Record<Health, string> = {
  red: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100', orange: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
  green: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100', closed: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
};
const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

// PILOTE › Projets › Synthèse : l'état de santé de chaque projet, les échéances des 14 prochains jours et les personnes en surcharge sur 4 semaines.
const PiloteDashboard: React.FC = () => {
  const [data, setData] = useState<GanttData | null>(null);
  const [rights, setRights] = useState<PiloteRights>(NO_RIGHTS);
  const { users } = useApp();
  const [itemTarget, setItemTarget] = useState<ItemTarget | null>(null);
  const [projectTarget, setProjectTarget] = useState<ProjectTarget | null>(null);
  const today = todayZurich();

  const reload = useCallback(async () => {
    try { setData(await loadGantt()); } catch (e) { toast.error(piloteError(e)); setData(prev => prev ?? EMPTY); }
  }, []);
  useEffect(() => { void reload(); void loadPiloteRights().then(setRights); }, [reload]);
  usePiloteLive(reload, !!itemTarget || !!projectTarget);

  const userName = useMemo(() => new Map(users.map(u => [u.id, `${u.first_name} ${u.last_name}`.trim()])), [users]);
  const people = useMemo(() => {
    const ids = new Set<string>();
    for (const m of data?.members ?? []) ids.add(m.user_id);
    for (const m of data?.itemMembers ?? []) ids.add(m.user_id);
    for (const c of data?.capacities ?? []) ids.add(c.user_id);
    return [...ids].filter(id => userName.has(id));
  }, [data, userName]);
  const dash = useMemo(() => buildDashboard(data ?? EMPTY, today, people), [data, today, people]);

  if (!data) return <p className="text-gray-500 dark:text-gray-400 font-medium">Chargement…</p>;
  const names = (ids: string[]) => ids.map(id => userName.get(id) ?? '—').join(', ');
  const kpis: { key: string; label: string; value: number; icon: React.ReactNode; bad: boolean }[] = [
    { key: 'running', label: 'Projets en cours', value: dash.kpis.running, icon: <FolderKanban size={18} aria-hidden />, bad: false },
    { key: 'late', label: 'Projets en retard', value: dash.kpis.late, icon: <TimerOff size={18} aria-hidden />, bad: dash.kpis.late > 0 },
    { key: 'overdue', label: 'Éléments en retard', value: dash.kpis.overdueItems, icon: <AlertTriangle size={18} aria-hidden />, bad: dash.kpis.overdueItems > 0 },
    { key: 'due', label: 'Échéances sous 14 jours', value: dash.kpis.dueSoon, icon: <CalendarClock size={18} aria-hidden />, bad: false },
    { key: 'over', label: 'Personnes en surcharge', value: dash.kpis.overloaded, icon: <Gauge size={18} aria-hidden />, bad: dash.kpis.overloaded > 0 },
    { key: 'est', label: 'Tâches à estimer', value: dash.kpis.toEstimate, icon: <Hourglass size={18} aria-hidden />, bad: false },
  ];

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Indicateurs">
        {kpis.map(k => (
          <li key={k.key} data-kpi={k.key} data-value={k.value} className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
            <div className={`flex items-center gap-1.5 text-xs font-medium ${k.bad ? 'text-danger-600' : 'text-gray-600 dark:text-gray-400'}`}>{k.icon}<span>{k.label}</span></div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${k.bad ? 'text-danger-600' : 'text-gray-900 dark:text-white'}`}>{k.value}</div>
          </li>
        ))}
      </ul>

      <section aria-label="Santé des projets">
        <h3 className="mb-1 text-sm font-bold text-gray-900 dark:text-white">Santé des projets</h3>
        <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
          À risque : projet en retard, ou un élément du chemin critique en retard. À surveiller : au moins un élément en retard, ou fin décalée par rapport à la ligne de base. Les projets terminés ou annulés sont « clos ».
        </p>
        {dash.projects.length === 0 ? (
          <MxEmpty icon={FolderKanban} title="Aucun projet" description="Crée un projet : sa santé apparaîtra ici." />
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm" aria-label="Projets par niveau de risque">
              <thead className="bg-gray-50 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <tr><th scope="col" className="px-3 py-2 text-left font-semibold">Projet</th><th scope="col" className="px-3 py-2 text-left font-semibold">Santé</th><th scope="col" className="px-3 py-2 text-left font-semibold">Avancement</th><th scope="col" className="px-3 py-2 text-left font-semibold">Fin</th><th scope="col" className="px-3 py-2 text-left font-semibold">Pourquoi</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {dash.projects.map(p => (
                  <tr key={p.project.id} data-project={p.project.id} data-health={p.health}>
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      <button type="button" onClick={() => setProjectTarget({ mode: 'edit', row: p.project })} className="text-gray-900 hover:underline dark:text-gray-100">{p.project.name}</button>
                    </th>
                    <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${HEALTH_CLASS[p.health]}`}>{HEALTH_LABEL[p.health]}</span></td>
                    <td className="px-3 py-2">
                      {p.progress === null ? '—' : (
                        <span className="flex items-center gap-2"><span aria-hidden className="h-1.5 w-24 overflow-hidden rounded bg-gray-200 dark:bg-gray-700"><span className="block h-full bg-primary-500" style={{ width: `${Math.round(p.progress * 100)}%` }} /></span><span className="tabular-nums">{`${Math.round(p.progress * 100)} %`}</span></span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{p.end ? formatDay(p.end) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">{p.reasons.length > 0 ? p.reasons.map(r => <div key={r}>{r}</div>) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Échéances proches">
          <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">{`Échéances des 14 prochains jours (${dash.upcoming.length})`}</h3>
          {dash.upcoming.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Aucune échéance dans les 14 prochains jours.</p> : (
            <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
              {dash.upcoming.map(u => (
                <li key={u.itemId} className="flex items-center justify-between gap-3 p-2.5">
                  <div className="min-w-0">
                    <button type="button" onClick={() => setItemTarget({ mode: 'edit', itemId: u.itemId })} className="text-left text-sm font-medium text-gray-900 hover:underline dark:text-gray-100">{u.name}</button>
                    <div className="truncate text-xs text-gray-600 dark:text-gray-400">{`${u.projectName}${u.assignees.length ? ` · ${names(u.assignees)}` : ''}`}</div>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums">{dm(u.end)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Surcharges">
          <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">{`Surcharges sur 4 semaines (${dash.overloads.length})`}</h3>
          {dash.overloads.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Aucune surcharge sur les 4 prochaines semaines.</p> : (
            <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
              {dash.overloads.map(o => (
                <li key={`${o.userId}:${o.weekStart}`} className="flex items-center justify-between gap-3 p-2.5 text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{userName.get(o.userId) ?? '—'}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{`semaine du ${dm(o.weekStart)}`}</span>
                  <span className="font-semibold tabular-nums text-danger-600">{`${Math.round(o.hours * 10) / 10} / ${Math.round(o.capacity * 10) / 10} h`}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ItemDrawer data={data} target={itemTarget} canUpdate={rights.update} canCreate={rights.create} canDelete={rights.delete} onClose={() => setItemTarget(null)} onSaved={reload} />
      <ProjectForm data={data} target={projectTarget} readOnly={projectTarget?.mode === 'edit' && !rights.update} onClose={() => setProjectTarget(null)} onSaved={reload} />
    </div>
  );
};

export default PiloteDashboard;
