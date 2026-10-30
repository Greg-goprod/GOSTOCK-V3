import { useState, type CSSProperties, type ReactNode } from 'react';
import { Check } from 'lucide-react';

import { MX_TEXT } from './tokens';

/**
 * MxCheckbox — case a cocher (role="checkbox"), ABSENTE du tronc avant ce
 * lot. LOT BOOKING-DRAWERS-FIN -- LOT 2, C1 (Greg, 2026-10-18) : composant
 * MANQUANT identifie en recette (« si un composant manque -- case a cocher,
 * choix exclusif -- le creer dans le tronc d'apres le handoff, jamais
 * localement »). Premier site d'appel : `OfferComposer.tsx` (financier,
 * clauses d'exclusivite).
 *
 * HANDOFF — `reference/Mannyx Components V2.html`, bloc « Toggle + Checkbox »
 * (lignes ~449-468) et regles `.checkbox`/`.checkbox.checked` (CSS, lignes
 * ~1925-1927) : case 16x16, rayon 4px, filet 1.5px, fond plein + coche
 * blanche quand cochee. DISTINCT de `MxToggle` (interrupteur/switch,
 * `role="switch"`, deja dans le tronc) : le handoff dessine les deux
 * controles separement (sections « Toggle » et « Checkbox »), jamais l'un a
 * la place de l'autre.
 *
 * PATRON — calque sur `MxToggle` (`MxToggles.tsx`) : un seul `<button>`
 * ENTIEREMENT custom (`role="checkbox"`, `aria-checked`), PAS un
 * `<input type="checkbox">` visuellement cache -- aucun des deux controles
 * binaires du tronc ne s'appuie sur un input natif, le contour de focus
 * clavier (`data-mx-focus`) cerne le bouton entier (case ET libelle), le
 * libelle fait partie de la zone cliquable.
 *
 * RAYON 4px — `--mx-radius-4` (deja dans l'echelle, tokens-mx.css) :
 * CONFORME au handoff, pas un ecart (le handoff mesure explicitement 4px
 * pour la case, a la difference du rayon 6px des champs/selects/menus).
 *
 * TAILLE 16px — litterale comme `--mx-toggle-track-w` etc. (geometrie d'un
 * CONTROLE, hors de l'echelle --mx-space-*), scalee par --mx-scale comme le
 * reste du tronc.
 */
interface MxCheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Libelle cliquable a droite de la case. */
  label?: ReactNode;
  /** Nom accessible quand `label` n'est pas du texte. */
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** MxCheckbox — case a cocher (role="checkbox"). */
export function MxCheckbox({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled = false,
  className,
  style,
}: MxCheckboxProps) {
  const [focused, setFocused] = useState(false);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={typeof label === 'string' ? undefined : ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={className}
      // Contour de focus clavier, EXCEPTION 1 / 2 de tokens-mx.css. Cerne le
      // bouton ENTIER (case + libelle), meme motif que MxToggle : le libelle
      // declenche aussi la bascule.
      data-mx-focus=""
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--mx-space-8)',
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
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          width: 'calc(16px * var(--mx-scale, 1))',
          height: 'calc(16px * var(--mx-scale, 1))',
          borderRadius: 'var(--mx-radius-4)',
          border: `var(--mx-border-w) solid ${checked ? 'var(--mx-accent)' : 'var(--mx-input-border)'}`,
          background: checked ? 'var(--mx-accent)' : 'var(--mx-input-bg)',
          boxShadow: focused && !disabled ? 'var(--mx-focus-ring)' : 'none',
          transition:
            'background var(--mx-dur-fast) var(--mx-ease-appear), border-color var(--mx-dur-fast) var(--mx-ease-appear), box-shadow var(--mx-dur-fast) var(--mx-ease-appear)',
        }}
      >
        {checked ? (
          <Check
            aria-hidden="true"
            // Blanc LITTERAL, invariant par theme -- meme motif que
            // `--mx-toggle-knob` (MxToggles.tsx) : la coche se lit sur un
            // fond --mx-accent plein dans les deux themes, comme le bouton
            // primary (toujours blanc sur accent).
            style={{
              width: 'calc(11px * var(--mx-scale, 1))',
              height: 'calc(11px * var(--mx-scale, 1))',
              color: '#ffffff',
              strokeWidth: 3,
            }}
          />
        ) : null}
      </span>
      {label != null ? (
        <span style={{ ...MX_TEXT.fieldLabelStrong, color: 'var(--mx-text2)' }}>{label}</span>
      ) : null}
    </button>
  );
}

export default MxCheckbox;
