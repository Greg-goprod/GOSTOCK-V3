import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronUp, Contact, Download, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useInstallPrompt } from '../../lib/install';
import { ROLE_LABELS } from '../../lib/roles';
import LanguagePicker from '../common/LanguagePicker';

// Menu du compte. « sidebar » : bouton large en bas du menu (comme Mannyx), menu ouvert vers le haut ;
// « compact » : rond aux initiales (barre du haut sur téléphone), menu ouvert vers le bas
const UserMenu: React.FC<{ variant: 'sidebar' | 'compact'; collapsed?: boolean }> = ({ variant, collapsed }) => {
  const { profile, signOut } = useAuth();
  const { canInstall, install } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = profile ? `${profile.first_name[0] ?? ''}${profile.last_name[0] ?? ''}`.toUpperCase() : '?';

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const avatar = (
    <span className="flex h-[calc(28px*var(--mx-scale,1))] w-[calc(28px*var(--mx-scale,1))] shrink-0 items-center justify-center rounded-full bg-primary-600 text-[length:calc(11px*var(--mx-scale,1))] font-bold text-white">
      {initials}
    </span>
  );
  const item = 'w-full inline-flex items-center gap-2 rounded-md px-2 py-2 min-h-[44px] lg:min-h-0 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Compte de ${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`}
        className={variant === 'sidebar'
          ? `flex w-full items-center gap-2 rounded-md p-[calc(8px*var(--mx-scale,1))] text-left hover:bg-gray-50 dark:hover:bg-gray-700/60 ${collapsed ? 'justify-center' : ''}`
          : 'min-h-[44px] min-w-[44px] flex items-center justify-center'}
      >
        {avatar}
        {variant === 'sidebar' && !collapsed && profile && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[length:calc(13px*var(--mx-scale,1))] font-semibold text-gray-900 dark:text-white">{profile.first_name} {profile.last_name}</span>
              <span className="block truncate text-[length:calc(11.5px*var(--mx-scale,1))] text-gray-500 dark:text-gray-400">{profile.email}</span>
            </span>
            <ChevronUp size={14} aria-hidden="true" className={`shrink-0 text-gray-400 transition-transform ${open ? '' : 'rotate-180'}`} />
          </>
        )}
      </button>
      {open && profile && (
        <div role="menu" className={`absolute z-50 w-64 space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-lg ${
          variant === 'sidebar' ? 'bottom-full left-0 mb-2' : 'right-0 mt-2'}`}>
          <div className="px-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{profile.first_name} {profile.last_name}</p>
            <p className="truncate text-xs text-gray-600 dark:text-gray-400">{profile.email}</p>
            <p className="mt-1 inline-block rounded px-2 py-0.5 text-xs font-semibold mx-tint-badge-info">{ROLE_LABELS[profile.role]}</p>
          </div>
          <Link to="/badge" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <Contact size={16} aria-hidden="true" /> Mon badge
          </Link>
          {canInstall && (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); install(); }} className={item}>
              <Download size={16} aria-hidden="true" /> Installer l'application
            </button>
          )}
          <div className="px-2 py-1"><LanguagePicker /></div>
          <button type="button" role="menuitem" onClick={signOut} className={item}>
            <LogOut size={16} aria-hidden="true" /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
