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

export const DEFAULT_CONFIG = { day_start: '07:00:00', day_end: '19:00:00', all_day: false, step_minutes: 15 };

export interface SitePlanningData {
  config: PlanConfig | null;
  zones: PlanZone[];
  teams: PlanTeam[];
  phases: PlanPhase[];
  contractors: PlanContractor[];
  blockedDays: PlanBlockedDay[];
  interventions: PlanIntervention[];
}

export async function loadOpenSites(): Promise<PlanSite[]> {
  const { data, error } = await supabase.from('sites').select('id, name, status, start_on, end_on').order('name');
  if (error) throw error;
  return (data || []) as PlanSite[];
}

export async function loadSitePlanning(siteId: string): Promise<SitePlanningData> {
  const [config, zones, teams, phases, contractors, blocked, interventions] = await Promise.all([
    supabase.from('site_config').select('*').eq('site_id', siteId).maybeSingle(),
    supabase.from('site_zones').select('*').eq('site_id', siteId).order('position').order('name'),
    supabase.from('site_teams').select('*').eq('site_id', siteId).order('name'),
    supabase.from('site_phases').select('*').eq('site_id', siteId).order('position').order('name'),
    supabase.from('contractors').select('*').order('name'),
    supabase.from('site_blocked_days').select('*').eq('site_id', siteId).order('day'),
    supabase.from('site_interventions').select('*').eq('site_id', siteId).order('starts_at'),
  ]);
  const error = [config, zones, teams, phases, contractors, blocked, interventions].map(r => r.error).find(Boolean);
  if (error) throw error;
  return {
    config: (config.data as PlanConfig | null) ?? null,
    zones: (zones.data || []) as PlanZone[],
    teams: (teams.data || []) as PlanTeam[],
    phases: (phases.data || []) as PlanPhase[],
    contractors: (contractors.data || []) as PlanContractor[],
    blockedDays: (blocked.data || []) as PlanBlockedDay[],
    interventions: (interventions.data || []) as PlanIntervention[],
  };
}

export interface PlanningRights { create: boolean; update: boolean; delete: boolean }

// Droits fins du module (clés « chantiers.planning:… », comme Mannyx) : la base répond, l'écran ne fait que masquer ce qui serait refusé
export async function loadPlanningRights(): Promise<PlanningRights> {
  const ask = async (action: 'create' | 'update' | 'delete') => {
    const { data, error } = await supabase.rpc('rbac_has_any_permission', { p_keys: [`chantiers.planning:${action}`] });
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
