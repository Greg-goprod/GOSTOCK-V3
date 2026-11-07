import React, { useState } from 'react';
import { Keyboard } from 'lucide-react';
import Modal from '../common/Modal';
import { usePiloteShortcuts } from './usePiloteShortcuts';

interface Row { keys: string; what: string }
// Bouton « Raccourcis » (et touche « ? ») : liste des raccourcis disponibles dans la vue
const ShortcutsHelp: React.FC<{ rows: Row[] }> = ({ rows }) => {
  const [open, setOpen] = useState(false);
  usePiloteShortcuts({ '?': () => setOpen(true) });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Raccourcis clavier" title="Raccourcis clavier (?)"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 lg:min-h-[28px] lg:min-w-[28px]">
        <Keyboard size={14} aria-hidden />
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Raccourcis clavier">
        <ul className="divide-y divide-gray-200 text-sm dark:divide-gray-700">
          {[...rows, { keys: '?', what: 'Afficher cette aide' }].map(r => (
            <li key={r.keys} className="flex items-center justify-between gap-4 py-2">
              <span className="text-gray-800 dark:text-gray-200">{r.what}</span>
              <kbd className="rounded border border-gray-300 bg-gray-50 px-2 py-0.5 font-mono text-xs dark:border-gray-600 dark:bg-gray-800">{r.keys}</kbd>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">Les raccourcis n'agissent pas pendant une saisie ni quand une fiche est ouverte.</p>
      </Modal>
    </>
  );
};

export default ShortcutsHelp;
