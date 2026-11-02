import { mxZonedWallTimeFromUtc, mxZonedWallTimeToUtc } from '../components/mx/internal/mxFestivalTimezone';

// Les heures du planning sont des heures de Suisse (Europe/Zurich), quel que soit le fuseau de l'appareil
const pad = (n: number) => String(n).padStart(2, '0');

// « 2026-12-02 » + « 08:15 » (heure de Zurich) → instant ISO envoyé à la base
export const wallToIso = (day: string, time: string): string => {
  const [y, m, d] = day.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return mxZonedWallTimeToUtc(y, m - 1, d, h, mi).toISOString();
};

// Instant ISO de la base → jour et heure de Zurich
export const isoToWall = (iso: string): { day: string; time: string } => {
  const p = mxZonedWallTimeFromUtc(new Date(iso));
  return { day: `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`, time: `${pad(p.hours)}:${pad(p.minutes)}` };
};

// « 2026-12-02 » → « 02.12.2026 »
export const formatDay = (day: string | null | undefined): string => {
  if (!day) return '…';
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y}`;
};

// « 08:00:00 » → « 08:00 »
export const shortTime = (time: string): string => time.slice(0, 5);
