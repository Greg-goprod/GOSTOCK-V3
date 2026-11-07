import { dayToNumber, numberToDay } from './timelineMath';
import { isOverdue } from './ganttFilters';
import type { CpItem, CpProject, CpStatus, GanttData, ItemKind, ProjectPriority, StatusFamily } from './pilote';
import { FAMILY_ORDER } from './pilote';

// Vues « Tableau par état » et « Calendrier » (sans affichage) : mêmes données que le Gantt, autre lecture.

/* ------------------------------------------------------------------ Tableau (kanban) */
export type BoardMode = 'items' | 'projects';

export interface BoardCard {
  key: string;
  id: string;
  kind: 'project' | ItemKind;
  name: string;
  projectId: string;
  projectName: string;
  statusId: string;
  start: string | null;
  end: string | null;
  priority: ProjectPriority | null;
  color: string;
  assignees: string[];     // identifiants des personnes (équipe pour un projet, assignés pour un élément)
  overdue: boolean;
  version?: string;        // updated_at : sert à ne pas écraser une modification faite entre-temps
}
export interface BoardColumn { status: CpStatus; cards: BoardCard[] }

const cmpDate = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1);
// Ordre des colonnes : familles (à faire, en cours, terminé, annulé), puis position et nom dans la famille
export function orderStatuses(statuses: CpStatus[]): CpStatus[] {
  const rank = new Map(FAMILY_ORDER.map((f, i) => [f, i]));
  return [...statuses].sort((a, b) => (rank.get(a.family) ?? 9) - (rank.get(b.family) ?? 9) || a.position - b.position || a.name.localeCompare(b.name, 'fr'));
}

// Une colonne par état (même vide : on peut y déposer une carte), les cartes triées par fin puis par nom
export function buildBoard(data: GanttData, mode: BoardMode, today: string): BoardColumn[] {
  const family = new Map<string, StatusFamily>(data.statuses.map(s => [s.id, s.family]));
  const projectName = new Map(data.projects.map(p => [p.id, p.name]));
  const projectColor = new Map(data.projects.map(p => [p.id, p.color]));
  const itemUsers = new Map<string, string[]>();
  for (const m of data.itemMembers) { const l = itemUsers.get(m.item_id) ?? []; l.push(m.user_id); itemUsers.set(m.item_id, l); }
  const teamUsers = new Map<string, string[]>();
  for (const m of data.members) { const l = teamUsers.get(m.project_id) ?? []; l.push(m.user_id); teamUsers.set(m.project_id, l); }

  const cards: BoardCard[] = mode === 'projects'
    ? data.projects.map((p: CpProject) => ({
      key: `p:${p.id}`, id: p.id, kind: 'project' as const, name: p.name, projectId: p.id, projectName: p.name, statusId: p.status_id, start: p.starts_on, end: p.ends_on,
      priority: p.priority, color: p.color, assignees: teamUsers.get(p.id) ?? [], overdue: isOverdue(p.ends_on, family.get(p.status_id) ?? null, today), version: p.updated_at,
    }))
    : data.items.filter((i: CpItem) => projectName.has(i.project_id)).map((i: CpItem) => ({
      key: `i:${i.id}`, id: i.id, kind: i.kind, name: i.name, projectId: i.project_id, projectName: projectName.get(i.project_id) ?? '', statusId: i.status_id, start: i.starts_on, end: i.ends_on,
      priority: i.priority, color: projectColor.get(i.project_id) ?? '#64748b', assignees: itemUsers.get(i.id) ?? [], overdue: isOverdue(i.ends_on, family.get(i.status_id) ?? null, today), version: i.updated_at,
    }));
  cards.sort((a, b) => cmpDate(a.end, b.end) || a.name.localeCompare(b.name, 'fr'));
  return orderStatuses(data.statuses).map(status => ({ status, cards: cards.filter(c => c.statusId === status.id) }));
}

