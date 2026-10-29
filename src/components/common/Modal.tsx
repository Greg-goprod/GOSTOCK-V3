import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  // Fermer au clic à côté : désactivé par défaut pour ne pas perdre une saisie sur un tap raté
  closeOnBackdrop?: boolean;
}

// Fenêtres ouvertes, de la plus ancienne à la plus récente : Échap et Tab ne concernent que celle du dessus
const openModals: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnBackdrop = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const id = Symbol('modal');
    openModals.push(id);
    const isTop = () => openModals[openModals.length - 1] === id;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    // Focus sur le premier champ du contenu (sauf si un champ a déjà pris le focus via autoFocus)
    const panel = modalRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      const first = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].find(el => !el.dataset.modalClose);
      (first ?? panel).focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTop() || !panel) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      // Garder le focus clavier dans la fenêtre
      const focusables = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === firstEl || !panel.contains(active))) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && (active === lastEl || !panel.contains(active))) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openModals.splice(openModals.indexOf(id), 1);
      if (openModals.length === 0) {
        document.body.style.overflow = '';
      }
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !closeOnBackdrop) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Les clics dans le ColorPicker (rendu hors de la fenêtre) ne comptent pas
      const isColorPickerClick = (event.target as Element).closest('.color-picker-portal');
      if (openModals.length > 1) return;
      if (modalRef.current && !modalRef.current.contains(event.target as Node) && !isColorPickerClick) {
        onCloseRef.current();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeOnBackdrop]);

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
          className={`${sizeClasses[size]} w-full transform transition-all duration-300 scale-100`}
        >
          {/* Modal flottant avec ombre douce et bordure subtile */}
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden max-h-[80vh] focus:outline-none"
          >
            {/* Header compact avec effet glassmorphism */}
            <div className="flex items-center justify-between px-3 py-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-700">
              <h2 id={titleId} className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wide">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                data-modal-close="true"
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