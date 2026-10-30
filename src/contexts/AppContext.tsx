import React, { createContext, useContext, ReactNode, useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { 
  AppContextType, 
  Category, 
  DeliveryNote, 
  Equipment, 
  EquipmentGroup, 
  EquipmentInstance, 
  EquipmentSubgroup, 
  Supplier, 
  User,
  Depot,
  ConsumableStock,
  StockNotification,
  Vehicle,
  CheckoutWithCalculatedStatus,
  EquipmentWithCalculatedStatus
} from '../types';
import toast from 'react-hot-toast';

// Ligne de la table equipment (snake_case) → Equipment (camelCase)
const mapEquipmentRow = (item: Record<string, any>): Equipment => ({
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
  subgroup: item.subgroup_id,
  itemType: item.item_type,
  unit: item.unit,
  supplierReference: item.supplier_reference,
  requiresApproval: Boolean(item.requires_approval),
  dailyRate: item.daily_rate === null || item.daily_rate === undefined ? undefined : Number(item.daily_rate),
  purchasePrice: item.purchase_price === null || item.purchase_price === undefined ? undefined : Number(item.purchase_price),
  depotId: item.depot_id,
  requiredTrainingId: item.required_training_id ?? undefined,
  requiresSignature: Boolean(item.requires_signature),
  purchaseDate: item.purchase_date,
  warrantyUntil: item.warranty_until,
  depreciationYears: item.depreciation_years,
  isBattery: Boolean(item.is_battery),
  batteryLifeMonths: item.battery_life_months,
  batteryMaxUses: item.battery_max_uses,
  rentalId: item.rental_id ?? undefined,
  rentalUntil: item.rental_until ?? undefined
});

const mapUserRow = (u: Record<string, any>) => ({
  id: u.id,
  first_name: u.first_name,
  last_name: u.last_name,
  email: u.email,
  phone: u.phone,
  department: u.department,
  role: u.role,
  permissions: u.permissions || [],
  active: u.active !== false,
  linked: !!u.auth_user_id,
  licenseCategories: u.license_categories || [],
  licenseExpiresOn: u.license_expires_on,
  personKind: u.person_kind ?? 'employee',
  company: u.company,
  accessUntil: u.access_until,
  leftOn: u.left_on,
  depositAmount: u.deposit_amount,
  depositPaidOn: u.deposit_paid_on,
  depositReturnedOn: u.deposit_returned_on,
  dateCreated: u.created_at
});

// Un collaborateur ne lit que sa propre fiche ; les autres personnes viennent de l'annuaire
// (nom, service), assez pour afficher qui a quoi sans exposer e-mail, téléphone, caution ou permis
async function withDirectory(list: ReturnType<typeof mapUserRow>[]) {
  const { data } = await supabase.rpc('people_directory');
  const known = new Set(list.map(u => u.id));
  const others = ((data || []) as Record<string, any>[])
    .filter(u => !known.has(u.id))
    .map(u => mapUserRow({ ...u, role: 'user' }));
  return [...list, ...others];
}

// Nombre de jours avant l'échéance à partir duquel un retour est signalé
const DUE_SOON_DAYS = 3;

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
  const { profile } = useAuth();
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [equipmentGroups, setEquipmentGroups] = useState<EquipmentGroup[]>([]);
  const [equipmentSubgroups, setEquipmentSubgroups] = useState<EquipmentSubgroup[]>([]);
  const [equipmentInstances, setEquipmentInstances] = useState<EquipmentInstance[]>([]);
  const [statusConfigs, setStatusConfigs] = useState<any[]>([]); // Assuming StatusConfig is now part of Equipment or handled differently
  const [checkouts, setCheckouts] = useState<import('../types').CheckoutRecord[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [consumableStock, setConsumableStock] = useState<ConsumableStock[]>([]);
  const [stockNotifications, setStockNotifications] = useState<StockNotification[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingAppData, setLoadingAppData] = useState(true);

  const fetchAppData = async () => {
    setLoadingAppData(true);
    try {
      
      // Vérifier que supabase est initialisé
      if (!supabase) {
        console.error('Supabase client not initialized');
        throw new Error('Supabase client not initialized');
      }
      
      // Alertes d'échéance (flotte, entretien, retours, rapport du mois) : une seule par échéance,
      // sans effet si déjà créées
      await Promise.all([
        supabase.rpc('check_vehicle_deadlines'),
        supabase.rpc('check_maintenance_due'),
        supabase.rpc('check_due_reminders'),
        supabase.rpc('check_monthly_report'),
        supabase.rpc('check_training_rental_deadlines'),
        supabase.rpc('check_people_deadlines'),
        supabase.rpc('check_equipment_deadlines'),
        supabase.rpc('check_backup_reminder'),
      ]);

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
        deliveryNotesResult,
        depotsResult,
        consumableStockResult,
        notificationsResult,
        vehiclesResult
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
        supabase.from('delivery_notes').select('*').order('created_at', { ascending: false }),
        supabase.from('depots').select('*').order('name'),
        supabase.from('consumable_stock').select('*'),
        supabase.from('notifications').select('*').is('read_at', null).order('created_at', { ascending: false }),
        supabase.from('vehicles').select('*').order('name')
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
      if (depotsResult.error) throw depotsResult.error;
      if (consumableStockResult.error) throw consumableStockResult.error;
      if (notificationsResult.error) throw notificationsResult.error;
      if (vehiclesResult.error) throw vehiclesResult.error;

      setVehicles((vehiclesResult.data || []).map((v: Record<string, any>) => ({
        id: v.id,
        name: v.name,
        plate: v.plate,
        depotId: v.depot_id,
        licenseCategory: v.license_category,
        seats: v.seats ?? undefined,
        currentKm: v.current_km,
        fuelLevel: v.fuel_level,
        status: v.status,
        nextServiceDate: v.next_service_date ?? undefined,
        nextServiceKm: v.next_service_km ?? undefined,
        tiresDate: v.tires_date ?? undefined,
        inspectionDate: v.inspection_date ?? undefined,
        notes: v.notes ?? undefined,
        rentalId: v.rental_id ?? undefined,
        rentalUntil: v.rental_until ?? undefined
      })));

      setDepots((depotsResult.data || []).map((d: Record<string, any>) => ({
        id: d.id,
        name: d.name,
        address: d.address,
        isDefault: d.is_default
      })));
      setConsumableStock((consumableStockResult.data || []).map((s: Record<string, any>) => ({
        id: s.id,
        equipmentId: s.equipment_id,
        depotId: s.depot_id,
        quantity: Number(s.quantity),
        minQuantity: Number(s.min_quantity)
      })));
      setStockNotifications((notificationsResult.data || []).map((n: Record<string, any>) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        message: n.message,
        equipmentId: n.equipment_id,
        depotId: n.depot_id,
        requestId: n.request_id,
        recipientUserId: n.recipient_user_id,
        createdAt: n.created_at
      }))
        // Les avis personnels des autres (le magasin peut les lire) n'encombrent pas ses alertes
        .filter(n => !n.recipientUserId || n.recipientUserId === profileRef.current?.id));

      // Transformer les données du snake_case vers le camelCase
      const transformedEquipment = equipmentResult.data?.map(mapEquipmentRow) || [];

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
      
      setUsers(await withDirectory((usersResult.data || []).map(mapUserRow)));
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
        website: item.website,
        leadTimeDays: item.lead_time_days
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
        instanceId: c.instance_id,
        kitId: c.kit_id ?? undefined,
        droppedAt: c.dropped_at ?? undefined
      })));
      
    } catch (error) {
      console.error('Error fetching app data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoadingAppData(false);
    }
  };

  const refreshData = async () => {
    await fetchAppData();
  };

  // Liste des personnes seule (après une création ou une modification) : sans recharger tout le reste
  const refreshUsers = async () => {
    const { data, error } = await supabase.from('users').select('*').order('last_name');
    if (!error) setUsers(await withDirectory((data || []).map(mapUserRow)));
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
      const newEquipment = mapEquipmentRow(data);

      setEquipment(prev => [newEquipment, ...prev]);
      toast.success('Équipement ajouté avec succès');
    } catch (error) {
      console.error('Error adding equipment:', error);
      toast.error('Erreur lors de l\'ajout de l\'équipement');
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
      const updatedEquipment = mapEquipmentRow(data);

      setEquipment(prev => prev.map(eq => eq.id === id ? updatedEquipment : eq));
      toast.success('Équipement mis à jour avec succès');
    } catch (error) {
      console.error('Error updating equipment:', error);
      toast.error('Erreur lors de la mise à jour de l\'équipement');
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
      toast.success('Équipement supprimé avec succès');
    } catch (error) {
      console.error('Error deleting equipment:', error);
      const isReferenced = (error as { code?: string })?.code === '23503';
      toast.error(isReferenced
        ? 'Ce matériel a un historique de sorties : passez-le en « Retiré du service » plutôt que de le supprimer'
        : 'Erreur lors de la suppression de l\'équipement');
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
      
      // Mêmes colonnes que fetchAppData (category_id, supplier_id, group_id…)
      const transformedEquipment = equipmentData.map(mapEquipmentRow);

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
      // La base recalcule le stock de chaque équipement à partir des emprunts et maintenances
      const { error } = await supabase.rpc('update_equipment_availability');
      if (error) throw error;
      
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
      const { error } = await supabase.rpc('force_update_overdue_checkouts');
      
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
      // Retour en bon état, consigné comme au comptoir (le comptoir permet de signaler un problème)
      const { data, error } = await supabase.rpc('return_with_check', {
        p_checkout_id: checkoutId,
        p_condition: 'ok',
        p_notes: notes || null,
        p_photos: []
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
      // Une perte ouvre un incident (décision du responsable : remplacé, retenue, retrouvé…)
      const equipmentId = checkouts.find(c => c.id === checkoutId)?.equipmentId;
      const { data, error } = await supabase.rpc('declare_incident', {
        p_kind: 'lost',
        p_equipment_id: equipmentId,
        p_checkout_id: checkoutId,
        p_description: notes || null
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

  // Pastille : emprunts en retard ou à rendre dans les prochains jours, et alertes de stock non lues
  const alertCount = useMemo(() => {
    const dueSoonLimit = Date.now() + DUE_SOON_DAYS * 24 * 60 * 60 * 1000;
    const loanAlerts = checkouts.filter(c => {
      if (c.status === 'overdue') return true;
      if (c.status !== 'active') return false;
      const due = c.dueDate ? new Date(c.dueDate).getTime() : NaN;
      return !Number.isNaN(due) && due <= dueSoonLimit;
    }).length;
    return loanAlerts + stockNotifications.length;
  }, [checkouts, stockNotifications]);

  const markStockNotificationRead = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast.error('Impossible de marquer l\'alerte comme lue');
      return;
    }
    setStockNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        // Alertes (retards, retours proches, stock bas)
        alertCount,
        depots,
        consumableStock,
        stockNotifications,
        markStockNotificationRead,
        vehicles,
        
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
        users,
        
        // Loading states
        loadingAppData,
        
        // Equipment operations
        addEquipment,
        updateEquipment,
        deleteEquipment,
        refreshData,
        refreshUsers,
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