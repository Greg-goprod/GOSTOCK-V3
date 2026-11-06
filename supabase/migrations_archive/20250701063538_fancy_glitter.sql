/*
  # Fix RLS policies for status_configs table

  1. Changes
    - Drop existing policies to avoid conflicts
    - Ensure RLS is enabled on status_configs table
    - Create policy for anonymous users to read status configurations
    - Create policies for authenticated users for full CRUD access
    - Insert default status configurations if they don't exist

  2. Security
    - Allow anonymous read access for status_configs
    - Allow authenticated users full access to status_configs
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow anonymous read access on status_configs" ON status_configs;
DROP POLICY IF EXISTS "Allow authenticated read access on status_configs" ON status_configs;
DROP POLICY IF EXISTS "Allow authenticated insert access on status_configs" ON status_configs;
DROP POLICY IF EXISTS "Allow authenticated update access on status_configs" ON status_configs;
DROP POLICY IF EXISTS "Allow authenticated delete access on status_configs" ON status_configs;

-- Ensure RLS is enabled
ALTER TABLE status_configs ENABLE ROW LEVEL SECURITY;

-- Create policy for anonymous users to read status configurations
CREATE POLICY "Allow anonymous read access on status_configs"
  ON status_configs
  FOR SELECT
  TO anon
  USING (true);

-- Create policies for authenticated users
CREATE POLICY "Allow authenticated read access on status_configs"
  ON status_configs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access on status_configs"
  ON status_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access on status_configs"
  ON status_configs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access on status_configs"
  ON status_configs
  FOR DELETE
  TO authenticated
  USING (true);

-- Insert default status configurations if they don't exist
INSERT INTO status_configs (id, name, color) VALUES
  ('available', 'Disponible', '#10b981'),
  ('checked-out', 'Emprunté', '#f59e0b'),
  ('maintenance', 'En maintenance', '#3b82f6'),
  ('retired', 'Retiré', '#ef4444'),
  ('lost', 'Perdu', '#6b7280')
ON CONFLICT (id) DO NOTHING;