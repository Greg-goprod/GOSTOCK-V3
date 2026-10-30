import { useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { MxPickerField, MxPickerPanel } from './internal/MxPickerField';
import { MxClockFace } from './internal/MxClockFace';
import { useMxFieldPopover } from './internal/useMxFieldPopover';

/**
 * MxTimePicker — sélecteur d'heure du tronc, SEUL ET UNIQUE (LOT PICKERS-MX).
 * Calque sur `reference/Mannyx Components V2.html`, classe `TimePicker`
 * (L.2281-2415) : popover ancré sous le champ, horloge 24h a deux anneaux,
 * saisie clavier directe (champs HH/MM), AUCUN pas de 5 minutes — le cadran
 * accepte les 60 positions, conforme au handoff (`MINUTES = [0..59]`, pas une
 * proposition par défaut).
 *
 * CONTRAT DE VALEURS IDENTIQUE a `TimePickerPopup` (`string "HH:MM" | null`),
 * pour un remplacement sans changer les données (S2, LOT PICKERS-MX).
 */

export interface MxTimePickerProps {
  value?: string | null;
  onChange: (time: string | null) => void;
  label?: string;
  hideLabel?: boolean;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

function parseHM(value: string | null | undefined): { h: number | null; m: number | null } {
  if (!value) return { h: null, m: null };
  const parts = value.split(':');
  const h = parseInt(parts[0] ?? '', 10);
  const m = parseInt(parts[1] ?? '', 10);
  return { h: isNaN(h) ? null : h, m: isNaN(m) ? null : m };
}

function fmtHM(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function MxTimePicker({
  value,
  onChange,
  label,
  hideLabel,
  placeholder,
  error,
  disabled,
  className,
}: MxTimePickerProps) {
  const { t, lang } = useI18n();
  const locale = lang === 'fr' ? 'fr' : 'en';
  const [open, setOpen] = useState(false);
  const initial = parseHM(value);
  const [tempH, setTempH] = useState<number | null>(initial.h);
  const [tempM, setTempM] = useState<number | null>(initial.m);

  const close = () => setOpen(false);
  const { triggerRef, setPanelRef, pos } = useMxFieldPopover(open, close);

  const openPanel = () => {
    if (disabled) return;
    const parsed = parseHM(value);
    setTempH(parsed.h);
    setTempM(parsed.m);
    setOpen(true);
  };

  const confirm = () => {
    onChange(tempH != null && tempM != null ? fmtHM(tempH, tempM) : null);
    close();
  };
  const cancel = () => {
    const parsed = parseHM(value);
    setTempH(parsed.h);
    setTempM(parsed.m);
    close();
  };
  const clear = () => {
    setTempH(null);
    setTempM(null);
    onChange(null);
    close();
  };

  // Normalise l'affichage en HH:MM (supprime les secondes eventuelles),
  // meme comportement que l'ancien TimePickerPopup remplace.
  const displayValue = value ? value.split(':').slice(0, 2).join(':') : null;

  return (
    <div style={{ position: 'relative' }} className={className}>
      <MxPickerField
        label={label}
        hideLabel={hideLabel}
        placeholder={placeholder ?? t('pickers.selectTime')}
        displayValue={displayValue}
        error={error}
        disabled={disabled}
        open={open}
        onOpen={openPanel}
        icon="time"
        triggerRef={(node) => {
          triggerRef.current = node;
        }}
      />
      {open ? (
        <MxPickerPanel
          panelRef={setPanelRef}
          pos={pos}
          width={220}
          onClear={clear}
          onCancel={cancel}
          onConfirm={confirm}
          clearLabel={t('pickers.clear')}
          cancelLabel={t('pickers.cancel')}
          confirmLabel={t('pickers.confirm')}
        >
          <MxClockFace
            hours={tempH}
            minutes={tempM}
            onChange={(h, m) => {
              setTempH(h);
              setTempM(m);
            }}
            onConfirm={confirm}
            onCancel={cancel}
            locale={locale}
          />
        </MxPickerPanel>
      ) : null}
    </div>
  );
}

export default MxTimePicker;
