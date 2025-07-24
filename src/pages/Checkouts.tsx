import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import CheckoutModal from '../components/checkout/CheckoutModal';
import ReturnModal from '../components/checkout/ReturnModal';
import DirectReturnModal from '../components/common/DirectReturnModal';
import { 
  Plus, 
  Filter, 
  LayoutGrid, 
  List, 
  ArrowUpDown, 
  LogOut, 
  LogIn, 
  Package, 
  User, 
  Calendar, 
  AlertTriangle,
  Clock,
  CheckCircle,
  RefreshCw,
  FileText,
  Search,
  Eye,
  Building2
} from 'lucide-react';
import FilterPanel, { FilterOption } from '../components/common/FilterPanel';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { format, differenceInDays, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useApp } from '../contexts/AppContext';

interface CheckoutWithDetails {
  id: string;
  equipmentId: string;
  userId: string;
  deliveryNoteId?: string;
  checkoutDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'active' | 'returned' | 'overdue' | 'lost';
  notes?: string;
  equipment: {
    id: string;
    name: string;
    serialNumber: string;
    articleNumber?: string;
    imageUrl?: string;
  };
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    department: string;
  };
  deliveryNote?: {
    id: string;
    note_number: string;
    status: string;
  };
}

interface DeliveryNoteWithDetails {
  id: string;
  noteNumber: string;
  userId: string;
  issueDate: string;
  dueDate: string;
  status: 'active' | 'returned' | 'partial' | 'overdue';
  notes?: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    department: string;
  };
  checkouts: CheckoutWithDetails[];
  equipmentCount: number;
  returnedCount: number;
  activeCount: number;
}

type ViewMode = 'grid' | 'list';
type SortField = 'checkoutDate' | 'dueDate' | 'equipment' | 'user' | 'status';
type SortDirection = 'asc' | 'desc';

