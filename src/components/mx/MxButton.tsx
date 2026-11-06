import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { LucideIcon } from 'lucide-react';

import { MX_TEXT } from './tokens';
import { useMxReducedMotion } from './internal/useMxReducedMotion';
import { mxIconBox } from './internal/mxIcon';

/**
 * Les 3 variantes du tronc.
 *   primary    <- ButtonPrimary + Button variant="primary"
 *   ghost      <- ButtonGhost + Button variant="ghost" + l'ancien `secondary`
 *   accentSoft <- ButtonAccentSoft
 *
 * `secondary` A ETE SUPPRIME — arbitrage de Greg du 2026-09-23. Ne pas le
 * remettre. C'etait un bouton GRIS (fond --mx-surface2, filet --mx-border) qui
 * occupait le nom d'une variante officielle du handoff sans en avoir le
 * dessin : `.mx-dr-btn` n'a que primary, danger et ghost, et l'action
 * secondaire d'un drawer y est un GHOST. Deux appelants du pilote ont ete
 * bascules sur `ghost` avec cette suppression.
 *
 * `danger` — variante OFFICIELLE du handoff, IMPLEMENTEE au LOT MODALE B2
 * (2026-10-02), premier site d'appel : le bouton de confirmation destructive
 * de MxConfirmDialog. Recette posee EXACTEMENT comme annoncee ci-dessus avant
 * ce lot : skin `bg: var(--mx-tone-fill-danger)`, `fg:
 * var(--mx-tone-on-danger)`, `--mx-danger-2` declare dans les deux blocs de
 * theme (tokens-mx.css) pour le survol, sur le modele d'--mx-accent-2.
 *
 * `success` — variante ajoutee au LOT OFFRES-CYCLE, C1.4 (Greg, 2026-10-17) :
 * decision de Greg pour les cartes d'offre ("Accepter"/"Valider sans renvoi"
 * en vert) et sa definition d'action UNIQUE (menus, boutons de liste, pied
 * de drawer) — MEME FORME que `danger` (aplat plein, fond sature + texte de
 * contraste), sur le ton success au lieu du ton danger. `--mx-green-2`
 * declare dans les deux blocs de theme (tokens-mx.css) pour le survol, sur
 * le modele d'--mx-accent-2/--mx-danger-2.
 *
 * EXCLUES aussi : les 3 tailles sm/md/lg — le tronc ne connait qu'une taille
 * de bouton, celle du drawer.
 */
export type MxButtonVariant = 'primary' | 'ghost' | 'accentSoft' | 'danger' | 'success';

