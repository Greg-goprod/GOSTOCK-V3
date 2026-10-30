import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import type { LucideIcon } from 'lucide-react';

import { MxPortal } from './MxPortal';
import { MX_Z } from './tokens';
import { useMxReducedMotion } from './internal/useMxReducedMotion';
import { mxIconBox } from './internal/mxIcon';
import { GROUP_LABEL_STYLE } from './internal/mxGroupLabel';

/**
 * MxMenu — menu deroulant a selection unique, tel que la section « Dropdown &
 * menus » du catalogue (reference/Mannyx Components V2.html, L.1254-1317
 * pour le marquage, L.179-190 + L.232-235 pour le CSS — classes
 * `.dropdown-menu`/`.dd-item`/`.dd-group-label`/`.dd-sep`/`.dd-active`).
 *
 * SEMANTIQUE : `role="menu"` + items de `groups` en `role="menuitemradio"`/
 * `aria-checked`. Decision de Greg (lot "selecteur-evenement", B1,
 * 2026-09-29) : c'est un choix UNIQUE parmi une liste (« quel evenement est
 * courant »), pas une liste d'actions independantes — le vocabulaire ARIA
 * "radio" le dit explicitement. Les `actions` (LOT MENU-UTILISATEUR, C1,
 * 2026-09-29), elles, sont en `role="menuitem"` CLASSIQUE : ce sont des
 * actions independantes (« Deconnexion », « Gerer les evenements »), pas une
 * selection — meme raisonnement, verdict inverse. Les deux familles
 * PARTAGENT la meme navigation clavier (fleches/Debut/Fin/Entree), voir plus
 * bas.
 *
 * DECLENCHEUR FOURNI PAR L'APPELANT, meme convention que `renderLink` de
 * MxTabs (lot nav-primitives-3a) : MxMenu ne rend JAMAIS lui-meme le bouton
 * declencheur. Il calcule `triggerProps` (aria-haspopup, aria-expanded,
 * aria-controls, onClick, onKeyDown, ref) et l'appelant les ETALE sur son
 * propre `<button>`, avec sa propre apparence (pastille couleur, chevron...).
 * `ref` est une fonction de callback, PAS un objet mutable : etaler
 * `{...triggerProps}` sur un `<button>` attache donc correctement la ref
 * (React extrait `ref` d'un objet de props etale, meme mecanisme que
 * `register()` de react-hook-form — precedent bien etabli, pas une astuce
 * fragile).
 *
 * PANNEAU VIA MxPortal, en `position:fixed`, positionne sous le declencheur
 * (`getBoundingClientRect()` a l'ouverture puis recalcule sur resize/scroll
 * — capture sur `window`, qui intercepte aussi le defilement d'un ANCETRE
 * scrollable, meme si l'evenement `scroll` ne remonte pas en bulles). Fermeture
 * AUTOMATIQUE si le declencheur sort entierement de la fenetre (le panneau
 * n'aurait plus d'ancre visible).
 *
 * TOUJOURS MONTE (jamais conditionne a la resolution de la position) tant que
 * `open` est vrai — la position par defaut, hors ecran (-9999), est corrigee
 * par un `useLayoutEffect` AVANT la premiere peinture : aucun flash visible,
 * et les refs d'item sont deja attachees au moment ou l'effet de focus
 * s'execute (evite le motif "ref en attente" de MxDrawer, inutile ici
 * puisque le panneau n'a pas besoin d'exister AVANT `open`).
 *
 * CLAVIER : fleches haut/bas avec bouclage, Debut/Fin, Entree/Espace
 * (selectionne + ferme + rend le focus au declencheur), Echap (ferme + rend
 * le focus au declencheur), Tab (ferme SANS piegeage — le focus poursuit sa
 * tabulation naturelle, contrairement a MxDrawer qui piege Tab : un menu
 * n'est pas une boite de dialogue modale). Le survol souris DEPLACE le meme
 * `activeIndex` que le clavier (pas d'etat de survol separe) : deplacer la
 * souris sur un item en fait la cible d'un Entree/fleche suivant, exactement
 * comme un `<select>` natif. La navigation clavier (fleches, Debut, Fin)
 * PORTE SUR LA LISTE COMBINEE items de `groups` PUIS `actions`, dans cet
 * ordre — Fin atteint donc la DERNIERE action, pas le dernier item de
 * groupe (correctif C1, 2026-09-29 : avant ce correctif, le pied d'actions
 * n'etait qu'un `footer` en `ReactNode` libre, invisible du clavier — deux
 * boutons y vivaient sans jamais etre atteignables aux fleches).
 *
 * CLIC EXTERIEUR ferme (ecoute `mousedown` sur `document`, hors declencheur
 * et panneau).
 *
 * STYLE — 3 CHOIX SIGNALES (aucun token exact prealable) :
 *   - ombre : `--mx-elev-3` (EXISTANT, aucun consommateur avant ce lot). La
 *     valeur du catalogue (`0 8px 32px rgba(0,0,0,.12)`) n'a pas d'alias
 *     exact ; `--mx-elev-3` est l'echelon d'elevation NON THEME (identique
 *     dark/light, donc deja "sur" pour les deux) le plus proche en poids
 *     visuel et le seul dedie a une COUCHE FLOTTANTE de ce rang — reutilise
 *     plutot qu'un nouveau token, faute d'ecart justifiant d'en ajouter un.
 *   - rayon : `--mx-radius-6`, correspondance EXACTE avec le catalogue (6px).
 *   - taille du libelle de groupe : NOUVEAU token `--mx-fs-menu-group-label`
 *     (10px), le catalogue etant SOUS le plancher existant (10.5px) — meme
 *     motif que `--mx-fs-step-label`/`-num` de MxSteps, voir tokens-mx.css.
 *   - z-index : `--mx-z-popover` (500), PAS le 100 du catalogue — c'est la
 *     valeur PROJET pour "tout flottant ANCRE a un champ", deja documentee
 *     dans tokens-mx.css comme LA valeur reprise telle quelle au handoff pour
 *     cette famille (menu/select/popover/popup de picker).
 *
 * `--mx-scale` s'applique a tout, SAUF les traits (filet 1px du panneau et
 * du separateur, `--mx-border-w-thin`, deja hors echelle par convention).
 * Sous `prefers-reduced-motion: reduce`, la transition d'apparition et le
 * micro-deplacement horizontal au survol/actif disparaissent (meme motif que
 * MxButton/MxDrawer, lot C-RM) — le panneau reste positionne, seule
 * l'ANIMATION change.
 *
 * EXTENSIONS LOT MENU-UTILISATEUR B (2026-09-29), sans casser le contrat
 * ci-dessus ni les appelants existants (selecteur d'evenement inchange) :
 *   - `header` : bloc NON INTERACTIF en tete de panneau (identite
 *     avatar/nom/role). Hors navigation clavier — jamais dans `flatItems`.
 *   - `MxMenuItem.closeOnSelect` : `false` garde le menu OUVERT apres
 *     selection (groupe Densite — Greg veut cycler Normale/Compacte/Tres
 *     compacte sans reouvrir). Absent ou `true` : comportement INCHANGE
 *     (ferme + rend le focus au declencheur).
 *   - `placement` : `'below'` (defaut, INCHANGE) ou `'above'` — le menu
 *     utilisateur est monte en pied de barre laterale, pres du bord bas de
 *     la fenetre ; `'above'` ancre le panneau par `bottom` (CSS), qui pousse
 *     vers le HAUT sans avoir a mesurer la hauteur du panneau au prealable.
 *
 * CORRECTIF C1 (2026-09-29, demande explicite de Greg — accessibilite
 * clavier) : `footer` (ReactNode libre, INVISIBLE du clavier) est REMPLACE
 * par `actions?: MxMenuAction[]` — items d'ACTION (`role="menuitem"`, icone
 * Lucide optionnelle), integres a LA MEME navigation clavier que les items
 * de `groups` (fleches, Debut/Fin, Entree/Espace, fermeture+focus au
 * declencheur par defaut). Suppression deliberee de `footer`, pas juste
 * ajout d'`actions` a cote : un footer libre restait une porte ouverte pour
 * re-introduire une action inatteignable au clavier — les 2 seuls appelants
 * (« Gerer les evenements » du selecteur d'evenement, « Mon profil »/
 * « Deconnexion » du menu utilisateur) migrent vers `actions`.
 *
 * CORRECTIF C2.2 (LOT ARTISTES-LISTE, retours de recette, 2026-10-03) :
 * `recomputePosition` CLAMPE desormais le panneau a la fenetre visible.
 * Horizontal : si l'alignement par defaut (bord GAUCHE du panneau sur le
 * bord gauche du declencheur) ferait deborder le panneau a DROITE de la
 * fenetre, le panneau est realigne sur le bord DROIT du declencheur a la
 * place (`left = rect.right - panelWidth`) — la largeur de la BARRE DE
 * DEFILEMENT verticale de la fenetre (si presente) est deduite de la limite
 * (`document.documentElement.clientWidth` EXCLUT la barre, `window.
 * innerWidth` l'INCLUT ; la difference est sa largeur), pour que le panneau
 * ne passe jamais SOUS elle. Vertical : si la direction demandee par
 * `placement` deborderait (bas de fenetre pour `'below'`, haut de fenetre
 * pour `'above'`), bascule vers l'AUTRE direction pour cette ouverture.
 * Necessite la taille REELLE du panneau (`offsetWidth`/`offsetHeight`),
 * indisponible au PREMIER appel (`MxPortal` differe son premier portage reel
 * d'un cycle, voir sa doc) : ce premier appel pose donc la position NAIVE
 * (comme avant ce correctif, panneau pas encore peint — `MxPortal` rend
 * encore `null`), puis `setPanelRef` RAPPELLE `recomputePosition` des que le
 * panneau est reellement attache au DOM, cette fois avec sa taille connue —
 * avant la peinture du navigateur (meme garantie de non-flash que le
 * positionnement initial, voir le commentaire de tete de fichier). Les
 * appelants dont le panneau ne deborde JAMAIS (listes courtes du selecteur
 * d'evenement/menu utilisateur) ne voient aucun changement : le clamp ne se
 * declenche QUE si la taille mesuree deborderait.
 *
 * CORRECTIF C2.1 (LOT ARTISTES-LISTE, retours de recette, 2026-10-03) : le
 * panneau arrete desormais la PROPAGATION REACT d'un clic (`onClick` sur le
 * conteneur `role="menu"`). Necessaire parce que le panneau est rendu via
 * `MxPortal` : physiquement hors de l'arbre DOM du declencheur (attache a
 * `document.body`), mais React fait quand meme bulle un clic jusqu'aux
 * ANCETRES REACT du portail (doc officielle React, "event bubbling through
 * portals") — un item de menu reste donc un DESCENDANT REACT de tout
 * conteneur cliquable qui englobe le declencheur (carte cliquable d'une
 * grille, `<tr>` de `MxTable`), et son clic continuait de bulle jusqu'a lui
 * SANS ce correctif. Resultat observe par Greg en recette : cliquer
 * « Modifier »/« Supprimer » dans le menu d'une carte artiste ouvrait AUSSI
 * la fiche (le clic atteignait le `onClick` de la carte). Le correctif est
 * pose AU NIVEAU DU TRONC (une seule fois) plutot que chez chaque appelant :
 * protege uniformement tout consommateur present ou futur, qu'il ait ou non
 * son propre garde-fou (`MxTable` colonnes `interactive`, qui arretent deja
 * la propagation au niveau de la cellule — ce correctif est redondant pour
 * ces deux appelants, pas regressif : ils n'avaient pas d'ancetre cliquable
 * a proteger en premier lieu, voir leurs tests inchanges).
 */

