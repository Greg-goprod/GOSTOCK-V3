import { dayToNumber, numberToDay } from './timelineMath';
import { TYPE_LABEL, TYPE_ORDER, type CpItem, type GanttData, type ItemKind, type ProjectType, type StatusFamily } from './pilote';

// Modèle du Gantt (sans affichage) : arbre programme → projet → phase → tâche → sous-tâche, regroupement, dates des parents
// calculées à partir de leurs enfants, avancement (éléments terminés / éléments comptés), éléments sans date.
export type Grouping = 'program' | 'status' | 'type';
export type RowKind = 'group' | 'program' | 'project' | ItemKind;

export interface GanttRow {
  key: string;
  kind: RowKind;
  id: string | null;            // identifiant du programme, du projet ou de l'élément (null pour un groupe)
  projectId: string | null;     // projet de la ligne (projet et éléments)
  parentId: string | null;      // parent de l'élément (null : directement sous le projet)
  level: number;
  name: string;
  color: string;
  start: string | null;         // dates effectives : propres, sinon calculées sur les enfants
  end: string | null;
  partial: boolean;             // une seule des deux dates est connue : repère d'un jour
  family: StatusFamily | null;
  done: number;                 // éléments terminés / éléments comptés (les annulés ne comptent pas)
  total: number;
  hasChildren: boolean;
  parentKey: string | null;
}

export interface GanttModel {
  rows: GanttRow[];             // toutes les lignes, dans l'ordre d'affichage
  expandable: string[];         // clés des lignes qui ont des enfants
  range: { min: string; max: string } | null;
}

const byText = (a: string, b: string) => a.localeCompare(b, 'fr');
const cmpDate = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1);

interface Node { row: GanttRow; children: Node[] }

// Dates effectives d'une ligne : ses dates si elle en a, sinon le plus petit début / plus grand fin des enfants
function resolve(node: Node, ownStart: string | null, ownEnd: string | null) {
  const kids = node.children.map(c => c.row);
  const starts = kids.map(k => k.start).filter((x): x is string => !!x);
  const ends = kids.map(k => k.end).filter((x): x is string => !!x);
  let start = ownStart ?? (starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null);
  let end = ownEnd ?? (ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null);
  const partial = (start === null) !== (end === null);
  if (partial) { start = start ?? end; end = end ?? start; }
  node.row.start = start; node.row.end = end; node.row.partial = partial;
}

function sum(node: Node) {
  node.row.done = node.children.reduce((n, c) => n + c.row.done, 0);
  node.row.total = node.children.reduce((n, c) => n + c.row.total, 0);
}

// Une feuille compte pour 1 (terminée si sa famille est « Terminé ») ; un élément annulé ne compte pas
const leafCount = (family: StatusFamily | null) => ({ done: family === 'done' ? 1 : 0, total: family === 'cancelled' ? 0 : 1 });

