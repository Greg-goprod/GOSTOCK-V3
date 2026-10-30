import React from 'react';
import { MxBadge } from '../mx/MxBadge';

// Pastille d'un véhicule ou d'un outil loué : objet temporaire, disponible jusqu'à la fin du contrat
const RentalBadge: React.FC<{ until?: string; returned?: boolean }> = ({ until, returned }) => {
  if (!until) return null;
  if (returned) {
    return (
      <MxBadge tone="neutral">Rendu au loueur</MxBadge>
    );
  }
  const day = new Date(`${until}T12:00:00`).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' });
  return (
    // Ton « info » de la charte (cyan) : un objet loué n'est pas une alerte
    <MxBadge tone="info">Loué jusqu'au {day}</MxBadge>
  );
};

export default RentalBadge;
