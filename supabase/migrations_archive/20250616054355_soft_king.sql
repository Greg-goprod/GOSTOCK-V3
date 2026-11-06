/*
  # Fix departments table creation

  1. Tables
    - Create departments table if not exists
    - Add proper columns with defaults
  
  2. Security
    - Enable RLS on departments table
    - Add policies for authenticated users
  
  3. Performance
    - Add index on name column
*/

-- Create departments table only if it doesn't exist
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT '#64748b',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS (safe to run multiple times)
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "departments_select_policy" ON departments;
DROP POLICY IF EXISTS "departments_insert_policy" ON departments;
DROP POLICY IF EXISTS "departments_update_policy" ON departments;
DROP POLICY IF EXISTS "departments_delete_policy" ON departments;

-- Create policies for authenticated users
CREATE POLICY "departments_select_policy" ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_insert_policy" ON departments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "departments_update_policy" ON departments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "departments_delete_policy" ON departments FOR DELETE TO authenticated USING (true);

-- Add index for performance (safe to run multiple times)
CREATE INDEX IF NOT EXISTS departments_name_idx ON departments (name);