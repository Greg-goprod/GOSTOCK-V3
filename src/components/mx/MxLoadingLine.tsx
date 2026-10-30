import type { CSSProperties, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { MX_TEXT } from './tokens';
import { mxIconBox } from './internal/mxIcon';

interface MxLoadingLineProps {
  /** Message de chargement. Fourni par l'appelant : aucun texte en dur ici. */
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * MxLoadingLine — ligne d'attente avec rouet.
 * Remplace le helper local `LoadingLine` du drawer pilote. Colore en --mx-text2
 * (et non --mx-text3) car c'est le seul contenu visible pendant le chargement.
 */
export function MxLoadingLine({ children, className, style }: MxLoadingLineProps) {
  return (
    <div
      className={className}
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--mx-space-8)',
        ...MX_TEXT.body,
        color: 'var(--mx-text2)',
        ...style,
      }}
    >
      <Loader2 style={mxIconBox('sm')} className="animate-spin" aria-hidden="true" />
      {children}
    </div>
  );
}

export default MxLoadingLine;