export function buildGantt(data: GanttData, grouping: Grouping): GanttModel {
  const family = new Map(data.statuses.map(s => [s.id, s.family]));
  const itemsByProject = new Map<string, CpItem[]>();
  for (const it of data.items) { const l = itemsByProject.get(it.project_id) ?? []; l.push(it); itemsByProject.set(it.project_id, l); }
  const orderItems = (a: CpItem, b: CpItem) => a.position - b.position || cmpDate(a.starts_on, b.starts_on) || byText(a.name, b.name);

  const itemNodes = (projectId: string, color: string, parentId: string | null, level: number, parentKey: string, pool: CpItem[]): Node[] =>
    pool.filter(i => i.parent_id === parentId).sort(orderItems).map(it => {
      const key = `i:${it.id}`;
      const node: Node = { row: {
        key, kind: it.kind, id: it.id, projectId, parentId: it.parent_id, level, name: it.name, color, start: null, end: null, partial: false,
        family: family.get(it.status_id) ?? 'not_started', done: 0, total: 0, hasChildren: false, parentKey,
      }, children: [] };
      node.children = itemNodes(projectId, color, it.id, level + 1, key, pool);
      node.row.hasChildren = node.children.length > 0;
      const milestoneDay = it.kind === 'milestone' ? it.ends_on ?? it.starts_on : null;
      resolve(node, milestoneDay ?? it.starts_on, milestoneDay ?? it.ends_on);
      if (node.children.length) sum(node); else Object.assign(node.row, leafCount(node.row.family));
      return node;
    });

  const projectNode = (p: GanttData['projects'][number], level: number, parentKey: string): Node => {
    const key = `p:${p.id}`;
    const pool = itemsByProject.get(p.id) ?? [];
    const node: Node = { row: {
      key, kind: 'project', id: p.id, projectId: p.id, parentId: null, level, name: p.name, color: p.color, start: null, end: null, partial: false,
      family: family.get(p.status_id) ?? 'not_started', done: 0, total: 0, hasChildren: false, parentKey,
    }, children: itemNodes(p.id, p.color, null, level + 1, key, pool) };
    node.row.hasChildren = node.children.length > 0;
    resolve(node, p.starts_on, p.ends_on);
    if (node.children.length) sum(node); else Object.assign(node.row, leafCount(node.row.family));
    return node;
  };

  const group = (key: string, kind: 'group' | 'program', id: string | null, name: string, color: string, ownStart: string | null, ownEnd: string | null, children: Node[]): Node => {
    const node: Node = { row: {
      key, kind, id, projectId: null, parentId: null, level: 0, name, color, start: null, end: null, partial: false, family: null, done: 0, total: 0,
      hasChildren: children.length > 0, parentKey: null,
    }, children };
    resolve(node, ownStart, ownEnd);
    sum(node);
    return node;
  };

  // Projets triés sur leur début effectif (propre, sinon calculé sur leurs éléments), puis par nom
  const projectNodes = (list: GanttData['projects'], parentKey: string): Node[] =>
    list.map(p => projectNode(p, 1, parentKey)).sort((a, b) => cmpDate(a.row.start, b.row.start) || byText(a.row.name, b.row.name));
  const roots: Node[] = [];
  if (grouping === 'program') {
    for (const pg of [...data.programs].sort((a, b) => byText(a.name, b.name))) {
      const projects = data.projects.filter(p => p.program_id === pg.id);
      if (projects.length) roots.push(group(`g:${pg.id}`, 'program', pg.id, pg.name, pg.color, pg.starts_on, pg.ends_on, projectNodes(projects, `g:${pg.id}`)));
    }
    const free = data.projects.filter(p => !p.program_id);
    if (free.length) roots.push(group('g:none', 'group', null, 'Sans programme', '#94a3b8', null, null, projectNodes(free, 'g:none')));
  } else if (grouping === 'status') {
    for (const st of [...data.statuses].sort((a, b) => a.position - b.position || byText(a.name, b.name))) {
      const projects = data.projects.filter(p => p.status_id === st.id);
      if (projects.length) roots.push(group(`g:${st.id}`, 'group', st.id, st.name, st.color, null, null, projectNodes(projects, `g:${st.id}`)));
    }
  } else {
    for (const t of TYPE_ORDER as ProjectType[]) {
      const projects = data.projects.filter(p => p.type === t);
      if (projects.length) roots.push(group(`g:${t}`, 'group', t, TYPE_LABEL[t], '#64748b', null, null, projectNodes(projects, `g:${t}`)));
    }
  }

  const rows: GanttRow[] = [];
  const walk = (n: Node) => { rows.push(n.row); n.children.forEach(walk); };
  roots.forEach(walk);
  const dates = rows.flatMap(r => [r.start, r.end]).filter((d): d is string => !!d).sort();
  return {
    rows,
    expandable: rows.filter(r => r.hasChildren).map(r => r.key),
    range: dates.length ? { min: dates[0], max: dates[dates.length - 1] } : null,
  };
}

// Lignes affichées : une ligne n'apparaît que si tous ses parents sont dépliés
export function visibleRows(model: GanttModel, expanded: ReadonlySet<string>): GanttRow[] {
  const byKey = new Map(model.rows.map(r => [r.key, r]));
  const shown = (r: GanttRow): boolean => r.parentKey === null || (expanded.has(r.parentKey) && shown(byKey.get(r.parentKey)!));
  return model.rows.filter(shown);
}

// Ouverture sur 2 niveaux : les groupes (et programmes) sont dépliés, les projets repliés
export const defaultExpanded = (model: GanttModel): Set<string> => new Set(model.rows.filter(r => r.kind === 'group' || r.kind === 'program').map(r => r.key));

// Éléments et projets sans aucune date (bac « Sans date »)
export const undatedRows = (model: GanttModel): GanttRow[] => model.rows.filter(r => (r.kind !== 'group' && r.kind !== 'program') && r.start === null);

export const progressOf = (r: Pick<GanttRow, 'done' | 'total'>): number | null => (r.total > 0 ? r.done / r.total : null);

/* ---------------------------------------------------------------- échelle de temps (en jours) */
export type Zoom = 'week' | 'month' | 'quarter' | 'year';
export const PX_PER_DAY: Record<Zoom, number> = { week: 44, month: 24, quarter: 9, year: 2.6 };
const MIN_DAYS: Record<Zoom, number> = { week: 70, month: 130, quarter: 260, year: 520 };

