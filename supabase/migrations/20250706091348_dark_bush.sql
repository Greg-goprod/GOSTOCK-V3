/*
  # Fix overdue status calculation

  1. Changes
    - Add a function to automatically update checkout status to 'overdue' when due date has passed
    - Add a trigger to run this function daily
    - Add a function to update equipment availability badge counts
*/

-- Function to update checkout status to overdue when due date has passed
CREATE OR REPLACE FUNCTION update_overdue_checkouts()
RETURNS VOID AS $$
BEGIN
  -- Update checkouts to overdue status when due date has passed (lendemain de la date prévue)
  UPDATE checkouts
  SET status = 'overdue'
  WHERE 
    status = 'active' AND 
    due_date < CURRENT_DATE; -- La date d'échéance est strictement antérieure à la date actuelle
    
  -- Update delivery notes status based on checkouts
  WITH checkout_counts AS (
    SELECT 
      delivery_note_id,
      COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
      COUNT(*) FILTER (WHERE status = 'returned') AS returned_count,
      COUNT(*) AS total_count
    FROM checkouts
    WHERE delivery_note_id IS NOT NULL
    GROUP BY delivery_note_id
  )
  UPDATE delivery_notes dn
  SET status = 
    CASE 
      WHEN cc.overdue_count > 0 THEN 'overdue'
      WHEN cc.returned_count = cc.total_count THEN 'returned'
      WHEN cc.returned_count > 0 AND cc.returned_count < cc.total_count THEN 'partial'
      ELSE 'active'
    END
  FROM checkout_counts cc
  WHERE dn.id = cc.delivery_note_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update equipment availability counts
CREATE OR REPLACE FUNCTION update_equipment_availability()
RETURNS VOID AS $$
DECLARE
  eq RECORD;
  active_count INT;
BEGIN
  -- For each equipment item
  FOR eq IN SELECT id, total_quantity FROM equipment LOOP
    -- Count active, overdue and lost checkouts
    SELECT COUNT(*) INTO active_count
    FROM checkouts
    WHERE equipment_id = eq.id AND (status = 'active' OR status = 'overdue' OR status = 'lost');
    
    -- Update available quantity
    UPDATE equipment
    SET 
      available_quantity = GREATEST(total_quantity - active_count, 0),
      status = CASE 
        WHEN total_quantity - active_count <= 0 THEN 'checked-out'
        ELSE 'available'
      END
    WHERE id = eq.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create a cron job to run these functions daily (if pg_cron extension is available)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule('0 0 * * *', 'SELECT update_overdue_checkouts(); SELECT update_equipment_availability();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- If pg_cron is not available, we'll rely on application logic
  RAISE NOTICE 'pg_cron extension not available, skipping cron job creation';
END $$;