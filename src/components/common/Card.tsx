import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, title, className = '' }) => {
  return (
    // Carte de la charte Mannyx : surface, filet 1px, rayon 6px, élévation 2 ; titre de bloc 16px
    <div className={`mx-card overflow-hidden ${className}`}>
      {title && (
        <div className="px-5 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-[length:calc(16px*var(--mx-scale,1))] font-bold tracking-[-0.02em] text-gray-900 dark:text-white">{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
};

export default Card;