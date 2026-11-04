import type React from 'react';
import { CalendarRange, FolderKanban, Link2, Pencil, Trash2, Users } from 'lucide-react';
import { MxBadge } from '../mx/MxBadge';
import Button from '../common/Button';

interface Props {
  name: string;
  typeLabel: string;
  color: string;
  statusName: string;
  statusTone: 'neutral' | 'info' | 'success' | 'danger';
  period: string;
  members: React.ReactNode;
  site: string | null;
  priority: string | null;
  description: string | null;
  onEdit?: () => void;
  onDelete?: () => void;
}

// Carte d'un projet : état, type, période et responsables lisibles en entier (la couleur du projet borde la carte)
export function ProjectCard({ name, typeLabel, color, statusName, statusTone, period, members, site, priority, description, onEdit, onDelete }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--mx-space-8)', minWidth: 0, width: '100%', padding: 'var(--mx-space-12)',
      background: 'var(--mx-surface2)', border: 'var(--mx-border-w) solid var(--mx-border)', borderLeft: `4px solid ${color}`, borderRadius: 'var(--mx-radius-8)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--mx-space-8)' }}>
        <h3 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 'calc(15px * var(--mx-scale, 1))', fontWeight: 700, overflowWrap: 'anywhere' }}>{name}</h3>
        <MxBadge tone={statusTone}>{statusName}</MxBadge>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4, fontSize: 'calc(13px * var(--mx-scale, 1))' }}>
        <li style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><FolderKanban size={14} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} /> <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}><span>{typeLabel}</span>{priority && <> · <span>Priorité :</span> <span>{priority}</span></>}</span></li>
        <li style={{ display: 'flex', gap: 6, alignItems: 'center' }}><CalendarRange size={14} aria-hidden /> <span>{period}</span></li>
        <li style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Users size={14} aria-hidden /> <span>{members}</span></li>
        {site && <li style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><Link2 size={14} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} /> <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}><span>Chantier :</span> <span>{site}</span></span></li>}
      </ul>
      {description && <p style={{ margin: 0, fontSize: 'calc(12px * var(--mx-scale, 1))', color: 'var(--mx-text3)', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{description}</p>}
      {(onEdit || onDelete) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--mx-space-8)', marginTop: 'auto' }}>
          {onEdit && <Button size="sm" variant="outline" icon={<Pencil size={14} />} onClick={onEdit}>Modifier</Button>}
          {onDelete && <Button size="sm" variant="outline" icon={<Trash2 size={14} />} onClick={onDelete}>Supprimer</Button>}
        </div>
      )}
    </div>
  );
}
