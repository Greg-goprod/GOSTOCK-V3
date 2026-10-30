import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { MX_TEXT } from '../tokens';
import { mxIconBox } from './mxIcon';
import {
  MX_MONTH_LABELS_EN,
  MX_MONTH_LABELS_FR,
  MX_MONTH_SHORT_EN,
  MX_MONTH_SHORT_FR,
  MX_WEEKDAY_LABELS_EN,
  MX_WEEKDAY_LABELS_FR,
  mxBuildCalendarGrid,
  mxIsSameDay,
} from './mxCalendarMath';

/**
 * MxCalendarGrid — interne au tronc, HORS BARREL (voir index.ts).
 *
 * LOT PICKERS-MX, S2. Calendrier du handoff (`reference/Mannyx Components
 * V2.html`, classe `DatePicker`, L.2417-2543) : en-tete degrade accent avec
 * navigation mois, bascule vers une grille de mois puis d'annees (meme
 * mecanisme que l'existant `DatePickerAura`), grille fixe de 6 semaines,
 * semaine LUNDI->DIMANCHE. Partage par MxDatePicker (mode `single`) et
 * MxDateRangePicker (mode `range`) — composant interne, jamais exporte seul :
 * le handoff ne dessine pas de calendrier « nu », toujours dans un
 * `picker-card` avec pied Effacer/Annuler/OK, porte par l'appelant public.
 *
 * CLAVIER (S1 : « clavier complet » = fleches, PageUp/Down, Entree, Echap) :
 *   - Fleches gauche/droite/haut/bas : deplacent le jour EN FOCUS de +-1/+-7,
 *     changeant de mois automatiquement si necessaire (meme motif que la
 *     plupart des calendriers ARIA : `grid` + roving tabindex).
 *   - PageUp/PageDown : mois precedent/suivant. Shift+PageUp/Down : annee
 *     precedente/suivante.
 *   - Home/End : premier/dernier jour du mois AFFICHE (pas de la semaine —
 *     plus utile pour un champ de date d'evenement que la borne de semaine).
 *   - Entree/Espace : selectionne le jour en focus.
 *   - Echap : remonte a l'appelant (onEscape), qui ferme le popover — cette
 *     grille ne gere pas elle-meme la fermeture, seul le popover le sait.
 */

export interface MxCalendarGridProps {
  /** Mois affiche (le jour de `viewDate` est ignore, seuls annee/mois comptent). */
  viewDate: Date;
  onViewDateChange: (next: Date) => void;
  mode: 'single' | 'range';
  selected?: Date | null;
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
  onSelectDay: (date: Date) => void;
  onEscape?: () => void;
  locale?: 'fr' | 'en';
}

const CAL_HEADER: CSSProperties = {
  background: 'linear-gradient(135deg, var(--mx-accent), var(--mx-accent-2))',
  padding: 'var(--mx-space-12) var(--mx-space-16)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--mx-space-8)',
};

const CAL_NAV_BTN: CSSProperties = {
  background: 'rgba(255,255,255,0.15)',
  border: 'none',
  cursor: 'pointer',
  width: 'calc(28px * var(--mx-scale, 1))',
  height: 'calc(28px * var(--mx-scale, 1))',
  borderRadius: 'var(--mx-radius-4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  flexShrink: 0,
};

const CAL_MONTH_BTN: CSSProperties = {
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.2)',
  cursor: 'pointer',
  borderRadius: 'var(--mx-radius-4)',
  padding: 'calc(4px * var(--mx-scale, 1)) var(--mx-space-12)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--mx-space-4)',
  ...MX_TEXT.itemTitle,
};

const GRID_CELL: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  borderRadius: 'var(--mx-radius-4)',
  margin: '0 auto',
  ...MX_TEXT.help,
};

