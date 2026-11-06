import { useState, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';

import { mxIconBox } from './internal/mxIcon';
import { useMxReducedMotion } from './internal/useMxReducedMotion';

/**
 * MxIconButton — LOT MENU-UTILISATEUR B (2026-09-29). Bouton ICONE SEULE du
 * tronc — 1re primitive de ce type ; `--mx-iconbtn-size` existait deja
 * (tokens-mx.css) mais n'etait consomme QU'en style inline par MxDrawer
 * (boutons d'action/fermeture d'en-tete). Ce composant EXTRAIT ce style en
 * primitive reutilisable, sans changer sa valeur ni celle deja posee par
 * MxDrawer (meme token, non duplique).
 *
 * `icon` : COMPOSANT Lucide (`LucideIcon`), jamais un element deja
 * instancie — meme convention que `leftIcon` de MxButton. Rendu ICI, taille
 * `--mx-icon-md` via `mxIconBox` (meme cran que les boutons d'action d'en-tete
 * de MxDrawer, precedent direct de `--mx-iconbtn-size`).
 *
 * `aria-label` OBLIGATOIRE — impose au niveau TYPE (`Omit` puis redeclaration
 * en non-optionnel) : un bouton icone seule sans texte visible n'a AUCUNE
 * autre source de nom accessible.
 *
 * VARIANTE UNIQUE (fantome/"ghost") : fond transparent au repos,
 * `--mx-surface2` au survol, teinte `--mx-accent-lt`/`--mx-accent` a
 * l'etat actif (presse) — memes tokens que l'item COCHE de MxMenu pour
 * l'etat actif, DIFFERENT de `.ctx-btn` du catalogue (borde, remplissage
 * `--accent` plein au survol) : ce 2e dessin existe dans le catalogue mais
 * n'a AUCUN site d'appel a ce jour dans l'appli — non retenu par defaut,
 * signale en A4/A5, une variante `variant` s'ajoutera le jour ou un appelant
 * la demande (meme regle de bornage que MxButton : le tronc ne produit que
 * ce que ses consommateurs demandent).
 *
 * `data-mx-focus=""` : anneau de focus clavier, EXCEPTION 1/2 de
 * tokens-mx.css — meme convention que MxButton/MxDrawer.
 *
 * `pressed?` — LOT PAGE-NOTIFICATIONS, B1 (2026-10-01). Etat ACTIF PERSISTANT,
 * distinct du `pressed` interne (`onMouseDown`/`onMouseUp`, relache au clic) :
 * ce dernier retombe toujours a faux ensuite, il ne peut donc pas representer
 * un bouton bascule qui reste enfonce tant qu'un panneau est ouvert ou qu'un
 * filtre est actif (besoin du bouton "Filtres" de la page notifications).
 * Pose `aria-pressed` (nom accessible via `aria-label`, deja obligatoire) et
 * les MEMES tokens que l'etat presse interne (`--mx-accent-lt`/`--mx-accent`)
 * — un bouton bascule actif doit se voir identique a un clic en cours, pas
 * inventer un 3e habillage. Absent par defaut (`undefined`) : AUCUN site
 * d'appel existant (MxTabs, NotificationButton) n'est affecte.
 */
export interface MxIconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'style' | 'className'> {
  /** Icone Lucide — le COMPOSANT, jamais un element deja instancie. */
  icon: LucideIcon;
  /** Nom accessible — OBLIGATOIRE, aucune autre source pour un bouton icone seule. */
  'aria-label': string;
  /** Etat bascule actif persistant (ex. panneau de filtres ouvert). */
  pressed?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function MxIconButton({
  icon: Icon,
  pressed: pressedProp,
  className,
  style,
  disabled,
  type = 'button',
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onMouseEnter,
  onFocus,
  onBlur,
  ...rest
}: MxIconButtonProps) {
  const [hover, setHover] = useState(false);
  const [clickPressed, setClickPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const reduced = useMxReducedMotion();
  // L'etat bascule EXTERNE (`pressed`) et l'etat de clic INTERNE se melangent
  // en OU : les deux rendent le MEME habillage, cf. commentaire de l'interface.
  const active = pressedProp || clickPressed;

  const background = disabled
    ? 'transparent'
    : active
      ? 'var(--mx-accent-lt)'
      : hover
        ? 'var(--mx-surface2)'
        : 'transparent';
  const color = disabled ? 'var(--mx-text3)' : active ? 'var(--mx-accent)' : hover ? 'var(--mx-text)' : 'var(--mx-text3)';

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-pressed={pressedProp}
      className={className}
      // Contour de focus clavier : voir EXCEPTION 1/2 dans tokens-mx.css —
      // pseudo-classe, inexprimable en style inline (meme motif que MxButton).
      data-mx-focus=""
      onMouseEnter={(e) => {
        setHover(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setHover(false);
        setClickPressed(false);
        onMouseLeave?.(e);
      }}
      onMouseDown={(e) => {
        setClickPressed(true);
        onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        setClickPressed(false);
        onMouseUp?.(e);
      }}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: 'var(--mx-iconbtn-size)',
        height: 'var(--mx-iconbtn-size)',
        borderRadius: 'var(--mx-radius-6)',
        border: 'none',
        background,
        color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        // Meme motif que MxButton : anneau supplementaire au focus clavier
        // (boxShadow), au-dela du contour data-mx-focus.
        boxShadow: focused && !disabled ? 'var(--mx-focus-ring)' : 'none',
        transition: reduced
          ? 'none'
          : 'background var(--mx-dur-fast) var(--mx-ease-appear), color var(--mx-dur-fast) var(--mx-ease-appear), box-shadow var(--mx-dur-fast) var(--mx-ease-appear)',
        ...style,
      }}
    >
      <Icon style={mxIconBox('md')} aria-hidden="true" />
    </button>
  );
}

export default MxIconButton;
