/*
  # Maintenance Functions

  1. New Functions
    - `recover_lost_equipment` - Function to recover lost equipment and update related records
    - `update_equipment_status_on_maintenance` - Function to update equipment status when maintenance status changes

  2. Security
    - Functions are accessible to authenticated users
*/

-- Function to recover lost equipment
CREATE OR REPLACE FUNCTION recover_lost_equipment(checkout_id UUID)
RETURNS VOID AS $$
DECLARE
  v_equipment_id UUID;
  v_available_quantity INT;
  v_total_quantity INT;
  v_new_status TEXT;
BEGIN
  -- Get the equipment ID from the checkout
  SELECT equipment_id INTO v_equipment_id
  FROM checkouts
  WHERE id = checkout_id;
  
  -- Update the checkout status to returned
  UPDATE checkouts
  SET 
    status = 'returned',
    return_date = NOW(),
    notes = COALESCE(notes, '') || E'\nMatériel retrouvé le ' || TO_CHAR(NOW(), 'DD/MM/YYYY')
  WHERE id = checkout_id;
  
  -- Get current equipment quantities
  SELECT 
    available_quantity, 
    total_quantity 
  INTO 
    v_available_quantity, 
    v_total_quantity
  FROM equipment
  WHERE id = v_equipment_id;
  
  -- Increment available quantity
  v_available_quantity := COALESCE(v_available_quantity, 0) + 1;
  
  -- Determine new status based on quantities
  IF v_available_quantity >= v_total_quantity THEN
    v_new_status := 'available';
  ELSE
    v_new_status := 'checked-out';
  END IF;
  
  -- Update equipment status and quantity
  UPDATE equipment
  SET 
    status = v_new_status,
    available_quantity = v_available_quantity
  WHERE id = v_equipment_id;
  
  -- Update delivery note status if all items are returned
  WITH checkout_counts AS (
    SELECT 
      delivery_note_id,
      COUNT(*) FILTER (WHERE status = 'returned') AS returned_count,
      COUNT(*) AS total_count
    FROM checkouts
    WHERE delivery_note_id = (SELECT delivery_note_id FROM checkouts WHERE id = checkout_id)
    GROUP BY delivery_note_id
  )
  UPDATE delivery_notes dn
  SET status = 
    CASE 
      WHEN cc.returned_count = cc.total_count THEN 'returned'
      WHEN cc.returned_count > 0 AND cc.returned_count < cc.total_count THEN 'partial'
      ELSE dn.status
    END
  FROM checkout_counts cc
  WHERE dn.id = cc.delivery_note_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update equipment status when maintenance status changes
CREATE OR REPLACE FUNCTION update_equipment_status_on_maintenance()
RETURNS TRIGGER AS $$
BEGIN
  -- If maintenance is completed, update equipment status to available
  IF NEW.status = 'completed' AND OLD.status = 'in_progress' THEN
    UPDATE equipment
    SET 
      status = 'available',
      last_maintenance = NEW.end_date
    WHERE id = NEW.equipment_id;
  -- If maintenance is started, update equipment status to maintenance
  ELSIF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status != 'in_progress') THEN
    UPDATE equipment
    SET status = 'maintenance'
    WHERE id = NEW.equipment_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for maintenance status changes
DROP TRIGGER IF EXISTS update_equipment_status_on_maintenance_trigger ON equipment_maintenance;
CREATE TRIGGER update_equipment_status_on_maintenance_trigger
AFTER INSERT OR UPDATE OF status ON equipment_maintenance
FOR EACH ROW
EXECUTE FUNCTION update_equipment_status_on_maintenance();