import type { GanttData, ProjectPriority, ProjectType, StatusFamily } from './pilote';

// Filtres du Gantt (sans affichage) : s'appliquent aux données AVANT la construction de l'arbre, pour que les groupes, les compteurs
// et l'avancement ne comptent que ce qui reste. Une ligne qui correspond garde ses parents (le chemin reste lisible).
export interface GanttFilters {
  query: string;                       // texte cherché dans le nom (et la description)
  userId: string | null;               // personne assignée (élément) ou de l'équipe (projet)
  family: StatusFamily | null;         // famille d'état
  priority: ProjectPriority | null;
  type: ProjectType | null;            // type du projet (s'applique au projet entier)
  overdueOnly: boolean;                // en retard : fin dépassée et ni terminé ni annulé
}

export const NO_FILTERS: GanttFilters = { query: '', userId: null, family: null, priority: null, type: null, overdueOnly: false };

export const hasFilters = (f: GanttFilters): boolean =>
  f.query.trim() !== '' || f.userId !== null || f.family !== null || f.priority !== null || f.type !== null || f.overdueOnly;

// Nombre de critères actifs (pastille du bouton « Filtres »)
export const filterCount = (f: GanttFilters): number =>
  [f.query.trim() !== '', f.userId !== null, f.family !== null, f.priority !== null, f.type !== null, f.overdueOnly].filter(Boolean).length;

// En retard : la date de fin est passée et la ligne n'est ni terminée ni annulée (sans fin, jamais en retard)
export const isOverdue = (endsOn: string | null, family: StatusFamily | null, today: string): boolean =>
  endsOn !== null && endsOn < today && family !== 'done' && family !== 'cancelled';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterGantt(data: GanttData, f: GanttFilters, today: string): GanttData {
  if (!hasFilters(f)) return data;
  const family = new Map(data.statuses.map(s => [s.id, s.family]));
  const q = norm(f.query.trim());
  const itemUsers = new Map<string, Set<string>>();
  for (const m of data.itemMembers) { const s = itemUsers.get(m.item_id) ?? new Set<string>(); s.add(m.user_id); itemUsers.set(m.item_id, s); }
  const teamUsers = new Map<string, Set<string>>();
  for (const m of data.members) { const s = teamUsers.get(m.project_id) ?? new Set<string>(); s.add(m.user_id); teamUsers.set(m.project_id, s); }

  // Critères communs aux projets et aux éléments (hors texte et type, traités à part)
  const common = (status_id: string, priority: ProjectPriority | null, ends_on: string | null, users: Set<string> | undefined) => {
    const fam = family.get(status_id) ?? null;
    if (f.family && fam !== f.family) return false;
    if (f.priority && priority !== f.priority) return false;
    if (f.overdueOnly && !isOverdue(ends_on, fam, today)) return false;
    if (f.userId && !users?.has(f.userId)) return false;
    return true;
  };
  const textOf = (name: string, description: string | null) => norm(`${name} ${description ?? ''}`);

  // Un critère « type » élimine les projets d'un autre type, éléments compris
  const projects = data.projects.filter(p => !f.type || p.type === f.type);
  const keptProjects = new Set<string>();
  const keptItems = new Set<string>();
  // Critères propres aux éléments, sans le texte (qui garde tout un projet quand son nom correspond)
  const itemsByProject = new Map<string, GanttData['items']>();
  for (const it of data.items) { const l = itemsByProject.get(it.project_id) ?? []; l.push(it); itemsByProject.set(it.project_id, l); }
  const parentOf = new Map(data.items.map(i => [i.id, i.parent_id]));

  for (const p of projects) {
    const nameHit = q !== '' && textOf(p.name, p.description).includes(q);
    const projectOnlyHit = common(p.status_id, p.priority, p.ends_on, teamUsers.get(p.id)) && (q === '' || nameHit);
    let any = false;
    for (const it of itemsByProject.get(p.id) ?? []) {
      const textOk = q === '' || nameHit || textOf(it.name, it.description).includes(q);
      if (textOk && common(it.status_id, it.priority, it.ends_on, itemUsers.get(it.id))) {
        any = true;
        // Le chemin jusqu'au projet reste visible
        let cur: string | null = it.id;
        while (cur && !keptItems.has(cur)) { keptItems.add(cur); cur = parentOf.get(cur) ?? null; }
      }
    }
    // Un projet correspond seul (ses propres critères) ou par un de ses éléments ; seul, il n'affiche pas ses éléments non correspondants
    if (projectOnlyHit || any) keptProjects.add(p.id);
  }
  return {
    ...data,
    projects: data.projects.filter(p => keptProjects.has(p.id)),
    items: data.items.filter(i => keptItems.has(i.id)),
    itemMembers: data.itemMembers.filter(m => keptItems.has(m.item_id)),
    links: data.links.filter(l => keptItems.has(l.predecessor_id) && keptItems.has(l.successor_id)),
  };
}

// Vues enregistrées (propres à ce navigateur) : un nom, les filtres et le regroupement
export interface SavedView { id: string; name: string; filters: GanttFilters; grouping: 'status' | 'type' }
export const SAVED_VIEWS_KEY = 'gomat-gantt-views';

export function parseSavedViews(raw: string | null): SavedView[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((v): v is SavedView => !!v && typeof v.id === 'string' && typeof v.name === 'string' && !!v.filters && (v.grouping === 'status' || v.grouping === 'type'))
      .map(v => ({ ...v, filters: { ...NO_FILTERS, ...v.filters } }));
  } catch { return []; }
}
