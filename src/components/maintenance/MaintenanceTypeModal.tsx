import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Accordion from '../common/Accordion';
import ColorPicker from '../common/ColorPicker';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { MaintenanceType } from '../../types';
import { Wrench, FileText, Palette } from 'lucide-react';

interface MaintenanceTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  maintenanceType?: MaintenanceType;
}

const MaintenanceTypeModal: React.FC<MaintenanceTypeModalProps> = ({ isOpen, onClose, maintenanceType }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#f59e0b'
  });

  useEffect(() => {
    if (maintenanceType) {
      setFormData({
        name: maintenanceType.name,
        description: maintenanceType.description || '',
        color: maintenanceType.color || '#f59e0b'
      });
    } else {
      setFormData({
        name: '',
        description: '',
        color: '#f59e0b'
      });
    }
  }, [maintenanceType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const dataToSubmit = {
        name: formData.name,
        description: formData.description || null,
        color: formData.color
      };

      if (maintenanceType) {
        // Update existing maintenance type
        const { error } = await supabase
          .from('maintenance_types')
          .update(dataToSubmit)
          .eq('id', maintenanceType.id);

        if (error) throw error;
        toast.success('Type de maintenance modifié avec succès');
      } else {
        // Create new maintenance type
        const { error } = await supabase
          .from('maintenance_types')
          .insert([dataToSubmit]);

        if (error) throw error;
        toast.success('Type de maintenance ajouté avec succès');
      }

      onClose();
      setFormData({
        name: '',
        description: '',
        color: '#f59e0b'
      });
    } catch (error: any) {
      console.error('Error saving maintenance type:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={maintenanceType ? 'MODIFIER LE TYPE DE MAINTENANCE' : 'AJOUTER UN TYPE DE MAINTENANCE'}
      size="md"
    >
      <div className="space-y-4">
        {/* Informations de base */}
        <Accordion
          title="INFORMATIONS DE BASE"
          icon={<Wrench size={18} className="text-primary-600 dark:text-primary-400" />}
          defaultOpen={false}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nom du type de maintenance *
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                placeholder="Ex: Maintenance préventive, Panne électrique..."
              />
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
                {isLoading ? 'SAUVEGARDE...' : maintenanceType ? 'MODIFIER' : 'AJOUTER'}
              </Button>
            </div>
          </form>
        </Accordion>

        {/* Description */}
        <Accordion
          title="DESCRIPTION"
          icon={<FileText size={18} className="text-success-600 dark:text-success-400" />}
          defaultOpen={false}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              placeholder="Description du type de maintenance..."
            />
          </div>
        </Accordion>

        {/* Couleur */}
        <Accordion
          title="COULEUR"
          icon={<Palette size={18} className="text-primary-600 dark:text-primary-400" />}
          defaultOpen={false}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Couleur
            </label>
            <div className="flex items-center gap-3">
              <ColorPicker
                color={formData.color}
                onChange={(color) => setFormData(prev => ({ ...prev, color }))}
              />
              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                {formData.color}
              </span>
            </div>
          </div>

          {/* Aperçu */}
          <div className="mt-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Aperçu du badge
            </h4>
            <div className="flex items-center gap-2">
              <span 
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: formData.color }}
              >
                {formData.name || 'Type de maintenance'}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Aperçu du rendu final
              </span>
            </div>
          </div>
        </Accordion>
      </div>
    </Modal>
  );
};

export default MaintenanceTypeModal;