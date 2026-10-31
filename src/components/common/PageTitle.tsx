import React from 'react';
import { useLocation } from 'react-router-dom';
import { locate } from '../../lib/navigation';

// Titre de page comme dans Mannyx (MxPageHeader) : l'icône de la page dans le menu, puis le titre
// en majuscules souligné du trait d'accent
const PageTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  const { pathname } = useLocation();
  const { link, space } = locate(pathname);
  const Icon = link?.icon ?? space?.icon;
  return (
    <div className={`mx-page-head ${className}`}>
      {Icon && <Icon size={20} strokeWidth={2} aria-hidden="true" className="mx-page-icon" />}
      <h1 className="mx-page-title">{children}</h1>
    </div>
  );
};

export default PageTitle;
