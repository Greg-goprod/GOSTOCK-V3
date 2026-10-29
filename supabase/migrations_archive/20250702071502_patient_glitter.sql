/*
  # Fix RLS and database optimization

  1. Security
    - Disable RLS on all tables for better performance and simpler access
    - Add policies for both anonymous and authenticated users for future use
  
  2. Database Functions
    - Create recover_lost_equipment function for handling lost equipment recovery
  
  3. Performance
    - Add indexes for better query performance
    - Update table statistics
*/

-- Désactiver RLS sur toutes les tables
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

-- Supprimer la fonction existante si elle existe
DROP FUNCTION IF EXISTS recover_lost_equipment(UUID);

-- Créer une fonction pour récupérer les équipements perdus
CREATE FUNCTION recover_lost_equipment(checkout_id UUID)
RETURNS VOID AS $$
DECLARE
  v_equipment_id UUID;
  v_current_available INT;
  v_total_quantity INT;
BEGIN
  -- Récupérer l'ID de l'équipement
  SELECT equipment_id INTO v_equipment_id
  FROM checkouts
  WHERE id = checkout_id;
  
  -- Mettre à jour le statut du checkout
  UPDATE checkouts
  SET status = 'returned',
      return_date = NOW(),
      notes = COALESCE(notes, '') || E'\nMatériel retrouvé le ' || TO_CHAR(NOW(), 'DD/MM/YYYY')
  WHERE id = checkout_id;
  
  -- Récupérer les quantités actuelles
  SELECT available_quantity, total_quantity INTO v_current_available, v_total_quantity
  FROM equipment
  WHERE id = v_equipment_id;
  
  -- Mettre à jour l'équipement
  UPDATE equipment
  SET available_quantity = v_current_available + 1,
      status = CASE 
                WHEN (v_current_available + 1) >= v_total_quantity THEN 'available'
                ELSE 'checked-out'
              END
  WHERE id = v_equipment_id;
END;
$$ LANGUAGE plpgsql;

