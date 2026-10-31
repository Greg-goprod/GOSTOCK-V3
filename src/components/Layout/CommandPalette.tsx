import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search, type LucideIcon } from 'lucide-react';
import { useNavSpaces } from '../../lib/useNavSpaces';
import { canAccess } from '../../lib/access';
import { useAuth } from '../../contexts/AuthContext';

interface Entry {
  key: string;
  label: string;
  group: string;
  icon: LucideIcon;
  run: () => void;
}

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Ouverture depuis n'importe quel bouton (barre du haut) : window.dispatchEvent(new Event(OPEN_PALETTE))
export const OPEN_PALETTE = 'gomat:open-palette';

// Recherche rapide de la charte (⌘K / Ctrl+K) : aller à une page, ou chercher du matériel
const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const spaces = useNavSpaces();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(o => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const previous = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => previous?.focus?.();
  }, [open]);

  const close = () => setOpen(false);
  const go = (to: string) => {
    navigate(to);
    close();
  };

  const entries = useMemo<Entry[]>(() => {
    const pages: Entry[] = spaces.flatMap(space => space.links.map(link => ({
      key: link.to, label: link.label, group: space.label, icon: link.icon,
      run: link.newTab ? () => { window.open(link.to, '_blank', 'noopener'); close(); } : () => go(link.to),
    })));
    const q = normalize(query.trim());
    const found = q ? pages.filter(p => normalize(`${p.label} ${p.group}`).includes(q)) : pages;
    // Recherche dans le matériel, les personnes et les chantiers (page Recherche)
    if (q && canAccess('/recherche', can)) {
      found.push({
        key: 'search', label: `Chercher « ${query.trim()} »`, group: 'Matériel, personnes, chantiers', icon: Search,
        run: () => go(`/recherche?q=${encodeURIComponent(query.trim())}`),
      });
    }
    return found;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaces, query, can]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(i => Math.min(i + 1, entries.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(i => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      entries[active]?.run();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  let lastGroup = '';
  return createPortal(
    <div className="fixed inset-0 flex items-start justify-center px-4 pt-[12vh]" style={{ zIndex: 'var(--mx-z-modal)' as unknown as number }}>
      <div className="absolute inset-0" style={{ background: 'var(--mx-scrim-overlay)' }} onClick={close} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Recherche rapide"
        className="relative w-full max-w-[560px] overflow-hidden rounded-md border-[1.5px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
        onKeyDown={onKeyDown}>
        <div className="flex items-center gap-2 border-b-[1.5px] border-gray-200 dark:border-gray-700 px-4">
          <Search size={18} className="text-gray-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Aller à une page, chercher un outil…"
            aria-label="Aller à une page, chercher un outil"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={entries[active] ? `palette-${active}` : undefined}
            className="flex-1 border-0 bg-transparent py-4 text-[length:calc(15px*var(--mx-scale,1))] text-gray-900 dark:text-white focus:outline-none focus:ring-0"
            style={{ borderWidth: 0 }}
          />
          <kbd className="rounded-sm border border-gray-200 dark:border-gray-700 px-1.5 text-[length:calc(11px*var(--mx-scale,1))] text-gray-500">Échap</kbd>
        </div>
        <ul id="palette-results" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto py-2">
          {entries.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">Aucune page ne correspond.</li>}
          {entries.map((entry, index) => {
            const header = entry.group !== lastGroup ? entry.group : null;
            lastGroup = entry.group;
            return (
              <React.Fragment key={entry.key}>
                {header && <li role="presentation" className="mx-section-label px-4 pt-3 pb-1">{header}</li>}
                <li
                  id={`palette-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === active}
                  onMouseMove={() => setActive(index)}
                  onClick={entry.run}
                  className={`mx-2 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-[length:calc(13.5px*var(--mx-scale,1))] ${
                    index === active ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-200' : 'text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <entry.icon size={16} aria-hidden={true} />
                  <span className="flex-1 truncate">{entry.label}</span>
                  {index === active && <CornerDownLeft size={14} aria-hidden="true" className="opacity-60" />}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
};

export default CommandPalette;
