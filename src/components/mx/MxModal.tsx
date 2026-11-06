import { useId, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';

import { MxPortal } from './MxPortal';
import { MX_TEXT, MX_Z } from './tokens';
import { useMxReducedMotion } from './internal/useMxReducedMotion';
import { useMxLayeredDialog } from './internal/useMxLayeredDialog';
import { mxIconBox } from './internal/mxIcon';

/**
 * MxModal — LOT MODALE B3 (2026-10-02). Deuxieme consommateur du mecanisme
 * partage `internal/useMxLayeredDialog` (le premier est MxDrawer, voir son
 * en-tete) : role="dialog"/"alertdialog" + aria-modal, piege de focus, Echap
 * et clic de voile GATES PAR LA MEME GARDE (isTopLayer), focus initial (cas
 * « monte deja ouvert » compris) et restitution du focus. Remplace les
 * modales AURA (aura/Modal, aura/DraggableModal) sans les modifier.
 *
 * GEOMETRIE — reference/Mannyx Components V2.html, section #s-modals :
 * rayon 6px (`--mx-radius-6`), ombre `--mx-shadow-lg`, en-tete 16/20px avec
 * filet bas et titre 14/700, croix de fermeture en cercle 24px, corps 20px.
 * Fermeture au clic sur le voile ET a Echap si `dismissible` (defaut `true`)
 * — le catalogue ferme au clic contrairement a `aura/Modal` actuel
 * (« PAS de fermeture au clic », commentaire de ce fichier) : c'est le
 * catalogue qui fait foi pour MxModal, pas le comportement AURA en place.
 *
 * CENTRAGE, PAS D'ANCRAGE A UN BORD. Contrairement a MxDrawer (ancre a un
 * cote de l'ecran), MxModal se centre dans le viewport : voile et panneau
 * restent deux freres directs de MxPortal (meme motif que MxDrawer, pas de
 * `onClick`/`stopPropagation` imbrique), le panneau se positionnant par
 * `top/left: 50%` + `translate(-50%, -50%)`.
 *
 * `showHeader` (defaut `true`) : masque l'en-tete standard (titre + croix)
 * quand un consommateur a besoin de composer son propre contenu centre —
 * seul MxConfirmDialog (ci-dessous) s'en sert a ce jour. Le nom accessible
 * bascule alors d'`aria-labelledby` (en-tete visible) a `aria-label` direct
 * (`title` reste donc TOUJOURS requis, visible ou non).
 *
 * `zLayer` (defaut `'modal'`) : couche d'empilement interne, PAS pour un
 * usage courant — voir le commentaire de MX_Z.alert(Scrim) dans tokens.ts.
 * `'alert'` est reserve a MxConfirmDialog, qui doit rester au-dessus des
 * modales AURA relevees a la main. Toute autre MxModal reste sur `'modal'`.
 */

export type MxModalSize = 'sm' | 'md' | 'lg' | 'xl';

const MX_MODAL_WIDTH: Record<MxModalSize, string> = {
  sm: 'var(--mx-modal-w-sm)',
  md: 'var(--mx-modal-w-md)',
  lg: 'var(--mx-modal-w-lg)',
  xl: 'var(--mx-modal-w-xl)',
};

/** Meme semantique que MxDrawerTheme : ilot `data-theme` pose sur le PANNEAU seul. */
export type MxModalTheme = 'inherit' | 'dark' | 'light';

export interface MxModalProps {
  open: boolean;
  onClose: () => void;
  /** Nom accessible, TOUJOURS requis — visible (en-tete) ou non (aria-label), voir `showHeader`. */
  title: string;
  /** Defaut `true`. `false` : masque l'en-tete standard (titre + croix) — voir le commentaire de tete de fichier. */
  showHeader?: boolean;
  size?: MxModalSize;
  footer?: ReactNode;
  /** Defaut `'end'`, aligne a droite comme le catalogue (variantes 2/3/4 colonnes). `'center'` pour une confirmation. */
  footerAlign?: 'end' | 'center';
  /** Defaut `true`. `false` : ni Echap ni le clic sur le voile ne ferment — voir useMxLayeredDialog. */
  dismissible?: boolean;
  /** Defaut `true` : focus le premier CHAMP a l'ouverture. */
  autofocus?: boolean;
  /** Element explicite a focaliser a l'ouverture, prioritaire sur `autofocus`. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  theme?: MxModalTheme;
  /** Defaut `'dialog'`. MxConfirmDialog pose `'alertdialog'`. */
  role?: 'dialog' | 'alertdialog';
  /** Defaut `'modal'`. Reserve a MxConfirmDialog — voir le commentaire de tete de fichier. */
  zLayer?: 'modal' | 'alert';
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function MxModal({
  open,
  onClose,
  title,
  showHeader = true,
  size = 'md',
  footer,
  footerAlign = 'end',
  dismissible = true,
  autofocus = true,
  initialFocusRef,
  theme = 'inherit',
  role = 'dialog',
  zLayer = 'modal',
  children,
  className,
  style,
}: MxModalProps) {
  const titleId = useId();
  const reduced = useMxReducedMotion();

  const { panelRef, handleScrimClick } = useMxLayeredDialog({
    open,
    onClose,
    dismissible,
    autofocus,
    initialFocusRef,
  });

  const scrimZ = zLayer === 'alert' ? MX_Z.alertScrim : MX_Z.modalScrim;
  const panelZ = zLayer === 'alert' ? MX_Z.alert : MX_Z.modal;

  return (
    <MxPortal>
      <div
        aria-hidden="true"
        onClick={handleScrimClick}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: scrimZ,
          background: 'var(--mx-scrim-overlay)',
          backdropFilter: 'blur(3px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: `opacity ${reduced ? 'var(--mx-dur-fast)' : 'var(--mx-dur-scrim)'} var(--mx-ease-appear)`,
        }}
      />

      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={showHeader ? titleId : undefined}
        aria-label={showHeader ? undefined : title}
        tabIndex={-1}
        {...((!open ? { inert: '' } : {}) as Record<string, string>)}
        data-theme={theme === 'inherit' ? undefined : theme}
        className={className}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          zIndex: panelZ,
          display: 'flex',
          flexDirection: 'column',
          width: `min(${MX_MODAL_WIDTH[size]}, calc(100vw - var(--mx-space-32)))`,
          maxHeight: '90vh',
          background: 'var(--mx-surface)',
          borderRadius: 'var(--mx-radius-6)',
          boxShadow: 'var(--mx-shadow-lg)',
          overflow: 'hidden',
          // Centrage fixe (position), jamais anime : seules l'opacite et
          // l'echelle portent l'entree/la sortie, sous reduce comme hors
          // reduce — meme principe que le panneau de MxDrawer (sa POSITION
          // d'ancrage ne bouge jamais non plus, seul le glissement l'anime).
          transform: reduced
            ? 'translate(-50%, -50%) scale(1)'
            : open
              ? 'translate(-50%, -50%) scale(1)'
              : 'translate(-50%, -50%) scale(0.97)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: reduced
            ? 'opacity var(--mx-dur-fast) var(--mx-ease-appear)'
            : 'opacity var(--mx-dur-fast) var(--mx-ease-appear), transform var(--mx-dur-fast) var(--mx-ease-appear)',
          // Meme exception que le panneau de MxDrawer (tokens-mx.css,
          // commentaire « CE QUI NE LE PORTE PAS ») : focalise par PROGRAMME
          // a l'ouverture, jamais une cible de focus clavier en soi.
          outline: 'none',
          ...style,
        }}
      >
        {showHeader ? (
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--mx-space-16) calc(20px * var(--mx-scale, 1))',
              borderBottom: 'var(--mx-border-w) solid var(--mx-border)',
              flexShrink: 0,
            }}
          >
            <h2 id={titleId} style={{ ...MX_TEXT.modalTitle, color: 'var(--mx-text)', margin: 0 }}>
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={title}
              data-mx-focus=""
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 'calc(24px * var(--mx-scale, 1))',
                height: 'calc(24px * var(--mx-scale, 1))',
                flexShrink: 0,
                borderRadius: 'var(--mx-radius-pill)',
                background: 'var(--mx-surface2)',
                border: 'none',
                color: 'var(--mx-text3)',
                cursor: 'pointer',
              }}
            >
              <X style={mxIconBox('sm')} aria-hidden="true" />
            </button>
          </header>
        ) : null}

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: 'calc(20px * var(--mx-scale, 1))',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--mx-space-16)',
          }}
        >
          {children}
          {footer ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--mx-space-8)',
                justifyContent: footerAlign === 'center' ? 'center' : 'flex-end',
              }}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </MxPortal>
  );
}

export default MxModal;
