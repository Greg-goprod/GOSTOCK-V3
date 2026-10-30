import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';

import { mxIconBox } from './internal/mxIcon';
import { useMxReducedMotion } from './internal/useMxReducedMotion';
import { MX_TAB_DISABLED_STYLE, mxTabItemStyle } from './internal/mxTabStyle';
import {
  buildFadeMask,
  measureOverflow,
  sameOverflow,
  type TabsOverflow,
  NO_OVERFLOW,
} from './internal/mxTabsOverflow';
import { MxIconButton } from './MxIconButton';

/**
 * MxTabs — navigation par onglets, telle que la section « Onglets » du
 * catalogue (reference/Mannyx Components V2.html, L.679-688).
 *
 * SEMANTIQUE : liste de LIENS, jamais `role="tablist"`/`role="tab"` — decision
 * de Greg (lot "nav-primitives-3a", 2026-09-29). Les 7 `*Tabs` actuels du code
 * legacy portent ces roles ARIA en facade, sans jamais implementer la
 * navigation clavier fleche gauche/droite qu'ils impliquent : ce sont des liens
 * de page comme les autres, `aria-current="page"` suffit a le dire.
 *
 * INDEPENDANT DU ROUTEUR : MxTabs ne rend jamais lui-meme l'element cliquable.
 * Il calcule `linkProps` (style, aria-current, data-mx-focus, gestion du
 * survol) et delegue le rendu final a `renderLink`, fourni par l'appelant —
 * qui y enveloppe son propre `<NavLink>` (react-router), un `<button>`
 * (l'onglet "externe" de BookingTabs, `window.open`), ou tout autre element.
 * `isActive` est TOUJOURS fourni par l'appelant, jamais recalcule ici : c'est
 * le seul moyen d'absorber sans cas particulier la logique deja en place
 * dans BookingTabs (`match`/`isTabActive`, actif sur /app/artistes ET
 * /app/artistes/detail/*, calcule hors de tout NavLink).
 *
 * UNE SEULE VARIANTE, LE SOULIGNEMENT DU CATALOGUE — decision de Greg. La
 * famille "pilule" (fond degrade + anneau, ProductionTabs/BookingTabs/
 * FinanceTabs/SettingsTabs) est de l'habillage AURA, abandonnee : elle n'est
 * dans AUCUN catalogue.
 *
 * ETATS NON SPECIFIES PAR LE CATALOGUE (qui ne montre qu'actif/inactif en
 * style inline brut), DERIVES ICI et SIGNALES au rapport :
 * - survol (item normal, non actif) : texte --mx-text3 -> --mx-text. Pilote
 *   par etat JS (`hoveredId`), pas par `:hover` — le tronc n'ecrit aucun CSS
 *   hors des 3 exceptions nommees de tokens-mx.css, et le survol d'un onglet
 *   n'en est pas une (pas d'impossibilite du style en ligne : un
 *   `onMouseEnter`/`onMouseLeave` suffit).
 * - desactive : texte --mx-text3, `cursor:not-allowed`, aucun survol. Rendu en
 *   `<span aria-disabled="true">` PAR MxTabs lui-meme (jamais via
 *   `renderLink`) : non focusable (aucun `tabIndex`), pas de navigation
 *   possible — meme comportement que les 7 `*Tabs` actuels face au RBAC.
 *
 * TRAITS FIXES (ne suivent pas --mx-scale), meme famille que
 * --mx-border-w/-thin et le contour de focus (cf. C5, tokens-mx.css) :
 * - le filet 1px du conteneur (`--mx-border-w-thin`, deja hors echelle) ;
 * - le soulignement 2px de l'onglet actif (litteral, absent de l'echelle des
 *   bordures).
 *
 * FILET DU CONTENEUR EN `box-shadow` INSET, PAS EN `border-bottom` (correctif
 * C4, 2026-09-29) : un vrai `border-bottom` AGRANDIT la boite (meme en
 * `border-box`, il reste 1px de trop une fois les items etires en hauteur par
 * le flex par defaut, `align-items:stretch`) — combine a `overflow-x:auto`,
 * ce debordement de 1px faisait apparaitre une barre de defilement VERTICALE
 * parasite (`overflow-x:auto` impose `overflow-y:auto` tant que l'axe
 * oppose n'est pas explicitement ferme). Un `box-shadow` inset ne consomme
 * AUCUN espace de mise en page : peint exactement sur le bord de la boite,
 * il s'aligne de lui-meme avec le bord des items etires, sans plus avoir
 * besoin du `margin-bottom:-1px` de compensation (supprime). Le soulignement
 * 2px de l'item actif, un `border-bottom` sur l'item lui-meme, se peint par-
 * dessus (l'enfant est peint apres le `box-shadow` du parent).
 */

