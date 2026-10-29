/*
  # Fix Available Quantity Management

  1. Corrections des triggers de maintenance
    - Décrémenter available_quantity quand maintenance commence
    - Incrémenter available_quantity quand maintenance se termine
    - Gérer les cas où l'équipement était déjà emprunté

  2. Fonction pour gérer les équipements perdus
    - Décrémenter available_quantity lors de la perte
    - Incrémenter available_quantity lors de la récupération

  3. Mise à jour de la logique de checkout
    - Exclure les équipements en maintenance du checkout
*/

-- Fonction améliorée pour la gestion de la maintenance
CREATE OR REPLACE FUNCTION update_equipment_status_on_maintenance()
RETURNS TRIGGER AS $$
DECLARE
  v_current_available INT;
  v_total_quantity INT;
  v_equipment_status TEXT;
BEGIN
  -- Récupérer les informations actuelles de l'équipement
  SELECT available_quantity, total_quantity, status 
  INTO v_current_available, v_total_quantity, v_equipment_status
  FROM equipment 
  WHERE id = NEW.equipment_id;

  -- Si maintenance commence (in_progress)
  IF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status != 'in_progress') THEN
    -- Si l'équipement n'était pas déjà en maintenance ou emprunté
    IF v_equipment_status NOT IN ('maintenance', 'checked-out') THEN
      -- Décrémenter available_quantity de 1 (une unité part en maintenance)
      UPDATE equipment
      SET 
        status = 'maintenance',
        available_quantity = GREATEST(0, COALESCE(v_current_available, 0) - 1)
      WHERE id = NEW.equipment_id;
    ELSE
      -- Si déjà en maintenance ou emprunté, juste mettre à jour le statut
      UPDATE equipment
      SET status = 'maintenance'
      WHERE id = NEW.equipment_id;
    END IF;

  -- Si maintenance terminée (completed)
  ELSIF NEW.status = 'completed' AND OLD.status = 'in_progress' THEN
    -- Incrémenter available_quantity de 1 (une unité revient de maintenance)
    UPDATE equipment
    SET 
      status = CASE 
        WHEN (COALESCE(v_current_available, 0) + 1) >= COALESCE(v_total_quantity, 1) THEN 'available'
        ELSE 'checked-out'
      END,
      available_quantity = LEAST(COALESCE(v_total_quantity, 1), COALESCE(v_current_available, 0) + 1),
      last_maintenance = NEW.end_date
    WHERE id = NEW.equipment_id;

  -- Si maintenance annulée (cancelled)
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'in_progress' THEN
    -- Incrémenter available_quantity de 1 (une unité revient de maintenance)
    UPDATE equipment
    SET 
      status = CASE 
        WHEN (COALESCE(v_current_available, 0) + 1) >= COALESCE(v_total_quantity, 1) THEN 'available'
        ELSE 'checked-out'
      END,
      available_quantity = LEAST(COALESCE(v_total_quantity, 1), COALESCE(v_current_available, 0) + 1)
    WHERE id = NEW.equipment_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour marquer un équipement comme perdu et décrémenter available_quantity
CREATE OR REPLACE FUNCTION mark_equipment_lost(checkout_id UUID)
RETURNS VOID AS $$
DECLARE
  v_equipment_id UUID;
  v_current_available INT;
  v_total_quantity INT;
BEGIN
  -- Récupérer l'ID de l'équipement
  SELECT equipment_id INTO v_equipment_id
  FROM checkouts
  WHERE id = checkout_id;
  
  -- Récupérer les quantités actuelles
  SELECT available_quantity, total_quantity 
  INTO v_current_available, v_total_quantity
  FROM equipment
  WHERE id = v_equipment_id;
  
  -- Mettre à jour le checkout comme perdu
  UPDATE checkouts
  SET 
    status = 'lost',
    notes = COALESCE(notes, '') || E'\nMatériel déclaré perdu le ' || TO_CHAR(NOW(), 'DD/MM/YYYY')
  WHERE id = checkout_id;
  
  -- Décrémenter total_quantity car l'équipement est définitivement perdu
  -- Note: on ne touche pas available_quantity car l'équipement était déjà sorti
  UPDATE equipment
  SET 
    total_quantity = GREATEST(1, COALESCE(v_total_quantity, 1) - 1),
    status = CASE 
      WHEN COALESCE(v_current_available, 0) > 0 THEN 'available'
      WHEN COALESCE(v_current_available, 0) = 0 AND GREATEST(1, COALESCE(v_total_quantity, 1) - 1) > 0 THEN 'checked-out'
      ELSE 'retired'
    END
  WHERE id = v_equipment_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction améliorée pour récupérer un équipement perdu
