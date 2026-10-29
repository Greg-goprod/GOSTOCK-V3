import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Sun, Moon, ScanLine } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

const Header: React.FC = () => {
  const location = useLocation();
  const { alertCount: unreadNotifications } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  
  const getPageTitle = () => {
    const path = location.pathname;
    
    if (path === '/') return 'TABLEAU DE BORD';
    if (path.startsWith('/equipment')) return 'MATÉRIEL';
    if (path.startsWith('/users')) return 'UTILISATEURS';
    if (path.startsWith('/checkouts')) return 'SORTIE MATÉRIEL';
    if (path.startsWith('/notifications')) return 'NOTIFICATIONS';
    if (path.startsWith('/settings')) return 'PARAMÈTRES';
    if (path.startsWith('/scan')) return 'SCANNER';
    if (path.startsWith('/consommables')) return 'CONSOMMABLES';
    if (path.startsWith('/commande')) return 'COMMANDE';
    if (path.startsWith('/demandes')) return 'DEMANDES';
    if (path.startsWith('/vehicules')) return 'VÉHICULES';
    
    return 'GO-MAT';
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm px-3 py-2 flex items-center justify-between print:hidden">
      <div className="lg:hidden w-11 shrink-0"></div>
      <h1 className="text-lg font-black text-gray-800 dark:text-white tracking-tight uppercase truncate">
        {getPageTitle()}
      </h1>
      
      <div className="flex items-center gap-1 lg:gap-3 shrink-0">
        {/* Raccourci vers le scan, l'écran principal sur le terrain */}
        <Link
          to="/scan"
          aria-label="Scanner un QR code"
          className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-primary-600 dark:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ScanLine size={22} />
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          className="p-1.5 min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun size={18} className="text-gray-600 dark:text-gray-300" />
          ) : (
            <Moon size={18} className="text-gray-600 dark:text-gray-300" />
          )}
        </button>

        <div className="relative hidden lg:block">
          <Bell size={18} className="text-gray-600 dark:text-gray-300 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors" />
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 bg-danger-500 text-white text-xs rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
              {unreadNotifications}
            </span>
          )}
        </div>
        
        <div className="hidden sm:flex h-7 w-7 rounded-full bg-primary-600 text-white items-center justify-center" aria-hidden="true">
          <span className="font-black text-xs">GM</span>
        </div>
      </div>
    </header>
  );
};

export default Header;