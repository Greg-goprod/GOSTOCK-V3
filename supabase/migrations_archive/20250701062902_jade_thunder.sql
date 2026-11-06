/*
  # Fix RLS policies for status_configs table

  1. Security Changes
    - Drop existing RLS policies for status_configs table
    - Create new simplified RLS policies that allow authenticated users full access
    - Ensure policies are consistent and don't conflict with each other

  2. Changes Made
    - Remove overly restrictive policies
    - Add comprehensive policies for all CRUD operations
    - Ensure authenticated users can perform all necessary operations
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to create status configs" ON status_configs;
DROP POLICY IF EXISTS "Allow authenticated users to delete status configs" ON status_configs;
DROP POLICY IF EXISTS "Allow authenticated users to read status configs" ON status_configs;
DROP POLICY IF EXISTS "Allow authenticated users to update status configs" ON status_configs;

-- Create new comprehensive policies for authenticated users
CREATE POLICY "status_configs_authenticated_select"
  ON status_configs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "status_configs_authenticated_insert"
  ON status_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "status_configs_authenticated_update"
  ON status_configs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "status_configs_authenticated_delete"
  ON status_configs
  FOR DELETE
  TO authenticated
  USING (true);