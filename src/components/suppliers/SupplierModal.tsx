import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Accordion from '../common/Accordion';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Supplier } from '../../types';
import { Building, User } from 'lucide-react';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier;
}

const SupplierModal: React.FC<SupplierModalProps> = ({ isOpen, onClose, supplier }) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    lead_time_days: '7'
  });

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name,
        contact_person: supplier.contactPerson || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        website: supplier.website || '',
        lead_time_days: String(supplier.leadTimeDays ?? 7)
      });
    } else {
      setFormData({
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        website: '',
        lead_time_days: '7'
      });
    }
  }, [supplier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const dataToSubmit = {
        name: formData.name,
        contact_person: formData.contact_person || null,
        email: formData.email || null,
        phone: formData.phone || null,
        website: formData.website || null,
        lead_time_days: Math.max(0, Number(formData.lead_time_days) || 7)
      };

      if (supplier) {
        // Update existing supplier
        const { error } = await supabase
          .from('suppliers')
          .update(dataToSubmit)
          .eq('id', supplier.id);

        if (error) throw error;
        toast.success(t('supplierUpdated'));
      } else {
        // Create new supplier
        const { error } = await supabase
          .from('suppliers')
          .insert([dataToSubmit]);

        if (error) throw error;
        toast.success(t('supplierAdded'));
      }

      onClose();
      setFormData({
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        website: '',
        lead_time_days: '7'
      });
    } catch (error: any) {
      console.error('Error saving supplier:', error);
      toast.error(error.message || t('errorSavingSupplier'));
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
      title={supplier ? 'MODIFIER LE FOURNISSEUR' : 'AJOUTER UN FOURNISSEUR'}
      size="md"
    >
      <div className="space-y-4">
        {/* Informations de base */}
        <Accordion
          title="INFORMATIONS DE BASE"
          icon={<Building size={18} className="text-primary-600 dark:text-primary-400" />}
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
                {isLoading ? t('saving') : supplier ? t('save') : t('add')}
              </Button>
            </div>
          </form>
        </Accordion>

        {/* Contact */}
        <Accordion
          title="CONTACT"
          icon={<User size={18} className="text-success-600 dark:text-success-400" />}
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('contactPerson')}
              </label>
              <input
                type="text"
                name="contact_person"
                value={formData.contact_person}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>

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
                {t('phone')}
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('website')}
              </label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label htmlFor="supplier-lead" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Délai de livraison (jours)
              </label>
              <input
                id="supplier-lead"
                type="number"
                min={0}
                name="lead_time_days"
                value={formData.lead_time_days}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono"
              />
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Sert au calcul des seuils proposés pour les consommables.</p>
            </div>
          </div>
        </Accordion>
      </div>
    </Modal>
  );
};

export default SupplierModal;