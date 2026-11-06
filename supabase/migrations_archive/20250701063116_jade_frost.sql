/*
  # Fix RLS policies for status_configs table

  1. Security Updates
    - Add policy for anonymous users to read status configurations
    - Ensure authenticated users can perform all operations
    - Keep RLS enabled for security while allowing necessary access

  2. Changes
    - Add SELECT policy for anonymous role to read status configs
    - Ensure existing authenticated policies work correctly
*/

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "status_configs_authenticated_select" ON status_configs;
DROP POLICY IF EXISTS "status_configs_authenticated_insert" ON status_configs;
DROP POLICY IF EXISTS "status_configs_authenticated_update" ON status_configs;
DROP POLICY IF EXISTS "status_configs_authenticated_delete" ON status_configs;

-- Allow anonymous users to read status configurations
CREATE POLICY "Allow anonymous read access on status_configs"
  ON status_configs
  FOR SELECT
  TO anon
  USING (true);

-- Allow authenticated users to read status configurations
CREATE POLICY "Allow authenticated read access on status_configs"
  ON status_configs
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert status configurations
CREATE POLICY "Allow authenticated insert access on status_configs"
  ON status_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update status configurations
CREATE POLICY "Allow authenticated update access on status_configs"
  ON status_configs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete status configurations
CREATE POLICY "Allow authenticated delete access on status_configs"
  ON status_configs
  FOR DELETE
  TO authenticated
  USING (true);