export interface MxTabItem {
  /** Cle React ET identifiant transmis a `renderLink`. */
  id: string;
  label: string;
  /**
   * Icone Lucide — le COMPOSANT, jamais un element deja instancie : MxTabs le
   * rend lui-meme via `mxIconBox`, toujours en 'sm' (15px). Absente de la
   * demo du catalogue (aucun onglet n'y porte d'icone) : taille choisie par
   * coherence avec les autres primitives du tronc (MxButton, MxList).
   */
  icon?: LucideIcon;
  /**
   * Fourni par l'appelant, JAMAIS recalcule : absorbe sans cas particulier la
   * logique deja en place dans BookingTabs (match/isTabActive).
   */
  isActive: boolean;
  disabled?: boolean;
  /** `title` du `<span>` quand `disabled` — raison de l'acces refuse, etc. */
  disabledTitle?: string;
}

/**
 * Props ETALEES par l'appelant sur son propre element de lien (NavLink,
 * button...). `data-mx-focus` active l'exception 1/2 de tokens-mx.css
 * (contour de focus clavier 1px accent) sur CET element, quel qu'il soit.
 */
export interface MxTabLinkProps {
  style: CSSProperties;
  'aria-current': 'page' | undefined;
  'data-mx-focus': string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  children: ReactNode;
}

export interface MxTabsProps {
  /** `aria-label` du `<nav>` : identifie le groupe pour un lecteur d'ecran. */
  label: string;
  items: MxTabItem[];
  renderLink: (item: MxTabItem, linkProps: MxTabLinkProps) => ReactNode;
  /**
   * Nom accessible des DEUX boutons chevron de defilement — LOT
   * NAV-SECONDAIRE, C3 (2026-09-30, Greg). OBLIGATOIRE, meme motif que
   * `aria-label` de MxIconButton (bouton icone seule, aucune autre source de
   * nom accessible) : jamais de repli fige en francais ICI, le tronc ne fait
   * jamais lui-meme de resolution i18n (aucun `useI18n` dans
   * `src/components/mx`, cf. README) — c'est TOUJOURS l'appelant qui
   * resout la cle et transmet la chaine deja traduite, meme convention que
   * `label` ci-dessus et que `navLabel` de MxSubNav. MEME libelle pour les
   * deux boutons (gauche ET droite) — decision explicite de Greg, pas une
   * simplification : seul un des deux boutons est jamais visible a la fois
   * dans l'usage actuel (barre qui deborde d'UN seul cote a la fois tant
   * qu'elle n'a pas ete defilee), donc aucune ambiguite pratique pour un
   * lecteur d'ecran ; si un futur cas fait apparaitre les deux ensemble, deux
   * libelles distincts (« vers la gauche »/« vers la droite ») redeviendront
   * necessaires — a signaler alors, pas a anticiper ici.
   */
  scrollLabel: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Base commune (dimensions, disposition) aux items actifs/inactifs/desactives.
 *
 * MAJUSCULES + TRACKING — LOT NAV-SECONDAIRE, C2 (2026-09-30, Greg), MEME
 * TRAITEMENT que MxNavItem (voir son commentaire de `LABEL_STYLE`) :
 * `textTransform:'uppercase'`. Pose sur `ITEM_BASE` (partage par les 3
 * rendus : actif/inactif/desactive) plutot que sur un `<span>` dedie — MxTabs
 * n'enveloppe jamais son libelle dans un element separe (a la difference de
 * MxNavItem, qui a besoin d'un `<span>` pour `overflow:hidden`/
 * `text-overflow:ellipsis`) : `letter-spacing` est un HERITE CSS normal, il
 * s'applique au noeud de texte enfant sans avoir besoin de l'y poser
 * directement. Taille INCHANGEE (`--mx-fs-item`, ci-dessous).
 *
 * `letterSpacing: 0.02em` — CORRIGE C3 (2026-09-30, Greg), depuis 0.04em pose
 * en C2. MESURE A L'APPUI (sonde isolee, police Geist reelle, 1440px,
 * densite Compacte par defaut — `--mx-scale:0.9`, cf. uiDensity.ts) sur la
 * barre d'onglets de Reglages (12 onglets, la plus tendue des 9 modules) :
 *   avant C2 (casse mixte)         : largeur totale mesuree
 *   majuscules seules (aucun trac.): + une part du delta, imputable aux
 *                                     glyphes majuscules eux-memes
 *   + 0.04em (version C2)          : delta total le plus large
 *   + 0.02em (version C3, ICI)     : delta total reduit d'environ un tiers
 *     par rapport a 0.04em, a densite Compacte (mesure a jour dans le
 *     compte-rendu C3) — Greg a retenu ce palier, la BORNE BASSE de la
 *     fourchette "0.02em a 0.04em" proposee en C2, pour limiter la largeur
 *     ajoutee sur une barre deja proche de la limite avant tout changement.
 * MEME valeur que `MxNavItem` (« meme leger letterSpacing » entre les deux
 * primitives, decision C2 reconduite en C3).
 */
// ITEM_BASE / le style actif-selon-etat sont EXTRAITS dans
// internal/mxTabStyle.ts (LOT CONTRATS B2, C4.3, 2026-10-02) — partages avec
// MxTabPanels, qui doit presenter une apparence IDENTIQUE (decision de
// Greg). Valeur inchangee, voir ce module pour le detail commente.

