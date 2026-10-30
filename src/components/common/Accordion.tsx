import React, { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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

const Accordion: React.FC<AccordionProps> = ({
  title,
  children,
  defaultOpen = false,
  className = '',
  titleClassName = '',
  contentClassName = '',
  badge,
  icon
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-clip ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 ${titleClassName}`}
      >
        <div className="flex items-center gap-2">
          {icon && (
            <div className="flex-shrink-0">
              {icon}
            </div>
          )}
          <div className="flex-1 text-left text-sm font-bold">
            {title}
          </div>
          {badge && (
            <div className="ml-2">
              {badge}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 ml-3">
          {isOpen ? (
            <ChevronUp size={18} className="text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-500 dark:text-gray-400" />
          )}
        </div>
      </button>
      
      <Collapse open={isOpen} className={contentClassName}>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          {children}
        </div>
      </Collapse>
    </div>
  );
};

export default Accordion;