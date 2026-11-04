import { supabase } from './supabase';

// PILOTE : projets, états et responsables. Les règles (même entreprise, lien chantier, dates…) sont vérifiées par la base.
export type StatusFamily = 'not_started' | 'in_progress' | 'done' | 'cancelled';
export type ProjectType = 'site' | 'rd' | 'design' | 'recruitment' | 'admin' | 'event';
export type ProjectPriority = 'low' | 'medium' | 'high';
// Réglage des dépendances d'un projet : décaler seulement si les dates se chevauchent, garder l'intervalle, ou ne rien décaler
export type LinkMode = 'overlap' | 'keep_gap' | 'none';
export const LINK_MODE_LABEL: Record<LinkMode, string> = {
  overlap: 'Seulement si les dates se chevauchent', keep_gap: 'Garder l\'intervalle entre les éléments', none: 'Ne pas décaler automatiquement',
};

export interface CpStatus { id: string; name: string; family: StatusFamily; color: string; position: number; is_system: boolean }
export interface CpProject {
  id: string; site_id: string | null; type: ProjectType; name: string; description: string | null;
  status_id: string; priority: ProjectPriority | null; color: string; starts_on: string | null; ends_on: string | null;
  link_mode: LinkMode; link_skip_weekends: boolean; updated_at?: string;
}
// Équipe d'un projet : « responsable » (lead) ou « membre ». Une tâche ne s'assigne qu'à quelqu'un de l'équipe.
export type TeamRole = 'lead' | 'member';
export const TEAM_ROLE_LABEL: Record<TeamRole, string> = { lead: 'Responsable', member: 'Membre' };
export interface CpMember { project_id: string; user_id: string; role: TeamRole }

// Éléments d'un projet (niveaux 3 à 5) : phase, tâche, jalon, sous-tâche
export type ItemKind = 'phase' | 'task' | 'milestone' | 'subtask';
export interface CpItem {
  id: string; project_id: string; parent_id: string | null; kind: ItemKind; name: string; description: string | null;
  status_id: string; priority: ProjectPriority | null; starts_on: string | null; ends_on: string | null; position: number;
  updated_at?: string;   // sert à repérer une modification faite entre-temps par quelqu'un d'autre (voir updateIfUnchanged)
}
export interface CpItemMember { item_id: string; user_id: string }
// « Le successeur commence après la fin du prédécesseur »
export interface CpLink { id: string; project_id: string; predecessor_id: string; successor_id: string }
export interface CpItemCheck { id: string; item_id: string; label: string; done: boolean; position: number }

export const ITEM_KIND_LABEL: Record<ItemKind, string> = { phase: 'Phase', task: 'Tâche', milestone: 'Jalon', subtask: 'Sous-tâche' };

// Nombre d'éléments qui disparaîtront avec celui-ci (ses enfants, petits-enfants…)
export const descendantsOf = (items: CpItem[], id: string): number => {
  const kids = items.filter(i => i.parent_id === id);
  return kids.reduce((n, k) => n + 1 + descendantsOf(items, k.id), 0);
};

// Ce que la base accepte (migration 49) : types possibles selon le parent (null = directement sous le projet)
export const allowedKinds = (parentKind: ItemKind | null): ItemKind[] =>
  parentKind === null ? ['phase', 'task', 'milestone'] : parentKind === 'phase' ? ['task', 'milestone'] : parentKind === 'task' ? ['subtask'] : [];
// Parents possibles pour un type : phase → aucun (sous le projet) ; tâche ou jalon → aucun ou une phase ; sous-tâche → une tâche
export const parentKindsFor = (kind: ItemKind): (ItemKind | null)[] => (kind === 'phase' ? [null] : kind === 'subtask' ? ['task'] : [null, 'phase']);
export interface CpSite { id: string; name: string; status: 'open' | 'closed' }

