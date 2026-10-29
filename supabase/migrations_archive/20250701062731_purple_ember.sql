/*
  # Fix RLS policies for status_configs table

  1. Security Changes
    - Drop existing RLS policies that may be conflicting
    - Create new, properly configured RLS policies for status_configs table
    - Ensure authenticated users can perform all CRUD operations

  2. Changes Made
    - Remove potentially problematic policies
    - Add clear, working policies for INSERT, SELECT, UPDATE, DELETE operations
    - Maintain security while allowing proper functionality
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to insert status_configs" ON status_configs;
DROP POLICY IF EXISTS "Allow authenticated users to read status_configs" ON status_configs;
DROP POLICY IF EXISTS "Allow authenticated users to update status_configs" ON status_configs;
DROP POLICY IF EXISTS "Allow authenticated users to delete status_configs" ON status_configs;

-- Create new, properly configured policies
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