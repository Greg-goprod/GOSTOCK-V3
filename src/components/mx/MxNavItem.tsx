import { useState, type CSSProperties, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { mxIconBox } from './internal/mxIcon';
import { useMxReducedMotion } from './internal/useMxReducedMotion';
import { MxBadge } from './MxBadge';

/**
 * MxNavItem — entree de navigation de la sidebar, telle que la section
 * « Sidebar — etats » du catalogue (reference/Mannyx Components V2.html,
 * L.654-665 pour le marquage, L.1935-1937 pour le CSS — classes
 * `.nav-item`/`.active-nav`/`.hover-nav`). LOT CADRE, B2 (2026-09-30).
 *
 * INDEPENDANT DU ROUTEUR, MEME CONTRAT QUE MxTabs : MxNavItem ne rend jamais
 * lui-meme l'element cliquable. Il calcule `linkProps` (style, title,
 * aria-label, gestion du survol) et delegue le rendu final a `renderLink`,
 * fourni par l'appelant — qui y enveloppe son propre `<Link>` (react-router)
 * ou tout autre element. `isActive` est TOUJOURS fourni par l'appelant,
 * jamais recalcule ici — meme raison que MxTabs : absorber sans cas
 * particulier la logique deja en place dans AppLayout (`match`/`exact`/
 * `startsWith`).
 *
 * DESACTIVE : rendu en `<span aria-disabled="true">` PAR MxNavItem lui-meme
 * (jamais via `renderLink`) — non focusable, pas de navigation possible,
 * meme comportement que l'entree grisee actuelle face au RBAC (AppLayout.tsx,
 * item non `allowed`) et meme motif que MxTabs pour ses items `disabled`.
 *
 * MODE REPLIE (`collapsed`) : le libelle textuel est MASQUE (seule l'icone
 * reste visible), mais reste lisible autrement — `aria-label` ET `title`
 * reprennent alors le libelle complet, sur l'element rendu par `renderLink`
 * (jamais sur l'icone). Priorite explicite quand `disabled` ET `collapsed`
 * coincident : le motif de refus (`disabledTitle`) prime sur le simple
 * libelle — meme priorite que l'actuel `tooltip` d'AppLayout.tsx
 * (`!item.allowed ? refus : collapsed ? libelle : undefined`).
 *
 * ETATS — 3 CHOIX SIGNALES :
 * - defaut/actif : `.nav-item`/`.active-nav` du catalogue REPRIS A
 *   L'IDENTIQUE quand un token existant correspond EXACTEMENT (rayon 4px ->
 *   --mx-radius-4, police 13px -> --mx-fs-item, fond actif -> --mx-accent-lt,
 *   texte actif -> --mx-accent, poids 600).
 * - survol (item normal, NON actif) : le catalogue pose un fond litteral
 *   `rgba(0,0,0,0.03)` (`.hover-nav`), THEME-DEPENDANT DANS LES FAITS (un
 *   voile NOIR a 3% reste correct sur le fond CLAIR de la vitrine du
 *   catalogue, mais s'inverserait sur un fond SOMBRE — presque invisible,
 *   dans le mauvais sens). Aucun token n'existe pour ce role exact ; plutot
 *   que d'en creer un nouveau autour d'une valeur qui ne survit pas au
 *   changement de theme, ce lot REUTILISE `--mx-surface2`, precedent DEJA
 *   EN PRODUCTION pour EXACTEMENT ce role (survol neutre, distinct de l'etat
 *   actif/presse en accent) sur la primitive sœur MxIconButton
 *   (MxIconButton.tsx, `hover ? 'var(--mx-surface2)' : 'transparent'`) — deux
 *   primitives du meme tronc affichant le meme etat "survol neutre" avec la
 *   meme valeur, plutot que deux valeurs distinctes qui ne se justifient pas
 *   par un ecart de dessin.
 * - icone : 15px (--mx-icon-sm), le cran le plus proche des icones 14x14
 *   inline du catalogue (L.658-671) — aucune correspondance EXACTE, le
 *   catalogue n'ayant pas de cran a 14 dans son echelle --mx-icon-*.
 *
 * GAP/PADDING NON EXACTS DANS L'ECHELLE --mx-space-* (4/8/12/16...) :
 * gap 9px -> arrondi a --mx-space-8 (cran le plus proche) ; padding
 * `7px 10px` du catalogue REPRIS LITTERALEMENT (`calc(<n>px * var(--mx-scale,
 * 1))`), memes precedent que le padding 14px de MxTabs/MxMenu — la valeur du
 * catalogue prime sur l'arrondi quand elle n'est pas un simple espacement
 * generique.
 */

export interface MxNavItemData {
  /** Cle React ET identifiant transmis a `renderLink`. */
  id: string;
  /** Icone Lucide — le COMPOSANT, jamais un element deja instancie. */
  icon: LucideIcon;
  label: string;
  /**
   * Fourni par l'appelant, JAMAIS recalcule : absorbe sans cas particulier
   * la logique deja en place dans AppLayout (match/exact/startsWith).
   */
  isActive: boolean;
  disabled?: boolean;
  /** `title` du `<span>` quand `disabled` — raison de l'acces refuse, etc. */
  disabledTitle?: string;
  /**
   * Groupe visuel — LOT NAV-SECONDAIRE, B1 (2026-09-30). Ignore par MxNavItem
   * lui-meme (aucun rendu ne depend de ce champ ici) : c'est l'appelant qui
   * groupe (MxSubNav), MxNavItem ne fait que porter la donnee pour que
   * `MxNavItemData` reste l'UNIQUE forme consommee par MxSidebar et MxSubNav.
   */
  group?: string;
  /**
   * Compteur — LOT NAV-SECONDAIRE, B1 (2026-09-30). Affiche en ton NEUTRE
   * (MxBadge) apres le libelle, masque si absent. Non affiche en mode
   * `collapsed` (pas de place, comme le libelle qu'il accompagne).
   */
  count?: number;
  /**
   * Description — LOT NAV-SECONDAIRE, B1 (2026-09-30). Devient le `title` de
   * l'element rendu quand present ET que l'item n'est ni `disabled` (le motif
   * de refus prime) ni `collapsed` (le libelle complet y occupe deja le
   * `title`, voir plus bas).
   */
  description?: string;
}

/**
 * Props ETALEES par l'appelant sur son propre element de lien (`<Link>`,
 * `<a>`...). Meme convention que `MxTabLinkProps` de MxTabs.
 */
export interface MxNavLinkProps {
  style: CSSProperties;
  /** Repris du libelle en mode replie UNIQUEMENT (texte visible masque). */
  title: string | undefined;
  'aria-label': string | undefined;
  /** Meme contrat que `MxTabLinkProps` — un lien de page, comme un autre. */
  'aria-current': 'page' | undefined;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  children: ReactNode;
}

export interface MxNavItemProps {
  item: MxNavItemData;
  /** Masque le libelle textuel, ne garde que l'icone — voir le commentaire de tete de fichier. */
  collapsed?: boolean;
  renderLink: (item: MxNavItemData, linkProps: MxNavLinkProps) => ReactNode;
}

/** `.nav-item` du catalogue — base commune, sur/sous-etat portes separement. */
const ITEM_BASE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--mx-space-8)', // catalogue : 9px, arrondi au cran le plus proche.
  // 7px/10px : `.nav-item` du catalogue (`padding:7px 10px`), absents de
  // l'echelle --mx-space-* - la valeur du catalogue prime, meme precedent
  // que le padding 14px de MxTabs/MxMenu.
  padding: 'calc(7px * var(--mx-scale, 1)) calc(10px * var(--mx-scale, 1))',
  borderRadius: 'var(--mx-radius-4)', // correspondance EXACTE (4px).
  fontFamily: 'var(--mx-font-ui)',
  fontSize: 'var(--mx-fs-item)', // correspondance EXACTE (13px).
  lineHeight: 1.3,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  userSelect: 'none',
};

