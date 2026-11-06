import type { MxDrawerSize } from './MxDrawer';

/**
 * Règle de choix de largeur — LOT DRAWER-MODELE M2 (2026-10-11).
 * Aucune largeur en pixels dans un drawer Mx : uniquement size={cran}.
 */
export const MX_DRAWER_SIZE_CHOICES: Record<
  MxDrawerSize,
  { token: string; role: string }
> = {
  sm: {
    token: '--mx-drawer-w-sm (360)',
    role: 'Outil compact (notifications — exception documentée)',
  },
  md: {
    token: '--mx-drawer-w-md (420)',
    role: 'Formulaire court (prolongation, produit économat, user RBAC)',
  },
  lg: {
    token: '--mx-drawer-w-lg (520)',
    role: 'Formulaire moyen, consultation (détail voyage)',
  },
  xl: {
    token: '--mx-drawer-w-xl (680)',
    role: 'Formulaire riche, envoi avec aperçu, décompte, facture',
  },
  xxl: {
    token: '--mx-drawer-w-xxl (800)',
    role: 'Fiche d’entité à onglets (offre, contrat, artiste)',
  },
  full: {
    token: '--mx-drawer-w-full (960)',
    role: 'Import / revue large (mapping invités)',
  },
};

export type MxDrawerSizeChoice = keyof typeof MX_DRAWER_SIZE_CHOICES;
