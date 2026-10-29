// Rôles et droits GO-Mat : mêmes valeurs que role_permissions() en base

export type Permission =
  | 'settings'
  | 'manage_people'
  | 'manage_stock'
  | 'manage_fleet'
  | 'scan'
  | 'approve'
  | 'view_all'
  | 'all_depots';

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'admin' | 'manager' | 'technician' | 'user';
  permissions: Permission[];
  depot_ids: string[];
}

export const ROLE_LABELS: Record<Profile['role'], string> = {
  admin: 'Administrateur',
  manager: 'Responsable',
  technician: 'Magasinier',
  user: 'Collaborateur',
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  scan: 'Scanner et sortir du matériel',
  approve: 'Valider les demandes',
  manage_stock: 'Gérer le stock et les articles',
  manage_fleet: 'Gérer les véhicules',
  view_all: 'Voir toutes les demandes et sorties',
  manage_people: 'Gérer les personnes',
  all_depots: 'Tous les dépôts',
  settings: 'Réglages (administrateur)',
};

// Mêmes valeurs que role_permissions() en base
export const ROLE_PERMISSIONS: Record<Profile['role'], Permission[]> = {
  admin: ['settings', 'manage_people', 'manage_stock', 'manage_fleet', 'scan', 'approve', 'view_all', 'all_depots'],
  manager: ['manage_people', 'manage_stock', 'manage_fleet', 'scan', 'approve', 'view_all', 'all_depots'],
  technician: ['manage_stock', 'scan', 'view_all'],
  user: [],
};
