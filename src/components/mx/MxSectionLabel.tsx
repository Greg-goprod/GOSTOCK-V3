import type { CSSProperties, ReactNode } from 'react';

import { MX_TEXT } from './tokens';

interface MxSectionLabelProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * MxSectionLabel — label de section discret (11px / 700 / 0.08em / majuscules).
 * Remplace le helper local `SectionLabel` du drawer pilote.
 */
export function MxSectionLabel({ children, className, style }: MxSectionLabelProps) {
  return (
    <span
      className={className}
      style={{ ...MX_TEXT.sectionLabel, color: 'var(--mx-text3)', ...style }}
    >
      {children}
    </span>
  );
}

export default MxSectionLabel;
