import { supabase } from './supabase';

// Planning de chantier : types et lectures. Les règles (horaires, période, chevauchement…) sont vérifiées par la base.
export interface PlanSite { id: string; name: string; status: 'open' | 'closed'; start_on: string | null; end_on: string | null }
export interface PlanConfig { site_id: string; day_start: string; day_end: string; all_day: boolean; step_minutes: number }
export interface PlanZone { id: string; site_id: string; name: string; color: string; position: number }
export interface PlanTeam { id: string; site_id: string; contractor_id: string | null; name: string; color: string }
export interface PlanPhase { id: string; site_id: string; name: string; start_on: string | null; end_on: string | null; color: string; position: number }
export interface PlanContractor { id: string; name: string; contact_name: string | null; email: string | null; phone: string | null; notes: string | null; active: boolean }
export interface PlanBlockedDay { id: string; site_id: string; day: string; reason: string | null }
export interface PlanIntervention {
  id: string; site_id: string; zone_id: string; team_id: string; phase_id: string | null; title: string;
  starts_at: string; ends_at: string; notes: string | null; series_id: string | null;
}

export interface PlanNeed { id: string; intervention_id: string; equipment_id: string; quantity: number }
export interface MaterialIssue { intervention_id: string; equipment_id: string; equipment_name: string; needed: number; available: number; shortage: number }

export const DEFAULT_CONFIG = { day_start: '07:00:00', day_end: '19:00:00', all_day: false, step_minutes: 15 };

export interface SitePlanningData {
  config: PlanConfig | null;
  zones: PlanZone[];
  teams: PlanTeam[];
  phases: PlanPhase[];
  contractors: PlanContractor[];
  blockedDays: PlanBlockedDay[];
  interventions: PlanIntervention[];
  needs: PlanNeed[];
  issues: MaterialIssue[];
}

export async function loadOpenSites(): Promise<PlanSite[]> {
  const { data, error } = await supabase.from('sites').select('id, name, status, start_on, end_on').order('name');
  if (error) throw error;
  return (data || []) as PlanSite[];
}

export async function loadSitePlanning(siteId: string): Promise<SitePlanningData> {
  const [config, zones, teams, phases, contractors, blocked, interventions, needs, issues] = await Promise.all([
    supabase.from('cp_site_config').select('*').eq('site_id', siteId).maybeSingle(),
    supabase.from('cp_site_zones').select('*').eq('site_id', siteId).order('position').order('name'),
    supabase.from('cp_site_teams').select('*').eq('site_id', siteId).order('name'),
    supabase.from('cp_site_phases').select('*').eq('site_id', siteId).order('position').order('name'),
    supabase.from('cp_contractors').select('*').order('name'),
    supabase.from('cp_site_blocked_days').select('*').eq('site_id', siteId).order('day'),
    supabase.from('cp_site_interventions').select('*').eq('site_id', siteId).order('starts_at'),
    supabase.from('cp_site_intervention_needs').select('id, intervention_id, equipment_id, quantity, cp_site_interventions!inner(site_id)').eq('cp_site_interventions.site_id', siteId),
    supabase.rpc('cp_site_material_issues', { p_site_id: siteId }),
  ]);
  // Les avertissements de matériel ne bloquent jamais l'affichage du planning
  const error = [config, zones, teams, phases, contractors, blocked, interventions, needs].map(r => r.error).find(Boolean);
  if (error) throw error;
  return {
    config: (config.data as PlanConfig | null) ?? null,
    zones: (zones.data || []) as PlanZone[],
    teams: (teams.data || []) as PlanTeam[],
    phases: (phases.data || []) as PlanPhase[],
    contractors: (contractors.data || []) as PlanContractor[],
    blockedDays: (blocked.data || []) as PlanBlockedDay[],
    interventions: (interventions.data || []) as PlanIntervention[],
    needs: ((needs.data || []) as (PlanNeed & { cp_site_interventions?: unknown })[]).map(n => ({ id: n.id, intervention_id: n.intervention_id, equipment_id: n.equipment_id, quantity: Number(n.quantity) })),
    issues: issues.error ? [] : ((issues.data || []) as MaterialIssue[]).map(i => ({ ...i, needed: Number(i.needed), available: Number(i.available), shortage: Number(i.shortage) })),
  };
}

export interface PlanningRights { create: boolean; update: boolean; delete: boolean }

