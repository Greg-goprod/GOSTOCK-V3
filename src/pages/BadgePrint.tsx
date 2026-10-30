import React, { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import BadgeCard from '../components/badges/BadgeCard';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { ROLE_LABELS } from '../lib/roles';
import { errorMessage } from '../lib/requests';

// Planche de badges : 10 cartes par feuille A4, à découper ou à glisser dans un porte-badge
const BadgePrint: React.FC = () => {
  const { users } = useApp();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [logo, setLogo] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('user_badges').select('user_id, code').then(({ data, error }) => {
      if (error) toast.error(errorMessage(error));
      setCodes(Object.fromEntries((data || []).map(b => [b.user_id, b.code])));
    });
    supabase.from('system_settings').select('value').eq('id', 'company_logo').maybeSingle()
      .then(({ data }) => setLogo(data?.value || ''));
  }, []);

  const active = useMemo(
    () => users.filter(u => u.active !== false)
      .filter(u => `${u.first_name} ${u.last_name} ${u.department ?? ''}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.last_name.localeCompare(b.last_name)),
    [users, search]
  );
  const toPrint = users.filter(u => selected.includes(u.id) && codes[u.id]);

  const toggle = (id: string) => setSelected(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));

  return (
    <div className="space-y-6">
      <div className="print:hidden space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="mx-page-title">Badges</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Cartes au format carte bancaire, 10 par feuille A4. Chacun retrouve aussi son badge sur son téléphone (« Mon badge »).</p>
          </div>
          <Button icon={<Printer size={16} />} onClick={() => window.print()} disabled={toPrint.length === 0}>
            Imprimer {toPrint.length > 0 ? `(${toPrint.length})` : ''}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une personne ou un service…"
            aria-label="Rechercher une personne"
            className="flex-1 min-w-[220px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
          />
          <Button size="sm" variant="outline" onClick={() => setSelected(active.map(u => u.id))}>Tout cocher</Button>
          <Button size="sm" variant="outline" onClick={() => setSelected([])}>Tout décocher</Button>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {active.map(u => (
            <li key={u.id}>
              <label className="flex items-center gap-3 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 cursor-pointer min-h-[44px]">
                <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{u.first_name} {u.last_name}</span>
                  <span className="block text-xs text-gray-600 dark:text-gray-400">{ROLE_LABELS[u.role]}{u.department ? ` · ${u.department}` : ''}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="hidden print:grid grid-cols-2 gap-[4mm] justify-center">
        {toPrint.map(u => (
          <div key={u.id} className="break-inside-avoid">
            <BadgeCard firstName={u.first_name} lastName={u.last_name} roleLabel={ROLE_LABELS[u.role]} department={u.department} code={codes[u.id]} logoUrl={logo || undefined} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default BadgePrint;
