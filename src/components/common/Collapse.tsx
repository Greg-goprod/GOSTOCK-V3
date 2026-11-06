import React from 'react';

// Contenu repliable sans hauteur maximale : une section ouverte n'est jamais coupée, même plus haute que
// l'écran. L'animation passe par grid-template-rows (0fr → 1fr). « overflow: clip » masque le contenu
// replié sans créer de zone de défilement : un pied de formulaire « collant » à l'intérieur reste donc
// collé au panneau qui défile (avec « overflow: hidden », il restait prisonnier de la section).
const Collapse: React.FC<{ open: boolean; className?: string; children: React.ReactNode }> = ({ open, className = '', children }) => (
  <div
    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'} ${className}`}
    aria-hidden={open ? undefined : true}
    {...(open ? {} : { inert: '' })}
  >
    <div className="min-h-0 overflow-clip">{children}</div>
  </div>
);

export default Collapse;
