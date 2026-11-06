import { useId, type CSSProperties, type ReactNode } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { MX_TEXT } from '../tokens';
import { mxIconBox } from './mxIcon';
import { MxButton } from '../MxButton';
import { MxPortal } from '../MxPortal';

/**
 * MxPickerField / MxPickerPanel — internes au tronc, HORS BARREL (voir
 * index.ts).
 *
 * LOT PICKERS-MX, S2. Partages par MxDatePicker / MxTimePicker /
 * MxDateTimePicker / MxDateRangePicker :
 *   - `MxPickerField` : le CHAMP visible (label, bouton declencheur, erreur) —
 *     ECART TYPOGRAPHIQUE ASSUME DE GREG (consigne du lot, 2026-10-16) :
 *     12.5px/500-600, ~34px de haut, comme MxTextField (`--mx-fs-field-label`,
 *     `--mx-control-h`) — PAS les 13px/40px mesures dans le catalogue pour ce
 *     champ. Meme decision de principe que `MxFields.tsx` (densite des ecrans
 *     reels), etendue ici par Greg lui-meme plutot que deduite par defaut.
 *   - `MxPickerPanel` : la CARTE du popover (`picker-card` du handoff,
 *     L.105-106) — fond, bordure, rayon, ombre — et son pied Effacer / Annuler
 *     + OK (`picker-footer`, L.116-119), commun aux 4 selecteurs.
 */

const TRIGGER_STYLE: CSSProperties = {
  width: '100%',
  minHeight: 'var(--mx-control-h)',
  padding: '0 var(--mx-space-12)',
  borderRadius: 'var(--mx-radius-6)',
  background: 'var(--mx-input-bg)',
  border: 'var(--mx-border-w) solid var(--mx-input-border)',
  color: 'var(--mx-text)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--mx-space-8)',
  textAlign: 'left',
  cursor: 'pointer',
  ...MX_TEXT.meta,
};

export interface MxPickerFieldProps {
  id?: string;
  label?: ReactNode;
  hideLabel?: boolean;
  placeholder: string;
  displayValue: string | null;
  error?: string;
  disabled?: boolean;
  open: boolean;
  onOpen: () => void;
  icon?: 'date' | 'time' | 'datetime';
  triggerRef: (node: HTMLElement | null) => void;
  className?: string;
}

export function MxPickerField({
  id,
  label,
  hideLabel,
  placeholder,
  displayValue,
  error,
  disabled,
  open,
  onOpen,
  icon = 'date',
  triggerRef,
  className,
}: MxPickerFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(6px * var(--mx-scale, 1))', minWidth: 0 }} className={className}>
      {label ? (
        <label
          htmlFor={fieldId}
          style={hideLabel ? { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' } : { ...MX_TEXT.fieldLabelStrong, color: 'var(--mx-text2)' }}
        >
          {label}
        </label>
      ) : null}
      <button
        id={fieldId}
        type="button"
        ref={triggerRef as never}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onOpen}
        style={{
          ...TRIGGER_STYLE,
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          borderColor: open ? 'var(--mx-accent)' : error ? 'var(--mx-danger)' : 'var(--mx-input-border)',
          boxShadow: open ? 'var(--mx-focus-ring)' : 'none',
        }}
      >
        <span style={{ color: displayValue ? 'var(--mx-text)' : 'var(--mx-text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayValue ?? placeholder}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--mx-space-4)', flexShrink: 0 }}>
          {icon !== 'time' ? <Calendar aria-hidden="true" style={{ ...mxIconBox('sm'), color: 'var(--mx-text3)' }} /> : null}
          {icon !== 'date' ? <Clock aria-hidden="true" style={{ ...mxIconBox('sm'), color: 'var(--mx-text3)' }} /> : null}
        </span>
      </button>
      {error ? <span style={{ ...MX_TEXT.help, color: 'var(--mx-danger)' }}>{error}</span> : null}
    </div>
  );
}

export interface MxPickerPanelProps {
  children: ReactNode;
  width?: number;
  onClear: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  clearLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  panelRef: (node: HTMLDivElement | null) => void;
  pos: { top: number | 'auto'; left: number };
  style?: CSSProperties;
}

/**
 * `picker-card` du handoff — fond, bordure, rayon, ombre, pied Effacer/Annuler+OK.
 *
 * CORRECTIF C1.1/C1.2 (LOT PICKERS-MX, retours de recette Greg, 2026-10-16) :
 * rendu via `MxPortal` (sortie vers `document.body`), comme `MxMenu`. SANS ce
 * portail, le panneau restait un DESCENDANT REACT (et DOM) du champ qui l'a
 * ouvert : a l'interieur d'une fenetre (`Modal`) ou d'un drawer (`MxDrawer`),
 * dont le panneau glissant porte un `transform` pour son animation, tout
 * ancetre `transform` cree un bloc conteneur pour les descendants
 * `position:fixed` (voir l'en-tete de `MxPortal.tsx`) : le panneau se
 * positionnait alors relativement a CET ancetre au lieu du viewport (d'ou le
 * popover ouvert en bas a droite de l'ecran, C1.1), et restait prisonnier de
 * la PILE D'EMPILEMENT du drawer — son z-index, meme superieur a celui du
 * drawer, ne pouvait jamais depasser visuellement un ancetre qui cree son
 * propre contexte d'empilement (d'ou le calendrier ouvert DERRIERE le drawer
 * de prolongation, C1.2). Avec `MxPortal`, le panneau est un enfant direct de
 * `document.body` (ou de la cible de scope, cf. `MxPortal.tsx`) : sa position
 * `fixed` est bien relative au viewport, et `--mx-z-popover` (500) le place
 * au-dessus de `--mx-z-drawer` (301) et `--mx-z-modal` (401) sans aucun
 * ancetre pour l'en empecher — meme regle que MxMenu, meme echelle
 * `tokens-mx.css`, documentee a l'identique pour les deux (C1.2 : doctrine
 * mise a jour dans `tokens-mx.css`, pas de nouveau cran).
 */
export function MxPickerPanel({
  children,
  width = 280,
  onClear,
  onCancel,
  onConfirm,
  clearLabel,
  cancelLabel,
  confirmLabel,
  panelRef,
  pos,
  style,
}: MxPickerPanelProps) {
  return (
    <MxPortal>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          zIndex: 'var(--mx-z-popover)' as CSSProperties['zIndex'],
          width: `calc(${width}px * var(--mx-scale, 1))`,
          background: 'var(--mx-surface)',
          border: 'var(--mx-border-w-thin) solid var(--mx-border)',
          borderRadius: 'var(--mx-radius-8)',
          boxShadow: 'var(--mx-shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          marginTop: 'calc(6px * var(--mx-scale, 1))',
          ...style,
        }}
      >
        {children}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--mx-space-8) var(--mx-space-12)',
            borderTop: 'var(--mx-border-w-thin) solid var(--mx-border)',
            marginTop: 'auto',
          }}
        >
          <MxButton variant="ghost" onClick={onClear}>
            {clearLabel}
          </MxButton>
          <div style={{ display: 'flex', gap: 'var(--mx-space-8)' }}>
            <MxButton variant="ghost" onClick={onCancel}>
              {cancelLabel}
            </MxButton>
            <MxButton variant="primary" onClick={onConfirm}>
              {confirmLabel}
            </MxButton>
          </div>
        </div>
      </div>
    </MxPortal>
  );
}
