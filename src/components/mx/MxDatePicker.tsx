import { useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { MxPickerField, MxPickerPanel } from './internal/MxPickerField';
import { MxCalendarGrid } from './internal/MxCalendarGrid';
import { useMxFieldPopover } from './internal/useMxFieldPopover';

/**
 * MxDatePicker — sélecteur de date du tronc, SEUL ET UNIQUE (LOT PICKERS-MX,
 * decision de Greg du 16/10 : les sélecteurs du handoff remplacent TOUS ceux
 * de l'application). Calque sur `reference/Mannyx Components V2.html`, classe
 * `DatePicker` (L.2417-2543) : popover ancré SOUS le champ (jamais une
 * fenêtre centrée ni un drawer — contrairement a `DatePickerPopup`, qu'il
 * remplace), pied Effacer / Annuler + OK, semaine LUNDI->DIMANCHE, grille
 * fixe de 6 semaines, navigation mois -> mois -> année.
 *
 * CONTRAT DE VALEURS IDENTIQUE a `DatePickerPopup` (`Date | null`), pour un
 * remplacement sans changer les données lues/écrites par les appelants
 * (S2, LOT PICKERS-MX) — AUCUNE logique de formulaire a modifier a
 * l'adoption, seul l'import change.
 */

export interface MxDatePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  label?: string;
  hideLabel?: boolean;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  /** Mois par défaut affiché dans le calendrier si `value` est vide. */
  defaultMonth?: Date | null;
}

export function MxDatePicker({
  value,
  onChange,
  label,
  hideLabel,
  placeholder,
  error,
  disabled,
  className,
  defaultMonth,
}: MxDatePickerProps) {
  const { t, lang } = useI18n();
  const locale = lang === 'fr' ? 'fr' : 'en';
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => value ?? defaultMonth ?? new Date());
  const [tempDate, setTempDate] = useState<Date | null>(value ?? null);

  const close = () => setOpen(false);
  const { triggerRef, setPanelRef, pos } = useMxFieldPopover(open, close);

  const openPanel = () => {
    if (disabled) return;
    setTempDate(value ?? null);
    setViewDate(value ?? defaultMonth ?? new Date());
    setOpen(true);
  };

  const confirm = () => {
    onChange(tempDate);
    close();
  };
  const cancel = () => {
    setTempDate(value ?? null);
    close();
  };
  const clear = () => {
    setTempDate(null);
    onChange(null);
    close();
  };

  // Format d'affichage SPECIFIE par le handoff (pas une proposition par
  // défaut) : `d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',
  // year:'numeric'})`, reference/Mannyx Components V2.html L.2558 — ex.
  // « 16 oct. 2026 ». Même famille que le format déjà utilisé par
  // `DatePickerPopup` (jour/mois texte/année), pas le format suisse
  // numérique « 16.10.2026 » : le handoff spécifie explicitement ce point,
  // qui n'est donc PAS parmi les points laissés au défaut (voir rapport S0).
  const displayValue = value
    ? new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(value)
    : null;

  return (
    <div style={{ position: 'relative' }} className={className}>
      <MxPickerField
        label={label}
        hideLabel={hideLabel}
        placeholder={placeholder ?? t('pickers.selectDate')}
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
            mode="single"
            selected={tempDate}
            onSelectDay={(d) => setTempDate(d)}
            onEscape={close}
            locale={locale}
          />
        </MxPickerPanel>
      ) : null}
    </div>
  );
}

export default MxDatePicker;
