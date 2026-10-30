import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Collapse from './Collapse';

interface AccordionCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

const AccordionCard: React.FC<AccordionCardProps> = ({ 
  title, 
  icon, 
  children, 
  defaultOpen = false,
  className = '' 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-clip ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
      >
        <div className="flex items-center gap-2">
          {icon && (
            <div className="p-1.5 rounded-lg bg-primary-100 dark:bg-primary-900/50">
              {icon}
            </div>
          )}
          <h3 className="text-sm font-bold text-gray-800 dark:text-white text-left">
            {title}
          </h3>
        </div>
        <div className="flex-shrink-0">
          {isOpen ? (
            <ChevronUp size={18} className="text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-500 dark:text-gray-400" />
          )}
        </div>
      </button>
      
      <Collapse open={isOpen}>
        <div className="p-3 pt-0 border-t border-gray-200 dark:border-gray-700">
          {children}
        </div>
      </Collapse>
    </div>
  );
};

export default AccordionCard;