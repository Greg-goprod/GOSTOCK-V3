/*
  # Update users table to separate first and last names

  1. Changes
    - Add first_name and last_name columns
    - Migrate existing name data
    - Remove old name column
    - Update indexes

  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE users ADD COLUMN first_name text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE users ADD COLUMN last_name text;
  END IF;
END $$;

-- Migrate existing data (split name into first_name and last_name)
UPDATE users 
SET 
  first_name = CASE 
    WHEN position(' ' in name) > 0 THEN split_part(name, ' ', 1)
    ELSE name
  END,
  last_name = CASE 
    WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL OR last_name IS NULL;

-- Make first_name required
ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE users ALTER COLUMN last_name SET NOT NULL;

-- Drop old name column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'name'
  ) THEN
    ALTER TABLE users DROP COLUMN name;
  END IF;
END $$;