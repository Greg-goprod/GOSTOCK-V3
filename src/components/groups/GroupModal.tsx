import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Accordion from '../common/Accordion';
import ColorPicker from '../common/ColorPicker';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { EquipmentGroup } from '../../types';
import { Users, FileText, Palette } from 'lucide-react';

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group?: EquipmentGroup;
}

const GroupModal: React.FC<GroupModalProps> = ({ isOpen, onClose, group }) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#64748b'
  });

  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name,
        description: group.description || '',
        color: group.color || '#64748b'
      });
    } else {
      setFormData({
        name: '',
        description: '',
        color: '#64748b'
      });
    }
  }, [group]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const dataToSubmit = {
        name: formData.name,
        description: formData.description || null,
        color: formData.color
      };

      if (group) {
        // Update existing group
        const { error } = await supabase
          .from('equipment_groups')
          .update(dataToSubmit)
          .eq('id', group.id);

        if (error) throw error;
        toast.success(t('saved'));
      } else {
        // Create new group
        const { error } = await supabase
          .from('equipment_groups')
          .insert([dataToSubmit]);

        if (error) throw error;
        toast.success(t('success'));
      }

      onClose();
      setFormData({
        name: '',
        description: '',
        color: '#64748b'
      });
    } catch (error: any) {
      console.error('Error saving group:', error);
      toast.error(error.message || t('error'));
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
      title={group ? 'MODIFIER LE GROUPE' : 'AJOUTER UN GROUPE'}
      size="md"
    >
      <div className="space-y-4">
        {/* Informations de base */}
        <Accordion
          title="INFORMATIONS DE BASE"
          icon={<Users size={18} className="text-blue-600 dark:text-blue-400" />}
          defaultOpen={false}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('name')} *
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={onClose}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? t('saving') : group ? t('save') : t('add')}
              </Button>
            </div>
          </form>
        </Accordion>

        {/* Description */}
        <Accordion
          title="DESCRIPTION"
          icon={<FileText size={18} className="text-green-600 dark:text-green-400" />}
          defaultOpen={false}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('description')}
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
        </Accordion>

        {/* Couleur */}
        <Accordion
          title="COULEUR"
          icon={<Palette size={18} className="text-purple-600 dark:text-purple-400" />}
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
                {formData.name || 'Nom du groupe'}
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

export default GroupModal;