import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/requests';

interface Row {
  id: string;
  name: string;
  unit: string | null;
  self_service: boolean;
  self_service_max: number | null;
}

// Consommables que chacun peut prendre seul avec son téléphone, et quantité maximale par prise
const SelfServiceModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('equipment').select('id, name, unit, self_service, self_service_max').eq('item_type', 'consumable').order('name')
      .then(({ data, error }) => {
        if (error) toast.error(errorMessage(error));
        setRows(((data || []) as Row[]).map(r => ({ ...r, self_service_max: r.self_service_max === null ? null : Number(r.self_service_max) })));
      });
  }, []);

  const update = async (row: Row, changes: Partial<Row>) => {
    const { error } = await supabase.from('equipment').update(changes).eq('id', row.id);
    if (error) return toast.error(errorMessage(error));
    setRows(list => list.map(r => (r.id === row.id ? { ...r, ...changes } : r)));
  };

  const shown = rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal isOpen onClose={onClose} title="Libre-service" size="lg">
      <div className="space-y-3">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Les articles cochés peuvent être pris par chacun avec son téléphone (menu « Libre-service ») : la sortie est à son nom et sur son chantier.
        </p>
        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher un consommable"
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" />
        <ul className="max-h-[55vh] overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
          {shown.map(r => (
            <li key={r.id} className="py-2 flex flex-wrap items-center gap-3 text-sm">
              <label className="flex flex-1 min-w-[12rem] items-center gap-2 text-gray-900 dark:text-gray-100">
                <input type="checkbox" checked={r.self_service} onChange={e => update(r, { self_service: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
                {r.name}
              </label>
              {r.self_service && (
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  max. par prise
                  <input type="number" min={1} defaultValue={r.self_service_max ?? ''} placeholder="∞"
                    onBlur={e => update(r, { self_service_max: e.target.value ? Number(e.target.value) : null })}
                    className="w-20 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 font-mono text-gray-900 dark:text-gray-100" />
                  {r.unit}
                </label>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
};

export default SelfServiceModal;
