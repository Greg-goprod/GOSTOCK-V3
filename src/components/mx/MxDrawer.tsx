import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronsLeft, ChevronsRight, type LucideIcon } from 'lucide-react';

import { MxPortal } from './MxPortal';
import { MxAvatar } from './MxAvatar';
import { MX_TEXT, MX_TONE_FILL, MX_Z, type MxTone } from './tokens';
import { useMxReducedMotion } from './internal/useMxReducedMotion';
import { mxIconBox } from './internal/mxIcon';
import { resolveStackedZIndex, useMxLayeredDialog } from './internal/useMxLayeredDialog';
import { MxFormActionFooter, type MxDrawerFormFooterConfig } from './MxFormActionFooter';
import type { MxDrawerFooterVariant, MxDrawerLinkedArtist } from './mxDrawerModel';

/**
 * Bandeau de statut, tel que l'option `band` du handoff : `{ tone, labels[], icon }`.
 * Rendu en APLAT PLEIN PLEINE LARGEUR sous l'en-tete, sans rayon ni marge
 * laterale. Les libelles sont separes par un point, pas par un filet.
 */
export interface MxDrawerBand {
  tone: MxTone;
  labels: string[];
  /**
   * Icone Lucide — le COMPOSANT, jamais un element deja instancie : le
   * bandeau le rend lui-meme via `mxIconBox`, toujours en 'sm' (15px) — seule
   * taille demandee a ce jour (correction C1/C2 du lot "echelle et densite
   * d'affichage", 2026-09-29), en tete de bandeau.
   */
  icon?: LucideIcon;
}

/**
 * Crans de largeur du panneau. `sm`/`md`/`lg`/`xl` viennent du handoff,
 * `xxl`/`full` sont des extensions du projet — voir tokens-mx.css.
 */
export type MxDrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'full';

const MX_DRAWER_WIDTH: Record<MxDrawerSize, string> = {
  sm: 'var(--mx-drawer-w-sm)',
  md: 'var(--mx-drawer-w-md)',
  lg: 'var(--mx-drawer-w-lg)',
  xl: 'var(--mx-drawer-w-xl)',
  xxl: 'var(--mx-drawer-w-xxl)',
  full: 'var(--mx-drawer-w-full)',
};

/** Ancrage du panneau. `right` (defaut) reproduit le rendu existant a l'identique. */
export type MxDrawerSide = 'right' | 'left';

const MX_DRAWER_SHADOW: Record<MxDrawerSide, string> = {
  right: 'var(--mx-shadow-drawer)',
  left: 'var(--mx-shadow-drawer-left)',
};

const MX_DRAWER_CLOSED_TRANSFORM: Record<MxDrawerSide, string> = {
  right: 'translateX(100%)',
  left: 'translateX(-100%)',
};

/**
 * Theme LOCAL du panneau, independant de la page. `inherit` (defaut) ne pose
 * aucun attribut : le panneau suit le theme ambiant, comme aujourd'hui. `dark`/
 * `light` posent `data-theme` sur le PANNEAU SEUL (pas sur le voile) — c'est ce
 * qui permet a un drawer de rester sombre dans une page claire, ou l'inverse,
 * exactement comme le prototype (classes `.scope-dark`/`.scope-light`).
 */
export type MxDrawerTheme = 'inherit' | 'dark' | 'light';

/** Un bouton icone d'en-tete, avant le bouton de fermeture. */
export interface MxDrawerHeaderAction {
  icon: LucideIcon;
  /** Sert a la fois d'`aria-label` et de `title` (info-bulle navigateur). */
  label: string;
  onClick: () => void;
}

/**
 * C8 — style local pour `eyebrow`. PAS ajoute a MX_TEXT : le token de taille
 * --mx-fs-subtitle (11px) existe deja mais porte 800/0.14em pour un usage
 * distinct, sans consommateur actuel (voir tokens-mx.css). Le handoff demande
 * 700 pour l'eyebrow de drawer (`.mx-dr-eyebrow`) — un poids DIFFERENT du
 * token du meme nom : partager MX_TEXT.subtitle romprait cet autre usage si son
 * poids changeait un jour. Taille et tracking restent token-driven.
 */
const EYEBROW_STYLE: CSSProperties = {
  fontFamily: 'var(--mx-font-ui)',
  fontWeight: 700,
  fontSize: 'var(--mx-fs-subtitle)',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  lineHeight: 1,
  color: 'var(--mx-text3)',
};

