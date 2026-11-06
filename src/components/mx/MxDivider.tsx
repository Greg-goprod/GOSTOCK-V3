import type { CSSProperties } from 'react';

interface MxDividerProps {
  /** Marge verticale autour du filet. Aucune par defaut : c'est au parent d'espacer. */
  spacing?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * MxDivider — filet de separation de 1.5px (--mx-border-w).
 * Le pilote utilisait des `height: 1` : l'epaississement est voulu par le lot.
 */
export function MxDivider({ spacing, className, style }: MxDividerProps) {
  return (
    <div
      role="separator"
      className={className}
      style={{
        height: 'var(--mx-border-w)',
        background: 'var(--mx-border)',
        flexShrink: 0,
        ...(spacing ? { marginTop: spacing, marginBottom: spacing } : null),
        ...style,
      }}
    />
  );
}

export default MxDivider;
