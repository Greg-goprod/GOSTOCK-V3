import React from 'react';

interface FuelInputProps {
  value: number;              // en huitièmes (0 à 8)
  onChange?: (value: number) => void;
  label?: string;
}

const FUEL_LABELS = ['Vide', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8', 'Plein'];

const fuelLabel = (value: number) => FUEL_LABELS[Math.max(0, Math.min(8, value))];

// Jauge de carburant en huit segments ; cliquable quand onChange est fourni
const FuelInput: React.FC<FuelInputProps> = ({ value, onChange, label = 'Carburant' }) => {
  const readOnly = !onChange;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{fuelLabel(value)}</span>
      </div>
      <div className="grid grid-cols-8 gap-1" role={readOnly ? undefined : 'radiogroup'} aria-label={label}>
        {Array.from({ length: 8 }, (_, i) => {
          const level = i + 1;
          const filled = level <= value;
          const segment = (
            <span
              className={`block h-3 rounded-sm ${filled ? (value <= 2 ? 'bg-danger-500' : 'bg-success-500') : 'bg-gray-200 dark:bg-gray-700'}`}
            />
          );
          return readOnly ? (
            <span key={level}>{segment}</span>
          ) : (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={value === level}
              aria-label={fuelLabel(level)}
              // Toucher le segment déjà plein le plus haut le vide (permet d'aller à 0)
              onClick={() => onChange(value === level ? level - 1 : level)}
              className="py-3 lg:py-1"
            >
              {segment}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FuelInput;
