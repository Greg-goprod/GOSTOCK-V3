import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { formatPeriod, ITEM_KIND_LABEL, loadGantt, piloteError, type GanttData, type PiloteRights, type StatusFamily } from '../../lib/pilote';
import { formatDay } from '../../lib/zurichTime';
import { MxBadge } from '../mx/MxBadge';
import ItemDrawer, { type ItemTarget } from './ItemDrawer';
import { usePiloteLive } from './usePiloteLive';

const TONE = { not_started: 'neutral', in_progress: 'info', done: 'success', cancelled: 'danger' } as const;
const todayZurich = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());

type Group = 'late' | 'open' | 'undated' | 'closed';
const GROUP_TITLE: Record<Group, string> = { late: 'En retard', open: 'À faire', undated: 'Sans date', closed: 'Terminées ou annulées' };
const GROUP_ORDER: Group[] = ['late', 'open', 'undated', 'closed'];

interface Props { rights: PiloteRights }

// PILOTE › Mes tâches : tout ce qui m'est assigné dans les projets, en retard d'abord ; une ligne ouvre la fiche de l'élément
const MyTasks: React.FC<Props> = ({ rights }) => {
  const { profile } = useAuth();
  const [data, setData] = useState<GanttData | null>(null);
  const [target, setTarget] = useState<ItemTarget | null>(null);

  const reload = useCallback(async () => {
    try { setData(await loadGantt()); } catch (e) { toast.error(piloteError(e)); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  usePiloteLive(reload, !!target);

  const groups = useMemo(() => {
    const out: Record<Group, GanttData['items']> = { late: [], open: [], undated: [], closed: [] };
    if (!data || !profile) return out;
    const mine = new Set(data.itemMembers.filter(m => m.user_id === profile.id).map(m => m.item_id));
    const family = new Map(data.statuses.map(s => [s.id, s.family]));
    const today = todayZurich();
    for (const it of data.items) {
      if (!mine.has(it.id)) continue;
      const fam: StatusFamily = family.get(it.status_id) ?? 'not_started';
      const group: Group = fam === 'done' || fam === 'cancelled' ? 'closed' : !it.ends_on ? 'undated' : it.ends_on < today ? 'late' : 'open';
      out[group].push(it);
    }
    const byEnd = (a: { ends_on: string | null; name: string }, b: { ends_on: string | null; name: string }) => (a.ends_on ?? '9999').localeCompare(b.ends_on ?? '9999') || a.name.localeCompare(b.name, 'fr');
    for (const g of GROUP_ORDER) out[g].sort(byEnd);
    return out;
  }, [data, profile]);

  if (!data) return <p className="text-gray-500 dark:text-gray-400 font-medium">Chargement…</p>;
  const total = GROUP_ORDER.reduce((n, g) => n + groups[g].length, 0);
  const status = new Map(data.statuses.map(s => [s.id, s]));
  const project = new Map(data.projects.map(p => [p.id, p]));

  return (
    <div className="space-y-4">
      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
          <ListChecks aria-hidden className="text-gray-400" size={28} />
          <p className="font-semibold text-gray-900 dark:text-white">Aucune tâche ne t'est assignée</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Quand quelqu'un t'assigne une tâche, un jalon ou une phase d'un projet, elle apparaît ici.</p>
        </div>
      ) : GROUP_ORDER.filter(g => groups[g].length > 0).map(g => (
        <section key={g} aria-label={GROUP_TITLE[g]} className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">{`${GROUP_TITLE[g]} (${groups[g].length})`}</h2>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {groups[g].map(it => {
              const st = status.get(it.status_id);
              const prj = project.get(it.project_id);
              return (
                <li key={it.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: prj?.color ?? '#6366f1' }} />
                  <button type="button" onClick={() => setTarget({ mode: 'edit', itemId: it.id })} className="font-medium text-gray-900 hover:underline dark:text-white">{it.name}</button>
                  <span className="text-gray-600 dark:text-gray-400">{ITEM_KIND_LABEL[it.kind]}{prj ? ` · ${prj.name}` : ''}</span>
                  <span className="whitespace-nowrap text-gray-600 dark:text-gray-400">{it.starts_on || it.ends_on ? formatPeriod(it.starts_on, it.ends_on, formatDay) : ''}</span>
                  {st && <span className="ml-auto"><MxBadge tone={TONE[st.family]}>{st.name}</MxBadge></span>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <ItemDrawer data={data} target={target} canUpdate={rights.update} canCreate={rights.create} canDelete={rights.delete} onClose={() => setTarget(null)} onSaved={reload} />
    </div>
  );
};

export default MyTasks;