export const FAMILY_LABEL: Record<StatusFamily, string> = {
  not_started: 'Pas commencé', in_progress: 'En cours', done: 'Terminé', cancelled: 'Annulé',
};
export const FAMILY_ORDER: StatusFamily[] = ['not_started', 'in_progress', 'done', 'cancelled'];
// Palette proposée pour la couleur d'un état : 10 teintes lisibles sur fond clair comme sombre
export const STATE_COLORS = ['#6b7280', '#3b82f6', '#0ea5e9', '#10b981', '#84cc16', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#a16207'];
export const TYPE_LABEL: Record<ProjectType, string> = {
  site: 'Chantier', rd: 'R&D', design: 'Conception', recruitment: 'Recrutement', admin: 'Administratif', event: 'Évènement',
};
export const TYPE_ORDER: ProjectType[] = ['site', 'rd', 'design', 'recruitment', 'admin', 'event'];
export const PRIORITY_LABEL: Record<ProjectPriority, string> = { low: 'Basse', medium: 'Moyenne', high: 'Haute' };

export interface PiloteData {
  statuses: CpStatus[];
  projects: CpProject[];
  members: CpMember[];
  sites: CpSite[];
}

// Données du Gantt : tout PiloteData, plus les éléments et leurs responsables (la liste à cocher se lit à l'ouverture d'une fiche)
export interface GanttData extends PiloteData {
  items: CpItem[];
  itemMembers: CpItemMember[];
  links: CpLink[];
}

export async function loadPilote(): Promise<PiloteData> {
  const [statuses, projects, members, sites] = await Promise.all([
    supabase.from('cp_statuses').select('*').order('position').order('name'),
    supabase.from('cp_projects').select('*').order('starts_on', { nullsFirst: false }).order('name'),
    supabase.from('cp_project_members').select('project_id, user_id, role'),
    supabase.from('sites').select('id, name, status').order('name'),
  ]);
  const error = [statuses, projects, members, sites].map(r => r.error).find(Boolean);
  if (error) throw error;
  return {
    statuses: (statuses.data || []) as CpStatus[],
    projects: (projects.data || []) as CpProject[],
    members: (members.data || []) as CpMember[],
    sites: (sites.data || []) as CpSite[],
  };
}

export async function loadGantt(): Promise<GanttData> {
  const [base, items, itemMembers, links] = await Promise.all([
    loadPilote(),
    supabase.from('cp_items').select('*').order('position').order('starts_on', { nullsFirst: false }).order('name'),
    supabase.from('cp_item_members').select('item_id, user_id'),
    supabase.from('cp_item_links').select('id, project_id, predecessor_id, successor_id'),
  ]);
  const error = [items, itemMembers, links].map(r => r.error).find(Boolean);
  if (error) throw error;
  return { ...base, items: (items.data || []) as CpItem[], itemMembers: (itemMembers.data || []) as CpItemMember[], links: (links.data || []) as CpLink[] };
}

export interface PiloteRights { create: boolean; update: boolean; delete: boolean }

// Droits fins (clés « cp.projects:… », comme Mannyx) : la base répond, l'écran ne fait que masquer ce qui serait refusé
export async function loadPiloteRights(): Promise<PiloteRights> {
  const ask = async (action: 'create' | 'update' | 'delete') => {
    const { data, error } = await supabase.rpc('rbac_has_any_permission', { p_keys: [`cp.projects:${action}`] });
    return !error && data === true;
  };
  const [create, update, del] = await Promise.all([ask('create'), ask('update'), ask('delete')]);
  return { create, update, delete: del };
}

export const piloteError = (error: unknown): string => {
  const e = error as { code?: string; message?: string } | null;
  if (e?.message?.includes('équipe du projet')) return 'Cette personne ne fait pas partie de l\'équipe du projet : ajoute-la d\'abord à l\'équipe';
  if (e?.code === '23503') return 'Impossible : cet élément est encore utilisé';
  if (e?.code === '23505') return e.message?.includes('cp_projects_site_key') ? 'Ce chantier a déjà un projet' : 'Ce nom existe déjà';
  return e?.message || 'Une erreur est survenue';
};

// Deux personnes ouvrent la même fiche : la seconde à enregistrer ne doit pas écraser en silence les changements de la première.
// On enregistre « seulement si la ligne n'a pas changé depuis l'ouverture » (même updated_at) : c'est la base qui tranche, en une seule
// requête, sans course possible. Sinon rien n'est modifié et on le dit.
export const CONFLICT_MESSAGE = 'Cette fiche a été modifiée par quelqu\'un d\'autre depuis son ouverture. Elle vient d\'être rechargée : rouvre-la, regarde ses changements, puis refais ta modification.';
export const GONE_MESSAGE = 'Cette fiche n\'existe plus (supprimée par quelqu\'un d\'autre).';
// Vrai si l'erreur est un conflit (ou une suppression) : l'appelant ferme la fiche et recharge les données, sinon on rouvrirait la même version périmée
export const isConflict = (error: unknown): boolean => error instanceof Error && (error.message === CONFLICT_MESSAGE || error.message === GONE_MESSAGE);
export async function updateIfUnchanged(table: 'cp_items' | 'cp_projects', id: string, version: string | null | undefined, payload: Record<string, unknown>): Promise<void> {
  let query = supabase.from(table).update(payload).eq('id', id);
  if (version) query = query.eq('updated_at', version);
  const { data, error } = await query.select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const still = await supabase.from(table).select('id').eq('id', id).maybeSingle();
    throw new Error(still.data ? CONFLICT_MESSAGE : GONE_MESSAGE);
  }
}

