import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Sun, Moon, Search, QrCode, HelpCircle } from 'lucide-react';
import { OPEN_HELP } from '../help/HelpDrawer';
import { locate } from '../../lib/navigation';
import { OPEN_PALETTE } from './CommandPalette';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { canAccess } from '../../lib/access';
import { useTheme } from '../../contexts/ThemeContext';
import DepotSwitcher from './DepotSwitcher';
import UserMenu from './UserMenu';

const Header: React.FC = () => {
  const location = useLocation();
  const { alertCount: unreadNotifications } = useApp();
  const { can } = useAuth();
  // Le collaborateur n'a pas accès à la page Notifications : ses avis (demande validée, refusée,
  // prête) et son matériel à rendre sont dans Shop › Mes commandes
  const bellTarget = canAccess('/notifications', can) ? '/notifications' : '/shop?vue=commandes';
  const { theme, toggleTheme } = useTheme();
  const place = locate(location.pathname);
  const iconButton = 'p-1.5 min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 lg:h-[calc(32px*var(--mx-scale,1))] lg:w-[calc(32px*var(--mx-scale,1))] flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors';

  return (
    <header className="relative z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 lg:px-[calc(20px*var(--mx-scale,1))] py-2 lg:py-0 lg:h-[calc(56px*var(--mx-scale,1))] flex items-center justify-between gap-3 print:hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
      {/* Grand écran : sélecteur de dépôt (comme le sélecteur d'événement de Mannyx) ; téléphone : logo et page */}
      <div className="hidden lg:block"><DepotSwitcher /></div>
      <div className="lg:hidden min-w-0 flex items-center gap-1.5 text-[13px]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-600 text-white"><QrCode size={18} aria-hidden="true" /></span>
        <span className="font-semibold text-gray-900 dark:text-white truncate" aria-current="page">{place.title}</span>
      </div>

      <div className="flex items-center gap-1 lg:gap-1.5 shrink-0">
        {/* Recherche rapide (Ctrl+K) : pages, outils, personnes, chantiers */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE))}
          aria-label="Recherche rapide (Ctrl+K)"
          className="min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-[calc(240px*var(--mx-scale,1))] flex items-center gap-2 rounded-md lg:border border-gray-200 dark:border-gray-700 lg:bg-gray-50 dark:lg:bg-gray-900 px-2.5 lg:py-[calc(6px*var(--mx-scale,1))] text-[length:calc(13px*var(--mx-scale,1))] text-gray-500 dark:text-gray-400 hover:border-primary-600 justify-center lg:justify-start"
        >
          <Search size={16} aria-hidden="true" />
          <span className="hidden lg:inline flex-1 text-left">Rechercher…</span>
          <kbd className="hidden lg:inline rounded-sm border border-gray-200 dark:border-gray-700 px-1 text-[length:calc(11px*var(--mx-scale,1))]">Ctrl K</kbd>
        </button>

        {/* Aide de la page en cours */}
        <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_HELP))} aria-label="Aide de cette page" title="Aide de cette page" className={iconButton}>
          <HelpCircle size={17} className="text-gray-600 dark:text-gray-300" aria-hidden="true" />
        </button>

        <Link to={bellTarget} aria-label={unreadNotifications > 0 ? `Notifications : ${unreadNotifications} alerte(s)` : 'Notifications'} className={`relative ${iconButton}`}>
          <Bell size={17} className="text-gray-600 dark:text-gray-300" aria-hidden="true" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1 lg:-top-1 lg:-right-1 bg-primary-600 text-white text-[10px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center font-bold">
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </Link>

        <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'} className={iconButton}>
          {theme === 'dark' ? <Sun size={17} className="text-gray-600 dark:text-gray-300" /> : <Moon size={17} className="text-gray-600 dark:text-gray-300" />}
        </button>

        {/* Sur téléphone, le compte reste en haut à droite (le menu latéral n'existe pas) */}
        <div className="lg:hidden"><UserMenu variant="compact" /></div>
      </div>
    </header>
  );
};

export default Header;
