import { supabase } from './supabase';

// Matériel et véhicules rattachés à une tâche, avec avertissement de disponibilité (sans affichage).
// La base répond (cp_resource_issues) : elle AVERTIT, ne bloque rien et ne réserve rien dans Logistique.
export interface CpResource {
  id: string; item_id: string; kind: 'equipment' | 'vehicle'; equipment_id: string | null; vehicle_id: string | null;
  quantity: number; note: string | null; name: string; detail: string;
}
export interface ResourceIssue {
  resource_id: string; item_id: string; kind: 'equipment' | 'vehicle'; ref_id: string; name: string; needed: number; available: number; reason: string | null;
}
export interface EquipmentChoice { id: string; name: string; total_quantity: number | null; status: string }
export interface VehicleChoice { id: string; name: string; plate: string; status: string }

export const MAX_QUANTITY = 9999;

// Lecture tolérante : tant que la migration du matériel des tâches n'est pas appliquée, la fonction n'existe pas → aucun avertissement
export async function loadResourceIssues(itemId?: string): Promise<ResourceIssue[]> {
  const { data, error } = await supabase.rpc('cp_resource_issues', itemId ? { p_item: itemId } : {});
  return error ? [] : ((data || []) as ResourceIssue[]);
}

type Raw = { id: string; item_id: string; kind: 'equipment' | 'vehicle'; equipment_id: string | null; vehicle_id: string | null; quantity: number; note: string | null;
  equipment?: { name: string; total_quantity: number | null } | null; vehicle?: { name: string; plate: string } | null };

// Ressources d'un élément, avec le nom de l'article ou du véhicule
export async function loadItemResources(itemId: string): Promise<CpResource[]> {
  const { data, error } = await supabase.from('cp_item_resources')
    .select('id, item_id, kind, equipment_id, vehicle_id, quantity, note, equipment:equipment_id(name, total_quantity), vehicle:vehicle_id(name, plate)')
    .eq('item_id', itemId).order('created_at');
  if (error) throw error;
  return ((data || []) as unknown as Raw[]).map(r => ({
    id: r.id, item_id: r.item_id, kind: r.kind, equipment_id: r.equipment_id, vehicle_id: r.vehicle_id, quantity: Number(r.quantity), note: r.note,
    name: r.kind === 'equipment' ? r.equipment?.name ?? 'Article supprimé' : r.vehicle?.name ?? 'Véhicule supprimé',
    detail: r.kind === 'equipment' ? (r.equipment?.total_quantity != null ? `${r.equipment.total_quantity} en stock` : '') : r.vehicle?.plate ?? '',
  }));
}

// « % » et « _ » sont des jokers de recherche, les virgules et parenthèses cassent le filtre « or » : on les neutralise
const likePattern = (q: string) => `%${q.trim().replace(/[%_\\,()]/g, ' ').replace(/\s+/g, ' ').trim()}%`;

export async function searchEquipment(query: string): Promise<EquipmentChoice[]> {
  if (query.trim().length < 2) return [];
  const { data, error } = await supabase.from('equipment').select('id, name, total_quantity, status').neq('status', 'retired').ilike('name', likePattern(query)).order('name').limit(8);
  if (error) throw error;
  return (data || []) as EquipmentChoice[];
}
export async function searchVehicles(query: string): Promise<VehicleChoice[]> {
  const q = likePattern(query);
  const base = supabase.from('vehicles').select('id, name, plate, status').neq('status', 'retired').order('name').limit(8);
  const { data, error } = await (query.trim().length < 2 ? base : base.or(`name.ilike.${q},plate.ilike.${q}`));
  if (error) throw error;
  return (data || []) as VehicleChoice[];
}

export async function addResource(itemId: string, kind: 'equipment' | 'vehicle', refId: string): Promise<void> {
  const { error } = await supabase.from('cp_item_resources').insert({ item_id: itemId, kind, equipment_id: kind === 'equipment' ? refId : null, vehicle_id: kind === 'vehicle' ? refId : null, quantity: 1 });
  if (error) throw error;
}
export async function setResourceQuantity(id: string, quantity: number): Promise<void> {
  const { error } = await supabase.from('cp_item_resources').update({ quantity }).eq('id', id);
  if (error) throw error;
}
export async function removeResource(id: string): Promise<void> {
  const { error } = await supabase.from('cp_item_resources').delete().eq('id', id);
  if (error) throw error;
}

export const resourceError = (error: unknown): string => {
  const e = error as { code?: string; message?: string } | null;
  const m = e?.message ?? '';
  if (e?.code === '23505') return 'Déjà rattaché à cette tâche : modifie sa quantité';
  if (e?.code === '42501' || /row-level security|permission denied/i.test(m)) return "Tu n'as pas le droit de modifier cette tâche";
  if (e?.code === '23514') return 'Quantité refusée : de 1 à 9 999 (un véhicule : 1)';
  return m || 'Une erreur est survenue';
};

// Lecture d'une quantité saisie : entier de 1 à 9 999
export function parseQuantity(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,4}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= MAX_QUANTITY ? n : null;
}

// Phrase d'un avertissement
export function describeIssue(i: ResourceIssue): string {
  if (i.kind === 'vehicle') return i.reason ?? `${i.name} n'est pas disponible`;
  return `Manque de « ${i.name} » sur la période : ${i.needed} demandé(s), ${i.available} disponible(s)`;
}

// Par élément : les avertissements regroupés en une phrase (infobulle d'une ligne du Gantt)
export function issuesByItem(issues: ResourceIssue[]): Map<string, string> {
  const by = new Map<string, string[]>();
  for (const i of issues) { const l = by.get(i.item_id) ?? []; l.push(describeIssue(i)); by.set(i.item_id, l); }
  return new Map([...by].map(([id, list]) => [id, list.join(' · ')]));
}
