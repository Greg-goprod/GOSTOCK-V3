import type { CSSProperties, ReactNode } from 'react';

import { MX_TABULAR, MX_TEXT, MX_TONE_TEXT, mxToneDot, type MxTone } from './tokens';

/**
 * MxDonut — LOT BOOKING-DASHBOARD, B1 (2026-10-03).
 *
 * Source qui fait foi : reference/Mannyx Components V2.html, section
 * `#s-charts` (L.840-873), sous-titre « Avancement contrats » — anneau SVG a
 * la main (3 `<circle>` avec `stroke-dasharray`), PAS Recharts. Geometrie du
 * catalogue reprise a l'identique : `viewBox 0 0 110 110`, `cx=cy=55`,
 * `r=40`, `stroke-width=12` — d'ou une circonference de 2.pi.40 ≈ 251, le
 * « 251 » du catalogue (calculee ici, jamais codee en dur).
 *
 * ANNEAU DE FOND EN TOKEN, PAS EN rgba() : le catalogue pose un rond de fond
 * `rgba(0,0,0,0.06)` litteral ; ici `var(--mx-border)`, qui porte deja ce
 * role de filet neutre partout ailleurs dans le tronc — aucune couleur codee
 * en dur.
 *
 * LEGENDE : pastille reprise de `mxToneDot` (le meme point de 6px que
 * `StepPastille` de ContratsListMx), pas une nouvelle puce carree — un seul
 * indicateur de ton dans tout le tronc, pas deux.
 *
 * TOTAL CENTRAL OPTIONNEL (`centerValue`/`centerLabel`) : fourni par
 * l'appelant, jamais calcule ici (meme regle que `displayValue` de
 * MxBarList — la primitive ne connait aucune regle metier de calcul). Marque
 * `aria-hidden` : son contenu est deja couvert par le `aria-label` du SVG.
 *
 * ROLE IMG + ARIA-LABEL : le SVG porte `role="img"` et un `aria-label`
 * FOURNI PAR L'APPELANT, qui doit resumer les valeurs (ex. "Avancement des
 * contrats : 4 finalises, 2 chez l'artiste, 1 a traiter, sur 7"). La legende
 * HTML en dessous reste dans l'arbre d'accessibilite normal (ligne par
 * ligne) : elle ne fait pas doublon avec le resume, elle le detaille.
 *
 * ETAT VIDE : `empty` est un ReactNode fourni par l'appelant (comme
 * MxBarList/MxList), rendu quand `segments` est vide OU que leur somme est
 * nulle (un anneau a 0% ne se dessinerait pas, ce n'est pas un etat utile).
 */
export interface MxDonutSegment {
  /** Cle React. Fournie par l'appelant (identifiant metier). */
  id: string;
  label: ReactNode;
  /** Valeur numerique brute : part de l'anneau. */
  value: number;
  tone: MxTone;
  /** Valeur AFFICHEE dans la legende (formatee par l'appelant). Defaut : `value` brut. */
  displayValue?: ReactNode;
}

export interface MxDonutProps {
  segments: MxDonutSegment[];
  /** Valeur centrale optionnelle (ex. un total). Purement decoratif (`aria-hidden`). */
  centerValue?: ReactNode;
  /** Libelle sous `centerValue` (ex. "sur 37"). */
  centerLabel?: ReactNode;
  /** Resume accessible du graphique entier, porte par le SVG (`role="img"`). */
  ariaLabel: string;
  /** Rendu quand `segments` est vide ou que la somme des valeurs est nulle. */
  empty?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

// Geometrie du catalogue (L.822-838), voir commentaire d'en-tete.
const SIZE = 110;
const CENTER = SIZE / 2;
const RADIUS = 40;
const STROKE_WIDTH = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function MxDonut({
  segments,
  centerValue,
  centerLabel,
  ariaLabel,
  empty,
  className,
  style,
}: MxDonutProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (segments.length === 0 || total === 0) {
    return empty != null ? <>{empty}</> : null;
  }

  let cumulative = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const length = (s.value / total) * CIRCUMFERENCE;
      const offset = cumulative;
      cumulative += length;
      return { id: s.id, tone: s.tone, length, offset };
    });

  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mx-space-12)', ...style }}
    >
      <div
        style={{
          position: 'relative',
          width: `calc(${SIZE}px * var(--mx-scale, 1))`,
          height: `calc(${SIZE}px * var(--mx-scale, 1))`,
        }}
      >
        <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height="100%">
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--mx-border)" strokeWidth={STROKE_WIDTH} />
          {arcs.map((arc) => (
            <circle
              key={arc.id}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={MX_TONE_TEXT[arc.tone]}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
              strokeDashoffset={-arc.offset}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          ))}
        </svg>
        {centerValue != null ? (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'calc(2px * var(--mx-scale, 1))',
            }}
          >
            <span style={{ ...MX_TEXT.focal, color: 'var(--mx-text)' }}>{centerValue}</span>
            {centerLabel ? (
              <span style={{ ...MX_TEXT.help, color: 'var(--mx-text3)' }}>{centerLabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mx-space-8)' }}>
        {segments.map((s) => (
          <div key={s.id} role="listitem" style={{ display: 'flex', alignItems: 'center', gap: 'var(--mx-space-8)' }}>
            <span aria-hidden="true" style={mxToneDot(s.tone)} />
            <span style={{ ...MX_TEXT.fieldLabel, color: 'var(--mx-text2)', flex: 1 }}>{s.label}</span>
            <span style={{ ...MX_TEXT.kvValue, color: 'var(--mx-text)', ...MX_TABULAR }}>
              {s.displayValue ?? s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MxDonut;
