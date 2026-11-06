import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

/**
 * useMxLayeredDialog — interne au tronc, HORS BARREL (voir index.ts), meme
 * convention que useMxReducedMotion/mxIcon.
 *
 * LOT MODALE B1 (2026-10-02). EXTRAIT de MxDrawer (lot pilote de ce
 * mecanisme), SANS en changer le comportement — voir MxDrawer.test.tsx,
 * verts sans modification apres cette extraction. MxModal (B3) le consomme
 * ensuite a l'identique : les deux primitives partagent desormais UNE SEULE
 * implementation de la pile de couches modales, du piege de focus, de
 * l'Echap multi-couches, du focus initial (cas « monte deja ouvert » compris)
 * et de la restitution du focus.
 *
 * CORRECTION DE L'ASYMETRIE (le motif meme de cette extraction). Avant ce
 * lot, MxDrawer gatait Echap par `isTopLayer()` mais PAS le clic sur son
 * voile (gate independant, uniquement `dismissible`) : une modale ouverte
 * par-dessus le drawer laissait le clic sur le voile du DRAWER le refermer,
 * alors qu'Echap n'avait deja plus d'effet dans ce cas. `handleScrimClick`
 * ci-dessous applique desormais la MEME garde que `handleKeyDown` : aucun
 * des deux declencheurs n'agit plus si le drawer/modale n'est pas la couche
 * du dessus.
 *
 * CE QUE CE HOOK NE FAIT PAS : il ne rend aucun JSX (ni voile, ni panneau,
 * ni portail — MxPortal reste a part, consomme independamment par chaque
 * primitive). Il ne pose aucun style, aucun z-index : la presentation reste
 * dans MxDrawer/MxModal. Il expose seulement la MECANIQUE : une ref de
 * panneau a poser sur l'element `role="dialog"`, un gestionnaire de clic de
 * voile, et `isTopLayer()` pour tout besoin externe (ex. `suspended`).
 *
 * `suspended` — PARAMETRE du hook (defaut `false`), gere ICI exactement comme
 * avant l'extraction (ref synchronisee par effet, jamais dans les deps d'un
 * gestionnaire). MxDrawer le transmet depuis sa propre prop ; MxModal (B3) ne
 * le transmet jamais : il porte deja `role="dialog"`/`"alertdialog"` +
 * `aria-modal="true"`, le repli DOM d'`isTopLayer` suffit seul pour toute
 * paire MxDrawer/MxModal ou MxModal/MxModal. `suspended` reste necessaire
 * cote MxDrawer tant que des modales AURA existent : aucun `role="dialog"`
 * cote AURA, le repli DOM ne les voit pas.
 */

/**
 * Resolution d'une valeur `z-index` calculee en NOMBRE. Deux formes :
 *   - un nombre brut ("1300" — override legacy AURA pose a la main) ;
 *   - une reference `var(--mx-z-xxx)` : LE NAVIGATEUR la resout nativement
 *     (`getComputedStyle` renvoie alors deja le nombre calcule, verifie —
 *     voir tokens.ts) ; en test (jsdom, sans feuille de style chargee), le
 *     repli interroge directement la propriete personnalisee sur
 *     `document.documentElement`, la racine ou tokens-mx.css la declare
 *     (`:root`) — les tests qui en ont besoin la posent au meme endroit
 *     (`document.documentElement.style.setProperty(...)`) pour la simuler.
 * `NaN` si rien n'est resolvable (ex. `auto`, `var()` sans repli possible) :
 * le code appelant doit alors continuer a chercher plus haut, PAS traiter
 * "NaN" comme un z-index de 0 (qui serait une valeur reelle, differente).
 */
function resolveZIndexValue(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === 'auto') return NaN;

  const direct = Number(trimmed);
  if (Number.isFinite(direct)) return direct;

  const varMatch = trimmed.match(/^var\(\s*(--[\w-]+)\s*(?:,.*)?\)$/);
  if (varMatch) {
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue(varMatch[1])
      .trim();
    const resolvedNum = Number(resolved);
    if (resolved !== '' && Number.isFinite(resolvedNum)) return resolvedNum;
  }
  return NaN;
}

