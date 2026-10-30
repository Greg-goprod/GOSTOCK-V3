import React from 'react';
import Accordion from './Accordion';

interface AccordionCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

// Même accordéon de la charte (les deux variantes de l'ancienne version sont fusionnées)
const AccordionCard: React.FC<AccordionCardProps> = ({ title, icon, children, defaultOpen = false, className = '' }) => (
  <Accordion title={title} icon={icon} defaultOpen={defaultOpen} className={className}>
    {children}
  </Accordion>
);

export default AccordionCard;
