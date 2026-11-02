import type { KeyboardEvent } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BookMarked, CheckCircle, type LucideIcon } from 'lucide-react';
import { MxBadge } from '../mx/MxBadge';
import { MX_TONE_FILL, type MxTone } from '../mx/tokens';
import type { StockNotification } from '../../types';

// Date relative courte : « à l'instant », « il y a 5 min », « il y a 3 h », « il y a 2 j », puis la date complète
const relativeDate = (iso: string, now = Date.now()): string => {
  const diff = now - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'à l\'instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return format(new Date(iso), 'dd.MM.yyyy', { locale: fr });
};

interface Props {
  notification: StockNotification;
  familyLabel: string;
  tone: MxTone;
  icon: LucideIcon;
  onOpen: () => void;
  onToggleRead: () => void;
}

/**
 * Carte de notification : pensée pour LIRE un avis, pas pour présenter une personne.
 * Famille (couleur + icône) · titre · message en entier · date relative · point « non lue » · action sur la carte.
 */
export function NotificationCard({ notification: n, familyLabel, tone, icon: Icon, onOpen, onToggleRead }: Props) {
  const fill = MX_TONE_FILL[tone];
  const unread = !n.read;
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // Entrée sur le bouton interne = le bouton, pas la carte
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      data-mx-focus=""
      data-unread={unread ? 'true' : 'false'}
      aria-label={`${unread ? 'Non lue : ' : ''}${n.title}`}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column', gap: 'var(--mx-space-8)', minWidth: 0, width: '100%',
        padding: 'var(--mx-space-12)', textAlign: 'left', cursor: 'pointer',
        background: 'var(--mx-surface2)',
        border: 'var(--mx-border-w) solid var(--mx-border)', borderLeft: `4px solid ${fill.bg}`,
        borderRadius: 'var(--mx-radius-8)', opacity: unread ? 1 : 0.8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--mx-space-8)' }}>
        <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, flexShrink: 0, borderRadius: '50%', background: fill.bg, color: fill.fg }}>
          <Icon size={15} />
        </span>
        <span style={{ fontSize: 'calc(11px * var(--mx-scale, 1))', fontWeight: 600, color: 'var(--mx-text3)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{familyLabel}</span>
        {unread && <span role="img" aria-label="Non lue" data-testid="unread-dot" style={{ width: 9, height: 9, flexShrink: 0, borderRadius: '50%', background: 'var(--mx-tone-fill-accent)' }} />}
        <time dateTime={n.createdAt} title={format(new Date(n.createdAt), 'dd.MM.yyyy HH:mm', { locale: fr })} style={{ fontSize: 'calc(11px * var(--mx-scale, 1))', color: 'var(--mx-text3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {relativeDate(n.createdAt)}
        </time>
      </div>
      <p style={{ margin: 0, fontSize: 'calc(14px * var(--mx-scale, 1))', fontWeight: unread ? 700 : 500, color: 'var(--mx-text1, inherit)', overflowWrap: 'anywhere' }}>{n.title}</p>
      <p style={{ margin: 0, fontSize: 'calc(13px * var(--mx-scale, 1))', color: 'var(--mx-text2, inherit)', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{n.message}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--mx-space-8)', marginTop: 'auto', paddingTop: 'var(--mx-space-4)' }}>
        {unread ? <MxBadge tone="accent">Non lue</MxBadge> : <MxBadge tone="neutral">Lue</MxBadge>}
        {/* Le bouton ne doit pas déclencher l'ouverture de la carte */}
        <button type="button" onClick={e => { e.stopPropagation(); onToggleRead(); }}
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20"
          style={{ borderColor: 'var(--mx-border)' }}>
          {unread ? <CheckCircle size={14} /> : <BookMarked size={14} />}
          {unread ? 'Marquer comme lue' : 'Marquer non lue'}
        </button>
      </div>
    </div>
  );
}
