import type { CSSProperties, ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { MxIconButton } from './MxIconButton';
import { MxNavItem, type MxNavItemData, type MxNavLinkProps } from './MxNavItem';
import { useMxReducedMotion } from './internal/useMxReducedMotion';

/**
 * MxSidebar — barre laterale de navigation. LOT CADRE, B2 (2026-09-30).
 *
 * COMPOSE `MxNavItem` (voir son commentaire de tete de fichier pour les
 * etats/tokens de chaque entree) — cette primitive ne porte QUE la structure
 * (en-tete, liste, pied) et le repli, jamais la logique de droits/route
 * active/persistance : exactement comme `MxTabs` ne recalcule jamais
 * `isActive`, `MxSidebar` reçoit `items` DEJA resolus (icone/libelle/
 * isActive/disabled) — absorbe sans cas particulier la logique actuelle
 * d'AppLayout.tsx (can/canModule, match/exact/startsWith, firstAllowedPath,
 * persistance localStorage), qui reste entierement du cote de l'appelant.
 *
 * AUCUN LIBELLE EN DUR (regle du tronc, voir index.ts) : les 2 textes du
 * bouton de repli (« Ouvrir »/« Reduire » aujourd'hui, AppLayout.tsx) sont
 * des props (`expandLabel`/`collapseLabel`), poses en aria-label ET title —
 * meme motif que `ThemeToggleSwitcher` (l'aria-label decrit l'etat VERS
 * LEQUEL le clic bascule, pas l'etat courant).
 *
 * EN-TETE : REPLIE, seul le bouton de bascule est rendu (centre) — le slot
 * `logo` disparait entierement, jamais juste masque en CSS (`display:none`
 * suffirait visuellement mais laisserait un lien logo focusable/annonce par
 * un lecteur d'ecran sans raison, meme replie) ; DEPLIE, logo a gauche,
 * bouton a droite (`justify-content:space-between`) — reproduit exactement
 * la structure actuelle (AppLayout.tsx, bloc `{collapsed ? (...) : (...)}`).
 *
 * LARGEUR EN TOKENS (`--mx-sidebar-w`/`-collapsed`, tokens-mx.css) — PAS de
 * prop `width` : ce sont les 2 SEULES largeurs que cette primitive connaisse,
 * au meme titre que MxButton n'a qu'une taille. `position:fixed` + `top`/
 * `left` explicites (0/0) plutot que de compter sur le placement "statique"
 * implicite d'un `fixed` sans inset (comportement CSS correct mais fragile,
 * jamais explicite dans l'AppLayout.tsx actuel) — l'appelant compense
 * toujours lui-meme la largeur par un `marginLeft` egal sur sa zone
 * principale, ce lot ne change rien a ce contrat.
 *
 * TRANSITION DE LARGEUR SOUS MOUVEMENT REDUIT : supprimee entierement (pas
 * seulement accourcie) sous `prefers-reduced-motion:reduce` — la largeur
 * change alors instantanement, meme motif que MxButton/MxMenu/MxIconButton
 * (useMxReducedMotion). `--mx-dur-toggle` (0.2s) : DEJA la duree de la
 * bascule de MxToggles (interrupteur), meme ordre de grandeur qu'une
 * bascule de panneau, reprise plutot qu'une nouvelle duree inventee — et
 * c'est aussi la duree litterale (`0.2s ease`) du repli actuel
 * d'AppLayout.tsx.
 */

export interface MxSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** aria-label/title du bouton de repli QUAND replie (le clic va deplier). */
  expandLabel: string;
  /** aria-label/title du bouton de repli QUAND deplie (le clic va replier). */
  collapseLabel: string;
  /** Slot libre — rendu UNIQUEMENT deplie, voir le commentaire de tete de fichier. */
  logo: ReactNode;
  /** `aria-label` du `<nav>` — identifie le groupe pour un lecteur d'ecran. */
  navLabel: string;
  items: MxNavItemData[];
  renderLink: (item: MxNavItemData, linkProps: MxNavLinkProps) => ReactNode;
  /** Pied — ex. UserMenuSwitcher, rendu tel quel quel que soit `collapsed`. */
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function MxSidebar({
  collapsed,
  onToggleCollapsed,
  expandLabel,
  collapseLabel,
  logo,
  navLabel,
  items,
  renderLink,
  footer,
  className,
  style,
}: MxSidebarProps) {
  const reduced = useMxReducedMotion();

  return (
    <aside
      className={className}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: collapsed ? 'var(--mx-sidebar-w-collapsed)' : 'var(--mx-sidebar-w)',
        background: 'var(--mx-surface)',
        borderRight: 'var(--mx-border-w-thin) solid var(--mx-border)',
        boxShadow: 'var(--mx-elev-1)',
        transition: reduced ? 'none' : 'width var(--mx-dur-toggle) ease',
        ...style,
      }}
    >
      {/* En-tete : logo + bouton de repli, voir le commentaire de tete de fichier. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: `var(--mx-space-16) var(--mx-space-16) var(--mx-space-8)`,
          flexShrink: 0,
        }}
      >
        {!collapsed ? logo : null}
        <MxIconButton
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          aria-label={collapsed ? expandLabel : collapseLabel}
          title={collapsed ? expandLabel : collapseLabel}
          onClick={onToggleCollapsed}
        />
      </div>

      {/* Liste de navigation. */}
      <nav
        aria-label={navLabel}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 'calc(2px * var(--mx-scale, 1))',
          overflowY: 'auto',
          padding: 'var(--mx-space-8)',
        }}
      >
        {items.map((item) => (
          <MxNavItem key={item.id} item={item} collapsed={collapsed} renderLink={renderLink} />
        ))}
      </nav>

      {/* Pied — slot libre (ex. UserMenuSwitcher). */}
      {footer ? (
        <div
          style={{
            flexShrink: 0,
            marginTop: 'auto',
            padding: 'var(--mx-space-12) var(--mx-space-8)',
            borderTop: 'var(--mx-border-w-thin) solid var(--mx-border)',
          }}
        >
          {footer}
        </div>
      ) : null}
    </aside>
  );
}

export default MxSidebar;
