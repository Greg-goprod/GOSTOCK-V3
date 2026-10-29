import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Vérifier si le clic est sur un élément du ColorPicker
      const isColorPickerClick = (event.target as Element).closest('.color-picker-portal');
      
      if (modalRef.current && !modalRef.current.contains(event.target as Node) && !isColorPickerClick) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop avec effet de flou */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300" />
      
      {/* Container flottant - position plus haute et moins de hauteur */}
      <div className="flex min-h-full items-start justify-center p-3 pt-12">
        <div
          ref={modalRef}
          className={`${sizeClasses[size]} w-full transform transition-all duration-300 scale-100`}
        >
          {/* Modal flottant avec ombre douce et bordure subtile */}
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden max-h-[80vh]">
            {/* Header compact avec effet glassmorphism */}
            <div className="flex items-center justify-between px-3 py-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wide">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="p-1 min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 group"
              >
                <X size={16} className="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200" />
              </button>
            </div>
            
            {/* Content avec padding réduit et scroll optimisé */}
            <div className="p-3 overflow-y-auto max-h-[calc(80vh-48px)] text-gray-900 dark:text-white">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;