CREATE OR REPLACE FUNCTION recover_lost_equipment(checkout_id UUID)
RETURNS VOID AS $$
DECLARE
  v_equipment_id UUID;
  v_available_quantity INT;
  v_total_quantity INT;
  v_new_status TEXT;
BEGIN
  -- Récupérer l'ID de l'équipement
  SELECT equipment_id INTO v_equipment_id
  FROM checkouts
  WHERE id = checkout_id;
  
  -- Mettre à jour le checkout comme retourné
  UPDATE checkouts
  SET 
    status = 'returned',
    return_date = NOW(),
    notes = COALESCE(notes, '') || E'\nMatériel retrouvé le ' || TO_CHAR(NOW(), 'DD/MM/YYYY')
  WHERE id = checkout_id;
  
  -- Récupérer les quantités actuelles
  SELECT 
    available_quantity, 
    total_quantity 
  INTO 
    v_available_quantity, 
    v_total_quantity
  FROM equipment
  WHERE id = v_equipment_id;
  
  -- Incrémenter available_quantity ET total_quantity (car l'équipement revient dans le stock)
  v_available_quantity := COALESCE(v_available_quantity, 0) + 1;
  v_total_quantity := COALESCE(v_total_quantity, 1) + 1;
  
  -- Déterminer le nouveau statut
  IF v_available_quantity >= v_total_quantity THEN
    v_new_status := 'available';
  ELSE
    v_new_status := 'checked-out';
  END IF;
  
  -- Mettre à jour l'équipement
  UPDATE equipment
  SET 
    status = v_new_status,
    available_quantity = v_available_quantity,
    total_quantity = v_total_quantity
  WHERE id = v_equipment_id;
  
  -- Mettre à jour le statut du bon de livraison si nécessaire
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

-- Remplacer le trigger existant
DROP TRIGGER IF EXISTS update_equipment_status_on_maintenance_trigger ON equipment_maintenance;
CREATE TRIGGER update_equipment_status_on_maintenance_trigger
AFTER INSERT OR UPDATE OF status ON equipment_maintenance
FOR EACH ROW
EXECUTE FUNCTION update_equipment_status_on_maintenance();

-- Fonction pour vérifier la disponibilité avant checkout (utilisée côté application)
CREATE OR REPLACE FUNCTION check_equipment_availability(equipment_id UUID, requested_quantity INT DEFAULT 1)
RETURNS TABLE(
  is_available BOOLEAN,
  available_quantity INT,
  status TEXT,
  message TEXT
) AS $$
DECLARE
  v_equipment RECORD;
  v_maintenance_count INT;
BEGIN
  -- Récupérer les informations de l'équipement
  SELECT e.available_quantity, e.total_quantity, e.status, e.name
  INTO v_equipment
  FROM equipment e
  WHERE e.id = equipment_id;
  
  -- Vérifier s'il y a une maintenance en cours
  SELECT COUNT(*)
  INTO v_maintenance_count
  FROM equipment_maintenance em
  WHERE em.equipment_id = equipment_id 
    AND em.status = 'in_progress';
  
  -- Déterminer la disponibilité
  IF v_equipment.status = 'retired' THEN
    RETURN QUERY SELECT 
      FALSE, 
      COALESCE(v_equipment.available_quantity, 0),
      v_equipment.status,
      'Équipement retiré du service'::TEXT;
  ELSIF v_equipment.status = 'maintenance' OR v_maintenance_count > 0 THEN
    RETURN QUERY SELECT 
      FALSE, 
      COALESCE(v_equipment.available_quantity, 0),
      v_equipment.status,
      'Équipement en maintenance'::TEXT;
  ELSIF COALESCE(v_equipment.available_quantity, 0) < requested_quantity THEN
    RETURN QUERY SELECT 
      FALSE, 
      COALESCE(v_equipment.available_quantity, 0),
      v_equipment.status,
      FORMAT('Quantité insuffisante (disponible: %s, demandée: %s)', 
             COALESCE(v_equipment.available_quantity, 0), 
             requested_quantity)::TEXT;
  ELSE
    RETURN QUERY SELECT 
      TRUE, 
      COALESCE(v_equipment.available_quantity, 0),
      v_equipment.status,
      'Équipement disponible'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql; 

-- Fonction pour vérifier et mettre à jour les disponibilités des équipements
CREATE OR REPLACE FUNCTION update_equipment_availability()
RETURNS VOID AS $$
DECLARE
  eq RECORD;
  active_count INT;
BEGIN
  -- Pour chaque équipement
  FOR eq IN SELECT id, total_quantity FROM equipment LOOP
    -- Compter les emprunts actifs, en retard et perdus
    SELECT COUNT(*) INTO active_count
    FROM checkouts
    WHERE equipment_id = eq.id AND (status = 'active' OR status = 'overdue' OR status = 'lost');
    
    -- Mettre à jour la quantité disponible
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