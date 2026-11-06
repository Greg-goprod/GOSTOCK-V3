import type { CSSProperties } from 'react';

/**
 * GROUP_LABEL_STYLE — libelle de groupe partage entre MxMenu (`.dd-group-label`
 * du catalogue) et MxSubNav (LOT NAV-SECONDAIRE, B1, 2026-09-30). EXTRAIT de
 * MxMenu.tsx (jusque-la prive, non exporte) plutot que duplique : les deux
 * primitives rendent la meme typographie de titre de groupe (majuscules,
 * poids 700, tracking large) au-dessus d'une liste d'items, sans qu'aucune
 * n'ait de raison de deriver de l'autre visuellement.
 *
 * Valeur INCHANGEE (copie exacte) : MxMenu.tsx importe desormais ce module au
 * lieu de definir sa propre constante — ses tests restent verts sans aucune
 * modification, la substitution est purement structurelle.
 */
export const GROUP_LABEL_STYLE: CSSProperties = {
  padding:
    'calc(6px * var(--mx-scale, 1)) calc(14px * var(--mx-scale, 1)) calc(3px * var(--mx-scale, 1))',
  fontFamily: 'var(--mx-font-ui)',
  fontWeight: 700,
  fontSize: 'var(--mx-fs-menu-group-label)',
  lineHeight: 1,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--mx-text3)',
};
