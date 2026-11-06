/*
  # Add lost equipment recovery functionality

  1. New Features
    - Add 'lost' status to checkouts table
    - Add function to handle recovery of lost equipment
    - Update equipment status when equipment is found

  2. Changes
    - Add 'lost' to the status check constraint in checkouts table
    - Create a function to update equipment status when lost equipment is found
*/

-- Add 'lost' to the status check constraint in checkouts table if it doesn't exist
DO $$
BEGIN
  -- First check if the constraint exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'checkouts_status_check'
  ) THEN
    -- Drop the existing constraint
    ALTER TABLE checkouts DROP CONSTRAINT IF EXISTS checkouts_status_check;
  END IF;
  
  -- Add the new constraint with 'lost' status
  ALTER TABLE checkouts 
    ADD CONSTRAINT checkouts_status_check 
    CHECK (status IN ('active', 'returned', 'overdue', 'lost'));
END $$;

-- Create a function to handle recovery of lost equipment
CREATE OR REPLACE FUNCTION recover_lost_equipment(checkout_id uuid)
RETURNS boolean AS $$
DECLARE
  v_equipment_id uuid;
  v_current_status text;
  v_available_quantity integer;
  v_total_quantity integer;
BEGIN
  -- Get the equipment ID and current status from the checkout
  SELECT equipment_id, status INTO v_equipment_id, v_current_status
  FROM checkouts
  WHERE id = checkout_id;
  
  -- Check if the checkout exists and is marked as lost
  IF v_equipment_id IS NULL THEN
    RAISE EXCEPTION 'Checkout not found';
  END IF;
  
  IF v_current_status != 'lost' THEN
    RAISE EXCEPTION 'Checkout is not marked as lost';
  END IF;
  
  -- Get current equipment quantities
  SELECT available_quantity, total_quantity INTO v_available_quantity, v_total_quantity
  FROM equipment
  WHERE id = v_equipment_id;
  
  -- Update the checkout status to returned
  UPDATE checkouts
  SET 
    status = 'returned',
    return_date = NOW(),
    notes = COALESCE(notes, '') || E'\nMatériel retrouvé le ' || TO_CHAR(NOW(), 'DD/MM/YYYY')
  WHERE id = checkout_id;
  
  -- Update the equipment status and available quantity
  UPDATE equipment
  SET 
    status = CASE 
      WHEN v_available_quantity + 1 >= v_total_quantity THEN 'available'
      ELSE 'checked-out'
    END,
    available_quantity = v_available_quantity + 1
  WHERE id = v_equipment_id;
  
  -- Update delivery note status if needed
  PERFORM update_delivery_note_status(checkout_id);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update delivery note status
CREATE OR REPLACE FUNCTION update_delivery_note_status(checkout_id uuid)
RETURNS void AS $$
DECLARE
  v_delivery_note_id uuid;
  v_total_items integer;
  v_returned_items integer;
  v_note_status text;
BEGIN
  -- Get the delivery note ID
  SELECT delivery_note_id INTO v_delivery_note_id
  FROM checkouts
  WHERE id = checkout_id;
  
  -- If there's no delivery note, exit
  IF v_delivery_note_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Count total and returned items for this delivery note
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned
  INTO v_total_items, v_returned_items
  FROM checkouts 
  WHERE delivery_note_id = v_delivery_note_id;
  
  -- Determine the new status
  IF v_returned_items = 0 THEN
    v_note_status := 'active';
  ELSIF v_returned_items = v_total_items THEN
    v_note_status := 'returned';
  ELSE
    v_note_status := 'partial';
  END IF;
  
  -- Check if overdue
  IF v_note_status IN ('active', 'partial') THEN
    SELECT CASE 
      WHEN due_date < NOW() THEN 'overdue'
      ELSE v_note_status
    END INTO v_note_status
    FROM delivery_notes 
    WHERE id = v_delivery_note_id;
  END IF;
  
  -- Update the delivery note status
  UPDATE delivery_notes 
  SET 
    status = v_note_status,
    updated_at = NOW()
  WHERE id = v_delivery_note_id;
END;
$$ LANGUAGE plpgsql;