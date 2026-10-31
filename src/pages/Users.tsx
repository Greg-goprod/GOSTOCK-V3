import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { Plus, QrCode, Mail, Building2, Phone, LayoutGrid, List, ArrowUpDown, Filter, Pencil, Trash2, Contact, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import QRCodeGenerator from '../components/QRCode/QRCodeGenerator';
import Modal from '../components/common/Modal';
import FilterPanel, { FilterOption } from '../components/common/FilterPanel';
import UserModal from '../components/users/UserModal';
import DepartureModal from '../components/users/DepartureModal';
import ConfirmModal from '../components/common/ConfirmModal';
import { User } from '../types';
import { ROLE_LABELS } from '../lib/roles';
import { badgeValue } from '../lib/badges';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { MxSegmented } from '../components/mx/MxSegmented';
import PageTitle from '../components/common/PageTitle';

type ViewMode = 'grid' | 'list';
type SortField = 'first_name' | 'last_name' | 'email' | 'phone' | 'department' | 'role';
type SortDirection = 'asc' | 'desc';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  // Code du badge de la personne affichée (undefined : en chargement, null : pas de badge)
  const [badgeCode, setBadgeCode] = useState<string | null | undefined>(undefined);
  const [showQRModal, setShowQRModal] = useState(false);
  const [sortField, setSortField] = useState<SortField>('first_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [leaving, setLeaving] = useState<User | null>(null);

  const KIND_LABELS = { temp: 'Intérimaire', subcontractor: 'Sous-traitant' } as const;
  const accessLabel = (user: User) => {
    const today = new Date().toISOString().slice(0, 10);
    if (user.leftOn && user.active === false) return `Parti le ${new Date(user.leftOn).toLocaleDateString('fr-CH')}`;
    if (user.active === false) return 'Accès suspendu';
    const kind = user.personKind && user.personKind !== 'employee' ? `${KIND_LABELS[user.personKind]}${user.company ? ` (${user.company})` : ''} · ` : '';
    const deposit = user.depositAmount && !user.depositReturnedOn ? `caution ${user.depositAmount} CHF · ` : '';
    if (user.accessUntil && user.accessUntil < today) return `${kind}${deposit}accès échu le ${new Date(user.accessUntil).toLocaleDateString('fr-CH')}`;
    if (user.accessUntil) return `${kind}${deposit}jusqu'au ${new Date(user.accessUntil).toLocaleDateString('fr-CH')}`;
    return `${kind}${deposit}${user.linked ? 'Déjà connecté' : 'Jamais connecté'}`;
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('first_name', { ascending: true });

      if (error) {
        throw error;
      }

      // Mêmes champs que dans AppContext : la fiche ouverte en modification garde permis et statut
      setUsers((data || []).map(u => ({
        ...u,
        linked: !!u.auth_user_id,
        licenseCategories: u.license_categories || [],
        licenseExpiresOn: u.license_expires_on,
        personKind: u.person_kind ?? 'employee',
        company: u.company,
        accessUntil: u.access_until,
        leftOn: u.left_on,
        depositAmount: u.deposit_amount,
        depositPaidOn: u.deposit_paid_on,
        depositReturnedOn: u.deposit_returned_on,
      })));
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      // Check if user has active checkouts
      const { data: checkouts, error: checkoutError } = await supabase
        .from('checkouts')
        .select('id')
        .eq('user_id', userToDelete.id)
        .eq('status', 'active');

      if (checkoutError) throw checkoutError;

      if (checkouts && checkouts.length > 0) {
        toast.error('Impossible de supprimer un utilisateur ayant des emprunts actifs');
        return;
      }

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userToDelete.id);

      if (error) throw error;

      setUsers(prev => prev.filter(user => user.id !== userToDelete.id));
      toast.success('Utilisateur supprimé avec succès');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  // Le QR affiché est celui du badge (« GOMAT-USER:<code> »), lu par le comptoir et le scanner
  const handleShowQR = async (id: string) => {
    setSelectedUser(id);
    setBadgeCode(undefined);
    setShowQRModal(true);
    const { data } = await supabase.from('user_badges').select('code').eq('user_id', id).maybeSingle();
    setBadgeCode(data?.code ?? null);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleAddUser = () => {
    setEditingUser(undefined);
    setShowUserModal(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowUserModal(true);
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
    setEditingUser(undefined);
    fetchUsers(); // Refresh the list after modal closes
  };

  const filterOptions: FilterOption[] = [
    {
      id: 'role',
      label: 'Rôle',
      type: 'select',
      options: [
        { value: 'admin', label: ROLE_LABELS.admin },
        { value: 'manager', label: ROLE_LABELS.manager },
        { value: 'technician', label: ROLE_LABELS.technician },
        { value: 'user', label: ROLE_LABELS.user },
      ],
    },
    {
      id: 'department',
      label: 'Département',
      type: 'select',
      options: Array.from(new Set(users.map(u => u.department))).map(dept => ({
        value: dept,
        label: dept,
      })),
    },
    {
      id: 'search',
      label: 'Rechercher',
      type: 'text',
    },
  ];

  const sortedUsers = [...users].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'first_name':
        return a.first_name.localeCompare(b.first_name) * direction;
      case 'last_name':
        return a.last_name.localeCompare(b.last_name) * direction;
      case 'email':
        return a.email.localeCompare(b.email) * direction;
      case 'phone':
        return (a.phone || '').localeCompare(b.phone || '') * direction;
      case 'department':
        return a.department.localeCompare(b.department) * direction;
      case 'role':
        return (ROLE_LABELS[a.role] ?? a.role).localeCompare(ROLE_LABELS[b.role] ?? b.role) * direction;
      default:
        return 0;
    }
  });

  const filteredUsers = sortedUsers.filter(user => {
    return Object.entries(activeFilters).every(([key, value]) => {
      if (!value) return true;
      
      switch (key) {
        case 'search': {
          const searchTerm = value.toLowerCase();
          return (
            user.first_name.toLowerCase().includes(searchTerm) ||
            user.last_name.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm) ||
            (user.phone || '').toLowerCase().includes(searchTerm)
          );
        }
        case 'role':
          return user.role === value;
        case 'department':
          return user.department === value;
        default:
          return true;
      }
    });
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400 font-medium">Loading users...</div>
      </div>
    );
  }

  const renderListView = () => (
    <Card>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th 
                className="px-6 py-3 text-left cursor-pointer group"
                onClick={() => handleSort('first_name')}
              >
                <div className="flex items-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  NOM
                  <ArrowUpDown size={14} className="ml-1 opacity-0 group-hover:opacity-100" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left cursor-pointer group"
                onClick={() => handleSort('email')}
              >
                <div className="flex items-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                  <ArrowUpDown size={14} className="ml-1 opacity-0 group-hover:opacity-100" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left cursor-pointer group"
                onClick={() => handleSort('phone')}
              >
                <div className="flex items-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Téléphone
                  <ArrowUpDown size={14} className="ml-1 opacity-0 group-hover:opacity-100" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left cursor-pointer group"
                onClick={() => handleSort('department')}
              >
                <div className="flex items-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Département
                  <ArrowUpDown size={14} className="ml-1 opacity-0 group-hover:opacity-100" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left cursor-pointer group"
                onClick={() => handleSort('role')}
              >
                <div className="flex items-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rôle
                  <ArrowUpDown size={14} className="ml-1 opacity-0 group-hover:opacity-100" />
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 flex items-center justify-center">
                      <span className="font-black">
                        {user.first_name[0]}{user.last_name[0]}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {user.first_name} {user.last_name}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                  {user.phone}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                  {user.department}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  <span className="font-bold uppercase">{ROLE_LABELS[user.role] ?? user.role}</span>
                  <span className={`block text-xs ${user.active === false ? 'text-tone-danger' : 'text-gray-600 dark:text-gray-400'}`}>
                    {accessLabel(user)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<QrCode size={16} />}
                    onClick={() => handleShowQR(user.id)}
                    className="whitespace-nowrap"
                  >
                    QR code
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Pencil size={16} />}
                    onClick={() => handleEditUser(user)}
                    ariaLabel="Modifier"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<LogOut size={16} />}
                    onClick={() => setLeaving(user)}
                    ariaLabel="Départ"
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={16} />}
                    onClick={() => handleDeleteClick(user)}
                    ariaLabel="Supprimer"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {filteredUsers.map((user) => (
        <Card key={user.id} className="hover:shadow-lg transition-shadow">
          <div className="p-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 flex items-center justify-center">
                <span className="text-lg font-black">
                  {user.first_name[0]}{user.last_name[0]}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-800 dark:text-gray-100">{user.first_name} {user.last_name}</h3>
                <p className="text-sm font-bold text-gray-600 dark:text-gray-300 uppercase">{ROLE_LABELS[user.role] ?? user.role}</p>
                <p className={`text-xs ${user.active === false ? 'text-tone-danger' : 'text-gray-600 dark:text-gray-400'}`}>
                  {accessLabel(user)}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Mail size={16} />
                <span className="text-sm font-medium">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Phone size={16} />
                <span className="text-sm font-medium">{user.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Building2 size={16} />
                <span className="text-sm font-medium">{user.department}</span>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={<QrCode size={16} />}
                onClick={() => handleShowQR(user.id)}
                className="font-medium"
              >
                QR code
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Pencil size={16} />}
                onClick={() => handleEditUser(user)}
                ariaLabel="Modifier"
              />
              <Button
                variant="outline"
                size="sm"
                icon={<LogOut size={16} />}
                onClick={() => setLeaving(user)}
                ariaLabel="Départ"
              />
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={16} />}
                onClick={() => handleDeleteClick(user)}
                ariaLabel="Supprimer"
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <PageTitle>Personnes</PageTitle>
        
        <div className="flex flex-wrap gap-3">
          <MxSegmented aria-label="Affichage" value={viewMode} onChange={v => setViewMode(v as ViewMode)}
            options={[{ value: 'grid', label: 'Grille', icon: LayoutGrid }, { value: 'list', label: 'Liste', icon: List }]} />
          <Button 
            variant="outline" 
            icon={<Filter size={18} />}
            onClick={() => setShowFilters(true)}
            className="font-bold"
          >
            Filtres
            {Object.keys(activeFilters).length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[11px] bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 rounded font-black">
                {Object.keys(activeFilters).length}
              </span>
            )}
          </Button>
          <Link
            to="/badges"
            className="mx-btn mx-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-[7px] min-h-[44px] lg:min-h-[32px] text-[12.5px]"
          >
            <Contact size={16} aria-hidden="true" /> Imprimer les badges
          </Link>
          <Button 
            variant="primary" 
            icon={<Plus size={18} />}
            onClick={handleAddUser}
            className="font-bold"
          >
            Ajouter une personne
          </Button>
        </div>
      </div>

      {viewMode === 'list' ? renderListView() : renderGridView()}

      <Modal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        title="QR code de la personne"
        size="sm"
      >
        {selectedUser && badgeCode === undefined && <p className="text-sm text-gray-600 dark:text-gray-400">Chargement…</p>}
        {selectedUser && badgeCode === null && (
          <p className="text-sm text-gray-700 dark:text-gray-300">Aucun badge trouvé pour cette personne. Ouvre sa fiche « Mon badge » ou « Imprimer les badges » pour en créer un.</p>
        )}
        {selectedUser && badgeCode && (
          <div className="flex justify-center">
            <QRCodeGenerator
              value={badgeValue(badgeCode)}
              title={users.find(u => u.id === selectedUser)?.first_name + ' ' + users.find(u => u.id === selectedUser)?.last_name || ''}
              subtitle={users.find(u => u.id === selectedUser)?.department}
              size={200}
            />
          </div>
        )}
      </Modal>

      <FilterPanel
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        options={filterOptions}
        onApplyFilters={setActiveFilters}
      />

      <DepartureModal user={leaving} onClose={() => { setLeaving(null); fetchUsers(); }} />
      <UserModal
        isOpen={showUserModal}
        onClose={handleCloseUserModal}
        user={editingUser}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Confirmer la suppression"
        message={`Es-tu sûr de vouloir supprimer l'utilisateur ${userToDelete?.first_name} ${userToDelete?.last_name} ? Cette action est irréversible.`}
        confirmLabel="SUPPRIMER"
        cancelLabel="ANNULER"
      />
    </div>
  );
};

export default Users;