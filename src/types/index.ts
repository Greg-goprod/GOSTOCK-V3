export interface Equipment {
  id: string;
  name: string;
  description: string;
  category: string;
  serialNumber: string;
  status: 'available' | 'checked-out' | 'maintenance' | 'retired';
  addedDate: string;
  lastMaintenance?: string;
  imageUrl?: string;
  supplier?: string;
  location?: string;
  articleNumber?: string;
  qrType?: 'individual' | 'batch';
  totalQuantity?: number;
  availableQuantity?: number;
  shortTitle?: string;
  group?: string;
  subgroup?: string;
}

export interface EquipmentInstance {
  id: string;
  equipmentId: string;
  instanceNumber: number;
  qrCode: string;
  status: 'available' | 'checked-out' | 'maintenance' | 'retired';
  createdAt: string;
}

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department: string;
  role: 'admin' | 'user';
  dateCreated: string;
}

export interface DeliveryNote {
  id: string;
  number?: string; // Ajout de la propriété number utilisée dans l'affichage
  noteNumber: string;
  userId: string;
  issueDate: string;
  dueDate: string;
  status: 'active' | 'returned' | 'partial' | 'overdue';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
  checkouts?: CheckoutRecord[];
}

export interface CheckoutRecord {
  id: string;
  equipmentId: string;
  userId: string;
  deliveryNoteId?: string;
  checkoutDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'active' | 'returned' | 'overdue' | 'lost';
  notes?: string;
  instanceId?: string; // Pour les équipements individuels
}

export interface Notification {
  id: string;
  type: 'overdue' | 'maintenance' | 'system';
  message: string;
  date: string;
  read: boolean;
  relatedId?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  website?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

export interface EquipmentGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
}

export interface EquipmentSubgroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  groupId: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
}

export interface StatusConfig {
  id: string;
  name: string;
  color: string;
}

export interface RoleConfig {
  id: string;
  name: string;
  color: string;
}

export interface SystemSetting {
  id: string;
  value: string;
  description?: string;
  updatedAt: string;
}

export interface MaintenanceType {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
}

export interface EquipmentMaintenance {
  id: string;
  equipmentId: string;
  maintenanceTypeId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  technicianName?: string;
  cost?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  maintenanceType?: MaintenanceType;
  equipment?: Equipment;
}

export interface AppContextType {
  equipment: Equipment[];
  categories: Category[];
  suppliers: Supplier[];
  equipmentGroups: EquipmentGroup[];
  equipmentSubgroups: EquipmentSubgroup[];
  equipmentInstances: EquipmentInstance[];
  checkouts: CheckoutRecord[];
  departments: Department[];
  users: User[];
  deliveryNotes: DeliveryNote[];
  maintenanceTypes: MaintenanceType[];
  maintenanceRecords: EquipmentMaintenance[];
  addEquipment: (equipmentData: Partial<Equipment>) => Promise<string | null>;
  updateEquipment: (id: string, equipmentData: Partial<Equipment>) => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  refreshEquipmentData: () => Promise<void>;
  forceUpdateEquipmentAvailability: () => Promise<void>;
  forceUpdateOverdueCheckouts: () => Promise<void>;
  // Nouvelles fonctions pour les vues matérialisées
  fetchCheckoutsWithStatus: () => Promise<CheckoutWithCalculatedStatus[]>;
  fetchEquipmentWithStatus: () => Promise<EquipmentWithCalculatedStatus[]>;
  refreshAllStatusViews: () => Promise<void>;
  checkoutEquipmentWithAPI: (
    equipmentId: string,
    userId: string,
    deliveryNoteId: string,
    dueDate: string,
    notes?: string
  ) => Promise<string | null>;
  returnEquipmentWithAPI: (
    checkoutId: string,
    notes?: string
  ) => Promise<boolean>;
  markEquipmentLostWithAPI: (
    checkoutId: string,
    notes?: string
  ) => Promise<boolean>;
}

// Types pour les vues matérialisées
export interface CheckoutWithCalculatedStatus {
  id: string;
  equipment_id: string;
  user_id: string;
  delivery_note_id?: string;
  checkout_date: string;
  due_date: string;
  return_date?: string;
  notes?: string;
  status: string; // calculated_status
  equipment_name: string;
  total_quantity: number;
  available_quantity: number;
  first_name: string;
  last_name: string;
  // Nouvelles propriétés pour les informations de bon de livraison
  delivery_note_number?: string;
  delivery_note_date?: string;
}

export interface EquipmentWithCalculatedStatus {
  id: string;
  name: string;
  description?: string;
  category_id?: string;
  supplier_id?: string;
  group_id?: string;
  subgroup_id?: string;
  serial_number: string;
  article_number?: string;
  purchase_date?: string;
  warranty_end?: string;
  location?: string;
  department_id?: string;
  total_quantity: number;
  qr_type?: string;
  image_url?: string;
  created_at: string;
  updated_at?: string;
  last_maintenance?: string;
  checked_out_count: number;
  maintenance_count: number;
  available_quantity: number;
  status: string; // calculated_status
}