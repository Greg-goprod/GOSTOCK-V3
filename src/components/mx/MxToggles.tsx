import { useState, type CSSProperties, type ReactNode } from 'react';

import { MX_TEXT, type MxTone } from './tokens';
import { useMxReducedMotion } from './internal/useMxReducedMotion';

/**
 * Geometrie de `.mx-dr-switch` : rail 38x22, pastille 18, marge interne 2.
 * La course vaut donc 38 - 18 - 2*2 = 16, soit le `left:2px -> left:18px` du
 * handoff. Le rail faisait 40 et la pastille 16 : plus large et moins remplie,
 * l'interrupteur y paraissait vide a l'arret.
 * Ces valeurs ne relevent pas de l'echelle d'espacement — c'est le dessin d'un
 * controle, pas une marge — elles restent donc HORS de --mx-space-*, mais
 * elles suivent --mx-scale comme tout le reste du tronc (correction C1,
 * 2026-09-29) : tokens --mx-toggle-track-w/-h, --mx-toggle-knob-size,
 * --mx-toggle-pad (src/styles/tokens-mx.css). La course (`travel`) se calcule
 * donc en CSS via `calc()`, referencant ces memes tokens, plutot qu'en
 * arithmetique JS sur des nombres fixes — la formule reste visible, elle
 * suit juste --mx-scale sans recalcul a chaque rendu. */
const TRAVEL =
  'calc(var(--mx-toggle-track-w) - var(--mx-toggle-knob-size) - (var(--mx-toggle-pad) * 2))';

interface MxToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Libelle cliquable a droite de l'interrupteur. */
  label?: ReactNode;
  /** Nom accessible quand `label` n'est pas du texte. */
  ariaLabel?: string;
  disabled?: boolean;
  /** Ton de l'etat actif. `success` pour une confirmation, `accent` par defaut. */
  tone?: Extract<MxTone, 'accent' | 'success'>;
  className?: string;
  style?: CSSProperties;
}

const ON_TRACK: Record<'accent' | 'success', string> = {
  accent: 'var(--mx-accent)',
  success: 'var(--mx-green)',
};

/** MxToggle — interrupteur booleen (role="switch"). */
export function MxToggle({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled = false,
  tone = 'accent',
  className,
  style,
}: MxToggleProps) {
  const [focused, setFocused] = useState(false);
  // Lot C-RM (2026-09-24) : sous reduce, la pastille garde sa position finale
  // (coche/decoche) mais sans glissement anime — voir sa transition plus bas.
  // La couleur du rail n'est pas concernee : transition inchangee.
  const reduced = useMxReducedMotion();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={typeof label === 'string' ? undefined : ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={className}
      // Contour de focus clavier, EXCEPTION 1 / 2 de tokens-mx.css.
      // IL CERNE LE BOUTON ENTIER, rail ET libelle, pas seulement le rail — et
      // c'est le bon perimetre : le libelle fait partie de la zone activable
      // (il declenche la bascule), donc un contour limite au rail mentirait sur
      // ce qui reagit au clic. L'anneau --mx-focus-ring reste pose sur le rail
      // en plus, ce qui designe le controle lui-meme.
      data-mx-focus=""
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--mx-space-12)',
        padding: 0,
        border: 'none',
        background: 'transparent',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          display: 'inline-flex',
          flexShrink: 0,
          width: 'var(--mx-toggle-track-w)',
          height: 'var(--mx-toggle-track-h)',
          borderRadius: 'var(--mx-radius-pill)',
          background: checked ? ON_TRACK[tone] : 'var(--mx-toggle-off)',
          // --mx-focus-ring et non --mx-accent-lt : meme motif que sur les
          // champs. --mx-accent-lt vaut 0.16 en sombre mais 0.09 en clair,
          // l'anneau y etait deux fois moins visible. C'est de l'accessibilite.
          boxShadow: focused && !disabled ? 'var(--mx-focus-ring)' : 'none',
          transition:
            'background var(--mx-dur-toggle) var(--mx-ease-appear), box-shadow var(--mx-dur-fast) var(--mx-ease-appear)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 'var(--mx-toggle-pad)',
            left: 'var(--mx-toggle-pad)',
            width: 'var(--mx-toggle-knob-size)',
            height: 'var(--mx-toggle-knob-size)',
            borderRadius: 'var(--mx-radius-pill)',
            background: 'var(--mx-toggle-knob)',
            boxShadow: 'var(--mx-toggle-knob-shadow)',
            transform: checked ? `translateX(${TRAVEL})` : 'translateX(0)',
            // Sous reduce : la position finale est conservee (etat coche/decoche
            // reste visible), mais sans transition sur `transform` (decision Greg
            // 2026-09-24).
            transition: reduced ? 'none' : 'transform var(--mx-dur-toggle) var(--mx-ease-spring)',
          }}
        />
      </span>
      {/* fieldLabelStrong (12.5/600) et non meta (12.5/500) : le libelle d'une
          ligne d'interrupteur EST un label de controle de formulaire, et le
          handoff le pose en 600 (`.mx-dr-toggle-row .lbl`). Laisse en 500, il
          avait exactement la graisse de son propre texte d'aide. */}
      {label != null ? (
        <span style={{ ...MX_TEXT.fieldLabelStrong, color: 'var(--mx-text2)' }}>{label}</span>
      ) : null}
    </button>
  );
}

interface MxTogglesProps {
  children: ReactNode;
  /** Aide commune sous le groupe (ce qui bloque, ce qui reste a faire…). */
  hint?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** MxToggles — groupe d'interrupteurs avec aide en pied. */
export function MxToggles({ children, hint, className, style }: MxTogglesProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--mx-space-12)',
        ...style,
      }}
    >
      {children}
      {hint ? <span style={{ ...MX_TEXT.help, color: 'var(--mx-text3)' }}>{hint}</span> : null}
    </div>
  );
}

export default MxToggles;
