import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import PushToggle from '../components/common/PushToggle';
import { CheckCircle, Bell, BookMarked as MarkAsUnread } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MxSegmented } from '../components/mx/MxSegmented';
import { MxCardGrid } from '../components/mx/MxCardGrid';
import { MxEntityCard } from '../components/mx/MxEntityCard';
import { MxBadge } from '../components/mx/MxBadge';
import PageTitle from '../components/common/PageTitle';
import { EntityTable } from '../components/common/EntityTable';
import { MxEntityViewToggle } from '../components/mx/MxEntityViewToggle';
import { MxPagination } from '../components/mx/MxPagination';
import { readMxViewMode, writeMxViewMode } from '../components/mx/mxViewModeStorage';
import { PageCommands } from '../components/Layout/ModuleHeader';
import type { StockNotification } from '../types';

type Group = 'requests' | 'returns' | 'stock' | 'upkeep' | 'incidents' | 'other';

const GROUPS: { id: Group; label: string; empty: string; to: string }[] = [
  { id: 'requests', label: 'Demandes', empty: 'Aucune notification de demande.', to: '/demandes' },
  { id: 'returns', label: 'Retours', empty: 'Aucune notification de retour ou de prolongation.', to: '/checkouts' },
  { id: 'stock', label: 'Stock', empty: 'Aucune notification de stock.', to: '/commande' },
  { id: 'upkeep', label: 'Entretien et échéances', empty: 'Aucune notification d\'entretien ou d\'échéance.', to: '/entretien' },
  { id: 'incidents', label: 'Pertes et casse', empty: 'Aucune notification de perte ou de casse.', to: '/incidents' },
  { id: 'other', label: 'Autres', empty: 'Aucune autre notification.', to: '/notifications' },
];

// Famille d'une notification d'après son type (les types inconnus tombent dans « Autres »)
const GROUP_OF: Record<string, Group> = {
  request_to_approve: 'requests', request_approved: 'requests', request_rejected: 'requests', request_ready: 'requests',
  return_reminder: 'returns', return_overdue: 'returns', return_escalation: 'returns', loan_extended: 'returns',
  extension_request: 'returns', drop_box: 'returns', tool_found: 'returns',
  low_stock: 'stock', transfer: 'stock',
  maintenance_due: 'upkeep', vehicle_deadline: 'upkeep', warranty_end: 'upkeep', repair_late: 'upkeep', battery_end: 'upkeep',
  training_expiry: 'upkeep', rental_due: 'upkeep', ppe_renewal: 'upkeep', mission_end: 'upkeep',
  incident: 'incidents', tool_damaged: 'incidents',
};

const groupOf = (n: StockNotification): Group => GROUP_OF[n.kind] ?? 'other';

const TONE: Record<string, 'danger' | 'warning' | 'success' | 'info'> = {
  request_rejected: 'danger', return_overdue: 'danger', return_escalation: 'danger', incident: 'danger', tool_damaged: 'danger', repair_late: 'danger',
  request_to_approve: 'warning', extension_request: 'warning', low_stock: 'warning', maintenance_due: 'warning', vehicle_deadline: 'warning',
  warranty_end: 'warning', battery_end: 'warning', training_expiry: 'warning', rental_due: 'warning', ppe_renewal: 'warning', mission_end: 'warning',
  backup_due: 'warning', return_reminder: 'warning',
  request_approved: 'success', request_ready: 'success', loan_extended: 'success',
};

