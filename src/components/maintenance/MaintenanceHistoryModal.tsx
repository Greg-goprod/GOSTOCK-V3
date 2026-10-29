import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { supabase } from '../../lib/supabase';
import { Equipment, EquipmentMaintenance, MaintenanceType } from '../../types';
import { Wrench, Calendar, Clock, CheckCircle, AlertTriangle, FileText, DollarSign, User, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import MaintenanceModal from './MaintenanceModal';

interface MaintenanceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment;
}

const MaintenanceHistoryModal: React.FC<MaintenanceHistoryModalProps> = ({ isOpen, onClose, equipment }) => {
  const [maintenanceHistory, setMaintenanceHistory] = useState<EquipmentMaintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [selectedMaintenance, setSelectedMaintenance] = useState<EquipmentMaintenance | null>(null);

  useEffect(() => {
    if (isOpen && equipment) {
      fetchMaintenanceHistory();
    }
  }, [isOpen, equipment]);

  const fetchMaintenanceHistory = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('equipment_maintenance')
        .select(`
          *,
          maintenance_types(*)
        `)
        .eq('equipment_id', equipment.id)
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      
      // Transform data to match our interface
      const transformedData: EquipmentMaintenance[] = data?.map(item => ({
        id: item.id,
        equipmentId: item.equipment_id,
        maintenanceTypeId: item.maintenance_type_id,
        title: item.title,
        description: item.description,
        startDate: item.start_date,
        endDate: item.end_date,
        status: item.status,
        technicianName: item.technician_name,
        cost: item.cost,
        notes: item.notes,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        maintenanceType: item.maintenance_types ? {
          id: item.maintenance_types.id,
          name: item.maintenance_types.name,
          description: item.maintenance_types.description,
          color: item.maintenance_types.color,
          createdAt: item.maintenance_types.created_at
        } : {
          id: '',
          name: 'Maintenance',
          description: '',
          color: '#f59e0b',
          createdAt: ''
        }
      })) || [];
      
      setMaintenanceHistory(transformedData);
    } catch (error) {
      console.error('Error fetching maintenance history:', error);
      toast.error('Erreur lors du chargement de l\'historique de maintenance');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMaintenance = () => {
    setSelectedMaintenance(null);
    setShowMaintenanceModal(true);
  };

  const handleEditMaintenance = (maintenance: EquipmentMaintenance) => {
    setSelectedMaintenance(maintenance);
    setShowMaintenanceModal(true);
  };

  const handleCloseMaintenanceModal = () => {
    setShowMaintenanceModal(false);
    setSelectedMaintenance(null);
    fetchMaintenanceHistory(); // Refresh data
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">
            En cours
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">
            Terminée
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200">
            Annulée
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getDuration = (startDate: string, endDate?: string) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`HISTORIQUE DE MAINTENANCE - ${equipment.name}`}
        size="xl"
      >
        <div className="space-y-6">
          {/* Informations équipement */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-2">
                  MATÉRIEL
                </h3>
                <p className="font-medium text-blue-700 dark:text-blue-300">
                  {equipment.name}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  N° Série: {equipment.serialNumber} • Article: {equipment.articleNumber}
                </p>
                {equipment.lastMaintenance && (
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    Dernière maintenance: {formatDate(equipment.lastMaintenance)}
                  </p>
                )}
              </div>
              <Button
                variant="primary"
                icon={<Plus size={16} />}
                onClick={handleAddMaintenance}
                className="font-bold"
              >
                NOUVELLE MAINTENANCE
              </Button>
            </div>
          </div>

          {/* Historique des maintenances */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500 dark:text-gray-400 font-medium">Chargement de l'historique...</div>
            </div>
          ) : maintenanceHistory.length === 0 ? (
            <div className="text-center py-12">
              <Wrench size={48} className="mx-auto text-gray-500 dark:text-gray-400 mb-4" />
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2 uppercase">
                AUCUN HISTORIQUE DE MAINTENANCE
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4 font-medium">
                Aucune maintenance n'a été enregistrée pour ce matériel.
              </p>
              <Button
                variant="primary"
                icon={<Plus size={18} />}
                onClick={handleAddMaintenance}
                className="font-bold"
              >
                AJOUTER UNE MAINTENANCE
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {maintenanceHistory.map((maintenance) => (
                <div 
                  key={maintenance.id} 
                  className={`border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                    maintenance.status === 'in_progress' 
                      ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20' 
                      : maintenance.status === 'completed'
                      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                  }`}
                  onClick={() => handleEditMaintenance(maintenance)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: maintenance.maintenanceType.color }}
                        >
                          {maintenance.maintenanceType.name}
                        </span>
                        {getStatusBadge(maintenance.status)}
                      </div>
                      
                      <h4 className="font-bold text-gray-900 dark:text-white mb-1">
                        {maintenance.title}
                      </h4>
                      
                      {maintenance.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
                          {maintenance.description}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>Début: {formatDate(maintenance.startDate)}</span>
                        </div>
                        
                        {maintenance.endDate && (
                          <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            <span>Fin: {formatDate(maintenance.endDate)}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1">
                          <Clock size={12} />
                          <span>
                            {getDuration(maintenance.startDate, maintenance.endDate)} jour(s)
                          </span>
                        </div>
                        
                        {maintenance.technicianName && (
                          <div className="flex items-center gap-1">
                            <User size={12} />
                            <span>{maintenance.technicianName}</span>
                          </div>
                        )}
                        
                        {maintenance.cost && (
                          <div className="flex items-center gap-1">
                            <DollarSign size={12} />
                            <span>{maintenance.cost.toFixed(2)} €</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0 ml-4">
                      {maintenance.status === 'in_progress' ? (
                        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-medium">
                          <Wrench size={14} />
                          <span>En cours</span>
                        </div>
                      ) : maintenance.status === 'completed' ? (
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium">
                          <CheckCircle size={14} />
                          <span>Terminée</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-medium">
                          <AlertTriangle size={14} />
                          <span>Annulée</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal pour ajouter/modifier une maintenance */}
      {showMaintenanceModal && (
        <MaintenanceModal
          isOpen={showMaintenanceModal}
          onClose={handleCloseMaintenanceModal}
          equipment={equipment}
          maintenance={selectedMaintenance || undefined}
        />
      )}
    </>
  );
};

export default MaintenanceHistoryModal;