/**
 * PILE D'EMPILEMENT A EGALITE DE JETON — LOT DRAWER-EMPILEMENT, phase A
 * (Greg, 27/10/2026), cas pilote. `isTopLayer`/`getEffectiveZIndex` ci-dessus
 * departagent deja deux couches de familles DIFFERENTES (ex. drawer 301 vs
 * modal 401) par leur z-index effectif, ordre du DOM en repli seulement a
 * EGALITE. Cette egalite est precisement le cas qui reste faux : deux
 * couches de la MEME famille (deux MxDrawer empiles, ex. OfferDrawerMx +
 * OfferComposer, tous deux a --mx-z-drawer/301) partagent le MEME jeton, et
 * l'ordre du DOM qui les departage alors ne reflete PAS l'ordre d'OUVERTURE
 * quand l'une des deux reste montee en permanence (son `open` seul bascule,
 * son noeud de portail existe depuis le chargement de la page) et l'autre se
 * DEMONTE/REMONTE a chaque fermeture/ouverture (`if (!open) return null`,
 * motif OfferDrawerMx) : la couche a montage conditionnel se retrouve
 * TOUJOURS derniere dans le DOM, donc TOUJOURS visuellement au-dessus, meme
 * ouverte AVANT la couche a montage permanent.
 *
 * Correctif : un REGISTRE PAR FAMILLE (`stackFamily`, ex. `'drawer'`),
 * ordonne par OUVERTURE (pas par montage DOM). `resolveStackedZIndex`
 * ci-dessous ajoute le niveau au jeton de base RESOLU (jamais une valeur
 * ecrite en dur : si le jeton est irresolvable — jsdom sans la feuille de
 * style, cas courant des tests qui ne posent pas `--mx-z-*` — ou si le
 * niveau est 0 (une seule couche ouverte, le cas de loin le plus frequent),
 * le jeton d'origine ressort INCHANGE : aucune regression possible pour un
 * ecran a un seul drawer/modale.
 *
 * LE NIVEAU N'EST PAS UNE POSITION DANS UNE FILE (correction du 27/10/2026,
 * APRES la premiere version de ce correctif, Greg) : une position (`index`
 * d'un tableau compacte par `splice`) se REUTILISE des qu'une couche
 * intermediaire ferme — ex. A, B, C ouverts (niveaux 0, 1, 2), B ferme (le
 * tableau redevient [A, C]) : une position fondee sur l'index retomberait a
 * [0, 1], et une couche D ouverte ensuite recevrait l'ancien niveau de B
 * (1) ou de C (2) selon l'implementation — DEUX couches au MEME niveau,
 * exactement le bug que ce mecanisme corrige par ailleurs. Le niveau est
 * donc un COMPTEUR MONOTONE par famille (`next`), qui n'avance QUE sur une
 * ouverture reelle et ne recule JAMAIS tant que la famille n'est pas
 * totalement vide : fermer une couche INTERMEDIAIRE ne rend pas son niveau
 * disponible pour une couche future, seule la fermeture de TOUTES les
 * couches de la famille reinitialise le compteur (la famille est alors
 * retiree du registre). Une couche ROUVERTE (ex. A ferme puis rouvert
 * pendant que B reste ouvert) obtient un NOUVEAU niveau, au-dessus de tout
 * ce qui est encore ouvert — c'est le comportement voulu : elle vient d'etre
 * ouverte, donc au-dessus, meme si elle avait deja ete ouverte avant.
 */
interface MxStackFamilyState {
  /** Niveau de chaque couche actuellement OUVERTE de cette famille. */
  byId: Map<symbol, number>;
  /** Prochain niveau a attribuer — monotone, ne recule jamais tant que `byId` n'est pas vide. */
  next: number;
}
const mxStackFamilies = new Map<string, MxStackFamilyState>();

function registerStackLayer(family: string, id: symbol): number {
  let state = mxStackFamilies.get(family);
  if (!state) {
    state = { byId: new Map(), next: 0 };
    mxStackFamilies.set(family, state);
  }
  // Idempotent : un re-enregistrement de la MEME couche encore ouverte (ex.
  // double invocation d'effet en mode strict) renvoie son niveau existant,
  // sans faire avancer `next` une seconde fois pour rien.
  const existing = state.byId.get(id);
  if (existing !== undefined) return existing;

  const level = state.next;
  state.byId.set(id, level);
  state.next += 1;
  return level;
}

function unregisterStackLayer(family: string, id: symbol): void {
  const state = mxStackFamilies.get(family);
  if (!state) return;
  state.byId.delete(id);
  // Famille entierement vide : reinitialise le compteur. Tant qu'il reste
  // UNE couche ouverte, `next` ne recule jamais (voir le commentaire
  // d'en-tete) — une fermeture intermediaire ne libere rien.
  if (state.byId.size === 0) mxStackFamilies.delete(family);
}

