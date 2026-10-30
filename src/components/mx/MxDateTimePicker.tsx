import { useState, type CSSProperties } from 'react';
import { useI18n } from '../../lib/i18n';
import { MX_TEXT } from './tokens';
import { MxPickerField, MxPickerPanel } from './internal/MxPickerField';
import { MxCalendarGrid } from './internal/MxCalendarGrid';
import { MxClockFace } from './internal/MxClockFace';
import { useMxFieldPopover } from './internal/useMxFieldPopover';
import { MX_DEFAULT_FESTIVAL_TIMEZONE, mxZonedWallTimeFromUtc, mxZonedWallTimeToUtc } from './internal/mxFestivalTimezone';

/**
 * MxDateTimePicker — sélecteur date + heure du tronc, SEUL ET UNIQUE (LOT
 * PICKERS-MX). Le handoff (`reference/Mannyx Components V2.html`,
 * L.962-992 + L.2593-2606) ne dessine PAS un widget fusionné unique : DEUX
 * déclencheurs côte à côte (date, puis heure de largeur fixe), chacun ouvrant
 * SOIT un `DatePicker` SOIT un `TimePicker` — jamais les deux a la fois — et
 * un encart de résultat combiné en dessous. Reproduit tel quel ici, plutôt
 * que le popover unique de l'ancien `DateTimePickerPopup` : « rien ne
 * s'invente la où le handoff décide ».
 *
 * CONTRAT DE VALEURS IDENTIQUE a `DateTimePickerPopup` (`Date | null`
 * combiné), pour un remplacement sans changer les données (S2).
 *
 * FUSEAU DU FESTIVAL, JAMAIS D'HEURE UTC IMPLICITE : contrairement a l'ancien
 * composant (`newDate.setHours(...)`, heure LOCALE du navigateur), la date et
 * l'heure choisies sont combinées via `mxZonedWallTimeToUtc` — explicite,
 * fonctionne identiquement quel que soit le fuseau du poste qui l'exécute.
 * Par défaut `Europe/Zurich` (aucune colonne de fuseau par événement
 * n'existe en base aujourd'hui, verifie au S0/S4 de ce lot) ; `timeZone` est
 * exposé pour le jour ou un fuseau par événement serait ajouté.
 */

export interface MxDateTimePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  defaultMonth?: Date | null;
  /** Fuseau horaire du festival. Défaut `Europe/Zurich` (voir en-tête). */
  timeZone?: string;
}

const TRIGGER_ROW: CSSProperties = { display: 'flex', gap: 'var(--mx-space-8)' };

