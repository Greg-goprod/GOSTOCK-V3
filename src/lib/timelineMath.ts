import { isoToWall, wallToIso } from './zurichTime';

// Calculs de la frise du planning (sans affichage) : tout se fait en heures murales de Suisse, jamais en UTC,
// pour qu'un déplacement garde la même heure affichée même autour d'un changement d'heure.

export const MINUTES_PER_DAY = 1440;

// « 2026-12-02 » → numéro de jour (comparable, additionnable)
export const dayToNumber = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};
export const numberToDay = (n: number): string => new Date(n * 86_400_000).toISOString().slice(0, 10);

const timeToMinutes = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const pad = (n: number) => String(n).padStart(2, '0');
export const minutesToTime = (m: number): string => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export interface WallPoint { day: number; minute: number }

// Instant ISO → (numéro de jour, minute du jour) de Zurich
export const toWallPoint = (iso: string): WallPoint => {
  const w = isoToWall(iso);
  return { day: dayToNumber(w.day), minute: timeToMinutes(w.time) };
};

// (jour, minute) → instant ISO ; accepte une minute hors 0..1439 (reporte sur les jours voisins)
export const fromWallPoint = (p: WallPoint): string => {
  const total = p.day * MINUTES_PER_DAY + p.minute;
  const day = Math.floor(total / MINUTES_PER_DAY);
  const minute = total - day * MINUTES_PER_DAY;
  return wallToIso(numberToDay(day), minutesToTime(minute));
};

// Décale un instant de N minutes MURALES
export const shiftIso = (iso: string, deltaMinutes: number): string => {
  const p = toWallPoint(iso);
  return fromWallPoint({ day: p.day, minute: p.minute + deltaMinutes });
};

// Arrondit au pas le plus proche
export const snap = (value: number, step: number): number => Math.round(value / step) * step;

export interface LaneItem { id: string; start: number; end: number }

// Range les éléments qui se chevauchent sur des « couloirs » superposés (le plus petit couloir libre)
export const assignLanes = (items: LaneItem[]): { lanes: Map<string, number>; count: number } => {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const item of sorted) {
    let lane = laneEnds.findIndex(end => end <= item.start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(item.end); } else laneEnds[lane] = item.end;
    lanes.set(item.id, lane);
  }
  return { lanes, count: Math.max(1, laneEnds.length) };
};

// Lundi de la semaine d'un jour
export const mondayOf = (day: string): string => {
  const n = dayToNumber(day);
  const weekday = (new Date(n * 86_400_000).getUTCDay() + 6) % 7; // 0 = lundi
  return numberToDay(n - weekday);
};
