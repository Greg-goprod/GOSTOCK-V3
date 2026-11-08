import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

// Barre d'outils UNIQUE de la page Projets : la page fournit deux emplacements sur sa ligne (à gauche : recherche, filtres, affichage ; à droite : actions),
// et chaque vue (Gantt, Tableau, Calendrier) y place ses outils. Sans page parente (écran seul), la vue garde sa propre rangée.
export interface ToolbarSlots { left: HTMLElement | null; right: HTMLElement | null }
const SlotsContext = createContext<ToolbarSlots | null>(null);
export const ToolbarSlotsProvider = SlotsContext.Provider;

export const ToolbarPart: React.FC<{ side: 'left' | 'right'; children: React.ReactNode }> = ({ side, children }) => {
  const slots = useContext(SlotsContext);
  if (!slots) return <div className="flex flex-wrap items-center gap-2">{children}</div>;
  const target = slots[side];
  return target ? createPortal(children, target) : null;
};