export interface MxMenuItem {
  /** Cle React ET identifiant transmis a `onSelect`. */
  id: string;
  label: ReactNode;
  /** `aria-checked` — l'element COURANT (selection unique). */
  checked?: boolean;
  onSelect: () => void;
  /**
   * Ferme le menu apres selection — comportement PAR DEFAUT (absent ou
   * `true`), inchange pour tous les appelants existants (sensor
   * "selecteur-evenement", ses tests restent verts sans aucune modification).
   * `false` : le menu RESTE OUVERT (ex. groupe Densite du menu utilisateur,
   * LOT MENU-UTILISATEUR B, 2026-09-29 — Greg veut pouvoir comparer plusieurs
   * choix sans reouvrir le menu a chaque fois). L'item COCHE se met a jour au
   * rendu suivant normalement, puisque `checked` vient de l'appelant.
   */
  closeOnSelect?: boolean;
}

export interface MxMenuGroup {
  /** Cle React. */
  id: string;
  /** `role="group"` + libelle visible si present ; items a plat sinon. */
  label?: string;
  items: MxMenuItem[];
}

/**
 * Item d'ACTION du pied du panneau (`role="menuitem"`, PAS `menuitemradio` —
 * ce n'est pas une selection, voir le commentaire de semantique en tete de
 * fichier). LOT MENU-UTILISATEUR, correctif C1 (2026-09-29).
 */
