/**
 * mxGridBreakpoints — LOT CONTRATS-GRILLE ET ANNULATION, correctif de
 * recette (Greg, 2026-10-10). Remplace l'ancienne strategie de `MxCardGrid`
 * (`display:grid; gridTemplateColumns: repeat(auto-fill, minmax(minCardWidth,
 * 1fr))`), qui laissait chaque page choisir son propre `minCardWidth` -- la
 * cause du defaut constate a la recette : 7 colonnes sur Artistes (220px),
 * 9 sur Contrats (160px), sur le MEME ecran. Decision de Greg : le nombre de
 * colonnes ne depend plus JAMAIS d'une largeur de carte choisie par la page
 * -- il est fixe par PALIERS de largeur de CONTENEUR, definis UNE SEULE fois
 * ici, identiques pour toute grille du tronc (Artistes, Contrats, et toute
 * future page listee a `DOCTRINE-BARRE-OUTILS.md` §5bis). La largeur de
 * carte n'est plus un parametre : elle est le RESULTAT (`1fr`, la grille
 * remplit la largeur disponible en N colonnes egales) -- « la largeur des
 * cartes s'adapte, et non plus le nombre de colonnes » (consigne de Greg).
 *
 * FORMULE -- UNE SEULE CONSTANTE (`MX_GRID_COLUMN_STEP_PX`), pas une table
 * de paliers arbitraires a maintenir a la main :
 *
 *   columns(largeur) = clamp(floor(largeur / MX_GRID_COLUMN_STEP_PX), 1, MX_GRID_MAX_COLUMNS)
 *
 * Chaque tranche de 200px de largeur de conteneur ajoute une colonne,
 * jusqu'a 8 (jamais plus, meme sur un tres grand ecran) ; en dessous de
 * 200px, toujours au moins 1. A l'interieur d'une tranche, le nombre de
 * colonnes ne bouge pas : seule la largeur des cartes (`1fr`) grandit avec
 * le conteneur -- exactement le comportement demande.
 *
 * CALIBRAGE DU SEUIL DES 8 COLONNES (1600px = 8 * 200) -- mesure REELLE
 * fournie par Greg (2026-10-10), console navigateur, page Artistes, plein
 * ecran : `innerWidth` = 1920px, `devicePixelRatio` = 1 (ecran Full HD, zoom
 * 100%, PAS de mise a l'echelle Windows -- correction d'une premiere
 * hypothese erronee de « zoom 80% », jamais consignee nulle part ailleurs
 * dans le depot). Largeur du conteneur de cartes a ces conditions, densite
 * Compacte (`--mx-scale: 0.9`), sidebar DEPLOYEE (hypothese la plus
 * defavorable -- repliee, il y a plus de place), barre de defilement
 * verticale Windows presente (non-overlay, 17px) :
 *
 *   1920                                  (fenetre, innerWidth)
 *   - 180   (--mx-sidebar-w = 200px * 0.9)
 *   - 17    (barre de defilement verticale, cas defavorable)
 *   - 37.8  (p-6 des deux cotes = 2 * 1.5rem * 0.9 * 14px, AppLayout.tsx)
 *   = 1685.2px disponibles
 *
 * Seuil retenu : 1600px (8 * 200) -- MARGE de 85.2px sous la valeur mesuree
 * (ni une largeur minimale a l'arrache comme l'ancien `auto-fill/minmax`,
 * sensible au pixel pres et seule cause plausible du defaut de recette :
 * 1685.2px franchit le seuil de 1600px avec une marge confortable, pas de
 * quelques pixels). A 1600px pile, 8 cartes de ~190.5px (gap compris) --
 * tres proche de la largeur de reference historique (198px, 220px * 0.9,
 * LOT ARTISTES-LISTE C2.4) : la LARGEUR de carte a 1600px n'a pas change de
 * philosophie, seule la METHODE (palier fixe, plus l'auto-fill fragile) a
 * change.
 *
 * Si Greg travaille un jour a une resolution/mise a l'echelle differente,
 * recalibrer uniquement `MX_GRID_COLUMN_STEP_PX` (ou la lecture ci-dessus) --
 * aucun autre fichier a toucher, c'est la SEULE source de verite du nombre
 * de colonnes (DOCTRINE-BARRE-OUTILS.md §5bis la cite par reference).
 */

/** Nombre maximal de colonnes, quelle que soit la largeur disponible. */
export const MX_GRID_MAX_COLUMNS = 8;

/** Largeur de conteneur (px) ajoutant une colonne -- voir calibrage ci-dessus. */
export const MX_GRID_COLUMN_STEP_PX = 200;

/**
 * Nombre de colonnes pour une largeur de conteneur donnee (px) -- fonction
 * PURE, aucun DOM, testable sans monter de composant. `width <= 0` (avant
 * toute mesure reelle, cf. `useContainerWidth`) retombe a 1, jamais a 0.
 */
export function columnsForWidth(width: number): number {
  if (width <= 0) return 1;
  const raw = Math.floor(width / MX_GRID_COLUMN_STEP_PX);
  return Math.min(MX_GRID_MAX_COLUMNS, Math.max(1, raw));
}

export default columnsForWidth;