export interface Scale { startDay: number; days: number; px: number; zoom: Zoom }

const mondayOfNumber = (n: number) => n - ((new Date(n * 86_400_000).getUTCDay() + 6) % 7);

// Fenêtre affichée : les dates du plan et aujourd'hui, avec de la marge, alignée sur des lundis
export function makeScale(range: { min: string; max: string } | null, today: string, zoom: Zoom): Scale {
  const t = dayToNumber(today);
  const lo = Math.min(range ? dayToNumber(range.min) : t, t) - 14;
  const hi = Math.max(range ? dayToNumber(range.max) : t, t) + 28;
  const startDay = mondayOfNumber(lo);
  let days = hi - startDay + 1;
  if (days < MIN_DAYS[zoom]) days = MIN_DAYS[zoom];
  days = Math.ceil(days / 7) * 7;
  return { startDay, days, px: PX_PER_DAY[zoom], zoom };
}

export const xOfDay = (s: Scale, day: string | number) => ((typeof day === 'number' ? day : dayToNumber(day)) - s.startDay) * s.px;
// Une barre couvre les jours de début et de fin inclus
export const barBox = (s: Scale, start: string, end: string) => ({ left: xOfDay(s, start), width: Math.max((dayToNumber(end) - dayToNumber(start) + 1) * s.px, 3) });
export const isWeekend = (n: number) => { const d = new Date(n * 86_400_000).getUTCDay(); return d === 0 || d === 6; };
export const weekendBoxes = (s: Scale): { left: number; width: number }[] => {
  const out: { left: number; width: number }[] = [];
  for (let i = 0; i < s.days; i++) {
    const n = s.startDay + i;
    if (new Date(n * 86_400_000).getUTCDay() === 6) out.push({ left: i * s.px, width: Math.min(2, s.days - i) * s.px });
  }
  return out;
};

export interface HeaderCell { label: string; left: number; width: number }
export interface Header { top: HeaderCell[]; bottom: HeaderCell[] }

// En-tête à deux étages selon le zoom : mois / jours, mois / jours, mois / semaines, année / mois
export function makeHeader(s: Scale, locale: string): Header {
  const top: HeaderCell[] = [], bottom: HeaderCell[] = [];
  const fmt = (n: number, o: Intl.DateTimeFormatOptions) => new Date(n * 86_400_000).toLocaleDateString(locale, { ...o, timeZone: 'UTC' });
  const endDay = s.startDay + s.days;
  const monthStart = (n: number) => { const d = new Date(n * 86_400_000); return Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 86_400_000); };
  const nextMonth = (n: number) => { const d = new Date(n * 86_400_000); return Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 86_400_000); };
  const nextYear = (n: number) => { const d = new Date(n * 86_400_000); return Math.round(Date.UTC(d.getUTCFullYear() + 1, 0, 1) / 86_400_000); };
  const cell = (from: number, to: number, label: string): HeaderCell => {
    const a = Math.max(from, s.startDay), b = Math.min(to, endDay);
    return { label, left: (a - s.startDay) * s.px, width: (b - a) * s.px };
  };
  if (s.zoom === 'year') {
    for (let n = monthStart(s.startDay); n < endDay;) { const next = nextYear(n); top.push(cell(Math.max(n, s.startDay), next, fmt(Math.max(n, s.startDay), { year: 'numeric' }))); n = next; }
    for (let n = monthStart(s.startDay); n < endDay;) { const next = nextMonth(n); bottom.push(cell(n, next, fmt(n, { month: 'short' }))); n = next; }
  } else {
    for (let n = monthStart(s.startDay); n < endDay;) { const next = nextMonth(n); top.push(cell(n, next, fmt(Math.max(n, s.startDay), { month: 'long', year: 'numeric' }))); n = next; }
    if (s.zoom === 'quarter') {
      for (let n = s.startDay; n < endDay; n += 7) bottom.push(cell(n, n + 7, fmt(n, { day: 'numeric', month: 'numeric' })));
    } else {
      for (let n = s.startDay; n < endDay; n++) bottom.push(cell(n, n + 1, s.zoom === 'week' ? `${fmt(n, { weekday: 'narrow' })} ${fmt(n, { day: 'numeric' })}` : fmt(n, { day: 'numeric' })));
    }
  }
  return { top, bottom };
}

export const dayNumberOf = dayToNumber;
export const dayFromNumber = numberToDay;
