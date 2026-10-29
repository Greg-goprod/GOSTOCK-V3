import React, { useState } from 'react';
import Button from './Button';
import { X } from 'lucide-react';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 shadow-xl">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Filtres</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les filtres"
            className="min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {options.map((option) => (
            <div key={option.id}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                {option.label}
              </label>
              {option.type === 'select' ? (
                <select
                  value={filters[option.id] || ''}
                  onChange={(e) => handleFilterChange(option.id, e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Tous</option>
                  {option.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={option.type}
                  value={filters[option.id] || ''}
                  onChange={(e) => handleFilterChange(option.id, e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={`Filtrer par ${option.label.toLowerCase()}`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset} fullWidth>
              Réinitialiser
            </Button>
            <Button variant="primary" onClick={handleApply} fullWidth>
              Appliquer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;