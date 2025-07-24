import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Equipment, Category, Supplier, EquipmentGroup, EquipmentSubgroup, EquipmentInstance, StatusConfig } from '../types';
import toast from 'react-hot-toast';

// Define notification type
interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: Date;
}

// Define checkout type
interface Checkout {
  id: string;
  equipment_id: string;
  user_id: string;
  checkout_date: string;
  due_date: string;
  return_date?: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface AppContextType {
  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  
  // Equipment data
  equipment: Equipment[];
  categories: Category[];
  suppliers: Supplier[];
  equipmentGroups: EquipmentGroup[];
  equipmentSubgroups: EquipmentSubgroup[];
  equipmentInstances: EquipmentInstance[];
  statusConfigs: StatusConfig[];
  checkouts: Checkout[];
  
  // Loading states
  loadingAppData: boolean;
  
  // Equipment operations
  addEquipment: (equipment: Omit<Equipment, 'id' | 'createdAt'>) => Promise<void>;
  updateEquipment: (id: string, equipment: Partial<Equipment>) => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  refreshEquipmentData: () => Promise<Equipment[]>;
  forceUpdateEquipmentAvailability: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

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
  const [statusConfigs, setStatusConfigs] = useState<StatusConfig[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
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
    try {
      setLoadingAppData(true);
      
      // Fetch all data in parallel
      const [
        equipmentResult,
        categoriesResult,
        suppliersResult,
        groupsResult,
        subgroupsResult,
        instancesResult,
        statusConfigsResult,
        checkoutsResult
      ] = await Promise.all([
        supabase.from('equipment').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('name'),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('equipment_groups').select('*').order('name'),
        supabase.from('equipment_subgroups').select('*').order('name'),
        supabase.from('equipment_instances').select('*').order('instance_number'),
        supabase.from('status_configs').select('*').order('name'),
        supabase.from('checkouts').select('*').order('created_at', { ascending: false })
      ]);

      if (equipmentResult.error) throw equipmentResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (suppliersResult.error) throw suppliersResult.error;
      if (groupsResult.error) throw groupsResult.error;
      if (subgroupsResult.error) throw subgroupsResult.error;
      if (instancesResult.error) throw instancesResult.error;
      if (statusConfigsResult.error) throw statusConfigsResult.error;
      if (checkoutsResult.error) throw checkoutsResult.error;

      // Transformer les données du snake_case vers le camelCase
      const transformedEquipment = equipmentResult.data?.map(item => ({
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

      // Afficher les URLs d'image pour débogage
      console.log("URLs des images dans les équipements transformés:");
      transformedEquipment.forEach(eq => {
        console.log(`${eq.name}: ${eq.imageUrl}`);
      });

      setEquipment(transformedEquipment);
      setCategories(categoriesResult.data || []);
      setSuppliers(suppliersResult.data || []);
      setEquipmentGroups(groupsResult.data || []);
      setEquipmentSubgroups(subgroupsResult.data || []);
      setEquipmentInstances(instancesResult.data || []);
      setStatusConfigs(statusConfigsResult.data || []);
      setCheckouts(checkoutsResult.data || []);
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
    console.log('=== REFRESH DATA APPELÉ ===');
    await fetchAppData();
    console.log('=== REFRESH DATA TERMINÉ ===');
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
      
      console.log('Données transformées pour mise à jour:', transformedData);

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
      console.log('Données d\'équipement rafraîchies:', transformedEquipment);
      
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
      console.log('Forçage de la mise à jour des statuts d\'emprunt en retard...');
      
      // Appeler la fonction RPC pour forcer la mise à jour des statuts d'emprunt en retard
      const { data, error } = await supabase.rpc('force_update_overdue_checkouts');
      
      if (error) throw error;
      
      console.log('Résultat de la mise à jour:', data);
      
      // Rafraîchir les données
      await refreshData();
      
      toast.success('Statuts des emprunts mis à jour avec succès');
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour des statuts d\'emprunt:', error);
      toast.error(`Erreur: ${error.message}`);
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
        
        // Loading states
        loadingAppData,
        
        // Equipment operations
        addEquipment,
        updateEquipment,
        deleteEquipment,
        refreshData,
        refreshEquipmentData,
        forceUpdateEquipmentAvailability,
        forceUpdateOverdueCheckouts
      }}
    >
      {children}
    </AppContext.Provider>
  );
};