import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, QrCode } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { BOTTOM_SPACES, NavSpace, PRODUCTS, ProductId, locate } from '../../lib/navigation';
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
  const located = locate(pathname).space;
  const current = located?.id;
  const [companyLogo, setCompanyLogo] = useState('');
  // Produit déroulé dans le rail : celui de la page ouverte ; on peut dérouler l'autre sans quitter la page
  const [expanded, setExpanded] = useState<ProductId | null>(located?.product ?? 'logistics');
  useEffect(() => { if (located?.product) setExpanded(located.product); }, [located?.product]);

  useEffect(() => {
    supabase.from('system_settings').select('value').eq('id', 'company_logo').maybeSingle()
      .then(({ data }) => { if (data?.value) setCompanyLogo(data.value); });
  }, []);

  // Mémorise la page ouverte dans son module
  useEffect(() => {
    if (!current) return;
    try { localStorage.setItem(LAST_PAGE_KEY, JSON.stringify({ ...lastPages(), [current]: pathname })); } catch { /* stockage indisponible */ }
  }, [current, pathname]);

  // `sub` : page d'un produit (sous son titre) : plus petite et plus discrète que le titre du produit
  const railLink = (s: NavSpace, sub = false) => {
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
          className={`relative flex flex-col items-center rounded-md px-1 transition-colors ${
            sub
              ? 'w-[calc(60px*var(--mx-scale,1))] gap-[calc(2px*var(--mx-scale,1))] py-[calc(6px*var(--mx-scale,1))] text-[length:calc(10px*var(--mx-scale,1))] font-medium'
              : 'w-[calc(68px*var(--mx-scale,1))] gap-[calc(4px*var(--mx-scale,1))] py-[calc(8px*var(--mx-scale,1))] text-[length:calc(11px*var(--mx-scale,1))] font-semibold'
          } ${
            active
              ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-semibold'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <s.icon aria-hidden="true" style={{ width: sub ? 'calc(18px * var(--mx-scale, 1))' : 'calc(20px * var(--mx-scale, 1))', height: sub ? 'calc(18px * var(--mx-scale, 1))' : 'calc(20px * var(--mx-scale, 1))' }} />
          {sub && active && <span aria-hidden="true" className="absolute -left-[calc(5px*var(--mx-scale,1))] top-1/2 h-[calc(18px*var(--mx-scale,1))] w-[3px] -translate-y-1/2 rounded-full bg-primary-600 dark:bg-primary-400" />}
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

  const productGroup = (id: ProductId) => {
    const product = PRODUCTS.find(p => p.id === id)!;
    const items = spaces.filter(s => s.product === id);
    if (items.length === 0) return null;
    const open = expanded === id;
    const hasCurrent = located?.product === id;
    return (
      <li key={id} className="flex w-full flex-col items-center">
        <button
          type="button"
          onClick={() => setExpanded(open ? null : id)}
          aria-expanded={open}
          aria-controls={`rail-${id}`}
          title={product.label}
          className={`relative flex w-[calc(74px*var(--mx-scale,1))] flex-col items-center gap-[calc(3px*var(--mx-scale,1))] rounded-lg px-1 py-[calc(8px*var(--mx-scale,1))] text-[length:calc(10px*var(--mx-scale,1))] font-extrabold uppercase leading-tight tracking-wide transition-colors ${
            hasCurrent
              ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400'
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
          }`}
        >
          <product.icon aria-hidden="true" style={{ width: 'calc(20px * var(--mx-scale, 1))', height: 'calc(20px * var(--mx-scale, 1))' }} />
          <span>{product.label}</span>
          <ChevronDown aria-hidden="true" size={12} className={`absolute right-1 top-1.5 opacity-70 transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
        {open && <ul id={`rail-${id}`} className="mt-[calc(6px*var(--mx-scale,1))] mb-[calc(4px*var(--mx-scale,1))] flex flex-col items-center gap-[2px] border-l-2 border-primary-200 dark:border-primary-800 pl-[calc(5px*var(--mx-scale,1))]">{items.map(s => railLink(s, true))}</ul>}
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
        <ul className="flex w-full flex-col items-center gap-[calc(14px*var(--mx-scale,1))] pt-[calc(2px*var(--mx-scale,1))]">{PRODUCTS.map(p => productGroup(p.id))}</ul>
        <div className="flex-1" />
        <ul className="flex w-full flex-col items-center gap-[2px] border-t border-gray-200 dark:border-gray-700 pt-[calc(6px*var(--mx-scale,1))]">{spaces.filter(s => BOTTOM_SPACES.includes(s.id)).map(s => railLink(s, true))}</ul>
      </nav>

      {/* Compte, en bas du rail */}
      <div className="w-full border-t border-gray-200 dark:border-gray-700 p-[calc(8px*var(--mx-scale,1))] flex justify-center">
        <UserMenu variant="sidebar" collapsed />
      </div>
    </aside>
  );
};

export default Sidebar;
