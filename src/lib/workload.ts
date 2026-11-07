import { dayToNumber, numberToDay } from './timelineMath';
import type { GanttData } from './pilote';

// Charge par personne (sans affichage) : les heures estimées d'un élément sont réparties sur ses jours ouvrés (ni week-end, ni jour du
// calendrier de travail) et partagées à parts égales entre ses assignés ; on les additionne par semaine et par personne, puis on compare
// à la capacité (40 h par semaine par défaut, réduite des jours non travaillés de la semaine).
export const DEFAULT_CAPACITY = 40;
export type LoadLevel = 'none' | 'ok' | 'warn' | 'over';

export interface WorkloadPart { itemId: string; name: string; projectName: string; hours: number }
export interface WorkloadCell { weekStart: string; hours: number; capacity: number; level: LoadLevel; parts: WorkloadPart[] }
export interface WorkloadRow { userId: string; capacityPerWeek: number; cells: WorkloadCell[] }
export interface Unestimated { itemId: string; name: string; projectName: string; assignees: string[] }
export interface Workload { weeks: string[]; rows: WorkloadRow[]; unestimated: Unestimated[] }

const EPS = 1e-9;
const weekdayOf = (n: number) => new Date(n * 86_400_000).getUTCDay();   // 0 = dimanche
const isWeekendNum = (n: number) => { const d = weekdayOf(n); return d === 0 || d === 6; };

// Niveau d'une case : jusqu'à 80 % « ok », jusqu'à 100 % « warn » (à la limite), au-delà « over »
export function levelOf(hours: number, capacity: number): LoadLevel {
  if (hours <= EPS) return 'none';
  if (capacity <= EPS) return 'over';
  const r = hours / capacity;
  return r <= 0.8 + EPS ? 'ok' : r <= 1 + EPS ? 'warn' : 'over';
}

export function computeWorkload(data: GanttData, from: string, weekCount: number, userIds: string[]): Workload {
  const nonWorking = new Set((data.calendarDays ?? []).map(d => d.day));
  const weeks = Array.from({ length: weekCount }, (_, i) => numberToDay(dayToNumber(from) + 7 * i));
  const rangeStart = dayToNumber(from), rangeEnd = rangeStart + weekCount * 7 - 1;
  const capacityOf = new Map((data.capacities ?? []).map(c => [c.user_id, Number(c.hours_per_week)]));
  const family = new Map(data.statuses.map(s => [s.id, s.family]));
  const project = new Map(data.projects.map(p => [p.id, p.name]));
  const hasChildren = new Set(data.items.map(i => i.parent_id).filter((x): x is string => !!x));
  const assignees = new Map<string, string[]>();
  for (const m of data.itemMembers) { const l = assignees.get(m.item_id) ?? []; l.push(m.user_id); assignees.set(m.item_id, l); }

  const isWorking = (n: number) => !isWeekendNum(n) && !nonWorking.has(numberToDay(n));
  // buckets[user][week] = heures ; parts[user][week] = détail par élément
  const hours = new Map<string, number[]>();
  const parts = new Map<string, Map<number, Map<string, WorkloadPart>>>();
  const unestimated: Unestimated[] = [];

  for (const item of data.items) {
    if (family.get(item.status_id) === 'cancelled' || !project.has(item.project_id)) continue;
    const users = assignees.get(item.id) ?? [];
    const start = item.starts_on ?? item.ends_on, end = item.ends_on ?? item.starts_on;
    if (!start || !end || users.length === 0) continue;
    const s = dayToNumber(start), e = Math.max(dayToNumber(end), s);
    const estimate = item.estimate_hours === null || item.estimate_hours === undefined ? null : Number(item.estimate_hours);
    if (estimate === null) {
      // Une tâche ou sous-tâche feuille, assignée, pas terminée, qui touche la période : à estimer
      if ((item.kind === 'task' || item.kind === 'subtask') && !hasChildren.has(item.id) && family.get(item.status_id) !== 'done' && e >= rangeStart && s <= rangeEnd) {
        unestimated.push({ itemId: item.id, name: item.name, projectName: project.get(item.project_id) ?? '', assignees: users });
      }
      continue;
    }
    if (estimate <= 0) continue;
    const all: number[] = [];
    for (let n = s; n <= e; n++) all.push(n);
    const days = all.filter(isWorking);
    const spread = days.length > 0 ? days : all;   // période entièrement non travaillée : on répartit quand même (l'estimation ne disparaît pas)
    const perDayPerUser = estimate / spread.length / users.length;
    for (const n of spread) {
      if (n < rangeStart || n > rangeEnd) continue;
      const w = Math.floor((n - rangeStart) / 7);
      for (const u of users) {
        const row = hours.get(u) ?? new Array(weekCount).fill(0);
        row[w] += perDayPerUser; hours.set(u, row);
        const byWeek = parts.get(u) ?? new Map<number, Map<string, WorkloadPart>>(); parts.set(u, byWeek);
        const byItem = byWeek.get(w) ?? new Map<string, WorkloadPart>(); byWeek.set(w, byItem);
        const part = byItem.get(item.id) ?? { itemId: item.id, name: item.name, projectName: project.get(item.project_id) ?? '', hours: 0 };
        part.hours += perDayPerUser; byItem.set(item.id, part);
      }
    }
  }

  const rows: WorkloadRow[] = userIds.map(userId => {
    const perWeek = capacityOf.get(userId) ?? DEFAULT_CAPACITY;
    const cells = weeks.map((weekStart, w) => {
      const ws = dayToNumber(weekStart);
      let workingDays = 0;
      for (let d = 0; d < 5; d++) if (isWorking(ws + d)) workingDays++;
      const capacity = perWeek * workingDays / 5;
      const h = hours.get(userId)?.[w] ?? 0;
      const list = [...(parts.get(userId)?.get(w)?.values() ?? [])].sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name, 'fr'));
      return { weekStart, hours: h, capacity, level: levelOf(h, capacity), parts: list };
    });
    return { userId, capacityPerWeek: perWeek, cells };
  });
  unestimated.sort((a, b) => a.projectName.localeCompare(b.projectName, 'fr') || a.name.localeCompare(b.name, 'fr'));
  return { weeks, rows, unestimated };
}
