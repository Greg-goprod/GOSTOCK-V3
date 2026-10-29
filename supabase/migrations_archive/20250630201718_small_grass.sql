/*
  # Add color column to categories table

  1. Changes
    - Add color column to categories table with default value
    - Ensure the column is added only if it doesn't exist

  2. Security
    - No changes to RLS policies needed
*/

-- Add color column to categories table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'color'
  ) THEN
    ALTER TABLE categories ADD COLUMN color text DEFAULT '#64748b';
  END IF;
END $$;