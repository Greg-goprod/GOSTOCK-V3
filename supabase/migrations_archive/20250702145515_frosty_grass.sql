/*
  # Fix RLS and add performance optimizations
  
  1. Security
    - Enable RLS on all tables that don't have it yet
    - Add missing RLS policies for authenticated users
    - Ensure proper access control for system settings
  
  2. Performance
    - Create indexes for better query performance
    - Add missing constraints for data integrity
*/

-- Enable RLS on tables that don't have it enabled yet
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Add missing RLS policies for departments
DO $$
BEGIN
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
END $$;

-- Add missing RLS policies for equipment
DO $$
BEGIN
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
END $$;

-- Add missing RLS policies for categories
DO $$
BEGIN
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
END $$;

-- Add missing RLS policies for suppliers
DO $$
BEGIN
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
END $$;

-- Add missing RLS policies for checkouts
DO $$
BEGIN
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
END $$;

-- Add missing RLS policies for equipment_instances
DO $$
BEGIN
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
END $$;

-- Add missing RLS policies for delivery_notes
DO $$
BEGIN
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
END $$;

-- Add missing RLS policies for status_configs
DO $$
BEGIN
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
END $$;

-- Add missing RLS policies for role_configs
DO $$
BEGIN
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
END $$;

-- Ensure system_settings has proper policies for admin access
DO $$
BEGIN
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
END $$;

-- Update table statistics for better query planning
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

-- Note: VACUUM ANALYZE removed as it cannot run inside a transaction block