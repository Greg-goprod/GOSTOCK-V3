import React, { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { errorMessage } from '../../lib/requests';

// Sélecteur d'entreprise de la barre du haut : visible seulement pour un compte rattaché à plusieurs entreprises.
// Changer d'entreprise recharge toute l'application (rien ne reste affiché de l'ancienne).
const OrgSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { profile, switchOrganization } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const organizations = profile?.organizations ?? [];
  const current = profile?.organization;

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

  if (organizations.length < 2 || !current) return null;

  const choose = async (id: string) => {
    if (id === current.id || busy) return setOpen(false);
    setBusy(true);
    try {
      await switchOrganization(id);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-controls="org-switcher-menu"
        aria-label={`Entreprise : ${current.name}`}
        className={`flex items-center gap-2 rounded-[calc(8px*var(--mx-scale,1))] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-[length:calc(13px*var(--mx-scale,1))] text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 ${compact ? 'min-h-[44px] min-w-[44px] justify-center px-2' : 'px-[calc(12px*var(--mx-scale,1))] py-[calc(6px*var(--mx-scale,1))]'}`}>
        <Building2 size={14} aria-hidden="true" className="text-gray-500" />
        {!compact && <span className="font-bold max-w-[18ch] truncate">{current.name}</span>}
        {!compact && <ChevronDown size={14} aria-hidden="true" className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <div id="org-switcher-menu" role="menu" aria-label="Choix de l'entreprise"
          className={`absolute z-50 mt-1 min-w-[240px] rounded-[calc(6px*var(--mx-scale,1))] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 ${compact ? 'right-0' : 'left-0'}`}
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,.08), 0 12px 32px rgba(0,0,0,.10)' }}>
          <p className="px-2 pb-1 pt-1.5 mx-section-label">Entreprise</p>
          <ul>
            {organizations.map(o => (
              <li key={o.id}>
                <button type="button" role="menuitemradio" aria-checked={o.id === current.id} onClick={() => void choose(o.id)} disabled={busy}
                  className={`flex w-full items-center gap-2 rounded px-2 py-[calc(7px*var(--mx-scale,1))] text-left text-[length:calc(13px*var(--mx-scale,1))] ${
                    o.id === current.id ? 'font-semibold text-primary-700 dark:text-primary-300' : 'text-gray-800 dark:text-gray-200'} hover:bg-gray-50 dark:hover:bg-gray-700/60`}>
                  <span className="flex-1 truncate">{o.name}</span>
                  {o.id === current.id && <Check size={14} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default OrgSwitcher;
