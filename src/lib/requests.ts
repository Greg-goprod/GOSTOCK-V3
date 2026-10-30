import { RequestStatus, Vehicle } from '../types';

export const REQUEST_STATUS: Record<RequestStatus, { label: string; className: string }> = {
  requested: { label: 'À valider', className: 'bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-200' },
  approved: { label: 'Validée', className: 'mx-tint-badge-info' },
  ready: { label: 'Prête', className: 'bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-200' },
  out: { label: 'Sortie', className: 'bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-200' },
  closed: { label: 'Clôturée', className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' },
  rejected: { label: 'Refusée', className: 'bg-danger-100 text-danger-800 dark:bg-danger-900/40 dark:text-danger-200' },
  cancelled: { label: 'Annulée', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
};

export const VEHICLE_STATUS: Record<Vehicle['status'], { label: string; className: string }> = {
  available: { label: 'Disponible', className: 'bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-200' },
  in_use: { label: 'Sorti', className: 'mx-tint-badge-info' },
  maintenance: { label: 'En maintenance', className: 'bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-200' },
  retired: { label: 'Retiré', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
};

const DAY = 24 * 60 * 60 * 1000;

// État d'une échéance de véhicule : dépassée, proche (30 jours) ou lointaine
export const deadlineState = (date?: string): 'overdue' | 'soon' | 'ok' | null => {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  if (diff < 0) return 'overdue';
  if (diff <= 30 * DAY) return 'soon';
  return 'ok';
};

// Valeur pour un champ <input type="datetime-local"> à partir d'une date
export const toLocalInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const formatPeriod = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  const day = (d: Date) => d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' });
  const time = (d: Date) => d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
  return s.toDateString() === e.toDateString()
    ? `${day(s)} · ${time(s)} → ${time(e)}`
    : `${day(s)} ${time(s)} → ${day(e)} ${time(e)}`;
};

export const errorMessage = (error: unknown) =>
  (error as { message?: string })?.message || 'Une erreur est survenue';
