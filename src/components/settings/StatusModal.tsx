import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Accordion from '../common/Accordion';
import ColorPicker from '../common/ColorPicker';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { StatusConfig } from '../../types';
import { Settings, Palette } from 'lucide-react';

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  status?: StatusConfig;
}

const StatusModal: React.FC<StatusModalProps> = ({ isOpen, onClose, status }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    color: '#64748b'
  });

  useEffect(() => {
    if (status) {
      setFormData({
        id: status.id,
        name: status.name,
        color: status.color
      });
    } else {
      setFormData({
        id: '',
        name: '',
        color: '#64748b'
      });
    }
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const dataToSubmit = {
        id: formData.id || formData.name.toLowerCase().replace(/\s+/g, '_'),
        name: formData.name,
        color: formData.color
      };

      if (status) {
        // Update existing status
        const { error } = await supabase
          .from('status_configs')
          .update(dataToSubmit)
          .eq('id', status.id);

        if (error) throw error;
        toast.success('Statut modifié avec succès');
      } else {
        // Create new status
        const { error } = await supabase
          .from('status_configs')
          .insert([dataToSubmit]);

        if (error) throw error;
        toast.success('Statut ajouté avec succès');
      }

      onClose();
      setFormData({
        id: '',
        name: '',
        color: '#64748b'
      });
    } catch (error: any) {
      console.error('Error saving status:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      title={status ? 'Modifier le statut' : 'Ajouter un statut'}
      size="md"
    >
      <div className="space-y-4">
        {/* Informations de base */}
        <Accordion
          title="Informations de base"
          icon={<Settings size={18} className="text-primary-600 dark:text-primary-400" />}
          defaultOpen={false}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nom du statut *
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                placeholder="Ex: Disponible, En maintenance, etc."
              />
            </div>

            {!status && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Identifiant (optionnel)
                </label>
                <input
                  type="text"
                  name="id"
                  value={formData.id}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  placeholder="Généré automatiquement si vide"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Laissez vide pour générer automatiquement
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={onClose}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'Enregistrement…' : status ? 'Modifier' : 'Ajouter'}
              </Button>
            </div>
          </form>
        </Accordion>

        {/* Couleur */}
        <Accordion
          title="Couleur"
          icon={<Palette size={18} className="text-primary-600 dark:text-primary-400" />}
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Couleur du statut
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
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Aperçu du badge
              </h4>
              <div className="flex items-center gap-2">
                <span 
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: formData.color }}
                >
                  {formData.name || 'Nom du statut'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Aperçu du rendu final
                </span>
              </div>
            </div>
          </div>
        </Accordion>
      </div>
    </Modal>
  );
};

export default StatusModal;