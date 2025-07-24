import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

interface DirectReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkout: {
    id: string;
    equipment: {
      id: string;
      name: string;
      serialNumber: string;
    };
    users: {
      first_name: string;
      last_name: string;
    };
    checkout_date: string;
    due_date: string;
    status: string;
    delivery_note_id?: string;
  };
}

const DirectReturnModal: React.FC<DirectReturnModalProps> = ({ isOpen, onClose, checkout }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState(false);
  const { refreshEquipmentData } = useApp();
  
  // Check if the checkout is overdue
  const dueDate = new Date(checkout.due_date);
  dueDate.setHours(23, 59, 59, 999); // Fin de la journée de la date d'échéance
  
  const today = new Date();
  
  // Comparaison des dates pour déterminer si l'emprunt est en retard
  // Nous comparons uniquement les dates sans tenir compte de l'heure
  const dueDateStr = checkout.due_date.split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];
  const isOverdue = dueDateStr < todayStr && checkout.status === 'active';
  
  // Logs de débogage
  console.log('DirectReturnModal - Date d\'échéance:', dueDateStr);
  console.log('DirectReturnModal - Date actuelle:', todayStr);
  console.log('DirectReturnModal - En retard?', isOverdue);
  
  const isLost = checkout.status === 'lost';

  const handleReturnEquipment = async () => {
    try {
      setIsLoading(true);

      if (isLost) {
        // Marquer l'équipement comme perdu
        const { error: lostError } = await supabase.rpc('mark_equipment_lost', {
          checkout_id: checkout.id
        });
        
        if (lostError) throw lostError;
        
        // Mettre à jour les notes
        await supabase
          .from('checkouts')
          .update({ 
            notes: `${checkout.notes || ''}\n${notes ? `Perdu: ${notes}` : 'Marqué comme perdu'}`.trim(),
            status: 'lost'
          })
          .eq('id', checkout.id);
          
        // Rafraîchir les données d'équipement
        await refreshEquipmentData();
        
        setSuccess(true);
        toast.success('Équipement marqué comme perdu');
      } else if (isRecovered) {
        // Récupérer un équipement précédemment perdu
        const { error: recoverError } = await supabase.rpc('recover_lost_equipment', {
          checkout_id: checkout.id
        });
        
        if (recoverError) throw recoverError;
        
        // Mettre à jour les notes
        await supabase
          .from('checkouts')
          .update({ 
            notes: `${checkout.notes || ''}\n${notes ? `Retrouvé: ${notes}` : 'Équipement retrouvé'}`.trim(),
            status: 'returned',
            return_date: new Date().toISOString()
          })
          .eq('id', checkout.id);
          
        // Mettre à jour le statut et la disponibilité de l'équipement
        const { data: equipmentData } = await supabase
          .from('equipment')
          .select('available_quantity, total_quantity')
          .eq('id', checkout.equipment.id)
          .single();
          
        if (equipmentData) {
          const newAvailableQuantity = (equipmentData.available_quantity || 0) + 1;
          const newStatus = newAvailableQuantity >= (equipmentData.total_quantity || 1) ? 'available' : 'checked-out';
          
          await supabase
            .from('equipment')
            .update({ 
              status: newStatus,
              available_quantity: newAvailableQuantity
            })
            .eq('id', checkout.equipment.id);
        }
        
        // Rafraîchir les données d'équipement
        await refreshEquipmentData();
        
        setSuccess(true);
        toast.success('Équipement marqué comme retrouvé et retourné');
      } else {
        // Retour normal
        // 1. Mettre à jour le statut du checkout
        const { error: checkoutError } = await supabase
          .from('checkouts')
          .update({
            status: 'returned',
            return_date: new Date().toISOString(),
            notes: notes || null
          })
          .eq('id', checkout.id);

        if (checkoutError) throw checkoutError;

        // 2. Mettre à jour la quantité disponible de l'équipement
        const { data: equipmentData, error: equipmentFetchError } = await supabase
          .from('equipment')
          .select('available_quantity, total_quantity')
          .eq('id', checkout.equipment.id)
          .single();

        if (equipmentFetchError) throw equipmentFetchError;

        const newAvailableQuantity = (equipmentData.available_quantity || 0) + 1;
        const newStatus = newAvailableQuantity >= (equipmentData.total_quantity || 1) ? 'available' : 'checked-out';

        const { error: equipmentUpdateError } = await supabase
          .from('equipment')
          .update({
            status: newStatus,
            available_quantity: newAvailableQuantity
          })
          .eq('id', checkout.equipment.id);

        if (equipmentUpdateError) throw equipmentUpdateError;

        // 3. Vérifier si tous les équipements du bon de sortie sont retournés
        if (checkout.delivery_note_id) {
          const { data: relatedCheckouts, error: relatedError } = await supabase
            .from('checkouts')
            .select('id, status')
            .eq('delivery_note_id', checkout.delivery_note_id);

          if (relatedError) throw relatedError;

          const allReturned = relatedCheckouts?.every(c => c.status === 'returned');
          const anyActive = relatedCheckouts?.some(c => c.status === 'active' || c.status === 'overdue');

          // Mettre à jour le statut du bon de sortie
          if (allReturned) {
            await supabase
              .from('delivery_notes')
              .update({ status: 'returned' })
              .eq('id', checkout.delivery_note_id);
          } else if (anyActive) {
            await supabase
              .from('delivery_notes')
              .update({ status: 'partial' })
              .eq('id', checkout.delivery_note_id);
          }
        }

        toast.success('Matériel retourné avec succès');
      }

      // Rafraîchir les données d'équipement pour mettre à jour l'interface
      await refreshEquipmentData();

      setSuccess(true);
      
      // Fermer la modal après 2 secondes
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (error: any) {
      console.error('Error returning equipment:', error);
      toast.error(error.message || 'Erreur lors du retour du matériel');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isLost ? "RÉCUPÉRATION DE MATÉRIEL PERDU" : "RETOUR DIRECT DE MATÉRIEL"}
      size="md"
    >
      {success ? (
        <div className="text-center py-8">
          <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
          <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">
            {isLost ? 'MATÉRIEL RETROUVÉ' : 'RETOUR EFFECTUÉ AVEC SUCCÈS'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {isLost 
              ? 'Le matériel a été remis en stock et est maintenant disponible.' 
              : 'Le matériel a été remis en stock et est maintenant disponible.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className={`border-l-4 rounded-lg p-4 ${isLost ? 'border-l-red-500 bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20 border-l-blue-500'}`}>
            <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2 uppercase">
              {isLost ? 'RÉCUPÉRATION DE MATÉRIEL PERDU' : 'CONFIRMATION DE RETOUR'}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              {isLost 
                ? 'Vous êtes sur le point de remettre en stock un matériel qui était marqué comme perdu.' 
                : 'Vous êtes sur le point de retourner directement ce matériel sans passer par un processus de retour complet.'}
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-bold text-gray-900 dark:text-white mb-2 uppercase">
                DÉTAILS DU MATÉRIEL
              </h4>
              <div className="space-y-2">
                <p className="font-medium text-gray-800 dark:text-gray-200">
                  {checkout.equipment.name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                  N° Série: {checkout.equipment.serialNumber}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Emprunté par: {checkout.users.first_name} {checkout.users.last_name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Date d'emprunt: {new Date(checkout.checkout_date).toLocaleDateString('fr-FR')}
                </p>
                <p className={`text-sm ${isOverdue ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-600 dark:text-gray-400'}`}>
                  {isOverdue && <AlertTriangle size={14} className="inline mr-1" />}
                  Date de retour prévue: {new Date(checkout.due_date).toLocaleDateString('fr-FR')}
                  {isOverdue && ' (EN RETARD)'}
                </p>
                {isLost && (
                  <p className="text-sm text-red-600 dark:text-red-400 font-bold">
                    <AlertTriangle size={14} className="inline mr-1" />
                    Statut actuel: PERDU
                  </p>
                )}
              </div>
            </div>

            {!isLost && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes de retour (optionnel)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  placeholder="Ajoutez des notes concernant l'état du matériel retourné..."
                />
              </div>
            )}
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
              onClick={handleReturnEquipment}
              disabled={isLoading}
              icon={isLost ? <ArrowLeft size={16} /> : undefined}
            >
              {isLoading ? 'TRAITEMENT...' : isLost ? 'REMETTRE EN STOCK' : 'CONFIRMER LE RETOUR'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default DirectReturnModal;