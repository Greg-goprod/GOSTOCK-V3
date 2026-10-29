import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  CalendarClock, 
  Bell, 
  Settings, 
  Menu, 
  X,
  QrCode,
  ScanLine,
  Droplets,
  ClipboardList,
  Inbox,
  Truck,
  BarChart3
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';

// Menu groupé par usage : le quotidien du magasin d'abord
const NAV_SECTIONS = [
  { title: 'Au quotidien', links: [
    { to: '/', label: "Aujourd'hui", icon: LayoutDashboard },
    { to: '/demandes', label: 'Demandes', icon: Inbox },
    { to: '/scan', label: 'Scanner', icon: ScanLine },
    { to: '/checkouts', label: 'Sorties', icon: CalendarClock },
  ] },
  { title: 'Stock', links: [
    { to: '/equipment', label: 'Outils', icon: Package },
    { to: '/consommables', label: 'Consommables', icon: Droplets },
    { to: '/commande', label: 'Commande', icon: ClipboardList },
  ] },
  { title: 'Flotte', links: [
    { to: '/vehicules', label: 'Véhicules', icon: Truck },
  ] },
  { title: 'Suivi', links: [
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/tableau-de-bord', label: 'Statistiques', icon: BarChart3 },
  ] },
  { title: 'Réglages', links: [
    { to: '/users', label: 'Personnes', icon: Users },
    { to: '/settings', label: 'Paramètres', icon: Settings },
  ] },
];

const Sidebar: React.FC = () => {
  const { alertCount: unreadNotifications } = useApp();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [companyLogo, setCompanyLogo] = useState('');

  useEffect(() => {
    fetchCompanyLogo();
  }, []);

  const fetchCompanyLogo = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('id', 'company_logo')
        .maybeSingle();

      if (data?.value) {
        setCompanyLogo(data.value);
      }
    } catch (error) {
      // Logo not found, use default
      console.log('No company logo found');
    }
  };
  
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-3 lg:py-2 rounded-lg transition-colors text-sm lg:text-xs tracking-wide ${
      isActive 
        ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-200 font-bold' 
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium'
    }`;

  return (
    <>
      <button
        type="button"
        className="lg:hidden print:hidden fixed top-2 left-2 z-50 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md bg-white dark:bg-gray-800 shadow-md"
        onClick={toggleSidebar}
        aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={18} className="dark:text-white" /> : <Menu size={18} className="dark:text-white" />}
      </button>
      
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <aside 
        className={`print:hidden fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 shadow-md z-40 transition-transform transform lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center gap-2">
            {companyLogo && (
              <img
                src={companyLogo}
                alt="Logo de l'entreprise"
                className="max-h-10 max-w-40 object-contain"
              />
            )}
            <div className="flex items-center gap-1.5 font-black text-primary-700 dark:text-primary-300 text-xl tracking-tight">
              <QrCode size={22} />
              <span>GO-Mat</span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center font-light tracking-wide uppercase">
              Gestion de Matériel
            </p>
          </div>
        </div>
        
        <nav className="py-3 px-2 flex flex-col gap-3 overflow-y-auto max-h-[calc(100%-6rem)]" aria-label="Menu principal">
          {NAV_SECTIONS.map(section => (
            <div key={section.title} className="flex flex-col gap-1">
              <p className="px-3 text-[0.7rem] lg:text-[0.65rem] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">{section.title}</p>
              {section.links.map(link => (
                <NavLink key={link.to} to={link.to} end={link.to === '/'} className={navLinkClass} onClick={() => setIsOpen(false)}>
                  {link.to === '/notifications' ? (
                    <div className="relative">
                      <link.icon size={16} />
                      {unreadNotifications > 0 && (
                        <span className="absolute -top-1 -right-1 bg-danger-500 text-white text-[8px] rounded-full w-3 h-3 flex items-center justify-center font-bold" aria-label={`${unreadNotifications} alerte(s)`}>
                          {unreadNotifications}
                        </span>
                      )}
                    </div>
                  ) : (
                    <link.icon size={16} />
                  )}
                  <span className="uppercase tracking-wider font-bold">{link.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;