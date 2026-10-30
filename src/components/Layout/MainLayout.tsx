import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';
import CommandPalette from './CommandPalette';
import HelpDrawer from '../help/HelpDrawer';

interface MainLayoutProps {
  children: React.ReactNode;
}

// Rail des espaces + liste de l'espace (grand écran), barre du bas (téléphone), recherche rapide Ctrl+K
const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen print:h-auto print:bg-white">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <Header />

        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 overflow-auto print:overflow-visible print:p-0">
          {children}
        </main>
      </div>

      <MobileNav />
      <CommandPalette />
      <HelpDrawer />
    </div>
  );
};

export default MainLayout;
