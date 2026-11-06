import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import type { LucideIcon } from 'lucide-react';

import { mxIconBox } from './internal/mxIcon';
import { useMxReducedMotion } from './internal/useMxReducedMotion';
import { MX_TEXT, mxToneDot, type MxTone } from './tokens';

/**
 * MxSegmented — bascule segmentee (« liste / grille » du catalogue), LOT
 * PAGE-NOTIFICATIONS B1 (2026-10-01).
 *
 * Source qui fait foi : reference/Mannyx Components V2.html, section
 * `#s-viewtoggle` (L.529-547), CSS `.vt`/`.vt-thumb`/`.vt button` (L.2006-2014).
 *
 * PADDING DU CONTENEUR — 3px, litteral de `.vt{padding:3px}` (L.2006). LOT
 * BOOKING-DRAWERS-FIN, LOT 2, C2.3 (2026-10-23) : la consigne du lot citait
 * « 4 px », le CSS reel du catalogue dit 3px -- le CSS fait foi (ecart
 * signale dans le rapport du lot, pas suivi ici), valeur INCHANGEE par ce
 * lot (deja correcte avant).
 *
 * SEMANTIQUE : `role="radiogroup"` + boutons `role="radio"`/`aria-checked` —
 * PAS `role="tablist"` (ce n'est jamais une navigation, cf. MxTabs) et PAS un
 * simple groupe de boutons cliquables : la valeur selectionnee EST l'etat,
 * exactement comme un groupe de boutons radio HTML.
 *
 * ECART D'ACCESSIBILITE CORRIGE PAR RAPPORT AU PROTOTYPE — note de Greg,
 * docs/design/handoff-mannyx-ds/LISEZ-MOI-EN-PREMIER.md:213-217 : le
 * prototype (`vtInit()`) n'attache que des ecouteurs `click`, aucune
 * navigation clavier. Implemente ICI : fleches gauche/droite (bouclage),
 * Debut/Fin, tabindex itinerant (seule l'option SELECTIONNEE est dans la
 * sequence de tabulation — meme convention qu'un groupe de radios natif).
 *
 * PAS D'ANIMATION D'ENTREE — meme reference, L.220-224 : `@keyframes vtIn`
 * (35ms par item) ne justifie pas une 3e exception CSS du tronc ; ce lot
 * l'abandonne purement et simplement (aucun consommateur de MxSegmented n'a
 * demande cet effet).
 *
 * PASTILLE GLISSANTE : meme famille qu'un controle a pastille deja dans le
 * tronc (MxToggle, l'interrupteur) plutot que la valeur litterale `.28s` du
 * catalogue, hors echelle — `--mx-dur-toggle` (0.2s) + `--mx-ease-spring`,
 * MEME transition que le bouton de MxToggle. Supprimee en mouvement reduit
 * (position finale conservee, cf. MxToggle).
 *
 * LIBELLES EN MAJUSCULES — meme traitement que MxTabs/MxNavItem (LOT
 * NAV-SECONDAIRE, C2/C3) : `textTransform:'uppercase'` + `letterSpacing:
 * 0.02em`, MEME valeur.
 *
 * TAILLE/GRAISSE DU TEXTE : `.vt button{font-size:12px;font-weight:700}`.
 * 12px correspond EXACTEMENT a `--mx-fs-kv-key` (aucun arrondi necessaire).
 * Porte par `MX_TEXT.segmentedLabel` (tokens.ts) depuis LOT CONTRATS B2,
 * C2.1 (2026-10-02) : litterale ici jusque-la (meme precedent que ITEM_BASE
 * de MxTabs, qui ne consomme toujours pas MX_TEXT), extraite le jour ou un
 * 2e consommateur (titres de section de `ContratsListMx`) a du reprendre
 * EXACTEMENT la meme combinaison taille/graisse/majuscules/tracking plutot
 * que la recopier en dur.
 *
 * VARIANTE ICONE SEULE (`iconOnly`) : `.vt.is-icon button{padding:6px 8px}`,
 * `title` pour l'infobulle native — ICI, `aria-label` sur CHAQUE bouton
 * (option.label), seule source de nom accessible en l'absence de texte
 * visible, meme convention que MxIconButton.
 *
 * PASTILLE DE TON (`tone`) — LOT CONTRATS B2, C5.2 (2026-10-03) : un petit
 * disque plein (`mxToneDot`, tokens.ts) pose AVANT l'icone/le libelle,
 * extension optionnelle (aucun consommateur existant n'en passe, aucun n'est
 * donc affecte). PUREMENT DECORATIF — `aria-hidden="true"` fixe, le nom
 * accessible du bouton reste `option.label` seul, jamais « (point) Libelle » :
 * le ton d'une etape n'est pas une information supplementaire a annoncer,
 * c'est deja le libelle qui porte le sens, la couleur n'est qu'un rappel
 * visuel redondant pour un utilisateur voyant.
 */
export interface MxSegmentedOption {
  value: string;
  /** Libelle. Toujours fourni par l'appelant (i18n) — rendu en texte si
   *  `iconOnly` est faux, en `title`/`aria-label` sinon. */
  label: string;
  /** Icone Lucide — le COMPOSANT, jamais un element deja instancie. */
  icon?: LucideIcon;
  /** Pastille de ton avant le libelle (voir le commentaire d'en-tete). Absente = pas de pastille. */
  tone?: MxTone;
}

export interface MxSegmentedProps {
  /** Nom accessible du `radiogroup` — OBLIGATOIRE, meme convention que
   *  `label` de MxTabs/MxSubNav : jamais de repli i18n ici, le tronc ne
   *  resout jamais lui-meme de cle. */
  'aria-label': string;
  options: MxSegmentedOption[];
  value: string;
  onChange: (next: string) => void;
  /** Icone seule, sans libelle visible (variante `.is-icon` du catalogue). */
  iconOnly?: boolean;
  className?: string;
  style?: CSSProperties;
}

