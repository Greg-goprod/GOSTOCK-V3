import React from 'react';
import { useStatusColors } from '../../hooks/useStatusColors';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const { getStatusColor, getStatusName } = useStatusColors();
  
  // Utiliser getStatusName pour obtenir le nom traduit en français
  const statusName = getStatusName(status);
  const statusColor = getStatusColor(status);

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={{ 
        backgroundColor: statusColor,
        color: '#ffffff', // Texte blanc pour contraste
        fontWeight: 'bold',
        textShadow: '0px 0px 1px rgba(0,0,0,0.3)' // Ombre légère pour améliorer la lisibilité
      }}
    >
      {statusName}
    </span>
  );
};

export default StatusBadge;