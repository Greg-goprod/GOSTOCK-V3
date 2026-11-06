/*
  # Fix equipment instances generation

  1. New Functions
    - `generate_equipment_instances`: Creates instances for equipment with individual QR codes
    - `sync_equipment_instances`: Trigger function to keep instances in sync with equipment quantity

  2. Changes
    - Adds trigger on equipment table for total_quantity and qr_type changes
    - Fixes existing equipment instances for items with individual QR type
*/

-- Drop existing function if it exists to avoid parameter name conflict
DROP FUNCTION IF EXISTS generate_equipment_instances(uuid);

-- Function to generate instances for equipment
CREATE OR REPLACE FUNCTION generate_equipment_instances(p_equipment_id UUID)
RETURNS VOID AS $$
DECLARE
  v_equipment RECORD;
  v_instance_count INT;
  v_instances_to_create INT;
  v_article_number TEXT;
BEGIN
  -- Get equipment details
  SELECT id, article_number, serial_number, total_quantity, qr_type
  INTO v_equipment
  FROM equipment
  WHERE id = p_equipment_id;
  
  -- Only proceed for individual QR type
  IF v_equipment.qr_type != 'individual' THEN
    RETURN;
  END IF;
  
  -- Count existing instances
  SELECT COUNT(*)
  INTO v_instance_count
  FROM equipment_instances
  WHERE equipment_id = p_equipment_id;
  
  -- Calculate how many instances to create
  v_instances_to_create := v_equipment.total_quantity - v_instance_count;
  
  -- If we need to create instances
  IF v_instances_to_create > 0 THEN
    -- Use article number if available, otherwise use serial number
    v_article_number := COALESCE(v_equipment.article_number, v_equipment.serial_number);
    
    -- Create instances
    FOR i IN 1..v_instances_to_create LOOP
      INSERT INTO equipment_instances (
        equipment_id,
        instance_number,
        qr_code,
        status
      ) VALUES (
        p_equipment_id,
        v_instance_count + i,
        v_article_number || '-' || LPAD((v_instance_count + i)::TEXT, 3, '0'),
        'available'
      );
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS sync_equipment_instances() CASCADE;

-- Function to sync equipment instances with total quantity
CREATE OR REPLACE FUNCTION sync_equipment_instances()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed for individual QR type
  IF NEW.qr_type = 'individual' THEN
    -- If total quantity changed or QR type changed
    IF (OLD.total_quantity != NEW.total_quantity) OR (OLD.qr_type != NEW.qr_type) THEN
      -- Generate instances
      PERFORM generate_equipment_instances(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for equipment updates
DROP TRIGGER IF EXISTS sync_equipment_instances_trigger ON equipment;
CREATE TRIGGER sync_equipment_instances_trigger
AFTER UPDATE OF total_quantity, qr_type ON equipment
FOR EACH ROW
EXECUTE FUNCTION sync_equipment_instances();

-- Fix existing equipment instances
DO $$
DECLARE
  eq RECORD;
BEGIN
  -- For each equipment with individual QR type
  FOR eq IN 
    SELECT id 
    FROM equipment 
    WHERE qr_type = 'individual'
  LOOP
    -- Generate instances
    PERFORM generate_equipment_instances(eq.id);
  END LOOP;
END $$;