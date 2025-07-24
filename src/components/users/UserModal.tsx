import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Accordion from '../common/Accordion';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { User } from '../../types';
import { User as UserIcon, Mail, Building } from 'lucide-react';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, user }) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: '',
    role: 'user'
  });

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone || '',
        department: user.department,
        role: user.role
      });
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        department: '',
        role: 'user'
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Validation uniquement pour les champs obligatoires : nom, prénom et téléphone
    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.phone.trim()) {
      toast.error('Veuillez remplir tous les champs obligatoires (prénom, nom et téléphone)');
      setIsLoading(false);
      return;
    }

    try {
      const dataToSubmit = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null, // Email peut être vide
        phone: formData.phone,
        department: formData.department || null, // Département peut être vide
        role: formData.role
      };

      if (user) {
        // Update existing user
        const { error } = await supabase
          .from('users')
          .update(dataToSubmit)
          .eq('id', user.id);

        if (error) throw error;
        toast.success(t('userUpdated'));
      } else {
        // Create new user
        const { error } = await supabase
          .from('users')
          .insert([dataToSubmit]);

        if (error) throw error;
        toast.success(t('userAdded'));
      }

      onClose();
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        department: '',
        role: 'user'
      });
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(error.message || t('errorSavingUser'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
      title={user ? 'MODIFIER L\'UTILISATEUR' : 'AJOUTER UN UTILISATEUR'}
      size="md"
    >
      <div className="space-y-4">
        {/* Informations personnelles */}
        <Accordion
          title="INFORMATIONS PERSONNELLES"
          icon={<UserIcon size={18} className="text-blue-600 dark:text-blue-400" />}
          defaultOpen={true}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Prénom *
                </label>
                <input
                  type="text"
                  name="first_name"
                  required
                  value={formData.first_name}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nom *
                </label>
                <input
                  type="text"
                  name="last_name"
                  required
                  value={formData.last_name}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
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
                {isLoading ? t('saving') : user ? t('save') : t('add')}
              </Button>
            </div>
          </form>
        </Accordion>

        {/* Contact */}
        <Accordion
          title="CONTACT"
          icon={<Mail size={18} className="text-green-600 dark:text-green-400" />}
          defaultOpen={true}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('email')}
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('phone')} *
              </label>
              <input
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </Accordion>

        {/* Organisation */}
        <Accordion
          title="ORGANISATION"
          icon={<Building size={18} className="text-purple-600 dark:text-purple-400" />}
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('department')}
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('role')}
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="user">{t('user')}</option>
                <option value="admin">{t('admin')}</option>
              </select>
            </div>
          </div>
        </Accordion>
      </div>
    </Modal>
  );
};

export default UserModal;