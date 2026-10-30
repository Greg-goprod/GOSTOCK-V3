import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { MX_TEXT } from '../tokens';

/**
 * MxClockFace — interne au tronc, HORS BARREL (voir index.ts).
 *
 * LOT PICKERS-MX, S2. Horloge circulaire 24h du handoff (`reference/Mannyx
 * Components V2.html`, classe `TimePicker`, L.2281-2415) : cadran SVG a deux
 * anneaux (interieur 00-11, exterieur 12-23) pour les heures, anneau unique
 * 60 positions pour les minutes, bascule automatique heures->minutes au clic,
 * ZERO pas de 5 minutes (le handoff accepte n'importe quelle minute 0-59).
 *
 * CORRECTIF C2 (LOT PICKERS-MX, retours de recette Greg, 2026-10-16 14:23) —
 * l'en-tete HH:MM a ete ENTIEREMENT REPENSE suite a C2.1/C2.2/C2.3/C2.4/C2.5.
 *
 * POURQUOI deux `<input>` ont ete abandonnes pour l'en-tete (C2.1, C2.3).
 * La version precedente (correctif C1.3) utilisait deux vrais `<input>`
 * stylises en transparent/sans bordure. Greg a releve en recette un rendu en
 * "blocs noirs/gris" malgre ce style — un controle de formulaire natif reste
 * un ELEMENT REMPLACE (`replaced element`) dont le moteur de rendu peut
 * imposer son propre habillage (fond, bordure) sous certaines conditions
 * (theme sombre du systeme, moteur de rendu) QUEL QUE SOIT le CSS auteur
 * pose dessus ; `background:transparent`/`border:none` ne garantit pas
 * l'absence totale d'un tel habillage sur toutes les plateformes. La seule
 * garantie DETERMINISTE : ne jamais utiliser de controle de formulaire natif
 * pour cet affichage. L'en-tete est donc desormais un simple groupe
 * `role="group"` (`tabIndex=0`) affichant du TEXTE pur (deux `<span>`,
 * `aria-hidden`, jamais focalisables individuellement) — AUCUN element ne
 * peut jamais y peindre de fond ou de bordure, par construction, sur aucune
 * plateforme. Typographie reprise a l'IDENTIQUE du handoff
 * (`.picker-time-display`/`.tp-input`, L.108-109) : 36px, graisse 800,
 * `letter-spacing:-0.04em`, `#fff` — PAS les valeurs du correctif precedent
 * (30px/-0.02em), qui etaient deja un ecart non demande. Largeur par segment
 * `2ch` + `fontVariantNumeric:'tabular-nums'` : capacite exacte pour
 * "23"/"59" en chasse fixe, aucune troncature possible quel que soit le
 * chiffre affiche (contrainte C2.1 : "largeur calculee pour 23:59").
 *
 * INTERACTION CLAVIER (C2.3) — saisie SEQUENTIELLE sans `<input>`. Le groupe
 * capte `onKeyDown` ; un tampon interne (`buffer`, jamais affiche tel quel —
 * voir plus bas) accumule les chiffres du SEGMENT ACTIF (`mode`). Chaque
 * chiffre appelle `onChange` IMMEDIATEMENT (valeur live, cf. C2.4) ; le
 * segment se complete et bascule au suivant des que 2 chiffres sont tapes OU
 * des qu'un seul chiffre ne peut avoir AUCUNE suite valide (ex. "9" pour les
 * heures : aucun "9X" n'est une heure valide (<=23), donc "9" se complete
 * seul en 09 — meme logique a 5 pour les minutes, max 59). "1808" tape en
 * continu donne donc 18 (complet des le 2e chiffre) puis bascule puis 08
 * (complet des le 2e chiffre) sans action intermediaire — exactement
 * l'exemple de Greg. Retour arriere efface le dernier chiffre du tampon ;
 * fleches Haut/Bas ajustent le segment actif (bornees, sans rebouclage) ;
 * Tab bascule le segment actif (pas un vrai changement de focus DOM : un
 * seul element est focalisable, le groupe) ; Entree/Echap delegues aux
 * callbacks optionnels `onConfirm`/`onCancel` (memes actions que les boutons
 * OK/Annuler du pied, fournies par l'appelant).
 *
 * AUCUN AFFICHAGE SEPARE DU TAMPON (C2.4). Le texte affiche est TOUJOURS
 * `fmt2(hours)`/`fmt2(minutes)`, c'est-a-dire les PROPS elles-memes, jamais
 * une valeur locale parallele : chaque chiffre tape appelle `onChange` avant
 * meme que le segment soit "complet", donc l'aiguille du cadran (qui lit les
 * memes props) et l'en-tete ne peuvent PAS diverger, par construction — plus
 * besoin de les synchroniser, il n'existe qu'une seule source de verite.
 *
 * CORRECTIF C2.5 (18:10 au lieu de 18:08). Cause racine : l'ancien modele
 * "taper puis `blur` pour valider" pouvait, selon l'ordre exact des
 * evenements navigateur entre le `blur` du champ Minutes et le `click` du
 * bouton OK, lire une valeur de `tempM` pas encore mise a jour (fermeture
 * React perimee) si les deux evenements tombaient dans le meme cycle de
 * traitement. Le nouveau modele n'a PLUS de `blur` a attendre : chaque
 * chiffre commite `onChange` de maniere SYNCHRONE au clavier, bien avant
 * qu'un clic sur OK puisse survenir. Cette classe de bug est eliminee par
 * construction, pas seulement contournee. Voir aussi `CustomTimePicker.tsx`
 * (C1.5) pour l'autre moitie du correctif (arrondi residuel a l'enregistrement).
 */