export interface MxMenuAction {
  /** Cle React ET identifiant. */
  id: string;
  label: ReactNode;
  /** Icone Lucide OPTIONNELLE, posee avant le libelle — le COMPOSANT, jamais un element deja instancie. */
  icon?: LucideIcon;
  onSelect: () => void;
  /** Meme contrat que `MxMenuItem.closeOnSelect` — absent ou `true` : ferme + rend le focus au declencheur. */
  closeOnSelect?: boolean;
  /**
   * Ton de l'action — LOT OFFRES-CYCLE, C1.4 (Greg, 2026-10-17) : definition
   * d'action UNIQUE partagee par les menus de carte, les boutons de liste et
   * le pied de drawer (ex. offres : "Accepter"/"Valider sans renvoi" en
   * succes, "Refuser"/"Rejeter"/"Supprimer" en danger). Absent : couleur par
   * defaut (texte normal, accent au survol/actif), INCHANGE pour tous les
   * appelants existants.
   */
  tone?: 'success' | 'danger';
}

/**
 * Props ETALEES par l'appelant sur son propre bouton declencheur. `ref` est
 * VOLONTAIREMENT type comme une simple fonction de callback (pas `Ref<T>`,
 * qui inclut aussi `RefObject<T>` — un objet MUTABLE dont la propriete
 * `current` est verifiee en INVARIANCE par TypeScript, et casse alors
 * l'affectation vers le `ref` d'un `<button>` concret, HTMLButtonElement
 * n'etant pas equivalent a HTMLElement). Une fonction simple, elle, reste
 * assignable par CONTRAVARIANCE de parametre : une fonction qui accepte
 * `HTMLElement | null` sait aussi traiter n'importe quel `HTMLButtonElement`,
 * qui EN EST un.
 */