/**
 * Libelle en MAJUSCULES — LOT NAV-SECONDAIRE, C2 (2026-09-30, Greg). Taille
 * INCHANGEE (`--mx-fs-item`, herite de `ITEM_BASE`) : seuls `textTransform`
 * et `letterSpacing` different de la version precedente.
 *
 * `letterSpacing: 0.02em` — CORRIGE C3 (2026-09-30, Greg) : la version C2
 * posait 0.04em (le plus leger des cinq trackings deja en usage dans le
 * tronc — 0.04/0.07/0.08/0.1/0.14em, cf. MX_TEXT.badge/statMeta). Greg a
 * resserre encore la valeur a 0.02em, la BORNE BASSE de la fourchette
 * initialement proposee en C2 (« 0.02em a 0.04em ») — motif mesure en C3 sur
 * MxTabs (sonde a 1440px, cf. son propre commentaire) : le tracking, meme au
 * plus leger palier deja en usage, ajoutait un delta de largeur non
 * negligeable sur une barre d'onglets deja tendue. MEME valeur que MxTabs
 * (« meme leger letterSpacing » entre les deux primitives, decision C2/C3).
 *
 * ACCENTS : `text-transform:uppercase` respecte la casse Unicode complete
 * (specification CSS Text Module) — un libelle source correctement accentue
 * (ex. « Paramètres ») s'affiche donc « PARAMÈTRES », accent inclus, sans
 * aucun code supplementaire. Ce qui NE PEUT PAS etre corrige ici : les
 * libelles dont la DONNEE SOURCE n'a jamais porte l'accent (ex. « Parametres »
 * sans accent grave) restent sans accent une fois majuscule — releve en C2,
 * corrige en C4 (voir les comptes-rendus respectifs).
 */
