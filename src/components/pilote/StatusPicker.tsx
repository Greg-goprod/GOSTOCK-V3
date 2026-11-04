import React from 'react';
import MenuButton from '../common/MenuButton';
import { FAMILY_LABEL, FAMILY_ORDER, type CpStatus } from '../../lib/pilote';

interface Props {
  // Identifiant du bouton (pour le <label htmlFor> de la fiche)
  id: string;
  statuses: CpStatus[];
  value: string;
  onChange: (statusId: string) => void;
  disabled?: boolean;
}

export const StatusDot: React.FC<{ color: string }> = ({ color }) => <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />;

// Choix d'un état : un menu groupé par famille (Pas commencé, En cours, Terminé, Annulé), chaque état avec sa pastille de couleur
const StatusPicker: React.FC<Props> = ({ id, statuses, value, onChange, disabled = false }) => {
  const current = statuses.find(s => s.id === value);
  const groups = FAMILY_ORDER
    .map(f => ({ id: f, label: FAMILY_LABEL[f], items: statuses.filter(s => s.family === f).map(s => ({
      id: s.id, checked: s.id === value, onSelect: () => onChange(s.id),
      label: <span className="inline-flex items-center gap-2"><StatusDot color={s.color} />{s.name}</span>,
    })) }))
    .filter(g => g.items.length > 0);
  return (
    <MenuButton id={`${id}-menu`} buttonId={id} menuLabel="État" disabled={disabled} className="w-full !justify-start"
      icon={current ? <StatusDot color={current.color} /> : undefined} value={current?.name ?? '—'} groups={groups} />
  );
};

export default StatusPicker;