/**
 * Pas de valeur en dur : l'ecart ENTRE deux niveaux (2) n'est pas un
 * z-index, c'est un pas interne a la famille — deux niveaux consecutifs
 * doivent laisser la place au voile de chacun (ex. famille `drawer` :
 * --mx-z-drawer-scrim 300, --mx-z-drawer 301 ; niveau 1 donne alors voile 302,
 * panneau 303, tous deux strictement au-dessus du panneau du niveau 0 (301)).
 */
const MX_STACK_LEVEL_STEP = 2;

/**
 * Niveau 0 (ou jeton irresolvable) : jeton d'origine INCHANGE, voir ci-dessus.
 * `token` prend le type `CSSProperties['zIndex']` des valeurs de `MX_Z`
 * (tokens.ts) directement, sans cast a chaque site d'appel — csstype type
 * `zIndex` en `number | string | undefined`, le meme ecart deja documente
 * dans tokens.ts pour `MX_Z` lui-meme.
 */
export function resolveStackedZIndex(
  token: CSSProperties['zIndex'],
  level: number,
): CSSProperties['zIndex'] {
  if (!Number.isFinite(level) || level <= 0) return token;
  const raw = String(token ?? '');
  const base = resolveZIndexValue(raw);
  if (Number.isNaN(base)) return token;
  return base + level * MX_STACK_LEVEL_STEP;
}

/**
 * Z-index EFFECTIF d'une couche : le sien si elle est elle-meme POSITIONNEE
 * (`position` autre que `static`) et porte un z-index resolvable, sinon
 * celui du plus proche ANCETRE positionne qui en porte un (le « conteneur
 * positionne » vise par Greg, LOT MODALE C1 — un scope de console portalise
 * la couche dans un conteneur dote de son PROPRE z-index, independant de
 * l'echelle --mx-z-*). Remonte jusqu'a `<html>` ; 0 par defaut si aucune
 * couche positionnee et z-indexee n'est trouvee.
 */
