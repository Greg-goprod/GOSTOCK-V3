/*
  # Create users table and security policies

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `email` (text, required, unique)
      - `phone` (text, optional)
      - `department` (text, required)
      - `role` (text, required)
      - `created_at` (timestamp with time zone)

  2. Security
    - Enable RLS on users table
    - Add policies for authenticated users to:
      - Read all users
      - Create new users
      - Update their own user data
      - Delete their own user data
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  department text NOT NULL,
  role text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create new users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own data"
  ON users
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Create index for email searches
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- Create index for role filtering
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

-- Create index for department filtering
CREATE INDEX IF NOT EXISTS users_department_idx ON users (department);