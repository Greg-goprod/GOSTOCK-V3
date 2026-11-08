import { supabase } from './supabase';

// Temps passé sur une tâche (sans affichage) : saisie à la main ou chronomètre. La base décide qui lit et qui écrit (on saisit son propre temps ;
// les responsables lisent celui des autres) et mesure elle-même la durée d'un chronomètre.
export interface CpTimeEntry { id: string; item_id: string; user_id: string; work_date: string; minutes: number | null; started_at: string | null; note: string | null }
export const MAX_MINUTES = 1440;

/* ----------------------------------------------------------------- durées */
// Lecture d'une durée saisie : « 1:30 », « 1 h 30 », « 1h », « 1,5 h », « 45 min », « 45 » (minutes) ; de 1 minute à 24 h, sinon null.
// Un nombre décimal sans unité (« 1,5 ») est refusé : on ne devine pas s'il s'agit d'heures ou de minutes.
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ').replace(',', '.');
  let minutes: number | null = null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,2}):(\d{2})$/.exec(t))) minutes = Number(m[1]) * 60 + (Number(m[2]) < 60 ? Number(m[2]) : NaN);
  else if ((m = /^(\d+(?:\.\d+)?) ?h(?: ?(\d{1,2}))?(?: ?min)?$/.exec(t))) {
    if (m[2] !== undefined && m[1].includes('.')) return null;
    const extra = m[2] === undefined ? 0 : Number(m[2]);
    minutes = extra < 60 ? Math.round(Number(m[1]) * 60) + extra : NaN;
  } else if ((m = /^(\d+) ?(?:min|m)$/.exec(t))) minutes = Number(m[1]);
  else if (/^\d+$/.test(t)) minutes = Number(t);
  return minutes !== null && Number.isFinite(minutes) && minutes >= 1 && minutes <= MAX_MINUTES ? minutes : null;
}

export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, '0')}`;
}
// Chronomètre : « 00:12:34 »
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':');
}
export const sumMinutes = (entries: Pick<CpTimeEntry, 'minutes'>[]) => entries.reduce((a, e) => a + (e.minutes ?? 0), 0);

export const timeError = (error: unknown): string => {
  const e = error as { code?: string; message?: string } | null;
  const m = e?.message ?? '';
  if (/futur/.test(m)) return 'Pas de temps passé dans le futur';
  if (e?.code === '23514') return 'Durée refusée : de 1 minute à 24 heures';
  if (e?.code === '23505') return 'Un chronomètre est déjà en cours : arrête-le d\'abord';
  if (/row-level security|permission denied/i.test(m) || e?.code === '42501') return "Tu ne peux pas saisir de temps sur cette tâche (il faut être de l'équipe du projet)";
  return m || 'Une erreur est survenue';
};

/* ------------------------------------------------------------------- accès */
const COLUMNS = 'id, item_id, user_id, work_date, minutes, started_at, note';
export async function loadItemTime(itemId: string): Promise<CpTimeEntry[]> {
  const { data, error } = await supabase.from('cp_time_entries').select(COLUMNS).eq('item_id', itemId).order('work_date', { ascending: false }).order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data || []) as CpTimeEntry[];
}
export interface RunningTimer extends CpTimeEntry { item_name: string }
// Lecture tolérante : sans la migration 74 la table n'existe pas → pas de chronomètre
export async function loadRunningTimer(userId: string): Promise<RunningTimer | null> {
  const { data, error } = await supabase.from('cp_time_entries').select(`${COLUMNS}, item:item_id(name)`).eq('user_id', userId).is('minutes', null).limit(1);
  if (error || !data || data.length === 0) return null;
  const r = data[0] as unknown as CpTimeEntry & { item?: { name?: string } | null };
  return { ...r, item_name: r.item?.name ?? 'Tâche supprimée' };
}
export async function canLogTime(itemId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('cp_can_log_time', { p_item: itemId });
  return !error && data === true;
}
export async function startTimer(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('cp_timer_start', { p_item: itemId });
  if (error) throw error;
  announceTimer();
}
export async function stopTimer(): Promise<number | null> {
  const { data, error } = await supabase.rpc('cp_timer_stop');
  if (error) throw error;
  announceTimer();
  return typeof data === 'number' ? data : null;
}
export async function addTimeEntry(itemId: string, workDate: string, minutes: number, note: string): Promise<void> {
  const { error } = await supabase.from('cp_time_entries').insert({ item_id: itemId, work_date: workDate, minutes, note: note.trim() || null });
  if (error) throw error;
}
export async function updateTimeEntry(id: string, patch: { work_date?: string; minutes?: number; note?: string | null }): Promise<void> {
  const { error } = await supabase.from('cp_time_entries').update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteTimeEntry(id: string): Promise<void> {
  const { error } = await supabase.from('cp_time_entries').delete().eq('id', id);
  if (error) throw error;
  announceTimer();
}
// La barre du chronomètre (en haut de PILOTE) et la fiche d'une tâche se préviennent mutuellement
export const TIMER_EVENT = 'pilote-timer-changed';
export function announceTimer(): void {
  try { window.dispatchEvent(new CustomEvent(TIMER_EVENT)); } catch { /* hors navigateur */ }
}
