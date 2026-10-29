/*
  # Equipment Status Statistics View

  1. New Views
    - `equipment_status_stats`: Provides aggregated statistics about equipment status
  
  2. New Functions
    - `get_status_badge_text`: Helper function to format status badge text
*/

-- Create a view for equipment status statistics
CREATE OR REPLACE VIEW equipment_status_stats AS
SELECT
  status,
  COUNT(*) as total_count,
  SUM(total_quantity) as total_quantity,
  SUM(available_quantity) as available_quantity
FROM
  equipment
GROUP BY
  status;

-- Note: Row Level Security (RLS) cannot be directly applied to views in PostgreSQL
-- Instead, the view inherits the security from the underlying tables

-- Function to get formatted status badge text
CREATE OR REPLACE FUNCTION get_status_badge_text(
  p_status TEXT,
  p_available_quantity INTEGER,
  p_total_quantity INTEGER
) RETURNS TEXT AS $$
BEGIN
  IF p_status = 'available' THEN
    -- For available status, show available/total
    IF p_total_quantity = 0 THEN
      RETURN '0/0';
    ELSE
      RETURN p_available_quantity || '/' || p_total_quantity;
    END IF;
  ELSE
    -- For other statuses, just show the status name
    RETURN p_status;
  END IF;
END;
$$ LANGUAGE plpgsql;