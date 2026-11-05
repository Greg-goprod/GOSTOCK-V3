import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from './supabase';

// Console de la plateforme : types et lectures (les fonctions de la base vérifient elles-mêmes que la personne est administrateur de la plateforme)
export interface PlatformCompany {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  people: number;
  admins: number;
  modules: string[];
}

export interface PlatformUsage {
  organization_id: string;
  people_active: number;
  last_sign_in: string | null;
  equipment: number;
  checkouts_30d: number;
  storage_bytes: number;
}

// Limite de stockage des documents PILOTE d'une entreprise (quota_bytes null = illimité) et espace réellement utilisé
export interface PlatformQuota {
  organization_id: string;
  quota_bytes: number | null;
  used_bytes: number;
}

export interface PlatformModule {
  key: string;
  label: string;
  description: string;
  position: number;
}

export interface PlatformAuditRow {
  id: string;
  at: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_name: string | null;
  metadata: Record<string, unknown>;
}

export async function loadPlatformData() {
  if (!supabase) throw new Error('Base de données non configurée');
  const [companies, usage, modules, quotas] = await Promise.all([
    supabase.rpc('platform_organizations'),
    supabase.rpc('platform_organization_usage'),
    supabase.from('platform_modules').select('key, label, description, position').order('position'),
    supabase.rpc('platform_storage_quotas'),
  ]);
  const error = companies.error || usage.error || modules.error;
  if (error) throw error;
  return {
    companies: (companies.data || []) as PlatformCompany[],
    usage: (usage.data || []) as PlatformUsage[],
    modules: (modules.data || []) as PlatformModule[],
    // Une erreur (migration 62 pas encore appliquée) n'empêche pas d'afficher la console : simplement pas de limites
    quotas: (quotas.error ? [] : quotas.data || []) as PlatformQuota[],
  };
}

export async function loadPlatformAudit(limit = 200) {
  if (!supabase) throw new Error('Base de données non configurée');
  const { data, error } = await supabase.rpc('platform_audit', { p_limit: limit });
  if (error) throw error;
  return (data || []) as PlatformAuditRow[];
}

// 1 536 000 → « 1,5 Mo »
export const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 Mo';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1).replace('.', ',') : Math.round(mb)} Mo`;
  return `${(mb / 1024).toFixed(1).replace('.', ',')} Go`;
};

// Limite de stockage lisible : « 2 Go », « illimité »
export const formatQuota = (bytes: number | null | undefined): string => (bytes == null ? 'Illimité' : formatBytes(bytes));

export const formatDateTime = (iso: string | null): string => (iso ? format(new Date(iso), 'dd.MM.yyyy HH:mm', { locale: fr }) : '—');

export const AUDIT_LABELS: Record<string, string> = {
  create_company: 'Entreprise créée',
  suspend_company: 'Entreprise suspendue',
  reactivate_company: 'Entreprise réactivée',
  set_storage_quota: 'Limite de stockage modifiée',
  enable_module: 'Module activé',
  disable_module: 'Module retiré',
};
