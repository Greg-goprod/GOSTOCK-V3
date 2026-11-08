import { supabase } from './supabase';
import type { GanttData } from './pilote';

// Budget par projet (sans affichage) : lignes prévu / engagé / réel en francs suisses, taux horaires, valorisation des heures estimées.
// PRÉVU = ce qu'on compte dépenser ; ENGAGÉ = commandé, pas encore payé ; RÉEL = payé. Saisie à la main.
export interface CpBudgetLine {
  id: string; project_id: string; category: string;
  planned: number; committed: number; actual: number;
  note: string | null; position: number; updated_at: string;
}
export interface CpUserRate { user_id: string; hourly_rate: number }
export interface BudgetRights { read: boolean; create: boolean; update: boolean; delete: boolean }
export interface BudgetData { lines: CpBudgetLine[]; rates: CpUserRate[] }

export const NO_BUDGET_RIGHTS: BudgetRights = { read: false, create: false, update: false, delete: false };
export const MAX_AMOUNT = 99_999_999.99;
export const MAX_RATE = 9_999.99;

// Droits fins « cp.budget:… » (séparés de ceux des projets) : la base répond, l'écran ne fait que masquer ce qui serait refusé
export async function loadBudgetRights(): Promise<BudgetRights> {
  const ask = async (action: keyof BudgetRights) => {
    const { data, error } = await supabase.rpc('rbac_has_any_permission', { p_keys: [`cp.budget:${action}`] });
    return !error && data === true;
  };
  const [read, create, update, del] = await Promise.all([ask('read'), ask('create'), ask('update'), ask('delete')]);
  return { read, create, update, delete: del };
}

// Lecture tolérante : tant que la migration du budget n'est pas appliquée (ou sans le droit de lecture), les tables sont vides pour la personne
export async function loadBudget(): Promise<BudgetData> {
  const [lines, rates] = await Promise.all([
    supabase.from('cp_budget_lines').select('id, project_id, category, planned, committed, actual, note, position, updated_at').order('position').order('category'),
    supabase.from('cp_user_rates').select('user_id, hourly_rate'),
  ]);
  return {
    lines: lines.error ? [] : ((lines.data || []) as CpBudgetLine[]).map(l => ({ ...l, planned: Number(l.planned), committed: Number(l.committed), actual: Number(l.actual) })),
    rates: rates.error ? [] : ((rates.data || []) as CpUserRate[]).map(r => ({ ...r, hourly_rate: Number(r.hourly_rate) })),
  };
}

export const budgetError = (error: unknown): string => {
  const e = error as { code?: string; message?: string } | null;
  const m = e?.message ?? '';
  if (e?.code === '42501' || /row-level security|permission denied/i.test(m)) return "Tu n'as pas le droit de modifier le budget";
  if (e?.code === '23514' || /check constraint/i.test(m)) return 'Valeur refusée : montants de 0 à 99 999 999,99 ; catégorie de 80 caractères au plus, note de 500 au plus';
  if (e?.code === '23505') return 'Cette personne a déjà un taux : modifie-le';
  return m || 'Une erreur est survenue';
};

/* ------------------------------------------------------------------ montants */
// 12'000.50 : apostrophe pour les milliers, point pour les centimes (usage suisse) ; deux décimales seulement si nécessaire
export function formatChf(value: number, withCents = false): string {
  const v = Math.round(value * 100) / 100;
  const neg = v < 0;
  const [int, dec] = Math.abs(v).toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  const cents = withCents || dec !== '00' ? `.${dec}` : '';
  return `${neg ? '−' : ''}${grouped}${cents}`;
}

