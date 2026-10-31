import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';
import CommandPalette from './CommandPalette';
import HelpDrawer from '../help/HelpDrawer';
import ModuleHeader, { ModuleHeaderProvider } from './ModuleHeader';
import { useLocation } from 'react-router-dom';
import { locate } from '../../lib/navigation';

interface MainLayoutProps {
  children: React.ReactNode;
}

// Coque comme Mannyx : menu d'une colonne, barre du haut, en-tête de module fixe (titre, onglets,
// commandes) au-dessus de la zone qui défile. Téléphone : barre du bas, titre propre à chaque page.
const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { pathname } = useLocation();
  const inModule = Boolean(locate(pathname).space);
  return (
    <ModuleHeaderProvider>
    <div className="flex h-screen print:h-auto print:bg-white">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <Header />
        <ModuleHeader />

        <main className={`flex-1 p-4 lg:p-[calc(24px*var(--mx-scale,1))] pb-24 lg:pb-[calc(24px*var(--mx-scale,1))] overflow-auto print:overflow-visible print:p-0 ${inModule ? 'has-module-head' : ''}`}>
          {children}
        </main>
      </div>

      <MobileNav />
      <CommandPalette />
      <HelpDrawer />
    </div>
    </ModuleHeaderProvider>
  );
};

export default MainLayout;
