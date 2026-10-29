/*
  # Désactivation de toutes les RLS (Row Level Security)

  1. Désactivation RLS
    - Désactive RLS sur toutes les tables existantes
    - Supprime toutes les politiques RLS existantes
    - Permet l'accès libre à toutes les données

  2. Tables concernées
    - departments
    - equipment
    - categories
    - suppliers
    - users
    - checkouts
    - equipment_instances
    - delivery_notes
    - status_configs
    - role_configs
    - system_settings
    - equipment_groups
    - equipment_subgroups
    - maintenance_types
    - equipment_maintenance

  3. Sécurité
    - ATTENTION: Cette migration supprime toute sécurité au niveau des lignes
    - Toutes les données seront accessibles sans restriction
    - À utiliser uniquement en développement ou avec d'autres mesures de sécurité
*/

-- Désactiver RLS sur toutes les tables principales
ALTER TABLE IF EXISTS departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS equipment DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS checkouts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS equipment_instances DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS delivery_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS status_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS role_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS equipment_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS equipment_subgroups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS maintenance_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS equipment_maintenance DISABLE ROW LEVEL SECURITY;

-- Supprimer toutes les politiques RLS existantes pour departments
DROP POLICY IF EXISTS "departments_authenticated_policy" ON departments;
DROP POLICY IF EXISTS "Allow authenticated delete access on departments" ON departments;
DROP POLICY IF EXISTS "Allow authenticated insert access on departments" ON departments;
DROP POLICY IF EXISTS "Allow authenticated read access on departments" ON departments;
DROP POLICY IF EXISTS "Allow authenticated update access on departments" ON departments;
DROP POLICY IF EXISTS "departments_delete_policy" ON departments;
DROP POLICY IF EXISTS "departments_insert_policy" ON departments;
DROP POLICY IF EXISTS "departments_select_policy" ON departments;
DROP POLICY IF EXISTS "departments_update_policy" ON departments;

-- Supprimer toutes les politiques RLS existantes pour equipment
DROP POLICY IF EXISTS "equipment_authenticated_policy" ON equipment;
DROP POLICY IF EXISTS "Allow authenticated read access" ON equipment;

-- Supprimer toutes les politiques RLS existantes pour categories
DROP POLICY IF EXISTS "categories_authenticated_policy" ON categories;
DROP POLICY IF EXISTS "Allow authenticated read access" ON categories;

-- Supprimer toutes les politiques RLS existantes pour suppliers
DROP POLICY IF EXISTS "suppliers_authenticated_policy" ON suppliers;
DROP POLICY IF EXISTS "Allow authenticated read access" ON suppliers;

-- Supprimer toutes les politiques RLS existantes pour users
DROP POLICY IF EXISTS "Allow authenticated read access" ON users;
DROP POLICY IF EXISTS "Users can create new users" ON users;
DROP POLICY IF EXISTS "Users can delete their own data" ON users;
DROP POLICY IF EXISTS "Users can read all users" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;

-- Supprimer toutes les politiques RLS existantes pour checkouts
DROP POLICY IF EXISTS "checkouts_authenticated_policy" ON checkouts;
DROP POLICY IF EXISTS "Allow authenticated read access" ON checkouts;

-- Supprimer toutes les politiques RLS existantes pour equipment_instances
DROP POLICY IF EXISTS "equipment_instances_authenticated_policy" ON equipment_instances;
DROP POLICY IF EXISTS "Allow authenticated delete access on equipment_instances" ON equipment_instances;
DROP POLICY IF EXISTS "Allow authenticated insert access on equipment_instances" ON equipment_instances;
DROP POLICY IF EXISTS "Allow authenticated read access on equipment_instances" ON equipment_instances;
DROP POLICY IF EXISTS "Allow authenticated update access on equipment_instances" ON equipment_instances;

-- Supprimer toutes les politiques RLS existantes pour delivery_notes
DROP POLICY IF EXISTS "delivery_notes_authenticated_policy" ON delivery_notes;
DROP POLICY IF EXISTS "Allow authenticated delete access on delivery_notes" ON delivery_notes;
DROP POLICY IF EXISTS "Allow authenticated insert access on delivery_notes" ON delivery_notes;
DROP POLICY IF EXISTS "Allow authenticated read access on delivery_notes" ON delivery_notes;
DROP POLICY IF EXISTS "Allow authenticated update access on delivery_notes" ON delivery_notes;

