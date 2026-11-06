import React, { useState } from 'react';
import Button from './Button';
import { MxDrawer } from '../mx/MxDrawer';
import DateInput from './DateInput';

export interface FilterOption {
  id: string;
  label: string;
  type: 'select' | 'text' | 'date';
  options?: { value: string; label: string }[];
}

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  options: FilterOption[];
  onApplyFilters: (filters: Record<string, string>) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  isOpen,
  onClose,
  options,
  onApplyFilters,
}) => {
  const [filters, setFilters] = useState<Record<string, string>>({});

  const handleFilterChange = (id: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters({});
    onApplyFilters({});
    onClose();
  };

  // Panneau de filtres de la charte Mannyx : drawer ancré à gauche, pied fixe
  return (
    <MxDrawer
      open={isOpen}
      onClose={onClose}
      title="Filtres"
      side="left"
      size="sm"
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="outline" onClick={handleReset} fullWidth>
            Réinitialiser
          </Button>
          <Button variant="primary" onClick={handleApply} fullWidth>
            Appliquer
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {options.map((option) => (
          <div key={option.id}>
            <label htmlFor={`filter-${option.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              {option.label}
            </label>
            {option.type === 'select' ? (
              <select
                id={`filter-${option.id}`}
                value={filters[option.id] || ''}
                onChange={(e) => handleFilterChange(option.id, e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
              >
                <option value="">Tous</option>
                {option.options?.map((opt, index) => (
                  <option key={`${opt.value}-${index}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : option.type === 'date' ? (
              <DateInput
                id={`filter-${option.id}`}
                value={filters[option.id] || ''}
                onChange={(e) => handleFilterChange(option.id, e.target.value)}
              />
            ) : (
              <input
                id={`filter-${option.id}`}
                type="text"
                value={filters[option.id] || ''}
                onChange={(e) => handleFilterChange(option.id, e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                placeholder={`Filtrer par ${option.label.toLowerCase()}`}
              />
            )}
          </div>
        ))}
      </div>
    </MxDrawer>
  );
};

export default FilterPanel;