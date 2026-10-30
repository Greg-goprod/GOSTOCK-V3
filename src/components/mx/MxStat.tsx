import { useState, type CSSProperties, type ReactNode } from 'react';

import { MX_TEXT } from './tokens';
import { useMxReducedMotion } from './internal/useMxReducedMotion';

export interface MxStatLinkProps {
  style: CSSProperties;
  /** Nom accessible du lien = `linkLabel`. Jamais le contenu de la valeur/des
   *  meta (meme regle que `MxModuleCardLinkProps['aria-label']`). */
  'aria-label': string;
  'data-mx-focus': string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  children: ReactNode;
}

interface MxStatProps {
  label: ReactNode;
  /** Valeur focale. Rendue en 29px/700, chiffres tabulaires. */
  value: ReactNode;
  /** Qualificatifs courts sous la valeur (devise, base de calcul, tranche…). */
  meta?: ReactNode[];
  /** Precision en petit, sous les meta. */
  note?: ReactNode;
  /** Nom accessible du lien. OBLIGATOIRE avec `renderLink` (ex. "Lineup, 12 artistes"). */
  linkLabel?: string;
  /**
   * Rend l'element cliquable final (typiquement un `<Link to=...>` de
   * react-router), avec `linkProps` etale dessus — meme patron
   * INDEPENDANT DU ROUTEUR que `renderLink` de MxModuleCard/MxTabs.
   *
   * ABSENT (comportement d'origine, INCHANGE) : la valeur rend un simple
   * `<div>` NON interactif, exactement comme avant ce lot — c'est le cas des
   * deux appelants existants (SettlementDrawerMx), qui posent deja MxStat au
   * milieu d'un MxSection et n'ont besoin d'aucune bordure/survol.
   *
   * PRESENT (LOT BOOKING-DASHBOARD, B1, 2026-10-03) : MxStat devient une
   * carte cliquable autonome (chrome carte repris de MxModuleCard — padding,
   * fond, bordure, ombre, survol/focus — pour que les 5 KPI du tableau de
   * bord Booking lisent comme des cartes, pas comme des lignes).
   */
  renderLink?: (linkProps: MxStatLinkProps) => ReactNode;
  /**
   * Variante encadree, SANS lien : reprend le meme chrome de carte que
   * `renderLink` (padding, fond, bordure, rayon, ombre), mais reste un
   * simple `<div>` non interactif -- pas de survol, pas de focus, pas
   * d'aria-label. Pour un KPI purement informatif qui doit neanmoins lire
   * comme une carte au milieu d'autres KPI cliquables (LOT OFFRES-B1,
   * 2026-10-07). Ignore si `renderLink` est fourni.
   */
  framed?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * MxStat — valeur focale d'une section (solde, total, impot).
 * Le pilote exprimait ces valeurs comme des lignes cle/valeur parmi d'autres :
 * les isoler est une restructuration de PRESENTATION, le contenu ne change pas.
 */
export function MxStat({
  label,
  value,
  meta,
  note,
  linkLabel,
  renderLink,
  framed,
  className,
  style,
}: MxStatProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reduced = useMxReducedMotion();

  const content = (
    <>
      {/* statLabel et non sectionLabel : ce dernier met le libelle en MAJUSCULES
          avec 0.08em de tracking, ce qu'un libelle de statistique n'a pas au
          handoff (`.mx-dr-stat-label`). C'etait le mauvais preset. */}
      <span style={{ ...MX_TEXT.statLabel, color: 'var(--mx-text3)' }}>{label}</span>
      <span style={{ ...MX_TEXT.focal, color: 'var(--mx-text)' }}>{value}</span>
      {meta && meta.length > 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            // 10px : `.mx-dr-stat-meta`. Pas un token, l'echelle passant de 8 a 12.
            gap: 'calc(10px * var(--mx-scale, 1))',
            // statMeta : meme taille et meme graisse que meta, mais avec le
            // tracking de 0.04em et les chiffres tabulaires du handoff. Sans
            // eux, des qualificatifs chiffres dansent d'une ligne a l'autre.
            ...MX_TEXT.statMeta,
            color: 'var(--mx-text2)',
          }}
        >
          {meta.map((m, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
              {m}
            </span>
          ))}
        </div>
      ) : null}
      {note ? (
        // FILET SUPERIEUR — `.mx-dr-note` du prototype : border-top 1.5px,
        // padding-top 6px, margin-top 4px.
        //
        // POSE ICI, ET PAS SUR MxNote. Le filet exprime la relation STAT -> NOTE,
        // il n'est pas une propriete de la note : au handoff, seule la note
        // engendree par un bloc `stat` le porte, tandis que la note autonome est
        // rendue `data-plain`, qui l'annule. Le poser sur MxNote rendrait cette
        // primitive dependante de son contexte d'usage. Attention au faux ami :
        // le `data-plain` du handoff n'a rien a voir avec `density="plain"` du
        // tronc, qui designe la forme du ton.
        // Jusqu'ici la demo le recollait a la main ; elle n'a plus a le faire.
        //
        // `div` et non `span` : MxNote rend un div, qu'un span ne peut pas
        // contenir. Corrige au passage.
        <div
          style={{
            borderTop: 'var(--mx-border-w) solid var(--mx-border)',
            // 6px : valeur du handoff, absente de l'echelle d'espacement qui
            // passe de 4 a 8. La marge de 4px, elle, s'ajoute au gap de 12px du
            // bloc — l'ecart au-dessus du filet est donc de 16px, comme au
            // prototype.
            paddingTop: 'calc(6px * var(--mx-scale, 1))',
            marginTop: 'var(--mx-space-4)',
            ...MX_TEXT.help,
            color: 'var(--mx-text3)',
          }}
        >
          {note}
        </div>
      ) : null}
    </>
  );

  if (!renderLink) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          // 12px : `.mx-dr-stat`. Le bloc etait a 4px, ce qui collait le libelle,
          // la valeur focale et ses qualificatifs en un seul pate.
          gap: 'var(--mx-space-12)',
          // `framed` : meme chrome de carte que la variante cliquable
          // ci-dessous, mais fige (pas de hover/focus, bordure toujours
          // `--mx-border`, ombre toujours `--mx-shadow`).
          ...(framed
            ? {
                padding: 'calc(18px * var(--mx-scale, 1))',
                background: 'var(--mx-surface)',
                border: 'var(--mx-border-w) solid var(--mx-border)',
                borderRadius: 'var(--mx-radius-10)',
                boxShadow: 'var(--mx-shadow)',
              }
            : null),
          ...style,
        }}
      >
        {content}
      </div>
    );
  }

  return renderLink({
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--mx-space-12)',
      // Chrome carte repris de MxModuleCard (meme padding/fond/rayon/ombre) :
      // un KPI cliquable doit lire comme une carte, pas comme une ligne.
      padding: 'calc(18px * var(--mx-scale, 1))',
      background: 'var(--mx-surface)',
      border: 'var(--mx-border-w) solid ' + (hovered ? 'var(--mx-accent)' : 'var(--mx-border)'),
      borderRadius: 'var(--mx-radius-10)',
      boxShadow: focused ? 'var(--mx-shadow), var(--mx-focus-ring)' : 'var(--mx-shadow)',
      textDecoration: 'none',
      cursor: 'pointer',
      transform: reduced ? 'none' : hovered ? 'translateY(-2px)' : 'none',
      transition: reduced
        ? 'border-color var(--mx-dur-fast) var(--mx-ease-appear), box-shadow var(--mx-dur-fast) var(--mx-ease-appear)'
        : 'border-color var(--mx-dur-fast) var(--mx-ease-appear), box-shadow var(--mx-dur-fast) var(--mx-ease-appear), transform var(--mx-dur-fast) var(--mx-ease-spring)',
      ...style,
    },
    'aria-label': linkLabel ?? '',
    'data-mx-focus': '',
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    children: content,
  });
}

export default MxStat;
