import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/requests';

// Accessoires à proposer au comptoir avec cet outil (chargeur, batteries, coffret…)
const AccessoryLinks: React.FC<{ equipmentId: string }> = ({ equipmentId }) => {
  const { equipment } = useApp();
  const [linked, setLinked] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('equipment_accessories').select('accessory_id').eq('equipment_id', equipmentId)
      .then(({ data }) => setLinked((data || []).map(r => r.accessory_id)));
  }, [equipmentId]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return equipment.filter(e => e.id !== equipmentId && !linked.includes(e.id) && `${e.name} ${e.articleNumber ?? ''}`.toLowerCase().includes(q)).slice(0, 6);
  }, [search, equipment, linked, equipmentId]);

  const add = async (id: string) => {
    const { error } = await supabase.from('equipment_accessories').insert({ equipment_id: equipmentId, accessory_id: id });
    if (error) return toast.error(errorMessage(error));
    setLinked(l => [...l, id]);
    setSearch('');
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('equipment_accessories').delete().eq('equipment_id', equipmentId).eq('accessory_id', id);
    if (error) return toast.error(errorMessage(error));
    setLinked(l => l.filter(x => x !== id));
  };

  return (
    <div className="md:col-span-2">
      <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Accessoires à proposer au comptoir</p>
      <div className="flex flex-wrap gap-2 mb-2">
        {linked.length === 0 && <span className="text-xs text-gray-600 dark:text-gray-400">Aucun (ex. chargeur, batteries).</span>}
        {linked.map(id => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-primary-100 dark:bg-primary-900/50 px-3 py-1 text-xs text-primary-800 dark:text-primary-200">
            {equipment.find(e => e.id === id)?.name ?? 'Article'}
            <button type="button" onClick={() => remove(id)} aria-label="Retirer l'accessoire"><X size={12} /></button>
          </span>
        ))}
      </div>
      <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ajouter un accessoire…" aria-label="Ajouter un accessoire"
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" />
      {candidates.length > 0 && (
        <ul className="mt-1 rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
          {candidates.map(e => (
            <li key={e.id}>
              <button type="button" onClick={() => add(e.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100">{e.name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AccessoryLinks;
