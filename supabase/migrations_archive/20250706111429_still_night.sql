/*
  # Update equipment status badges

  1. Changes
     - Add function to calculate equipment status counts
     - Add view for equipment status statistics
     - Update status display to handle 0/0 case
  
  2. Security
     - Enable RLS on the new view
     - Add policies for authenticated and anonymous users
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

-- Enable RLS on the view
ALTER VIEW equipment_status_stats ENABLE ROW LEVEL SECURITY;

-- Create policies for the view
CREATE POLICY "equipment_status_stats_anon_policy" 
ON equipment_status_stats
FOR SELECT TO anon
USING (true);

CREATE POLICY "equipment_status_stats_authenticated_policy" 
ON equipment_status_stats
FOR SELECT TO authenticated
USING (true);

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