// Droits fins du module (clés « cp.planning:… », comme Mannyx) : la base répond, l'écran ne fait que masquer ce qui serait refusé
export async function loadPlanningRights(): Promise<PlanningRights> {
  const ask = async (action: 'create' | 'update' | 'delete') => {
    const { data, error } = await supabase.rpc('rbac_has_any_permission', { p_keys: [`cp.planning:${action}`] });
    return !error && data === true;
  };
  const [create, update, del] = await Promise.all([ask('create'), ask('update'), ask('delete')]);
  return { create, update, delete: del };
}

// Une erreur de clé étrangère (élément encore utilisé) devient une phrase claire ; les contrôles de la base sont déjà en français
export const planningError = (error: unknown): string => {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === '23503') return 'Impossible : des interventions utilisent encore cet élément';
  if (e?.code === '23505') return 'Ce nom existe déjà';
  return e?.message || 'Une erreur est survenue';
};

export const ZONE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];

// Premier jour utile du chantier : aujourd'hui s'il est dans la période, sinon le bord le plus proche
export const firstUsefulDay = (site: Pick<PlanSite, 'start_on' | 'end_on'>): string => {
  const today = new Date().toISOString().slice(0, 10);
  return site.start_on && today < site.start_on ? site.start_on : site.end_on && today > site.end_on ? site.end_on : today;
};


export interface NeedInput { equipment_id: string; quantity: number }

// Remplace le matériel nécessaire d'une intervention
export async function saveNeeds(interventionId: string, needs: NeedInput[]): Promise<void> {
  const del = await supabase.from('cp_site_intervention_needs').delete().eq('intervention_id', interventionId);
  if (del.error) throw del.error;
  if (needs.length === 0) return;
  const ins = await supabase.from('cp_site_intervention_needs').insert(needs.map(n => ({ intervention_id: interventionId, equipment_id: n.equipment_id, quantity: n.quantity })));
  if (ins.error) throw ins.error;
}

export interface SeriesInput {
  site_id: string; zone_id: string; team_id: string; phase_id: string | null; title: string; notes: string | null;
  first_day: string; last_day: string; weekdays: number[]; start: string; end: string; end_day_offset: number; needs: NeedInput[];
}

// Tout ou rien : la base crée toute la série ou rien, et nomme la date refusée
export async function createSeries(input: SeriesInput): Promise<{ created: number; skipped_blocked: number }> {
  const { data, error } = await supabase.rpc('cp_create_intervention_series', {
    p_site_id: input.site_id, p_zone_id: input.zone_id, p_team_id: input.team_id, p_phase_id: input.phase_id, p_title: input.title, p_notes: input.notes,
    p_first_day: input.first_day, p_last_day: input.last_day, p_weekdays: input.weekdays, p_start: input.start, p_end: input.end,
    p_end_day_offset: input.end_day_offset, p_needs: input.needs,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { created: number; skipped_blocked: number };
  return { created: Number(row.created), skipped_blocked: Number(row.skipped_blocked) };
}

export async function copyDay(siteId: string, fromDay: string, toDays: string[]): Promise<{ created: number; skipped_blocked: number }> {
  const { data, error } = await supabase.rpc('cp_copy_interventions_day', { p_site_id: siteId, p_from_day: fromDay, p_to_days: toDays });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { created: number; skipped_blocked: number };
  return { created: Number(row.created), skipped_blocked: Number(row.skipped_blocked) };
}

export const WEEKDAYS = [{ n: 1, label: 'Lun' }, { n: 2, label: 'Mar' }, { n: 3, label: 'Mer' }, { n: 4, label: 'Jeu' }, { n: 5, label: 'Ven' }, { n: 6, label: 'Sam' }, { n: 7, label: 'Dim' }];

// Jours « AAAA-MM-JJ » d'un intervalle dont le jour de la semaine (1 = lundi) est choisi
export const daysInRange = (first: string, last: string, weekdays: number[]): string[] => {
  const out: string[] = [];
  const a = Date.UTC(+first.slice(0, 4), +first.slice(5, 7) - 1, +first.slice(8, 10)), b = Date.UTC(+last.slice(0, 4), +last.slice(5, 7) - 1, +last.slice(8, 10));
  for (let t = a; t <= b && out.length < 400; t += 86_400_000) {
    const d = new Date(t);
    if (weekdays.includes(((d.getUTCDay() + 6) % 7) + 1)) out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

// « Échafaudage : 2 demandé(s), 0 disponible(s) à ce moment »
export const issueText = (i: MaterialIssue): string => `${i.equipment_name} : ${i.needed} demandé(s), ${i.available} disponible(s) à ce moment`;
