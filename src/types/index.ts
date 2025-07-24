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
}