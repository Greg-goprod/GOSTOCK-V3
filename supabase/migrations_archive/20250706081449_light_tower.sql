/*
  # Delivery Note Functions

  1. New Functions
    - `set_delivery_note_number` - Function to generate sequential delivery note numbers
    - `update_delivery_note_status` - Function to update delivery note status based on checkouts

  2. Security
    - Functions are accessible to authenticated users
*/

-- Function to generate sequential delivery note numbers
CREATE OR REPLACE FUNCTION set_delivery_note_number()
RETURNS TRIGGER AS $$
DECLARE
  year_month TEXT;
  next_number INT;
  note_prefix TEXT := 'DNyymm-';
BEGIN
  -- Format: DNyymm-xxxx (e.g., DN2306-0001)
  year_month := TO_CHAR(CURRENT_DATE, 'yymm');
  
  -- Get the next number for this month
  SELECT COALESCE(MAX(CAST(SUBSTRING(note_number FROM LENGTH(note_prefix || year_month || '-') + 1) AS INTEGER)), 0) + 1
  INTO next_number
  FROM delivery_notes
  WHERE note_number LIKE (note_prefix || year_month || '-%');
  
  -- Set the note number
  NEW.note_number := note_prefix || year_month || '-' || LPAD(next_number::TEXT, 4, '0');
  
  -- Set the QR code if not already set
  IF NEW.qr_code IS NULL THEN
    NEW.qr_code := 'DN-' || NEW.note_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update delivery note status based on checkouts
CREATE OR REPLACE FUNCTION update_delivery_note_status()
RETURNS TRIGGER AS $$
DECLARE
  v_delivery_note_id UUID;
  v_active_count INT;
  v_returned_count INT;
  v_total_count INT;
  v_new_status TEXT;
BEGIN
  -- Get the delivery note ID
  IF NEW.delivery_note_id IS NOT NULL THEN
    v_delivery_note_id := NEW.delivery_note_id;
  ELSIF OLD.delivery_note_id IS NOT NULL THEN
    v_delivery_note_id := OLD.delivery_note_id;
  ELSE
    RETURN NEW;
  END IF;
  
  -- Count checkouts by status
  SELECT 
    COUNT(*) FILTER (WHERE status = 'active' OR status = 'overdue'),
    COUNT(*) FILTER (WHERE status = 'returned'),
    COUNT(*)
  INTO 
    v_active_count,
    v_returned_count,
    v_total_count
  FROM checkouts
  WHERE delivery_note_id = v_delivery_note_id;
  
  -- Determine new status
  IF v_returned_count = v_total_count THEN
    v_new_status := 'returned';
  ELSIF v_returned_count > 0 AND v_active_count > 0 THEN
    v_new_status := 'partial';
  ELSIF v_active_count = v_total_count THEN
    -- Check if any are overdue
    IF EXISTS (
      SELECT 1 FROM checkouts 
      WHERE delivery_note_id = v_delivery_note_id 
      AND status = 'overdue'
    ) THEN
      v_new_status := 'overdue';
    ELSE
      v_new_status := 'active';
    END IF;
  ELSE
    v_new_status := 'active'; -- Default
  END IF;
  
  -- Update the delivery note status
  UPDATE delivery_notes
  SET status = v_new_status
  WHERE id = v_delivery_note_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;