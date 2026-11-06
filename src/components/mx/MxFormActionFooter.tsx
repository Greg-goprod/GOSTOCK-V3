import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal, Trash2 } from 'lucide-react';

import { MxButton } from './MxButton';
import { MxIconButton } from './MxIconButton';
import { MxMenu, type MxMenuAction } from './MxMenu';
import type { MxEntityActionItem } from './MxEntityActionFooter';

/** Configuration du pied famille (b) — formulaire / envoi. */
export interface MxDrawerFormFooterConfig {
  cancelLabel?: string;
  onCancel: () => void;
  cancelDisabled?: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryLeftIcon?: LucideIcon;
  /**
   * LOT NON-ABOUTIES -- RECETTE 2, point A3 (Greg, 2026-10-28) : rendu
   * desormais en BOUTON TEXTE visible (ton danger), plus en icone seule --
   * `deleteLabel` (texte du bouton) remplace l'ancien `deleteAriaLabel`
   * (icone sans texte). Meme confirmation qu'avant (`onClick` inchange,
   * a la charge de l'appelant).
   */
  onDelete?: () => void;
  deleteDisabled?: boolean;
  /** Defaut `'Supprimer'`. */
  deleteLabel?: string;
  /**
   * Actions secondaires VISIBLES, entre Annuler et Supprimer/Enregistrer --
   * LOT NON-ABOUTIES -- RECETTE 2, point A3 (Greg, 2026-10-28). MEME type
   * que `overflow` ci-dessous (`MxEntityActionItem`) : un ton explicite
   * (ex. `variant: 'danger'` pour "Clore") est respecte tel quel, sinon
   * `'ghost'` par defaut (meme regle que les boutons visibles de
   * `MxEntityActionFooter`, sans la promotion automatique en primary --
   * la seule action principale du pied formulaire reste `onPrimary`).
   */
  secondaryActions?: MxEntityActionItem[];
  /**
   * Actions secondaires dans un menu « ··· » a GAUCHE -- LOT
   * BOOKING-DRAWERS-FIN, LOT 2, C1.7 (Greg, 2026-10-18). MEME type que le
   * menu de `MxEntityActionFooter` (`MxEntityActionItem`) : aucune
   * duplication, le pied formulaire n'a pas besoin d'une variante visible
   * (`primary`/`ghost`), seul `onClick`/`icon`/`label`/`disabled` servent
   * ici. Absent ou vide : aucun menu rendu (rendu INCHANGE pour tous les
   * appelants existants -- `ArtistDrawerMx`, etc.) -- y compris quand
   * `secondaryActions` vide son dernier element restant (point A3,
   * PerformanceModal : "Clore" quitte ce menu pour devenir visible, le
   * menu "..." disparait alors de lui-meme, aucun changement de rendu ici).
   */
  overflow?: MxEntityActionItem[];
  overflowMenuLabel?: string;
  overflowTriggerLabel?: string;
}

/**
 * Pied famille (b) — menu « ··· » a gauche (optionnel) ; secondaires puis
 * action principale à droite (aligné entité).
 */
export function MxFormActionFooter({
  cancelLabel = 'Annuler',
  onCancel,
  cancelDisabled = false,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  primaryLeftIcon,
  onDelete,
  deleteDisabled = false,
  deleteLabel = 'Supprimer',
  secondaryActions = [],
  overflow = [],
  overflowMenuLabel = 'Autres actions',
  overflowTriggerLabel = 'Autres actions',
}: MxDrawerFormFooterConfig) {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuActions: MxMenuAction[] = overflow
    .filter((item) => !item.disabled)
    .map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      onSelect: item.onClick,
    }));

  const overflowTrigger =
    menuActions.length > 0 ? (
      <MxMenu
        id="mx-form-action-footer-overflow"
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

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--mx-space-8)',
        width: '100%',
      }}
    >
      {overflowTrigger}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 'var(--mx-space-8)',
          flex: 1,
        }}
      >
        <MxButton variant="ghost" onClick={onCancel} disabled={cancelDisabled}>
          {cancelLabel}
        </MxButton>
        {secondaryActions.map((action) => (
          <MxButton
            key={action.id}
            variant={action.variant ?? 'ghost'}
            leftIcon={action.icon}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.title}
          >
            {action.label}
          </MxButton>
        ))}
        {onDelete ? (
          <MxButton
            variant="danger"
            leftIcon={Trash2}
            onClick={onDelete}
            disabled={deleteDisabled}
          >
            {deleteLabel}
          </MxButton>
        ) : null}
        <MxButton
          variant="primary"
          leftIcon={primaryLeftIcon}
          onClick={onPrimary}
          disabled={primaryDisabled || primaryLoading}
        >
          {primaryLoading ? 'Enregistrement…' : primaryLabel}
        </MxButton>
      </div>
    </div>
  );
}

export default MxFormActionFooter;
