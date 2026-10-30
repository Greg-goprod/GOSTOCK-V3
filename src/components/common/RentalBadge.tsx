import React from 'react';

// Pastille d'un véhicule ou d'un outil loué : objet temporaire, disponible jusqu'à la fin du contrat
const RentalBadge: React.FC<{ until?: string }> = ({ until }) => {
  if (!until) return null;
  const day = new Date(`${until}T12:00:00`).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' });
  return (
    <span className="inline-flex items-center rounded-full bg-warning-50 dark:bg-warning-900/40 px-2 py-0.5 text-[11px] font-semibold text-warning-800 dark:text-warning-200 whitespace-nowrap">
      Loué jusqu'au {day}
    </span>
  );
};

export default RentalBadge;
