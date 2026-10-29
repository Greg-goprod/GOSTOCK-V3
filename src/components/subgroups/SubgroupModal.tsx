import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Accordion from '../common/Accordion';
import ColorPicker from '../common/ColorPicker';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { EquipmentSubgroup, EquipmentGroup } from '../../types';
import { Layers, FileText, Palette, Folder as FolderIcon, FolderOpen as FolderOpenIcon } from 'lucide-react';

interface SubgroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  subgroup?: EquipmentSubgroup;
  groups: EquipmentGroup[];
}

const SubgroupModal: React.FC<SubgroupModalProps> = ({ isOpen, onClose, subgroup, groups }) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#64748b',
    groupId: ''
  });

  useEffect(() => {
    if (subgroup) {
      setFormData({
        name: subgroup.name,
        description: subgroup.description || '',
        color: subgroup.color || '#64748b',
        groupId: subgroup.groupId
      });
    } else {
      setFormData({
        name: '',
        description: '',
        color: '#64748b',
        groupId: groups.length > 0 ? groups[0].id : ''
      });
    }
  }, [subgroup, groups]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const dataToSubmit = {
        name: formData.name,
        description: formData.description || null,
        color: formData.color,
        group_id: formData.groupId
      };

      if (subgroup) {
        // Update existing subgroup
        const { error } = await supabase
          .from('equipment_subgroups')
          .update(dataToSubmit)
          .eq('id', subgroup.id);

        if (error) throw error;
        toast.success('Sous-groupe modifié avec succès');
      } else {
        // Create new subgroup
        const { error } = await supabase
          .from('equipment_subgroups')
          .insert([dataToSubmit]);

        if (error) throw error;
        toast.success('Sous-groupe ajouté avec succès');
      }

      onClose();
      setFormData({
        name: '',
        description: '',
        color: '#64748b',
        groupId: groups.length > 0 ? groups[0].id : ''
      });
    } catch (error: any) {
      console.error('Error saving subgroup:', error);
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

  const selectedGroup = groups.find(g => g.id === formData.groupId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={subgroup ? 'MODIFIER LE SOUS-GROUPE' : 'AJOUTER UN SOUS-GROUPE'}
      size="md"
    >
      <div className="space-y-4">
        {/* Informations de base */}
        <Accordion
          title="INFORMATIONS DE BASE"
          icon={<Layers size={18} className="text-primary-600 dark:text-primary-400" />}
          defaultOpen={false}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Groupe parent *
              </label>
              <select
                name="groupId"
                required
                value={formData.groupId}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="">Sélectionner un groupe</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              {selectedGroup && (
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedGroup.color }}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Groupe: {selectedGroup.name}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nom du sous-groupe *
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                placeholder="Ex: Ordinateurs portables, Outils électriques..."
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
                disabled={isLoading || !formData.groupId}
              >
                {isLoading ? 'SAUVEGARDE...' : subgroup ? 'MODIFIER' : 'AJOUTER'}
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
              placeholder="Description détaillée du sous-groupe..."
            />
          </div>
        </Accordion>

        {/* Couleur */}
        <Accordion
          title="COULEUR"
          icon={<Palette size={18} className="text-primary-600 dark:text-primary-400" />}
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Couleur du sous-groupe
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

            {/* Aperçu hiérarchique */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Aperçu de la hiérarchie
              </h4>
              <div className="flex items-center gap-2">
                {selectedGroup && (
                  <>
                    <span 
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: selectedGroup.color }}
                    >
                      <FolderIcon className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />{selectedGroup.name}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">→</span>
                  </>
                )}
                <span 
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: formData.color }}
                >
                  <FolderOpenIcon className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />{formData.name || 'Nom du sous-groupe'}
                </span>
              </div>
            </div>
          </div>
        </Accordion>
      </div>
    </Modal>
  );
};

export default SubgroupModal;