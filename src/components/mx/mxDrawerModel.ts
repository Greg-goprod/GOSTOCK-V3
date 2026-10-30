import type { ReactNode } from 'react';

import type { MxDrawerFormFooterConfig } from './MxFormActionFooter';

/** Entité liée à un artiste — avatar obligatoire (initiales si pas de photo). */
export interface MxDrawerLinkedArtist {
  name: string;
  src?: string | null;
}

export type MxDrawerFooterVariant = 'entity' | 'form';

export interface MxDrawerModelFooterProps {
  footerVariant?: MxDrawerFooterVariant;
  /** Famille (a) — contenu typiquement MxEntityActionFooter ou wrapper métier. */
  entityFooter?: ReactNode;
  /** Famille (b) — actions typées. */
  formFooter?: MxDrawerFormFooterConfig;
  /** Legacy — allowlist jusqu'à migration complète (LOT DRAWER-MODELE M1). */
  footer?: ReactNode;
}
