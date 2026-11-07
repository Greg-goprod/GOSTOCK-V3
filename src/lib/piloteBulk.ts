import { supabase } from './supabase';

// Modifications groupées de PILOTE : une seule requête pour plusieurs éléments ou projets. Les droits et les contrôles sont ceux de la base
// (un élément qu'on n'a pas le droit de modifier n'est pas touché : le nombre renvoyé le montre).
export type BulkTable = 'cp_items' | 'cp_projects';

export async function bulkUpdate(table: BulkTable, ids: string[], patch: Record<string, unknown>): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await supabase.from(table).update(patch).in('id', ids).select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

// Assigne une personne à plusieurs éléments (celles qui le sont déjà sont ignorées) ; la base refuse une personne hors de l'équipe du projet
export async function bulkAssign(itemIds: string[], userId: string): Promise<void> {
  if (itemIds.length === 0) return;
  const { error } = await supabase.from('cp_item_members').upsert(itemIds.map(item_id => ({ item_id, user_id: userId })), { onConflict: 'item_id,user_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function bulkDelete(table: BulkTable, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await supabase.from(table).delete().in('id', ids).select('id');
  if (error) throw error;
  return data?.length ?? 0;
}
