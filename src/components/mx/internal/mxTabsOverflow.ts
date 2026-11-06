/**
 * mxTabsOverflow — interne au tronc, HORS BARREL (voir index.ts), meme
 * convention que useMxReducedMotion/mxIcon.
 *
 * EXTRAIT de MxTabs.tsx (LOT NAV-SECONDAIRE, C3, 2026-09-30) vers ce module
 * partage -- LOT ARTISTES-FICHE, B1 (2026-10-04, Greg) : MxTabPanels recoit
 * desormais le MEME traitement de debordement (degrade + bouton chevron) que
 * MxTabs, demande explicitement « meme traitement que MxTabs ». Plutot que de
 * dupliquer la mesure de debordement et le degrade dans les deux primitives,
 * seules les fonctions PURES (sans etat ni ref) sont extraites ici ; chaque
 * primitive garde ses propres hooks/refs/effets (ResizeObserver, ecouteur de
 * scroll), le besoin de les partager n'etant pas demontre pour l'instant --
 * a signaler si un 3e consommateur en a besoin.
 *
 * Valeurs et comportement INCHANGES par cette extraction : MxTabs.tsx importe
 * desormais ce module au lieu de definir ses propres constantes/fonctions,
 * ses tests restent verts sans aucune modification.
 */

/**
 * Epsilon anti-arrondi (1px) : `scrollLeft`/`scrollWidth`/`clientWidth` sont
 * des entiers arrondis par le navigateur, un ecart de 0-1px entre eux au
 * repos (police sous-pixel, zoom navigateur...) ne doit jamais etre lu comme
 * un « debordement » fantome qui afficherait un degrade/bouton pour rien.
 */
export const OVERFLOW_EPSILON = 1;

export interface TabsOverflow {
  left: boolean;
  right: boolean;
}

export const NO_OVERFLOW: TabsOverflow = { left: false, right: false };

export function measureOverflow(el: HTMLElement): TabsOverflow {
  const { scrollLeft, scrollWidth, clientWidth } = el;
  return {
    left: scrollLeft > OVERFLOW_EPSILON,
    right: scrollLeft + clientWidth < scrollWidth - OVERFLOW_EPSILON,
  };
}

/**
 * Compare AVANT de poser un nouvel objet en etat : `measureOverflow` cree une
 * nouvelle reference a chaque appel, ce qui declencherait un re-rendu a
 * chaque montage/scroll/redimensionnement meme quand rien n'a change (deux
 * booleens identiques). Renvoyer `prev` (meme reference) laisse React
 * l'ignorer ("bail out"), au lieu d'un rendu supplementaire qui appellerait
 * `renderLink`/le panneau une seconde fois pour rien.
 */
export function sameOverflow(a: TabsOverflow, b: TabsOverflow): boolean {
  return a.left === b.left && a.right === b.right;
}

/**
 * `mask-image` degrade sur le(s) bord(s) ou il reste du contenu masque par le
 * defilement — jamais sur un bord sans contenu cache (« rien n'apparait sans
 * debordement », exigence explicite de Greg, C3). Largeur du degrade calee
 * sur `--mx-iconbtn-size` (32px * --mx-scale) : le degrade s'arrete
 * exactement ou le bouton chevron, de meme largeur, viendra se poser.
 */
export function buildFadeMask(overflow: TabsOverflow): string | undefined {
  if (!overflow.left && !overflow.right) return undefined;
  const stops = [
    overflow.left ? 'transparent' : 'black',
    ...(overflow.left ? ['black var(--mx-iconbtn-size)'] : []),
    ...(overflow.right ? ['black calc(100% - var(--mx-iconbtn-size))'] : []),
    overflow.right ? 'transparent' : 'black',
  ];
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