interface MxDrawerProps {
  /**
   * Monter le drawer en permanence et basculer open. Un montage directement
   * ouvert fonctionne (le focus est gere), mais perd les transitions d'entree
   * et de sortie.
   */
  open: boolean;
  onClose: () => void;
  /**
   * Une couche modale est ouverte AU-DESSUS du panneau : le drawer cesse alors
   * d'etre la couche du dessus et rend la main au clavier — ni piege de focus, ni
   * Echap. Sans cela, Tab serait rapatrie de force dans le panneau et les boutons
   * du dialogue deviendraient inatteignables, et Echap fermerait le drawer sous le
   * dialogue.
   *
   * A DECLARER par le consommateur, parce qu'aucune inference fiable n'existe :
   * aura/Modal n'expose ni role="dialog" ni aria-modal, et ne gere pas le focus —
   * l'element actif reste donc dans le drawer quand un dialogue s'ouvre. Le repli
   * DOM ci-dessous ne rattrape que les overlays CONFORMES.
   *
   * Le recouvrement VISUEL, lui, n'est plus un probleme depuis l'echelle
   * --mx-z-* : le panneau est a --mx-z-drawer (301) et aura/Modal a 500 par
   * defaut, la modale passe donc au-dessus d'elle-meme. Cette prop ne traite que
   * le CLAVIER.
   */
  suspended?: boolean;
  /** Titre du panneau. Sert aussi de nom accessible au dialogue. */
  title: string;
  /** Ligne de contexte sous le titre (date, statut…). */
  meta?: ReactNode;
  /** Bandeau de statut pleine largeur, entre l'en-tete et le corps. */
  band?: MxDrawerBand;
  /** Pied FIXE, hors du corps scrollable. Legacy — preferer footerVariant (LOT DRAWER-MODELE M1). */
  footer?: ReactNode;
  /**
   * Entite liee a un artiste : avatar obligatoire (meme emplacement/taille que
   * titleAvatar sm). Prime sur titleIcon ; initiales si pas de photo.
   */
  linkedArtist?: MxDrawerLinkedArtist;
  /** Famille de pied : entite (barre actions) ou formulaire/envoi. */
  footerVariant?: MxDrawerFooterVariant;
  /** Famille (a) — barre d'actions metier (MxEntityActionFooter ou wrapper). */
  entityFooter?: ReactNode;
  /** Famille (b) — Annuler + primaire (+ danger icone). */
  formFooter?: MxDrawerFormFooterConfig;
  /**
   * Cran de largeur. Defaut `md` (420px), la largeur que la DA donne au drawer
   * de deal. Les valeurs sont dans tokens-mx.css (--mx-drawer-w-*), voir le
   * commentaire qui les accompagne pour ce qui vient du handoff et ce qui est
   * une extension du projet.
   *
   * IL N'Y A PAS D'ECHAPPATOIRE EN PIXELS, volontairement : une echelle
   * contournable n'en est pas une, c'est ce qui a produit les 6736 tailles de
   * police en dur relevees dans l'audit UI. Une largeur hors echelle doit
   * devenir un cran, ou ne pas exister.
   */
  size?: MxDrawerSize;
  /** Ancrage du panneau. Defaut `right` — rendu et comportement inchanges. */
  side?: MxDrawerSide;
  /** Theme local du panneau (ilot `data-theme`). Defaut `inherit` : aucun attribut pose. */
  theme?: MxDrawerTheme;
  /** Icone devant le titre, en `--mx-accent`, taille 22. Absente par defaut. */
  titleIcon?: LucideIcon;
  /**
   * Avatar devant le titre (`MxAvatar size="sm"`, 28px), a la place de
   * `titleIcon` — LOT CONTRATS B2, C3.3 (2026-10-02), premier site d'appel :
   * `ContractDrawerMx` (avatar artiste « a cote du nom », dans l'en-tete du
   * chrome plutot qu'en premiere ligne du corps). Mutuellement exclusif avec
   * `titleIcon` en pratique (un seul ornement devant le titre a ce jour) mais
   * pas interdit par le type : `titleIcon` serait rendu AVANT si les deux
   * etaient fournis.
   */
  titleAvatar?: { src?: string | null; name?: string | null };
  /**
   * Mode de corps — LOT CONTRATS B2, C4.2 (2026-10-02). Defaut `scroll` :
   * comportement ACTUEL, inchange (`flex:1; minHeight:0; overflowY:'auto'`,
   * padding + gap entre enfants empiles) — c'est le mode des drawers non
   * encore migres au modele d'onglets (ex. SettlementDrawerMx, laisse en
   * l'etat dans ce lot).
   *
   * `fill` : DOCTRINE DRAWER (decision Greg, C4) — le corps du drawer ne
   * defile JAMAIS lui-meme (colonne flex, `overflow:'hidden'`, AUCUN padding
   * ni gap poses ici) ; c'est au contenu (typiquement `MxTabPanels`) de
   * decouper l'espace en une zone d'onglets fixe (`flexShrink:0`) et un
   * panneau actif `flex:1; minHeight:0`, qui gere lui-meme son propre
   * padding et son propre defilement interne si necessaire (liste longue,
   * apercu PDF en pleine hauteur). Premier site d'appel : `ContractDrawerMx`.
   */
  bodyMode?: 'scroll' | 'fill';
  /** Surtitre au-dessus du titre, 11px/700/0.14em/majuscules. Absent par defaut. */
  eyebrow?: string;
  /** Boutons icone d'en-tete, avant le bouton de fermeture. Absents par defaut. */
  headerActions?: MxDrawerHeaderAction[];
  /** Contenu entre `headerActions` et la fermeture (ex. abonnement cloche). */
  headerExtras?: ReactNode;
  /**
   * Defaut `true` (comportement actuel inchange). `false` : ni Echap ni le clic
   * sur le voile ne ferment le panneau — le bouton de fermeture du chrome, lui,
   * continue d'appeler `onClose`. N'affecte PAS `isTopLayer` ni l'asymetrie
   * existante entre Echap (soumis a `isTopLayer`) et le clic sur le voile (qui
   * ne l'est pas) : ce gate est orthogonal, applique aux deux de la meme facon.
   */
  dismissible?: boolean;
  /**
   * Defaut `true` (comportement actuel inchange) : focus le premier CHAMP a
   * l'ouverture. `false` : focus le panneau lui-meme (`tabIndex=-1`), comme
   * s'il n'y avait aucun element focusable a l'interieur.
   *
   * Lu via une REF mise a jour a chaque rendu, JAMAIS ajoute aux dependances de
   * l'effet `[open]` : ce dernier ne doit se rejouer qu'a l'ouverture/fermeture,
   * pas a chaque changement de cette prop — sinon le nettoyage rendrait le
   * focus au declencheur puis la mise en place le reprendrait, a chaque rendu
   * du parent qui changerait cette valeur.
   */
  autofocus?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * MxDrawer — chrome de panneau lateral droit.
 *
 * Accessibilite, au-dela du prototype du handoff :
 * - `role="dialog"` + `aria-modal` + nom accessible pris sur le titre ;
 * - Echap ferme ;
 * - focus porte au premier CHAMP a l'ouverture (a defaut, premier element
 *   focusable, a defaut le panneau) ;
 * - focus PIEGE dans le panneau : Tab et Maj+Tab bouclent sans en sortir ;
 * - focus RESTITUE a l'element declencheur a la fermeture ;
 * - `inert` quand ferme : le panneau reste monte pour la transition de sortie
 *   mais quitte l'ordre de tabulation et l'arbre d'accessibilite. L'oubli de ce
 *   point laisse un drawer ferme atteignable au clavier.
 * - contour de focus VISIBLE sur le bouton de fermeture, et sur tout element du
 *   tronc pose dans le corps du panneau (EXCEPTION 1 / 2 de tokens-mx.css). Le
 *   panneau lui-meme en est exclu, voir le commentaire sur son `outline`.
 *
 * REGLE DES COUCHES MODALES : le piege de focus et Echap ne s'appliquent que si le
 * drawer est la couche du dessus. Des qu'un dialogue s'ouvre par-dessus, le
 * consommateur doit le declarer par `suspended` (voir la prop). Sans cela, le
 * piege rend les boutons du dialogue inatteignables au clavier.
 *
 * MECANISME PARTAGE (LOT MODALE B1, 2026-10-02) : la pile de couches
 * (`isTopLayer`), le piege de focus, l'Echap multi-couches, le focus initial
 * (cas « monte deja ouvert » compris) et la restitution du focus sont
 * EXTRAITS dans `internal/useMxLayeredDialog.ts`, consomme ici a l'identique
 * — voir son en-tete pour le detail, et la correction de l'asymetrie
 * voile/Echap qu'il porte desormais. MxModal (meme lot) le consomme aussi :
 * c'est pour cela qu'une modale ouverte par-dessus ce drawer y est deja
 * detectee par le repli DOM d'`isTopLayer` (role="dialog"/"alertdialog" +
 * aria-modal="true"), sans que `suspended` soit necessaire pour elle.
 *
 * EMPILEMENT DE DEUX MxDrawer (`stackFamily: 'drawer'`, LOT
 * DRAWER-EMPILEMENT, phase A, Greg 27/10/2026) : deux MxDrawer ouverts en
 * meme temps partagent le MEME jeton --mx-z-drawer/-drawer-scrim — l'ordre
 * du DOM les departageait alors, et cet ordre ne refletait PAS l'ordre
 * d'OUVERTURE des que l'un des deux se demonte/remonte avec son `open`
 * (motif `if (!open) return null` d'un composant appelant, ex.
 * OfferDrawerMx) pendant que l'autre reste monte en permanence (ex.
 * OfferComposer) : la couche a montage conditionnel finit toujours derniere
 * dans le DOM, donc toujours au-dessus, meme ouverte AVANT l'autre. Voir
 * `resolveStackedZIndex`/`useMxLayeredDialog.ts` pour le correctif (file
 * d'ouverture, pas de montage). Sans effet sur un ecran a un seul drawer.
 *
 * BACKLOG DU TRONC
 *   `suspended` reste necessaire tant que des modales AURA (aura/Modal, sans
 *   role="dialog"/aria-modal) peuvent encore s'ouvrir au-dessus de ce
 *   drawer : le repli DOM ne les voit pas. Facultatif pour toute paire
 *   MxDrawer/MxModal, deja le cas aujourd'hui.
 *
 *   MxStatusPill : ajouter le statut `cancelled` (6 sites dans les consoles
 *   loges) au moment de migrer ces ecrans. Borne a pending/validated en
 *   tranche 1, voir l'en-tete de MxStatusPill.
 */
export function MxDrawer({
  open,
  onClose,
  title,
  meta,
  band,
  footer,
  linkedArtist,
  footerVariant,
  entityFooter,
  formFooter,
  suspended = false,
  size = 'md',
  side = 'right',
  theme = 'inherit',
  titleIcon,
  titleAvatar,
  bodyMode = 'scroll',
  eyebrow,
  headerActions,
  headerExtras,
  dismissible = true,
  autofocus = true,
  children,
  className,
  style,
}: MxDrawerProps) {
  const [closeHover, setCloseHover] = useState(false);
  /** Index du bouton `headerActions` survole, ou nul. */
  const [hoveredAction, setHoveredAction] = useState<number | null>(null);
  const TitleIcon = titleIcon;
  const effectiveTitleAvatar = linkedArtist
    ? { src: linkedArtist.src ?? null, name: linkedArtist.name }
    : titleAvatar;
  const BandIcon = band?.icon;
  const CloseIcon = side === 'left' ? ChevronsLeft : ChevronsRight;

  const resolvedFooter =
    footerVariant === 'entity'
      ? entityFooter
      : footerVariant === 'form' && formFooter
        ? <MxFormActionFooter {...formFooter} />
        : footer;

  /**
   * Lot C-RM (2026-09-24) : sous reduce, le glissement du panneau est remplace
   * par un fondu d'opacite seul — voir le bloc de style du panneau plus bas.
   * Ne touche ni au montage (le panneau reste monte, comme aujourd'hui), ni a
   * l'effet de focus du hook partage, ni a `onClose`, ni a `inert` : ce
   * booleen ne pilote QUE des valeurs de style.
   */
  const reduced = useMxReducedMotion();

  // Pile de couches, piege de focus, Echap multi-couches, focus initial et
  // restitution — voir internal/useMxLayeredDialog.ts (LOT MODALE B1).
  // `stackFamily: 'drawer'` — LOT DRAWER-EMPILEMENT, phase A (Greg,
  // 27/10/2026) : departage deux MxDrawer empiles (meme jeton --mx-z-drawer)
  // par leur ordre d'OUVERTURE, pas de montage DOM — voir le commentaire de
  // `resolveStackedZIndex`. Sans effet (niveau 0, jeton inchange) tant qu'un
  // seul MxDrawer est ouvert, le cas de loin le plus frequent.
  const { panelRef, handleScrimClick, stackLevel } = useMxLayeredDialog({
    open,
    onClose,
    dismissible,
    autofocus,
    suspended,
    stackFamily: 'drawer',
  });

  // React 18 ne pose pas l'attribut `inert` reçu en propriété : on le règle sur le nœud lui-même,
  // pour qu'un panneau fermé (encore monté pour l'animation) ne soit ni atteignable ni annoncé.
  const nodeRef = useRef<(HTMLElement & { inert?: boolean }) | null>(null);
  const setPanel = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
    panelRef(node);
  }, [panelRef]);
  useEffect(() => {
    if (nodeRef.current) nodeRef.current.inert = !open;
  }, [open]);

  return (
    <MxPortal>
      <div
        aria-hidden="true"
        onClick={handleScrimClick}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: resolveStackedZIndex(MX_Z.drawerScrim, stackLevel),
          background: 'var(--mx-scrim-overlay)',
          backdropFilter: 'blur(3px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          // Lot C-RM : duree raccourcie sous reduce, aucun nouveau token (decision
          // Greg 2026-09-24). Meme propriete, meme courbe, seule la duree change.
          transition: `opacity ${reduced ? 'var(--mx-dur-fast)' : 'var(--mx-dur-scrim)'} var(--mx-ease-appear)`,
        }}
      />

      <div
        ref={setPanel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={open ? undefined : true}
        tabIndex={-1}
        {...((!open ? { inert: '' } : {}) as Record<string, string>)}
        // Ilot de theme LOCAL, absent en `inherit` (defaut) : rendu identique
        // a l'existant tant que `theme` n'est pas fourni. Pose sur le PANNEAU
        // seul — jamais sur le voile, qui reste toujours au theme ambiant.
        data-theme={theme === 'inherit' ? undefined : theme}
        className={className}
        style={{
          position: 'fixed',
          top: 0,
          ...(side === 'left' ? { left: 0 } : { right: 0 }),
          bottom: 0,
          zIndex: resolveStackedZIndex(MX_Z.drawer, stackLevel),
          display: 'flex',
          flexDirection: 'column',
          width: `min(${MX_DRAWER_WIDTH[size]}, 100vw)`,
          background: 'var(--mx-surface)',
          // Aucune bordure laterale : le panneau se detache par son ombre seule,
          // comme `.mx-dr` du prototype. Un filet de 1px ici empecherait le
          // bandeau de statut de toucher le bord du panneau.
          //
          // LOT C-RM (2026-09-24) — sous reduce, le glissement devient un fondu
          // d'opacite SEUL : le panneau ne bouge jamais (`transform` fige a sa
          // valeur ouverte), et l'ombre l'accompagne en permanence puisque c'est
          // l'opacite qui porte desormais la disparition. Hors reduce, ces trois
          // valeurs et la transition restent A L'IDENTIQUE de l'existant.
          //
          // C8 — `side="left"` : ombre et sens du glissement miroirs
          // (MX_DRAWER_SHADOW / MX_DRAWER_CLOSED_TRANSFORM). Sous reduce,
          // immobile des DEUX cotes, comme a droite : seule la valeur OUVERTE
          // (translateX(0)) est commune aux deux sens.
          boxShadow: reduced ? MX_DRAWER_SHADOW[side] : open ? MX_DRAWER_SHADOW[side] : 'none',
          transform: reduced
            ? 'translateX(0)'
            : open
              ? 'translateX(0)'
              : MX_DRAWER_CLOSED_TRANSFORM[side],
          opacity: reduced ? (open ? 1 : 0) : 1,
          // Defense en profondeur, meme motif que le voile ci-dessus (l.261) :
          // le panneau ferme n'intercepte aucun clic, qu'il soit hors ecran
          // (transform, hors reduce) ou transparent sur place (opacity, reduce).
          pointerEvents: open ? 'auto' : 'none',
          transition: reduced
            ? 'opacity var(--mx-dur-fast) var(--mx-ease-appear)'
            : 'transform var(--mx-dur-drawer) var(--mx-ease-drawer)',
          // SEUL `outline:'none'` en ligne que le tronc CONSERVE, et il ne faut
          // pas le retirer « par coherence » avec les quatre autres, supprimes
          // au profit de l'EXCEPTION 1 / 2 de tokens-mx.css. Le panneau est
          // focalise par PROGRAMME a l'ouverture, faute d'element focusable a
          // l'interieur (voir l'effet plus bas) ; l'heuristique :focus-visible
          // des navigateurs peut alors s'y declencher et cerner le panneau
          // ENTIER d'un contour. Un conteneur qui recoit le focus par
          // defaut n'est pas une cible de focus clavier : il ne porte donc pas
          // `data-mx-focus`, et garde son contour neutralise ici.
          outline: 'none',
          ...style,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--mx-space-12)',
            // Pas de filet sous l'en-tete : c'est le bandeau qui assure la
            // separation quand il est present, et le prototype n'en pose aucun.
            padding: 'var(--mx-space-24) var(--mx-space-24) var(--mx-space-16)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              // 10px : gap de `.mx-dr-head`, qui separe le titre de sa ligne de
              // meta. Absent de l'echelle, qui passe de 8 a 12 ; la valeur du
              // handoff prime sur l'arrondi. A 8px, la meta collait au titre.
              gap: 'calc(10px * var(--mx-scale, 1))',
              minWidth: 0,
              flex: 1,
            }}
          >
            {eyebrow ? <span style={EYEBROW_STYLE}>{eyebrow}</span> : null}
            <h2
              style={{
                ...MX_TEXT.drawerTitle,
                color: 'var(--mx-text)',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                // Rendu additif SEULEMENT si `titleIcon`/`titleAvatar` : sans
                // eux, le style reste identique a l'existant (pas de
                // display/gap ajoutes).
                ...(TitleIcon || effectiveTitleAvatar
                  ? {
                      display: 'flex',
                      alignItems: 'center',
                      // 10 : ecart titre/icone de `.mx-dr-title`, absent de
                      // l'echelle (8 puis 12) — meme precedent que le gap de
                      // meta ci-dessus, litteral commente « handoff ».
                      gap: 'calc(10px * var(--mx-scale, 1))',
                    }
                  : null),
              }}
            >
              {TitleIcon ? (
                <TitleIcon
                  aria-hidden="true"
                  style={{ ...mxIconBox('xl'), color: 'var(--mx-accent)', flexShrink: 0 }}
                />
              ) : null}
              {effectiveTitleAvatar ? (
                <MxAvatar src={effectiveTitleAvatar.src} name={effectiveTitleAvatar.name} size="sm" />
              ) : null}
              {title}
            </h2>
            {meta ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--mx-space-8)',
                  flexWrap: 'wrap',
                }}
              >
                {meta}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              // 8px : gap de `.mx-dr-head-actions` du prototype.
              gap: 'var(--mx-space-8)',
              flexShrink: 0,
            }}
          >
            {headerActions?.map((action, i) => {
              const ActionIcon = action.icon;
              const hover = hoveredAction === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={action.onClick}
                  aria-label={action.label}
                  title={action.label}
                  // Meme contour de focus clavier que le bouton de fermeture,
                  // EXCEPTION 1 / 2 de tokens-mx.css.
                  data-mx-focus=""
                  onMouseEnter={() => setHoveredAction(i)}
                  onMouseLeave={() => setHoveredAction(null)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 'var(--mx-iconbtn-size)',
                    height: 'var(--mx-iconbtn-size)',
                    flexShrink: 0,
                    borderRadius: 'var(--mx-radius-6)',
                    background: hover ? 'var(--mx-surface2)' : 'transparent',
                    border: 'none',
                    color: hover ? 'var(--mx-text)' : 'var(--mx-text3)',
                    cursor: 'pointer',
                    transition:
                      'background var(--mx-dur-fast) var(--mx-ease-appear), color var(--mx-dur-fast) var(--mx-ease-appear)',
                  }}
                >
                  <ActionIcon style={mxIconBox('md')} aria-hidden="true" />
                </button>
              );
            })}
            {headerExtras}

            <button
              type="button"
              onClick={onClose}
              aria-label={title}
              // Contour de focus clavier, EXCEPTION 1 / 2 de tokens-mx.css. C'est
              // le seul element focusable du chrome du panneau : sans contour, un
              // utilisateur au clavier ne voyait pas comment fermer le drawer,
              // ce bouton n'ayant deja ni bordure ni fond au repos.
              data-mx-focus=""
              onMouseEnter={() => setCloseHover(true)}
              onMouseLeave={() => setCloseHover(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 'var(--mx-iconbtn-size)',
                height: 'var(--mx-iconbtn-size)',
                flexShrink: 0,
                // 6px : le README n'a pas de ligne « bouton icone » ; le prototype
                // (.mx-dr-icon-btn) pose 6px, soit la classe « menus / champs ».
                borderRadius: 'var(--mx-radius-6)',
                // Aucune BORDURE : `.mx-dr-icon-btn` part d'un `all:unset`. Le
                // bouton est un affordance discret, il se revele au survol — le
                // cerner en permanence le met au meme niveau que les actions du
                // pied, qui sont les vraies decisions de l'ecran.
                background: closeHover ? 'var(--mx-surface2)' : 'transparent',
                border: 'none',
                color: closeHover ? 'var(--mx-text)' : 'var(--mx-text3)',
                cursor: 'pointer',
                transition:
                  'background var(--mx-dur-fast) var(--mx-ease-appear), color var(--mx-dur-fast) var(--mx-ease-appear)',
              }}
            >
              <CloseIcon style={mxIconBox('lg')} aria-hidden="true" />
            </button>
          </div>
        </header>

        {band ? (
          // PLEINE LARGEUR : ce bloc est un frere direct de l'en-tete et du
          // corps, donc il echappe a leur padding lateral. Aucun rayon, aucune
          // marge : l'aplat touche les deux bords du panneau.
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              // 10px : gap de `.mx-dr-band`. Absent de l'echelle (8 puis 12) ;
              // la valeur du handoff prime sur l'arrondi.
              gap: 'calc(10px * var(--mx-scale, 1))',
              padding: 'var(--mx-space-8) var(--mx-space-24)',
              background: MX_TONE_FILL[band.tone].bg,
              color: MX_TONE_FILL[band.tone].fg,
            }}
          >
            {BandIcon ? (
              <span style={{ display: 'flex', flexShrink: 0 }} aria-hidden="true">
                <BandIcon style={mxIconBox('sm')} />
              </span>
            ) : null}
            {band.labels.map((label, i) => (
              <span
                key={label}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--mx-space-8)' }}
              >
                {i > 0 ? (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 'var(--mx-dot-sm)',
                      height: 'var(--mx-dot-sm)',
                      borderRadius: 'var(--mx-radius-pill)',
                      background: 'currentColor',
                      opacity: 0.6,
                    }}
                  />
                ) : null}
                <span style={MX_TEXT.band}>{label}</span>
              </span>
            ))}
          </div>
        ) : null}

        <div
          // LOT BOOKING-DRAWERS-FIN -- LOT 2, C2.4 (2026-10-23) -- barre de
          // defilement 5px/piste transparente/poignee --mx-border (tokens-mx.css,
          // regle [data-mx-scroll]) -- seul `bodyMode="scroll"` defile ICI ;
          // `bodyMode="fill"` delegue au contenu (voir son propre
          // `data-mx-scroll`, ex. OfferComposer/SendOfferEmailCore).
          {...(bodyMode === 'fill' ? {} : { 'data-mx-scroll': '' })}
          style={
            bodyMode === 'fill'
              ? {
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }
              : {
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  // .mx-dr-body de la référence : 20 / 24 / 8
                  padding: 'calc(20px * var(--mx-scale, 1)) var(--mx-space-24) var(--mx-space-8)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--mx-space-24)',
                }
          }
        >
          {children}
        </div>

        {resolvedFooter ? (
          <div
            style={{
              flexShrink: 0,
              padding: 'var(--mx-space-16) var(--mx-space-24) calc(22px * var(--mx-scale, 1))',
              borderTop: 'var(--mx-border-w) solid var(--mx-border)',
              background: 'var(--mx-surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--mx-space-12)',
            }}
          >
            {resolvedFooter}
          </div>
        ) : null}
      </div>
    </MxPortal>
  );
}

export type { MxDrawerLinkedArtist, MxDrawerFooterVariant } from './mxDrawerModel';

export default MxDrawer;
