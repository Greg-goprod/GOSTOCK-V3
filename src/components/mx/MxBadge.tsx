import type { CSSProperties, ReactNode } from 'react';

import { MX_TEXT, MX_TONE_FILL, type MxTone } from './tokens';

/**
 * Bornage tranche 1 : le pilote ne consomme que `warning` et `info`, ce qui est
 * l'union complete du `Badge` console remplace. Le type reste ouvert sur MxTone
 * pour que les tons deja tokenises soient accessibles sans nouvelle primitive.
 */
interface MxBadgeProps {
  tone: MxTone;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * MxBadge — APLAT PLEIN sature : fond = couleur pure du ton, texte = contraste.
 * Ni bordure ni fond delave.
 * 10.5px/700, padding 2px 8px, tracking 0.04em, rayon 4px.
 */
export function MxBadge({ tone, children, className, style }: MxBadgeProps) {
  const fill = MX_TONE_FILL[tone];

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--mx-space-4)',
        padding: 'calc(2px * var(--mx-scale, 1)) var(--mx-space-8)',
        // 4px, et non les 3px de la table des rayons du README. Ce n'etait pas
        // une contradiction a arbitrer mais une question de contexte, tranchee
        // par la regle de priorite du 2026-09-23 : un badge de DRAWER releve de
        // `reference/mannyx-drawer.js`, qui pose 4px — tout comme le catalogue
        // de page. Le README garde la main sur le transversal, pas ici.
        borderRadius: 'var(--mx-radius-4)',
        background: fill.bg,
        color: fill.fg,
        whiteSpace: 'nowrap',
        ...MX_TEXT.badge,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export default MxBadge;
