import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Warehouse } from 'lucide-react';
import { useCurrentDepot } from '../../lib/useCurrentDepot';

// Sélecteur de dépôt de la barre du haut : même rôle et même forme que le sélecteur d'événement de Mannyx
const DepotSwitcher: React.FC = () => {
  const { depotId, setDepotId, myDepots } = useCurrentDepot();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = myDepots.find(d => d.id === depotId);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  if (myDepots.length === 0) return null;
  const choose = (id: string) => { setDepotId(id); setOpen(false); };
  const option = (id: string, label: string) => (
    <li key={id || 'all'}>
      <button type="button" role="menuitemradio" aria-checked={depotId === id} onClick={() => choose(id)}
        className={`flex w-full items-center gap-2 rounded px-2 py-[calc(7px*var(--mx-scale,1))] text-left text-[length:calc(13px*var(--mx-scale,1))] ${
          depotId === id ? 'font-semibold text-primary-700 dark:text-primary-300' : 'text-gray-800 dark:text-gray-200'} hover:bg-gray-50 dark:hover:bg-gray-700/60`}>
        <span className="flex-1 truncate">{label}</span>
        {depotId === id && <Check size={14} aria-hidden="true" />}
      </button>
    </li>
  );

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-controls="depot-switcher-menu"
        className="flex items-center gap-2 rounded-[calc(8px*var(--mx-scale,1))] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-[calc(12px*var(--mx-scale,1))] py-[calc(7px*var(--mx-scale,1))] text-[length:calc(14px*var(--mx-scale,1))] text-gray-900 dark:text-white hover:border-primary-400">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600" aria-hidden="true" />
        <Warehouse size={14} aria-hidden="true" className="text-gray-500" />
        <span className="font-bold uppercase tracking-[0.01em]">{current ? current.name : 'Tous les dépôts'}</span>
        {!current && <span className="text-gray-500 dark:text-gray-400">{myDepots.length} dépôt(s)</span>}
        <ChevronDown size={14} aria-hidden="true" className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id="depot-switcher-menu" role="menu" aria-label="Choix du dépôt"
          className="absolute left-0 z-50 mt-1 min-w-[220px] rounded-[calc(6px*var(--mx-scale,1))] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,.08), 0 12px 32px rgba(0,0,0,.10)' }}>
          <p className="px-2 pb-1 pt-1.5 mx-section-label">Dépôt</p>
          <ul>
            {myDepots.length > 1 && option('', 'Tous les dépôts')}
            {myDepots.map(d => option(d.id, d.name))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DepotSwitcher;