export interface MxClockFaceProps {
  hours: number | null;
  minutes: number | null;
  onChange: (hours: number, minutes: number) => void;
  locale?: 'fr' | 'en';
  /** Entree clavier -> memes actions que les boutons OK/Annuler du pied (C2.3). */
  onConfirm?: () => void;
  onCancel?: () => void;
}

const fmt2 = (v: number) => String(v).padStart(2, '0');

function polarPosition(index: number, total: number, radius: number, center: number) {
  const angle = (index / total) * 2 * Math.PI;
  return { x: center + radius * Math.sin(angle), y: center - radius * Math.cos(angle) };
}

/** Inverse de `polarPosition` : point ecran -> valeur 0..total-1 la plus proche. */
function angleToValue(clientX: number, clientY: number, svg: SVGSVGElement, cx: number, cy: number, total: number): number {
  const rect = svg.getBoundingClientRect();
  const viewBoxSize = 190;
  const scaleX = rect.width > 0 ? viewBoxSize / rect.width : 1;
  const scaleY = rect.height > 0 ? viewBoxSize / rect.height : 1;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  const dx = x - cx;
  const dy = y - cy;
  let angle = Math.atan2(dx, -dy);
  if (angle < 0) angle += 2 * Math.PI;
  return Math.round((angle / (2 * Math.PI)) * total) % total;
}

