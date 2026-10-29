/*
  # Fix RLS policies for status_configs table

  1. Security Changes
    - Drop existing restrictive policies on status_configs table
    - Add proper policies for authenticated users to read status configurations
    - Ensure authenticated users can perform all necessary operations on status_configs

  2. Changes Made
    - Remove old policies that may be causing access issues
    - Add comprehensive policies for authenticated users
    - Maintain security while allowing proper application functionality
*/

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "status_configs_delete_policy" ON status_configs;
DROP POLICY IF EXISTS "status_configs_insert_policy" ON status_configs;
DROP POLICY IF EXISTS "status_configs_select_policy" ON status_configs;
DROP POLICY IF EXISTS "status_configs_update_policy" ON status_configs;

-- Create new comprehensive policies for authenticated users
CREATE POLICY "Allow authenticated users to read status_configs"
  ON status_configs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert status_configs"
  ON status_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update status_configs"
  ON status_configs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete status_configs"
  ON status_configs
  FOR DELETE
  TO authenticated
  USING (true);