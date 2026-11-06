/*
  # Initial Schema Setup for Inventory Management System

  1. Tables
    - users
      - id (uuid, primary key)
      - name (text)
      - email (text, unique)
      - phone (text)
      - department (text)
      - role (text)
      - created_at (timestamp)
    
    - categories
      - id (uuid, primary key)
      - name (text)
      - description (text)
      - created_at (timestamp)
    
    - suppliers
      - id (uuid, primary key)
      - name (text)
      - contact_person (text)
      - email (text)
      - phone (text)
      - website (text)
      - created_at (timestamp)
    
    - equipment
      - id (uuid, primary key)
      - name (text)
      - description (text)
      - category_id (uuid, foreign key)
      - serial_number (text, unique)
      - status (text)
      - added_date (timestamp)
      - last_maintenance (timestamp)
      - image_url (text)
      - supplier_id (uuid, foreign key)
      - location (text)
      - created_at (timestamp)
    
    - checkouts
      - id (uuid, primary key)
      - equipment_id (uuid, foreign key)
      - user_id (uuid, foreign key)
      - checkout_date (timestamp)
      - due_date (timestamp)
      - return_date (timestamp)
      - status (text)
      - notes (text)
      - created_at (timestamp)
    
    - status_configs
      - id (text, primary key)
      - name (text)
      - color (text)
      - created_at (timestamp)
    
    - role_configs
      - id (text, primary key)
      - name (text)
      - color (text)
      - created_at (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  department text NOT NULL,
  role text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  website text,
  created_at timestamptz DEFAULT now()
);

-- Create equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES categories(id),
  serial_number text UNIQUE NOT NULL,
  status text NOT NULL,
  added_date timestamptz DEFAULT now(),
  last_maintenance timestamptz,
  image_url text,
  supplier_id uuid REFERENCES suppliers(id),
  location text,
  created_at timestamptz DEFAULT now()
);

-- Create checkouts table
CREATE TABLE IF NOT EXISTS checkouts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid REFERENCES equipment(id) NOT NULL,
  user_id uuid REFERENCES users(id) NOT NULL,
  checkout_date timestamptz NOT NULL DEFAULT now(),
  due_date timestamptz NOT NULL,
  return_date timestamptz,
  status text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create status_configs table
CREATE TABLE IF NOT EXISTS status_configs (
  id text PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create role_configs table
CREATE TABLE IF NOT EXISTS role_configs (
  id text PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_configs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated read access" ON users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON suppliers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON equipment
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON checkouts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON status_configs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON role_configs
  FOR SELECT TO authenticated USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS equipment_category_id_idx ON equipment(category_id);
CREATE INDEX IF NOT EXISTS equipment_supplier_id_idx ON equipment(supplier_id);
CREATE INDEX IF NOT EXISTS checkouts_equipment_id_idx ON checkouts(equipment_id);
CREATE INDEX IF NOT EXISTS checkouts_user_id_idx ON checkouts(user_id);
CREATE INDEX IF NOT EXISTS checkouts_status_idx ON checkouts(status);