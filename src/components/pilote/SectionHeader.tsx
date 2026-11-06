import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  // Identifiant du contenu replié (aria-controls)
  panelId: string;
  // Boutons à droite (ex. actualiser) : visibles seulement quand la section est ouverte
  actions?: React.ReactNode;
}

// En-tête d'une section repliable : le titre est un bouton (clavier et lecteur d'écran : « développé / réduit »)
export const SectionHeader: React.FC<Props> = ({ title, icon, open, onToggle, panelId, actions }) => (
  <div className="flex items-center justify-between gap-2">
    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle}
        className="inline-flex items-center gap-1.5 rounded px-0.5 py-0.5 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        {icon}
        {title}
      </button>
    </h3>
    {open && actions}
  </div>
);
