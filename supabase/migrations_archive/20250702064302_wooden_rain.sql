/*
  # Désactivation temporaire de RLS pour résoudre les problèmes d'accès

  1. Changements
    - Désactive RLS sur toutes les tables principales
    - Conserve les politiques existantes pour une réactivation future
    - Ajoute des politiques publiques pour permettre l'accès anonyme
  
  2. Sécurité
    - ATTENTION: Cette migration désactive temporairement la sécurité RLS
    - À utiliser uniquement en développement ou pour le débogage
    - Réactiver RLS en production avec une migration ultérieure
*/

-- Désactiver RLS sur les tables principales
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

-- Ajouter des politiques pour l'accès anonyme (pour une utilisation future si RLS est réactivé)
DO $$
BEGIN
  -- Departments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'departments' AND policyname = 'departments_anon_policy'
  ) THEN
    CREATE POLICY "departments_anon_policy"
      ON departments
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Equipment
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'equipment' AND policyname = 'equipment_anon_policy'
  ) THEN
    CREATE POLICY "equipment_anon_policy"
      ON equipment
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Categories
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'categories' AND policyname = 'categories_anon_policy'
  ) THEN
    CREATE POLICY "categories_anon_policy"
      ON categories
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Suppliers
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suppliers' AND policyname = 'suppliers_anon_policy'
  ) THEN
    CREATE POLICY "suppliers_anon_policy"
      ON suppliers
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Users
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND policyname = 'users_anon_policy'
  ) THEN
    CREATE POLICY "users_anon_policy"
      ON users
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Checkouts
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'checkouts' AND policyname = 'checkouts_anon_policy'
  ) THEN
    CREATE POLICY "checkouts_anon_policy"
      ON checkouts
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Equipment Instances
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'equipment_instances' AND policyname = 'equipment_instances_anon_policy'
  ) THEN
    CREATE POLICY "equipment_instances_anon_policy"
      ON equipment_instances
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Delivery Notes
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'delivery_notes' AND policyname = 'delivery_notes_anon_policy'
  ) THEN
    CREATE POLICY "delivery_notes_anon_policy"
      ON delivery_notes
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Status Configs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'status_configs' AND policyname = 'status_configs_anon_policy'
  ) THEN
    CREATE POLICY "status_configs_anon_policy"
      ON status_configs
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Role Configs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'role_configs' AND policyname = 'role_configs_anon_policy'
  ) THEN
    CREATE POLICY "role_configs_anon_policy"
      ON role_configs
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  -- System Settings
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'system_settings' AND policyname = 'system_settings_anon_policy'
  ) THEN
    CREATE POLICY "system_settings_anon_policy"
      ON system_settings
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Equipment Groups
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'equipment_groups' AND policyname = 'equipment_groups_anon_policy'
  ) THEN
    CREATE POLICY "equipment_groups_anon_policy"
      ON equipment_groups
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Equipment Subgroups
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'equipment_subgroups' AND policyname = 'equipment_subgroups_anon_policy'
  ) THEN
    CREATE POLICY "equipment_subgroups_anon_policy"
      ON equipment_subgroups
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Maintenance Types
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'maintenance_types' AND policyname = 'maintenance_types_anon_policy'
  ) THEN
    CREATE POLICY "maintenance_types_anon_policy"
      ON maintenance_types
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Equipment Maintenance
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'equipment_maintenance' AND policyname = 'equipment_maintenance_anon_policy'
  ) THEN
    CREATE POLICY "equipment_maintenance_anon_policy"
      ON equipment_maintenance
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;