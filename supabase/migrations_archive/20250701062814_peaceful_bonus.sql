/*
  # Fix RLS policies for status_configs table

  1. Security Updates
    - Add comprehensive RLS policies for status_configs table
    - Allow authenticated users to perform all CRUD operations
    - Ensure proper access control for status configuration management

  2. Policy Details
    - SELECT: Allow authenticated users to read all status configs
    - INSERT: Allow authenticated users to create new status configs
    - UPDATE: Allow authenticated users to modify existing status configs
    - DELETE: Allow authenticated users to remove status configs
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "status_configs_select_policy" ON status_configs;
DROP POLICY IF EXISTS "status_configs_insert_policy" ON status_configs;
DROP POLICY IF EXISTS "status_configs_update_policy" ON status_configs;
DROP POLICY IF EXISTS "status_configs_delete_policy" ON status_configs;

-- Create comprehensive RLS policies for status_configs
CREATE POLICY "Allow authenticated users to read status configs"
  ON status_configs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to create status configs"
  ON status_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update status configs"
  ON status_configs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete status configs"
  ON status_configs
  FOR DELETE
  TO authenticated
  USING (true);

-- Ensure RLS is enabled (it should already be enabled according to schema)
ALTER TABLE status_configs ENABLE ROW LEVEL SECURITY;