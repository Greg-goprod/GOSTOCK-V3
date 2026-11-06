/*
  # Amélioration du système de statut des équipements
  
  1. Création d'une vue matérialisée pour calculer automatiquement les statuts et disponibilités des équipements
  2. Ajout d'un trigger pour rafraîchir la vue à chaque modification des emprunts
  3. Ajout d'une fonction pour rafraîchir manuellement la vue
*/

-- Création d'une vue matérialisée pour calculer les statuts et disponibilités des équipements
CREATE MATERIALIZED VIEW equipment_status_view AS
SELECT
  e.id,
  e.name,
  e.description,
  e.category_id,
  e.supplier_id,
  e.group_id,
  e.subgroup_id,
  e.serial_number,
  e.article_number,
  e.purchase_date,
  e.warranty_end,
  e.location,
  e.department_id,
  e.total_quantity,
  e.qr_type,
  e.image_url,
  e.created_at,
  e.updated_at,
  e.last_maintenance,
  -- Calcul du nombre d'emprunts actifs, en retard ou perdus
  (SELECT COUNT(*) FROM checkouts c WHERE c.equipment_id = e.id AND (c.status = 'active' OR c.status = 'overdue' OR c.status = 'lost')) AS checked_out_count,
  -- Calcul du nombre d'équipements en maintenance
  (SELECT COUNT(*) FROM equipment_maintenance em WHERE em.equipment_id = e.id AND em.status = 'in_progress') AS maintenance_count,
  -- Calcul de la quantité disponible
  GREATEST(e.total_quantity - 
    (SELECT COUNT(*) FROM checkouts c WHERE c.equipment_id = e.id AND (c.status = 'active' OR c.status = 'overdue' OR c.status = 'lost')) - 
    (SELECT COUNT(*) FROM equipment_maintenance em WHERE em.equipment_id = e.id AND em.status = 'in_progress'), 
    0) AS calculated_available_quantity,
  -- Calcul du statut
  CASE
    WHEN (SELECT COUNT(*) FROM equipment_maintenance em WHERE em.equipment_id = e.id AND em.status = 'in_progress') > 0 THEN 'maintenance'
    WHEN GREATEST(e.total_quantity - 
      (SELECT COUNT(*) FROM checkouts c WHERE c.equipment_id = e.id AND (c.status = 'active' OR c.status = 'overdue' OR c.status = 'lost')) - 
      (SELECT COUNT(*) FROM equipment_maintenance em WHERE em.equipment_id = e.id AND em.status = 'in_progress'), 
      0) = 0 THEN 'checked-out'
    ELSE 'available'
  END AS calculated_status
FROM
  equipment e;

-- Création d'un index sur la vue matérialisée pour des recherches plus rapides
CREATE INDEX idx_equipment_status_view_id ON equipment_status_view(id);
CREATE INDEX idx_equipment_status_view_status ON equipment_status_view(calculated_status);

-- Fonction pour rafraîchir la vue matérialisée
CREATE OR REPLACE FUNCTION refresh_equipment_status_view()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW equipment_status_view;
END;
$$ LANGUAGE plpgsql;

-- Créer un trigger pour rafraîchir la vue après chaque modification des tables checkouts ou equipment_maintenance
CREATE OR REPLACE FUNCTION refresh_equipment_status_view_trigger()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_equipment_status_view();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger après INSERT, UPDATE ou DELETE sur la table checkouts
CREATE TRIGGER trigger_refresh_equipment_status_view_checkouts
AFTER INSERT OR UPDATE OR DELETE ON checkouts
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_equipment_status_view_trigger();

-- Appliquer le trigger après INSERT, UPDATE ou DELETE sur la table equipment_maintenance
CREATE TRIGGER trigger_refresh_equipment_status_view_maintenance
AFTER INSERT OR UPDATE OR DELETE ON equipment_maintenance
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_equipment_status_view_trigger();

-- Fonction pour obtenir le statut calculé d'un équipement
CREATE OR REPLACE FUNCTION get_equipment_status(equipment_id UUID)
RETURNS TEXT AS $$
DECLARE
  status TEXT;
BEGIN
  -- Rafraîchir la vue pour s'assurer que les données sont à jour
  PERFORM refresh_equipment_status_view();
  
  -- Récupérer le statut calculé
  SELECT calculated_status INTO status
  FROM equipment_status_view
  WHERE id = equipment_id;
  
  RETURN status;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir la quantité disponible calculée d'un équipement
CREATE OR REPLACE FUNCTION get_equipment_available_quantity(equipment_id UUID)
RETURNS INTEGER AS $$
DECLARE
  quantity INTEGER;
BEGIN
  -- Rafraîchir la vue pour s'assurer que les données sont à jour
  PERFORM refresh_equipment_status_view();
  
  -- Récupérer la quantité disponible calculée
  SELECT calculated_available_quantity INTO quantity
  FROM equipment_status_view
  WHERE id = equipment_id;
  
  RETURN quantity;
END;
$$ LANGUAGE plpgsql; 