import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { Plus, QrCode, Mail, Building2, Phone, LayoutGrid, List, ArrowUpDown, Filter, Pencil, Trash2 } from 'lucide-react';
import QRCodeGenerator from '../components/QRCode/QRCodeGenerator';
import Modal from '../components/common/Modal';
import FilterPanel, { FilterOption } from '../components/common/FilterPanel';
import UserModal from '../components/users/UserModal';
import ConfirmModal from '../components/common/ConfirmModal';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

type ViewMode = 'grid' | 'list';
type SortField = 'first_name' | 'last_name' | 'email' | 'phone' | 'department' | 'role';
type SortDirection = 'asc' | 'desc';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [sortField, setSortField] = useState<SortField>('first_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

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

      setUsers(data || []);
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

  const handleShowQR = (id: string) => {
    setSelectedUser(id);
    setShowQRModal(true);
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
        { value: 'admin', label: 'Administrateur' },
        { value: 'user', label: 'Utilisateur' },
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
        return a.role.localeCompare(b.role) * direction;
      default:
        return 0;
    }
  });

  const filteredUsers = sortedUsers.filter(user => {
    return Object.entries(activeFilters).every(([key, value]) => {
      if (!value) return true;
      
      switch (key) {
        case 'search':
          const searchTerm = value.toLowerCase();
          return (
            user.first_name.toLowerCase().includes(searchTerm) ||
            user.last_name.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm) ||
            (user.phone || '').toLowerCase().includes(searchTerm)
          );
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
                  EMAIL
                  <ArrowUpDown size={14} className="ml-1 opacity-0 group-hover:opacity-100" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left cursor-pointer group"
                onClick={() => handleSort('phone')}
              >
                <div className="flex items-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  TÉLÉPHONE
                  <ArrowUpDown size={14} className="ml-1 opacity-0 group-hover:opacity-100" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left cursor-pointer group"
                onClick={() => handleSort('department')}
              >
                <div className="flex items-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  DÉPARTEMENT
                  <ArrowUpDown size={14} className="ml-1 opacity-0 group-hover:opacity-100" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left cursor-pointer group"
                onClick={() => handleSort('role')}
              >
                <div className="flex items-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  RÔLE
                  <ArrowUpDown size={14} className="ml-1 opacity-0 group-hover:opacity-100" />
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                ACTIONS
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
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100 uppercase">
                  {user.role}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<QrCode size={16} />}
                    onClick={() => handleShowQR(user.id)}
                    className="font-medium"
                  >
                    QR CODE
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Pencil size={16} />}
                    onClick={() => handleEditUser(user)}
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={16} />}
                    onClick={() => handleDeleteClick(user)}
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
                <p className="text-sm font-bold text-gray-600 dark:text-gray-300 uppercase">{user.role}</p>
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
                QR CODE
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Pencil size={16} />}
                onClick={() => handleEditUser(user)}
              />
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={16} />}
                onClick={() => handleDeleteClick(user)}
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
        <h1 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white tracking-tight uppercase">UTILISATEURS</h1>
        
        <div className="flex flex-wrap gap-3">
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700">
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'outline'}
              size="sm"
              icon={<LayoutGrid size={18} />}
              onClick={() => setViewMode('grid')}
              className="rounded-r-none font-bold"
            >
              GRILLE
            </Button>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'outline'}
              size="sm"
              icon={<List size={18} />}
              onClick={() => setViewMode('list')}
              className="rounded-l-none font-bold"
            >
              LISTE
            </Button>
          </div>
          <Button 
            variant="outline" 
            icon={<Filter size={18} />}
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
            variant="primary" 
            icon={<Plus size={18} />}
            onClick={handleAddUser}
            className="font-bold"
          >
            AJOUTER UN UTILISATEUR
          </Button>
        </div>
      </div>

      {viewMode === 'list' ? renderListView() : renderGridView()}

      <Modal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        title="QR CODE UTILISATEUR"
        size="sm"
      >
        {selectedUser && (
          <div className="flex justify-center">
            <QRCodeGenerator
              value={selectedUser}
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

      <UserModal
        isOpen={showUserModal}
        onClose={handleCloseUserModal}
        user={editingUser}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="CONFIRMER LA SUPPRESSION"
        message={`Êtes-vous sûr de vouloir supprimer l'utilisateur ${userToDelete?.first_name} ${userToDelete?.last_name} ? Cette action est irréversible.`}
        confirmLabel="SUPPRIMER"
        cancelLabel="ANNULER"
      />
    </div>
  );
};

export default Users;