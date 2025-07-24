import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import AddEquipmentModal from '../components/equipment/AddEquipmentModal';
import EditEquipmentModal from '../components/equipment/EditEquipmentModal';
import QRCodeGenerator from '../components/QRCode/QRCodeGenerator';
import QRCodesModal from '../components/equipment/QRCodesModal';
import MaintenanceModal from '../components/maintenance/MaintenanceModal';
import MaintenanceHistoryModal from '../components/maintenance/MaintenanceHistoryModal';
import CheckoutModal from '../components/checkout/CheckoutModal';
import ReturnModal from '../components/checkout/ReturnModal';
import FilterPanel from '../components/common/FilterPanel';
import ConfirmModal from '../components/common/ConfirmModal';
import ExcelImport from '../components/import/ExcelImport';
import { Plus, QrCode, Wrench, History, LogOut, LogIn, Edit, Trash2, Download, Upload, Search, Filter, PenTool as Tool, Grid3X3, List, RefreshCw } from 'lucide-react';
import { Equipment as EquipmentType, EquipmentInstance } from '../types';
import toast from 'react-hot-toast';

export default function Equipment() {
  const {
    equipment,
    categories,
    suppliers,
    equipmentGroups,
    equipmentSubgroups,
    equipmentInstances,
    checkouts,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    refreshData,
    refreshEquipmentData,
    forceUpdateEquipmentAvailability
  } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showQRCodesModal, setShowQRCodesModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showMaintenanceHistoryModal, setShowMaintenanceHistoryModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [selectedEquipmentForQR, setSelectedEquipmentForQR] = useState<EquipmentType | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<EquipmentInstance | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    supplier: '',
    group: '',
    subgroup: ''
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      c => c.equipment_id === eq.id && 
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

  const confirmDelete = async () => {
    if (selectedEquipment) {
      await deleteEquipment(selectedEquipment);
      setShowDeleteModal(false);
      setSelectedEquipment(null);
    }
  };

  const handleMaintenance = (equipmentId: string) => {
    setSelectedEquipment(equipmentId);
    setShowMaintenanceModal(true);
  };

  const handleMaintenanceHistory = (equipmentId: string) => {
    setSelectedEquipment(equipmentId);
    setShowMaintenanceHistoryModal(true);
  };

  const handleCheckout = (equipmentId: string, instance?: EquipmentInstance) => {
    setSelectedEquipment(equipmentId);
    setSelectedInstance(instance || null);
    setShowCheckoutModal(true);
  };

  const handleReturn = (equipmentId: string, instance?: EquipmentInstance) => {
    setSelectedEquipment(equipmentId);
    setSelectedInstance(instance || null);
    setShowReturnModal(true);
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
    // Debug pour vérifier les URLs d'images
    console.log(`Équipement: ${eq.name}, Image URL:`, eq.imageUrl);
    console.log("Données équipement complètes:", eq);
    
    const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         eq.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (eq.articleNumber && eq.articleNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = !filters.status || eq.status === filters.status;
    const matchesCategory = !filters.category || eq.category === filters.category;
    const matchesSupplier = !filters.supplier || eq.supplier === filters.supplier;
    const matchesGroup = !filters.group || eq.group === filters.group;
    const matchesSubgroup = !filters.subgroup || eq.subgroup === filters.subgroup;

    return matchesSearch && matchesStatus && matchesCategory && matchesSupplier && matchesGroup && matchesSubgroup;
  });

  const getEquipmentInstances = (equipmentId: string) => {
    return equipmentInstances.filter(instance => instance.equipmentId === equipmentId);
  };

  const renderEquipmentCard = (eq: EquipmentType) => {
    const category = categories.find(c => c.id === eq.category);
    const supplier = suppliers.find(s => s.id === eq.supplier);
    const group = equipmentGroups.find(g => g.id === eq.group);
    const subgroup = equipmentSubgroups.find(sg => sg.id === eq.subgroup);
    const instances = getEquipmentInstances(eq.id);
    
    // Calculer la disponibilité
    const getAvailabilityText = () => {
      if (eq.qrType === 'batch') {
        return `${eq.availableQuantity || 0}/${eq.totalQuantity || 1}`;
      } else if (eq.qrType === 'individual') {
        const availableInstances = instances.filter(inst => inst.status === 'available' || !inst.status).length;
        return `${availableInstances}/${instances.length || 1}`;
      }
      return eq.status === 'available' ? '1/1' : '0/1';
    };

    // Calculer la quantité totale et disponible
    const totalQuantity = eq.totalQuantity || 1;
    
    // Calculer la disponibilité en utilisant la fonction getAvailableQuantity
    let availableQuantity = 0;
    if (['maintenance', 'lost', 'retired'].includes(eq.status)) {
      availableQuantity = 0;
      
      if (eq.name.includes('Trepied laser petit') || eq.name.toLowerCase().includes('accu')) {
        console.log('=== BADGE DEBUG ===');
        console.log('Équipement en maintenance/perdu/retiré, disponibilité forcée à 0');
        console.log('Status:', eq.status);
        console.log('=== FIN BADGE DEBUG ===');
      }
    } else {
      availableQuantity = getAvailableQuantity(eq);
    }
    
    if (eq.name.includes('Trepied laser petit') || eq.name.toLowerCase().includes('accu')) {
      console.log('=== BADGE FINAL ===');
      console.log('Nom:', eq.name);
      console.log('Status:', eq.status);
      console.log('Stock total:', totalQuantity);
      console.log('Disponibilité calculée:', availableQuantity);
      console.log('=== FIN BADGE FINAL ===');
    }

    return (
      <Card key={eq.id} className="p-6 hover:shadow-lg transition-shadow min-h-[200px]">
        <div className="flex items-start space-x-4 h-full">
          {/* Image à gauche */}
          <div className="relative flex-shrink-0 flex items-center justify-center overflow-visible">
            {eq.imageUrl ? (
              <img 
                src={eq.imageUrl} 
                alt={eq.name}
                className="w-24 h-24 object-cover rounded-full border-4 border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-700 p-2 transition-all duration-300 ease-in-out hover:scale-[5] hover:z-50 hover:shadow-2xl cursor-pointer relative"
                onError={(e) => {
                  console.log("Erreur de chargement d'image:", eq.imageUrl);
                  
                  // Stratégie 1: Essayer d'ajouter https:// si l'URL ne commence pas par http ou https
                  const originalSrc = e.currentTarget.src;
                  if (!originalSrc.startsWith('http')) {
                    const newSrc = `https://${originalSrc}`;
                    console.log("Tentative avec URL corrigée:", newSrc);
                    e.currentTarget.src = newSrc;
                    return;
                  }
                  
                  // Si la stratégie 1 ne fonctionne pas, on passe à l'icône de repli
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    // Create a fallback div with the Tool icon
                    const fallbackDiv = document.createElement('div');
                    fallbackDiv.className = 'w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center border-4 border-gray-200 dark:border-gray-700 shadow-sm p-2 transition-all duration-300 ease-in-out hover:scale-[5] hover:z-50 hover:shadow-2xl cursor-pointer relative';
                    
                    // We can't directly insert a React component, so we'll use a simple SVG
                    fallbackDiv.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400 mx-auto">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                      </svg>
                    `;
                    
                    parent.appendChild(fallbackDiv);
                  }
                }}
              />
            ) : (
              <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center border-4 border-gray-200 dark:border-gray-700 shadow-sm p-2 transition-all duration-300 ease-in-out hover:scale-[5] hover:z-50 hover:shadow-2xl cursor-pointer relative">
                <Tool className="w-12 h-12 text-gray-400" />
              </div>
            )}
          </div>

          {/* Informations à droite */}
          <div className="flex-1 flex flex-col justify-between h-full">
            <div className="space-y-3">
              {/* Nom du matériel */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{eq.name}</h3>
                {eq.shortTitle && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{eq.shortTitle}</p>
                )}
              </div>

              {/* Badges simplifiés */}
              <div className="flex items-center gap-2">
                {/* Badge Stock */}
                <span className="px-3 py-1 bg-blue-50 bg-opacity-80 dark:bg-blue-900 dark:bg-opacity-80 text-blue-800 dark:text-blue-100 border border-blue-200 dark:border-blue-700 rounded-full text-sm font-medium backdrop-blur-sm">
                  Stock: {totalQuantity}
                </span>
                
                {/* Badge Disponible */}
                <span className={`px-3 py-1 ${availableQuantity > 0 ? 'bg-green-50 bg-opacity-80 dark:bg-green-900 dark:bg-opacity-80 text-green-800 dark:text-green-100 border border-green-200 dark:border-green-700' : 'bg-red-50 bg-opacity-80 dark:bg-red-900 dark:bg-opacity-80 text-red-800 dark:text-red-100 border border-red-200 dark:border-red-700'} rounded-full text-sm font-medium backdrop-blur-sm`}>
                  Disponible: {availableQuantity}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleShowQR(eq.id)}
              >
                <QrCode className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(eq.id)}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMaintenance(eq.id)}
              >
                <Wrench className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(eq.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const renderEquipmentList = () => {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredEquipment.map((eq) => {
                const category = categories.find(c => c.id === eq.category);
                const instances = getEquipmentInstances(eq.id);
                
                return (
                  <tr key={eq.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-12 w-12">
                          {eq.imageUrl ? (
                            <img
                              className="h-12 w-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-700 p-1 transition-all duration-300 ease-in-out hover:scale-[5] hover:z-50 hover:shadow-2xl cursor-pointer relative"
                              src={eq.imageUrl}
                              alt={eq.name}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  parent.innerHTML = `
                                    <div class="h-12 w-12 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center border-2 border-gray-200 dark:border-gray-700 shadow-sm p-1 transition-all duration-300 ease-in-out hover:scale-[5] hover:z-50 hover:shadow-2xl cursor-pointer relative">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400">
                                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                                      </svg>
                                    </div>
                                  `;
                                }
                              }}
                            />
                          ) : (
                            <div className="h-12 w-12 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center border-2 border-gray-200 dark:border-gray-700 shadow-sm p-1 transition-all duration-300 ease-in-out hover:scale-[5] hover:z-50 hover:shadow-2xl cursor-pointer relative">
                              <Tool className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {eq.name}
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
                      <Badge variant="outline">
                        {eq.status}
                      </Badge>
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleShowQR(eq.id)}
                        >
                          <QrCode className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(eq.id)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(eq.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
  const handleRefreshEquipment = async () => {
    setIsRefreshing(true);
    await refreshEquipmentData();
    setIsRefreshing(false);
    toast.success('Données d\'équipement rafraîchies');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Équipements</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefreshEquipment}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Rafraîchissement...' : 'Rafraîchir'}
          </Button>
          <Button
            variant="outline"
            onClick={() => forceUpdateEquipmentAvailability()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Recalculer Disponibilité
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowImportModal(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Importer
          </Button>
          <Button
            variant="outline"
            onClick={exportToCSV}
          >
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un équipement
          </Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Rechercher par nom, numéro de série ou numéro d'article..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            onClick={() => setViewMode('grid')}
            className="flex items-center gap-2 rounded-none border-0"
          >
            <Grid3X3 className="w-4 h-4" />
            Grille
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            onClick={() => setViewMode('list')}
            className="flex items-center gap-2 rounded-none border-0"
          >
            <List className="w-4 h-4" />
            Liste
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filtres
        </Button>
      </div>

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

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredEquipment.map(renderEquipmentCard)}
        </div>
      ) : (
        renderEquipmentList()
      )}

      {filteredEquipment.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Aucun équipement trouvé.</p>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddEquipmentModal
          onClose={() => setShowAddModal(false)}
          onAdd={addEquipment}
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

      {showMaintenanceHistoryModal && selectedEquipment && (
        <MaintenanceHistoryModal
          equipmentId={selectedEquipment}
          onClose={() => {
            setShowMaintenanceHistoryModal(false);
            setSelectedEquipment(null);
          }}
        />
      )}

      {showCheckoutModal && selectedEquipment && (
        <CheckoutModal
          equipmentId={selectedEquipment}
          instance={selectedInstance}
          onClose={() => {
            setShowCheckoutModal(false);
            setSelectedEquipment(null);
            setSelectedInstance(null);
          }}
        />
      )}

      {showReturnModal && selectedEquipment && (
        <ReturnModal
          equipmentId={selectedEquipment}
          instance={selectedInstance}
          onClose={() => {
            setShowReturnModal(false);
            setSelectedEquipment(null);
            setSelectedInstance(null);
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
          message="Êtes-vous sûr de vouloir supprimer cet équipement ? Cette action est irréversible."
          confirmText="Supprimer"
          cancelText="Annuler"
          variant="danger"
        />
      )}

      {showImportModal && (
        <Modal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          title="Importer des équipements"
        >
          <ExcelImport
            onClose={() => setShowImportModal(false)}
            onImportComplete={() => {
              setShowImportModal(false);
              refreshData();
            }}
          />
        </Modal>
      )}
    </div>
  );
}