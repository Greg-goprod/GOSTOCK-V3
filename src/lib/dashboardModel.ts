import { buildGantt, progressOf } from './ganttModel';
import { isOverdue } from './ganttFilters';
import { criticalPath } from './criticalPath';
import { computeWorkload } from './workload';
import { addDays, mondayOf } from './boardCalendarModel';
import type { CpProject, GanttData } from './pilote';

// Synthèse des projets (sans affichage) : santé de chaque projet, échéances proches, personnes en surcharge.
// Règles de santé (affichées à l'écran) :
//   rouge  : projet en retard (fin passée, pas terminé) OU un élément du chemin critique est en retard ;
//   orange : au moins un élément en retard OU fin décalée par rapport à la ligne de base ;
//   vert   : sinon ; « clos » : projet terminé ou annulé (hors de la liste à surveiller).
export type Health = 'red' | 'orange' | 'green' | 'closed';
export interface ProjectHealth {
  project: CpProject; health: Health; progress: number | null; end: string | null;
  overdueItems: number; criticalOverdue: number; baselineVariance: number | null; reasons: string[];
}
export interface Upcoming { itemId: string; name: string; projectName: string; end: string; assignees: string[] }
export interface Overload { userId: string; weekStart: string; hours: number; capacity: number }
export interface Dashboard {
  kpis: { running: number; late: number; overdueItems: number; dueSoon: number; overloaded: number; toEstimate: number };
  projects: ProjectHealth[]; upcoming: Upcoming[]; overloads: Overload[];
}
const RANK: Record<Health, number> = { red: 0, orange: 1, green: 2, closed: 3 };
const dayN = (d: string) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000);

export function buildDashboard(data: GanttData, today: string, userIds: string[], horizonDays = 14): Dashboard {
  const family = new Map(data.statuses.map(s => [s.id, s.family]));
  const model = buildGantt(data, 'status');
  const row = new Map(model.rows.filter(r => r.id && (r.kind === 'project')).map(r => [r.id as string, r]));
  const crit = criticalPath(data);
  const base = new Map(data.baselines.filter(b => b.item_id === null).map(b => [b.project_id, b.ends_on]));
  const itemsOf = new Map<string, GanttData['items']>();
  for (const i of data.items) { const l = itemsOf.get(i.project_id) ?? []; l.push(i); itemsOf.set(i.project_id, l); }
  const live = (statusId: string) => { const f = family.get(statusId); return f !== 'done' && f !== 'cancelled'; };

  const projects: ProjectHealth[] = data.projects.map(p => {
    const r = row.get(p.id);
    const fam = family.get(p.status_id) ?? null;
    const end = r?.end ?? p.ends_on;
    const items = (itemsOf.get(p.id) ?? []).filter(i => i.kind !== 'phase' && live(i.status_id));
    const overdueList = items.filter(i => isOverdue(i.ends_on ?? i.starts_on, family.get(i.status_id) ?? null, today));
    const criticalOverdue = overdueList.filter(i => crit.items.has(i.id)).length;
    const baseEnd = base.get(p.id);
    const variance = baseEnd && end ? dayN(end) - dayN(baseEnd) : null;
    const projectLate = isOverdue(end, fam, today);
    const reasons: string[] = [];
    if (projectLate) reasons.push('Projet en retard');
    if (criticalOverdue > 0) reasons.push(`${criticalOverdue} élément${criticalOverdue > 1 ? 's' : ''} en retard sur le chemin critique`);
    if (overdueList.length > criticalOverdue) reasons.push(`${overdueList.length - criticalOverdue} autre${overdueList.length - criticalOverdue > 1 ? 's' : ''} élément${overdueList.length - criticalOverdue > 1 ? 's' : ''} en retard`);
    if (variance !== null && variance > 0) reasons.push(`Fin décalée de ${variance} j par rapport à la ligne de base`);
    const closed = fam === 'done' || fam === 'cancelled';
    const health: Health = closed ? 'closed' : projectLate || criticalOverdue > 0 ? 'red' : overdueList.length > 0 || (variance !== null && variance > 0) ? 'orange' : 'green';
    return { project: p, health, progress: r ? progressOf(r) : null, end, overdueItems: overdueList.length, criticalOverdue, baselineVariance: variance, reasons };
  }).sort((a, b) => RANK[a.health] - RANK[b.health] || (a.end ?? '9999') .localeCompare(b.end ?? '9999') || a.project.name.localeCompare(b.project.name, 'fr'));

  const projectName = new Map(data.projects.map(p => [p.id, p.name]));
  const users = new Map<string, string[]>();
  for (const m of data.itemMembers) { const l = users.get(m.item_id) ?? []; l.push(m.user_id); users.set(m.item_id, l); }
  const horizon = addDays(today, horizonDays - 1);
  const upcoming: Upcoming[] = data.items
    .filter(i => i.kind !== 'phase' && projectName.has(i.project_id) && live(i.status_id) && !!i.ends_on && i.ends_on >= today && i.ends_on <= horizon)
    .map(i => ({ itemId: i.id, name: i.name, projectName: projectName.get(i.project_id) ?? '', end: i.ends_on as string, assignees: users.get(i.id) ?? [] }))
    .sort((a, b) => a.end.localeCompare(b.end) || a.name.localeCompare(b.name, 'fr'));

  const wl = computeWorkload(data, mondayOf(today), 4, userIds);
  const overloads: Overload[] = wl.rows.flatMap(r => r.cells.filter(c => c.level === 'over').map(c => ({ userId: r.userId, weekStart: c.weekStart, hours: c.hours, capacity: c.capacity })));
  const open = projects.filter(p => p.health !== 'closed');
  return {
    kpis: {
      running: open.length, late: open.filter(p => p.health === 'red' && p.reasons.includes('Projet en retard')).length,
      overdueItems: open.reduce((n, p) => n + p.overdueItems, 0), dueSoon: upcoming.length, overloaded: new Set(overloads.map(o => o.userId)).size, toEstimate: wl.unestimated.length,
    },
    projects, upcoming, overloads,
  };
}
