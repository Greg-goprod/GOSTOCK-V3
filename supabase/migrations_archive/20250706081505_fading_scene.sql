/*
  # Updated At Function

  1. New Function
    - `update_updated_at_column` - Function to automatically update the updated_at timestamp

  2. Security
    - Function is accessible to authenticated users
*/

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;