export interface MxMenuTriggerProps {
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string;
  onClick: () => void;
  onKeyDown: (e: ReactKeyboardEvent) => void;
  ref: (node: HTMLElement | null) => void;
}

export interface MxMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rend le declencheur de l'appelant, `triggerProps` etale dessus. */
  renderTrigger: (triggerProps: MxMenuTriggerProps) => ReactNode;
  groups: MxMenuGroup[];
  /** `aria-label` du panneau `role="menu"`. */
  label: string;
  /**
   * Bloc NON INTERACTIF en tete de panneau (ex. identite avatar/nom/role du
   * menu utilisateur, LOT MENU-UTILISATEUR B, 2026-09-29), separe des groupes
   * par un filet. Jamais dans la navigation clavier (pas de ref, pas de
   * tabIndex) : `flatItems`/`activeIndex` ne portent que sur `groups`, ce
   * bloc n'y figure pas.
   */
  header?: ReactNode;
  /**
   * Pied d'actions sous les groupes (ex. « Gerer les evenements », « Mon
   * profil », « Deconnexion »), separe par un filet. `role="menuitem"`
   * chacune, PLEINEMENT integrees a la navigation clavier des `groups`
   * (correctif C1, 2026-09-29 — remplace l'ancien `footer` en `ReactNode`
   * libre, invisible du clavier).
   */
  actions?: MxMenuAction[];
  /** Identifiant stable : `id` du panneau, cible de `aria-controls` du declencheur. */
  id: string;
  /**
   * Cote d'ouverture du panneau par rapport au declencheur. `'below'`
   * (defaut, INCHANGE pour les appelants existants — selecteur d'evenement)
   * ou `'above'`, LOT MENU-UTILISATEUR B (2026-09-29) : le menu utilisateur
   * est monte en PIED de barre laterale (`AppLayout.tsx`), pres du bord bas
   * de la fenetre — un panneau ouvert vers le bas y serait en grande partie
   * hors ecran. Ancre par `bottom` (et non `top`), qui n'a pas besoin de
   * connaitre la hauteur du panneau (contenu variable) pour rester colle au
   * declencheur en poussant VERS LE HAUT.
   */
  placement?: 'below' | 'above';
  className?: string;
  style?: CSSProperties;
}

