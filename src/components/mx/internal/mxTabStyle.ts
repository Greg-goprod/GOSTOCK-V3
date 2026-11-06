import type { CSSProperties } from 'react';

/**
 * mxTabStyle — style PARTAGE entre MxTabs (liens de navigation, LOT
 * NAV-PRIMITIVES-3A) et MxTabPanels (panneaux ARIA, LOT CONTRATS B2 C4.3,
 * 2026-10-02) — EXTRAIT de MxTabs.tsx (`ITEM_BASE`, jusque-la prive) plutot
 * que duplique : Greg demande une « apparence IDENTIQUE » entre les deux
 * primitives (majuscules, soulignement, icones, compteurs optionnels), seule
 * leur semantique ARIA diffère (liens vs. tablist/tab/tabpanel — decision
 * documentee en tete de MxTabs.tsx, non remise en cause ici : MxTabs reste
 * une liste de liens, MxTabPanels est le SEUL des deux a porter les roles
 * tablist/tab/tabpanel).
 *
 * MxTabs.tsx importe desormais ce module au lieu de definir sa propre
 * constante — valeur INCHANGEE (copie exacte), ses tests restent verts sans
 * aucune modification.
 */
export const MX_TAB_ITEM_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--mx-space-8)',
  // 8px/14px : `.mx-dr-tab` du catalogue (`padding:8px 14px`). 14px absent de
  // l'echelle --mx-space-* (qui passe de 12 a 16) ; la valeur du catalogue
  // prime sur l'arrondi, meme precedent que le padding-left de MxSection.
  padding: 'var(--mx-space-8) calc(14px * var(--mx-scale, 1))',
  fontFamily: 'var(--mx-font-ui)',
  // 13px : --mx-fs-item, le token --mx-fs le plus proche (correspondance
  // EXACTE, aucun arrondi necessaire).
  fontSize: 'var(--mx-fs-item)',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  flexShrink: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
};

export interface MxTabVisualState {
  isActive: boolean;
  hovered: boolean;
}

/** Couleur de texte selon l'etat (actif > survol > repos) — IDENTIQUE aux deux primitives. */
export function mxTabColor({ isActive, hovered }: MxTabVisualState): string {
  return isActive ? 'var(--mx-accent)' : hovered ? 'var(--mx-text)' : 'var(--mx-text3)';
}

/** Style complet de l'item ACTIVABLE (ni disabled) : couleur, poids, soulignement 2px. */
export function mxTabItemStyle(state: MxTabVisualState): CSSProperties {
  return {
    ...MX_TAB_ITEM_BASE,
    color: mxTabColor(state),
    // 600/400 : `.mx-dr-tab[active]` du catalogue pose 600, l'inactif ne pose
    // rien (donc 400, le poids par defaut).
    fontWeight: state.isActive ? 600 : 400,
    cursor: 'pointer',
    // 2px FIXE (trait) : soulignement, litteral comme --mx-border-w/-thin.
    borderBottom: '2px solid ' + (state.isActive ? 'var(--mx-accent)' : 'transparent'),
  };
}

/** Style de l'item DESACTIVE (span non focalisable) — meme rendu que MxTabs. */
export const MX_TAB_DISABLED_STYLE: CSSProperties = {
  ...MX_TAB_ITEM_BASE,
  color: 'var(--mx-text3)',
  fontWeight: 400,
  cursor: 'not-allowed',
  borderBottom: '2px solid transparent',
};

// Compteur optionnel (« icones, compteurs optionnels » demande par Greg pour
// MxTabPanels, C4.3) : AUCUN style dedie ici — reutilise `MxCountBadge`
// (deja dans le tronc, LOT NOTIFICATIONS B1) plutot qu'une pastille
// dupliquee, meme principe que l'extraction ci-dessus (ne pas recopier une
// valeur qui existe deja ailleurs dans le tronc).
