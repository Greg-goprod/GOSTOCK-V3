import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { BOTTOM_SPACES, NavSpace, locate } from '../../lib/navigation';
import { useNavSpaces } from '../../lib/useNavSpaces';
import { supabase } from '../../lib/supabase';
import UserMenu from './UserMenu';

const LAST_PAGE_KEY = 'gomat-last-page';

// Dernière page ouverte de chaque module : y revenir quand on clique sur le module
const lastPages = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(LAST_PAGE_KEY) ?? '{}'); } catch { return {}; }
};

// Rail des modules sur grand écran : une icône et, dessous, le nom du chapitre.
// Les pages d'un module sont les onglets de l'en-tête de la page ; le compte est en bas du rail.
const Sidebar: React.FC = () => {
  const { alertCount } = useApp();
  const { pathname } = useLocation();
  const spaces = useNavSpaces();
  const current = locate(pathname).space?.id;
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

  const railLink = (s: NavSpace) => {
    const remembered = lastPages()[s.id];
    const target = remembered && s.links.some(l => remembered === l.to || remembered.startsWith(`${l.to}/`)) ? remembered : s.links[0].to;
    const active = s.id === current;
    return (
      <li key={s.id}>
        <NavLink
          to={target}
          aria-current={active ? 'page' : undefined}
          aria-label={s.label}
          title={s.label}
          className={`relative flex w-[calc(68px*var(--mx-scale,1))] flex-col items-center gap-[calc(4px*var(--mx-scale,1))] rounded-md px-1 py-[calc(8px*var(--mx-scale,1))] text-[length:calc(11px*var(--mx-scale,1))] font-semibold leading-tight transition-colors ${
            active
              ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <s.icon aria-hidden="true" style={{ width: 'calc(20px * var(--mx-scale, 1))', height: 'calc(20px * var(--mx-scale, 1))' }} />
          <span className="text-center">{s.short}</span>
          {s.id === 'home' && alertCount > 0 && (
            <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full bg-danger-600 text-white text-[10px] font-bold flex items-center justify-center" aria-label={`${alertCount} alerte(s)`}>
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </NavLink>
      </li>
    );
  };

  return (
    <aside
      className="hidden lg:flex h-full shrink-0 flex-col items-center bg-white dark:bg-gray-800 print:hidden"
      style={{
        width: 'calc(80px * var(--mx-scale, 1))',
        boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 1px 8px rgba(0,0,0,.04)',
        zIndex: 20,
      }}
    >
      <NavLink to="/" aria-label="GO-Mat, accueil" className="mt-[calc(12px*var(--mx-scale,1))] mb-[calc(10px*var(--mx-scale,1))] flex shrink-0 items-center justify-center">
        {companyLogo
          ? <img src={companyLogo} alt="Logo de l'entreprise" className="max-h-[calc(32px*var(--mx-scale,1))] max-w-[calc(60px*var(--mx-scale,1))] object-contain" />
          : <span className="flex h-[calc(36px*var(--mx-scale,1))] w-[calc(36px*var(--mx-scale,1))] items-center justify-center rounded-md bg-primary-600 text-white"><QrCode size={20} aria-hidden="true" /></span>}
      </NavLink>

      <nav aria-label="Navigation principale" className="flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto pb-2">
        <ul className="flex flex-col items-center gap-[2px]">{spaces.filter(s => !BOTTOM_SPACES.includes(s.id)).map(railLink)}</ul>
        <div className="flex-1" />
        <ul className="flex flex-col items-center gap-[2px]">{spaces.filter(s => BOTTOM_SPACES.includes(s.id)).map(railLink)}</ul>
      </nav>

      {/* Compte, en bas du rail */}
      <div className="w-full border-t border-gray-200 dark:border-gray-700 p-[calc(8px*var(--mx-scale,1))] flex justify-center">
        <UserMenu variant="sidebar" collapsed />
      </div>
    </aside>
  );
};

export default Sidebar;