const PANEL_OFFSCREEN = { top: -9999, bottom: 'auto' as const, left: -9999 };
// 6px : ecart declencheur/panneau du catalogue (`top:calc(100% + 6px)`),
// absent de l'echelle --mx-space-* (4 puis 8) — meme precedent que le
// padding 14px de MxTabs, la valeur du catalogue prime sur l'arrondi. Meme
// ecart applique de l'autre cote pour `placement="above"` (marginBottom).
const PANEL_GAP = 'calc(6px * var(--mx-scale, 1))';

/** `.dropdown-menu` du catalogue. */
const PANEL_BASE: CSSProperties = {
  position: 'fixed',
  zIndex: MX_Z.popover,
  // 160px : largeur mini du catalogue, absente de l'echelle (pas un cran de
  // drawer). Litterale, comme le padding de MxTabs.
  minWidth: 'calc(160px * var(--mx-scale, 1))',
  background: 'var(--mx-surface)',
  border: 'var(--mx-border-w-thin) solid var(--mx-border)',
  borderRadius: 'var(--mx-radius-6)',
  boxShadow: 'var(--mx-elev-3)',
  overflow: 'hidden',
  padding: 'var(--mx-space-4) 0',
  outline: 'none',
};

/** `.dd-sep` du catalogue. */
const SEP_STYLE: CSSProperties = {
  height: 'var(--mx-border-w-thin)',
  background: 'var(--mx-border)',
  margin: 'var(--mx-space-4) 0',
};

/** `.dd-item` du catalogue — base commune, sur/sous-etat portes separement. */
const ITEM_BASE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: 'var(--mx-space-8) calc(14px * var(--mx-scale, 1))',
  fontFamily: 'var(--mx-font-ui)',
  fontSize: 'var(--mx-fs-item)', // 13px, correspondance EXACTE (meme token que MxTabs).
  lineHeight: 1.3,
  cursor: 'pointer',
  userSelect: 'none',
};

function flattenItems(groups: MxMenuGroup[]): MxMenuItem[] {
  return groups.flatMap((g) => g.items);
}

/**
 * Liste NAVIGABLE combinee, groupes PUIS actions, dans l'ORDRE de rendu —
 * meme ordre que la navigation clavier (Fin atteint donc la derniere
 * action). Champ commun aux 2 familles : `onSelect`/`closeOnSelect`. `label`/
 * `icon`/`checked` ne sont pas necessaires ici (logique clavier uniquement,
 * le rendu relit `groups`/`actions` separement).
 */
function flatNavigable(
  groups: MxMenuGroup[],
  actions: MxMenuAction[],
): Array<{ onSelect: () => void; closeOnSelect?: boolean }> {
  return [...flattenItems(groups), ...actions];
}

