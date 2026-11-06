import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal } from 'lucide-react';

import { MxButton, type MxButtonVariant } from './MxButton';
import { MxIconButton } from './MxIconButton';
import { MxMenu, type MxMenuAction } from './MxMenu';

/** Action visible dans le pied entité (primaire ou ghost). */
export interface MxEntityActionItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  variant?: MxButtonVariant;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}

export interface MxEntityActionFooterProps {
  /** Boutons visibles, ordre gauche → droite ; le dernier est l'action principale (variant primary). */
  primary: MxEntityActionItem[];
  overflow?: MxEntityActionItem[];
  /** Contenu après les boutons visibles. */
  trailing?: ReactNode;
  overflowMenuLabel?: string;
  overflowTriggerLabel?: string;
  /**
   * `'spread'` (defaut) : le menu « ··· » est plaque a gauche, les boutons a
   * droite -- ETIRE sur toute la largeur disponible (pied de drawer, qui a
   * naturellement la largeur de la fenetre). `'pack'` : menu + boutons +
   * `trailing` forment UN SEUL groupe, aligne a droite, le menu
   * immediatement a gauche du premier bouton visible -- pour une colonne de
   * tableau a largeur FIXE (LOT TABLE-MODELE, C1, 2026-10-16) : en `spread`,
   * un conteneur etroit fait deborder le groupe de boutons PAR DESSUS le
   * menu (`justify-content:flex-end` deborde cote debut quand le contenu
   * est plus large que la boite), ce qui faisait disparaitre visuellement
   * le « ··· » sur les lignes a 3 boutons primaires (ex. offre « Envoyee » :
   * Accepter/Refuser/Renvoyer). Voir `OfferMxRowActionsBar.tsx`.
   */
  layout?: 'spread' | 'pack';
}

function resolveVisibleVariant(
  item: MxEntityActionItem,
  index: number,
  total: number,
): MxButtonVariant {
  // LOT OFFRES-CYCLE, C1.4 (Greg, 2026-10-17) : un ton explicite
  // (succes/danger -- definition UNIQUE de l'action, ex. "Valider sans
  // renvoi" en vert, "Refuser" en rouge) est TOUJOURS respecte, quelle que
  // soit sa position -- y compris "derniere action visible", normalement
  // promue en primary/bleu ci-dessous. Seules `primary`/`ghost`/`accentSoft`/
  // absent restent soumis a la promotion par position (comportement
  // INCHANGE pour tous les appelants existants).
  if (item.variant === 'success' || item.variant === 'danger') return item.variant;
  if (total <= 1) return item.variant ?? 'primary';
  if (index === total - 1) return 'primary';
  if (item.variant === 'primary') return 'ghost';
  return item.variant ?? 'ghost';
}

/**
 * Pied famille (a) — menu « ··· » à gauche ; secondaires puis primaire à droite.
 */
export function MxEntityActionFooter({
  primary,
  overflow = [],
  trailing,
  overflowMenuLabel = 'Autres actions',
  overflowTriggerLabel = 'Autres actions',
  layout = 'spread',
}: MxEntityActionFooterProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuActions: MxMenuAction[] = overflow
    .filter((item) => !item.disabled)
    .map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      onSelect: item.onClick,
      // LOT OFFRES-CYCLE, C1.4 (Greg, 2026-10-17) : ton explicite (succes/
      // danger) transmis tel quel au menu "..." -- meme definition d'action
      // que les boutons visibles (`resolveVisibleVariant` ci-dessus).
      tone:
        item.variant === 'success' || item.variant === 'danger' ? item.variant : undefined,
    }));

  const overflowTrigger =
    menuActions.length > 0 ? (
      <MxMenu
        id="mx-entity-action-footer-overflow"
        open={menuOpen}
        onOpenChange={setMenuOpen}
        groups={[]}
        label={overflowMenuLabel}
        actions={menuActions}
        renderTrigger={(triggerProps) => (
          <MxIconButton
            icon={MoreHorizontal}
            aria-label={overflowTriggerLabel}
            title={overflowTriggerLabel}
            {...triggerProps}
          />
        )}
      />
    ) : null;

  const buttons = primary.map((item, index) => (
    <MxButton
      key={item.id}
      variant={resolveVisibleVariant(item, index, primary.length)}
      leftIcon={item.icon}
      onClick={item.onClick}
      disabled={item.disabled}
      title={item.title}
    >
      {item.label}
    </MxButton>
  ));

  if (layout === 'pack') {
    // Un SEUL groupe (menu + boutons + trailing), aligne a droite -- le menu
    // colle au premier bouton visible, plutot que plaque au bord oppose du
    // conteneur. Voir le commentaire de `layout` dans les props.
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 'var(--mx-space-8)',
          flexWrap: 'nowrap',
          minWidth: 0,
          width: '100%',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {overflowTrigger}
        {buttons}
        {trailing}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--mx-space-8)',
        flexWrap: 'nowrap',
        minWidth: 0,
        width: '100%',
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {overflowTrigger}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 'var(--mx-space-8)',
          flexWrap: 'nowrap',
          minWidth: 0,
          flex: 1,
        }}
      >
        {buttons}
        {trailing}
      </div>
    </div>
  );
}

export default MxEntityActionFooter;
