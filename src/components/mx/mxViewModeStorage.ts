// LOT VUES-CARTES-LISTE, V2 (Greg, 2026-10-16) — persistance GENERIQUE du
// mode d'affichage (cartes/liste) d'une page de liste d'entites, « choix
// memorise par page (localStorage protege par try/catch) ». Generalise le
// patron deja en place pour les Offres (`offersMxViewStorage.ts`,
// 'action'|'day', LOT OFFRES-B4) a N'IMPORTE QUELLE page/axe de bascule --
// une page peut avoir PLUSIEURS axes independants (ex. Offres : « Qui doit
// agir »/« Par jour » ET « Cartes »/« Liste », deux cles DISTINCTES).
//
// `localStorage` peut lever (quota depasse, navigation privee) : chaque
// fonction isole son propre `try/catch`, jamais propage a l'appelant --
// meme garde-fou que `offersMxViewStorage.ts`.

/**
 * Lit une valeur de mode d'affichage persistee sous `storageKey`.
 * @param validValues Valeurs acceptees -- toute autre valeur stockee (version
 *   anterieure du produit, cle corrompue) retombe sur `fallback`.
 */
export function readMxViewMode<T extends string>(
  storageKey: string,
  validValues: readonly T[],
  fallback: T,
): T {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== null && (validValues as readonly string[]).includes(raw)) {
      return raw as T;
    }
  } catch {
    // quota, mode prive, etc. -- on retombe sur fallback.
  }
  return fallback;
}

export function writeMxViewMode<T extends string>(storageKey: string, value: T): void {
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    // ignore
  }
}