export function MxMenu({
  open,
  onOpenChange,
  renderTrigger,
  groups,
  label,
  header,
  actions = [],
  id,
  placement = 'below',
  className,
  style,
}: MxMenuProps) {
  const triggerElRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  /**
   * Focus en attente — MEME MOTIF que `pendingFocusRef` de MxDrawer.
   * `MxMenu` rend TOUJOURS son panneau des que `open` est vrai (jamais
   * conditionne a la resolution de `pos`), mais `MxPortal` differe malgre
   * tout son PREMIER portage reel d'un cycle de rendu (etat `mounted`, voir
   * son commentaire) : sur l'ouverture, l'effet de focus ci-dessous peut donc
   * s'executer AVANT que les items existent dans le DOM. Au lieu de
   * l'abandonner, l'index vise est stocke ici et applique par `setPanelRef`
   * des l'attachement REEL du conteneur — les refs d'item, enfants du
   * panneau, sont deja attachees a cet instant (meme commit).
   */
  const pendingFocusIndexRef = useRef<number | null>(null);
  // Lu par les effets keyes uniquement sur [open] : evite de re-executer ces
  // effets a chaque rendu du parent (meme motif que autofocusRef de MxDrawer).
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const [pos, setPos] = useState<{ top: number | 'auto'; bottom: number | 'auto'; left: number }>(
    PANEL_OFFSCREEN,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const reduced = useMxReducedMotion();

  const flatItems = flatNavigable(groups, actions);

  const recomputePosition = useCallback(() => {
    const el = triggerElRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offscreen =
      rect.bottom <= 0 ||
      rect.top >= window.innerHeight ||
      rect.right <= 0 ||
      rect.left >= window.innerWidth;
    if (offscreen) {
      onOpenChange(false);
      return;
    }

    // Largeur de la barre de defilement verticale de la FENETRE (0 si
    // absente) : `clientWidth` du document EXCLUT la barre, `innerWidth`
    // l'INCLUT — la difference est sa largeur (C2.2).
    const scrollbarWidth = Math.max(
      0,
      window.innerWidth - document.documentElement.clientWidth,
    );
    const viewportRight = window.innerWidth - scrollbarWidth;

    // Taille REELLE du panneau — indisponible au tout premier appel
    // (MxPortal pas encore monte, voir le commentaire C2.2 en tete de
    // fichier) : 0 alors, et le clamp ci-dessous ne s'applique pas (position
    // naive identique a avant ce correctif, jamais peinte dans cet etat).
    const panelEl = panelRef.current;
    const panelWidth = panelEl?.offsetWidth ?? 0;
    const panelHeight = panelEl?.offsetHeight ?? 0;

    // Horizontal : bord gauche du panneau sur le bord gauche du declencheur
    // par defaut ; si cela deborderait a droite de la fenetre visible,
    // realigne sur le bord DROIT du declencheur a la place.
    let left = rect.left;
    if (panelWidth > 0 && left + panelWidth > viewportRight) {
      left = Math.max(0, rect.right - panelWidth);
    }

    // Vertical : respecte `placement`, mais bascule vers l'autre direction si
    // la direction demandee deborderait de la fenetre visible.
    let top: number | 'auto' = 'auto';
    let bottom: number | 'auto' = 'auto';
    if (placement === 'above') {
      const wouldOverflowTop = panelHeight > 0 && rect.top - panelHeight < 0;
      if (wouldOverflowTop) {
        top = rect.bottom;
      } else {
        bottom = window.innerHeight - rect.top;
      }
    } else {
      const wouldOverflowBottom = panelHeight > 0 && rect.bottom + panelHeight > window.innerHeight;
      if (wouldOverflowBottom) {
        bottom = window.innerHeight - rect.top;
      } else {
        top = rect.bottom;
      }
    }

    setPos({ top, bottom, left });
  }, [onOpenChange, placement]);

  // Ouverture : position immediate (avant peinture) + item actif initial
  // (celui coche, sinon le premier). `groupsRef` plutot que `groups` dans les
  // deps : ne doit se rejouer qu'A l'ouverture, pas a chaque rendu du parent.
  useLayoutEffect(() => {
    if (!open) {
      setPos(PANEL_OFFSCREEN);
      pendingFocusIndexRef.current = null;
      return;
    }
    recomputePosition();
    const items = flattenItems(groupsRef.current);
    const checkedIdx = items.findIndex((it) => it.checked);
    setActiveIndex(checkedIdx >= 0 ? checkedIdx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Recalcul au redimensionnement/defilement — capture sur `window` : les
  // evenements `scroll` d'un ANCETRE scrollable ne remontent pas en bulles,
  // mais traversent bien la phase de capture jusqu'a `window`.
  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', recomputePosition);
    window.addEventListener('scroll', recomputePosition, true);
    return () => {
      window.removeEventListener('resize', recomputePosition);
      window.removeEventListener('scroll', recomputePosition, true);
    };
  }, [open, recomputePosition]);

  // Clic exterieur.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerElRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, onOpenChange]);

  // Focus porte a l'item actif, a l'ouverture comme a chaque deplacement. Si
  // le panneau n'est pas encore attache (premiere ouverture, MxPortal pas
  // encore monte), l'index est mis en attente pour `setPanelRef` ci-dessous.
  useEffect(() => {
    if (!open) return;
    const el = itemRefs.current[activeIndex];
    if (el) {
      el.focus();
    } else {
      pendingFocusIndexRef.current = activeIndex;
    }
  }, [open, activeIndex]);

  const setPanelRef = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node;
      if (node && pendingFocusIndexRef.current != null) {
        const idx = pendingFocusIndexRef.current;
        pendingFocusIndexRef.current = null;
        itemRefs.current[idx]?.focus();
      }
      // C2.2 : premier attachement reel du panneau (MxPortal differe son
      // premier portage, voir sa doc) -- recalcule la position avec la
      // taille REELLE maintenant connue (`offsetWidth`/`offsetHeight`),
      // indisponible lors du premier appel naif depuis l'ouverture.
      if (node) {
        recomputePosition();
      }
    },
    [recomputePosition],
  );

  const closeAndFocusTrigger = useCallback(() => {
    onOpenChange(false);
    triggerElRef.current?.focus();
  }, [onOpenChange]);

  const handlePanelKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (flatItems.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % flatItems.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(flatItems.length - 1);
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const item = flatItems[activeIndex];
        item?.onSelect();
        if (item?.closeOnSelect !== false) closeAndFocusTrigger();
        break;
      }
      case 'Escape':
        e.preventDefault();
        closeAndFocusTrigger();
        break;
      case 'Tab':
        // PAS de preventDefault : Tab suit son cours naturel, le menu se
        // ferme simplement sans piegeage de focus (contrat B1, "Tab ferme" —
        // a la difference de MxDrawer, qui piege Tab, un menu n'est pas une
        // boite de dialogue modale).
        onOpenChange(false);
        break;
      default:
        break;
    }
  };

  const triggerProps: MxMenuTriggerProps = {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': id,
    onClick: () => onOpenChange(!open),
    onKeyDown: (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!open) {
          e.preventDefault();
          onOpenChange(true);
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpenChange(!open);
      }
    },
    ref: (node) => {
      triggerElRef.current = node;
    },
  };

  let flatIndex = -1;

  return (
    <>
      {renderTrigger(triggerProps)}
      {open ? (
        <MxPortal>
          <div
            ref={setPanelRef}
            id={id}
            role="menu"
            aria-label={label}
            onKeyDown={handlePanelKeyDown}
            onClick={(e) => e.stopPropagation()}
            className={className}
            style={{
              ...PANEL_BASE,
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              marginTop: placement === 'below' ? PANEL_GAP : 0,
              marginBottom: placement === 'above' ? PANEL_GAP : 0,
              transition: reduced
                ? 'none'
                : 'opacity var(--mx-dur-fast) var(--mx-ease-appear)',
              ...style,
            }}
          >
            {header ? (
              <>
                <div role="presentation">{header}</div>
                {groups.length > 0 || actions.length > 0 ? (
                  <div role="separator" style={SEP_STYLE} />
                ) : null}
              </>
            ) : null}
            {groups.map((group, gi) => (
              <div key={group.id} role={group.label ? 'group' : undefined} aria-label={group.label}>
                {group.label ? <div style={GROUP_LABEL_STYLE}>{group.label}</div> : null}
                {group.items.map((item) => {
                  flatIndex += 1;
                  const myIndex = flatIndex;
                  const highlighted = item.checked || myIndex === activeIndex;
                  return (
                    <div
                      key={item.id}
                      ref={(node) => {
                        itemRefs.current[myIndex] = node;
                      }}
                      role="menuitemradio"
                      aria-checked={!!item.checked}
                      tabIndex={-1}
                      onClick={() => {
                        item.onSelect();
                        if (item.closeOnSelect !== false) closeAndFocusTrigger();
                      }}
                      onMouseEnter={() => setActiveIndex(myIndex)}
                      style={{
                        ...ITEM_BASE,
                        background: highlighted ? 'var(--mx-accent-lt)' : 'transparent',
                        color: highlighted ? 'var(--mx-accent)' : 'var(--mx-text)',
                        fontWeight: item.checked ? 600 : 400,
                        // 2px litteral, NON scale — meme precedent que le
                        // translateY(-2px) de MxButton au survol (decoratif,
                        // hors echelle des tailles).
                        transform: reduced || !highlighted ? 'none' : 'translateX(2px)',
                        transition: reduced
                          ? 'background var(--mx-dur-fast) var(--mx-ease-appear), color var(--mx-dur-fast) var(--mx-ease-appear)'
                          : 'background var(--mx-dur-fast) var(--mx-ease-appear), color var(--mx-dur-fast) var(--mx-ease-appear), transform var(--mx-dur-fast) var(--mx-ease-appear)',
                      }}
                    >
                      {item.label}
                    </div>
                  );
                })}
                {gi < groups.length - 1 ? <div role="separator" style={SEP_STYLE} /> : null}
              </div>
            ))}
            {actions.length > 0 ? (
              <>
                {/* LOT NON-ABOUTIES -- RECETTE 2, point A4 (Greg, 2026-10-28) :
                    CORRECTIF -- ce separateur s'affichait INCONDITIONNELLEMENT
                    des que `actions` etait non vide, meme sans aucun `groups`
                    non vide AVANT lui (cas des menus de carte --
                    MxEntityCard.tsx, `groups={[]}`, seulement `actions`) : un
                    filet seul, sans rien au-dessus (le bloc `header`
                    ci-dessus, s'il existe, a DEJA pose le sien), rendait une
                    ligne VIDE en haut du panneau. Ne separe desormais que des
                    groupes REELS (`header` n'entre pas dans cette condition :
                    il gere deja sa PROPRE transition vers ce qui suit,
                    groupes ou actions). */}
                {groups.some((g) => g.items.length > 0) ? (
                  <div role="separator" style={SEP_STYLE} />
                ) : null}
                {actions.map((action) => {
                  flatIndex += 1;
                  const myIndex = flatIndex;
                  const highlighted = myIndex === activeIndex;
                  const ActionIcon = action.icon;
                  // LOT OFFRES-CYCLE, C1.4 : un ton (success/danger) COLORE
                  // le libelle EN PERMANENCE (pas seulement au survol/actif,
                  // a la difference de l'accent par defaut) -- meme logique
                  // qu'un bouton de ce ton, toujours visible comme tel.
                  const toneColor =
                    action.tone === 'success'
                      ? 'var(--mx-tone-text-success)'
                      : action.tone === 'danger'
                        ? 'var(--mx-tone-text-danger)'
                        : null;
                  return (
                    <div
                      key={action.id}
                      ref={(node) => {
                        itemRefs.current[myIndex] = node;
                      }}
                      role="menuitem"
                      tabIndex={-1}
                      onClick={() => {
                        action.onSelect();
                        if (action.closeOnSelect !== false) closeAndFocusTrigger();
                      }}
                      onMouseEnter={() => setActiveIndex(myIndex)}
                      style={{
                        ...ITEM_BASE,
                        gap: 'var(--mx-space-8)',
                        background: highlighted ? 'var(--mx-accent-lt)' : 'transparent',
                        color: toneColor ?? (highlighted ? 'var(--mx-accent)' : 'var(--mx-text)'),
                        transform: reduced || !highlighted ? 'none' : 'translateX(2px)',
                        transition: reduced
                          ? 'background var(--mx-dur-fast) var(--mx-ease-appear), color var(--mx-dur-fast) var(--mx-ease-appear)'
                          : 'background var(--mx-dur-fast) var(--mx-ease-appear), color var(--mx-dur-fast) var(--mx-ease-appear), transform var(--mx-dur-fast) var(--mx-ease-appear)',
                      }}
                    >
                      {ActionIcon ? (
                        <ActionIcon style={mxIconBox('sm')} aria-hidden="true" />
                      ) : null}
                      {action.label}
                    </div>
                  );
                })}
              </>
            ) : null}
          </div>
        </MxPortal>
      ) : null}
    </>
  );
}

export default MxMenu;
