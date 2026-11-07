import { dayFromNumber, dayNumberOf } from './ganttModel';

// Jours fériés proposés pour le calendrier de travail (sans affichage). Ce sont des PROPOSITIONS : les fériés varient selon le canton et
// l'entreprise ; la personne coche ce qui s'applique chez elle, puis peut encore modifier la liste. Rien n'est ajouté sans qu'elle le demande.
export interface HolidayPreset {
  key: string;
  label: string;
  // true : proposé et coché par défaut (jours fériés les plus répandus en Suisse) ; false : à cocher selon le canton ou la région
  common: boolean;
  // Date de l'année demandée
  date: (year: number) => string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const fixed = (month: number, day: number) => (year: number) => `${year}-${pad(month)}-${pad(day)}`;

// Dimanche de Pâques (algorithme de Meeus / Jones / Butcher, calendrier grégorien)
export function easterSunday(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}
const afterEaster = (days: number) => (year: number) => dayFromNumber(dayNumberOf(easterSunday(year)) + days);

// Jour qui suit le n-ième dimanche d'un mois (offset en jours après ce dimanche) : p. ex. le lundi du Jeûne = 3e dimanche de septembre + 1 jour
const weekdayOf = (iso: string) => new Date(dayNumberOf(iso) * 86_400_000).getUTCDay();
const afterSunday = (month: number, nth: number, offset: number) => (year: number) => {
  let n = dayNumberOf(`${year}-${pad(month)}-01`);
  while (weekdayOf(dayFromNumber(n)) !== 0) n++;
  return dayFromNumber(n + 7 * (nth - 1) + offset);
};

export const HOLIDAY_PRESETS: HolidayPreset[] = [
  { key: 'new-year', label: 'Nouvel An', common: true, date: fixed(1, 1) },
  { key: 'good-friday', label: 'Vendredi saint', common: true, date: afterEaster(-2) },
  { key: 'easter-monday', label: 'Lundi de Pâques', common: true, date: afterEaster(1) },
  { key: 'ascension', label: 'Ascension', common: true, date: afterEaster(39) },
  { key: 'whit-monday', label: 'Lundi de Pentecôte', common: true, date: afterEaster(50) },
  { key: 'national-day', label: 'Fête nationale', common: true, date: fixed(8, 1) },
  { key: 'christmas', label: 'Noël', common: true, date: fixed(12, 25) },
  { key: 'st-stephen', label: 'Lendemain de Noël (Saint-Étienne)', common: false, date: fixed(12, 26) },
  { key: 'berchtold', label: '2 janvier (Berchtoldstag)', common: false, date: fixed(1, 2) },
  { key: 'labour-day', label: '1er mai (Fête du travail)', common: false, date: fixed(5, 1) },
  { key: 'corpus-christi', label: 'Fête-Dieu', common: false, date: afterEaster(60) },
  { key: 'assumption', label: 'Assomption', common: false, date: fixed(8, 15) },
  { key: 'all-saints', label: 'Toussaint', common: false, date: fixed(11, 1) },
  { key: 'immaculate', label: 'Immaculée Conception', common: false, date: fixed(12, 8) },
  { key: 'jeune-geneve', label: 'Jeûne genevois', common: false, date: afterSunday(9, 1, 4) },        // jeudi qui suit le 1er dimanche de septembre
  { key: 'lundi-jeune', label: 'Lundi du Jeûne', common: false, date: afterSunday(9, 3, 1) },         // lundi qui suit le 3e dimanche de septembre
];

export interface CalendarDayInput { day: string; label: string; kind: 'holiday' | 'closure' }

// Jours à ajouter pour une année et une sélection de propositions, sans ceux que le calendrier contient déjà
export function presetDays(year: number, keys: ReadonlySet<string>, existing: ReadonlySet<string>): CalendarDayInput[] {
  return HOLIDAY_PRESETS.filter(p => keys.has(p.key))
    .map(p => ({ day: p.date(year), label: p.label, kind: 'holiday' as const }))
    .filter(d => !existing.has(d.day))
    // Deux propositions le même jour (rare) : une seule ligne
    .filter((d, i, all) => all.findIndex(x => x.day === d.day) === i)
    .sort((a, b) => a.day.localeCompare(b.day));
}

// Nombre de jours ouvrés entre deux dates incluses : ni samedi, ni dimanche, ni jour du calendrier
export function workingDaysBetween(start: string, end: string, nonWorking: ReadonlySet<string>): number {
  if (end < start) return 0;
  let count = 0;
  for (let n = dayNumberOf(start); n <= dayNumberOf(end); n++) {
    const iso = dayFromNumber(n);
    const wd = weekdayOf(iso);
    if (wd !== 0 && wd !== 6 && !nonWorking.has(iso)) count++;
  }
  return count;
}
