import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface TrainingSelectProps {
  id: string;
  value: string;
  onChange: (trainingId: string) => void;
}

// Formation exigée pour sortir un article (nacelle, chariot élévateur…)
const TrainingSelect: React.FC<TrainingSelectProps> = ({ id, value, onChange }) => {
  const [trainings, setTrainings] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from('trainings').select('id, name').order('name').then(({ data }) => setTrainings(data || []));
  }, []);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Formation obligatoire</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
        <option value="">Aucune</option>
        {trainings.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        Sortie refusée sans formation valable{trainings.length === 0 ? ' (créez les formations dans « Formations »)' : ''}
      </p>
    </div>
  );
};

export default TrainingSelect;
