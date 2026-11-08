import { supabase } from './supabase';

// Intervenants externes sans compte (sans affichage) : des noms qu'on peut assigner à une tâche. Ils ne reçoivent aucun avis et n'entrent pas dans la Charge.
export interface CpExternal { id: string; name: string; company: string | null; note: string | null; active: boolean }

export const externalLabel = (e: Pick<CpExternal, 'name' | 'company'>) => (e.company ? `${e.name} (${e.company})` : e.name);

// Lecture tolérante : sans la migration 74 la table n'existe pas → aucun intervenant
export async function loadExternals(): Promise<CpExternal[]> {
  const { data, error } = await supabase.from('cp_externals').select('id, name, company, note, active').order('name');
  return error ? [] : ((data || []) as CpExternal[]);
}
export async function loadItemExternalIds(itemId: string): Promise<string[]> {
  const { data, error } = await supabase.from('cp_item_externals').select('external_id').eq('item_id', itemId);
  if (error) throw error;
  return ((data || []) as { external_id: string }[]).map(r => r.external_id);
}
export async function assignExternal(itemId: string, externalId: string): Promise<void> {
  const { error } = await supabase.from('cp_item_externals').insert({ item_id: itemId, external_id: externalId });
  if (error) throw error;
}
export async function unassignExternal(itemId: string, externalId: string): Promise<void> {
  const { error } = await supabase.from('cp_item_externals').delete().eq('item_id', itemId).eq('external_id', externalId);
  if (error) throw error;
}
export async function createExternal(name: string, company: string): Promise<string> {
  const { data, error } = await supabase.from('cp_externals').insert({ name: name.trim(), company: company.trim() || null }).select('id').single();
  if (error) throw error;
  return (data as { id: string }).id;
}
export const externalError = (error: unknown): string => {
  const e = error as { code?: string; message?: string } | null;
  const m = e?.message ?? '';
  if (e?.code === '23505') return 'Cet intervenant existe déjà (même nom et même société)';
  if (e?.code === '23514') return 'Valeur refusée : nom de 80 caractères au plus, société de 80, note de 300';
  if (/row-level security|permission denied/i.test(m) || e?.code === '42501') return "Tu n'as pas le droit de modifier les intervenants";
  return m || 'Une erreur est survenue';
};