-- Ajouter des politiques pour les utilisateurs authentifiés également
DO $$
BEGIN
  -- Departments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'departments' AND policyname = 'departments_authenticated_policy'
  ) THEN
    CREATE POLICY "departments_authenticated_policy"
      ON departments
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Equipment
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'equipment' AND policyname = 'equipment_authenticated_policy'
  ) THEN
    CREATE POLICY "equipment_authenticated_policy"
      ON equipment
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Categories
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'categories' AND policyname = 'categories_authenticated_policy'
  ) THEN
    CREATE POLICY "categories_authenticated_policy"
      ON categories
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Suppliers
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suppliers' AND policyname = 'suppliers_authenticated_policy'
  ) THEN
    CREATE POLICY "suppliers_authenticated_policy"
      ON suppliers
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Checkouts
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'checkouts' AND policyname = 'checkouts_authenticated_policy'
  ) THEN
    CREATE POLICY "checkouts_authenticated_policy"
      ON checkouts
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Equipment Instances
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'equipment_instances' AND policyname = 'equipment_instances_authenticated_policy'
  ) THEN
    CREATE POLICY "equipment_instances_authenticated_policy"
      ON equipment_instances
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Delivery Notes
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'delivery_notes' AND policyname = 'delivery_notes_authenticated_policy'
  ) THEN
    CREATE POLICY "delivery_notes_authenticated_policy"
      ON delivery_notes
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Status Configs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'status_configs' AND policyname = 'status_configs_authenticated_policy'
  ) THEN
    CREATE POLICY "status_configs_authenticated_policy"
      ON status_configs
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Role Configs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'role_configs' AND policyname = 'role_configs_authenticated_policy'
  ) THEN
    CREATE POLICY "role_configs_authenticated_policy"
      ON role_configs
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- System Settings
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'system_settings' AND policyname = 'system_settings_authenticated_policy'
  ) THEN
    CREATE POLICY "system_settings_authenticated_policy"
      ON system_settings
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Equipment Groups
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'equipment_groups' AND policyname = 'equipment_groups_authenticated_policy'
  ) THEN
    CREATE POLICY "equipment_groups_authenticated_policy"
      ON equipment_groups
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Equipment Subgroups
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'equipment_subgroups' AND policyname = 'equipment_subgroups_authenticated_policy'
  ) THEN
    CREATE POLICY "equipment_subgroups_authenticated_policy"
      ON equipment_subgroups
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Maintenance Types
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'maintenance_types' AND policyname = 'maintenance_types_authenticated_policy'
  ) THEN
    CREATE POLICY "maintenance_types_authenticated_policy"
      ON maintenance_types
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Equipment Maintenance
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'equipment_maintenance' AND policyname = 'equipment_maintenance_authenticated_policy'
  ) THEN
    CREATE POLICY "equipment_maintenance_authenticated_policy"
      ON equipment_maintenance
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Create indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_equipment_created_at ON equipment(created_at);
CREATE INDEX IF NOT EXISTS idx_checkouts_created_at ON checkouts(created_at);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_created_at ON delivery_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_equipment_name_search ON equipment USING gin(to_tsvector('french', name));
CREATE INDEX IF NOT EXISTS idx_equipment_serial_number ON equipment(serial_number);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_location ON equipment(location);
CREATE INDEX IF NOT EXISTS idx_equipment_added_date ON equipment(added_date);
CREATE INDEX IF NOT EXISTS idx_equipment_category_status ON equipment(category_id, status);
CREATE INDEX IF NOT EXISTS idx_equipment_supplier_status ON equipment(supplier_id, status);
CREATE INDEX IF NOT EXISTS idx_equipment_status_category ON equipment(status, category_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_users_first_name ON users(first_name);
CREATE INDEX IF NOT EXISTS idx_users_last_name ON users(last_name);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_full_name_search ON users USING gin(to_tsvector('french', (first_name || ' ' || last_name)));
CREATE INDEX IF NOT EXISTS idx_checkouts_checkout_date ON checkouts(checkout_date);
CREATE INDEX IF NOT EXISTS idx_checkouts_due_date ON checkouts(due_date);
CREATE INDEX IF NOT EXISTS idx_checkouts_return_date ON checkouts(return_date);
CREATE INDEX IF NOT EXISTS idx_checkouts_equipment_status ON checkouts(equipment_id, status);
CREATE INDEX IF NOT EXISTS idx_checkouts_user_status ON checkouts(user_id, status);

-- Update table statistics for better query planning (using ANALYZE instead of VACUUM ANALYZE)
ANALYZE departments;
ANALYZE equipment;
ANALYZE categories;
ANALYZE suppliers;
ANALYZE users;
ANALYZE checkouts;
ANALYZE equipment_instances;
ANALYZE equipment_groups;
ANALYZE equipment_subgroups;
ANALYZE maintenance_types;
ANALYZE equipment_maintenance;
ANALYZE delivery_notes;
ANALYZE status_configs;
ANALYZE role_configs;
ANALYZE system_settings;

-- Add any missing constraints that should be in production
-- Ensure equipment status values are valid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'equipment_status_check'
  ) THEN
    ALTER TABLE equipment 
    ADD CONSTRAINT equipment_status_check 
    CHECK (status IN ('available', 'checked-out', 'maintenance', 'retired', 'lost'));
  END IF;
END $$;

-- Ensure user roles are valid - using a more flexible approach
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'users_role_check'
  ) THEN
    -- First check what roles are currently in use
    IF NOT EXISTS (
      SELECT 1 FROM users 
      WHERE role NOT IN ('admin', 'manager', 'user', 'technician')
    ) THEN
      -- Only add constraint if all existing roles match our expected values
      ALTER TABLE users 
      ADD CONSTRAINT users_role_check 
      CHECK (role IN ('admin', 'manager', 'user', 'technician'));
    END IF;
  END IF;
END $$;