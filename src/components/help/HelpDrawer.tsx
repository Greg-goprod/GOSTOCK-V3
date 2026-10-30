import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MxDrawer } from '../mx/MxDrawer';
import HelpArticleView from './HelpArticleView';
import { articleForPath } from '../../help/content';

// Ouverture depuis le « ? » de l'en-tête : window.dispatchEvent(new Event(OPEN_HELP))
export const OPEN_HELP = 'gomat:open-help';

// Aide de la page en cours, dans un drawer : on la lit sans quitter ce qu'on fait
const HelpDrawer: React.FC = () => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const article = articleForPath(pathname);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_HELP, onOpen);
    return () => window.removeEventListener(OPEN_HELP, onOpen);
  }, []);

  // Changement de page : le drawer se ferme
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <MxDrawer open={open} onClose={() => setOpen(false)} title={article ? article.title : 'Aide'} size="lg">
      <div className="space-y-6">
        {article ? (
          <HelpArticleView article={article} compact onNavigate={() => setOpen(false)} />
        ) : (
          <p className="text-gray-700 dark:text-gray-300">Pas encore de mode d'emploi pour cette page.</p>
        )}
        <Link to="/aide" onClick={() => setOpen(false)} className="inline-block text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline">
          Toute l'aide, la FAQ et le glossaire
        </Link>
      </div>
    </MxDrawer>
  );
};

export default HelpDrawer;
