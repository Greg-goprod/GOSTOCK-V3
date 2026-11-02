import { dayToNumber, numberToDay } from './timelineMath';

// Période affichée par un Gantt ou une frise : un préréglage (1 jour … 1 année) ou une période libre.
// Le préréglage se cale sur le calendrier (semaine du lundi, mois civil, année civile) à partir d'un jour de référence.
export type PeriodPreset = '1d' | '1w' | '2w' | '1m' | '3m' | '6m' | '1y' | 'custom';
export interface ViewPeriod { preset: PeriodPreset; start: string; end: string }

export const PERIOD_PRESETS: { value: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
  { value: '1d', label: '1 jour' }, { value: '1w', label: '1 semaine' }, { value: '2w', label: '2 semaines' }, { value: '1m', label: '1 mois' },
  { value: '3m', label: '3 mois' }, { value: '6m', label: '6 mois' }, { value: '1y', label: '1 année' },
];

const MONTHS: Partial<Record<PeriodPreset, number>> = { '1m': 1, '3m': 3, '6m': 6 };
const parts = (day: string) => { const [y, m, d] = day.split('-').map(Number); return { y, m, d }; };
const utc = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
const mondayNumber = (n: number) => n - ((new Date(n * 86_400_000).getUTCDay() + 6) % 7);

// Premier jour de la période, selon le préréglage
const periodStart = (preset: PeriodPreset, day: string): number => {
  const n = dayToNumber(day);
  const { y, m } = parts(day);
  if (preset === '1w' || preset === '2w') return mondayNumber(n);
  if (preset === '1m' || preset === '3m' || preset === '6m') return utc(y, m, 1);
  if (preset === '1y') return utc(y, 1, 1);
  return n;
};

// Dernier jour (inclus) d'une période de ce préréglage qui commence au jour numéro `start`
const periodEnd = (preset: PeriodPreset, start: number): number => {
  if (preset === '1d') return start;
  if (preset === '1w') return start + 6;
  if (preset === '2w') return start + 13;
  if (preset === '1y') { const { y } = parts(numberToDay(start)); return utc(y + 1, 1, 1) - 1; }
  const months = MONTHS[preset] ?? 1;
  const { y, m } = parts(numberToDay(start));
  return utc(y, m + months, 1) - 1;
};

// Période d'un préréglage qui contient le jour donné
export function makePeriod(preset: Exclude<PeriodPreset, 'custom'>, day: string): ViewPeriod {
  const start = periodStart(preset, day);
  return { preset, start: numberToDay(start), end: numberToDay(periodEnd(preset, start)) };
}

export const periodDays = (p: Pick<ViewPeriod, 'start' | 'end'>): number => dayToNumber(p.end) - dayToNumber(p.start) + 1;

// Période précédente (-1) ou suivante (+1) : même préréglage, ou même durée pour une période libre
export function shiftPeriod(p: ViewPeriod, dir: -1 | 1): ViewPeriod {
  if (p.preset === 'custom') {
    const len = periodDays(p);
    return { preset: 'custom', start: numberToDay(dayToNumber(p.start) + dir * len), end: numberToDay(dayToNumber(p.end) + dir * len) };
  }
  const s = dayToNumber(p.start);
  if (p.preset === '1d') return makePeriod('1d', numberToDay(s + dir));
  if (p.preset === '1w') return makePeriod('1w', numberToDay(s + dir * 7));
  if (p.preset === '2w') return makePeriod('2w', numberToDay(s + dir * 14));
  const { y, m } = parts(p.start);
  const step = p.preset === '1y' ? 12 : MONTHS[p.preset] ?? 1;
  return makePeriod(p.preset, numberToDay(utc(y, m + dir * step, 1)));
}

export const containsDay = (p: Pick<ViewPeriod, 'start' | 'end'>, day: string) => day >= p.start && day <= p.end;
// Même préréglage ou même plage libre, centré sur un autre jour de référence (« Aujourd'hui », « Aller au jour »)
export const periodAround = (p: ViewPeriod, day: string): ViewPeriod => {
  if (p.preset !== 'custom') return makePeriod(p.preset, day);
  const len = periodDays(p);
  const start = dayToNumber(day) - Math.floor(len / 2);
  return { preset: 'custom', start: numberToDay(start), end: numberToDay(start + len - 1) };
};

const PRESET_KEYS = new Set(PERIOD_PRESETS.map(p => p.value));
export const isPreset = (v: string | null | undefined): v is Exclude<PeriodPreset, 'custom'> => !!v && PRESET_KEYS.has(v as never);