const LABEL_STYLE: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
};

export function MxNavItem({ item, collapsed = false, renderLink }: MxNavItemProps) {
  const [hovered, setHovered] = useState(false);
  const reduced = useMxReducedMotion();
  const Icon = item.icon;

  const iconNode = (
    <span aria-hidden="true" style={{ display: 'flex', flexShrink: 0 }}>
      <Icon style={mxIconBox('sm')} />
    </span>
  );

  // Compteur — masque si absent OU replie (pas de place, comme le libelle).
  // Ton NEUTRE dans les deux etats (actif/desactive) : MxBadge n'a pas de
  // variante « attenuee », et aucun ecart ne le justifie pour ce lot.
  const countNode =
    item.count !== undefined && !collapsed ? (
      <MxBadge tone="neutral" style={{ marginLeft: 'auto', flexShrink: 0 }}>
        {item.count}
      </MxBadge>
    ) : null;

  if (item.disabled) {
    return (
      <span
        aria-disabled="true"
        title={item.disabledTitle}
        style={{
          ...ITEM_BASE,
          justifyContent: collapsed ? 'center' : 'flex-start',
          color: 'var(--mx-text3)',
          cursor: 'not-allowed',
        }}
      >
        {iconNode}
        {!collapsed ? <span style={LABEL_STYLE}>{item.label}</span> : null}
        {countNode}
      </span>
    );
  }

  const background = item.isActive
    ? 'var(--mx-accent-lt)'
    : hovered
      ? 'var(--mx-surface2)' // survol neutre — voir le commentaire de tete de fichier.
      : 'transparent';
  const color = item.isActive ? 'var(--mx-accent)' : hovered ? 'var(--mx-text)' : 'var(--mx-text3)';

  return renderLink(item, {
    style: {
      ...ITEM_BASE,
      justifyContent: collapsed ? 'center' : 'flex-start',
      background,
      color,
      fontWeight: item.isActive ? 600 : 400, // `.active-nav` du catalogue.
      cursor: 'pointer',
      transition: reduced
        ? 'none'
        : 'background var(--mx-dur-fast) var(--mx-ease-appear), color var(--mx-dur-fast) var(--mx-ease-appear)',
    },
    // Mode replie : le texte visible disparait, aria-label/title le
    // remplacent — mais jamais si `disabled` (branche ci-dessus, prioritaire
    // et distincte). Deplie : `title` reprend `description` si fournie (LOT
    // NAV-SECONDAIRE, B1) — les deux usages de `title` sont mutuellement
    // exclusifs (replie XOR description), jamais les deux a la fois.
    title: collapsed ? item.label : item.description,
    'aria-label': collapsed ? item.label : undefined,
    'aria-current': item.isActive ? 'page' : undefined,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    children: (
      <>
        {iconNode}
        {!collapsed ? <span style={LABEL_STYLE}>{item.label}</span> : null}
        {countNode}
      </>
    ),
  });
}

export default MxNavItem;