const BUTTON_BASE: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  // 6px : gap icone/libelle de `.vt button` (L.2007). Absent de l'echelle
  // --mx-space-* (qui passe de 4 a 8) ; valeur du catalogue, litterale comme
  // le padding ci-dessous.
  gap: 'calc(6px * var(--mx-scale, 1))',
  border: 'none',
  background: 'transparent',
  borderRadius: 'var(--mx-radius-4)',
  ...MX_TEXT.segmentedLabel,
  // GO-Mat, contre-test DA5 : casse normale et 28px de haut (6 + 16 + 6) comme `#s-viewtoggle`,
  // au lieu des majuscules reprises de MxTabs
  textTransform: 'none',
  letterSpacing: 'normal',
  lineHeight: '16px',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

function moveIndex(current: number, delta: number, length: number): number {
  return (current + delta + length) % length;
}

export function MxSegmented({
  'aria-label': ariaLabel,
  options,
  value,
  onChange,
  iconOnly = false,
  className,
  style,
}: MxSegmentedProps) {
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const reduced = useMxReducedMotion();

  // Mesure la position/largeur du bouton SELECTIONNE, relative au groupe —
  // meme logique que le prototype (`t.style.left/width` dans vtInit()), mais
  // en React : au montage, a chaque changement de valeur/options, et au
  // redimensionnement (ResizeObserver, memes garde-fous que MxTabs face a
  // son absence en jsdom).
  useLayoutEffect(() => {
    const group = groupRef.current;
    const button = buttonRefs.current.get(value);
    if (!group || !button) {
      setThumb(null);
      return;
    }
    setThumb({ left: button.offsetLeft, width: button.offsetWidth });
  }, [value, options, iconOnly]);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const button = buttonRefs.current.get(value);
      if (!button) return;
      setThumb({ left: button.offsetLeft, width: button.offsetWidth });
    });
    ro.observe(group);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `value` lu via closure, pas besoin de re-observer.
  }, []);

  function selectAt(index: number) {
    const next = options[index];
    if (!next) return;
    onChange(next.value);
    buttonRefs.current.get(next.value)?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        selectAt(moveIndex(index, 1, options.length));
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        selectAt(moveIndex(index, -1, options.length));
        break;
      case 'Home':
        e.preventDefault();
        selectAt(0);
        break;
      case 'End':
        e.preventDefault();
        selectAt(options.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={className}
      style={{
        position: 'relative',
        display: 'inline-flex',
        // 2px : gap de `.vt` (L.2006). Litteral, meme motif que le padding.
        gap: 'calc(2px * var(--mx-scale, 1))',
        padding: 'calc(3px * var(--mx-scale, 1))',
        background: 'var(--mx-surface2)',
        // LOT BOOKING-DRAWERS-FIN -- LOT 2, C2.3 (2026-10-23) -- CORRECTIF :
        // `--mx-input-border` etait pose ici, mais `.vt` du catalogue (L.2006,
        // Mannyx Components V2.html) utilise `--border` (le filet neutre), pas
        // `--inputBorder` (reserve aux champs de saisie) -- deux tokens
        // REELLEMENT distincts (`--mx-border` #282c37/#e2e3e9 vs
        // `--mx-input-border` #2e323f/#cbcdd6, tokens-mx.css). Le controle
        // segmente n'est pas un champ de saisie, son filet suit le neutre.
        border: 'var(--mx-border-w) solid var(--mx-border)',
        borderRadius: 'var(--mx-radius-6)',
        ...style,
      }}
    >
      {thumb ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 'calc(3px * var(--mx-scale, 1))',
            bottom: 'calc(3px * var(--mx-scale, 1))',
            left: thumb.left,
            width: thumb.width,
            borderRadius: 'var(--mx-radius-4)',
            background: 'var(--mx-surface)',
            boxShadow: 'var(--mx-shadow)',
            transition: reduced
              ? 'none'
              : 'left var(--mx-dur-toggle) var(--mx-ease-spring), width var(--mx-dur-toggle) var(--mx-ease-spring)',
          }}
        />
      ) : null}
      {options.map((option, index) => {
        const Icon = option.icon;
        const checked = option.value === value;
        const hovered = hoveredValue === option.value;
        const color = checked ? 'var(--mx-accent)' : hovered ? 'var(--mx-text)' : 'var(--mx-text3)';

        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) buttonRefs.current.set(option.value, el);
              else buttonRefs.current.delete(option.value);
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={iconOnly ? option.label : undefined}
            title={iconOnly ? option.label : undefined}
            tabIndex={checked ? 0 : -1}
            data-mx-focus=""
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onMouseEnter={() => setHoveredValue(option.value)}
            onMouseLeave={() => setHoveredValue((h) => (h === option.value ? null : h))}
            style={{
              ...BUTTON_BASE,
              color,
              transition: 'color var(--mx-dur-fast) var(--mx-ease-appear)',
              padding: iconOnly
                ? 'calc(6px * var(--mx-scale, 1)) calc(8px * var(--mx-scale, 1))'
                : 'calc(6px * var(--mx-scale, 1)) calc(11px * var(--mx-scale, 1))',
            }}
          >
            {option.tone ? <span aria-hidden="true" style={mxToneDot(option.tone)} /> : null}
            {Icon ? (
              <span aria-hidden="true" style={{ display: 'flex', flexShrink: 0 }}>
                <Icon style={mxIconBox('sm')} />
              </span>
            ) : null}
            {iconOnly ? null : option.label}
          </button>
        );
      })}
    </div>
  );
}

export default MxSegmented;
