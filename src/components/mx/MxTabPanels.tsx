import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';

import { mxIconBox } from './internal/mxIcon';
import { MX_TAB_DISABLED_STYLE, mxTabItemStyle } from './internal/mxTabStyle';
import {
  buildFadeMask,
  measureOverflow,
  sameOverflow,
  type TabsOverflow,
  NO_OVERFLOW,
} from './internal/mxTabsOverflow';
import { useMxReducedMotion } from './internal/useMxReducedMotion';
import { MxCountBadge } from './MxCountBadge';
import { MxIconButton } from './MxIconButton';
import type { MxTone } from './tokens';

/**
 * MxTabPanels — onglets de PANNEAUX (motif ARIA complet), DISTINCT de MxTabs
 * (liste de LIENS de navigation, sans semantique tablist/tab/tabpanel — voir
 * la tete de MxTabs.tsx pour cette decision anterieure, non remise en cause).
 *
 * LOT CONTRATS B2, C4.3 (2026-10-02, Greg) — premiere brique de la DOCTRINE
 * DRAWER : « le corps du drawer ne defile jamais, contenu decoupe en onglets
 * plutot que condense ». MxTabPanels est le decoupage lui-meme ; combine a
 * `MxDrawer bodyMode="fill"` (C4.2), c'est lui qui porte la zone d'onglets
 * fixe + le panneau actif `flex:1; minHeight:0`.
 *
 * APPARENCE IDENTIQUE a MxTabs (majuscules, soulignement 2px, icones,
 * compteurs optionnels) — exigence EXPLICITE de Greg. Le style est EXTRAIT
 * dans `internal/mxTabStyle.ts`, consomme ICI et par MxTabs : aucune valeur
 * n'est dupliquee entre les deux primitives, une evolution visuelle future
 * passe par ce seul module.
 *
 * MOTIF ARIA COMPLET (contrairement a MxTabs, qui l'exclut explicitement
 * puisqu'il ne rend que des liens) :
 * - conteneur `role="tablist"` ;
 * - chaque onglet `role="tab"`, `aria-selected`, `aria-controls` vers le
 *   panneau, `id` reference par le panneau via `aria-labelledby` ;
 * - TABINDEX ITINERANT : seul l'onglet actif porte `tabIndex=0`, les autres
 *   `tabIndex=-1` — convention WAI-ARIA « roving tabindex », Tab n'arrete le
 *   focus clavier qu'UNE fois dans la liste ;
 *   une FLECHE change la fois le focus — meme comportement que les
 *   onglets soulignes du reste du tronc ;
 * - Debut/Fin vont au premier/dernier onglet NON desactive ;
 * - les onglets `disabled` sont EXCLUS de la navigation clavier (rendus en
 *   `<span aria-disabled>`, non focalisables) — meme traitement que MxTabs.
 *
 * MONTAGE DES PANNEAUX — PROPOSITION (Greg demandait de proposer, C4.3) :
 * seul le panneau ACTIF est monte (les autres ne sont ni rendus ni dans le
 * DOM), comme le fait deja `InvoiceDrawer.tsx` (switch sur `activeTab`,
 * voir le rapport C4.1). Retenu pour deux raisons mesurees :
 * 1. Le premier consommateur (ContractDrawerMx, C4.5) a un onglet "Document"
 *    qui charge un PDF dans un iframe plein cadre (MxDocPreview) — le garder
 *    monte en permanence chargerait ce PDF meme si l'utilisateur ne visite
 *    jamais cet onglet, et le laisserait vivre en memoire (DOM + ressource
 *    reseau) une fois quitte.
 * 2. Coherence avec le seul precedent du projet (InvoiceDrawer, reference de
 *    C4.1) : il ne garde jamais les onglets inactifs montes.
 * Inconvenient accepte : un onglet qui a un etat local (scroll, saisie en
 * cours...) le perd en changeant d'onglet puis en y revenant. Aucun onglet
 * de C4.5 n'a cet etat (le "Document" ne fait que RELIRE le PDF courant). Si
 * un futur consommateur a besoin de conserver l'etat d'un onglet non actif,
 * cette decision sera a revoir ALORS — a signaler, pas a anticiper ici.
 *
 * DEBORDEMENT — LOT ARTISTES-FICHE, B1 (2026-10-04, Greg) : « si les onglets
 * debordent, meme traitement que MxTabs (degrade + bouton de defilement) ».
 * Mesure/degrade EXTRAITS dans internal/mxTabsOverflow.ts (partages avec
 * MxTabs, voir son en-tete) ; chaque primitive garde son propre
 * ResizeObserver/ecouteur de scroll, bornes a sa propre liste d'onglets.
 * Premier besoin reel : `ArtistDetailDrawerMx` (4 onglets, large cran xxl —
 * ne deborde pas aujourd'hui, mais la regle est desormais la MEME partout,
 * pas a reconstruire au premier drawer qui en a besoin). Aucun consommateur
 * existant (`ContractDrawerMx`, 3 onglets ; `SendForSignatureDrawerMx`/
 * `SendToArtistDrawerMx`, 2 onglets) ne deborde a ce jour : rendu inchange
 * pour les trois, verifie par leurs tests existants.
 */
