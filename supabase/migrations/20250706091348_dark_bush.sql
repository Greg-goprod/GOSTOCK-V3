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
  -- Update checkouts to overdue status when due date has passed (dès 00h01 le lendemain)
  UPDATE checkouts
  SET status = 'overdue'
  WHERE 
    status = 'active' AND 
    due_date::timestamp + interval '23 hours 59 minutes 59 seconds' < CURRENT_TIMESTAMP; -- La date d'échéance est strictement antérieure à l'heure actuelle
    
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

-- Fonction pour forcer la mise à jour des statuts d'emprunt en retard avec une date spécifique
-- Utile pour tester ou forcer la mise à jour avec une date différente
CREATE OR REPLACE FUNCTION force_update_overdue_checkouts(reference_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
RETURNS VOID AS $$
BEGIN
  -- Mettre à jour les emprunts en retard en fonction de la date de référence
  UPDATE checkouts
  SET status = 'overdue'
  WHERE 
    status = 'active' AND 
    due_date::timestamp + interval '23 hours 59 minutes 59 seconds' < reference_timestamp; -- La date d'échéance est strictement antérieure à la date de référence
    
  -- Mettre à jour le statut des bons de livraison en fonction des emprunts
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
  
  -- Retourner le nombre d'emprunts mis à jour
  RAISE NOTICE 'Emprunts mis à jour avec la date de référence: %', reference_timestamp;
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