import type { CpItem } from './pilote';

// Répétition d'une tâche (sans affichage). La BASE fait le vrai calcul (cp_repeat_item) ; ce module donne le même aperçu avant de valider.
// Mêmes règles : chaque occurrence se calcule depuis l'ORIGINE (pas de dérive d'un mois à l'autre), le quantième est recalé sur la fin du mois
// (31 janvier → 28 février), 29 février → 28 février les années non bissextiles, la durée de l'élément est conservée.
// Option « jours ouvrés » : une occurrence qui tombe un samedi, un dimanche ou un jour du calendrier de travail est avancée au premier jour ouvré
// (au plus 366 jours d'avance, puis la date telle quelle), comme la base (cp_adjust_working_day).
export type Freq = 'weekly' | 'monthly' | 'yearly';
export const FREQ_LABEL: Record<Freq, string> = { weekly: 'Chaque semaine', monthly: 'Chaque mois', yearly: 'Chaque année' };
export const FREQS: Freq[] = ['weekly', 'monthly', 'yearly'];
export const MAX_REPEAT = 52;
export const MAX_SERIES = 200;

const DAY = 86_400_000;
const toNum = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / DAY;
const fromNum = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const daysIn = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

export function shiftDate(day: string, freq: Freq, k: number): string {
  if (freq === 'weekly') return fromNum(toNum(day) + 7 * k);
  const months = freq === 'monthly' ? k : 12 * k;
  const y = Number(day.slice(0, 4)), m = Number(day.slice(5, 7)) - 1, d = Number(day.slice(8, 10));
  const total = y * 12 + m + months;
  const ny = Math.floor(total / 12), nm = total - ny * 12;
  return fromNum(Date.UTC(ny, nm, Math.min(d, daysIn(ny, nm))) / DAY);
}

const weekday = (iso: string) => new Date(toNum(iso) * DAY).getUTCDay();   // 0 = dimanche, 6 = samedi
// Premier jour ouvré à partir de `day` (lui-même s'il l'est) : ni samedi, ni dimanche, ni jour du calendrier de travail
export function nextWorkingDay(day: string, nonWorking: ReadonlySet<string>): string {
  let n = toNum(day);
  for (let i = 0; i <= 366; i++, n++) {
    const iso = fromNum(n);
    const wd = weekday(iso);
    if (wd !== 0 && wd !== 6 && !nonWorking.has(iso)) return iso;
  }
  return day;
}

export interface Occurrence { start: string | null; end: string | null }
// Les `count` occurrences ajoutées (la première répétition est la numéro 1). `nonWorking` : jours du calendrier de travail ; absent = on n'évite rien.
export function previewOccurrences(start: string | null, end: string | null, freq: Freq, count: number, nonWorking?: ReadonlySet<string>): Occurrence[] {
  const out: Occurrence[] = [];
  for (let k = 1; k <= count; k++) {
    let s = start ? shiftDate(start, freq, k) : null;
    let e = end === null || start ? null : shiftDate(end, freq, k);
    if (nonWorking) { if (s) s = nextWorkingDay(s, nonWorking); if (e) e = nextWorkingDay(e, nonWorking); }
    if (end !== null && start) e = fromNum(toNum(s as string) + (toNum(end) - toNum(start)));
    out.push({ start: s, end: e });
  }
  return out;
}

// Raison pour laquelle un élément ne se répète pas, sinon null (la base refuse pour les mêmes raisons)
export function cannotRepeat(item: CpItem): string | null {
  if (item.kind === 'phase') return 'Une phase ne se répète pas : répète ses tâches une à une.';
  if (!item.starts_on && !item.ends_on) return 'Donne d\'abord une date à cet élément.';
  return null;
}

export interface SeriesInfo { index: number; total: number; isLast: boolean; laterCount: number }
export function seriesInfo(items: CpItem[], item: CpItem): SeriesInfo | null {
  if (!item.series_id || !item.series_index) return null;
  const mine = items.filter(i => i.series_id === item.series_id);
  const max = Math.max(...mine.map(i => i.series_index ?? 0));
  return { index: item.series_index, total: mine.length, isLast: item.series_index === max, laterCount: mine.filter(i => (i.series_index ?? 0) > (item.series_index ?? 0)).length };
}

// Nombre de répétitions possibles encore dans la série (200 occurrences au plus)
export const maxRepeatFor = (info: SeriesInfo | null) => Math.max(0, Math.min(MAX_REPEAT, MAX_SERIES - (info ? info.total : 1)));

export const recurrenceError = (error: unknown): string => {
  const e = error as { code?: string; message?: string } | null;
  const m = e?.message ?? '';
  if (/row-level security|permission denied/i.test(m) || e?.code === '42501') return "Tu n'as pas le droit de répéter ou de supprimer ces éléments";
  return m || 'Une erreur est survenue';
};
