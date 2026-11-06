/*
  # Système de maintenance avec notes

  1. Nouvelles tables
    - `maintenance_types` - Types de maintenance/panne configurables
    - `equipment_maintenance` - Historique des maintenances avec notes

  2. Modifications
    - Ajout de colonnes pour tracer les dates de maintenance

  3. Sécurité
    - Enable RLS sur toutes les nouvelles tables
    - Politiques d'accès pour les utilisateurs authentifiés
*/

-- Créer la table des types de maintenance/panne
CREATE TABLE IF NOT EXISTS maintenance_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT '#f59e0b',
  created_at timestamptz DEFAULT now()
);

-- Créer la table de l'historique des maintenances
CREATE TABLE IF NOT EXISTS equipment_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid REFERENCES equipment(id) ON DELETE CASCADE NOT NULL,
  maintenance_type_id uuid REFERENCES maintenance_types(id) NOT NULL,
  title text NOT NULL,
  description text,
  start_date timestamptz DEFAULT now() NOT NULL,
  end_date timestamptz,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')) NOT NULL,
  technician_name text,
  cost numeric(10,2),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE maintenance_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_maintenance ENABLE ROW LEVEL SECURITY;

-- Politiques pour maintenance_types
CREATE POLICY "Allow authenticated read access on maintenance_types"
  ON maintenance_types
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access on maintenance_types"
  ON maintenance_types
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access on maintenance_types"
  ON maintenance_types
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access on maintenance_types"
  ON maintenance_types
  FOR DELETE
  TO authenticated
  USING (true);

-- Politiques pour equipment_maintenance
CREATE POLICY "Allow authenticated read access on equipment_maintenance"
  ON equipment_maintenance
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access on equipment_maintenance"
  ON equipment_maintenance
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access on equipment_maintenance"
  ON equipment_maintenance
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access on equipment_maintenance"
  ON equipment_maintenance
  FOR DELETE
  TO authenticated
  USING (true);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS equipment_maintenance_equipment_id_idx ON equipment_maintenance(equipment_id);
CREATE INDEX IF NOT EXISTS equipment_maintenance_type_id_idx ON equipment_maintenance(maintenance_type_id);
CREATE INDEX IF NOT EXISTS equipment_maintenance_status_idx ON equipment_maintenance(status);
CREATE INDEX IF NOT EXISTS equipment_maintenance_start_date_idx ON equipment_maintenance(start_date);

-- Insérer des types de maintenance par défaut
INSERT INTO maintenance_types (name, description, color) VALUES
  ('Maintenance préventive', 'Maintenance programmée et préventive', '#10b981'),
  ('Panne électrique', 'Problème électrique ou électronique', '#ef4444'),
  ('Panne mécanique', 'Problème mécanique ou usure', '#f59e0b'),
  ('Mise à jour logicielle', 'Installation de mises à jour', '#3b82f6'),
  ('Nettoyage/Entretien', 'Nettoyage et entretien général', '#8b5cf6'),
  ('Réparation', 'Réparation suite à dommage', '#ec4899')
ON CONFLICT DO NOTHING;

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at automatiquement
CREATE TRIGGER update_equipment_maintenance_updated_at
  BEFORE UPDATE ON equipment_maintenance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour mettre à jour le statut de l'équipement lors des maintenances
CREATE OR REPLACE FUNCTION update_equipment_status_on_maintenance()
RETURNS TRIGGER AS $$
BEGIN
  -- Si une nouvelle maintenance commence
  IF TG_OP = 'INSERT' AND NEW.status = 'in_progress' THEN
    UPDATE equipment 
    SET 
      status = 'maintenance',
      last_maintenance = NEW.start_date
    WHERE id = NEW.equipment_id;
  END IF;
  
  -- Si une maintenance se termine
  IF TG_OP = 'UPDATE' AND OLD.status = 'in_progress' AND NEW.status = 'completed' THEN
    -- Vérifier s'il n'y a pas d'autres maintenances en cours
    IF NOT EXISTS (
      SELECT 1 FROM equipment_maintenance 
      WHERE equipment_id = NEW.equipment_id 
      AND status = 'in_progress' 
      AND id != NEW.id
    ) THEN
      -- Remettre le statut à disponible si aucune autre maintenance en cours
      UPDATE equipment 
      SET 
        status = 'available',
        last_maintenance = NEW.end_date
      WHERE id = NEW.equipment_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement le statut de l'équipement
CREATE TRIGGER update_equipment_status_on_maintenance_trigger
  AFTER INSERT OR UPDATE ON equipment_maintenance
  FOR EACH ROW
  EXECUTE FUNCTION update_equipment_status_on_maintenance();