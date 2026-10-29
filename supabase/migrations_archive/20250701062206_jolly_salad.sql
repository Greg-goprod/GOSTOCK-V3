/*
  # Fix RLS policies for status_configs table

  1. Security Updates
    - Drop existing conflicting policies on status_configs table
    - Create proper RLS policies for authenticated users
    - Ensure INSERT, UPDATE, DELETE, and SELECT operations work correctly

  2. Changes
    - Remove duplicate/conflicting policies
    - Add comprehensive policies for all CRUD operations
    - Maintain security while allowing proper functionality
*/

-- Drop existing policies that might be conflicting
DROP POLICY IF EXISTS "Allow authenticated read access" ON status_configs;
DROP POLICY IF EXISTS "status_configs_authenticated_policy" ON status_configs;

-- Create comprehensive RLS policies for status_configs
CREATE POLICY "status_configs_select_policy"
  ON status_configs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "status_configs_insert_policy"
  ON status_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "status_configs_update_policy"
  ON status_configs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "status_configs_delete_policy"
  ON status_configs
  FOR DELETE
  TO authenticated
  USING (true);