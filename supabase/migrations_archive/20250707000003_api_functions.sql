/*
  # API RPC pour interagir avec les vues matérialisées
  
  1. Création de fonctions RPC pour obtenir les statuts calculés
  2. Création de fonctions RPC pour forcer la mise à jour des vues
  3. Création de fonctions RPC pour les opérations courantes (emprunts, retours, etc.)
*/

-- Fonction RPC pour obtenir tous les emprunts avec leurs statuts calculés
CREATE OR REPLACE FUNCTION get_checkouts_with_status()
RETURNS TABLE (
  id UUID,
  equipment_id UUID,
  user_id UUID,
  delivery_note_id UUID,
  checkout_date TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  return_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  status TEXT,
  equipment_name TEXT,
  total_quantity INTEGER,
  available_quantity INTEGER,
  first_name TEXT,
  last_name TEXT
) AS $$
BEGIN
  -- Rafraîchir la vue pour s'assurer que les données sont à jour
  PERFORM refresh_checkout_status_view();
  
  -- Retourner les données de la vue
  RETURN QUERY SELECT 
    csv.id,
    csv.equipment_id,
    csv.user_id,
    csv.delivery_note_id,
    csv.checkout_date,
    csv.due_date,
    csv.return_date,
    csv.notes,
    csv.calculated_status,
    csv.equipment_name,
    csv.total_quantity,
    csv.available_quantity,
    csv.first_name,
    csv.last_name
  FROM 
    checkout_status_view csv
  ORDER BY 
    csv.checkout_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Fonction RPC pour obtenir tous les équipements avec leurs statuts et disponibilités calculés
CREATE OR REPLACE FUNCTION get_equipment_with_status()
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category_id UUID,
  supplier_id UUID,
  group_id UUID,
  subgroup_id UUID,
  serial_number TEXT,
  article_number TEXT,
  purchase_date DATE,
  warranty_end DATE,
  location TEXT,
  department_id UUID,
  total_quantity INTEGER,
  qr_type TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  last_maintenance TIMESTAMP WITH TIME ZONE,
  checked_out_count INTEGER,
  maintenance_count INTEGER,
  available_quantity INTEGER,
  status TEXT
) AS $$
BEGIN
  -- Rafraîchir la vue pour s'assurer que les données sont à jour
  PERFORM refresh_equipment_status_view();
  
  -- Retourner les données de la vue
  RETURN QUERY SELECT 
    esv.id,
    esv.name,
    esv.description,
    esv.category_id,
    esv.supplier_id,
    esv.group_id,
    esv.subgroup_id,
    esv.serial_number,
    esv.article_number,
    esv.purchase_date,
    esv.warranty_end,
    esv.location,
    esv.department_id,
    esv.total_quantity,
    esv.qr_type,
    esv.image_url,
    esv.created_at,
    esv.updated_at,
    esv.last_maintenance,
    esv.checked_out_count,
    esv.maintenance_count,
    esv.calculated_available_quantity,
    esv.calculated_status
  FROM 
    equipment_status_view esv
  ORDER BY 
    esv.name ASC;
END;
$$ LANGUAGE plpgsql;

-- Fonction RPC pour forcer la mise à jour des vues matérialisées
CREATE OR REPLACE FUNCTION refresh_all_status_views()
RETURNS VOID AS $$
BEGIN
  PERFORM refresh_checkout_status_view();
  PERFORM refresh_equipment_status_view();
END;
$$ LANGUAGE plpgsql;

-- Fonction RPC pour emprunter du matériel avec mise à jour automatique des statuts
CREATE OR REPLACE FUNCTION checkout_equipment(
  p_equipment_id UUID,
  p_user_id UUID,
  p_delivery_note_id UUID,
  p_due_date TIMESTAMP WITH TIME ZONE,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_checkout_id UUID;
  v_available_quantity INTEGER;
BEGIN
  -- Vérifier la disponibilité de l'équipement
  SELECT calculated_available_quantity INTO v_available_quantity
  FROM equipment_status_view
  WHERE id = p_equipment_id;
  
  IF v_available_quantity <= 0 THEN
    RAISE EXCEPTION 'Équipement non disponible';
  END IF;
  
  -- Créer l'emprunt
  INSERT INTO checkouts (
    equipment_id,
    user_id,
    delivery_note_id,
    checkout_date,
    due_date,
    status,
    notes
  ) VALUES (
    p_equipment_id,
    p_user_id,
    p_delivery_note_id,
    CURRENT_TIMESTAMP,
    p_due_date,
    'active',
    p_notes
  ) RETURNING id INTO v_checkout_id;
  
  -- Rafraîchir les vues
  PERFORM refresh_all_status_views();
  
  RETURN v_checkout_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction RPC pour retourner du matériel avec mise à jour automatique des statuts
CREATE OR REPLACE FUNCTION return_equipment(
  p_checkout_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Mettre à jour l'emprunt
  UPDATE checkouts
  SET 
    status = 'returned',
    return_date = CURRENT_TIMESTAMP,
    notes = CASE 
      WHEN p_notes IS NOT NULL THEN 
        CASE 
          WHEN notes IS NOT NULL THEN notes || E'\n' || p_notes
          ELSE p_notes
        END
      ELSE notes
    END
  WHERE 
    id = p_checkout_id AND
    status IN ('active', 'overdue');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Emprunt non trouvé ou déjà retourné';
  END IF;
  
  -- Rafraîchir les vues
  PERFORM refresh_all_status_views();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Fonction RPC pour marquer un équipement comme perdu
CREATE OR REPLACE FUNCTION mark_equipment_lost(
  p_checkout_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Mettre à jour l'emprunt
  UPDATE checkouts
  SET 
    status = 'lost',
    notes = CASE 
      WHEN p_notes IS NOT NULL THEN 
        CASE 
          WHEN notes IS NOT NULL THEN notes || E'\n' || 'Perdu: ' || p_notes
          ELSE 'Perdu: ' || p_notes
        END
      ELSE 
        CASE 
          WHEN notes IS NOT NULL THEN notes || E'\n' || 'Marqué comme perdu'
          ELSE 'Marqué comme perdu'
        END
    END
  WHERE 
    id = p_checkout_id AND
    status IN ('active', 'overdue');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Emprunt non trouvé ou déjà retourné/perdu';
  END IF;
  
  -- Rafraîchir les vues
  PERFORM refresh_all_status_views();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql; 