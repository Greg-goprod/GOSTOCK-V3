import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
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
      {/* L'aide n'existe qu'en français : pas de traduction mot à mot */}
      <div translate="no" className="space-y-6">
        {/* Lire l'aide dans un autre onglet et garder la page de travail ouverte */}
        <a href={article ? `/aide/${article.id}` : '/aide'} target="_blank" rel="noopener" onClick={() => setOpen(false)}
          className="mx-btn mx-btn-secondary inline-flex w-fit items-center gap-1.5 px-3 py-1.5 text-[length:calc(12.5px*var(--mx-scale,1))]">
          <ExternalLink size={14} aria-hidden="true" /> Ouvrir dans un nouvel onglet
        </a>
        {article ? (
          <HelpArticleView article={article} compact onNavigate={() => setOpen(false)} />
        ) : (
          <p className="text-gray-700 dark:text-gray-300">Pas encore de mode d'emploi pour cette page.</p>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link to="/aide" onClick={() => setOpen(false)} className="inline-block text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline">
            Toute l'aide, la FAQ et le glossaire
          </Link>
        </div>
      </div>
    </MxDrawer>
  );
};

export default HelpDrawer;
