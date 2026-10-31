import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card';
import StatusBadge from '../components/common/StatusBadge';
import CheckoutModal from '../components/checkout/CheckoutModal';
import ReturnModal from '../components/checkout/ReturnModal';
import MaintenanceModal from '../components/maintenance/MaintenanceModal';
import { 
  AlertTriangle, 
  Package, 
  CheckSquare, 
  Bell, 
  LogOut,
  LogIn,
  RefreshCw,
  AlertCircle,
  Wrench,
  Calendar,
  Clock,
  Wifi,
  WifiOff,
  Settings,
  ExternalLink
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, testSupabaseConnection } from '../lib/supabase';
import { Equipment } from '../types';
import Button from '../components/common/Button';
import { MxBadge } from '../components/mx/MxBadge';
import PageTitle from '../components/common/PageTitle';

const Dashboard: React.FC = () => {
  const { t } = useLanguage();
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [stats, setStats] = useState({
    availableEquipment: 0,
    checkedOutEquipment: 0,
    overdueEquipment: 0,
    maintenanceEquipment: 0,
    unreadNotifications: 0
  });
  interface RecentCheckout {
    id: string;
    checkout_date: string;
    due_date: string;
    status: string;
    equipment?: { name: string };
    users?: { first_name: string; last_name: string };
  }
  const [recentCheckouts, setRecentCheckouts] = useState<RecentCheckout[]>([]);
  interface MaintenanceEquipment {
    id: string;
    name: string;
    serial_number: string | null;
    article_number: string | null;
    last_maintenance: string | null;
    equipment_maintenance: {
      id: string;
      title: string;
      start_date: string;
      status: string;
      maintenance_types?: { name: string; color: string } | null;
    }[];
  }
  const [maintenanceEquipment, setMaintenanceEquipment] = useState<MaintenanceEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing' | 'config_error'>('testing');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    fetchDashboardData();
    
    // Écouter les changements dans localStorage pour les notifications
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'checkout_notifications' || e.key === 'return_notifications') {
        // Rafraîchir les données quand il y a de nouvelles notifications
        fetchDashboardData();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Rafraîchir automatiquement toutes les 30 secondes
    const interval = setInterval(() => {
      fetchDashboardData(true); // true = silent refresh
    }, 30000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Écouter les changements de focus de la fenêtre pour rafraîchir
  useEffect(() => {
    const handleFocus = () => {
      fetchDashboardData(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      } else {
        setRefreshing(true);
      }

      setConnectionStatus('testing');

      // Vérifier si Supabase est configuré
      if (!supabase) {
        setConnectionStatus('config_error');
        throw new Error('Configuration Supabase manquante. Configure tes variables d\'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans le fichier .env');
      }

      // Vérifier si les variables d'environnement sont configurées
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        setConnectionStatus('config_error');
        throw new Error('Variables d\'environnement Supabase non configurées. Crée un fichier .env avec VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.');
      }

      // Vérifier si ce sont les valeurs par défaut
      if (import.meta.env.VITE_SUPABASE_URL.includes('votre-projet.supabase.co') || 
          import.meta.env.VITE_SUPABASE_ANON_KEY.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')) {
        setConnectionStatus('config_error');
        throw new Error('Remplace les valeurs par défaut dans le fichier .env par tes vraies valeurs Supabase.');
      }

      // Test connection first with improved error handling
      const connectionTest = await testSupabaseConnection();

      if (!connectionTest.success) {
        if (connectionTest.error?.includes('Configuration Supabase invalide') || 
            connectionTest.error?.includes('valeurs par défaut') ||
            connectionTest.error?.includes('Variables d\'environnement') ||
            connectionTest.error?.includes('Clé API Supabase invalide')) {
          setConnectionStatus('config_error');
        } else {
          setConnectionStatus('disconnected');
        }
        throw new Error(connectionTest.error || 'Connection failed');
      }

      setConnectionStatus('connected');
      setRetryCount(0);

      // Fetch equipment avec timeout et retry logic
      const fetchWithTimeout = async <T,>(query: PromiseLike<T>, timeoutMs = 10000): Promise<T> => {
        return Promise.race([
          query,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
          )
        ]);
      };

      // Fetch equipment avec les quantités réelles
      const { data: equipment, error: equipmentError } = await fetchWithTimeout(
        supabase
          .from('equipment')
          .select('id, status, total_quantity, available_quantity')
      ) as any;

      if (equipmentError) {
        throw new Error(`Equipment fetch failed: ${equipmentError.message}`);
      }

      // Fetch active checkouts pour calculer les emprunts réels
      const { data: activeCheckouts, error: checkoutsError } = await fetchWithTimeout(
        supabase
          .from('checkouts')
          .select('equipment_id')
          .eq('status', 'active')
      ) as any;

      if (checkoutsError) {
        throw new Error(`Checkouts fetch failed: ${checkoutsError.message}`);
      }

      // Calculer les statistiques réelles
      let totalAvailable = 0;
      let totalCheckedOut = 0;
      let maintenanceCount = 0;

      if (equipment) {
        equipment.forEach((eq: any) => {
          const available = eq.available_quantity || 0;
          const borrowed = activeCheckouts?.filter((c: any) => c.equipment_id === eq.id).length || 0;
          
          totalAvailable += available;
          totalCheckedOut += borrowed;
          
          if (eq.status === 'maintenance') {
            maintenanceCount += 1;
          }
        });
      }

      // Fetch overdue checkouts
      const { data: overdueCheckouts, error: overdueError } = await fetchWithTimeout(
        supabase
          .from('checkouts')
          .select('id')
          .eq('status', 'active')
          .lt('due_date', new Date().toISOString())
      );

      if (overdueError) {
        throw new Error(`Overdue checkouts fetch failed: ${overdueError.message}`);
      }

      // Fetch recent checkouts with user and equipment info
      const { data: checkouts, error: recentCheckoutsError } = await fetchWithTimeout(
        supabase
          .from('checkouts')
          .select(`
            id,
            checkout_date,
            due_date,
            status,
            equipment!inner(name),
            users!inner(first_name, last_name)
          `)
          .in('status', ['active', 'overdue'])
          .order('checkout_date', { ascending: false })
          .limit(5)
      );

      if (recentCheckoutsError) {
        console.warn('Recent checkouts fetch failed:', recentCheckoutsError.message);
        // Don't fail the entire dashboard if recent checkouts fail
      }

      // Fetch equipment in maintenance with maintenance details
      const { data: maintenanceData, error: maintenanceError } = await fetchWithTimeout(
        supabase
          .from('equipment')
          .select(`
            id,
            name,
            serial_number,
            article_number,
            last_maintenance,
            equipment_maintenance!inner(
              id,
              title,
              start_date,
              status,
              maintenance_types(name, color)
            )
          `)
          .eq('status', 'maintenance')
          .eq('equipment_maintenance.status', 'in_progress')
          .limit(10)
      );

      if (maintenanceError) {
        console.warn('Maintenance fetch error:', maintenanceError.message);
        // Ne pas faire échouer le dashboard si les maintenances ne se chargent pas
      }

      // Sort maintenance data by start_date in JavaScript since we can't order by related table fields
      let sortedMaintenanceData = maintenanceData || [];
      if (sortedMaintenanceData.length > 0) {
        sortedMaintenanceData = sortedMaintenanceData.sort((a: any, b: any) => {
          const aDate = new Date(a.equipment_maintenance[0]?.start_date || 0);
          const bDate = new Date(b.equipment_maintenance[0]?.start_date || 0);
          return bDate.getTime() - aDate.getTime(); // Descending order (most recent first)
        });
      }

      // Compter les notifications non lues
      let unreadNotificationsCount = 0;
      try {
        const checkoutNotifications = JSON.parse(localStorage.getItem('checkout_notifications') || '[]');
        unreadNotificationsCount = checkoutNotifications.filter((n: any) => !n.read).length;
      } catch (e) {
        console.warn('Error reading notifications from localStorage:', e);
      }

      setStats({
        availableEquipment: totalAvailable,
        checkedOutEquipment: totalCheckedOut,
        overdueEquipment: overdueCheckouts?.length || 0,
        maintenanceEquipment: maintenanceCount,
        unreadNotifications: unreadNotificationsCount
      });

      // Sans types générés, supabase-js type les jointures « plusieurs vers un » comme des tableaux ;
      // la base renvoie bien un objet (equipment, users, maintenance_types)
      setRecentCheckouts((checkouts || []) as unknown as RecentCheckout[]);
      setMaintenanceEquipment(sortedMaintenanceData as unknown as MaintenanceEquipment[]);
      setError(null);

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      
      let errorMessage = 'Une erreur est survenue lors du chargement des données';
      
      if (error.message?.includes('Configuration Supabase manquante')) {
        errorMessage = 'Configuration Supabase manquante. Configure tes variables d\'environnement.';
      } else if (error.message?.includes('Variables d\'environnement Supabase non configurées')) {
        errorMessage = 'Variables d\'environnement Supabase non configurées. Crée un fichier .env avec tes clés Supabase.';
      } else if (error.message?.includes('Remplace les valeurs par défaut')) {
        errorMessage = 'Remplace les valeurs par défaut dans le fichier .env par tes vraies valeurs Supabase.';
      } else if (error.message?.includes('Connection timeout') || error.message?.includes('Délai de connexion') || error.message?.includes('Request timeout')) {
        errorMessage = 'Délai de connexion dépassé. Vérifie ta connexion internet et l\'URL Supabase.';
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('Impossible de se connecter')) {
        errorMessage = 'Impossible de se connecter au serveur. Vérifie ta connexion internet et les paramètres Supabase.';
      } else if (error.message?.includes('Invalid URL')) {
        errorMessage = 'URL Supabase invalide. Vérifie ta configuration dans le fichier .env';
      } else if (error.message?.includes('Clé API Supabase invalide')) {
        errorMessage = 'Clé API Supabase invalide. Vérifie ta VITE_SUPABASE_ANON_KEY dans le fichier .env';
      } else if (error.message?.includes('Serveur Supabase inaccessible')) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      setRetryCount(prev => prev + 1);
      
      // Set default values on error
      setStats({
        availableEquipment: 0,
        checkedOutEquipment: 0,
        overdueEquipment: 0,
        maintenanceEquipment: 0,
        unreadNotifications: 0
      });
      setRecentCheckouts([]);
      setMaintenanceEquipment([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    fetchDashboardData();
  };

  const handleCheckoutModalClose = () => {
    setShowCheckoutModal(false);
    // Rafraîchir les données après fermeture du modal de sortie
    setTimeout(() => {
      fetchDashboardData();
    }, 500);
  };

  const handleReturnModalClose = () => {
    setShowReturnModal(false);
    // Rafraîchir les données après fermeture du modal de retour
    setTimeout(() => {
      fetchDashboardData();
    }, 500);
  };

  const handleMaintenanceClick = (equipment: any) => {
    setSelectedEquipment({
      id: equipment.id,
      name: equipment.name,
      serialNumber: equipment.serial_number,
      articleNumber: equipment.article_number,
      status: 'maintenance',
      description: '',
      category: '',
      addedDate: '',
      location: '',
      qrType: 'individual',
      totalQuantity: 1,
      availableQuantity: 0
    });
    setShowMaintenanceModal(true);
  };

  const handleMaintenanceModalClose = () => {
    setShowMaintenanceModal(false);
    setSelectedEquipment(null);
    // Rafraîchir les données après fermeture du modal de maintenance
    setTimeout(() => {
      fetchDashboardData();
    }, 500);
  };

  // Nettoyer les notifications stockées dans localStorage
  useEffect(() => {
    // Vider les notifications au chargement du dashboard
    localStorage.removeItem('checkout_notifications');
    localStorage.removeItem('return_notifications');
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw size={28} className="mx-auto animate-spin text-primary-600 mb-3" />
          <div className="text-gray-500 dark:text-gray-400 text-sm">{t('loading')}</div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {connectionStatus === 'testing' ? 'Test de connexion...' : 'Chargement des données...'}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <PageTitle>Statistiques</PageTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {connectionStatus === 'connected' ? (
                <Wifi size={14} className="text-success-500" />
              ) : connectionStatus === 'config_error' ? (
                <Settings size={14} className="text-warning-500" />
              ) : (
                <WifiOff size={14} className="text-danger-500" />
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {connectionStatus === 'connected' ? 'Connecté' : 
                 connectionStatus === 'config_error' ? 'Configuration' : 'Déconnecté'}
              </span>
            </div>
            {connectionStatus !== 'config_error' && (
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
                onClick={handleManualRefresh}
                disabled={refreshing}
              >
                {refreshing ? 'Reconnexion...' : 'Réessayer'}
              </Button>
            )}
          </div>
        </div>
        
        <Card className="p-6">
          <div className="text-center">
            {connectionStatus === 'config_error' ? (
              <Settings size={36} className="mx-auto text-warning-500 mb-3" />
            ) : (
              <AlertCircle size={36} className="mx-auto text-danger-500 mb-3" />
            )}
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
              {connectionStatus === 'config_error' ? 'Configuration Supabase requise' : 'Erreur de connexion'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {error}
            </p>
            {retryCount > 0 && connectionStatus !== 'config_error' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Tentatives de reconnexion: {retryCount}
              </p>
            )}
            <div className="space-y-3">
              {connectionStatus !== 'config_error' && (
                <Button
                  variant="primary"
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                  icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
                >
                  {refreshing ? 'Reconnexion...' : 'Réessayer'}
                </Button>
              )}
              
              <div className="text-left bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  {connectionStatus === 'config_error' ? 'Configuration Supabase:' : 'Vérifications à effectuer:'}
                </h4>
                <div className="space-y-2 text-gray-600 dark:text-gray-400">
                  {connectionStatus === 'config_error' ? (
                    <>
                      <div className="space-y-1">
                        <p className="font-medium">1. Vérifie ton projet Supabase:</p>
                        <a 
                          href="https://supabase.com/dashboard" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-1 text-primary-600 hover:underline text-sm"
                        >
                          <ExternalLink size={12} />
                          Ouvrir le dashboard Supabase
                        </a>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">2. Vérifie tes clés API:</p>
                        <ul className="text-xs space-y-1 ml-4">
                          <li>• Va dans Settings → API</li>
                          <li>• Vérifie que "Project URL" et "anon public key" sont corrects</li>
                          <li>• Assure-toi que le projet est actif et accessible</li>
                        </ul>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">3. Vérifie le fichier .env:</p>
                        <ul className="text-xs space-y-1 ml-4">
                          <li>• Vérifie que VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont corrects</li>
                          <li>• Redémarre le serveur: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">npm run dev</code></li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      <li>• Vérifie ta connexion internet</li>
                      <li>• Vérifie que ton projet Supabase est actif et accessible</li>
                      <li>• Vérifie que les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont correctes</li>
                      <li>• Consulte la console pour plus de détails</li>
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div>
            <PageTitle>Statistiques</PageTitle>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Disponibilités, emprunts récents et matériel en maintenance.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {connectionStatus === 'connected' ? (
                <Wifi size={14} className="text-success-500" />
              ) : (
                <WifiOff size={14} className="text-danger-500" />
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {connectionStatus === 'connected' ? 'Connecté' : 'Déconnecté'}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
              onClick={handleManualRefresh}
              disabled={refreshing}
            >
              {refreshing ? 'Actualisation...' : 'Actualiser'}
            </Button>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 max-w-xs">
            <Button size="lg" fullWidth icon={<LogOut size={18} />} onClick={() => setShowCheckoutModal(true)} disabled={connectionStatus !== 'connected'}>
              Sortie
            </Button>
          </div>
          <div className="flex-1 max-w-xs">
            <Button size="lg" variant="secondary" fullWidth icon={<LogIn size={18} />} onClick={() => setShowReturnModal(true)} disabled={connectionStatus !== 'connected'}>
              Retour
            </Button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="flex items-center p-3 hover:shadow-md transition-shadow">
          <div className="rounded-full bg-primary-100 dark:bg-primary-900/50 p-2 mr-3">
            <Package size={20} className="text-primary-600 dark:text-primary-300" />
          </div>
          <div>
            <p className="mx-section-label">Disponible</p>
            <p className="text-xl font-bold text-gray-800 dark:text-white">
              {stats.availableEquipment}
              {refreshing && <RefreshCw size={14} className="inline ml-2 animate-spin text-gray-500 dark:text-gray-400" />}
            </p>
          </div>
        </Card>
        
        <Card className="flex items-center p-3 hover:shadow-md transition-shadow">
          <div className="rounded-full bg-success-100 dark:bg-success-900/50 p-2 mr-3">
            <CheckSquare size={20} className="text-tone-success" />
          </div>
          <div>
            <p className="mx-section-label">Emprunté</p>
            <p className="text-xl font-bold text-gray-800 dark:text-white">
              {stats.checkedOutEquipment}
              {refreshing && <RefreshCw size={14} className="inline ml-2 animate-spin text-gray-500 dark:text-gray-400" />}
            </p>
          </div>
        </Card>
        
        <Card className="flex items-center p-3 hover:shadow-md transition-shadow">
          <div className="rounded-full bg-warning-100 dark:bg-warning-900/50 p-2 mr-3">
            <AlertTriangle size={20} className="text-tone-warning" />
          </div>
          <div>
            <p className="mx-section-label">En retard</p>
            <p className="text-xl font-bold text-gray-800 dark:text-white">
              {stats.overdueEquipment}
              {refreshing && <RefreshCw size={14} className="inline ml-2 animate-spin text-gray-500 dark:text-gray-400" />}
            </p>
          </div>
        </Card>

        <Card className="flex items-center p-3 hover:shadow-md transition-shadow">
          <div className="rounded-full bg-primary-100 dark:bg-primary-900/50 p-2 mr-3">
            <Wrench size={20} className="text-primary-600 dark:text-primary-300" />
          </div>
          <div>
            <p className="mx-section-label">Maintenance</p>
            <p className="text-xl font-bold text-gray-800 dark:text-white">
              {stats.maintenanceEquipment}
              {refreshing && <RefreshCw size={14} className="inline ml-2 animate-spin text-gray-500 dark:text-gray-400" />}
            </p>
          </div>
        </Card>
        
        <Card className="flex items-center p-3 hover:shadow-md transition-shadow">
          <div className="rounded-full bg-danger-100 dark:bg-danger-900/50 p-2 mr-3">
            <Bell size={20} className="text-tone-danger" />
          </div>
          <div>
            <p className="mx-section-label">Notifications</p>
            <p className="text-xl font-bold text-gray-800 dark:text-white">
              {stats.unreadNotifications}
              {refreshing && <RefreshCw size={14} className="inline ml-2 animate-spin text-gray-500 dark:text-gray-400" />}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Emprunts récents */}
        <Card title="Emprunts récents">
          {recentCheckouts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-compact">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Matériel
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Utilisateur
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date sortie
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date retour
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {recentCheckouts.map(checkout => {
                    
                    return (
                      <tr key={checkout.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-gray-100">
                          {checkout.equipment?.name || 'Matériel inconnu'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-gray-100">
                          {checkout.users ? `${checkout.users.first_name} ${checkout.users.last_name}` : 'Utilisateur inconnu'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 font-medium">
                          {new Date(checkout.checkout_date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 font-medium">
                          {new Date(checkout.due_date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          <StatusBadge status={checkout.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6">
              <Package size={32} className="mx-auto text-gray-500 dark:text-gray-400 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Aucun emprunt actif</p>
            </div>
          )}
        </Card>

        {/* Matériel en maintenance */}
        <Card title="Matériel en maintenance">
          {maintenanceEquipment.length > 0 ? (
            <div className="space-y-2">
              {maintenanceEquipment.map(equipment => {
                const maintenance = equipment.equipment_maintenance[0];
                const daysSinceMaintenance = Math.floor(
                  (new Date().getTime() - new Date(maintenance.start_date).getTime()) / (1000 * 60 * 60 * 24)
                );
                
                return (
                  <div 
                    key={equipment.id} 
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    onClick={() => handleMaintenanceClick(equipment)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-1 mb-1">
                          <Wrench size={14} className="text-primary-600 dark:text-primary-400" />
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                            {equipment.name}
                          </h4>
                          {/* Couleur du type (choisie dans les paramètres) en pastille ; texte au ton neutre de la charte */}
                          <MxBadge tone="neutral">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: maintenance.maintenance_types?.color || 'var(--mx-cyan)' }} aria-hidden="true" />
                            {maintenance.maintenance_types?.name || 'Maintenance'}
                          </MxBadge>
                        </div>
                        
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          {maintenance.title}
                        </p>
                        
                        <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Calendar size={10} />
                            <span>Début: {new Date(maintenance.start_date).toLocaleDateString('fr-FR')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock size={10} />
                            <span className={daysSinceMaintenance > 7 ? 'text-tone-danger font-medium' : ''}>
                              {daysSinceMaintenance} jour{daysSinceMaintenance > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                          {equipment.serial_number}
                        </p>
                        {daysSinceMaintenance > 7 && (
                          <div className="flex items-center gap-1 text-tone-danger text-[10px] font-medium mt-1">
                            <AlertTriangle size={10} />
                            <span>Maintenance prolongée</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <Wrench size={32} className="mx-auto text-gray-500 dark:text-gray-400 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Aucun matériel en maintenance</p>
            </div>
          )}
        </Card>
      </div>

      {/* Modals */}
      <CheckoutModal
        isOpen={showCheckoutModal}
        onClose={handleCheckoutModalClose}
      />

      <ReturnModal
        isOpen={showReturnModal}
        onClose={handleReturnModalClose}
      />

      {selectedEquipment && (
        <MaintenanceModal
          isOpen={showMaintenanceModal}
          onClose={handleMaintenanceModalClose}
          equipment={selectedEquipment}
        />
      )}
    </div>
  );
};

export default Dashboard;