const Notifications: React.FC = () => {
  const { userNotifications, unreadNotificationCount, markNotificationsRead, markNotificationUnread, markAllNotificationsRead, refreshNotifications, checkouts, loadingAppData } = useApp();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [group, setGroup] = useState<'all' | Group>('all');
  const [refreshing, setRefreshing] = useState(false);
  // Vue Liste (par défaut : on lit beaucoup de lignes) ou Cartes, mémorisée ; pagination comme les autres listes
  const [viewMode, setViewModeState] = useState<'cards' | 'list'>(() => readMxViewMode('gomat-view-notifications', ['cards', 'list'] as const, 'list'));
  const [pageSize, setPageSize] = useState(() => Number(readMxViewMode('gomat-pagesize-notifications', ['24', '48', '96'] as const, '48')));
  const [page, setPage] = useState(1);
  const setViewMode = (mode: 'cards' | 'list') => { setViewModeState(mode); writeMxViewMode('gomat-view-notifications', mode); };

  const readCount = userNotifications.length - userNotifications.filter(n => !n.read).length;
  const unreadCount = userNotifications.length - readCount;

  const visible = useMemo(() => userNotifications.filter(n =>
    (status === 'all' || (status === 'unread' ? !n.read : n.read)) && (group === 'all' || groupOf(n) === group)
  ), [userNotifications, status, group]);

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const groupCounts = useMemo(() => {
    const base = userNotifications.filter(n => status === 'all' || (status === 'unread' ? !n.read : n.read));
    const counts: Record<string, number> = { all: base.length };
    for (const g of GROUPS) counts[g.id] = base.filter(n => groupOf(n) === g.id).length;
    return counts;
  }, [userNotifications, status]);

  // Situation du moment : un état calculé à l'instant, pas des notifications (il n'a pas de « lu »)
  const situation = useMemo(() => {
    const limit = Date.now() + 3 * 24 * 60 * 60 * 1000;
    const overdue = checkouts.filter(c => c.status === 'overdue').length;
    const soon = checkouts.filter(c => c.status === 'active' && c.dueDate && new Date(c.dueDate).getTime() <= limit).length;
    return { overdue, soon };
  }, [checkouts]);

  const refresh = async () => {
    setRefreshing(true);
    try { await refreshNotifications(); } finally { setRefreshing(false); }
  };

  const open = (n: StockNotification) => {
    if (!n.read) void markNotificationsRead([n.id]);
    const target = GROUPS.find(g => g.id === groupOf(n))?.to;
    if (target && target !== '/notifications') navigate(target);
  };

  const emptyText = status === 'unread' ? 'Aucune notification non lue.'
    : status === 'read' ? 'Aucune notification lue.'
    : group === 'all' ? 'Aucune notification pour le moment.'
    : GROUPS.find(g => g.id === group)?.empty ?? 'Aucune notification.';

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Notifications</PageTitle>
        <p className="text-gray-600 dark:text-gray-400 mt-1 font-medium">
          Les événements du magasin et les avis qui te concernent. Ton état « lu » est personnel : il ne change rien pour les autres.
        </p>
        <div className="mt-2"><PushToggle /></div>
      </div>
      <PageCommands
        filters={<MxSegmented aria-label="Statut" value={status} onChange={v => setStatus(v as typeof status)} options={[
          { value: 'all', label: `Toutes (${userNotifications.length})` },
          { value: 'unread', label: `Non lues (${unreadCount})` },
          { value: 'read', label: `Lues (${readCount})` },
        ]} />}
        pagination={totalPages > 1 || visible.length > 24 ? (
          <MxPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage}
            previousLabel="Page précédente" nextLabel="Page suivante" totalLabel={`${visible.length} notification(s)`}
            pageSize={pageSize} pageSizeOptions={[{ value: '24', label: '24' }, { value: '48', label: '48' }, { value: '96', label: '96' }]}
            onPageSizeChange={size => { setPageSize(size); setPage(1); writeMxViewMode('gomat-pagesize-notifications', String(size)); }}
            pageSizeLabel="Notifications par page" />
        ) : undefined}
        view={<MxEntityViewToggle value={viewMode} onChange={setViewMode} aria-label="Affichage des notifications" />}
        primary={<div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={<CheckCircle size={16} />} onClick={() => void markAllNotificationsRead()} disabled={unreadNotificationCount === 0}>Tout marquer comme lu</Button>
          <Button icon={<Bell size={16} />} onClick={() => void refresh()} disabled={refreshing}>{refreshing ? 'Actualisation…' : 'Actualiser'}</Button>
        </div>} />

      {(situation.overdue > 0 || situation.soon > 0) && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Situation du moment</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {situation.overdue > 0 && <span className="text-tone-danger font-semibold">{situation.overdue > 1 ? `${situation.overdue} sorties en retard` : `${situation.overdue} sortie en retard`}</span>}
                {situation.overdue > 0 && situation.soon > 0 && ' · '}
                {situation.soon > 0 && <span className="text-tone-warning font-semibold">{`${situation.soon} à rendre d'ici 3 jours`}</span>}
                {'. Ce n\'est pas une notification : le chiffre se met à jour tout seul quand le matériel revient.'}
              </p>
            </div>
            <Link to="/checkouts" className="text-sm font-medium text-primary-700 dark:text-primary-300 hover:underline">Voir les sorties</Link>
          </div>
        </Card>
      )}

      <MxSegmented aria-label="Famille" value={group} onChange={v => setGroup(v as typeof group)} options={[
        { value: 'all', label: `Toutes (${groupCounts.all})` },
        ...GROUPS.filter(g => groupCounts[g.id] > 0 || group === g.id).map(g => ({ value: g.id, label: `${g.label} (${groupCounts[g.id]})` })),
      ]} />

      <div className="space-y-3">
        {loadingAppData && userNotifications.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-gray-500 dark:text-gray-400 font-medium">Chargement des notifications...</div>
          </div>
        ) : visible.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Bell size={48} className="mx-auto text-gray-500 dark:text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Aucune notification</h3>
              <p className="text-gray-500 dark:text-gray-400 font-medium">{emptyText}</p>
            </div>
          </Card>
        ) : viewMode === 'list' ? (
          <EntityTable
            items={paged}
            getKey={n => n.id}
            caption="Notifications"
            onOpen={open}
            rowClassName={n => (n.read ? 'opacity-75' : 'font-medium')}
            columns={[
              { id: 'state', label: 'État', render: n => (n.read ? <MxBadge tone="neutral">Lue</MxBadge> : <MxBadge tone="accent">Non lue</MxBadge>) },
              { id: 'what', label: 'Notification', render: n => (
                <div>
                  <p className="text-gray-900 dark:text-white">{n.title}</p>
                  <p className="text-xs font-normal text-gray-600 dark:text-gray-400">{n.message}</p>
                </div>
              ) },
              { id: 'group', label: 'Famille', hideOnMobile: true, render: n => <MxBadge tone={TONE[n.kind] ?? 'info'}>{GROUPS.find(g => g.id === groupOf(n))?.label ?? 'Autres'}</MxBadge> },
              { id: 'date', label: 'Date', hideOnMobile: true, render: n => <span className="whitespace-nowrap text-xs font-normal">{format(new Date(n.createdAt), 'dd.MM.yyyy HH:mm', { locale: fr })}</span> },
              { id: 'action', label: 'Action', render: n => (
                // Le bouton ne doit pas déclencher l'ouverture de la ligne
                <span onClick={e => e.stopPropagation()}>
                  <Button size="sm" variant="outline" icon={n.read ? <MarkAsUnread size={14} /> : <CheckCircle size={14} />}
                    onClick={() => { void (n.read ? markNotificationUnread(n.id) : markNotificationsRead([n.id])); }}>
                    {n.read ? 'Marquer non lue' : 'Marquer comme lue'}
                  </Button>
                </span>
              ) },
            ]}
          />
        ) : (
          <MxCardGrid
            items={paged}
            getItemKey={n => n.id}
            renderItem={n => (
              <MxEntityCard
                avatarName={n.title}
                title={n.title}
                infoParts={[
                  { content: n.message },
                  { content: format(new Date(n.createdAt), 'dd.MM.yyyy HH:mm', { locale: fr }) },
                ]}
                statusBadge={<span className="inline-flex gap-1">
                  <MxBadge tone={TONE[n.kind] ?? 'info'}>{GROUPS.find(g => g.id === groupOf(n))?.label ?? 'Autres'}</MxBadge>
                  {n.read ? <MxBadge tone="neutral">Lue</MxBadge> : <MxBadge tone="accent">Non lue</MxBadge>}
                </span>}
                menuLabel={`Actions pour ${n.title}`}
                menuActions={[
                  n.read
                    ? { id: 'unread', label: 'Marquer non lue', icon: MarkAsUnread, onSelect: () => void markNotificationUnread(n.id) }
                    : { id: 'read', label: 'Marquer comme lue', icon: CheckCircle, onSelect: () => void markNotificationsRead([n.id]) },
                ]}
                onOpen={() => open(n)}
              />
            )}
          />
        )}
      </div>
    </div>
  );
};

export default Notifications;
