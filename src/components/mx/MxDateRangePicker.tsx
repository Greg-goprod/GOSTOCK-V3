import { useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { MxPickerField, MxPickerPanel } from './internal/MxPickerField';
import { MxCalendarGrid } from './internal/MxCalendarGrid';
import { useMxFieldPopover } from './internal/useMxFieldPopover';

/**
 * MxDateRangePicker — sélecteur de plage de dates du tronc, SEUL ET UNIQUE
 * (LOT PICKERS-MX). Même calendrier que `MxDatePicker` (`MxCalendarGrid`),
 * en mode `range` — handoff `reference/Mannyx Components V2.html`,
 * `DatePicker({range:true})`, L.2417/2454-2470 : indice « 1er clic -> début »
 * / « 2e clic -> fin », premier clic APRES une plage complète réinitialise,
 * second clic permute si la date tombe avant le début (plage toujours
 * chronologique).
 *
 * Construit car l'inventaire S1 en contient un usage (`EventForm.tsx`, seul
 * consommateur de l'ancien `DateRangePickerPopup` — dates de début/fin d'un
 * événement).
 *
 * CONTRAT DE VALEURS IDENTIQUE a `DateRangePickerPopup` (`string "YYYY-MM-DD"
 * | null` pour chaque borne, `onChange(start, end)`), pour un remplacement
 * sans changer les données (S2).
 */

export interface MxDateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onChange: (start: string | null, end: string | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

function parseISODate(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function MxDateRangePicker({
  startDate,
  endDate,
  onChange,
  label,
  placeholder,
  error,
  disabled,
  className,
}: MxDateRangePickerProps) {
  const { t, lang } = useI18n();
  const locale = lang === 'fr' ? 'fr' : 'en';
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => parseISODate(startDate) ?? new Date());
  const [tempStart, setTempStart] = useState<Date | null>(parseISODate(startDate));
  const [tempEnd, setTempEnd] = useState<Date | null>(parseISODate(endDate));

  const close = () => setOpen(false);
  const { triggerRef, setPanelRef, pos } = useMxFieldPopover(open, close);

  const openPanel = () => {
    if (disabled) return;
    setTempStart(parseISODate(startDate));
    setTempEnd(parseISODate(endDate));
    setViewDate(parseISODate(startDate) ?? new Date());
    setOpen(true);
  };

  const selectDay = (day: Date) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(day);
      setTempEnd(null);
      return;
    }
    if (day.getTime() < tempStart.getTime()) {
      setTempEnd(tempStart);
      setTempStart(day);
    } else {
      setTempEnd(day);
    }
  };

  const confirm = () => {
    onChange(tempStart ? toISODate(tempStart) : null, tempEnd ? toISODate(tempEnd) : null);
    close();
  };
  const cancel = () => {
    setTempStart(parseISODate(startDate));
    setTempEnd(parseISODate(endDate));
    close();
  };
  const clear = () => {
    setTempStart(null);
    setTempEnd(null);
    onChange(null, null);
    close();
  };

  const fmt = (d: Date) => new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  const displayValue = start && end ? `${fmt(start)} – ${fmt(end)}` : start ? fmt(start) : null;

  return (
    <div style={{ position: 'relative' }} className={className}>
      <MxPickerField
        label={label}
        placeholder={placeholder ?? t('pickers.selectRange')}
        displayValue={displayValue}
        error={error}
        disabled={disabled}
        open={open}
        onOpen={openPanel}
        icon="date"
        triggerRef={(node) => {
          triggerRef.current = node;
        }}
      />
      {open ? (
        <MxPickerPanel
          panelRef={setPanelRef}
          pos={pos}
          width={280}
          onClear={clear}
          onCancel={cancel}
          onConfirm={confirm}
          clearLabel={t('pickers.clear')}
          cancelLabel={t('pickers.cancel')}
          confirmLabel={t('pickers.confirm')}
        >
          <MxCalendarGrid
            viewDate={viewDate}
            onViewDateChange={setViewDate}
            mode="range"
            rangeStart={tempStart}
            rangeEnd={tempEnd}
            onSelectDay={selectDay}
            onEscape={close}
            locale={locale}
          />
        </MxPickerPanel>
      ) : null}
    </div>
  );
}

export default MxDateRangePicker;
