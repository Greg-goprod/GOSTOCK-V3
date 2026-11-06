/**
 * mxCalendarMath — interne au tronc, HORS BARREL (voir index.ts).
 *
 * LOT PICKERS-MX, S2. Fonctions PURES partagees par MxDatePicker et
 * MxDateRangePicker (grille de 6 semaines, semaine commencant le LUNDI —
 * handoff `reference/Mannyx Components V2.html`, `DAYS_FR` + `(getDay()+6)%7`,
 * L.2275-2277 et L.2446 : CE N'EST PAS un defaut propose, le handoff le
 * dessine explicitement). Testees isolement (mxCalendarMath.test.ts), sans
 * monter de composant.
 */

export interface MxCalendarCell {
  date: Date;
  otherMonth: boolean;
}

/** Jours courts, semaine commencant LUNDI — `DAYS_FR` du handoff (L.2276). */
export const MX_WEEKDAY_LABELS_FR = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
export const MX_WEEKDAY_LABELS_EN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export const MX_MONTH_LABELS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
export const MX_MONTH_SHORT_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
export const MX_MONTH_LABELS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MX_MONTH_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `(getDay() + 6) % 7` du handoff — Lundi devient 0, Dimanche devient 6. */
export function mxDowMondayFirst(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * Grille FIXE de 42 cellules (6 semaines) — handoff L.2448 `Math.ceil((startDOW + dim) / 7) * 7`,
 * mais TOUJOURS porte a 42 (hauteur constante quel que soit le mois, meme
 * convention que `DatePickerAura.getDaysGrid`, deja en place dans l'app).
 */
export function mxBuildCalendarGrid(year: number, month: number): MxCalendarCell[] {
  const firstDay = new Date(year, month, 1);
  const startDow = mxDowMondayFirst(firstDay);
  const cells: MxCalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const dayOffset = i - startDow + 1;
    const date = new Date(year, month, dayOffset);
    cells.push({ date, otherMonth: date.getMonth() !== month });
  }
  return cells;
}

export function mxIsSameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function mxStripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
