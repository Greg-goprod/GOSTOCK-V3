import type { CSSProperties, ReactNode } from 'react';

import { MX_TONE_LINE, type MxMode, type MxTone } from './tokens';
import { MxSectionLabel } from './MxSectionLabel';

interface MxSectionProps {
  label?: ReactNode;
  /** Badge ou pastille pose a droite du label. */
  badge?: ReactNode;
  /** Actions alignees en fin de ligne de titre. */
  actions?: ReactNode;
  /**
   * Accentue la section : BORDURE GAUCHE de 3px dans la couleur pure du ton, et
   * rien d'autre. Le fond reste celui du panneau.
   * Aucun fond teinte, aucune bordure sur les 4 cotes, aucun rayon : c'est
   * exactement `.mx-dr-sec[data-accent]` du prototype de handoff
   * (padding-left 14px + border-left 3px solid <ton>).
   */
  accent?: MxTone;
  /**
   * Presente pour uniformiser la signature des blocs. En lecture, l'accent
   * retombe : un filet d'alerte n'a pas de sens sur des donnees figees, qui ne
   * demandent plus rien a l'utilisateur.
   */
  mode?: MxMode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** MxSection — regroupement titre + contenu, avec accent optionnel. */
export function MxSection({
  label,
  badge,
  actions,
  accent,
  mode = 'edit',
  children,
  className,
  style,
}: MxSectionProps) {
  const effectiveAccent = mode === 'read' ? undefined : accent;

  return (
    <section
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        // 14px : `.mx-dr-sec{gap:14px}` et `[data-accent]{padding-left:14px}`.
        // Absent de l'echelle, qui passe de 12 a 16 ; la valeur du handoff
        // prime sur l'arrondi. Les deux vont ENSEMBLE dans le handoff : le
        // retrait du filet accentue est cale sur le rythme vertical du bloc.
        gap: 'calc(14px * var(--mx-scale, 1))',
        ...(effectiveAccent
          ? {
              paddingLeft: 'calc(14px * var(--mx-scale, 1))',
              // 3px FIXE (correction C5, 2026-09-29) : c'est un TRAIT, pas une
              // taille — les traits ne suivent pas --mx-scale (seule exception
              // nommee au meme titre que --mx-border-w/-thin et le contour de
              // focus). Revient sur l'arbitrage C1, qui l'avait scale a tort.
              borderLeft: '3px solid ' + MX_TONE_LINE[effectiveAccent],
            }
          : null),
        ...style,
      }}
    >
      {label != null || badge != null || actions != null ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--mx-space-8)',
            flexWrap: 'wrap',
          }}
        >
          {label != null ? <MxSectionLabel>{label}</MxSectionLabel> : null}
          {badge}
          {actions != null ? (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--mx-space-8)' }}>
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export default MxSection;