interface MxButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'style' | 'className'
> {
  variant?: MxButtonVariant;
  /**
   * Icone Lucide — le COMPOSANT (ex. `FileDown`), jamais un element deja
   * instancie : la primitive le rend elle-meme via `mxIconBox`, toujours en
   * 'sm' (15px) — seule taille demandee par tous les sites d'appel a ce jour
   * (correction C1/C2 du lot "echelle et densite d'affichage", 2026-09-29).
   * Posee avant le libelle.
   */
  leftIcon?: LucideIcon;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface Skin {
  bg: string;
  line: string;
  fg: string;
  /** Fond au survol. */
  bgHover: string;
  /** Bordure au survol, quand le survol ne joue pas sur le fond (ghost). */
  lineHover?: string;
  /** Texte au survol, idem. */
  fgHover?: string;
}

const SKINS: Record<MxButtonVariant, Skin> = {
  // APLAT PLEIN : fond sature + texte de contraste. Le prototype pose un #fff
  // litteral ici ; le contraste par ton suit le theme, sans quoi le libelle tombe a 3.66
  // de contraste sur l'accent clair du dark.
  primary: {
    bg: 'var(--mx-accent)',
    line: 'var(--mx-accent)',
    fg: 'var(--mx-tone-on-accent)',
    bgHover: 'var(--mx-accent-2)',
  },
  ghost: {
    bg: 'transparent',
    line: 'var(--mx-input-border)',
    fg: 'var(--mx-text2)',
    bgHover: 'transparent',
    lineHover: 'var(--mx-accent)',
    fgHover: 'var(--mx-accent)',
  },
  // Bordure PLEINE + fond a faible opacite, seule forme « douce » que le handoff
  // retient (cf. l'inventaire : « badge tone, bordure pleine + fond a 10% »).
  // --mx-accent-lt est un voile transparent, pas un melange sur la surface : il
  // survit donc a l'abandon de la famille delavee.
  accentSoft: {
    bg: 'var(--mx-accent-lt)',
    line: 'var(--mx-accent)',
    fg: 'var(--mx-accent)',
    bgHover: 'var(--mx-accent-lt)',
  },
  // APLAT PLEIN du ton danger — LOT MODALE B2, meme forme que `primary`
  // ci-dessus (fond sature + texte de contraste), sur le ton danger au lieu
  // de l'accent. Action destructive confirmee (MxConfirmDialog), jamais une
  // action par defaut.
  danger: {
    bg: 'var(--mx-tone-fill-danger)',
    line: 'var(--mx-tone-fill-danger)',
    fg: 'var(--mx-tone-on-danger)',
    bgHover: 'var(--mx-danger-2)',
  },
  // APLAT PLEIN du ton success — LOT OFFRES-CYCLE, C1.4 (2026-10-17), meme
  // forme que `danger` ci-dessus, sur le ton success au lieu du ton danger.
  success: {
    bg: 'var(--mx-tone-fill-success)',
    line: 'var(--mx-tone-fill-success)',
    fg: 'var(--mx-tone-on-success)',
    bgHover: 'var(--mx-green-2)',
  },
};

/**
 * MxButton — bouton du tronc, une seule taille.
 *
 * `forwardRef` — LOT MODALE B3 (2026-10-02), ajoute pour MxConfirmDialog :
 * le focus initial s'y pose sur l'action Annuler (la moins destructrice),
 * passee en `initialFocusRef` a MxModal — qui a besoin d'un noeud DOM reel,
 * pas d'un ReactNode. Zero changement de comportement pour les consommateurs
 * qui ne posent pas de `ref`.
 */
export const MxButton = forwardRef<HTMLButtonElement, MxButtonProps>(function MxButton(
  {
    variant = 'primary',
    leftIcon: LeftIcon,
    children,
    className,
    style,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const skin = SKINS[variant];
  // Lot C-RM (2026-09-24) : sous reduce, aucun soulevement au survol — pas
  // seulement sans transition, le deplacement lui-meme disparait (c'est une
  // micro-interaction decorative, sans etat semantique a preserver). Les
  // transitions de couleur et d'ombre ne sont pas concernees.
  const reduced = useMxReducedMotion();

  return (
    <button
      ref={ref}
      {...rest}
      type={type}
      disabled={disabled}
      className={className}
      // Contour de focus clavier : voir EXCEPTION 1 / 2 dans tokens-mx.css. Il
      // ne peut pas s'ecrire ici, `:focus-visible` etant une pseudo-classe, et
      // c'est pourquoi cet element n'a plus d'`outline` en ligne — une
      // declaration de l'attribut style annulerait la regle de la feuille.
      data-mx-focus=""
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--mx-space-8)',
        padding: '0 var(--mx-space-12)',
        minHeight: 'var(--mx-control-h)',
        // 8px et non 4px : la table des rayons du README distingue les boutons
        // generiques (4px) des BOUTONS DE DRAWER (8px). Le tronc ne produit que
        // des boutons de drawer — ceux du pilote vivent tous dans le panneau.
        borderRadius: 'var(--mx-radius-8)',
        background: hover && !disabled ? skin.bgHover : skin.bg,
        border:
          'var(--mx-border-w) solid ' +
          (hover && !disabled && skin.lineHover ? skin.lineHover : skin.line),
        color: hover && !disabled && skin.fgHover ? skin.fgHover : skin.fg,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        // --mx-focus-ring et non --mx-accent-lt : ce dernier vaut 0.16 en
        // sombre mais 0.09 en clair, l'anneau y etait deux fois moins visible.
        // Meme correction que sur les champs et l'interrupteur.
        boxShadow: focused && !disabled ? 'var(--mx-focus-ring)' : 'none',
        // Soulevement au survol : `.mx-dr-btn:hover:not([disabled])`. C'est la
        // seule micro-interaction que le handoff donne aux boutons, et elle
        // porte le retour d'action — sans elle, seul le fond change, ce qui ne
        // se voit pas sur les variantes dont le survol ne touche pas au fond
        // (ghost).
        transform: reduced ? 'none' : hover && !disabled ? 'translateY(-2px)' : 'none',
        // NON APPLIQUE, sciemment : `.mx-dr-btn[data-variant="primary"]` porte
        // `flex-grow:1`. C'est une regle de MISE EN PAGE du pied de drawer, ou
        // l'action principale occupe la place restante — pas une propriete du
        // bouton. Le pilote pose des MxButton ailleurs : en pied de modale
        // aligne a droite, et dans les actions d'un MxNote. L'y inscrire
        // etirerait « Telecharger » sur toute la largeur du pied de la modale
        // PDF. Si le pied de drawer doit adopter cette mise en page, c'est au
        // conteneur de le dire, pas a la primitive.
        // Sous reduce : `transform` retire de la liste, le reste inchange
        // (decision Greg 2026-09-24).
        transition: reduced
          ? 'background var(--mx-dur-fast) var(--mx-ease-appear), box-shadow var(--mx-dur-fast) var(--mx-ease-appear), border-color var(--mx-dur-fast) var(--mx-ease-appear), color var(--mx-dur-fast) var(--mx-ease-appear)'
          : 'background var(--mx-dur-fast) var(--mx-ease-appear), box-shadow var(--mx-dur-fast) var(--mx-ease-appear), border-color var(--mx-dur-fast) var(--mx-ease-appear), color var(--mx-dur-fast) var(--mx-ease-appear), transform var(--mx-dur-fast) var(--mx-ease-spring)',
        whiteSpace: 'nowrap',
        ...MX_TEXT.button,
        ...style,
      }}
    >
      {LeftIcon ? (
        <span style={{ display: 'flex', flexShrink: 0 }} aria-hidden="true">
          <LeftIcon style={mxIconBox('sm')} />
        </span>
      ) : null}
      {children}
    </button>
  );
});

export default MxButton;