export function MxCalendarGrid({
  viewDate,
  onViewDateChange,
  mode,
  selected,
  rangeStart,
  rangeEnd,
  onSelectDay,
  onEscape,
  locale = 'fr',
}: MxCalendarGridProps) {
  const [view, setView] = useState<'days' | 'months' | 'years'>('days');
  const [yearPage, setYearPage] = useState(() => Math.floor(viewDate.getFullYear() / 12) * 12);
  const [focusedDate, setFocusedDate] = useState(() => selected ?? rangeStart ?? new Date(viewDate));
  const gridId = useId();
  const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const weekdays = locale === 'fr' ? MX_WEEKDAY_LABELS_FR : MX_WEEKDAY_LABELS_EN;
  const months = locale === 'fr' ? MX_MONTH_LABELS_FR : MX_MONTH_LABELS_EN;
  const monthsShort = locale === 'fr' ? MX_MONTH_SHORT_FR : MX_MONTH_SHORT_EN;

  const cells = mxBuildCalendarGrid(year, month);
  const today = new Date();

  const moveFocus = (next: Date) => {
    setFocusedDate(next);
    if (next.getMonth() !== month || next.getFullYear() !== year) {
      onViewDateChange(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  };

  useEffect(() => {
    const key = focusedDate.toDateString();
    cellRefs.current[key]?.focus();
  }, [focusedDate, view]);

  const handleGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        moveFocus(new Date(focusedDate.getFullYear(), focusedDate.getMonth(), focusedDate.getDate() - 1));
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveFocus(new Date(focusedDate.getFullYear(), focusedDate.getMonth(), focusedDate.getDate() + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(new Date(focusedDate.getFullYear(), focusedDate.getMonth(), focusedDate.getDate() - 7));
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(new Date(focusedDate.getFullYear(), focusedDate.getMonth(), focusedDate.getDate() + 7));
        break;
      case 'PageUp':
        e.preventDefault();
        if (e.shiftKey) onViewDateChange(new Date(year - 1, month, 1));
        else onViewDateChange(new Date(year, month - 1, 1));
        break;
      case 'PageDown':
        e.preventDefault();
        if (e.shiftKey) onViewDateChange(new Date(year + 1, month, 1));
        else onViewDateChange(new Date(year, month + 1, 1));
        break;
      case 'Home':
        e.preventDefault();
        moveFocus(new Date(year, month, 1));
        break;
      case 'End':
        e.preventDefault();
        moveFocus(new Date(year, month + 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onSelectDay(focusedDate);
        break;
      case 'Escape':
        onEscape?.();
        break;
      default:
        break;
    }
  };

  if (view === 'months') {
    return (
      <div>
        <div style={CAL_HEADER}>
          <button type="button" style={CAL_NAV_BTN} onClick={() => onViewDateChange(new Date(year - 1, month, 1))} aria-label="Année précédente">
            <ChevronLeft style={mxIconBox('sm')} />
          </button>
          <button type="button" style={CAL_MONTH_BTN} onClick={() => setView('years')}>
            {year}
          </button>
          <button type="button" style={CAL_NAV_BTN} onClick={() => onViewDateChange(new Date(year + 1, month, 1))} aria-label="Année suivante">
            <ChevronRight style={mxIconBox('sm')} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--mx-space-8)', padding: 'var(--mx-space-16)' }}>
          {monthsShort.map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                onViewDateChange(new Date(year, i, 1));
                setView('days');
              }}
              style={{
                padding: 'var(--mx-space-8) var(--mx-space-12)',
                borderRadius: 'var(--mx-radius-6)',
                cursor: 'pointer',
                border: 'none',
                background: i === month ? 'var(--mx-accent)' : 'transparent',
                color: i === month ? '#fff' : 'var(--mx-text2)',
                ...MX_TEXT.fieldLabelStrong,
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'years') {
    const years = Array.from({ length: 12 }, (_, i) => yearPage + i);
    return (
      <div>
        <div style={CAL_HEADER}>
          <button type="button" style={CAL_NAV_BTN} onClick={() => setYearPage((p) => p - 12)} aria-label="Décennie précédente">
            <ChevronLeft style={mxIconBox('sm')} />
          </button>
          <span style={{ ...MX_TEXT.itemTitle, color: '#fff' }}>
            {yearPage} – {yearPage + 11}
          </span>
          <button type="button" style={CAL_NAV_BTN} onClick={() => setYearPage((p) => p + 12)} aria-label="Décennie suivante">
            <ChevronRight style={mxIconBox('sm')} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--mx-space-8)', padding: 'var(--mx-space-16)' }}>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => {
                onViewDateChange(new Date(y, month, 1));
                setView('months');
              }}
              style={{
                padding: 'var(--mx-space-8) var(--mx-space-12)',
                borderRadius: 'var(--mx-radius-6)',
                cursor: 'pointer',
                border: 'none',
                background: y === year ? 'var(--mx-accent)' : 'transparent',
                color: y === year ? '#fff' : 'var(--mx-text2)',
                ...MX_TEXT.fieldLabelStrong,
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const rangeHint =
    mode === 'range'
      ? rangeStart && !rangeEnd
        ? (locale === 'fr' ? '2ᵉ clic → date de fin' : '2nd click → end date')
        : (locale === 'fr' ? '1ᵉʳ clic → date de début' : '1st click → start date')
      : null;

  return (
    <div>
      <div style={CAL_HEADER}>
        <button type="button" style={CAL_NAV_BTN} onClick={() => onViewDateChange(new Date(year, month - 1, 1))} aria-label="Mois précédent">
          <ChevronLeft style={mxIconBox('sm')} />
        </button>
        <button type="button" style={CAL_MONTH_BTN} onClick={() => setView('months')}>
          {months[month]} {year}
        </button>
        <button type="button" style={CAL_NAV_BTN} onClick={() => onViewDateChange(new Date(year, month + 1, 1))} aria-label="Mois suivant">
          <ChevronRight style={mxIconBox('sm')} />
        </button>
      </div>
      {rangeHint ? (
        <div style={{ ...MX_TEXT.help, textAlign: 'center', padding: 'var(--mx-space-4) 0 0', color: 'var(--mx-text3)' }}>
          {rangeHint}
        </div>
      ) : null}
      <div style={{ padding: 'var(--mx-space-12)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 'var(--mx-space-4)' }}>
          {weekdays.map((d) => (
            <div key={d} style={{ ...MX_TEXT.badge, textAlign: 'center', color: 'var(--mx-text3)', padding: '3px 0' }}>
              {d}
            </div>
          ))}
        </div>
        <div
          role="grid"
          aria-label={locale === 'fr' ? 'Calendrier' : 'Calendar'}
          id={gridId}
          onKeyDown={handleGridKeyDown}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}
        >
          {cells.map(({ date, otherMonth }) => {
            const isToday = mxIsSameDay(date, today);
            const isSelected = mode === 'single' && mxIsSameDay(date, selected);
            const isRangeStart = mode === 'range' && mxIsSameDay(date, rangeStart);
            const isRangeEnd = mode === 'range' && mxIsSameDay(date, rangeEnd);
            const isRangeMid =
              mode === 'range' && rangeStart && rangeEnd && date.getTime() > rangeStart.getTime() && date.getTime() < rangeEnd.getTime();
            const isFocused = mxIsSameDay(date, focusedDate);
            const filled = isSelected || isRangeStart || isRangeEnd;
            return (
              <button
                key={date.toISOString()}
                ref={(node) => {
                  cellRefs.current[date.toDateString()] = node;
                }}
                type="button"
                role="gridcell"
                tabIndex={isFocused ? 0 : -1}
                aria-selected={filled}
                aria-current={isToday ? 'date' : undefined}
                onClick={() => {
                  setFocusedDate(date);
                  onSelectDay(date);
                }}
                onFocus={() => setFocusedDate(date)}
                style={{
                  ...GRID_CELL,
                  width: 'calc(30px * var(--mx-scale, 1))',
                  height: 'calc(30px * var(--mx-scale, 1))',
                  border: 'none',
                  borderRadius: isRangeMid ? 0 : 'var(--mx-radius-4)',
                  background: filled ? 'var(--mx-accent)' : isRangeMid ? 'var(--mx-accent-lt)' : 'transparent',
                  color: filled ? '#fff' : otherMonth ? 'var(--mx-text3)' : isRangeMid ? 'var(--mx-accent)' : 'var(--mx-text)',
                  fontWeight: isToday && !filled ? 700 : isSelected ? 700 : 500,
                  boxShadow: filled ? 'var(--mx-shadow)' : 'none',
                  outline: isFocused ? '2px solid var(--mx-accent)' : 'none',
                  outlineOffset: 1,
                }}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MxCalendarGrid;
