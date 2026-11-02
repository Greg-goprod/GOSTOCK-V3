import { Clock, MapPin, Pencil, Trash2, Users } from 'lucide-react';
import { MxBadge } from '../mx/MxBadge';
import Button from '../common/Button';

interface Props {
  title: string;
  when: string;
  zone: string;
  zoneColor: string;
  team: string;
  phase: string | null;
  notes: string | null;
  onEdit?: () => void;
  onDelete?: () => void;
}

// Carte d'une intervention : horaire, zone, équipe lisibles en entier (la couleur de la zone borde la carte)
export function InterventionCard({ title, when, zone, zoneColor, team, phase, notes, onEdit, onDelete }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--mx-space-8)', minWidth: 0, width: '100%', padding: 'var(--mx-space-12)',
      background: 'var(--mx-surface2)', border: 'var(--mx-border-w) solid var(--mx-border)', borderLeft: `4px solid ${zoneColor}`, borderRadius: 'var(--mx-radius-8)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--mx-space-8)' }}>
        <h3 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 'calc(15px * var(--mx-scale, 1))', fontWeight: 700, overflowWrap: 'anywhere' }}>{title}</h3>
        {phase && <MxBadge tone="info">{phase}</MxBadge>}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4, fontSize: 'calc(13px * var(--mx-scale, 1))' }}>
        <li style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Clock size={14} aria-hidden /> <span>{when}</span></li>
        <li style={{ display: 'flex', gap: 6, alignItems: 'center' }}><MapPin size={14} aria-hidden /> <span>{zone}</span></li>
        <li style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Users size={14} aria-hidden /> <span>{team}</span></li>
      </ul>
      {notes && <p style={{ margin: 0, fontSize: 'calc(12px * var(--mx-scale, 1))', color: 'var(--mx-text3)', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{notes}</p>}
      {(onEdit || onDelete) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--mx-space-8)', marginTop: 'auto' }}>
          {onEdit && <Button size="sm" variant="outline" icon={<Pencil size={14} />} onClick={onEdit}>Modifier</Button>}
          {onDelete && <Button size="sm" variant="outline" icon={<Trash2 size={14} />} onClick={onDelete}>Supprimer</Button>}
        </div>
      )}
    </div>
  );
}
