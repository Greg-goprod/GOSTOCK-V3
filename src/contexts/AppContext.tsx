import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  AppContextType, 
  Category, 
  DeliveryNote, 
  Equipment, 
  EquipmentGroup, 
  EquipmentInstance, 
  EquipmentSubgroup, 
  Supplier, 
  CheckoutWithCalculatedStatus,
  EquipmentWithCalculatedStatus
} from '../types';
import toast from 'react-hot-toast';

// Define notification type
interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: Date;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Ajout de l'export pour useAppContext
export const useAppContext = useApp;

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [equipmentGroups, setEquipmentGroups] = useState<EquipmentGroup[]>([]);
  const [equipmentSubgroups, setEquipmentSubgroups] = useState<EquipmentSubgroup[]>([]);
  const [equipmentInstances, setEquipmentInstances] = useState<EquipmentInstance[]>([]);
  const [statusConfigs, setStatusConfigs] = useState<any[]>([]); // Assuming StatusConfig is now part of Equipment or handled differently
  const [checkouts, setCheckouts] = useState<import('../types').CheckoutRecord[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [loadingAppData, setLoadingAppData] = useState(true);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    setNotifications(prev => [...prev, newNotification]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const fetchAppData = async () => {
    setLoadingAppData(true);
    try {
      
      // Vérifier que supabase est initialisé
      if (!supabase) {
        console.error('Supabase client not initialized');
        throw new Error('Supabase client not initialized');
      }
      
      // Charger toutes les données nécessaires en parallèle
      const [
        equipmentResult,
        categoriesResult,
        suppliersResult,
        groupsResult,
        subgroupsResult,
        instancesResult,
        statusConfigsResult,
        checkoutsResult,
        usersResult,
        deliveryNotesResult
      ] = await Promise.all([
        supabase.from('equipment').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('name'),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('equipment_groups').select('*').order('name'),
        supabase.from('equipment_subgroups').select('*').order('name'),
        supabase.from('equipment_instances').select('*').order('instance_number'),
        supabase.from('status_configs').select('*').order('name'),
        supabase.from('checkouts').select('*').order('created_at', { ascending: false }),
        supabase.from('users').select('*').order('last_name'),
        supabase.from('delivery_notes').select('*').order('created_at', { ascending: false })
      ]);

      if (equipmentResult.error) throw equipmentResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (suppliersResult.error) throw suppliersResult.error;
      if (groupsResult.error) throw groupsResult.error;
      if (subgroupsResult.error) throw subgroupsResult.error;
      if (instancesResult.error) throw instancesResult.error;
      if (statusConfigsResult.error) throw statusConfigsResult.error;
      if (checkoutsResult.error) throw checkoutsResult.error;
      if (usersResult.error) throw usersResult.error;
      if (deliveryNotesResult.error) throw deliveryNotesResult.error;

      // Transformer les données du snake_case vers le camelCase
      const transformedEquipment = equipmentResult.data?.map((item: Record<string, any>) => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        category: item.category_id,
        serialNumber: item.serial_number,
        status: item.status,
        addedDate: item.created_at,
        lastMaintenance: item.last_maintenance,
        imageUrl: item.image_url,
        supplier: item.supplier_id,
        location: item.location,
        articleNumber: item.article_number,
        qrType: item.qr_type,
        totalQuantity: item.total_quantity,
        availableQuantity: item.available_quantity,
        shortTitle: item.short_title,
        group: item.group_id,
        subgroup: item.subgroup_id
      })) || [];

      // Transformer les bons de livraison
      const transformedDeliveryNotes = deliveryNotesResult.data?.map((item: Record<string, any>) => {
        return {
          id: item.id,
          number: item.note_number, // Utiliser note_number comme propriété 'number'
          noteNumber: item.note_number,
          userId: item.user_id,
          issueDate: item.issue_date,
          dueDate: item.due_date,
          status: item.status,
          notes: item.notes,
          createdAt: item.created_at,
          updatedAt: item.updated_at
        };
      }) || [];

      // Si aucun bon de livraison n'est trouvé, essayer de les charger directement
      if (transformedDeliveryNotes.length === 0) {
        
        const { data, error } = await supabase
          .from('delivery_notes')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error("Erreur lors du chargement direct des bons de livraison:", error);
        } else if (data && data.length > 0) {
          
          const directTransformedNotes = data.map((item: Record<string, any>) => ({
            id: item.id,
            number: item.note_number,
            noteNumber: item.note_number,
            userId: item.user_id,
            issueDate: item.issue_date,
            dueDate: item.due_date,
            status: item.status,
            notes: item.notes,
            createdAt: item.created_at,
            updatedAt: item.updated_at
          }));
          
          setDeliveryNotes(directTransformedNotes);
        }
      } else {
        setDeliveryNotes(transformedDeliveryNotes);
      }
      
      // Charger les utilisateurs
      setEquipment(transformedEquipment);
      // Mapping strict pour Category
      setCategories(categoriesResult.data?.map((item: Record<string, any>) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        color: item.color
      })) || []);
      // Mapping strict pour Supplier
      setSuppliers(suppliersResult.data?.map((item: Record<string, any>) => ({
        id: item.id,
        name: item.name,
        contactPerson: item.contact_person,
        email: item.email,
        phone: item.phone,
        website: item.website
      })) || []);
      // Mapping strict pour EquipmentGroup
      setEquipmentGroups(groupsResult.data?.map((item: Record<string, any>) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        color: item.color,
        createdAt: item.created_at
      })) || []);
      // Mapping strict pour EquipmentSubgroup
      setEquipmentSubgroups(subgroupsResult.data?.map((item: Record<string, any>) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        color: item.color,
        groupId: item.group_id,
        createdAt: item.created_at
      })) || []);
      // Mapping strict pour EquipmentInstance
      setEquipmentInstances(instancesResult.data?.map((item: Record<string, any>) => ({
        id: item.id,
        equipmentId: item.equipment_id,
        instanceNumber: item.instance_number,
        qrCode: item.qr_code,
        status: item.status,
        createdAt: item.created_at
      })) || []);
      // Mapping strict pour StatusConfig
      setStatusConfigs(statusConfigsResult.data?.map((item: Record<string, any>) => ({
        id: item.id,
        name: item.name,
        color: item.color,
        created_at: item.created_at
      })) || []);
      // Correction : transformer les données pour correspondre à CheckoutRecord
      setCheckouts((checkoutsResult.data || []).map((c: Record<string, any>) => ({
        id: c.id,
        equipmentId: c.equipment_id,
        userId: c.user_id,
        deliveryNoteId: c.delivery_note_id,
        checkoutDate: c.checkout_date,
        dueDate: c.due_date,
        returnDate: c.return_date,
        status: c.status,
        notes: c.notes,
        instanceId: c.instance_id
      })));
      
    } catch (error) {
      console.error('Error fetching app data:', error);
      addNotification({
        type: 'error',
        message: 'Erreur lors du chargement des données'
      });
    } finally {
      setLoadingAppData(false);
    }
  };

  const refreshData = async () => {
    await fetchAppData();
  };

  const addEquipment = async (equipmentData: Omit<Equipment, 'id' | 'createdAt'>) => {
    try {
      // Transformer les données de camelCase vers snake_case pour la base de données
      const transformedData = {
        name: equipmentData.name,
        description: equipmentData.description,
        category_id: equipmentData.category,
        serial_number: equipmentData.serialNumber,
        status: equipmentData.status,
        supplier_id: equipmentData.supplier,
        location: equipmentData.location,
        image_url: equipmentData.imageUrl,
        article_number: equipmentData.articleNumber,
        qr_type: equipmentData.qrType,
        total_quantity: equipmentData.totalQuantity,
        available_quantity: equipmentData.availableQuantity,
        short_title: equipmentData.shortTitle,
        group_id: equipmentData.group,
        subgroup_id: equipmentData.subgroup
      };

      const { data, error } = await supabase
        .from('equipment')
        .insert([transformedData])
        .select()
        .single();

      if (error) throw error;

      // Transformer les données reçues de snake_case vers camelCase
      const newEquipment: Equipment = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        category: data.category_id,
        serialNumber: data.serial_number,
        status: data.status,
        addedDate: data.created_at,
        lastMaintenance: data.last_maintenance,
        imageUrl: data.image_url,
        supplier: data.supplier_id,
        location: data.location,
        articleNumber: data.article_number,
        qrType: data.qr_type,
        totalQuantity: data.total_quantity,
        availableQuantity: data.available_quantity,
        shortTitle: data.short_title,
        group: data.group_id,
        subgroup: data.subgroup_id
      };

      setEquipment(prev => [newEquipment, ...prev]);
      addNotification({
        type: 'success',
        message: 'Équipement ajouté avec succès'
      });
    } catch (error) {
      console.error('Error adding equipment:', error);
      addNotification({
        type: 'error',
        message: 'Erreur lors de l\'ajout de l\'équipement'
      });
      throw error;
    }
  };

  const updateEquipment = async (id: string, equipmentData: Partial<Equipment>) => {
    try {
      // Transformer les données de camelCase vers snake_case
      const transformedData: Record<string, any> = {};
      
      if (equipmentData.name !== undefined) transformedData.name = equipmentData.name;
      if (equipmentData.description !== undefined) transformedData.description = equipmentData.description;
      if (equipmentData.category !== undefined) transformedData.category_id = equipmentData.category;
      if (equipmentData.serialNumber !== undefined) transformedData.serial_number = equipmentData.serialNumber;
      if (equipmentData.status !== undefined) transformedData.status = equipmentData.status;
      if (equipmentData.supplier !== undefined) transformedData.supplier_id = equipmentData.supplier;
      if (equipmentData.location !== undefined) transformedData.location = equipmentData.location;
      if (equipmentData.imageUrl !== undefined) transformedData.image_url = equipmentData.imageUrl;
      if (equipmentData.articleNumber !== undefined) transformedData.article_number = equipmentData.articleNumber;
      if (equipmentData.qrType !== undefined) transformedData.qr_type = equipmentData.qrType;
      if (equipmentData.totalQuantity !== undefined) transformedData.total_quantity = equipmentData.totalQuantity;
      if (equipmentData.availableQuantity !== undefined) transformedData.available_quantity = equipmentData.availableQuantity;
      if (equipmentData.shortTitle !== undefined) transformedData.short_title = equipmentData.shortTitle;
      if (equipmentData.group !== undefined) transformedData.group_id = equipmentData.group;
      if (equipmentData.subgroup !== undefined) transformedData.subgroup_id = equipmentData.subgroup;
      
      const { data, error } = await supabase
        .from('equipment')
        .update(transformedData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Transformer le résultat de snake_case vers camelCase
      const updatedEquipment: Equipment = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        category: data.category_id,
        serialNumber: data.serial_number,
        status: data.status,
        addedDate: data.created_at,
        lastMaintenance: data.last_maintenance,
        imageUrl: data.image_url,
        supplier: data.supplier_id,
        location: data.location,
        articleNumber: data.article_number,
        qrType: data.qr_type,
        totalQuantity: data.total_quantity,
        availableQuantity: data.available_quantity,
        shortTitle: data.short_title,
        group: data.group_id,
        subgroup: data.subgroup_id
      };

      setEquipment(prev => prev.map(eq => eq.id === id ? updatedEquipment : eq));
      addNotification({
        type: 'success',
        message: 'Équipement mis à jour avec succès'
      });
    } catch (error) {
      console.error('Error updating equipment:', error);
      addNotification({
        type: 'error',
        message: 'Erreur lors de la mise à jour de l\'équipement'
      });
      throw error;
    }
  };

  const deleteEquipment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEquipment(prev => prev.filter(eq => eq.id !== id));
      addNotification({
        type: 'success',
        message: 'Équipement supprimé avec succès'
      });
    } catch (error) {
      console.error('Error deleting equipment:', error);
      addNotification({
        type: 'error',
        message: 'Erreur lors de la suppression de l\'équipement'
      });
      throw error;
    }
  };

  // Ajoutez cette fonction au contexte pour permettre un rafraîchissement explicite des données
  const refreshEquipmentData = async () => {
    try {
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('equipment')
        .select('*')
        .order('name');

      if (equipmentError) throw equipmentError;
      
      // Transformer les données de snake_case en camelCase
      const transformedEquipment = equipmentData.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        category: item.category,
        serialNumber: item.serial_number,
        status: item.status,
        addedDate: item.added_date,
        lastMaintenance: item.last_maintenance,
        imageUrl: item.image_url,
        supplier: item.supplier,
        location: item.location,
        articleNumber: item.article_number,
        qrType: item.qr_type,
        totalQuantity: item.total_quantity || 1,
        availableQuantity: item.available_quantity || 0,
        shortTitle: item.short_title,
        group: item.group,
        subgroup: item.subgroup
      }));

      setEquipment(transformedEquipment);
      
      return transformedEquipment;
    } catch (error) {
      console.error('Erreur lors du rafraîchissement des données d\'équipement:', error);
      return [];
    }
  };

  // Fonction pour forcer la mise à jour des quantités disponibles
  const forceUpdateEquipmentAvailability = async () => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return;
    }
    
    try {
      // Pour chaque équipement
      for (const eq of equipment) {
        // Compter les emprunts actifs, en retard et perdus
        const { data: checkoutsData, error: checkoutsError } = await supabase
          .from('checkouts')
          .select('*')
          .eq('equipment_id', eq.id)
          .in('status', ['active', 'overdue', 'lost']);

        if (checkoutsError) throw checkoutsError;
        
        const activeCount = checkoutsData?.length || 0;
        const totalQuantity = eq.totalQuantity || 1;
        const availableQuantity = Math.max(totalQuantity - activeCount, 0);
        const newStatus = availableQuantity <= 0 ? 'checked-out' : 'available';
        
        // Mettre à jour la quantité disponible
        const { error: updateError } = await supabase
          .from('equipment')
          .update({
            available_quantity: availableQuantity,
            status: newStatus
          })
          .eq('id', eq.id);
          
        if (updateError) throw updateError;
      }
      
      // Rafraîchir les données
      await refreshEquipmentData();
      
      toast.success('Quantités disponibles mises à jour avec succès');
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour des quantités:', error);
      toast.error(`Erreur: ${error.message}`);
    }
  };

  // Fonction pour forcer la mise à jour des statuts d'emprunt en retard
  const forceUpdateOverdueCheckouts = async () => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return;
    }
    
    try {
      const { data, error } = await supabase.rpc('force_update_overdue_checkouts');
      
      if (error) throw error;
      
      // Rafraîchir les données
      await refreshData();
      
      toast.success('Statuts des emprunts mis à jour avec succès');
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour des statuts d\'emprunt:', error);
      toast.error(`Erreur: ${error.message}`);
    }
  };

  // Fonction pour charger les emprunts avec leurs statuts calculés
  const fetchCheckoutsWithStatus = async (): Promise<CheckoutWithCalculatedStatus[]> => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return [];
    }
    
    try {
      // Utiliser la vue checkout_status_view pour récupérer les statuts calculés
      const { data: checkoutsData, error: checkoutsError } = await supabase
        .from('checkout_status_view')
        .select('id, equipment_id, user_id, delivery_note_id, checkout_date, due_date, return_date, notes, calculated_status, equipment_name, total_quantity, available_quantity, first_name, last_name')
        .order('checkout_date', { ascending: false });
      
      if (checkoutsError) throw checkoutsError;
      
      if (!checkoutsData || checkoutsData.length === 0) {
        return [];
      }
      
      // Transformer les données pour qu'elles correspondent au format attendu
      const transformedData = checkoutsData.map(checkout => {
        return {
          ...checkout,
          status: checkout.calculated_status || 'unknown',
        };
      });
      
      return transformedData;
    } catch (error: any) {
      console.error('Erreur lors du chargement des emprunts avec statuts:', error);
      toast.error(`Erreur: ${error.message}`);
      return [];
    }
  };

  // Fonction pour charger les équipements avec leurs statuts calculés
  const fetchEquipmentWithStatus = async (): Promise<EquipmentWithCalculatedStatus[]> => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return [];
    }
    
    try {
      const { data, error } = await supabase.rpc('get_equipment_with_status');
      
      if (error) throw error;
      
      return data || [];
    } catch (error: any) {
      console.error('Erreur lors du chargement des équipements avec statuts:', error);
      toast.error(`Erreur: ${error.message}`);
      return [];
    }
  };

  // Fonction pour rafraîchir toutes les vues matérialisées
  const refreshAllStatusViews = async () => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return;
    }
    
    try {
      const { error } = await supabase.rpc('refresh_all_status_views');
      
      if (error) throw error;
      
      // Rafraîchir les données
      await refreshData();
      
      toast.success('Statuts mis à jour avec succès');
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour des statuts:', error);
      toast.error(`Erreur: ${error.message}`);
    }
  };

  // Fonction pour emprunter du matériel avec la nouvelle API
  const checkoutEquipmentWithAPI = async (
    equipmentId: string,
    userId: string,
    deliveryNoteId: string,
    dueDate: string,
    notes?: string
  ) => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return null;
    }
    
    try {
      const { data, error } = await supabase.rpc('checkout_equipment', {
        p_equipment_id: equipmentId,
        p_user_id: userId,
        p_delivery_note_id: deliveryNoteId,
        p_due_date: dueDate,
        p_notes: notes
      });
      
      if (error) throw error;
      
      // Rafraîchir les données
      await refreshData();
      
      return data;
    } catch (error: any) {
      console.error('Erreur lors de l\'emprunt:', error);
      toast.error(`Erreur: ${error.message}`);
      return null;
    }
  };

  // Fonction pour retourner du matériel avec la nouvelle API
  const returnEquipmentWithAPI = async (
    checkoutId: string,
    notes?: string
  ) => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return false;
    }
    
    try {
      const { data, error } = await supabase.rpc('return_equipment', {
        p_checkout_id: checkoutId,
        p_notes: notes
      });
      
      if (error) throw error;
      
      // Rafraîchir les données
      await refreshData();
      
      return data;
    } catch (error: any) {
      console.error('Erreur lors du retour:', error);
      toast.error(`Erreur: ${error.message}`);
      return false;
    }
  };

  // Fonction pour marquer un équipement comme perdu avec la nouvelle API
  const markEquipmentLostWithAPI = async (
    checkoutId: string,
    notes?: string
  ) => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return false;
    }
    
    try {
      const { data, error } = await supabase.rpc('mark_equipment_lost', {
        p_checkout_id: checkoutId,
        p_notes: notes
      });
      
      if (error) throw error;
      
      // Rafraîchir les données
      await refreshData();
      
      return data;
    } catch (error: any) {
      console.error('Erreur lors du marquage comme perdu:', error);
      toast.error(`Erreur: ${error.message}`);
      return false;
    }
  };

  useEffect(() => {
    fetchAppData();
  }, []);

  return (
    <AppContext.Provider
      value={{
        // Notifications
        notifications,
        addNotification,
        removeNotification,
        
        // Equipment data
        equipment,
        categories,
        suppliers,
        equipmentGroups,
        equipmentSubgroups,
        equipmentInstances,
        statusConfigs,
        checkouts,
        deliveryNotes,
        
        // Loading states
        loadingAppData,
        
        // Equipment operations
        addEquipment,
        updateEquipment,
        deleteEquipment,
        refreshData,
        refreshEquipmentData,
        forceUpdateEquipmentAvailability,
        forceUpdateOverdueCheckouts,
        // Nouvelles fonctions pour les vues matérialisées
        fetchCheckoutsWithStatus,
        fetchEquipmentWithStatus,
        refreshAllStatusViews,
        checkoutEquipmentWithAPI,
        returnEquipmentWithAPI,
        markEquipmentLostWithAPI
      }}
    >
      {children}
    </AppContext.Provider>
  );
};