import React from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { containsDay, makePeriod, periodAround, PERIOD_PRESETS, shiftPeriod, type PeriodPreset, type ViewPeriod } from '../../lib/viewPeriod';
import Button from './Button';
import { DateRangeInput } from './DateInput';
import { MxSegmented } from '../mx/MxSegmented';
import MenuButton from './MenuButton';
import { formatDay } from '../../lib/zurichTime';

interface Props {
  value: ViewPeriod;
  today: string;
  onChange: (p: ViewPeriod) => void;
  // Préréglages proposés (tous par défaut)
  presets?: Exclude<PeriodPreset, 'custom'>[];
  // Complément à droite des boutons (ex. « Copier un jour »)
  children?: React.ReactNode;
  // Version allégée (Gantt PILOTE) : un menu « Échelle : 3 mois ▾ » (avec « Période libre… ») au lieu de la rangée de préréglages
  compact?: boolean;
}

// Choix de la période affichée par un Gantt ou une frise : 1 jour … 1 année, ou une période libre choisie avec un sélecteur de plage
const PeriodControls: React.FC<Props> = ({ value, today, onChange, presets, children, compact = false }) => {
  const anchor = containsDay(value, today) ? today : value.start;
  const options = PERIOD_PRESETS.filter(p => !presets || presets.includes(p.value));
  if (compact) {
    const presetLabel = value.preset === 'custom' ? 'Période libre' : options.find(o => o.value === value.preset)?.label ?? '';
    return (
      <div className="flex flex-wrap items-center gap-2">
        <MenuButton id="period-scale" menuLabel="Échelle de temps" prefix="Échelle :" value={presetLabel}
          groups={[{ id: 'presets', items: options.map(o => ({ id: o.value, label: o.label, checked: value.preset === o.value, onSelect: () => onChange(makePeriod(o.value, anchor)) })) }]}
          actions={[{ id: 'custom', label: 'Période libre…', onSelect: () => onChange({ preset: 'custom', start: value.start, end: value.end }) }]} />
        {value.preset === 'custom' && (
          <div className="w-72">
            <DateRangeInput start={value.start} end={value.end} placeholder="Choisir une période" onChange={(a, b) => { if (a && b) onChange({ preset: 'custom', start: a, end: b }); }} />
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" ariaLabel="Période précédente" icon={<ChevronLeft size={14} />} onClick={() => onChange(shiftPeriod(value, -1))} />
          <Button size="sm" variant="outline" onClick={() => onChange(periodAround(value, today))}>Aujourd'hui</Button>
          <Button size="sm" variant="outline" ariaLabel="Période suivante" icon={<ChevronRight size={14} />} onClick={() => onChange(shiftPeriod(value, 1))} />
        </div>
        <span className="hidden text-xs text-gray-500 dark:text-gray-400 2xl:inline">{`${formatDay(value.start)} → ${formatDay(value.end)}`}</span>
        {children}
      </div>
    );
  }
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