/* ------------------------------------------------------------------ Calendrier */
export interface CalEvent { key: string; id: string; kind: ItemKind; name: string; start: string; end: string; color: string; family: StatusFamily | null; overdue: boolean; projectName: string }

// Éléments datés à afficher dans le calendrier (les éléments sans date, et ceux d'un projet inconnu, sont ignorés)
export function calendarEvents(data: GanttData, today: string): CalEvent[] {
  const family = new Map<string, StatusFamily>(data.statuses.map(s => [s.id, s.family]));
  const statusColor = new Map(data.statuses.map(s => [s.id, s.color]));
  const projects = new Map(data.projects.map(p => [p.id, p]));
  const out: CalEvent[] = [];
  for (const i of data.items) {
    const p = projects.get(i.project_id);
    if (!p) continue;
    const start = i.starts_on ?? i.ends_on, end = i.ends_on ?? i.starts_on;
    if (!start || !end) continue;
    const fam = family.get(i.status_id) ?? null;
    out.push({ key: i.id, id: i.id, kind: i.kind, name: i.name, start, end: end < start ? start : end, color: statusColor.get(i.status_id) ?? p.color, family: fam, overdue: isOverdue(i.ends_on, fam, today), projectName: p.name });
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.end > b.end ? -1 : a.end < b.end ? 1 : a.name.localeCompare(b.name, 'fr')));
}

// Lundi de la semaine qui contient le jour donné
export function mondayOf(day: string): string {
  const n = dayToNumber(day);
  const wd = new Date(n * 86_400_000).getUTCDay();   // 0 = dimanche
  return numberToDay(n - ((wd + 6) % 7));
}
export const addDays = (day: string, n: number): string => numberToDay(dayToNumber(day) + n);

// Lundis des semaines affichées pour un mois (« AAAA-MM »), de la semaine du 1er à celle du dernier jour
export function monthWeeks(month: string): string[] {
  const first = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const last = numberToDay(Math.round(Date.UTC(y, m, 0) / 86_400_000));   // dernier jour du mois
  const out: string[] = [];
  for (let w = mondayOf(first); w <= last; w = addDays(w, 7)) out.push(w);
  return out;
}
export const shiftMonth = (month: string, delta: number): string => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

export interface WeekBar { event: CalEvent; col: number; span: number; lane: number; continuesLeft: boolean; continuesRight: boolean }
export interface WeekLayout { bars: WeekBar[]; hidden: number[] }   // hidden[col] : nombre d'éléments non affichés ce jour-là (faute de place)

// Place les éléments d'une semaine (7 colonnes) sur des lignes : un élément plus long garde sa ligne d'un bout à l'autre ;
// au-delà de maxLanes lignes, les éléments restants sont comptés par jour (« +n »).
export function layoutWeek(events: CalEvent[], weekStart: string, maxLanes: number): WeekLayout {
  const w0 = dayToNumber(weekStart), w6 = w0 + 6;
  const inWeek = events.filter(e => dayToNumber(e.end) >= w0 && dayToNumber(e.start) <= w6);
  const lanes: number[][] = [];   // lanes[i] = colonnes déjà occupées
  const bars: WeekBar[] = [];
  const hidden = [0, 0, 0, 0, 0, 0, 0];
  for (const event of inWeek) {
    const s = Math.max(dayToNumber(event.start), w0) - w0, e = Math.min(dayToNumber(event.end), w6) - w0;
    let lane = 0;
    while (lane < lanes.length && lanes[lane].some(c => c >= s && c <= e)) lane++;
    if (lane >= maxLanes) { for (let c = s; c <= e; c++) hidden[c]++; continue; }
    if (!lanes[lane]) lanes[lane] = [];
    for (let c = s; c <= e; c++) lanes[lane].push(c);
    bars.push({ event, col: s, span: e - s + 1, lane, continuesLeft: dayToNumber(event.start) < w0, continuesRight: dayToNumber(event.end) > w6 });
  }
  return { bars, hidden };
}