-- Supprimer toutes les politiques RLS existantes pour status_configs
DROP POLICY IF EXISTS "status_configs_authenticated_policy" ON status_configs;
DROP POLICY IF EXISTS "Allow anonymous read access on status_configs" ON status_configs;
DROP POLICY IF EXISTS "Allow authenticated delete access on status_configs" ON status_configs;
DROP POLICY IF EXISTS "Allow authenticated insert access on status_configs" ON status_configs;
DROP POLICY IF EXISTS "Allow authenticated read access on status_configs" ON status_configs;
DROP POLICY IF EXISTS "Allow authenticated update access on status_configs" ON status_configs;

-- Supprimer toutes les politiques RLS existantes pour role_configs
DROP POLICY IF EXISTS "role_configs_authenticated_policy" ON role_configs;
DROP POLICY IF EXISTS "Allow authenticated read access" ON role_configs;

-- Supprimer toutes les politiques RLS existantes pour system_settings
DROP POLICY IF EXISTS "system_settings_authenticated_policy" ON system_settings;
DROP POLICY IF EXISTS "Allow authenticated insert access on system_settings" ON system_settings;
DROP POLICY IF EXISTS "Allow authenticated read access on system_settings" ON system_settings;
DROP POLICY IF EXISTS "Allow authenticated update access on system_settings" ON system_settings;

-- Supprimer toutes les politiques RLS existantes pour equipment_groups
DROP POLICY IF EXISTS "Allow authenticated delete access on equipment_groups" ON equipment_groups;
DROP POLICY IF EXISTS "Allow authenticated insert access on equipment_groups" ON equipment_groups;
DROP POLICY IF EXISTS "Allow authenticated read access on equipment_groups" ON equipment_groups;
DROP POLICY IF EXISTS "Allow authenticated update access on equipment_groups" ON equipment_groups;

-- Supprimer toutes les politiques RLS existantes pour equipment_subgroups
DROP POLICY IF EXISTS "Allow authenticated delete access on equipment_subgroups" ON equipment_subgroups;
DROP POLICY IF EXISTS "Allow authenticated insert access on equipment_subgroups" ON equipment_subgroups;
DROP POLICY IF EXISTS "Allow authenticated read access on equipment_subgroups" ON equipment_subgroups;
DROP POLICY IF EXISTS "Allow authenticated update access on equipment_subgroups" ON equipment_subgroups;

-- Supprimer toutes les politiques RLS existantes pour maintenance_types
DROP POLICY IF EXISTS "Allow authenticated delete access on maintenance_types" ON maintenance_types;
DROP POLICY IF EXISTS "Allow authenticated insert access on maintenance_types" ON maintenance_types;
DROP POLICY IF EXISTS "Allow authenticated read access on maintenance_types" ON maintenance_types;
DROP POLICY IF EXISTS "Allow authenticated update access on maintenance_types" ON maintenance_types;

-- Supprimer toutes les politiques RLS existantes pour equipment_maintenance
DROP POLICY IF EXISTS "Allow authenticated delete access on equipment_maintenance" ON equipment_maintenance;
DROP POLICY IF EXISTS "Allow authenticated insert access on equipment_maintenance" ON equipment_maintenance;
DROP POLICY IF EXISTS "Allow authenticated read access on equipment_maintenance" ON equipment_maintenance;
DROP POLICY IF EXISTS "Allow authenticated update access on equipment_maintenance" ON equipment_maintenance;

-- Vérification finale - afficher le statut RLS de toutes les tables
DO $$
DECLARE
    table_record RECORD;
BEGIN
    RAISE NOTICE 'État RLS après désactivation:';
    FOR table_record IN 
        SELECT schemaname, tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename
    LOOP
        RAISE NOTICE 'Table %.%: RLS = %', 
            table_record.schemaname, 
            table_record.tablename, 
            CASE WHEN table_record.rowsecurity THEN 'ACTIVÉ' ELSE 'DÉSACTIVÉ' END;
    END LOOP;
END $$;