const Checkouts: React.FC = () => {
  const { t } = useLanguage();
  const [checkouts, setCheckouts] = useState<CheckoutWithDetails[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentView, setCurrentView] = useState<'checkouts' | 'delivery_notes'>('delivery_notes');
  const [sortField, setSortField] = useState<SortField>('checkoutDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDirectReturnModal, setShowDirectReturnModal] = useState(false);
  const [selectedCheckout, setSelectedCheckout] = useState<any>(null);

  const {
    checkouts: appCheckouts,
    deliveryNotes: appDeliveryNotes,
    refreshData,
    forceUpdateOverdueCheckouts
  } = useApp();

  useEffect(() => {
    fetchData();
  }, [currentView]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      if (currentView === 'checkouts') {
        await fetchCheckouts();
      } else {
        await fetchDeliveryNotes();
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const fetchCheckouts = async () => {
    const { data, error } = await supabase
      .from('checkouts')
      .select(`
        *,
        equipment(id, name, serial_number, article_number, image_url),
        users(id, first_name, last_name, email, department),
        delivery_notes(id, note_number, status)
      `)
      .order('checkout_date', { ascending: false });

    if (error) throw error;

    const transformedCheckouts: CheckoutWithDetails[] = data?.map(checkout => {
      // Check if the checkout is overdue - seulement à partir du lendemain de la date prévue
      const dueDate = new Date(checkout.due_date);
      dueDate.setHours(23, 59, 59, 999); // Fin de la journée de la date d'échéance
      
      const today = new Date();
      // Suppression de la mise à zéro des heures pour que le statut en retard apparaisse dès 00h01
      
      // Un emprunt est en retard dès 00h01 le lendemain de la date d'échéance
      const isOverdue = dueDate < today && checkout.status === 'active';

      return {
        id: checkout.id,
        equipmentId: checkout.equipment_id,
        userId: checkout.user_id,
        deliveryNoteId: checkout.delivery_note_id,
        checkoutDate: checkout.checkout_date,
        dueDate: checkout.due_date,
        returnDate: checkout.return_date,
        status: isOverdue ? 'overdue' : checkout.status,
        notes: checkout.notes,
        equipment: {
          id: checkout.equipment.id,
          name: checkout.equipment.name,
          serialNumber: checkout.equipment.serial_number,
          articleNumber: checkout.equipment.article_number,
          imageUrl: checkout.equipment.image_url
        },
        user: {
          id: checkout.users.id,
          first_name: checkout.users.first_name,
          last_name: checkout.users.last_name,
          email: checkout.users.email,
          department: checkout.users.department
        },
        deliveryNote: checkout.delivery_notes ? {
          id: checkout.delivery_notes.id,
          note_number: checkout.delivery_notes.note_number,
          status: checkout.delivery_notes.status
        } : undefined
      };
    }) || [];

    setCheckouts(transformedCheckouts);
  };

  const fetchDeliveryNotes = async () => {
    const { data, error } = await supabase
      .from('delivery_notes')
      .select(`
        *,
        users(*),
        checkouts(
          *,
          equipment(*)
        )
      `)
      .order('issue_date', { ascending: false });

    if (error) throw error;

    const transformedNotes: DeliveryNoteWithDetails[] = data?.map(note => {
      const checkouts = note.checkouts?.map((checkout: any) => {
        // Check if the checkout is overdue - seulement à partir du lendemain de la date prévue
        const dueDate = new Date(checkout.due_date);
        dueDate.setHours(23, 59, 59, 999); // Fin de la journée de la date d'échéance
        
        const today = new Date();
        // Suppression de la mise à zéro des heures pour que le statut en retard apparaisse dès 00h01
        
        // Un emprunt est en retard dès 00h01 le lendemain de la date d'échéance
        const isOverdue = dueDate < today && checkout.status === 'active';

        return {
          id: checkout.id,
          equipmentId: checkout.equipment_id,
          userId: checkout.user_id,
          deliveryNoteId: checkout.delivery_note_id,
          checkoutDate: checkout.checkout_date,
          dueDate: checkout.due_date,
          returnDate: checkout.return_date,
          status: isOverdue ? 'overdue' : checkout.status,
          notes: checkout.notes,
          equipment: {
            id: checkout.equipment.id,
            name: checkout.equipment.name,
            serialNumber: checkout.equipment.serial_number,
            articleNumber: checkout.equipment.article_number,
            imageUrl: checkout.equipment.image_url
          },
          user: {
            id: note.users.id,
            first_name: note.users.first_name,
            last_name: note.users.last_name,
            email: note.users.email,
            department: note.users.department
          }
        };
      }) || [];

      const equipmentCount = checkouts.length;
      const returnedCount = checkouts.filter(c => c.status === 'returned').length;
      const activeCount = checkouts.filter(c => c.status === 'active' || c.status === 'overdue').length;

      // Determine note status based on checkouts
      let noteStatus = note.status;
      const hasOverdueCheckouts = checkouts.some(c => c.status === 'overdue');
      
      if (hasOverdueCheckouts && noteStatus !== 'returned') {
        noteStatus = 'overdue';
      } else if (returnedCount > 0 && activeCount > 0) {
        noteStatus = 'partial';
      } else if (returnedCount === equipmentCount && equipmentCount > 0) {
        noteStatus = 'returned';
      }

      return {
        id: note.id,
        noteNumber: note.note_number,
        userId: note.user_id,
        issueDate: note.issue_date,
        dueDate: note.due_date,
        status: noteStatus as DeliveryNoteWithDetails['status'],
        notes: note.notes,
        user: {
          id: note.users.id,
          first_name: note.users.first_name,
          last_name: note.users.last_name,
          email: note.users.email,
          department: note.users.department
        },
        checkouts,
        equipmentCount,
        returnedCount,
        activeCount
      };
    }) || [];

    setDeliveryNotes(transformedNotes);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDirectReturn = (checkout: CheckoutWithDetails) => {
    setSelectedCheckout(checkout);
    setShowDirectReturnModal(true);
  };

  const handleCloseDirectReturnModal = () => {
    setShowDirectReturnModal(false);
    setSelectedCheckout(null);
    fetchData(); // Refresh data
  };

  const handleCloseCheckoutModal = () => {
    setShowCheckoutModal(false);
    fetchData(); // Refresh data
  };

  const handleCloseReturnModal = () => {
    setShowReturnModal(false);
    fetchData(); // Refresh data
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">ACTIF</Badge>;
      case 'returned':
        return <Badge variant="neutral">RETOURNÉ</Badge>;
      case 'overdue':
        return <Badge variant="danger">EN RETARD</Badge>;
      case 'lost':
        return <Badge variant="danger">PERDU</Badge>;
      case 'partial':
        return <Badge variant="warning">PARTIEL</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    return Math.max(0, differenceInDays(today, due));
  };

  const filterOptions: FilterOption[] = [
    {
      id: 'status',
      label: 'Statut',
      type: 'select',
      options: [
        { value: 'active', label: 'Actif' },
        { value: 'returned', label: 'Retourné' },
        { value: 'overdue', label: 'En retard' },
        { value: 'lost', label: 'Perdu' },
        { value: 'partial', label: 'Partiel' },
      ],
    },
    {
      id: 'search',
      label: 'Rechercher',
      type: 'text',
    },
  ];

  const sortedData = currentView === 'checkouts' 
    ? [...checkouts].sort((a, b) => {
        const direction = sortDirection === 'asc' ? 1 : -1;
        switch (sortField) {
          case 'checkoutDate':
            return new Date(a.checkoutDate).getTime() - new Date(b.checkoutDate).getTime() * direction;
          case 'dueDate':
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() * direction;
          case 'equipment':
            return a.equipment.name.localeCompare(b.equipment.name) * direction;
          case 'user':
            return `${a.user.first_name} ${a.user.last_name}`.localeCompare(`${b.user.first_name} ${b.user.last_name}`) * direction;
          case 'status':
            return a.status.localeCompare(b.status) * direction;
          default:
            return 0;
        }
      })
    : [...deliveryNotes].sort((a, b) => {
        const direction = sortDirection === 'asc' ? 1 : -1;
        return new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime() * direction;
      });

  const filteredData = sortedData.filter(item => {
    return Object.entries(activeFilters).every(([key, value]) => {
      if (!value) return true;
      
      switch (key) {
        case 'search':
          const searchTerm = value.toLowerCase();
          if (currentView === 'checkouts') {
            const checkout = item as CheckoutWithDetails;
            return (
              checkout.equipment.name.toLowerCase().includes(searchTerm) ||
              checkout.equipment.serialNumber.toLowerCase().includes(searchTerm) ||
              `${checkout.user.first_name} ${checkout.user.last_name}`.toLowerCase().includes(searchTerm) ||
              checkout.user.department.toLowerCase().includes(searchTerm)
            );
          } else {
            const note = item as DeliveryNoteWithDetails;
            return (
              note.noteNumber.toLowerCase().includes(searchTerm) ||
              `${note.user.first_name} ${note.user.last_name}`.toLowerCase().includes(searchTerm) ||
              note.user.department.toLowerCase().includes(searchTerm)
            );
          }
        case 'status':
          return item.status === value;
        default:
          return true;
      }
    });
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw size={28} className="mx-auto animate-spin text-primary-600 mb-3" />
          <div className="text-gray-500 dark:text-gray-400 text-sm">Chargement des données...</div>
        </div>
      </div>
    );
  }

  const renderDeliveryNotesView = () => (
    <div className="space-y-4">
      {filteredData.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2 uppercase">
              AUCUN BON DE SORTIE
            </h3>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Aucun bon de sortie trouvé. Créez votre premier bon de sortie.
            </p>
          </div>
        </Card>
      ) : (
        (filteredData as DeliveryNoteWithDetails[]).map(note => (
          <Card key={note.id} className="hover:shadow-md transition-shadow">
            <div className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <FileText size={24} className="text-primary-600 dark:text-primary-400" />
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">
                      Bon N° {note.noteNumber}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {note.user.first_name} {note.user.last_name} • {note.user.department}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {getStatusBadge(note.status)}
                  {note.status === 'overdue' && (
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
                      <AlertTriangle size={16} />
                      <span className="font-bold">
                        {getDaysOverdue(note.dueDate)} jour(s) de retard
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Date d'émission</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {format(new Date(note.issueDate), 'dd/MM/yyyy', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Date de retour</p>
                  <p className={`text-sm font-medium ${
                    note.status === 'overdue' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                  }`}>
                    {format(new Date(note.dueDate), 'dd/MM/yyyy', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Équipements</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {note.equipmentCount} article{note.equipmentCount > 1 ? 's' : ''}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Progression</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {note.returnedCount}/{note.equipmentCount} retourné{note.returnedCount > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {note.checkouts.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2 uppercase">
                    Équipements ({note.checkouts.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {note.checkouts.slice(0, 6).map(checkout => (
                      <div key={checkout.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                            {checkout.equipment.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {checkout.equipment.serialNumber}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {getStatusBadge(checkout.status)}
                        </div>
                      </div>
                    ))}
                    {note.checkouts.length > 6 && (
                      <div className="flex items-center justify-center p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-500 dark:text-gray-400">
                        +{note.checkouts.length - 6} autres
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(note.status === 'active' || note.status === 'partial' || note.status === 'overdue') && (
                <div className="flex justify-end mt-4">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<LogIn size={16} />}
                    onClick={() => setShowReturnModal(true)}
                    className="font-bold"
                  >
                    GÉRER LES RETOURS
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );

  const renderCheckoutsListView = () => (
    <Card>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th 
                className="px-6 py-3 text-left cursor-pointer group"
                onClick={() => handleSort('equipment')}
              >
                <div className="flex items-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  MATÉRIEL
                  <ArrowUpDown size={14} className="ml-1 opacity-0 group-hover:opacity-100" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left cursor-pointer group"
                onClick={() => handleSort('user')}
              >
                <div className="flex items-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  UTILISATEUR
                  <ArrowUpDown size={14} className="ml-1 opacity-0 group-hover:opacity-100" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left cursor-pointer group"
                onClick={() => handleSort('checkoutDate')}
              >
                <div className="flex items-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  DATE SORTIE
                  <ArrowUpDown size={14} className="ml-1 opacity-0 group-hover:opacity-100" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left cursor-pointer group"
                onClick={() => handleSort('dueDate')}
              >
                <div className="flex items-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  DATE RETOUR
                  <ArrowUpDown size={14} className="ml-1 opacity-0 group-hover:opacity-100" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left cursor-pointer group"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  STATUT
                  <ArrowUpDown size={14} className="ml-1 opacity-0 group-hover:opacity-100" />
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {(filteredData as CheckoutWithDetails[]).map((checkout) => (
              <tr key={checkout.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {checkout.equipment.imageUrl && (
                      <img
                        src={checkout.equipment.imageUrl}
                        alt={checkout.equipment.name}
                        className="h-10 w-10 rounded-lg object-cover mr-3"
                      />
                    )}
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        {checkout.equipment.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {checkout.equipment.serialNumber}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                      {checkout.user.first_name} {checkout.user.last_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {checkout.user.department}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {format(new Date(checkout.checkoutDate), 'dd/MM/yyyy', { locale: fr })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm font-medium ${
                    checkout.status === 'overdue' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                  }`}>
                    {format(new Date(checkout.dueDate), 'dd/MM/yyyy', { locale: fr })}
                  </div>
                  {checkout.status === 'overdue' && (
                    <div className="text-xs text-red-600 dark:text-red-400 font-bold">
                      {getDaysOverdue(checkout.dueDate)} jour(s) de retard
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(checkout.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                  {checkout.deliveryNote && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {checkout.deliveryNote.note_number}
                    </span>
                  )}
                  {(checkout.status === 'active' || checkout.status === 'overdue' || checkout.status === 'lost') && (
                    <Button
                      variant="success"
                      size="sm"
                      icon={<LogIn size={16} />}
                      onClick={() => handleDirectReturn(checkout)}
                      className="font-bold"
                    >
                      RETOUR
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const renderCheckoutsGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {(filteredData as CheckoutWithDetails[]).map((checkout) => (
        <Card key={checkout.id} className="hover:shadow-md transition-shadow">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              {checkout.equipment.imageUrl ? (
                <img
                  src={checkout.equipment.imageUrl}
                  alt={checkout.equipment.name}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : (
                <div className="h-12 w-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <Package size={20} className="text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                  {checkout.equipment.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {checkout.equipment.serialNumber}
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <User size={14} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {checkout.user.first_name} {checkout.user.last_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building size={14} className="text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {checkout.user.department}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Retour: {format(new Date(checkout.dueDate), 'dd/MM/yyyy', { locale: fr })}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              {getStatusBadge(checkout.status)}
              {(checkout.status === 'active' || checkout.status === 'overdue' || checkout.status === 'lost') && (
                <Button
                  variant="success"
                  size="sm"
                  icon={<LogIn size={16} />}
                  onClick={() => handleDirectReturn(checkout)}
                >
                  RETOUR
                </Button>
              )}
            </div>

            {checkout.status === 'overdue' && (
              <div className="mt-2 flex items-center gap-1 text-red-600 dark:text-red-400 text-xs">
                <AlertTriangle size={12} />
                <span className="font-bold">
                  {getDaysOverdue(checkout.dueDate)} jour(s) de retard
                </span>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight uppercase">
            {currentView === 'delivery_notes' ? 'BONS DE SORTIE' : 'EMPRUNTS'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 font-medium">
            {currentView === 'delivery_notes' 
              ? 'Gestion des bons de sortie et retours de matériel'
              : 'Suivi détaillé des emprunts individuels'
            }
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="success"
            icon={<LogOut size={18} />}
            onClick={() => setShowCheckoutModal(true)}
            className="font-bold"
          >
            NOUVELLE SORTIE
          </Button>
          <Button
            variant="warning"
            icon={<LogIn size={18} />}
            onClick={() => setShowReturnModal(true)}
            className="font-bold"
          >
            RETOUR MATÉRIEL
          </Button>
          <Button
            variant="outline"
            icon={<RefreshCw size={18} />}
            onClick={forceUpdateOverdueCheckouts}
            className="font-bold"
          >
            METTRE À JOUR LES RETARDS
          </Button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex justify-between items-center">
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700">
          <Button
            variant={currentView === 'delivery_notes' ? 'primary' : 'outline'}
            size="sm"
            icon={<FileText size={16} />}
            onClick={() => setCurrentView('delivery_notes')}
            className="rounded-r-none font-bold"
          >
            BONS DE SORTIE
          </Button>
          <Button
            variant={currentView === 'checkouts' ? 'primary' : 'outline'}
            size="sm"
            icon={<Package size={16} />}
            onClick={() => setCurrentView('checkouts')}
            className="rounded-l-none font-bold"
          >
            EMPRUNTS DÉTAILLÉS
          </Button>
        </div>

        <div className="flex gap-3">
          {currentView === 'checkouts' && (
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700">
              <Button
                variant={viewMode === 'grid' ? 'primary' : 'outline'}
                size="sm"
                icon={<LayoutGrid size={16} />}
                onClick={() => setViewMode('grid')}
                className="rounded-r-none font-bold"
              >
                GRILLE
              </Button>
              <Button
                variant={viewMode === 'list' ? 'primary' : 'outline'}
                size="sm"
                icon={<List size={16} />}
                onClick={() => setViewMode('list')}
                className="rounded-l-none font-bold"
              >
                LISTE
              </Button>
            </div>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            icon={<Filter size={16} />}
            onClick={() => setShowFilters(true)}
            className="font-bold"
          >
            FILTRES
            {Object.keys(activeFilters).length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 rounded-full font-black">
                {Object.keys(activeFilters).length}
              </span>
            )}
          </Button>
          
          <Button 
            variant="outline"
            size="sm" 
            icon={<RefreshCw size={16} />}
            onClick={fetchData}
            className="font-bold"
          >
            ACTUALISER
          </Button>
        </div>
      </div>

      {/* Stats */}
      {currentView === 'delivery_notes' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="flex items-center p-3">
            <div className="rounded-full bg-primary-100 dark:bg-primary-900/50 p-2 mr-3">
              <FileText size={20} className="text-primary-600 dark:text-primary-300" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">Total</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white">
                {deliveryNotes.length}
              </p>
            </div>
          </Card>
          
          <Card className="flex items-center p-3">
            <div className="rounded-full bg-success-100 dark:bg-success-900/50 p-2 mr-3">
              <CheckCircle size={20} className="text-success-600 dark:text-success-300" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">Actifs</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white">
                {deliveryNotes.filter(n => n.status === 'active').length}
              </p>
            </div>
          </Card>
          
          <Card className="flex items-center p-3">
            <div className="rounded-full bg-warning-100 dark:bg-warning-900/50 p-2 mr-3">
              <Clock size={20} className="text-warning-600 dark:text-warning-300" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">Partiels</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white">
                {deliveryNotes.filter(n => n.status === 'partial').length}
              </p>
            </div>
          </Card>
          
          <Card className="flex items-center p-3">
            <div className="rounded-full bg-danger-100 dark:bg-danger-900/50 p-2 mr-3">
              <AlertTriangle size={20} className="text-danger-600 dark:text-danger-300" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">En retard</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white">
                {deliveryNotes.filter(n => n.status === 'overdue').length}
              </p>
            </div>
          </Card>
        </div>
      )}

      {currentView === 'checkouts' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="flex items-center p-3">
            <div className="rounded-full bg-primary-100 dark:bg-primary-900/50 p-2 mr-3">
              <Package size={20} className="text-primary-600 dark:text-primary-300" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">Total</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white">
                {checkouts.length}
              </p>
            </div>
          </Card>
          
          <Card className="flex items-center p-3">
            <div className="rounded-full bg-success-100 dark:bg-success-900/50 p-2 mr-3">
              <CheckCircle size={20} className="text-success-600 dark:text-success-300" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">Actifs</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white">
                {checkouts.filter(c => c.status === 'active').length}
              </p>
            </div>
          </Card>
          
          <Card className="flex items-center p-3">
            <div className="rounded-full bg-danger-100 dark:bg-danger-900/50 p-2 mr-3">
              <AlertTriangle size={20} className="text-danger-600 dark:text-danger-300" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">En retard</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white">
                {checkouts.filter(c => c.status === 'overdue').length}
              </p>
            </div>
          </Card>
          
          <Card className="flex items-center p-3">
            <div className="rounded-full bg-gray-100 dark:bg-gray-700 p-2 mr-3">
              <LogIn size={20} className="text-gray-600 dark:text-gray-300" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">Retournés</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white">
                {checkouts.filter(c => c.status === 'returned').length}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Content */}
      {currentView === 'delivery_notes' ? (
        renderDeliveryNotesView()
      ) : (
        viewMode === 'list' ? renderCheckoutsListView() : renderCheckoutsGridView()
      )}

      {/* Modals */}
      <CheckoutModal
        isOpen={showCheckoutModal}
        onClose={handleCloseCheckoutModal}
      />

      <ReturnModal
        isOpen={showReturnModal}
        onClose={handleCloseReturnModal}
      />

      {selectedCheckout && (
        <DirectReturnModal
          isOpen={showDirectReturnModal}
          onClose={handleCloseDirectReturnModal}
          checkout={selectedCheckout}
        />
      )}

      <FilterPanel
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        options={filterOptions}
        onApplyFilters={setActiveFilters}
      />
    </div>
  );
};

export default Checkouts;