import { supabase } from './supabase';

// PILOTE : programmes, projets, états et responsables. Les règles (même entreprise, lien chantier, dates…) sont vérifiées par la base.
export type StatusFamily = 'not_started' | 'in_progress' | 'done' | 'cancelled';
export type ProjectType = 'site' | 'rd' | 'design' | 'recruitment' | 'admin' | 'event';
export type ProjectPriority = 'low' | 'medium' | 'high';

export interface CpStatus { id: string; name: string; family: StatusFamily; color: string; position: number; is_system: boolean }
export interface CpProgram { id: string; name: string; description: string | null; color: string; starts_on: string | null; ends_on: string | null }
export interface CpProject {
  id: string; program_id: string | null; site_id: string | null; type: ProjectType; name: string; description: string | null;
  status_id: string; priority: ProjectPriority | null; color: string; starts_on: string | null; ends_on: string | null;
}
export interface CpMember { project_id: string; user_id: string }
export interface CpSite { id: string; name: string; status: 'open' | 'closed' }

export const FAMILY_LABEL: Record<StatusFamily, string> = {
  not_started: 'Pas commencé', in_progress: 'En cours', done: 'Terminé', cancelled: 'Annulé',
};
export const FAMILY_ORDER: StatusFamily[] = ['not_started', 'in_progress', 'done', 'cancelled'];
export const TYPE_LABEL: Record<ProjectType, string> = {
  site: 'Chantier', rd: 'R&D', design: 'Conception', recruitment: 'Recrutement', admin: 'Administratif', event: 'Évènement',
};
export const TYPE_ORDER: ProjectType[] = ['site', 'rd', 'design', 'recruitment', 'admin', 'event'];
export const PRIORITY_LABEL: Record<ProjectPriority, string> = { low: 'Basse', medium: 'Moyenne', high: 'Haute' };

export interface PiloteData {
  statuses: CpStatus[];
  programs: CpProgram[];
  projects: CpProject[];
  members: CpMember[];
  sites: CpSite[];
}

export async function loadPilote(): Promise<PiloteData> {
  const [statuses, programs, projects, members, sites] = await Promise.all([
    supabase.from('cp_statuses').select('*').order('position').order('name'),
    supabase.from('cp_programs').select('*').order('name'),
    supabase.from('cp_projects').select('*').order('starts_on', { nullsFirst: false }).order('name'),
    supabase.from('cp_project_members').select('project_id, user_id'),
    supabase.from('sites').select('id, name, status').order('name'),
  ]);
  const error = [statuses, programs, projects, members, sites].map(r => r.error).find(Boolean);
  if (error) throw error;
  return {
    statuses: (statuses.data || []) as CpStatus[],
    programs: (programs.data || []) as CpProgram[],
    projects: (projects.data || []) as CpProject[],
    members: (members.data || []) as CpMember[],
    sites: (sites.data || []) as CpSite[],
  };
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
  if (e?.code === '23503') return 'Impossible : cet élément est encore utilisé';
  if (e?.code === '23505') return e.message?.includes('cp_projects_site_key') ? 'Ce chantier a déjà un projet' : 'Ce nom existe déjà';
  return e?.message || 'Une erreur est survenue';
};

// Remplace les responsables d'un projet
export async function saveMembers(projectId: string, userIds: string[]): Promise<void> {
  const del = await supabase.from('cp_project_members').delete().eq('project_id', projectId);
  if (del.error) throw del.error;
  if (userIds.length === 0) return;
  const ins = await supabase.from('cp_project_members').insert(userIds.map(user_id => ({ project_id: projectId, user_id })));
  if (ins.error) throw ins.error;
}

// Famille de l'état d'un projet (pour le regroupement et les compteurs)
export const familyOf = (data: Pick<PiloteData, 'statuses'>, statusId: string): StatusFamily => data.statuses.find(s => s.id === statusId)?.family ?? 'not_started';

export const formatPeriod = (start: string | null, end: string | null, fmt: (d: string | null) => string): string =>
  start && end ? `${fmt(start)} → ${fmt(end)}` : start ? `Dès le ${fmt(start)}` : end ? `Jusqu'au ${fmt(end)}` : 'Sans dates';