export function MxClockFace({ hours, minutes, onChange, locale = 'fr', onConfirm, onCancel }: MxClockFaceProps) {
  const [mode, setMode] = useState<'h' | 'm'>('h');
  // Tampon de saisie clavier SEQUENTIELLE du segment actif — jamais affiche
  // directement (voir en-tete du fichier) : sert uniquement a savoir combien
  // de chiffres ont deja ete tapes pour decider quand le segment se complete.
  const [buffer, setBuffer] = useState('');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);

  const h = hours ?? 0;
  const m = minutes ?? 0;

  // Changement de segment actif (clic sur l'en-tete, les onglets, ou Tab) :
  // vide TOUJOURS le tampon en cours, pour ne jamais melanger deux saisies.
  const selectSegment = (seg: 'h' | 'm') => {
    setMode(seg);
    setBuffer('');
    groupRef.current?.focus();
  };

  const cx = 95;
  const cy = 95;
  const outerR = 72;
  const innerR = 46;

  const handleDigit = (segment: 'h' | 'm', digit: string) => {
    const maxFirstDigit = segment === 'h' ? 2 : 5;
    const maxValue = segment === 'h' ? 23 : 59;
    const nextBuffer = buffer.length >= 2 ? digit : buffer + digit;
    const value = parseInt(nextBuffer, 10);
    // Borne AVANT d'emettre : un tampon a 2 chiffres (ex. "29" pour les
    // heures) peut depasser la borne meme quand aucun chiffre pris seul ne
    // la depassait (2 <= maxFirstDigit) — la garde sur `maxFirstDigit` ne
    // protege que le PREMIER chiffre.
    const clamped = Math.min(value, maxValue);
    if (segment === 'h') onChange(clamped, m);
    else onChange(h, clamped);

    // Complet des 2 chiffres, OU un seul chiffre sans suite valide possible
    // (ex. "9" pour les heures : "9X" > 23 pour tout X, donc "9" = 09 seul).
    const complete = nextBuffer.length === 2 || value > maxFirstDigit;
    if (complete) {
      setBuffer('');
      if (segment === 'h') setMode('m');
    } else {
      setBuffer(nextBuffer);
    }
  };

  const handleGroupKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      handleDigit(mode, e.key);
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      setBuffer((b) => b.slice(0, -1));
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      setBuffer('');
      const delta = e.key === 'ArrowUp' ? 1 : -1;
      if (mode === 'h') onChange(Math.max(0, Math.min(23, h + delta)), m);
      else onChange(h, Math.max(0, Math.min(59, m + delta)));
      return;
    }
    if (e.key === 'Tab') {
      // Bascule le SEGMENT ACTIF, pas le focus DOM (un seul element focalisable).
      e.preventDefault();
      setBuffer('');
      setMode((cur) => (cur === 'h' ? 'm' : 'h'));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm?.();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    }
  };

  /** Point de depart commun clic/glisser (souris) : valeur immediate puis suivi continu. */
  const handleMinuteMouseDown = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    if (!svg) return;
    setBuffer('');
    onChange(h, angleToValue(e.clientX, e.clientY, svg, cx, cy, 60));
    const onMove = (ev: MouseEvent) => {
      onChange(h, angleToValue(ev.clientX, ev.clientY, svg, cx, cy, 60));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const handleMinuteTouchStart = (e: { touches: ArrayLike<{ clientX: number; clientY: number }> }) => {
    const svg = svgRef.current;
    const touch = e.touches[0];
    if (!svg || !touch) return;
    setBuffer('');
    onChange(h, angleToValue(touch.clientX, touch.clientY, svg, cx, cy, 60));
    const onMove = (ev: TouchEvent) => {
      const t = ev.touches[0];
      if (!t) return;
      onChange(h, angleToValue(t.clientX, t.clientY, svg, cx, cy, 60));
    };
    const onEnd = () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  };

  const hourNumbers = Array.from({ length: 12 }, (_, i) => i);
  const minuteTicks = Array.from({ length: 12 }, (_, i) => i * 5);

  /** `.tp-input`/`.picker-time-display` du handoff, L.108-109 — repris a l'identique. */
  const segmentStyle = (active: boolean): CSSProperties => ({
    display: 'inline-block',
    fontSize: 'calc(36px * var(--mx-scale, 1))',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    fontFamily: 'var(--mx-font-ui)',
    fontVariantNumeric: 'tabular-nums',
    color: '#fff',
    width: '2ch',
    textAlign: 'center',
    opacity: active ? 1 : 0.55,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'opacity 0.15s',
  });

  return (
    <div>
      <div
        style={{
          background: 'linear-gradient(135deg, var(--mx-accent), var(--mx-accent-2))',
          padding: 'var(--mx-space-12) var(--mx-space-16) var(--mx-space-8)',
        }}
      >
        <div
          ref={groupRef}
          role="group"
          tabIndex={0}
          aria-label={locale === 'fr' ? 'Heure et minutes' : 'Hours and minutes'}
          onKeyDown={handleGroupKeyDown}
          onBlur={() => setBuffer('')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            outline: 'none',
          }}
        >
          <span aria-hidden="true" data-segment="h" onClick={() => selectSegment('h')} style={segmentStyle(mode === 'h')}>
            {fmt2(h)}
          </span>
          <span aria-hidden="true" style={{ color: 'rgba(255,255,255,0.45)' }}>
            :
          </span>
          <span aria-hidden="true" data-segment="m" onClick={() => selectSegment('m')} style={segmentStyle(mode === 'm')}>
            {fmt2(m)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--mx-space-4)', marginTop: 'var(--mx-space-8)', justifyContent: 'center' }}>
          {(['h', 'm'] as const).map((tabMode) => (
            <button
              key={tabMode}
              type="button"
              onClick={() => selectSegment(tabMode)}
              style={{
                padding: 'calc(4px * var(--mx-scale, 1)) calc(14px * var(--mx-scale, 1))',
                borderRadius: 'var(--mx-radius-4)',
                border: 'none',
                cursor: 'pointer',
                background: mode === tabMode ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: mode === tabMode ? '#fff' : 'rgba(255,255,255,0.7)',
                ...MX_TEXT.badge,
                textTransform: 'none',
              }}
            >
              {tabMode === 'h' ? (locale === 'fr' ? 'Heures' : 'Hours') : locale === 'fr' ? 'Minutes' : 'Minutes'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: 'var(--mx-space-8)', display: 'flex', justifyContent: 'center' }}>
        <svg
          ref={svgRef}
          width={156}
          height={156}
          viewBox="0 0 190 190"
          role="presentation"
          style={mode === 'm' ? { cursor: 'pointer', touchAction: 'none' } : undefined}
          onMouseDown={mode === 'm' ? (e) => handleMinuteMouseDown(e) : undefined}
          onTouchStart={mode === 'm' ? (e) => handleMinuteTouchStart(e) : undefined}
        >
          <circle cx={cx} cy={cy} r={85} fill="var(--mx-accent-lt)" />
          {mode === 'h'
            ? hourNumbers.map((i) => {
                const outerVal = i === 0 ? 12 : i + 12;
                const outerSel = h === outerVal || (h === 0 && outerVal === 12 && false);
                const outerPos = polarPosition(i, 12, outerR, cx);
                const innerVal = i;
                const innerSel = h === innerVal;
                const innerPos = polarPosition(i, 12, innerR, cx);
                return (
                  <g key={i}>
                    {outerSel ? (
                      <>
                        <line x1={cx} y1={cy} x2={outerPos.x} y2={outerPos.y} stroke="var(--mx-accent)" strokeWidth={2} strokeLinecap="round" />
                        <circle cx={outerPos.x} cy={outerPos.y} r={14} fill="var(--mx-accent)" />
                      </>
                    ) : null}
                    <text
                      x={outerPos.x}
                      y={outerPos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={12}
                      fontFamily="var(--mx-font-ui)"
                      fill={outerSel ? '#fff' : 'var(--mx-text3)'}
                      fontWeight={outerSel ? 700 : 400}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => {
                        setBuffer('');
                        onChange(outerVal === 24 ? 12 : outerVal, m);
                        setMode('m');
                      }}
                    >
                      {fmt2(outerVal)}
                    </text>
                    {innerSel ? (
                      <>
                        <line x1={cx} y1={cy} x2={innerPos.x} y2={innerPos.y} stroke="var(--mx-accent)" strokeWidth={2} strokeLinecap="round" />
                        <circle cx={innerPos.x} cy={innerPos.y} r={13} fill="var(--mx-accent)" />
                      </>
                    ) : null}
                    <text
                      x={innerPos.x}
                      y={innerPos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={11}
                      fontFamily="var(--mx-font-ui)"
                      fill={innerSel ? '#fff' : 'var(--mx-text2)'}
                      fontWeight={innerSel ? 700 : 400}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => {
                        setBuffer('');
                        onChange(innerVal, m);
                        setMode('m');
                      }}
                    >
                      {fmt2(innerVal)}
                    </text>
                  </g>
                );
              })
            : (() => {
                const needleAngle = (m / 60) * 2 * Math.PI;
                const needlePos = { x: cx + outerR * Math.sin(needleAngle), y: cy - outerR * Math.cos(needleAngle) };
                const onTick = m % 5 === 0;
                return (
                  <>
                    <line x1={cx} y1={cy} x2={needlePos.x} y2={needlePos.y} stroke="var(--mx-accent)" strokeWidth={2} strokeLinecap="round" />
                    {!onTick ? <circle cx={needlePos.x} cy={needlePos.y} r={6} fill="var(--mx-accent)" /> : null}
                    {minuteTicks.map((val) => {
                      const pos = polarPosition(val / 5, 12, outerR, cx);
                      const sel = m === val;
                      return (
                        <g key={val} style={{ pointerEvents: 'none' }}>
                          {sel ? <circle cx={pos.x} cy={pos.y} r={14} fill="var(--mx-accent)" /> : null}
                          <text
                            x={pos.x}
                            y={pos.y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={12}
                            fontFamily="var(--mx-font-ui)"
                            fill={sel ? '#fff' : 'var(--mx-text3)'}
                            fontWeight={sel ? 700 : 400}
                            style={{ userSelect: 'none' }}
                          >
                            {fmt2(val)}
                          </text>
                        </g>
                      );
                    })}
                  </>
                );
              })()}
          <circle cx={cx} cy={cy} r={4} fill="var(--mx-accent)" />
        </svg>
      </div>
    </div>
  );
}

export default MxClockFace;