// Lecture d'un montant saisi : « 12'000.50 », « 12 000,5 », « 12000 » ; vide, négatif, illisible ou trop grand → null
export function parseAmount(text: string, max = MAX_AMOUNT): number | null {
  const t = text.trim().replace(/[\s'’\u00a0\u202f]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n <= max ? n : null;
}

/* -------------------------------------------------------------------- totaux */
export interface BudgetTotals { planned: number; committed: number; actual: number }
export const EMPTY_TOTALS: BudgetTotals = { planned: 0, committed: 0, actual: 0 };

// Additions faites en centimes entiers : pas de dérive du type 0,1 + 0,2
export function sumLines(lines: Pick<CpBudgetLine, 'planned' | 'committed' | 'actual'>[]): BudgetTotals {
  let p = 0, c = 0, a = 0;
  for (const l of lines) { p += Math.round(l.planned * 100); c += Math.round(l.committed * 100); a += Math.round(l.actual * 100); }
  return { planned: p / 100, committed: c / 100, actual: a / 100 };
}

// Écart = prévu − réel (positif : il reste de la marge) ; reste à engager = prévu − engagé
export const variance = (t: BudgetTotals) => Math.round((t.planned - t.actual) * 100) / 100;
export const remainingToCommit = (t: BudgetTotals) => Math.round((t.planned - t.committed) * 100) / 100;

export type BudgetLevel = 'none' | 'ok' | 'warn' | 'over';
// over : l'engagé ou le réel dépasse le prévu ; warn : 90 % du prévu ou plus déjà engagé ou payé ; none : rien de saisi
export function budgetLevel(t: BudgetTotals): BudgetLevel {
  const used = Math.max(t.committed, t.actual);
  if (t.planned <= 0 && used <= 0) return 'none';
  if (used > t.planned) return 'over';
  return used >= t.planned * 0.9 ? 'warn' : 'ok';
}
// Part consommée du prévu (0 à 1 ou plus) ; null quand il n'y a pas de prévu
export const usedRatio = (t: BudgetTotals): number | null => (t.planned > 0 ? Math.max(t.committed, t.actual) / t.planned : null);

export function totalsByProject(lines: CpBudgetLine[]): Map<string, BudgetTotals> {
  const by = new Map<string, CpBudgetLine[]>();
  for (const l of lines) { const list = by.get(l.project_id) ?? []; list.push(l); by.set(l.project_id, list); }
  return new Map([...by].map(([id, list]) => [id, sumLines(list)]));
}

/* --------------------------------------------------------------- main-d'œuvre */
export interface Labor { hours: number; valuedHours: number; cost: number; unvaluedHours: number; unassignedHours: number }
const NO_LABOR: Labor = { hours: 0, valuedHours: 0, cost: 0, unvaluedHours: 0, unassignedHours: 0 };

// Valorise les heures estimées des éléments (même règle que la Charge : éléments non annulés, heures partagées à parts égales entre les assignés).
// Heures sans assigné ou sans taux : comptées à part, jamais valorisées (on ne devine pas un taux). Si une phase ET ses tâches sont estimées,
// les deux comptent (comme dans la Charge) : n'estime que l'un des deux.
export function laborByProject(data: GanttData, rates: CpUserRate[]): Map<string, Labor> {
  const rateOf = new Map(rates.map(r => [r.user_id, r.hourly_rate]));
  const family = new Map(data.statuses.map(s => [s.id, s.family]));
  const projects = new Set(data.projects.map(p => p.id));
  const assignees = new Map<string, string[]>();
  for (const m of data.itemMembers) { const l = assignees.get(m.item_id) ?? []; l.push(m.user_id); assignees.set(m.item_id, l); }
  // Centimes de franc et dixièmes d'heure : on additionne des entiers
  const acc = new Map<string, { h: number; vh: number; cost: number; uh: number; nh: number }>();
  for (const item of data.items) {
    if (!projects.has(item.project_id) || family.get(item.status_id) === 'cancelled') continue;
    const estimate = item.estimate_hours === null || item.estimate_hours === undefined ? 0 : Number(item.estimate_hours);
    if (!(estimate > 0)) continue;
    const a = acc.get(item.project_id) ?? { h: 0, vh: 0, cost: 0, uh: 0, nh: 0 };
    a.h += estimate;
    const users = assignees.get(item.id) ?? [];
    if (users.length === 0) a.nh += estimate;
    else {
      const share = estimate / users.length;
      for (const u of users) {
        const rate = rateOf.get(u);
        if (rate === undefined) a.uh += share;
        else { a.vh += share; a.cost += share * rate; }
      }
    }
    acc.set(item.project_id, a);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return new Map([...acc].map(([id, a]) => [id, { hours: round(a.h), valuedHours: round(a.vh), cost: round(a.cost), unvaluedHours: round(a.uh), unassignedHours: round(a.nh) }]));
}
export const laborOf = (m: Map<string, Labor>, projectId: string): Labor => m.get(projectId) ?? NO_LABOR;

// Temps RÉELLEMENT saisi sur un projet, valorisé au taux horaire de chaque personne (différent de l'estimation ci-dessus).
// Une personne sans taux : son temps est compté à part, jamais valorisé. Les centimes sont arrondis personne par personne, puis additionnés.
export interface TimeByUser { user_id: string; minutes: number }
export interface ActualLabor { minutes: number; valuedMinutes: number; unvaluedMinutes: number; cost: number }
export function actualLabor(time: TimeByUser[], rates: CpUserRate[]): ActualLabor {
  const rateOf = new Map(rates.map(r => [r.user_id, r.hourly_rate]));
  let minutes = 0, valued = 0, unvalued = 0, cents = 0;
  for (const t of time) {
    const m = Math.max(0, Math.round(Number(t.minutes) || 0));
    minutes += m;
    const rate = rateOf.get(t.user_id);
    if (rate === undefined) unvalued += m;
    else { valued += m; cents += Math.round(m * rate / 60 * 100); }
  }
  return { minutes, valuedMinutes: valued, unvaluedMinutes: unvalued, cost: cents / 100 };
}

// Temps saisi par personne sur un projet (réservé aux personnes qui ont le droit « budget » : la base répond vide aux autres).
// null = fonction absente (migration 75 pas encore appliquée) : l'écran n'affiche alors rien de plus.
export async function loadProjectTime(projectId: string): Promise<TimeByUser[] | null> {
  const { data, error } = await supabase.rpc('cp_project_time_by_user', { p_project: projectId });
  if (error) return null;
  return ((data || []) as { user_id: string; minutes: number | string }[]).map(r => ({ user_id: r.user_id, minutes: Number(r.minutes) }));
}

/* -------------------------------------------------------------------- export */
type Row = Record<string, string | number>;
// Lignes pour l'export : une par ligne de budget, puis un total par projet. Les projets sans ligne n'apparaissent pas.
export function buildBudgetRows(projects: { id: string; name: string }[], lines: CpBudgetLine[], labor: Map<string, Labor>): Row[] {
  const rows: Row[] = [];
  for (const p of projects) {
    const mine = lines.filter(l => l.project_id === p.id);
    if (mine.length === 0) continue;
    for (const l of mine) {
      rows.push({ 'Projet': p.name, 'Catégorie': l.category, 'Prévu (CHF)': l.planned, 'Engagé (CHF)': l.committed, 'Réel (CHF)': l.actual, 'Écart (CHF)': variance(l), 'Note': l.note ?? '' });
    }
    const t = sumLines(mine);
    rows.push({ 'Projet': p.name, 'Catégorie': 'TOTAL', 'Prévu (CHF)': t.planned, 'Engagé (CHF)': t.committed, 'Réel (CHF)': t.actual, 'Écart (CHF)': variance(t), 'Note': `Main-d'œuvre estimée : ${formatChf(laborOf(labor, p.id).cost)} CHF` });
  }
  return rows;
}
