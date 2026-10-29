import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Accordion from '../common/Accordion';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Equipment, MaintenanceType, EquipmentMaintenance } from '../../types';
import { Wrench, FileText, DollarSign, User, Calendar } from 'lucide-react';

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment;
  maintenance?: EquipmentMaintenance;
}

const MaintenanceModal: React.FC<MaintenanceModalProps> = ({ 
  isOpen, 
  onClose, 
  equipment, 
  maintenance 
}) => {
  const { t } = useLanguage();
  const [maintenanceTypes, setMaintenanceTypes] = useState<MaintenanceType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    maintenanceTypeId: '',
    title: '',
    description: '',
    technicianName: '',
    cost: '',
    notes: '',
    status: 'in_progress' as 'in_progress' | 'completed' | 'cancelled'
  });

  useEffect(() => {
    if (isOpen) {
      fetchMaintenanceTypes();
      
      if (maintenance) {
        // Mode édition
        setFormData({
          maintenanceTypeId: maintenance.maintenanceTypeId,
          title: maintenance.title,
          description: maintenance.description || '',
          technicianName: maintenance.technicianName || '',
          cost: maintenance.cost?.toString() || '',
          notes: maintenance.notes || '',
          status: maintenance.status
        });
      } else {
        // Mode création
        setFormData({
          maintenanceTypeId: '',
          title: '',
          description: '',
          technicianName: '',
          cost: '',
          notes: '',
          status: 'in_progress'
        });
      }
    }
  }, [isOpen, maintenance]);

  const fetchMaintenanceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('maintenance_types')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setMaintenanceTypes(data || []);
    } catch (error) {
      console.error('Error fetching maintenance types:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const dataToSubmit = {
        equipment_id: equipment.id,
        maintenance_type_id: formData.maintenanceTypeId,
        title: formData.title,
        description: formData.description || null,
        technician_name: formData.technicianName || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        notes: formData.notes || null,
        status: formData.status,
        ...(formData.status === 'completed' && !maintenance?.endDate ? { end_date: new Date().toISOString() } : {})
      };

      if (maintenance) {
        // Update existing maintenance
        const { error } = await supabase
          .from('equipment_maintenance')
          .update(dataToSubmit)
          .eq('id', maintenance.id);

        if (error) throw error;
        toast.success('Maintenance mise à jour avec succès');
      } else {
        // Create new maintenance
        const { error } = await supabase
          .from('equipment_maintenance')
          .insert([dataToSubmit]);

        if (error) throw error;
        toast.success('Maintenance créée avec succès');
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving maintenance:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const selectedType = maintenanceTypes.find(t => t.id === formData.maintenanceTypeId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={maintenance ? 'MODIFIER LA MAINTENANCE' : 'NOUVELLE MAINTENANCE'}
      size="lg"
    >
      <div className="space-y-4">
        {/* Informations équipement */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-2">
            <Wrench className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />MATÉRIEL EN MAINTENANCE
          </h3>
          <div className="flex items-center gap-3">
            <div>
              <p className="font-medium text-blue-700 dark:text-blue-300">
                {equipment.name}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                N° Série: {equipment.serialNumber} • Article: {equipment.articleNumber}
              </p>
            </div>
          </div>
        </div>

        {/* Informations de base */}
        <Accordion
          title="TYPE DE MAINTENANCE/PANNE"
          icon={<Wrench size={18} className="text-blue-600 dark:text-blue-400" />}
          defaultOpen={false}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type de maintenance/panne *
              </label>
              <select
                name="maintenanceTypeId"
                required
                value={formData.maintenanceTypeId}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="">Sélectionner un type</option>
                {maintenanceTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              {selectedType && (
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedType.color }}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedType.description}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Titre de l'intervention *
              </label>
              <input
                type="text"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                placeholder="Ex: Remplacement disque dur, Réparation écran..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Statut
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="in_progress">En cours</option>
                <option value="completed">Terminée</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={onClose}
              >
                ANNULER
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'SAUVEGARDE...' : maintenance ? 'MODIFIER' : 'CRÉER'}
              </Button>
            </div>
          </form>
        </Accordion>

        {/* Description */}
        <Accordion
          title="DESCRIPTION DE L'INTERVENTION"
          icon={<FileText size={18} className="text-green-600 dark:text-green-400" />}
          defaultOpen={false}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description détaillée
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              placeholder="Décrivez le problème, les symptômes, les actions entreprises..."
            />
          </div>
        </Accordion>

        {/* Informations techniques */}
        <Accordion
          title="INFORMATIONS TECHNIQUES"
          icon={<User size={18} className="text-purple-600 dark:text-purple-400" />}
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nom du technicien
              </label>
              <input
                type="text"
                name="technicianName"
                value={formData.technicianName}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                placeholder="Nom du technicien responsable"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Coût estimé/réel (€)
              </label>
              <input
                type="number"
                name="cost"
                step="0.01"
                min="0"
                value={formData.cost}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                placeholder="0.00"
              />
            </div>
          </div>
        </Accordion>

        {/* Notes */}
        <Accordion
          title="NOTES ADDITIONNELLES"
          icon={<FileText size={18} className="text-orange-600 dark:text-orange-400" />}
          defaultOpen={false}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes et observations
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              placeholder="Notes supplémentaires, observations, recommandations..."
            />
          </div>
        </Accordion>
      </div>
    </Modal>
  );
};

export default MaintenanceModal;