export interface MxTabPanelItem {
  /** Cle React ET identifiant transmis a `onChange`. */
  id: string;
  label: string;
  /** Icone Lucide — le COMPOSANT, jamais un element deja instancie, rendu en 'sm' (15px). */
  icon?: LucideIcon;
  /** Compteur optionnel (badge), ex. nombre d'elements dans l'onglet. */
  count?: number;
  /**
   * Ton du badge `count` -- defaut `'accent'` (inchange pour tous les
   * appelants existants). LOT BOOKING-DRAWERS-FIN, LOT 2, C1.1 (Greg,
   * 2026-10-18) : premier besoin d'un ton `'danger'`, pour signaler un
   * onglet contenant un champ obligatoire en erreur de validation (« pour
   * qu'aucun champ obligatoire ne soit cache »).
   */
  countTone?: MxTone;
  disabled?: boolean;
  /** `title` du `<span>` quand `disabled`. */
  disabledTitle?: string;
  /** Contenu du panneau — monte UNIQUEMENT quand cet onglet est actif, voir plus haut. */
  panel: ReactNode;
}

export interface MxTabPanelsProps {
  /** `aria-label` du `role="tablist"` : identifie le groupe pour un lecteur d'ecran. */
  label: string;
  items: MxTabPanelItem[];
  activeId: string;
  onChange: (id: string) => void;
  /** Prefixe des `id` generes pour `aria-controls`/`aria-labelledby` — defaut `'mx-tabpanels'`, a fournir si plusieurs instances cohabitent sur la meme page (ex. deux drawers ouverts). */
  idPrefix?: string;
  /**
   * Nom accessible des boutons chevron de defilement — OBLIGATOIRE, MEME
   * convention que `scrollLabel` de MxTabs (voir son commentaire) : jamais de
   * repli fige en francais ici, c'est TOUJOURS l'appelant qui resout la cle
   * i18n. LOT ARTISTES-FICHE, B1 (2026-10-04).
   */
  scrollLabel: string;
  className?: string;
  style?: CSSProperties;
}