// Mesure de debordement (`measureOverflow`/`sameOverflow`/`buildFadeMask`),
// EXTRAITE dans internal/mxTabsOverflow.ts (LOT ARTISTES-FICHE, B1,
// 2026-10-04) -- partagee avec MxTabPanels, qui recoit desormais le meme
// traitement de debordement. Valeurs et comportement inchanges par cette
// extraction, voir l'en-tete de ce module pour le detail.

export function MxTabs({ label, items, renderLink, scrollLabel, className, style }: MxTabsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [overflow, setOverflow] = useState<TabsOverflow>(NO_OVERFLOW);
  const navRef = useRef<HTMLElement>(null);
  const reduced = useMxReducedMotion();

  // Recalcule au moindre changement des items (le noeud <nav> lui-meme ne
  // change pas de taille pour autant : un ResizeObserver seul ne le
  // capterait pas forcement, ex. un item de plus/moins sans que le
  // conteneur parent ne se redimensionne).
  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const next = measureOverflow(el);
    setOverflow((prev) => (sameOverflow(prev, next) ? prev : next));
  }, [items]);

  // ResizeObserver (redimensionnement du conteneur) + evenement scroll
  // (defilement manuel, molette, focus clavier natif) — memes deux sources
  // que le debordement peut changer sans que `items` ne change. PROTEGE SI
  // `ResizeObserver` est absent (jsdom en test, meme motif defensif que
  // `useMxReducedMotion` face a `matchMedia` absent) : le composant reste
  // fonctionnel, seule la mise a jour DYNAMIQUE (hors montage/scroll) est
  // alors sautee.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const update = () => {
      const next = measureOverflow(el);
      setOverflow((prev) => (sameOverflow(prev, next) ? prev : next));
    };
    el.addEventListener('scroll', update, { passive: true });
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, []);

  // Defilement d'environ une largeur visible (`clientWidth`) — mouvement
  // reduit respecte : `behavior:'auto'` (saut sec, sans easing) au lieu de
  // `'smooth'` sous `prefers-reduced-motion:reduce`, meme garde que
  // `transition:'none'` ailleurs dans le tronc (cf. MxIconButton).
  function scrollByOneScreen(direction: -1 | 1) {
    const el = navRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
  }

  const fadeMask = buildFadeMask(overflow);

  return (
    <div style={{ position: 'relative' }}>
      <nav
        ref={navRef}
        aria-label={label}
        className={className}
        style={{
          display: 'flex',
          gap: 0,
          // Barre horizontale de defilement masquee (Firefox) ; overflow-y
          // FERME explicitement — sans quoi `overflow-x:auto` seul impose
          // `overflow-y:auto` et le moindre debordement vertical (une bordure,
          // un box-shadow mal borne...) fait apparaitre une barre verticale
          // parasite, meme quand rien ne depasse visuellement (correctif C4).
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          // 1px FIXE (--mx-border-w-thin, deja hors echelle) : filet du
          // conteneur, en box-shadow inset (pas en border-bottom, cf. le
          // commentaire de tete de fichier, correctif C4) — que le
          // soulignement 2px de l'onglet actif recouvre.
          boxShadow: 'inset 0 calc(-1 * var(--mx-border-w-thin)) 0 var(--mx-border)',
          // Degrade C3 : SEUL type de style que `mask-image` peut exprimer en
          // ligne (aucune pseudo-classe requise, donc pas une 3e exception
          // CSS du tronc, cf. tokens-mx.css) — `undefined` quand rien ne
          // deborde, la propriete n'est alors pas posee du tout.
          WebkitMaskImage: fadeMask,
          maskImage: fadeMask,
          ...style,
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const iconNode = Icon ? (
            <span aria-hidden="true" style={{ display: 'flex', flexShrink: 0 }}>
              <Icon style={mxIconBox('sm')} />
            </span>
          ) : null;

          if (item.disabled) {
            return (
              <span
                key={item.id}
                aria-disabled="true"
                title={item.disabledTitle}
                style={MX_TAB_DISABLED_STYLE}
              >
                {iconNode}
                {item.label}
              </span>
            );
          }

          const hovered = hoveredId === item.id;

          return renderLink(item, {
            style: mxTabItemStyle({ isActive: item.isActive, hovered }),
            'aria-current': item.isActive ? 'page' : undefined,
            'data-mx-focus': '',
            onMouseEnter: () => setHoveredId(item.id),
            onMouseLeave: () => setHoveredId((h) => (h === item.id ? null : h)),
            children: (
              <>
                {iconNode}
                {item.label}
              </>
            ),
          });
        })}
      </nav>
      {overflow.left && (
        <MxIconButton
          icon={ChevronLeft}
          aria-label={scrollLabel}
          onClick={() => scrollByOneScreen(-1)}
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      )}
      {overflow.right && (
        <MxIconButton
          icon={ChevronRight}
          aria-label={scrollLabel}
          onClick={() => scrollByOneScreen(1)}
          style={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      )}
    </div>
  );
}

export default MxTabs;
