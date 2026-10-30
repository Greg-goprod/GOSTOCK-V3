import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Sun, Moon, ScanLine, LogOut, Contact, Download } from 'lucide-react';
import { useInstallPrompt } from '../../lib/install';
import { useApp } from '../../contexts/AppContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_LABELS } from '../../lib/roles';

const Header: React.FC = () => {
  const location = useLocation();
  const { alertCount: unreadNotifications } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { profile, can, signOut } = useAuth();
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
  
  const getPageTitle = () => {
    const path = location.pathname;
    
    if (path === '/') return "AUJOURD'HUI";
    if (path.startsWith('/tableau-de-bord')) return 'STATISTIQUES';
    if (path.startsWith('/equipment')) return 'OUTILS';
    if (path.startsWith('/users')) return 'PERSONNES';
    if (path.startsWith('/checkouts')) return 'SORTIES';
    if (path.startsWith('/notifications')) return 'NOTIFICATIONS';
    if (path.startsWith('/settings')) return 'PARAMÈTRES';
    if (path.startsWith('/scan')) return 'SCANNER';
    if (path.startsWith('/consommables')) return 'CONSOMMABLES';
    if (path === '/commande') return 'À COMMANDER';
    if (path.startsWith('/demandes')) return 'DEMANDES';
    if (path.startsWith('/vehicules')) return 'VÉHICULES';
    if (path.startsWith('/comptoir')) return 'COMPTOIR';
    if (path.startsWith('/badges')) return 'BADGES';
    if (path.startsWith('/badge')) return 'MON BADGE';
    if (path.startsWith('/etiquettes')) return 'ÉTIQUETTES';
    if (path.startsWith('/entretien')) return 'ENTRETIEN';
    if (path.startsWith('/inventaire')) return 'INVENTAIRE';
    if (path.startsWith('/commandes')) return 'COMMANDES';
    if (path.startsWith('/couts')) return 'COÛTS';
    if (path.startsWith('/pilotage')) return 'PILOTAGE';
    if (path.startsWith('/journal')) return 'JOURNAL';
    if (path.startsWith('/incidents')) return 'PERTES ET CASSE';
    if (path.startsWith('/chantiers')) return 'CHANTIERS';
    if (path.startsWith('/kits')) return 'KITS';
    if (path.startsWith('/formations')) return 'FORMATIONS';
    if (path.startsWith('/locations')) return 'LOCATIONS';
    if (path.startsWith('/transferts')) return 'TRANSFERTS';
    if (path.startsWith('/emplacements')) return 'EMPLACEMENTS';
    if (path.startsWith('/planning')) return 'PLANNING';
    if (path.startsWith('/epi')) return 'EPI';
    
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
        {can('scan') && <Link
          to="/scan"
          aria-label="Scanner un QR code"
          className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-primary-600 dark:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ScanLine size={22} />
        </Link>}

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