export function MxTabPanels({
  label,
  items,
  activeId,
  onChange,
  idPrefix = 'mx-tabpanels',
  scrollLabel,
  className,
  style,
}: MxTabPanelsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tablistRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<TabsOverflow>(NO_OVERFLOW);
  const reduced = useMxReducedMotion();

  const enabledItems = items.filter((item) => !item.disabled);

  // Memes DEUX sources que MxTabs (changement d'items, redimensionnement /
  // defilement) — voir son en-tete pour le detail commente de chaque garde.
  useLayoutEffect(() => {
    const el = tablistRef.current;
    if (!el) return;
    const next = measureOverflow(el);
    setOverflow((prev) => (sameOverflow(prev, next) ? prev : next));
  }, [items]);

  useEffect(() => {
    const el = tablistRef.current;
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

  function scrollByOneScreen(direction: -1 | 1) {
    const el = tablistRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
  }

  const fadeMask = buildFadeMask(overflow);

  function focusAndSelect(id: string) {
    onChange(id);
    // Focus PROGRAMME sur le nouvel onglet actif — la convention « tabindex
    // itinerant » exige que le focus clavier SUIVE la selection (sans quoi
    // Tab suivant repartirait d'un `tabIndex=-1` devenu orphelin).
    tabRefs.current[id]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentId: string) {
    const idx = enabledItems.findIndex((item) => item.id === currentId);
    if (idx === -1) return;
    let nextIndex: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (idx + 1) % enabledItems.length;
        break;
      case 'ArrowLeft':
        nextIndex = (idx - 1 + enabledItems.length) % enabledItems.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = enabledItems.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    focusAndSelect(enabledItems[nextIndex].id);
  }

  const activeItem = items.find((item) => item.id === activeId) ?? enabledItems[0] ?? items[0];

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        ...style,
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          ref={tablistRef}
          role="tablist"
          aria-label={label}
          style={{
            display: 'flex',
            gap: 0,
            flexShrink: 0,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            // 1px FIXE (filet du conteneur), meme motif que MxTabs — en
            // box-shadow inset, pas en border-bottom (meme raison : eviter le
            // debordement de 1px qui ferait apparaitre une barre de
            // defilement verticale parasite avec overflow-x:auto).
            boxShadow: 'inset 0 calc(-1 * var(--mx-border-w-thin)) 0 var(--mx-border)',
            // Degrade sur le(s) bord(s) qui cache(nt) encore des onglets — meme
            // motif que MxTabs, voir buildFadeMask (internal/mxTabsOverflow.ts).
            WebkitMaskImage: fadeMask,
            maskImage: fadeMask,
          }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeId;
            const hovered = hoveredId === item.id;
            const iconNode = Icon ? (
              <span aria-hidden="true" style={{ display: 'flex', flexShrink: 0 }}>
                <Icon style={mxIconBox('sm')} />
              </span>
            ) : null;
            const countNode =
              item.count != null ? (
                <MxCountBadge count={item.count} tone={item.countTone} />
              ) : null;

            if (item.disabled) {
              return (
                <span
                  key={item.id}
                  role="tab"
                  aria-selected={false}
                  aria-disabled="true"
                  title={item.disabledTitle}
                  style={MX_TAB_DISABLED_STYLE}
                >
                  {iconNode}
                  {item.label}
                  {countNode}
                </span>
              );
            }

            return (
              <button
                key={item.id}
                ref={(el) => {
                  tabRefs.current[item.id] = el;
                }}
                type="button"
                role="tab"
                id={`${idPrefix}-tab-${item.id}`}
                aria-controls={`${idPrefix}-panel-${item.id}`}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onChange(item.id)}
                onKeyDown={(event) => handleKeyDown(event, item.id)}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId((h) => (h === item.id ? null : h))}
                // Contour de focus clavier, EXCEPTION 1/2 de tokens-mx.css.
                data-mx-focus=""
                style={{
                  background: 'transparent',
                  borderWidth: 0,
                  borderStyle: 'none',
                  borderColor: 'transparent',
                  // mxTabItemStyle pose son PROPRE borderBottom APRES ces
                  // longhand ci-dessus : seul le trait du bas est donc affecte,
                  // les 3 autres cotes restent a 0 (bouton natif sans bordure).
                  ...mxTabItemStyle({ isActive, hovered }),
                }}
              >
                {iconNode}
                {item.label}
                {countNode}
              </button>
            );
          })}
        </div>
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

      {activeItem ? (
        <div
          key={activeItem.id}
          role="tabpanel"
          id={`${idPrefix}-panel-${activeItem.id}`}
          aria-labelledby={`${idPrefix}-tab-${activeItem.id}`}
          tabIndex={0}
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {activeItem.panel}
        </div>
      ) : null}
    </div>
  );
}

export default MxTabPanels;
