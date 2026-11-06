import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import AddEquipmentModal from '../components/equipment/AddEquipmentModal';
import EditEquipmentModal from '../components/equipment/EditEquipmentModal';
import QRCodeGenerator from '../components/QRCode/QRCodeGenerator';
import QRCodesModal from '../components/equipment/QRCodesModal';
import MaintenanceModal from '../components/maintenance/MaintenanceModal';
import FilterPanel from '../components/common/FilterPanel';
import ConfirmModal from '../components/common/ConfirmModal';
import ExcelImport from '../components/import/ExcelImport';
import { Plus, QrCode, Wrench, PenTool, Package, Edit, Trash2, Download, Upload, Search, Filter, History } from 'lucide-react';
import EquipmentHistoryModal from '../components/equipment/EquipmentHistoryModal';
import { Equipment as EquipmentType, EquipmentInstance } from '../types';
import StatusBadge from '../components/common/StatusBadge';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/requests';
import { confirmAction } from '../lib/confirm';
import RentalBadge from '../components/common/RentalBadge';
import PageTitle from '../components/common/PageTitle';
import { PageCommands } from '../components/Layout/ModuleHeader';
import { MxEntityCard } from '../components/mx/MxEntityCard';
import { MxCardGrid } from '../components/mx/MxCardGrid';
import { MxEntityViewToggle } from '../components/mx/MxEntityViewToggle';
import { MxPagination } from '../components/mx/MxPagination';
import { MxEmpty } from '../components/mx/MxEmpty';
import { readMxViewMode, writeMxViewMode } from '../components/mx/mxViewModeStorage';

