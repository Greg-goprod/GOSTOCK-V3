import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen print:h-auto bg-gray-50 dark:bg-gray-900 print:bg-white">
      <Sidebar />
      
      <div className="flex-1 min-w-0 flex flex-col lg:ml-64 print:ml-0">
        <Header />
        
        <main className="flex-1 p-4 overflow-auto print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;