export function MxDateTimePicker({
  value,
  onChange,
  label,
  error,
  disabled,
  className,
  defaultMonth,
  timeZone = MX_DEFAULT_FESTIVAL_TIMEZONE,
}: MxDateTimePickerProps) {
  const { t, lang } = useI18n();
  const locale = lang === 'fr' ? 'fr' : 'en';

  const existing = value ? mxZonedWallTimeFromUtc(value, timeZone) : null;
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => (existing ? new Date(existing.year, existing.month, existing.day) : defaultMonth ?? new Date()));
  const [tempDay, setTempDay] = useState<Date | null>(existing ? new Date(existing.year, existing.month, existing.day) : null);
  const [tempH, setTempH] = useState<number | null>(existing ? existing.hours : null);
  const [tempM, setTempM] = useState<number | null>(existing ? existing.minutes : null);

  const closeDate = () => setDateOpen(false);
  const closeTime = () => setTimeOpen(false);
  const datePop = useMxFieldPopover(dateOpen, closeDate);
  const timePop = useMxFieldPopover(timeOpen, closeTime);

  /**
   * Revient a la derniere valeur COMMISE (`value`) — reserve a `Annuler`
   * (abandon explicite d'une saisie en cours), jamais a l'ouverture d'un
   * popover : `openDate`/`openTime` NE reinitialisent PAS `tempDay`/`tempH`/
   * `tempM`, pour que l'enchainement date -> heure (confort repris du
   * handoff, L.2382 : confirmer la date rouvre directement l'heure) ne perde
   * pas la date qui vient d'etre choisie — `value` reste `null` tant que les
   * deux cotes ne sont pas connus (voir `commit`), donc relire `value` a cet
   * instant effacerait la selection en cours (bug corrige en test, S2).
   */
  const revertToValue = () => {
    const cur = value ? mxZonedWallTimeFromUtc(value, timeZone) : null;
    setTempDay(cur ? new Date(cur.year, cur.month, cur.day) : null);
    setTempH(cur ? cur.hours : null);
    setTempM(cur ? cur.minutes : null);
  };

  const commit = (day: Date | null, h: number | null, m: number | null) => {
    if (day && h != null && m != null) {
      onChange(mxZonedWallTimeToUtc(day.getFullYear(), day.getMonth(), day.getDate(), h, m, timeZone));
    } else if (!day && h == null && m == null) {
      onChange(null);
    }
    // Un seul des deux cotes renseigne : on ne notifie pas encore (valeur
    // incomplete), meme comportement que l'ancien DateTimePickerPopup qui
    // n'emettait qu'une fois date ET heure connues.
  };

  const openDate = () => {
    if (disabled) return;
    setViewDate(tempDay ?? defaultMonth ?? new Date());
    setDateOpen(true);
  };
  const openTime = () => {
    if (disabled) return;
    setTimeOpen(true);
  };

  // Partagees entre le pied du popover (boutons Annuler/OK) et le clavier de
  // MxClockFace (Echap/Entree, C2.3) — memes actions, une seule definition.
  const cancelTime = () => {
    revertToValue();
    closeTime();
  };
  const confirmTime = () => {
    commit(tempDay, tempH, tempM);
    closeTime();
  };

  const dateDisplay = tempDay
    ? new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(tempDay)
    : null;
  const timeDisplay = tempH != null && tempM != null ? `${String(tempH).padStart(2, '0')}:${String(tempM).padStart(2, '0')}` : null;

  const resultText =
    dateDisplay && timeDisplay
      ? `${dateDisplay} ${t('pickers.and')} ${timeDisplay}`
      : dateDisplay || timeDisplay || '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(6px * var(--mx-scale, 1))' }} className={className}>
      {label ? <span style={{ ...MX_TEXT.fieldLabelStrong, color: 'var(--mx-text2)' }}>{label}</span> : null}
      <div style={TRIGGER_ROW}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <MxPickerField
            placeholder={t('pickers.selectDate')}
            displayValue={dateDisplay}
            disabled={disabled}
            open={dateOpen}
            onOpen={openDate}
            icon="date"
            triggerRef={(node) => {
              datePop.triggerRef.current = node;
            }}
          />
          {dateOpen ? (
            <MxPickerPanel
              panelRef={datePop.setPanelRef}
              pos={datePop.pos}
              width={280}
              onClear={() => {
                setTempDay(null);
                commit(null, tempH, tempM);
                closeDate();
              }}
              onCancel={() => {
                revertToValue();
                closeDate();
              }}
              onConfirm={() => {
                commit(tempDay, tempH, tempM);
                closeDate();
                if (tempDay && tempH == null) openTime();
              }}
              clearLabel={t('pickers.clear')}
              cancelLabel={t('pickers.cancel')}
              confirmLabel={t('pickers.confirm')}
            >
              <MxCalendarGrid
                viewDate={viewDate}
                onViewDateChange={setViewDate}
                mode="single"
                selected={tempDay}
                onSelectDay={(d) => setTempDay(d)}
                onEscape={closeDate}
                locale={locale}
              />
            </MxPickerPanel>
          ) : null}
        </div>
        <div style={{ position: 'relative', width: 'calc(82px * var(--mx-scale, 1))', flexShrink: 0 }}>
          <MxPickerField
            placeholder="--:--"
            displayValue={timeDisplay}
            disabled={disabled}
            open={timeOpen}
            onOpen={openTime}
            icon="time"
            triggerRef={(node) => {
              timePop.triggerRef.current = node;
            }}
          />
          {timeOpen ? (
            <MxPickerPanel
              panelRef={timePop.setPanelRef}
              pos={timePop.pos}
              width={220}
              onClear={() => {
                setTempH(null);
                setTempM(null);
                commit(tempDay, null, null);
                closeTime();
              }}
              onCancel={cancelTime}
              onConfirm={confirmTime}
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
                onConfirm={confirmTime}
                onCancel={cancelTime}
                locale={locale}
              />
            </MxPickerPanel>
          ) : null}
        </div>
      </div>
      <div
        style={{
          background: 'var(--mx-surface2)',
          borderRadius: 'var(--mx-radius-6)',
          padding: 'var(--mx-space-8) var(--mx-space-12)',
          color: resultText === '—' ? 'var(--mx-text3)' : 'var(--mx-text)',
          ...MX_TEXT.meta,
        }}
      >
        {resultText}
      </div>
      {error ? <span style={{ ...MX_TEXT.help, color: 'var(--mx-danger)' }}>{error}</span> : null}
    </div>
  );
}

export default MxDateTimePicker;
