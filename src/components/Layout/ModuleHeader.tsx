import React, { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { locate } from '../../lib/navigation';
import { useNavSpaces } from '../../lib/useNavSpaces';

// Cible de la zone de commandes de l'en-tête de module (recherche · filtres · pagination · vue · action
// principale), comme MxPageCommands dans Mannyx : la page déclare ses commandes avec <PageCommands>,
// elles s'affichent dans l'en-tête fixe.
const CommandsTarget = createContext<{ target: HTMLDivElement | null; setTarget: (el: HTMLDivElement | null) => void }>({
  target: null,
  setTarget: () => {},
});

export const ModuleHeaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return <CommandsTarget.Provider value={{ target, setTarget }}>{children}</CommandsTarget.Provider>;
};

// Emplacements fixes, dans l'ordre de Mannyx : recherche · filtres · pagination · vue · action principale (à droite)
export const PageCommands: React.FC<{
  search?: React.ReactNode;
  filters?: React.ReactNode;
  pagination?: React.ReactNode;
  view?: React.ReactNode;
  primary?: React.ReactNode;
}> = ({ search, filters, pagination, view, primary }) => {
  const { target } = useContext(CommandsTarget);
  // Suit la largeur de la fenêtre (rotation de tablette, fenêtre redimensionnée)
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const row = (
    <div className="flex flex-wrap items-center gap-[calc(8px*var(--mx-scale,1))]">
      {search && <div className="min-w-[calc(220px*var(--mx-scale,1))] flex-1">{search}</div>}
      {filters && <div className="shrink-0">{filters}</div>}
      {pagination && <div className="shrink-0">{pagination}</div>}
      {view && <div className="shrink-0">{view}</div>}
      {primary && <div className="ml-auto shrink-0">{primary}</div>}
    </div>
  );
  // Sans en-tête de module (téléphone, page hors menu), les commandes restent dans la page
  return target && wide ? createPortal(row, target) : <div className="mb-4">{row}</div>;
};

// En-tête de module, fixe (ne défile pas) : icône + NOM DU MODULE souligné, onglets des pages du module,
// zone de commandes. Grand écran seulement ; sur téléphone, la page garde son propre titre.
const ModuleHeader: React.FC = () => {
  const { pathname } = useLocation();
  const spaces = useNavSpaces();
  const { setTarget } = useContext(CommandsTarget);
  const found = locate(pathname);
  const space = found.space && spaces.find(s => s.id === found.space!.id);
  if (!space) return null;
  const Icon = space.icon;

  return (
    <div data-module-header className="hidden lg:block shrink-0 px-[calc(24px*var(--mx-scale,1))] pt-[calc(16px*var(--mx-scale,1))] print:hidden">
      <div className="mx-page-head">
        <Icon aria-hidden="true" className="mx-page-icon" style={{ width: 'calc(17px * var(--mx-scale, 1))', height: 'calc(17px * var(--mx-scale, 1))' }} />
        <h1 className="mx-page-title">{space.label}</h1>
      </div>

      {space.links.length > 1 && (
        <nav aria-label={`Navigation ${space.label}`} className="mt-[calc(12px*var(--mx-scale,1))] flex overflow-x-auto border-b border-gray-200 dark:border-gray-700">
          {space.links.map(link => {
            const active = link.to === found.link?.to;
            const LinkIcon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                target={link.newTab ? '_blank' : undefined}
                rel={link.newTab ? 'noopener' : undefined}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-[calc(6px*var(--mx-scale,1))] whitespace-nowrap px-[calc(14px*var(--mx-scale,1))] h-[calc(34px*var(--mx-scale,1))] text-[length:calc(13px*var(--mx-scale,1))] uppercase transition-colors ${
                  active
                    ? 'font-semibold text-primary-700 dark:text-primary-300 shadow-[inset_0_-2px_0_var(--mx-accent)]'
                    : 'font-normal text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <LinkIcon aria-hidden="true" style={{ width: 'calc(15px * var(--mx-scale, 1))', height: 'calc(15px * var(--mx-scale, 1))' }} />
                {link.label}
                {link.newTab && <ExternalLink size={11} aria-label="nouvel onglet" className="opacity-60" />}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Zone de commandes : remplie par la page avec <PageCommands> */}
      <div ref={setTarget} className="pt-[calc(12px*var(--mx-scale,1))] empty:pt-0 pb-[calc(4px*var(--mx-scale,1))]" />
    </div>
  );
};

export default ModuleHeader;
