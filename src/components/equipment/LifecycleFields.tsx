import React from 'react';

import { LifecycleValue } from '../../lib/lifecycle';
import DateInput from '../common/DateInput';

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// Achat, garantie, amortissement et batterie d'un outil
const LifecycleFields: React.FC<{ value: LifecycleValue; onChange: (value: LifecycleValue) => void }> = ({ value, onChange }) => {
  const set = (change: Partial<LifecycleValue>) => onChange({ ...value, ...change });
  return (
    <fieldset className="md:col-span-2 rounded-md border border-gray-200 dark:border-gray-700 p-3 grid gap-3 sm:grid-cols-3">
      <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">Achat, garantie, amortissement</legend>
      <div>
        <label htmlFor="eq-bought" className={labelClass}>Date d'achat</label>
        <DateInput id="eq-bought" value={value.purchase_date} onChange={e => set({ purchase_date: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label htmlFor="eq-warranty" className={labelClass}>Garantie jusqu'au</label>
        <DateInput id="eq-warranty" value={value.warranty_until} min={value.purchase_date || undefined} onChange={e => set({ warranty_until: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label htmlFor="eq-years" className={labelClass}>Amorti sur (années)</label>
        <input id="eq-years" type="number" min={1} max={50} value={value.depreciation_years} onChange={e => set({ depreciation_years: e.target.value })} className={`${inputClass} font-mono`} placeholder="défaut" />
      </div>
      <label className="sm:col-span-3 flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
        <input type="checkbox" checked={value.is_battery} onChange={e => set({ is_battery: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
        Batterie : suivre l'âge et le nombre de sorties
      </label>
      {value.is_battery && (
        <>
          <div>
            <label htmlFor="eq-bat-months" className={labelClass}>Durée de vie (mois)</label>
            <input id="eq-bat-months" type="number" min={1} value={value.battery_life_months} onChange={e => set({ battery_life_months: e.target.value })} className={`${inputClass} font-mono`} placeholder="ex. 36" />
          </div>
          <div>
            <label htmlFor="eq-bat-uses" className={labelClass}>Nombre de sorties max.</label>
            <input id="eq-bat-uses" type="number" min={1} value={value.battery_max_uses} onChange={e => set({ battery_max_uses: e.target.value })} className={`${inputClass} font-mono`} placeholder="ex. 500" />
          </div>
        </>
      )}
    </fieldset>
  );
};

export default LifecycleFields;
