import React from 'react';
import { useStatusColors } from '../../hooks/useStatusColors';
import { MxBadge } from '../mx/MxBadge';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

// Pastille de statut aux tons de la charte (texte contrasté selon le thème), et non plus
// une couleur libre avec du texte blanc
const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const { getStatusName, getStatusBadgeVariant } = useStatusColors();
  return <MxBadge tone={getStatusBadgeVariant(status)} className={className}>{getStatusName(status)}</MxBadge>;
};

export default StatusBadge;