function getEffectiveZIndex(el: HTMLElement): number {
  let node: HTMLElement | null = el;
  while (node) {
    const style = getComputedStyle(node);
    if (style.position !== 'static') {
      const z = resolveZIndexValue(style.zIndex);
      if (!Number.isNaN(z)) return z;
    }
    node = node.parentElement;
  }
  return 0;
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface UseMxLayeredDialogOptions {
  open: boolean;
  onClose: () => void;
  /**
   * Defaut `true`. `false` : ni Echap ni le clic sur le voile ne ferment la
   * couche. N'affecte PAS `isTopLayer` : ce gate est orthogonal, applique
   * aux deux declencheurs de la meme facon (voir le commentaire d'en-tete).
   */
  dismissible?: boolean;
  /**
   * Defaut `true` : focus le premier CHAMP a l'ouverture (a defaut, premier
   * element focusable, a defaut la couche elle-meme). `false` : focus la
   * couche elle-meme, comme s'il n'y avait aucun element focusable a
   * l'interieur. Lu via une REF a chaque rendu, JAMAIS ajoute aux
   * dependances de l'effet de focus — meme motif que dans MxDrawer avant
   * extraction : l'effet ne doit se rejouer qu'a l'ouverture/fermeture.
   */
  autofocus?: boolean;
  /**
   * Element explicite a focaliser a l'ouverture, prioritaire sur
   * `autofocus`. Ajoute pour MxModal/MxConfirmDialog (B3) : une confirmation
   * destructive focalise l'action la MOINS destructrice (Annuler), jamais le
   * premier champ trouve dans le panneau. Absent de l'API de MxDrawer, qui
   * ne le passe jamais (`undefined`) et conserve donc son comportement
   * d'avant extraction a l'identique.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Defaut `false`. `true` : une couche modale est ouverte AU-DESSUS de
   * celle-ci (consommateur declarant, ex. MxDrawer face a une modale AURA
   * sans `role="dialog"` que le repli DOM ne peut pas voir) — `isTopLayer()`
   * renvoie alors toujours `false`, quel que soit l'etat du DOM.
   */
  suspended?: boolean;
  /**
   * Famille d'empilement a egalite de jeton (ex. `'drawer'`) — voir le
   * commentaire de `resolveStackedZIndex` plus haut. Omis (defaut) : aucune
   * file, `stackLevel` reste a `0`, comportement et jeton z-index INCHANGES.
   */
  stackFamily?: string;
}

export interface MxLayeredDialogHandle {
  /** Callback-ref a poser sur l'element `role="dialog"`/`"alertdialog"`. */
  panelRef: (node: HTMLElement | null) => void;
  /**
   * Gestionnaire de clic du voile — applique `isTopLayer()` ET `dismissible`
   * (correction de l'asymetrie, voir le commentaire d'en-tete).
   */
  handleScrimClick: () => void;
  /** Expose pour les besoins externes (ex. `suspended` de MxDrawer). */
  isTopLayer: () => boolean;
  /**
   * Niveau reserve dans la file `stackFamily` (voir `resolveStackedZIndex`).
   * `0` si `stackFamily` est omis, si la couche est fermee, ou si elle est
   * seule ouverte dans sa famille — jeton d'origine inchange dans tous ces
   * cas.
   */
  stackLevel: number;
}

export function useMxLayeredDialog({
  open,
  onClose,
  dismissible = true,
  autofocus = true,
  initialFocusRef,
  suspended = false,
  stackFamily,
}: UseMxLayeredDialogOptions): MxLayeredDialogHandle {
  const panelElRef = useRef<HTMLElement | null>(null);

  // File d'empilement a egalite de jeton — voir le commentaire de
  // `resolveStackedZIndex` en tete de fichier. `id` stable pour toute la vie
  // du composant (un seul Symbol cree, jamais recree aux rendus suivants) ;
  // le niveau se (dis)inscrit a l'OUVERTURE/FERMETURE, pas au montage —
  // c'est precisement ce qui corrige le cas OfferDrawerMx (montage/demontage
  // conditionnel) face a OfferComposer (toujours monte, `open` seul bascule).
  const stackIdRef = useRef<symbol | null>(null);
  if (stackIdRef.current === null) stackIdRef.current = Symbol('mx-stack-layer');
  const [stackLevel, setStackLevel] = useState(0);
  useEffect(() => {
    if (!open || !stackFamily) {
      setStackLevel(0);
      return;
    }
    const id = stackIdRef.current!;
    setStackLevel(registerStackLayer(stackFamily, id));
    return () => unregisterStackLayer(stackFamily, id);
  }, [open, stackFamily]);
  /**
   * Focus en attente. MxPortal differe son premier portage (etat `mounted`,
   * voir son commentaire) : sur un montage directement ouvert, la couche
   * n'existe pas encore quand l'effet `[open]` ci-dessous s'execute une
   * seule fois. Au lieu d'abandonner la mise en place du focus, elle est
   * stockee ici et appliquee par `panelRef` des l'attachement reel du noeud.
   */
  const pendingFocusRef = useRef<(() => void) | null>(null);
  /** Element qui avait le focus avant l'ouverture, pour le lui rendre. */
  const triggerRef = useRef<HTMLElement | null>(null);

  const autofocusRef = useRef(autofocus);
  autofocusRef.current = autofocus;

  const initialFocusRefRef = useRef(initialFocusRef);
  initialFocusRefRef.current = initialFocusRef;

  // `suspended` passe par une REF, pas par les dependances d'un gestionnaire :
  // s'il entrait dans les deps, l'effet de focus plus bas se re-executerait a
  // chaque ouverture/fermeture de la couche suspendante, et volerait le focus
  // au premier champ a chaque fois.
  const suspendedRef = useRef(suspended);
  useEffect(() => {
    suspendedRef.current = suspended;
  }, [suspended]);

  /**
   * La couche n'agit au clavier/clic voile que si elle est la couche modale
   * du dessus. Deux signaux : la declaration du consommateur (`suspended`),
   * et un repli DOM sur les dialogues CONFORMES (role="dialog" ou
   * "alertdialog" + aria-modal="true") autres qu'elle-meme. Les couches
   * `inert` sont ignorees : une couche fermee mais encore montee pour sa
   * transition de sortie compterait a tort comme une couche ouverte.
   *
   * Z-INDEX EFFECTIF D'ABORD, ORDRE DU DOM EN REPLI SEULEMENT A EGALITE —
   * LOT MODALE C1 (2026-10-02, decision de Greg), affine le critere ORDRE
   * SEUL du lot precedent (B3) : "la derniere couche montee" se trompait
   * quand les portails sortent dans des conteneurs DIFFERENTS (scopes de
   * console — voir MxPortal) ou quand une couche de rang superieur
   * (`alert`, 1401) est montee AVANT une couche de rang inferieur
   * (`modal`, 401) ; dans les deux cas, l'ordre du DOM ne reflete plus
   * l'empilement visuel reel. `getEffectiveZIndex` lit le z-index CALCULE
   * (le navigateur resout `var()` nativement) ; a z-index egal seulement
   * (deux couches de meme rang, cas B1/B3 d'origine), la DERNIERE dans
   * l'ordre du DOM reste celle du dessus — `querySelectorAll` rend les
   * noeuds dans cet ordre, `>=` dans la boucle ci-dessous garde donc la
   * derniere a egalite. Avec une seule couche, resultat inchange.
   */
  const isTopLayer = useCallback(() => {
    if (suspendedRef.current) return false;
    const panel = panelElRef.current;
    if (!panel) return false;
    const dialogs = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]',
      ),
    ).filter((d) => !d.hasAttribute('inert'));
    if (dialogs.length === 0) return true;

    let top = dialogs[0];
    let topZ = getEffectiveZIndex(top);
    for (let i = 1; i < dialogs.length; i++) {
      const z = getEffectiveZIndex(dialogs[i]);
      if (z >= topZ) {
        top = dialogs[i];
        topZ = z;
      }
    }
    return top === panel;
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isTopLayer()) return;

      if (e.key === 'Escape') {
        if (dismissible) onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const panel = panelElRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      );
      if (nodes.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      // Boucle explicite aux deux extremites, et rattrapage si le focus a
      // echappe au panneau (clic dans la page, focus programmatique).
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose, isTopLayer, dismissible],
  );

  /**
   * CORRECTION DE L'ASYMETRIE — voir le commentaire d'en-tete du fichier.
   * MEME garde que `handleKeyDown` ci-dessus : `isTopLayer()` d'abord, puis
   * `dismissible`. Avant cette extraction, le clic sur le voile de MxDrawer
   * ne testait jamais `isTopLayer()` ; c'est desormais corrige pour les deux
   * consommateurs du hook.
   */
  const handleScrimClick = useCallback(() => {
    if (!isTopLayer()) return;
    if (dismissible) onClose();
  }, [isTopLayer, dismissible, onClose]);

  // Focus, defilement : regles par l'OUVERTURE seule. Effet separe de
  // l'ecoute clavier : voir le commentaire original dans MxDrawer (avant
  // extraction) pour le motif complet — il ne doit pas dependre de `onClose`,
  // que les consommateurs passent en fonction recreee a chaque rendu.
  useEffect(() => {
    if (!open) return;

    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const applyFocus = () => {
      const panel = panelElRef.current;
      if (!panel) return;

      const explicit = initialFocusRefRef.current?.current;
      if (explicit) {
        explicit.focus();
        return;
      }

      if (autofocusRef.current) {
        const field = panel.querySelector<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
        );
        (field ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel).focus();
      } else {
        // `autofocus={false}` : focus la couche elle-meme, comme s'il n'y
        // avait aucun element focusable a l'interieur (repli deja existant).
        panel.focus();
      }
    };

    if (panelElRef.current) {
      applyFocus();
    } else {
      // Montage directement ouvert : la couche n'est pas encore attachee
      // (voir le commentaire de pendingFocusRef ci-dessus). Mise en attente
      // plutot qu'abandonnee ; `panelRef` l'appliquera a l'attachement reel.
      pendingFocusRef.current = applyFocus;
    }

    return () => {
      pendingFocusRef.current = null;
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

  /**
   * Callback de ref stable sur la couche. Applique le focus mis en attente
   * par l'effet `[open]` ci-dessus des que le noeud reel s'attache (montage
   * directement ouvert) ; sans effet dans le scenario deja fonctionnel
   * (toujours montee, `open` bascule) puisque `pendingFocusRef` y reste vide.
   */
  const panelRef = useCallback((node: HTMLElement | null) => {
    panelElRef.current = node;
    if (node && pendingFocusRef.current) {
      const run = pendingFocusRef.current;
      pendingFocusRef.current = null;
      run();
    }
  }, []);

  // Ecoute clavier : se rebranche librement, elle ne touche pas au focus.
  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  return { panelRef, handleScrimClick, isTopLayer, stackLevel };
}

export default useMxLayeredDialog;
