import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, PanelLeftClose, PanelLeftOpen, QrCode } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { BOTTOM_SPACES, NavSpace, locate } from '../../lib/navigation';
import { useNavSpaces } from '../../lib/useNavSpaces';
import { supabase } from '../../lib/supabase';

const PANEL_KEY = 'gomat-nav-panel';

// Navigation sur grand écran : rail des métiers + liste du métier choisi (repliable)
const Sidebar: React.FC = () => {
  const { alertCount } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const spaces = useNavSpaces();
  const current = locate(location.pathname).space?.id;
  const [spaceId, setSpaceId] = useState(current ?? spaces[0]?.id);
  const [panelOpen, setPanelOpen] = useState(() => {
    try { return localStorage.getItem(PANEL_KEY) !== 'closed'; } catch { return true; }
  });
  const [companyLogo, setCompanyLogo] = useState('');

  // La liste suit la page ouverte (lien direct, retour arrière, recherche Ctrl+K)
  useEffect(() => {
    if (current) setSpaceId(current);
  }, [current]);

  useEffect(() => {
    supabase.from('system_settings').select('value').eq('id', 'company_logo').maybeSingle()
      .then(({ data }) => { if (data?.value) setCompanyLogo(data.value); });
  }, []);

  const togglePanel = (open: boolean) => {
    setPanelOpen(open);
    try { localStorage.setItem(PANEL_KEY, open ? 'open' : 'closed'); } catch { /* stockage indisponible */ }
  };

  const chooseSpace = (id: string) => {
    const target = spaces.find(s => s.id === id);
    // Espace d'une seule page (Véhicules) : on y va directement
    if (target && target.links.length === 1) {
      navigate(target.links[0].to);
      return;
    }
    if (id === spaceId && panelOpen) return togglePanel(false);
    setSpaceId(id);
    togglePanel(true);
  };

  const space = spaces.find(s => s.id === spaceId) ?? spaces[0];
  const showPanel = panelOpen && space && space.links.length > 1;

  const railButton = (s: NavSpace) => {
    const active = s.id === current || (s.id === space?.id && showPanel);
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => chooseSpace(s.id)}
        aria-current={s.id === current ? 'true' : undefined}
        aria-label={s.label}
        title={s.label}
        className={`relative w-[68px] flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[10.5px] font-semibold leading-tight transition-colors ${
          active ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        <s.icon size={20} aria-hidden="true" />
        <span className="text-center">{s.short}</span>
        {s.id === 'home' && alertCount > 0 && (
          <span className="absolute top-1 right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-danger-600 text-white text-[10px] font-bold flex items-center justify-center" aria-label={`${alertCount} alerte(s)`}>
            {alertCount > 99 ? '99+' : alertCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="hidden lg:flex h-full shrink-0 print:hidden">
      {/* Rail des métiers */}
      <nav aria-label="Espaces" className="w-[80px] flex flex-col items-center gap-0.5 py-3 overflow-y-auto border-r-[1.5px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <NavLink to="/" aria-label="GO-Mat, accueil" className="mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-600 text-white">
          <QrCode size={22} aria-hidden="true" />
        </NavLink>
        {spaces.filter(s => !BOTTOM_SPACES.includes(s.id)).map(railButton)}
        <div className="flex-1" />
        {spaces.filter(s => BOTTOM_SPACES.includes(s.id)).map(railButton)}
        <button
          type="button"
          onClick={() => togglePanel(!panelOpen)}
          aria-label={panelOpen ? 'Replier la liste' : 'Déplier la liste'}
          title={panelOpen ? 'Replier la liste' : 'Déplier la liste'}
          className="flex h-10 w-10 items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {panelOpen ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}
        </button>
      </nav>

      {/* Pages de l'espace */}
      {showPanel && (
        <nav aria-label={space.label} className="w-[232px] flex flex-col border-r-[1.5px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="px-4 pt-5 pb-3">
            {companyLogo && <img src={companyLogo} alt="Logo de l'entreprise" className="max-h-8 max-w-[180px] object-contain mb-3" />}
            <p className="mx-section-label">GO-Mat</p>
            <h2 className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-gray-900 dark:text-white">{space.label}</h2>
          </div>
          <ul className="flex-1 overflow-y-auto px-2 pb-4 flex flex-col gap-0.5">
            {space.links.map(link => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.to === '/'}
                  target={link.newTab ? '_blank' : undefined}
                  rel={link.newTab ? 'noopener' : undefined}
                  className={({ isActive }) => `group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] transition-[background-color,color,transform] duration-150 ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-200 font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-primary-600'
                      : 'text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white hover:translate-x-0.5'
                  }`}
                >
                  <link.icon size={16} aria-hidden="true" />
                  <span className="flex-1 truncate">{link.label}</span>
                  {link.newTab && <ExternalLink size={13} aria-label="nouvel onglet" className="opacity-60" />}
                  {link.to === '/notifications' && alertCount > 0 && (
                    <span className="rounded-full bg-danger-600 px-1.5 text-[10.5px] font-bold text-white">{alertCount}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
};

export default Sidebar;