// Copie un projet (arborescence, dépendances, liste à cocher, dates décalées) en une seule requête ; renvoie l'identifiant de la copie.
// Les droits et l'isolation entre entreprises sont ceux de la personne : la base refuse ce qu'elle n'a pas le droit de créer.
export async function duplicateProject(args: { projectId: string; name: string; newStart: string | null; copyTeam: boolean; copyAssignments: boolean }): Promise<string> {
  const { data, error } = await supabase.rpc('cp_duplicate_project', {
    p_project: args.projectId, p_name: args.name, p_new_start: args.newStart, p_copy_team: args.copyTeam, p_copy_assignments: args.copyAssignments,
  });
  if (error) throw error;
  return data as string;
}

// Met à jour l'équipe d'un projet par différence : seules les personnes retirées sont supprimées (la base les désassigne alors
// de ses tâches), les rôles changés sont modifiés sur place, les nouvelles personnes sont ajoutées. Les autres ne bougent pas.
export async function saveTeam(projectId: string, team: Record<string, TeamRole>): Promise<void> {
  const current = await supabase.from('cp_project_members').select('user_id, role').eq('project_id', projectId);
  if (current.error) throw current.error;
  const before = new Map((current.data || []).map(r => [r.user_id as string, r.role as TeamRole]));
  const removed = [...before.keys()].filter(id => !(id in team));
  if (removed.length > 0) {
    const del = await supabase.from('cp_project_members').delete().eq('project_id', projectId).in('user_id', removed);
    if (del.error) throw del.error;
  }
  for (const [userId, role] of Object.entries(team)) {
    if (before.get(userId) === role) continue;
    const res = before.has(userId)
      ? await supabase.from('cp_project_members').update({ role }).eq('project_id', projectId).eq('user_id', userId)
      : await supabase.from('cp_project_members').insert({ project_id: projectId, user_id: userId, role });
    if (res.error) throw res.error;
  }
}

// Décale un élément ET tout ce qu'il contient du même nombre de jours (en une seule opération de la base, tout ou rien)
export async function shiftItem(itemId: string, days: number): Promise<void> {
  const { error } = await supabase.rpc('cp_shift_item', { p_item_id: itemId, p_days: days });
  if (error) throw error;
}
// Décale un projet (ses dates) et tous ses éléments
export async function shiftProject(projectId: string, days: number): Promise<void> {
  const { error } = await supabase.rpc('cp_shift_project', { p_project_id: projectId, p_days: days });
  if (error) throw error;
}
// Change seulement les dates de cet élément ou de ce projet (bords tirés à la souris ou au clavier)
export async function setDates(kind: 'project' | 'item', id: string, start: string, end: string): Promise<void> {
  const { error } = await supabase.from(kind === 'project' ? 'cp_projects' : 'cp_items').update({ starts_on: start, ends_on: end }).eq('id', id);
  if (error) throw error;
}

// Dépendances : la base refuse les boucles, la parenté et les projets différents (message en français) et décale le successeur si besoin
export async function addLink(predecessorId: string, successorId: string): Promise<void> {
  const { error } = await supabase.from('cp_item_links').insert({ predecessor_id: predecessorId, successor_id: successorId });
  if (error) throw error;
}
export async function removeLink(linkId: string): Promise<void> {
  const { error } = await supabase.from('cp_item_links').delete().eq('id', linkId);
  if (error) throw error;
}

// Remplace les responsables d'un élément
export async function saveItemMembers(itemId: string, userIds: string[]): Promise<void> {
  const del = await supabase.from('cp_item_members').delete().eq('item_id', itemId);
  if (del.error) throw del.error;
  if (userIds.length === 0) return;
  const ins = await supabase.from('cp_item_members').insert(userIds.map(user_id => ({ item_id: itemId, user_id })));
  if (ins.error) throw ins.error;
}

// Famille de l'état d'un projet (pour le regroupement et les compteurs)
export const familyOf = (data: Pick<PiloteData, 'statuses'>, statusId: string): StatusFamily => data.statuses.find(s => s.id === statusId)?.family ?? 'not_started';

export const formatPeriod = (start: string | null, end: string | null, fmt: (d: string | null) => string): string =>
  start && end ? `${fmt(start)} → ${fmt(end)}` : start ? `Dès le ${fmt(start)}` : end ? `Jusqu'au ${fmt(end)}` : 'Sans dates';
