/**
 * mxGridPagination — LOT ARTISTES-LISTE, C4 (2026-10-04), déplacé dans le
 * tronc (`src/components/mx/internal/`) à la clôture du lot — même
 * emplacement que `mxGridBreakpoints`/`MxCardGrid` (mesure du nombre de
 * colonnes), dont ces fonctions sont le complément PUR (aucun React, aucun
 * DOM) : elles portent la règle de
 * Greg, partagée, pas spécifique à Artistes — dans une grille de cartes,
 * le nombre d'éléments par page est un multiple du nombre de colonnes
 * réellement affichées (pages pleines, sauf la dernière). Consommé par
 * `src/pages/app/artistes/ArtistesListMx.tsx`/`index.tsx` (premier
 * appelant), testable sans monter la page complète (Supabase, React
 * Query, event store…) — même raison que les autres extractions de
 * logique pure du projet.
 *
 * Le choix MÉMORISÉ par l'utilisateur est le nombre de RANGÉES
 * (`MX_GRID_PAGE_ROW_OPTIONS`), pas le nombre d'éléments — c'est ce qui
 * permet de le conserver tel quel au redimensionnement (le nombre de
 * colonnes change, les rangées non) : voir `rowsFromPageSize`/
 * `computeMxGridPageSize`. Les libellés affichés à l'utilisateur restent le
 * nombre d'ARTISTES (ex. 24/48/96 à 8 colonnes) — voir
 * `buildMxGridPageSizeOptions`.
 */

/** Rangées proposées au choix — consigne de Greg, C4. */
export const MX_GRID_PAGE_ROW_OPTIONS = [3, 6, 12] as const;

/**
 * Colonnes supposées avant toute mesure réelle (premier rendu, ou vue
 * tableau jamais précédée d'une vue cartes dans la session) — même valeur
 * que l'hypothèse documentée en tête d'`ArtistesListMx.tsx` (C2.4, 8
 * colonnes à 1920px en densité Compacte).
 */
export const MX_GRID_PAGE_FALLBACK_COLUMNS = 8;

/** Rangées par défaut — 12 x 8 colonnes = 96, valeur par défaut historique. */
export const MX_GRID_PAGE_DEFAULT_ROWS = 12;

export interface MxGridPageSizeOption {
  value: string;
  label: string;
}

function safeColumns(columns: number): number {
  return columns > 0 ? columns : 1;
}

/**
 * Options du sélecteur « par page », libellées en nombre d'ARTISTES
 * (ex. [24, 48, 96] à 8 colonnes) — recalculées chaque fois que le nombre
 * de colonnes mesuré change.
 */
export function buildMxGridPageSizeOptions(columns: number): MxGridPageSizeOption[] {
  const c = safeColumns(columns);
  return MX_GRID_PAGE_ROW_OPTIONS.map((rows) => {
    const count = rows * c;
    return { value: String(count), label: String(count) };
  });
}

/** Nombre d'éléments par page pour `rows` rangées à `columns` colonnes. */
export function computeMxGridPageSize(rows: number, columns: number): number {
  return Math.max(1, rows) * safeColumns(columns);
}

/**
 * Retrouve le nombre de rangées impliqué par un `pageSize` choisi
 * explicitement par l'utilisateur (clic sur une option du sélecteur) — à
 * mémoriser à la place du `pageSize` brut, pour qu'un redimensionnement
 * ultérieur conserve ce choix de RANGÉES, pas le compte d'artistes.
 */
export function rowsFromPageSize(pageSize: number, columns: number): number {
  return Math.max(1, Math.round(pageSize / safeColumns(columns)));
}

/**
 * Recalage de la page courante quand `pageSize` change (nombre de colonnes
 * mesuré différent, mêmes rangées mémorisées) — garde le PREMIER artiste de
 * la page courante visible : on retrouve son index absolu avec l'ancien
 * `pageSize`, puis la page qui le contient avec le nouveau.
 */
export function recalageMxGridPage(
  currentPage: number,
  oldPageSize: number,
  newPageSize: number,
): number {
  if (oldPageSize <= 0 || newPageSize <= 0) return 1;
  const firstItemIndex = Math.max(0, currentPage - 1) * oldPageSize;
  return Math.floor(firstItemIndex / newPageSize) + 1;
}
