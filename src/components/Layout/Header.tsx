import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Sun, Moon, LogOut, Contact, Download, Search, ChevronRight, QrCode } from 'lucide-react';
import { locate } from '../../lib/navigation';
import { OPEN_PALETTE } from './CommandPalette';
import { useInstallPrompt } from '../../lib/install';
import { useApp } from '../../contexts/AppContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_LABELS } from '../../lib/roles';
import LanguagePicker from '../common/LanguagePicker';

const Header: React.FC = () => {
  const location = useLocation();
  const { alertCount: unreadNotifications } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { profile, signOut } = useAuth();
  const { canInstall, install } = useInstallPrompt();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = profile ? `${profile.first_name[0] ?? ''}${profile.last_name[0] ?? ''}`.toUpperCase() : '?';

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);
  
  const place = locate(location.pathname);

  return (
    <header className="bg-white dark:bg-gray-800 border-b-[1.5px] border-gray-200 dark:border-gray-700 px-3 lg:px-5 py-2 flex items-center justify-between gap-3 print:hidden">
      {/* Fil d'Ariane : espace › page (sur téléphone, le nom de l'application puis la page) */}
      <nav aria-label="Fil d'Ariane" className="min-w-0 flex items-center gap-1.5 text-[13px]">
        <span className="lg:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-600 text-white"><QrCode size={18} aria-hidden="true" /></span>
        {place.space && <span className="hidden sm:inline text-gray-500 dark:text-gray-400 truncate">{place.space.label}</span>}
        {place.space && <ChevronRight size={14} aria-hidden="true" className="hidden sm:inline text-gray-400 shrink-0" />}
        <span className="font-semibold text-gray-900 dark:text-white truncate" aria-current="page">{place.title}</span>
      </nav>

      <div className="flex items-center gap-1 lg:gap-2 shrink-0">
        {/* Recherche rapide (Ctrl+K) : pages, outils, personnes, chantiers */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE))}
          aria-label="Recherche rapide (Ctrl+K)"
          className="min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-[240px] flex items-center gap-2 rounded-md lg:border-[1.5px] border-gray-200 dark:border-gray-700 lg:bg-gray-50 dark:lg:bg-gray-900 px-2.5 lg:py-1.5 text-[13px] text-gray-500 dark:text-gray-400 hover:border-primary-600 justify-center lg:justify-start"
        >
          <Search size={18} aria-hidden="true" />
          <span className="hidden lg:inline flex-1 text-left">Rechercher…</span>
          <kbd className="hidden lg:inline rounded-sm border border-gray-200 dark:border-gray-700 px-1 text-[11px]">Ctrl K</kbd>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          className="p-1.5 min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun size={18} className="text-gray-600 dark:text-gray-300" />
          ) : (
            <Moon size={18} className="text-gray-600 dark:text-gray-300" />
          )}
        </button>

        <Link to="/notifications" aria-label={unreadNotifications > 0 ? `Notifications : ${unreadNotifications} alerte(s)` : 'Notifications'}
          className="relative p-1.5 min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
          <Bell size={18} className="text-gray-600 dark:text-gray-300" aria-hidden="true" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1 lg:-top-1 lg:-right-1 bg-danger-600 text-white text-[10px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center font-bold">
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(open => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Compte de ${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`}
            className="min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 flex items-center justify-center"
          >
            <span className="h-8 w-8 lg:h-7 lg:w-7 rounded-full bg-primary-600 text-white flex items-center justify-center font-black text-xs">{initials}</span>
          </button>
          {menuOpen && profile && (
            <div role="menu" className="absolute right-0 mt-2 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-50 p-3 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{profile.first_name} {profile.last_name}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{profile.email}</p>
                <p className="mt-1 inline-block rounded-full bg-primary-100 dark:bg-primary-950 text-primary-800 dark:text-primary-200 px-2 py-0.5 text-xs font-semibold">
                  {ROLE_LABELS[profile.role]}
                </p>
              </div>
              <Link
                to="/badge"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="w-full inline-flex items-center gap-2 rounded-md px-2 py-2 min-h-[44px] text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Contact size={16} aria-hidden="true" /> Mon badge
              </Link>
              {canInstall && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); install(); }}
                  className="w-full inline-flex items-center gap-2 rounded-md px-2 py-2 min-h-[44px] text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Download size={16} aria-hidden="true" /> Installer l'application
                </button>
              )}
              <div className="px-2 py-2"><LanguagePicker /></div>
              <button
                type="button"
                role="menuitem"
                onClick={signOut}
                className="w-full inline-flex items-center gap-2 rounded-md px-2 py-2 min-h-[44px] text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <LogOut size={16} aria-hidden="true" /> Se déconnecter
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;