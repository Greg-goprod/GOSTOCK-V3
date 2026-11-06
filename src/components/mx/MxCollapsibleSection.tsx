import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';

import { MX_TEXT } from './tokens';
import { MxBadge } from './MxBadge';
import { readMxViewMode, writeMxViewMode } from './mxViewModeStorage';

// LOT SECTIONS-REPLIABLES (Greg, 18/10/2026). Constat : les sections
// « sorties du circuit » (Contrats annulés, Offres refusées) n'etaient PAS
// presentees pareil -- accordeon repli (Contrats), accordeon d'un autre
// style (Offres « Qui doit agir »), bloc toujours ouvert et teinte d'alerte
// (Offres « Par jour »). Decision de Greg : UN SEUL composant, meme
// en-tete partout (chevron, icone, titre, compteur neutre -- AUCUNE
// couleur d'alerte), replie par defaut, etat memorise par page.
//
// Reprend le style du bouton de `CollapsibleGroup`
// (OffersActionViewMx.tsx) et de `GroupHeader` (meme fichier) -- UNIQUE
// definition desormais, les deux anciens motifs ad hoc disparaissent au
// profit de celui-ci.
//
// DEUX MODES :
// - non controle (defaut) : etat possede ICI, persiste sous `storageKey`
//   (localStorage proteg par try/catch, cf. `mxViewModeStorage.ts` --
//   meme fonction generique que le bascule cartes/liste, reutilisee telle
//   quelle plutot que dupliquee).
// - controle (`open`+`onToggle` fournis) : l'appelant possede l'etat --
//   necessaire pour Contrats, dont le repli obeit a une regle metier
//   existante (G3, 2026-10-09 : ouvert par defaut tant qu'une annulation
//   SIGNEE n'est pas reglee) PARTAGEE avec la branche Legacy -- la source
//   de verite reste `contrats.tsx`, ce composant n'en est que l'habillage
//   visuel commun.
export interface MxCollapsibleSectionProps {
  title: string;
  count: number;
  icon?: LucideIcon;
  children: ReactNode;
  /** Mode non controle : cle de persistance (obligatoire hors mode controle). */
  storageKey?: string;
  /** Mode non controle : etat initial si rien n'est encore memorise. Defaut : replie. */
  defaultOpen?: boolean;
  /** Mode controle : etat possede par l'appelant (avec `onToggle`). */
  open?: boolean;
  onToggle?: (next: boolean) => void;
  className?: string;
}

const OPEN_VALUES = ['open', 'closed'] as const;

function useUncontrolledOpenState(storageKey: string | undefined, defaultOpen: boolean) {
  const [open, setOpen] = useState<boolean>(() => {
    if (!storageKey) return defaultOpen;
    return readMxViewMode(storageKey, OPEN_VALUES, defaultOpen ? 'open' : 'closed') === 'open';
  });
  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (storageKey) writeMxViewMode(storageKey, next ? 'open' : 'closed');
      return next;
    });
  };
  return { open, toggle };
}

/**
 * MxCollapsibleSection — en-tete UNIQUE pour une section « sortie du
 * circuit » (repliable, compteur neutre, aucune couleur d'alerte). Le
 * CONTENU (cartes `MxEntityCard` ou `MxTable`) reste au choix de
 * l'appelant, passe en `children` -- ce composant ne decide que du
 * repli/depli et de l'en-tete.
 */
export function MxCollapsibleSection({
  title,
  count,
  icon: Icon,
  children,
  storageKey,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  className,
}: MxCollapsibleSectionProps) {
  const isControlled = controlledOpen !== undefined && onToggle !== undefined;
  const uncontrolled = useUncontrolledOpenState(storageKey, defaultOpen);
  const open = isControlled ? controlledOpen : uncontrolled.open;
  const toggle = isControlled ? () => onToggle(!controlledOpen) : uncontrolled.toggle;

  return (
    <section className={className} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mx-space-12)' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        data-mx-focus=""
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--mx-space-8)',
          width: '100%',
          padding: 'var(--mx-space-8) var(--mx-space-12)',
          background: 'var(--mx-surface2)',
          border: 'var(--mx-border-w) solid var(--mx-border)',
          borderRadius: 'var(--mx-radius-8)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {open ? (
          <ChevronDown style={{ width: 18, height: 18, color: 'var(--mx-text3)' }} aria-hidden="true" />
        ) : (
          <ChevronRight style={{ width: 18, height: 18, color: 'var(--mx-text3)' }} aria-hidden="true" />
        )}
        {Icon ? <Icon style={{ width: 16, height: 16, color: 'var(--mx-text3)' }} aria-hidden="true" /> : null}
        <span
          style={{
            ...MX_TEXT.blockTitle,
            color: 'var(--mx-text)',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}
        >
          {title}
        </span>
        <MxBadge tone="neutral">{count}</MxBadge>
      </button>
      {open ? children : null}
    </section>
  );
}

export default MxCollapsibleSection;
