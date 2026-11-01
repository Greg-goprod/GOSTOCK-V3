import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { supabase } from '../lib/supabase';
import PushToggle from '../components/common/PushToggle';
import { CheckCircle, Bell, Trash2, BookMarked as MarkAsRead } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { MxSegmented } from '../components/mx/MxSegmented';
import { MxCardGrid } from '../components/mx/MxCardGrid';
import { MxEntityCard } from '../components/mx/MxEntityCard';
import { MxBadge } from '../components/mx/MxBadge';
import PageTitle from '../components/common/PageTitle';
import { PageCommands } from '../components/Layout/ModuleHeader';

interface NotificationItem {
  id: string;
  type: 'overdue' | 'due_soon' | 'maintenance' | 'system' | 'checkout';
  title: string;
  message: string;
  date: string;
  priority: 'high' | 'medium' | 'low';
  read: boolean;
  relatedData?: {
    equipmentId?: string;
    equipmentName?: string;
    userId?: string;
    userName?: string;
    checkoutId?: string;
    dueDate?: string;
    daysOverdue?: number;
    delivery_note_id?: string;
    note_number?: string;
    user_department?: string;
    equipment_count?: number;
  };
}

const Notifications: React.FC = () => {
  const { stockNotifications, markStockNotificationRead } = useApp();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read' | 'overdue' | 'maintenance' | 'checkout'>('all');

  useEffect(() => {
    // Nettoyer les notifications stockées dans localStorage
    localStorage.removeItem('checkout_notifications');
    localStorage.removeItem('return_notifications');
    
    generateNotifications();
    
    // Écouter les nouvelles notifications de sortie
    const checkForNewCheckoutNotifications = () => {
      const checkoutNotifications = JSON.parse(localStorage.getItem('checkout_notifications') || '[]');
      if (checkoutNotifications.length > 0) {
        // Intégrer les notifications de sortie
        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const newNotifications = checkoutNotifications.filter((n: any) => !existingIds.has(n.id));
          return [...newNotifications, ...prev];
        });
      }
    };

    // Vérifier périodiquement les nouvelles notifications
    const interval = setInterval(checkForNewCheckoutNotifications, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const generateNotifications = async () => {
    try {
      setLoading(true);
      const generatedNotifications: NotificationItem[] = [];

      // 1. Récupérer les emprunts en retard
      const { data: overdueCheckouts, error: overdueError } = await supabase
        .from('checkouts')
        .select(`
          *,
          equipment(name, serial_number),
          users(first_name, last_name)
        `)
        .in('status', ['active', 'overdue'])
        .lt('due_date', new Date().toISOString());

      if (overdueError) throw overdueError;

      // Créer des notifications pour les retards
      overdueCheckouts?.forEach(checkout => {
        const daysOverdue = differenceInDays(new Date(), new Date(checkout.due_date));
        generatedNotifications.push({
          id: `overdue-${checkout.id}`,
          type: 'overdue',
          title: 'Matériel en retard',
          message: `${checkout.equipment?.name || 'Équipement inconnu'} emprunté par ${checkout.users?.first_name} ${checkout.users?.last_name} est en retard de ${daysOverdue} jour(s)`,
          date: new Date().toISOString(),
          priority: daysOverdue > 7 ? 'high' : daysOverdue > 3 ? 'medium' : 'low',
          read: false,
          relatedData: {
            equipmentId: checkout.equipment_id,
            equipmentName: checkout.equipment?.name,
            userId: checkout.user_id,
            userName: `${checkout.users?.first_name} ${checkout.users?.last_name}`,
            checkoutId: checkout.id,
            dueDate: checkout.due_date,
            daysOverdue
          }
        });
      });

      // 2. Récupérer les emprunts qui arrivent à échéance dans les 3 prochains jours
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const { data: dueSoonCheckouts, error: dueSoonError } = await supabase
        .from('checkouts')
        .select(`
          *,
          equipment(name, serial_number),
          users(first_name, last_name)
        `)
        .eq('status', 'active')
        .gte('due_date', new Date().toISOString())
        .lte('due_date', threeDaysFromNow.toISOString());

      if (dueSoonError) throw dueSoonError;

      // Créer des notifications pour les échéances proches
      dueSoonCheckouts?.forEach(checkout => {
        const daysUntilDue = differenceInDays(new Date(checkout.due_date), new Date());
        generatedNotifications.push({
          id: `due-soon-${checkout.id}`,
          type: 'due_soon',
          title: 'Retour prévu bientôt',
          message: `${checkout.equipment?.name || 'Équipement inconnu'} emprunté par ${checkout.users?.first_name} ${checkout.users?.last_name} doit être retourné dans ${daysUntilDue} jour(s)`,
          date: new Date().toISOString(),
          priority: daysUntilDue <= 1 ? 'high' : 'medium',
          read: false,
          relatedData: {
            equipmentId: checkout.equipment_id,
            equipmentName: checkout.equipment?.name,
            userId: checkout.user_id,
            userName: `${checkout.users?.first_name} ${checkout.users?.last_name}`,
            checkoutId: checkout.id,
            dueDate: checkout.due_date
          }
        });
      });

      // 3. Récupérer les équipements en maintenance depuis plus de 30 jours
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: maintenanceEquipment, error: maintenanceError } = await supabase
        .from('equipment')
        .select('*')
        .eq('status', 'maintenance')
        .lt('created_at', thirtyDaysAgo.toISOString());

      if (maintenanceError) throw maintenanceError;

      // Créer des notifications pour les maintenances prolongées
      maintenanceEquipment?.forEach(equipment => {
        const daysInMaintenance = differenceInDays(new Date(), new Date(equipment.created_at));
        generatedNotifications.push({
          id: `maintenance-${equipment.id}`,
          type: 'maintenance',
          title: 'Maintenance prolongée',
          message: `${equipment.name} est en maintenance depuis ${daysInMaintenance} jours`,
          date: new Date().toISOString(),
          priority: daysInMaintenance > 60 ? 'high' : 'medium',
          read: false,
          relatedData: {
            equipmentId: equipment.id,
            equipmentName: equipment.name
          }
        });
      });

      // 4. Récupérer les notifications de sortie depuis localStorage
      const checkoutNotifications = JSON.parse(localStorage.getItem('checkout_notifications') ||'[]');
      generatedNotifications.push(...checkoutNotifications);

      // 5. Ajouter notification système si aucune notification
      if (generatedNotifications.length === 0) {
        generatedNotifications.push({
          id: 'system-welcome',
          type: 'system',
          title: 'Système de notifications actif',
          message: 'Le système de notifications surveille automatiquement les retards, les maintenances prolongées et les mouvements de sortie.',
          date: new Date().toISOString(),
          priority: 'low',
          read: false
        });
      }

      // Trier par priorité et date
      generatedNotifications.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setNotifications(generatedNotifications);
    } catch (error: any) {
      console.error('Error generating notifications:', error);
      toast.error('Erreur lors du chargement des notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
    toast.success('Notification marquée comme lue');
  };

  const markAsUnread = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, read: false } : notif
      )
    );
    toast.success('Notification marquée comme non lue');
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
    toast.success('Toutes les notifications ont été marquées comme lues');
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev =>
      prev.filter(notif => notif.id !== notificationId)
    );
    
    // Si c'est une notification de sortie, la supprimer aussi du localStorage
    if (notificationId.startsWith('checkout-')) {
      const checkoutNotifications = JSON.parse(localStorage.getItem('checkout_notifications') || '[]');
      const updatedNotifications = checkoutNotifications.filter((n: any) => n.id !== notificationId);
      localStorage.setItem('checkout_notifications', JSON.stringify(updatedNotifications));
    }
    
    toast.success('Notification supprimée');
  };

  const getFilteredNotifications = () => {
    switch (filter) {
      case 'unread':
        return notifications.filter(n => !n.read);
      case 'read':
        return notifications.filter(n => n.read);
      case 'overdue':
        return notifications.filter(n => n.type === 'overdue');
      case 'maintenance':
        return notifications.filter(n => n.type === 'maintenance');
      case 'checkout':
        return notifications.filter(n => n.type === 'checkout');
      default:
        return notifications;
    }
  };

  const filteredNotifications = getFilteredNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;
  const readCount = notifications.filter(n => n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400 font-medium">Chargement des notifications...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
          <PageTitle>Notifications</PageTitle>
          <p className="text-gray-600 dark:text-gray-400 mt-1 font-medium">
            Événements spéciaux, rappels de retard et mouvements de matériel
          </p>
          <div className="mt-2"><PushToggle /></div>
      </div>
      <PageCommands
        filters={<MxSegmented aria-label="Filtre" value={filter} onChange={v => setFilter(v as typeof filter)} options={[
          { value: 'all', label: `Toutes (${notifications.length})` },
          { value: 'unread', label: `Non lues (${unreadCount})` },
          { value: 'read', label: `Lues (${readCount})` },
          { value: 'checkout', label: `Sorties (${notifications.filter(n => n.type === 'checkout').length})` },
          { value: 'overdue', label: `En retard (${notifications.filter(n => n.type === 'overdue').length})` },
          { value: 'maintenance', label: `Maintenances (${notifications.filter(n => n.type === 'maintenance').length})` },
        ]} />}
        primary={<div className="flex flex-wrap gap-2">
        <Button variant="outline" icon={<CheckCircle size={16} />} onClick={markAllAsRead} disabled={unreadCount === 0}>Tout marquer comme lu</Button>
        <Button icon={<Bell size={16} />} onClick={generateNotifications}>Actualiser</Button>
      </div>} />

      {/* Alertes créées par la base : stock bas, demandes à valider, échéances de véhicules */}
      {stockNotifications.length > 0 && (
        <Card>
          <div className="space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h2 className="font-bold text-gray-900 dark:text-white">Alertes ({stockNotifications.length})</h2>
              <div className="flex flex-wrap gap-3 text-sm font-medium">
                <Link to="/commande" className="text-primary-700 dark:text-primary-300 hover:underline">Feuille de commande</Link>
                <Link to="/checkouts" className="text-primary-700 dark:text-primary-300 hover:underline">Sorties</Link>
                <Link to="/demandes" className="text-primary-700 dark:text-primary-300 hover:underline">Demandes</Link>
                <Link to="/vehicules" className="text-primary-700 dark:text-primary-300 hover:underline">Véhicules</Link>
              </div>
            </div>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {stockNotifications.map(n => (
                <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{n.message}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{format(new Date(n.createdAt), "d MMM yyyy 'à' HH:mm", { locale: fr })}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => markStockNotificationRead(n.id)}>Marquer comme lu</Button>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {/* Liste des notifications */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Bell size={48} className="mx-auto text-gray-500 dark:text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Aucune notification
              </h3>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                {filter === 'all' 
                  ? 'Aucune notification pour le moment.'
                  : filter === 'unread' 
                  ? 'Aucune notification non lue.'
                  : filter === 'read'
                  ? 'Aucune notification lue.'
                  : filter === 'checkout'
                  ? 'Aucune notification de sortie.'
                  : filter === 'overdue' 
                  ? 'Aucune notification de retard.' 
                  : 'Aucune notification de maintenance.'
                }
              </p>
            </div>
          </Card>
        ) : (
          <MxCardGrid
            items={filteredNotifications}
            getItemKey={n => n.id}
            renderItem={n => {
              const rd = n.relatedData ?? {};
              const info = [rd.equipmentName, rd.userName, rd.note_number, rd.equipment_count ? `${rd.equipment_count} équipement${rd.equipment_count > 1 ? 's' : ''}` : '', rd.daysOverdue ? `${rd.daysOverdue} jour(s) de retard` : ''].filter(Boolean).join(' · ');
              return (
                <MxEntityCard
                  avatarName={n.title}
                  title={n.title}
                  infoParts={[
                    { content: n.message },
                    { content: `${format(new Date(n.date), 'dd.MM.yyyy HH:mm', { locale: fr })}${info ? ` · ${info}` : ''}` },
                  ]}
                  statusBadge={<span className="inline-flex gap-1">
                    <MxBadge tone={n.priority === 'high' ? 'danger' : n.priority === 'medium' ? 'warning' : 'info'}>{n.priority === 'high' ? 'Urgent' : n.priority === 'medium' ? 'Important' : 'Info'}</MxBadge>
                    {n.read ? <MxBadge tone="neutral">Lue</MxBadge> : <MxBadge tone="accent">Non lue</MxBadge>}
                  </span>}
                  menuLabel={`Actions pour ${n.title}`}
                  menuActions={[
                    n.read
                      ? { id: 'unread', label: 'Marquer non lue', icon: MarkAsRead, onSelect: () => markAsUnread(n.id) }
                      : { id: 'read', label: 'Marquer comme lue', icon: CheckCircle, onSelect: () => markAsRead(n.id) },
                    { id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger' as const, onSelect: () => deleteNotification(n.id) },
                  ]}
                  onOpen={() => (n.read ? markAsUnread(n.id) : markAsRead(n.id))}
                />
              );
            }}
          />
        )}
      </div>

      {/* Statistiques */}
      {notifications.length > 0 && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {notifications.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-bold">
                Total notifications
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-semibold text-primary-600 dark:text-primary-400">
                {unreadCount}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-bold">
                Non lues
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-semibold text-tone-success">
                {readCount}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-bold">
                Lues
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-semibold text-tone-success">
                {notifications.filter(n => n.type === 'checkout').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-bold">
                Sorties
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-semibold text-tone-danger">
                {notifications.filter(n => n.type === 'overdue').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-bold">
                Retards
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-semibold text-tone-warning">
                {notifications.filter(n => n.type === 'due_soon').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-bold">
                Échéances
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Notifications;