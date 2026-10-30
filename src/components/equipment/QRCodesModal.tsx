import React from 'react';
import Modal from '../common/Modal';
import QRCodeGenerator from '../QRCode/QRCodeGenerator';
import { Equipment, EquipmentInstance } from '../../types';
import { supabase } from '../../lib/supabase';
import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface QRCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment;
}

const QRCodesModal: React.FC<QRCodesModalProps> = ({ 
  isOpen, 
  onClose, 
  equipment
}) => {
  const [instances, setInstances] = useState<EquipmentInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && equipment) {
      console.log('=== QRCodesModal - useEffect triggered ===');
      console.log('Equipment ID:', equipment.id);
      console.log('Equipment QR Type:', equipment.qrType);
      console.log('Equipment Total Quantity:', equipment.totalQuantity);
      fetchInstances();
    }
  }, [isOpen, equipment]);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      
      console.log('Récupération des instances pour l\'équipement:', equipment.id);
      
      if (!supabase) {
        console.error('Supabase client is not initialized');
        return;
      }
      
      const { data, error } = await supabase
        .from('equipment_instances')
        .select('*')
        .eq('equipment_id', equipment.id)
        .order('instance_number');
      
      if (error) {
        console.error('Erreur lors de la récupération des instances:', error);
        throw error;
      }
      
      console.log('Instances récupérées (données brutes):', data);
      console.log('Nombre d\'instances récupérées:', data?.length || 0);
      
      // Si aucune instance n'est trouvée, nous allons les créer
      if (!data || data.length === 0) {
        console.log('Aucune instance trouvée, vérification si nous devons en créer...');
        
        // Vérifier si c'est un équipement de type individual avec une quantité > 1
        if (equipment.qrType === 'individual' && (equipment.totalQuantity || 0) > 0) {
          console.log('Création automatique des instances pour l\'équipement existant');
          await createInstancesForExistingEquipment();
          return; // fetchInstances sera rappelé après la création
        }
      }
      
      // Transform data to match our interface
      const transformedInstances: EquipmentInstance[] = data?.map(inst => ({
        id: inst.id,
        equipmentId: inst.equipment_id,
        instanceNumber: inst.instance_number,
        qrCode: inst.qr_code,
        status: inst.status as EquipmentInstance['status'],
        createdAt: inst.created_at
      })) || [];
      
      console.log('Instances transformées:', transformedInstances);
      
      setInstances(transformedInstances);
    } catch (error) {
      console.error('Error fetching equipment instances:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Fonction pour créer les instances pour un équipement existant
  const createInstancesForExistingEquipment = async () => {
    try {
      console.log('Création des instances pour l\'équipement existant:', equipment.id);
      
      if (!supabase) {
        console.error('Supabase client is not initialized');
        return;
      }
      
      // Utiliser le numéro d'article s'il existe, sinon utiliser le numéro de série
      const baseCode = equipment.articleNumber || equipment.serialNumber;
      const totalQuantity = equipment.totalQuantity || 1;
      
      console.log('Code de base pour QR:', baseCode);
      console.log('Quantité totale à créer:', totalQuantity);
      
      const instances = [];
      for (let i = 1; i <= totalQuantity; i++) {
        instances.push({
          equipment_id: equipment.id,
          instance_number: i,
          qr_code: `${baseCode}-${String(i).padStart(3, '0')}`,
          status: 'available'
        });
      }
      
      console.log('Instances à créer:', instances);
      
      // Insérer les instances par lots pour éviter les limites de taille de payload
      const batchSize = 50;
      for (let i = 0; i < instances.length; i += batchSize) {
        const batch = instances.slice(i, i + batchSize);
        const { error: instancesError } = await supabase
          .from('equipment_instances')
          .insert(batch);

        if (instancesError) {
          console.error('Erreur lors de l\'insertion des instances:', instancesError);
          throw instancesError;
        }
      }
      
      console.log('Instances créées avec succès, rafraîchissement des données');
      
      // Récupérer les instances nouvellement créées
      fetchInstances();
      
    } catch (error) {
      console.error('Erreur lors de la création des instances:', error);
      setLoading(false);
    }
  };
  
  if (!equipment) return null;

  const getQRCodeValue = (instance?: EquipmentInstance) => {
    if (instance) {
      return instance.qrCode;
    }
    return equipment.id;
  };

  const getQRCodeTitle = (instance?: EquipmentInstance) => {
    if (instance) {
      return `${equipment.name} #${instance.instanceNumber}`;
    }
    return equipment.name;
  };

  const getQRCodeSubtitle = (instance?: EquipmentInstance) => {
    if (instance) {
      return `${equipment.articleNumber} - Instance ${instance.instanceNumber}`;
    }
    return equipment.articleNumber || equipment.serialNumber;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`QR codes · ${equipment.name}`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Info header */}
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
          <h3 className="text-lg font-black text-primary-800 dark:text-primary-200 mb-1 uppercase">
            {equipment.qrType === 'individual' ? 'QR codes individuels' : 'QR code unique'}
          </h3>
          {loading ? (
            <p className="text-primary-700 dark:text-primary-300 text-sm font-medium">
              Chargement des QR codes...
            </p>
          ) : (
            <p className="text-primary-700 dark:text-primary-300 text-sm font-medium">
              {equipment.qrType === 'individual' 
                ? `${instances.length} QR codes individuels pour impression d'étiquettes`
                : 'Un seul QR code pour tout le lot'}
            </p>
          )}
          <p className="text-primary-600 dark:text-primary-400 text-xs font-medium mt-1">
            Article: {equipment.articleNumber || equipment.serialNumber} • Quantité totale: {equipment.totalQuantity}
          </p>
          
          {loading && (
            <div className="flex items-center gap-2 mt-2">
              <RefreshCw size={14} className="animate-spin" />
              <span className="text-xs">Chargement des QR codes...</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : equipment.qrType === 'individual' && instances.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {instances.map(instance => (
              <div key={instance.id} className="flex justify-center">
                <QRCodeGenerator
                  value={getQRCodeValue(instance)}
                  title={getQRCodeTitle(instance)}
                  subtitle={getQRCodeSubtitle(instance)}
                  size={150}
                  printable={true}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex justify-center">
            <QRCodeGenerator
              value={getQRCodeValue()}
              title={getQRCodeTitle()}
              subtitle={getQRCodeSubtitle()}
              size={200}
              printable={true}
            />
          </div>
        )}
        
        {equipment.qrType === 'individual' && instances.length === 0 && !loading && (
          <div className="text-center py-6">
            <p className="text-gray-500 dark:text-gray-400">
              Aucune instance trouvée pour cet équipement. 
              Essaie de mettre à jour la quantité totale pour générer des instances.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default QRCodesModal;