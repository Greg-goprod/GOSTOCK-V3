import React, { useEffect, useRef, useState } from 'react';
import { MxDrawer, type MxDrawerSize } from '../mx/MxDrawer';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  // Conservé pour compatibilité : le drawer de la charte se ferme au clic sur le voile et à Échap
  closeOnBackdrop?: boolean;
}

// Toutes les fenêtres de GO-Mat s'ouvrent en drawer (panneau latéral de la charte Mannyx).
// Largeurs : les formulaires gardent la place qu'ils avaient dans l'ancienne fenêtre centrée.
const SIZE: Record<NonNullable<ModalProps['size']>, MxDrawerSize> = {
  sm: 'md',
  md: 'lg',
  lg: 'xl',
  xl: 'full',
};

// Durée du glissement de fermeture (0.32s dans la charte) avant de démonter le contenu
const CLOSE_DELAY = 350;

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  // Le contenu est démonté à la fermeture, comme avant : chaque ouverture repart d'un formulaire neuf
  const [mounted, setMounted] = useState(isOpen);
  // Ouvert une image après le montage, pour jouer le glissement d'entrée
  const [shown, setShown] = useState(false);
  const lastChildren = useRef(children);
  if (isOpen) lastChildren.current = children;

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), CLOSE_DELAY);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!mounted && !isOpen) return null;

  return (
    <MxDrawer open={shown && isOpen} onClose={onClose} title={title} size={SIZE[size]}>
      {lastChildren.current}
    </MxDrawer>
  );
};

export default Modal;
