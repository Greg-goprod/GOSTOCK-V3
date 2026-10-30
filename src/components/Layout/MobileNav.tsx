import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { MxDrawer } from '../mx/MxDrawer';
import { useApp } from '../../contexts/AppContext';
import { MOBILE_SHORTCUTS, locate } from '../../lib/navigation';
import { useNavSpaces } from '../../lib/useNavSpaces';

// Téléphone et tablette : barre du bas (4 raccourcis + « Plus ») ; « Plus » ouvre tous les espaces dans un drawer
const MobileNav: React.FC = () => {
  const { alertCount } = useApp();
  const location = useLocation();
  const spaces = useNavSpaces();
  const [open, setOpen] = useState(false);
  const links = spaces.flatMap(s => s.links);
  const shortcuts = MOBILE_SHORTCUTS.map(to => links.find(l => l.to === to)).filter(Boolean).slice(0, 4) as typeof links;
  const inShortcuts = shortcuts.some(l => l.to === locate(location.pathname).link?.to);

  const item = 'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px] font-semibold';
  return (
    <>
      <nav aria-label="Raccourcis" className="lg:hidden print:hidden fixed bottom-0 inset-x-0 z-40 flex border-t-[1.5px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pb-[env(safe-area-inset-bottom)]">
        {shortcuts.map(link => (
          <NavLink key={link.to} to={link.to} end={link.to === '/'}
            className={({ isActive }) => `${item} ${isActive ? 'text-primary-600 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'}`}>
            <link.icon size={22} aria-hidden="true" />
            <span>{link.label}</span>
          </NavLink>
        ))}
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
          className={`${item} relative ${!inShortcuts ? 'text-primary-600 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'}`}>
          <LayoutGrid size={22} aria-hidden="true" />
          <span>Plus</span>
          {alertCount > 0 && <span className="absolute top-1.5 right-[calc(50%-20px)] h-2.5 w-2.5 rounded-full bg-danger-600" aria-label={`${alertCount} alerte(s)`} />}
        </button>
      </nav>

      <MxDrawer open={open} onClose={() => setOpen(false)} title="Menu" side="left" size="sm">
        <div className="flex flex-col gap-5">
          {spaces.map(space => (
            <section key={space.id}>
              <h3 className="mx-section-label mb-1.5 flex items-center gap-1.5"><space.icon size={13} aria-hidden="true" />{space.label}</h3>
              <ul className="grid grid-cols-2 gap-1.5">
                {space.links.map(link => (
                  <li key={link.to}>
                    <NavLink to={link.to} end={link.to === '/'} onClick={() => setOpen(false)}
                      target={link.newTab ? '_blank' : undefined} rel={link.newTab ? 'noopener' : undefined}
                      className={({ isActive }) => `flex items-center gap-2 rounded-md border-[1.5px] px-2.5 py-2.5 text-[13px] font-medium ${
                        isActive ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-200' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                      }`}>
                      <link.icon size={16} aria-hidden="true" />
                      <span className="truncate">{link.label}</span>
                      {link.to === '/notifications' && alertCount > 0 && <span className="ml-auto rounded-full bg-danger-600 px-1.5 text-[10px] font-bold text-white">{alertCount}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </MxDrawer>
    </>
  );
};

export default MobileNav;
