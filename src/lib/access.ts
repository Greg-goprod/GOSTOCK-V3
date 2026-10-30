import type { Permission } from './roles';

// Droits requis par page (au moins un). Sans entrée : accessible à toute personne connectée.
// La base applique les mêmes règles (RLS) : ceci ne fait que masquer ce qui serait refusé.
export const ROUTE_ACCESS: Record<string, Permission[]> = {
  // L'accueil « Aujourd'hui » sert le magasin ; un collaborateur est renvoyé vers ses demandes
  '/': ['scan', 'approve', 'view_all', 'manage_stock'],
  '/scan': ['scan'],
  '/comptoir': ['scan'],
  '/etiquettes': ['manage_stock'],
  '/badges': ['manage_people'],
  '/entretien': ['manage_stock'],
  '/inventaire': ['scan', 'manage_stock'],
  '/commandes': ['manage_stock'],
  '/couts': ['view_all', 'manage_stock'],
  '/pilotage': ['approve', 'settings'],
  '/journal': ['approve', 'settings'],
  '/chantiers': ['view_all', 'scan', 'approve', 'manage_stock'],
  '/kits': ['scan', 'manage_stock'],
  '/formations': ['manage_people', 'view_all', 'scan'],
  '/locations': ['manage_stock', 'manage_fleet', 'view_all'],
  '/transferts': ['scan', 'manage_stock'],
  '/emplacements': ['manage_stock', 'scan'],
  '/atelier': ['scan', 'manage_stock', 'view_all'],
  '/comptabilite': ['settings', 'approve'],
  '/prevision': ['manage_stock', 'view_all'],
  '/donnees': ['settings', 'manage_stock', 'manage_people'],
  '/demarrage': ['settings'],
  '/ecran': ['scan', 'view_all', 'manage_stock'],
  '/epi': ['scan', 'manage_people', 'manage_stock', 'view_all'],
  '/planning': ['view_all', 'scan', 'approve', 'manage_stock', 'manage_fleet'],
  '/incidents': ['view_all', 'scan', 'approve', 'manage_stock'],
  '/checkouts': ['scan', 'view_all'],
  '/consommables': ['scan', 'manage_stock'],
  '/commande': ['manage_stock'],
  '/notifications': ['view_all', 'scan', 'approve', 'manage_stock'],
  '/tableau-de-bord': ['view_all'],
  '/users': ['manage_people'],
  '/settings': ['settings'],
};

export const canAccess = (path: string, can: (p: Permission) => boolean) => {
  const required = ROUTE_ACCESS[path];
  return !required || required.some(can);
};
