/*
  # Préparation de la base de données pour le déploiement
  
  1. Désactivation des RLS sur toutes les tables
  2. Mise à jour du statut de tout le matériel en "available"
  3. Suppression des anciens bons de sortie et transactions
  4. Mise à jour des quantités disponibles
*/

-- Désactiver RLS sur toutes les tables pour permettre un accès complet
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE checkouts DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_instances DISABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE status_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_subgroups DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_maintenance DISABLE ROW LEVEL SECURITY;

-- Désactiver temporairement les contraintes de clé étrangère pour faciliter la suppression
SET session_replication_role = 'replica';

-- Supprimer toutes les données des tables de transactions
TRUNCATE TABLE checkouts CASCADE;
TRUNCATE TABLE delivery_notes CASCADE;
TRUNCATE TABLE equipment_maintenance CASCADE;

-- Supprimer les instances d'équipement
TRUNCATE TABLE equipment_instances CASCADE;

-- Réinitialiser les équipements (tout mettre en stock)
UPDATE equipment SET 
  status = 'available',
  available_quantity = total_quantity,
  last_maintenance = NULL;

-- Réactiver les contraintes de clé étrangère
SET session_replication_role = 'origin';

-- Mettre à jour les statistiques des tables pour optimiser les performances
ANALYZE equipment;
ANALYZE users;
ANALYZE categories;
ANALYZE suppliers;
ANALYZE departments;
ANALYZE equipment_groups;
ANALYZE equipment_subgroups;
ANALYZE maintenance_types;

-- Créer des index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_equipment_name_search ON equipment USING gin(to_tsvector('french', name));
CREATE INDEX IF NOT EXISTS idx_users_full_name_search ON users USING gin(to_tsvector('french', (first_name || ' ' || last_name)));