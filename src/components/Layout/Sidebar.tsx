import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, QrCode } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { BOTTOM_SPACES, NavSpace, locate } from '../../lib/navigation';
import { useNavSpaces } from '../../lib/useNavSpaces';
import { supabase } from '../../lib/supabase';
import UserMenu from './UserMenu';

const COLLAPSED_KEY = 'gomat-sidebar-collapsed';
const LAST_PAGE_KEY = 'gomat-last-page';

// Dernière page ouverte de chaque module : y revenir quand on clique sur le module
const lastPages = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(LAST_PAGE_KEY) ?? '{}'); } catch { return {}; }
};

// Menu sur grand écran, comme Mannyx : une seule colonne (180px, 58px repliée), un module par entrée
// en majuscules, Réglages et Aide en bas, puis le compte. Les pages d'un module sont des onglets dans la page.
const Sidebar: React.FC = () => {
  const { alertCount } = useApp();
  const { pathname } = useLocation();
  const spaces = useNavSpaces();
  const current = locate(pathname).space?.id;
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  const [companyLogo, setCompanyLogo] = useState('');

  useEffect(() => {
    supabase.from('system_settings').select('value').eq('id', 'company_logo').maybeSingle()
      .then(({ data }) => { if (data?.value) setCompanyLogo(data.value); });
  }, []);

  // Mémorise la page ouverte dans son module
  useEffect(() => {
    if (!current) return;
    try { localStorage.setItem(LAST_PAGE_KEY, JSON.stringify({ ...lastPages(), [current]: pathname })); } catch { /* stockage indisponible */ }
  }, [current, pathname]);

  const toggle = () => {
    setCollapsed(c => {
      try { localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1'); } catch { /* stockage indisponible */ }
      return !c;
    });
  };

  const entry = (s: NavSpace) => {
    const remembered = lastPages()[s.id];
    const target = remembered && s.links.some(l => remembered === l.to || remembered.startsWith(`${l.to}/`)) ? remembered : s.links[0].to;
    const active = s.id === current;
    return (
      <li key={s.id}>
        <NavLink
          to={target}
          aria-current={active ? 'page' : undefined}
          title={collapsed ? s.label : undefined}
          aria-label={collapsed ? s.label : undefined}
          className={`relative flex items-center gap-[calc(8px*var(--mx-scale,1))] rounded-[calc(4px*var(--mx-scale,1))] px-[calc(10px*var(--mx-scale,1))] py-[calc(7px*var(--mx-scale,1))] text-[length:calc(13px*var(--mx-scale,1))] uppercase tracking-[0.01em] transition-colors ${
            collapsed ? 'justify-center' : ''} ${
            active
              ? 'bg-[rgba(var(--mx-accent-rgb),0.09)] font-semibold text-primary-700 dark:bg-[rgba(var(--mx-accent-rgb),0.16)] dark:text-primary-300'
              : 'font-normal text-gray-500 dark:text-gray-400 hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-gray-700/60 dark:hover:text-white'
          }`}
        >
          <s.icon size={15} aria-hidden="true" className="shrink-0" />
          {!collapsed && <span className="truncate">{s.label}</span>}
          {s.id === 'home' && alertCount > 0 && (
            <span className={`${collapsed ? 'absolute -top-1 -right-1' : 'ml-auto'} min-w-[16px] h-4 px-1 rounded-full bg-danger-600 text-white text-[10px] font-bold flex items-center justify-center`} aria-label={`${alertCount} alerte(s)`}>
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </NavLink>
      </li>
    );
  };

  return (
    <aside
      className="hidden lg:flex h-full shrink-0 flex-col bg-white dark:bg-gray-800 print:hidden"
      style={{
        width: collapsed ? 'var(--mx-sidebar-w-collapsed)' : 'calc(200px * var(--mx-scale, 1))',
        boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 1px 8px rgba(0,0,0,.04)',
        transition: 'width .2s ease',
        zIndex: 20,
      }}
    >
      {/* Logo et bouton de repli (en haut, comme Mannyx) */}
      <div className={`flex items-center gap-2 px-[calc(12px*var(--mx-scale,1))] pt-[calc(14px*var(--mx-scale,1))] pb-[calc(12px*var(--mx-scale,1))] ${collapsed ? 'flex-col' : 'justify-between'}`}>
        <NavLink to="/" aria-label="GO-Mat, accueil" className="flex min-w-0 items-center gap-2">
          {companyLogo && !collapsed
            ? <img src={companyLogo} alt="Logo de l'entreprise" className="max-h-7 max-w-[120px] object-contain" />
            : (
              <>
                <span className="flex h-[calc(28px*var(--mx-scale,1))] w-[calc(28px*var(--mx-scale,1))] shrink-0 items-center justify-center rounded-md bg-primary-600 text-white"><QrCode size={16} aria-hidden="true" /></span>
                {!collapsed && <span className="text-[length:calc(14px*var(--mx-scale,1))] font-bold uppercase tracking-[0.12em] text-gray-900 dark:text-white">GO-Mat</span>}
              </>
            )}
        </NavLink>
        <button type="button" onClick={toggle} aria-label={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'} title={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
          className="flex h-[calc(32px*var(--mx-scale,1))] w-[calc(32px*var(--mx-scale,1))] shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
          {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
        </button>
      </div>

      <nav aria-label="Navigation principale" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[calc(8px*var(--mx-scale,1))]">
        <ul className="flex flex-col gap-[2px]">{spaces.filter(s => !BOTTOM_SPACES.includes(s.id)).map(entry)}</ul>
        <div className="flex-1" />
        <ul className="flex flex-col gap-[2px] pb-2">{spaces.filter(s => BOTTOM_SPACES.includes(s.id)).map(entry)}</ul>
      </nav>

      {/* Compte, en bas du menu */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-[calc(8px*var(--mx-scale,1))]">
        <UserMenu variant="sidebar" collapsed={collapsed} />
      </div>
    </aside>
  );
};

export default Sidebar;
