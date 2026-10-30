import React from 'react';
import toast from 'react-hot-toast';
import { MxDatePicker } from '../mx/MxDatePicker';
import { MxTimePicker } from '../mx/MxTimePicker';
import { MxDateTimePicker } from '../mx/MxDateTimePicker';

// Sélecteurs de date et d'heure de la charte Mannyx, avec la même interface qu'un <input> :
// valeur texte (« AAAA-MM-JJ », « HH:MM », « AAAA-MM-JJTHH:MM ») et onChange(event) avec event.target.value.

interface FieldProps {
  id?: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toLocal = (d: Date) => `${toDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
// « AAAA-MM-JJ » lu en date locale (new Date('AAAA-MM-JJ') serait minuit UTC)
const fromDay = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
const fromLocal = (value: string) => {
  const [day, time = '00:00'] = value.split('T');
  const date = fromDay(day);
  if (!date) return null;
  const [h, min] = time.split(':').map(Number);
  date.setHours(h || 0, min || 0, 0, 0);
  return date;
};

const emit = (onChange: FieldProps['onChange'], value: string) =>
  onChange({ target: { value }, currentTarget: { value } } as unknown as React.ChangeEvent<HTMLInputElement>);

const shortDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-CH');

// Bornes min / max comme sur un champ natif : une date hors limites est refusée avec un message
const outOfRange = (value: string, min?: string, max?: string) => {
  if (min && value < min) {
    toast.error(`Choisissez une date à partir du ${shortDate(min)}`);
    return true;
  }
  if (max && value > max) {
    toast.error(`Choisissez une date jusqu'au ${shortDate(max)}`);
    return true;
  }
  return false;
};

// Champ caché qui porte « required » et l'id du label : le formulaire refuse l'envoi si la date manque.
// Le navigateur ne peut pas afficher sa bulle sur un champ caché : on montre le message sous le sélecteur.
const Anchor: React.FC<{ id?: string; value: string; required?: boolean }> = ({ id, value, required }) => {
  const [missing, setMissing] = React.useState(false);
  React.useEffect(() => {
    if (value) setMissing(false);
  }, [value]);
  return (
    <>
      <input id={id} tabIndex={-1} aria-hidden="true" value={value} required={required} onChange={() => {}}
        onInvalid={event => {
          event.preventDefault();
          setMissing(true);
          event.currentTarget.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }}
        className="sr-only" style={{ pointerEvents: 'none' }} />
      {missing && (
        <p role="alert" className="mt-1 text-[12.5px] font-medium text-tone-danger">Ce champ est obligatoire.</p>
      )}
    </>
  );
};

const DateInput: React.FC<FieldProps> = ({ id, value, onChange, min, max, required, disabled, className, 'aria-label': ariaLabel }) => (
  <div className={`relative ${className?.includes('w-auto') ? '' : 'w-full'}`}>
    <MxDatePicker
      value={value ? fromDay(value) : null}
      onChange={date => {
        const next = date ? toDay(date) : '';
        if (next && outOfRange(next, min, max)) return;
        emit(onChange, next);
      }}
      label={ariaLabel}
      hideLabel
      disabled={disabled}
    />
    <Anchor id={id} value={value} required={required} />
  </div>
);

export const TimeInput: React.FC<FieldProps> = ({ id, value, onChange, required, disabled, 'aria-label': ariaLabel }) => (
  <div className="relative w-full">
    <MxTimePicker value={value || null} onChange={time => emit(onChange, time ?? '')} label={ariaLabel} hideLabel disabled={disabled} />
    <Anchor id={id} value={value} required={required} />
  </div>
);

export const DateTimeInput: React.FC<FieldProps> = ({ id, value, onChange, min, max, required, disabled, 'aria-label': ariaLabel }) => (
  <div className="relative w-full">
    <MxDateTimePicker
      value={value ? fromLocal(value) : null}
      onChange={date => {
        const next = date ? toLocal(date) : '';
        if (next && outOfRange(next, min, max)) return;
        emit(onChange, next);
      }}
      label={ariaLabel}
      disabled={disabled}
    />
    <Anchor id={id} value={value} required={required} />
  </div>
);

export default DateInput;
