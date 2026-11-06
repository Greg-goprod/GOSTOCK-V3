import type { CSSProperties } from 'react';

/**
 * mxIcon — interne au tronc, HORS BARREL (voir index.ts), meme convention que
 * useMxReducedMotion.
 *
 * Dimensionne par TOKEN une icone Lucide que le tronc rend LUI-MEME (jamais
 * une icone recue en prop — celles-ci restent au choix de l'appelant, comme
 * `leftIcon` de MxButton ou `icon` de MxNote/MxEmpty : le tronc ne peut pas
 * imposer une taille a un ReactNode deja instancie).
 *
 * Consomme en `style`, jamais en `size={N}` : le style CSS l'emporte sur
 * l'attribut `size` d'un composant Lucide (qui pose `width`/`height` en
 * ATTRIBUT SVG), donc `style={mxIconBox('sm')}` suffit seul — `size` peut
 * etre omis. Valeurs dans src/styles/tokens-mx.css, bloc « ICONES ET HAUTEUR
 * DE CONTROLE ».
 *
 * Garde ESLint (eslint.config.js) : `size={<litteral numerique>}` est
 * interdit dans ce repertoire, hors src/components/mx/__demo__ (la demo
 * instancie des icones comme le ferait n'importe quel APPELANT du tronc
 * ailleurs dans l'app — c'est le meme cas que `leftIcon`/`icon` ci-dessus,
 * pas une icone du tronc lui-meme).
 */
export type MxIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const MX_ICON_VAR: Record<MxIconSize, string> = {
  xs: 'var(--mx-icon-xs)',
  sm: 'var(--mx-icon-sm)',
  md: 'var(--mx-icon-md)',
  lg: 'var(--mx-icon-lg)',
  xl: 'var(--mx-icon-xl)',
};

export function mxIconBox(size: MxIconSize): CSSProperties {
  const dim = MX_ICON_VAR[size];
  return { width: dim, height: dim };
}