export default function Equipment() {
  const {
    equipment,
    categories,
    suppliers,
    equipmentGroups,
    equipmentSubgroups,
    equipmentInstances,
    checkouts,
    deleteEquipment,
    refreshData
  } = useApp();
  // Créer, modifier ou supprimer un article : droit « gérer le stock » (la base le vérifie aussi)
  const canManage = useAuth().can('manage_stock');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [historyFor, setHistoryFor] = useState<EquipmentType | null>(null);
  const [showQRCodesModal, setShowQRCodesModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<EquipmentInstance | null>(null);
  const [selectedEquipmentForQR, setSelectedEquipmentForQR] = useState<EquipmentType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  // Cartes par défaut, choix mémorisé (comme Mannyx)
  const [viewMode, setViewModeState] = useState<'grid' | 'list'>(() => readMxViewMode('gomat-view-outils', ['grid', 'list'] as const, 'grid'));
  const setViewMode = (mode: 'grid' | 'list') => { setViewModeState(mode); writeMxViewMode('gomat-view-outils', mode); };
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => Number(readMxViewMode('gomat-pagesize-outils', ['24', '48', '96'] as const, '48')));
  const [sortField, setSortField] = useState<'name' | 'category' | 'status'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    supplier: '',
    group: '',
    subgroup: ''
  });
  const [zoomedImage, setZoomedImage] = useState<{ url: string; name: string } | null>(null);

  // Fonction pour calculer la disponibilité : disponible = stock - (emprunts + maintenance + perdu)
  const getAvailableQuantity = (eq: EquipmentType): number => {
    // Si l'équipement a une valeur availableQuantity définie, l'utiliser directement
    if (eq.availableQuantity !== undefined && eq.availableQuantity !== null) {
      // Debug spécifique pour les accus 18V
      const isDebugItem = eq.name.toLowerCase().includes('accu 18v');
      
      if (isDebugItem) {
        console.log(`=== DEBUG ${eq.name} ===`);
        console.log('Équipement complet:', eq);
        console.log('Quantité disponible stockée:', eq.availableQuantity);
        console.log('Quantité totale:', eq.totalQuantity);
        console.log('Statut:', eq.status);
      }
      
      return eq.availableQuantity;
    }

    const totalQuantity = eq.totalQuantity || 1;
    
    // Compter les emprunts actifs et en retard
    const activeCheckouts = checkouts.filter(
      c => c.equipmentId === eq.id && 
      (c.status === 'active' || c.status === 'overdue' || c.status === 'lost')
    ).length;
    
    // Compter les équipements en maintenance
    const inMaintenance = eq.status === 'maintenance' ? 1 : 0;
    
    // Calculer la disponibilité
    const available = Math.max(0, totalQuantity - activeCheckouts - inMaintenance);
    
    return available;
  };

  const handleShowQR = (equipmentId: string, instance?: EquipmentInstance | null) => {
    const equipmentItem = equipment.find(eq => eq.id === equipmentId);
    if (!equipmentItem) return;

    console.log('=== DEBUG QR CODE ===');
    console.log('Equipment:', equipmentItem);
    console.log('QR Type:', equipmentItem.qrType);
    console.log('Total Quantity:', equipmentItem.totalQuantity || 1);
    
    // Si c'est un équipement avec QR individuels et plusieurs quantités
    if (equipmentItem.qrType === 'individual' && (equipmentItem.totalQuantity || 1) > 1) {
      console.log('Affichage QRCodesModal (multiple QR codes)');
      setSelectedEquipmentForQR(equipmentItem);
      setShowQRCodesModal(true);
      return;
    }

    // Si c'est un équipment avec QR individuels mais une seule quantité
    if (equipmentItem.qrType === 'individual' && (equipmentItem.totalQuantity || 1) === 1) {
      // Récupérer l'instance si elle existe
      const equipmentInstances = getEquipmentInstances(equipmentId);
      console.log('Instances pour équipement unique:', equipmentInstances);
      const singleInstance = equipmentInstances.length > 0 ? equipmentInstances[0] : null;
      
      setSelectedEquipment(equipmentId);
      setSelectedInstance(singleInstance);
      setShowQRModal(true);
      console.log('Affichage QRModal (single QR code avec instance)');
      return;
    }

    console.log('Affichage QRModal (single QR code sans instance)');
    setSelectedEquipment(equipmentId);
    setSelectedInstance(instance || null);
    setShowQRModal(true);
  };

  const handleEdit = (equipmentId: string) => {
    setSelectedEquipment(equipmentId);
    setShowEditModal(true);
  };

  const handleDelete = (equipmentId: string) => {
    setSelectedEquipment(equipmentId);
    setShowDeleteModal(true);
  };

  // Un outil avec un historique de sorties ne peut pas être supprimé (la base le refuse) : on propose de le retirer du service
  const confirmDelete = async () => {
    if (!selectedEquipment) return;
    const id = selectedEquipment;
    setShowDeleteModal(false);
    setSelectedEquipment(null);
    const { count } = await supabase.from('checkouts').select('id', { count: 'exact', head: true }).eq('equipment_id', id);
    if (count) {
      const name = equipment.find(e => e.id === id)?.name ?? 'Cet outil';
      if (!await confirmAction(`${name} a un historique de ${count} sortie(s) : il ne peut pas être supprimé. Le retirer du service à la place ? Il n'apparaîtra plus comme disponible, son historique est conservé.`)) return;
      const { error } = await supabase.from('equipment').update({ status: 'retired' }).eq('id', id);
      if (error) return toast.error(errorMessage(error));
      toast.success(`${name} retiré du service`);
      await refreshData();
      return;
    }
    try {
      await deleteEquipment(id);
    } catch {
      // Message déjà affiché par deleteEquipment
    }
  };

  const handleMaintenance = (equipmentId: string) => {
    setSelectedEquipment(equipmentId);
    setShowMaintenanceModal(true);
  };



  const exportToCSV = () => {
    const headers = ['Nom', 'Numéro de série', 'Statut', 'Catégorie', 'Fournisseur', 'Localisation', 'Date d\'ajout'];
    const csvContent = [
      headers.join(','),
      ...filteredEquipment.map(eq => [
        `"${eq.name}"`,
        `"${eq.serialNumber}"`,
        `"${eq.status}"`,
        `"${categories.find(c => c.id === eq.category)?.name || ''}"`,
        `"${suppliers.find(s => s.id === eq.supplier)?.name || ''}"`,
        `"${eq.location || ''}"`,
        `"${eq.addedDate ? new Date(eq.addedDate).toLocaleDateString() : ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'equipment.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredEquipment = equipment.filter(eq => {
    // Les consommables ont leur propre page
    if (eq.itemType === 'consumable') return false;
    const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (eq.serialNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (eq.articleNumber && eq.articleNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = !filters.status || eq.status === filters.status;
    const matchesCategory = !filters.category || eq.category === filters.category;
    const matchesSupplier = !filters.supplier || eq.supplier === filters.supplier;
    const matchesGroup = !filters.group || eq.group === filters.group;
    const matchesSubgroup = !filters.subgroup || eq.subgroup === filters.subgroup;

    return matchesSearch && matchesStatus && matchesCategory && matchesSupplier && matchesGroup && matchesSubgroup;
  });

  // Trier les équipements
  const sortedEquipment = [...filteredEquipment].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'category': {
        const categoryA = categories.find(c => c.id === a.category)?.name || '';
        const categoryB = categories.find(c => c.id === b.category)?.name || '';
        comparison = categoryA.localeCompare(categoryB);
        break;
      }
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
      default:
        comparison = 0;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const getEquipmentInstances = (equipmentId: string) => {
    return equipmentInstances.filter(instance => instance.equipmentId === equipmentId);
  };

  // Pagination (comme Mannyx) : la liste et les cartes affichent la même page
  const totalPages = Math.max(1, Math.ceil(sortedEquipment.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedEquipment = sortedEquipment.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Carte d'entité de la charte : photo ronde, nom, stock et disponibilité, statut ; actions dans le menu « ⋮ »
  const renderEntityCard = (eq: EquipmentType) => {
    const available = getAvailableQuantity(eq);
    return (
      <MxEntityCard
        avatarSrc={eq.imageUrl || null}
        avatarName={eq.name}
        title={eq.name}
        infoParts={[
          { content: `Stock ${eq.totalQuantity ?? 1}` },
          { content: `Disponible ${available}` },
        ]}
        statusBadge={<StatusBadge status={eq.status} />}
        due={eq.rentalUntil ? <RentalBadge until={eq.rentalUntil} returned={eq.status === 'retired'} /> : undefined}
        menuLabel={`Actions pour ${eq.name}`}
        menuActions={[
          { id: 'qr', label: 'Code QR', icon: QrCode, onSelect: () => handleShowQR(eq.id) },
          { id: 'history', label: 'Historique', icon: History, onSelect: () => setHistoryFor(eq) },
          ...(canManage ? [
            { id: 'edit', label: 'Modifier', icon: Edit, onSelect: () => handleEdit(eq.id) },
            { id: 'maintenance', label: 'Maintenance', icon: Wrench, onSelect: () => handleMaintenance(eq.id) },
            { id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger' as const, onSelect: () => handleDelete(eq.id) },
          ] : []),
        ]}
        onOpen={() => (canManage ? handleEdit(eq.id) : setHistoryFor(eq))}
      />
    );
  };

  const renderEquipmentList = () => {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden w-full z-10 relative">
        <div className="overflow-x-auto w-full">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Équipement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  N° Série
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Catégorie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Localisation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Stock total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Disponible
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {pagedEquipment.map((eq) => {
                const category = categories.find(c => c.id === eq.category);
                
                return (
                  <tr key={eq.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-12 w-12">
                          {eq.imageUrl ? (
                            <img
                              className="h-12 w-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700 shadow-sm p-1 cursor-zoom-in"
                              src={eq.imageUrl}
                              alt={eq.name}
                              onClick={() => setZoomedImage({ url: eq.imageUrl!, name: eq.name })}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  parent.innerHTML = `
                                    <div class="h-12 w-12 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center border-2 border-gray-200 dark:border-gray-700 shadow-sm p-1">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500 dark:text-gray-400">
                                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                                      </svg>
                                    </div>
                                  `;
                                }
                              }}
                            />
                          ) : (
                            <div className="h-12 w-12 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center border-2 border-gray-200 dark:border-gray-700 shadow-sm p-1">
                              <PenTool className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {eq.name.toUpperCase()}
                          </div>
                          {eq.shortTitle && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {eq.shortTitle}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {eq.serialNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={eq.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {category?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {eq.location || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {eq.totalQuantity || 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-bold">
                      {eq.availableQuantity ?? 0}/{eq.totalQuantity ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          ariaLabel={`Code QR de ${eq.name}`}
                          onClick={() => handleShowQR(eq.id)}
                        >
                          <QrCode className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" ariaLabel={`Historique de ${eq.name}`} onClick={() => setHistoryFor(eq)}>
                          <History className="w-4 h-4" />
                        </Button>
                        {canManage && (
                          <>
                            <Button variant="outline" size="sm" ariaLabel={`Modifier ${eq.name}`} onClick={() => handleEdit(eq.id)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" ariaLabel={`Supprimer ${eq.name}`} onClick={() => handleDelete(eq.id)} className="text-tone-danger hover:text-tone-danger">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Fonction pour rafraîchir explicitement les données d'équipement

  return (
    <div className="space-y-6">
      <PageTitle>Outils</PageTitle>
      {/* Commandes dans l'en-tête de module : recherche · filtres · pagination · vue · action principale */}
      <PageCommands
        search={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 w-4 h-4" aria-hidden="true" />
            <input type="text" placeholder="Rechercher par nom, numéro de série ou numéro d'article..." aria-label="Rechercher un équipement"
              value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800" />
          </div>
        }
        filters={
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <select value={sortField} onChange={(e) => setSortField(e.target.value as 'name' | 'category' | 'status')} aria-label="Trier par"
                className="rounded-r-none border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3">
                <option value="name">Nom</option>
                <option value="category">Catégorie</option>
                <option value="status">Statut</option>
              </select>
              <Button variant="outline" onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')} className="rounded-l-none -ml-px"
                ariaLabel={sortDirection === 'asc' ? 'Tri croissant' : 'Tri décroissant'}>
                {sortDirection === 'asc' ? 'A→Z' : 'Z→A'}
              </Button>
            </div>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} icon={<Filter className="w-4 h-4" />}>Filtres</Button>
          </div>
        }
        pagination={totalPages > 1 || sortedEquipment.length > 24 ? (
          <MxPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage}
            previousLabel="Page précédente" nextLabel="Page suivante" totalLabel={`${sortedEquipment.length} outil(s)`}
            pageSize={pageSize} pageSizeOptions={[{ value: '24', label: '24' }, { value: '48', label: '48' }, { value: '96', label: '96' }]}
            onPageSizeChange={size => { setPageSize(size); setPage(1); writeMxViewMode('gomat-pagesize-outils', String(size)); }}
            pageSizeLabel="Outils par page" />
        ) : undefined}
        view={<MxEntityViewToggle value={viewMode === 'grid' ? 'cards' : 'list'} onChange={mode => setViewMode(mode === 'cards' ? 'grid' : 'list')} aria-label="Affichage des outils" />}
        primary={
          <div className="flex items-center gap-2">
            {canManage && <Button variant="outline" onClick={() => setShowImportModal(true)} icon={<Upload className="w-4 h-4" />}>Importer</Button>}
            <Button variant="outline" onClick={exportToCSV} icon={<Download className="w-4 h-4" />}>Exporter</Button>
            {canManage && <Button onClick={() => setShowAddModal(true)} icon={<Plus className="w-4 h-4" />}>Ajouter un équipement</Button>}
          </div>
        }
      />

      <FilterPanel
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        options={[
          {
            id: 'status',
            label: 'Statut',
            type: 'select',
            options: [
              { value: 'available', label: 'Disponible' },
              { value: 'checked-out', label: 'Sorti' },
              { value: 'maintenance', label: 'En maintenance' },
              { value: 'retired', label: 'Retiré' },
              { value: 'lost', label: 'Perdu' }
            ]
          },
          {
            id: 'category',
            label: 'Catégorie',
            type: 'select',
            options: categories.map(cat => ({ value: cat.id, label: cat.name }))
          },
          {
            id: 'supplier',
            label: 'Fournisseur',
            type: 'select',
            options: suppliers.map(sup => ({ value: sup.id, label: sup.name }))
          },
          {
            id: 'group',
            label: 'Groupe',
            type: 'select',
            options: equipmentGroups.map(group => ({ value: group.id, label: group.name }))
          },
          {
            id: 'subgroup',
            label: 'Sous-groupe',
            type: 'select',
            options: equipmentSubgroups.map(subgroup => ({ value: subgroup.id, label: subgroup.name }))
          }
        ]}
        onApplyFilters={(newFilters) => {
          setFilters({
            status: newFilters.status || '',
            category: newFilters.category || '',
            supplier: newFilters.supplier || '',
            group: newFilters.group || '',
            subgroup: newFilters.subgroup || ''
          });
        }}
      />

      {/* Affichage conditionnel selon le mode de vue sélectionné */}
      {viewMode === 'grid' ? (
        // Grille de cartes de la charte (jusqu'à 8 colonnes selon la largeur), carte d'entité standard
        <MxCardGrid items={pagedEquipment} getItemKey={eq => eq.id} renderItem={renderEntityCard} />
      ) : (
        renderEquipmentList()
      )}

      {filteredEquipment.length === 0 && <MxEmpty icon={Package} title="Aucun équipement trouvé" />}

      {/* Modals */}
      {historyFor && <EquipmentHistoryModal equipment={historyFor} onClose={() => setHistoryFor(null)} />}
      {showAddModal && (
        <AddEquipmentModal
          onClose={() => setShowAddModal(false)}
          // La fenêtre enregistre déjà l'article et ses exemplaires : on recharge seulement les données
          onAdd={() => refreshData()}
        />
      )}

      {showEditModal && selectedEquipment && (
        <EditEquipmentModal
          isOpen={showEditModal}
          equipment={equipment.find(eq => eq.id === selectedEquipment)!}
          onClose={() => {
            setShowEditModal(false);
            setSelectedEquipment(null);
          }}
        />
      )}

      {showQRModal && selectedEquipment && (
        <Modal
          isOpen={showQRModal}
          onClose={() => {
            setShowQRModal(false);
            setSelectedEquipment(null);
            setSelectedInstance(null);
          }}
          title="Code QR"
        >
          <QRCodeGenerator
            value={selectedEquipment}
            title={equipment.find(eq => eq.id === selectedEquipment)?.name || ''}
            subtitle={selectedInstance ? `Instance #${selectedInstance.instanceNumber}` : equipment.find(eq => eq.id === selectedEquipment)?.articleNumber || ''}
            size={200}
            printable={true}
          />
        </Modal>
      )}

      {showQRCodesModal && selectedEquipmentForQR && (
        <QRCodesModal
          isOpen={showQRCodesModal}
          equipment={selectedEquipmentForQR}
          onClose={() => {
            setShowQRCodesModal(false);
            setSelectedEquipmentForQR(null);
          }}
        />
      )}

      {showMaintenanceModal && selectedEquipment && (
        <MaintenanceModal
          isOpen={showMaintenanceModal}
          equipment={equipment.find(eq => eq.id === selectedEquipment)!}
          onClose={() => {
            setShowMaintenanceModal(false);
            setSelectedEquipment(null);
          }}
        />
      )}

      {showDeleteModal && (
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedEquipment(null);
          }}
          onConfirm={confirmDelete}
          title="Supprimer l'équipement"
          message="Es-tu sûr de vouloir supprimer cet équipement ? Cette action est irréversible."
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
        />
      )}

      {zoomedImage && (
        <Modal
          isOpen={!!zoomedImage}
          onClose={() => setZoomedImage(null)}
          title={zoomedImage.name}
          closeOnBackdrop
        >
          <img
            src={zoomedImage.url}
            alt={zoomedImage.name}
            className="w-full max-h-[65vh] object-contain rounded-lg"
          />
        </Modal>
      )}

      <ExcelImport
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {
          setShowImportModal(false);
          refreshData();
        }}
      />
    </div>
  );
}