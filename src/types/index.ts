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
  // Outil prêté (revient) ou consommable (décompté du stock d'un dépôt)
  itemType?: 'tool' | 'consumable';
  unit?: string;
  supplierReference?: string;
  purchasePrice?: number;
  dailyRate?: number;
  requiresApproval?: boolean;
  depotId?: string;
  requiredTrainingId?: string;
  requiresSignature?: boolean;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
  depreciationYears?: number | null;
  isBattery?: boolean;
  batteryLifeMonths?: number | null;
  batteryMaxUses?: number | null;
}

export interface Depot {
  id: string;
  name: string;
  address?: string;
  isDefault: boolean;
}

// Stock d'un consommable dans un dépôt
export interface ConsumableStock {
  id: string;
  equipmentId: string;
  depotId: string;
  quantity: number;
  minQuantity: number;
}

// Ligne de la feuille de commande (vue low_stock_items)
export interface LowStockItem {
  stock_id: string;
  equipment_id: string;
  name: string;
  article_number?: string;
  unit: string;
  supplier_reference?: string;
  purchase_price?: number;
  depot_id: string;
  depot_name: string;
  supplier_id?: string;
  supplier_name: string;
  supplier_email?: string;
  supplier_phone?: string;
  quantity: number;
  min_quantity: number;
  quantity_to_order: number;
}

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  depotId?: string;
  licenseCategory: string;
  seats?: number;
  currentKm: number;
  fuelLevel: number;          // en huitièmes (0 à 8)
  status: 'available' | 'in_use' | 'maintenance' | 'retired';
  nextServiceDate?: string;
  nextServiceKm?: number;
  tiresDate?: string;
  inspectionDate?: string;
  notes?: string;
}

export type RequestStatus = 'requested' | 'approved' | 'rejected' | 'ready' | 'out' | 'closed' | 'cancelled';

// Ligne de la vue requests_overview (snake_case, lue telle quelle)
export interface RequestOverview {
  id: string;
  number: string;
  requester_id: string;
  requester_name: string;
  destination?: string;
  depot_id: string;
  depot_name: string;
  start_at: string;
  end_at: string;
  status: RequestStatus;
  needs_approval: boolean;
  approval_reason?: string;
  notes?: string;
  decided_by?: string;
  decided_at?: string;
  decision_note?: string;
  delivery_note_id?: string;
  issued_at?: string;
  closed_at?: string;
  created_at: string;
  tool_lines: number;
  consumable_lines: number;
  vehicle_names?: string;
}

export interface RequestItemRow {
  id: string;
  item_kind: 'tool' | 'consumable' | 'vehicle';
  equipment_id?: string;
  vehicle_id?: string;
  quantity: number;
}

export interface StockNotification {
  id: string;
  kind: string;
  title: string;
  message: string;
  equipmentId?: string;
  depotId?: string;
  requestId?: string;
  // Avis personnel (sa demande est validée, prête…) ; vide pour les alertes du magasin
  recipientUserId?: string;
  createdAt: string;
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
  // admin = Administrateur, manager = Responsable, technician = Magasinier, user = Collaborateur
  role: 'admin' | 'manager' | 'technician' | 'user';
  permissions?: string[];
  active?: boolean;
  // Compte de connexion déjà lié (la personne s'est connectée au moins une fois)
  linked?: boolean;
  licenseCategories?: string[];
  licenseExpiresOn?: string | null;
  // Collaborateur, intérimaire ou sous-traitant ; accès coupé après accessUntil
  personKind?: 'employee' | 'temp' | 'subcontractor';
  company?: string | null;
  accessUntil?: string | null;
  leftOn?: string | null;
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
  kitId?: string; // Sorti avec un kit
  droppedAt?: string; // Déposé dans la boîte de retour, à contrôler
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
  // Délai de livraison habituel, en jours (seuils proposés)
  leadTimeDays?: number;
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
  statusConfigs: StatusConfig[];
  // Emprunts en retard ou à rendre sous 3 jours + alertes de stock non lues (pastille du menu)
  alertCount: number;
  loadingAppData: boolean;
  depots: Depot[];
  consumableStock: ConsumableStock[];
  stockNotifications: StockNotification[];
  vehicles: Vehicle[];
  markStockNotificationRead: (id: string) => Promise<void>;
  equipment: Equipment[];
  categories: Category[];
  suppliers: Supplier[];
  equipmentGroups: EquipmentGroup[];
  equipmentSubgroups: EquipmentSubgroup[];
  equipmentInstances: EquipmentInstance[];
  checkouts: CheckoutRecord[];
  users: User[];
  deliveryNotes: DeliveryNote[];
  addEquipment: (equipmentData: Omit<Equipment, 'id' | 'createdAt'>) => Promise<void>;
  updateEquipment: (id: string, equipmentData: Partial<Equipment>) => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  refreshEquipmentData: () => Promise<Equipment[]>;
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