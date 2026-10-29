/*
  # Système de bons de sortie

  1. Nouvelles tables
    - `delivery_notes` - Bons de sortie avec numéros uniques
    - Relation avec utilisateurs et équipements via les checkouts

  2. Modifications
    - Ajouter `delivery_note_id` aux checkouts
    - Fonction de génération automatique des numéros de bons

  3. Sécurité
    - RLS activé sur toutes les nouvelles tables
    - Politiques d'accès pour les utilisateurs authentifiés
*/

-- Créer la table des bons de sortie
CREATE TABLE IF NOT EXISTS delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_number text UNIQUE NOT NULL,
  user_id uuid REFERENCES users(id) NOT NULL,
  issue_date timestamptz DEFAULT now() NOT NULL,
  due_date timestamptz NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'returned', 'partial', 'overdue')) NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ajouter la colonne delivery_note_id aux checkouts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checkouts' AND column_name = 'delivery_note_id'
  ) THEN
    ALTER TABLE checkouts ADD COLUMN delivery_note_id uuid REFERENCES delivery_notes(id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;

-- Politiques pour delivery_notes
CREATE POLICY "Allow authenticated read access on delivery_notes"
  ON delivery_notes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access on delivery_notes"
  ON delivery_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access on delivery_notes"
  ON delivery_notes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access on delivery_notes"
  ON delivery_notes
  FOR DELETE
  TO authenticated
  USING (true);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS delivery_notes_user_id_idx ON delivery_notes(user_id);
CREATE INDEX IF NOT EXISTS delivery_notes_status_idx ON delivery_notes(status);
CREATE INDEX IF NOT EXISTS delivery_notes_issue_date_idx ON delivery_notes(issue_date);
CREATE INDEX IF NOT EXISTS delivery_notes_due_date_idx ON delivery_notes(due_date);
CREATE INDEX IF NOT EXISTS checkouts_delivery_note_id_idx ON checkouts(delivery_note_id);

-- Fonction pour générer un numéro de bon automatique
CREATE OR REPLACE FUNCTION generate_delivery_note_number()
RETURNS text AS $$
DECLARE
  new_number text;
  counter integer;
  prefix text;
BEGIN
  -- Récupérer le préfixe depuis les paramètres système
  SELECT value INTO prefix FROM system_settings WHERE id = 'article_prefix';
  IF prefix IS NULL THEN
    prefix := 'GOMAT';
  END IF;
  
  -- Générer un numéro de bon au format PREFIX-BON-YYYYMMDD-XXXX
  SELECT COALESCE(MAX(CAST(SUBSTRING(note_number FROM prefix || '-BON-\d{8}-(\d{4})') AS integer)), 0) + 1
  INTO counter
  FROM delivery_notes
  WHERE note_number LIKE prefix || '-BON-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_number := prefix || '-BON-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::text, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-générer le numéro de bon
CREATE OR REPLACE FUNCTION set_delivery_note_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.note_number IS NULL THEN
    NEW.note_number := generate_delivery_note_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger s'il n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'delivery_notes_number_trigger'
  ) THEN
    CREATE TRIGGER delivery_notes_number_trigger
      BEFORE INSERT ON delivery_notes
      FOR EACH ROW
      EXECUTE FUNCTION set_delivery_note_number();
  END IF;
END $$;

-- Fonction pour mettre à jour le statut des bons selon les retours
CREATE OR REPLACE FUNCTION update_delivery_note_status()
RETURNS trigger AS $$
DECLARE
  total_items integer;
  returned_items integer;
  note_status text;
BEGIN
  -- Compter le total d'items et les items retournés pour ce bon
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned
  INTO total_items, returned_items
  FROM checkouts 
  WHERE delivery_note_id = COALESCE(NEW.delivery_note_id, OLD.delivery_note_id);
  
  -- Déterminer le nouveau statut
  IF returned_items = 0 THEN
    note_status := 'active';
  ELSIF returned_items = total_items THEN
    note_status := 'returned';
  ELSE
    note_status := 'partial';
  END IF;
  
  -- Vérifier si en retard
  IF note_status IN ('active', 'partial') THEN
    SELECT CASE 
      WHEN due_date < NOW() THEN 'overdue'
      ELSE note_status
    END INTO note_status
    FROM delivery_notes 
    WHERE id = COALESCE(NEW.delivery_note_id, OLD.delivery_note_id);
  END IF;
  
  -- Mettre à jour le statut du bon
  UPDATE delivery_notes 
  SET 
    status = note_status,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.delivery_note_id, OLD.delivery_note_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement le statut des bons
CREATE TRIGGER update_delivery_note_status_trigger
  AFTER UPDATE OF status ON checkouts
  FOR EACH ROW
  WHEN (OLD.delivery_note_id IS NOT NULL OR NEW.delivery_note_id IS NOT NULL)
  EXECUTE FUNCTION update_delivery_note_status();