/*
  # Amélioration du système de statut des emprunts
  
  1. Création d'une vue matérialisée pour calculer automatiquement les statuts d'emprunt
  2. Ajout d'un trigger pour rafraîchir la vue à chaque modification des emprunts
  3. Ajout d'une fonction pour rafraîchir manuellement la vue
*/

-- Création d'une vue matérialisée pour calculer les statuts d'emprunt
CREATE MATERIALIZED VIEW checkout_status_view AS
SELECT
  c.id,
  c.equipment_id,
  c.user_id,
  c.delivery_note_id,
  c.checkout_date,
  c.due_date,
  c.return_date,
  c.notes,
  CASE
    WHEN c.return_date IS NOT NULL THEN 'returned'
    WHEN c.status = 'lost' THEN 'lost'
    WHEN DATE(c.due_date) < CURRENT_DATE AND c.return_date IS NULL THEN 'overdue'
    ELSE 'active'
  END AS calculated_status,
  e.name AS equipment_name,
  e.total_quantity,
  e.available_quantity,
  u.first_name,
  u.last_name
FROM
  checkouts c
  JOIN equipment e ON c.equipment_id = e.id
  JOIN users u ON c.user_id = u.id;

-- Création d'un index sur la vue matérialisée pour des recherches plus rapides
CREATE INDEX idx_checkout_status_view_id ON checkout_status_view(id);
CREATE INDEX idx_checkout_status_view_equipment_id ON checkout_status_view(equipment_id);
CREATE INDEX idx_checkout_status_view_status ON checkout_status_view(calculated_status);

-- Fonction pour rafraîchir la vue matérialisée
CREATE OR REPLACE FUNCTION refresh_checkout_status_view()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW checkout_status_view;
END;
$$ LANGUAGE plpgsql;

-- Créer un trigger pour rafraîchir la vue après chaque modification de la table checkouts
CREATE OR REPLACE FUNCTION refresh_checkout_status_view_trigger()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_checkout_status_view();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger après INSERT, UPDATE ou DELETE sur la table checkouts
CREATE TRIGGER trigger_refresh_checkout_status_view
AFTER INSERT OR UPDATE OR DELETE ON checkouts
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_checkout_status_view_trigger();

-- Fonction pour obtenir le statut calculé d'un emprunt
CREATE OR REPLACE FUNCTION get_checkout_status(checkout_id UUID)
RETURNS TEXT AS $$
DECLARE
  status TEXT;
BEGIN
  -- Rafraîchir la vue pour s'assurer que les données sont à jour
  PERFORM refresh_checkout_status_view();
  
  -- Récupérer le statut calculé
  SELECT calculated_status INTO status
  FROM checkout_status_view
  WHERE id = checkout_id;
  
  RETURN status;
END;
$$ LANGUAGE plpgsql; 