/*
  # Add color column to categories table

  1. Changes
    - Add `color` column to `categories` table with default value '#64748b' (slate-500)
    - Column is nullable to allow existing records to have a default color

  2. Notes
    - Uses a safe default color that matches the design system
    - Existing categories will get the default color value
*/

-- Add color column to categories table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'color'
  ) THEN
    ALTER TABLE categories ADD COLUMN color text DEFAULT '#64748b';
  END IF;
END $$;