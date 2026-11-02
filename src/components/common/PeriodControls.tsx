import React from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { containsDay, makePeriod, periodAround, PERIOD_PRESETS, shiftPeriod, type PeriodPreset, type ViewPeriod } from '../../lib/viewPeriod';
import Button from './Button';
import { DateRangeInput } from './DateInput';
import { MxSegmented } from '../mx/MxSegmented';

interface Props {
  value: ViewPeriod;
  today: string;
  onChange: (p: ViewPeriod) => void;
  // Préréglages proposés (tous par défaut)
  presets?: Exclude<PeriodPreset, 'custom'>[];
  // Complément à droite des boutons (ex. « Copier un jour »)
  children?: React.ReactNode;
}

// Choix de la période affichée par un Gantt ou une frise : 1 jour … 1 année, ou une période libre choisie avec un sélecteur de plage
const PeriodControls: React.FC<Props> = ({ value, today, onChange, presets, children }) => {
  const anchor = containsDay(value, today) ? today : value.start;
  const options = PERIOD_PRESETS.filter(p => !presets || presets.includes(p.value));
  return (
    <div className="flex flex-wrap items-center gap-3">
      <MxSegmented aria-label="Période affichée" value={value.preset} onChange={v => onChange(makePeriod(v as Exclude<PeriodPreset, 'custom'>, anchor))} options={options} />
      <div className="w-72">
        <DateRangeInput start={value.start} end={value.end} placeholder="Choisir une période" onChange={(a, b) => { if (a && b) onChange({ preset: 'custom', start: a, end: b }); }} />
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" ariaLabel="Période précédente" icon={<ChevronLeft size={14} />} onClick={() => onChange(shiftPeriod(value, -1))} />
        <Button size="sm" variant="outline" icon={<CalendarCheck size={14} />} onClick={() => onChange(periodAround(value, today))}>Aujourd'hui</Button>
        <Button size="sm" variant="outline" ariaLabel="Période suivante" icon={<ChevronRight size={14} />} onClick={() => onChange(shiftPeriod(value, 1))} />
      </div>
      {children}
    </div>
  );
};

export default PeriodControls;
