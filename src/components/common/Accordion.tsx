import React, { ReactNode, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Collapse from './Collapse';

interface AccordionProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
  badge?: ReactNode;
  icon?: ReactNode;
}

// Accordéon de la charte (catalogue #s-accordion) : filet 1,5px, rayon 6px, en-tête de 46px,
// titre 14px/700 en casse normale, icône --text3 qui passe en accent à l'ouverture avec un
// filet d'accent à gauche. Les icônes reçues gardent leur forme, pas leur couleur (styles dans gomat-mx.css).
const Accordion: React.FC<AccordionProps> = ({
  title,
  children,
  defaultOpen = false,
  className = '',
  titleClassName = '',
  contentClassName = '',
  badge,
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={`mx-acc ${isOpen ? 'is-open' : ''} ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={`mx-acc-head ${titleClassName}`}
      >
        {icon && <span className="mx-acc-icon" aria-hidden="true">{icon}</span>}
        <span className="mx-acc-title">{title}</span>
        {badge && <span className="shrink-0">{badge}</span>}
        <ChevronDown size={18} aria-hidden="true" className="mx-acc-chevron" />
      </button>

      <Collapse open={isOpen} className={contentClassName}>
        <div id={panelId} className="mx-acc-body">
          {children}
        </div>
      </Collapse>
    </div>
  );
};

export default Accordion;
