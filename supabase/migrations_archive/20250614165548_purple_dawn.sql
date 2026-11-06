/*
  # Ajout du système de quantités et instances d'équipements

  1. Nouvelles colonnes
    - `article_number` : Numéro d'article auto-généré unique
    - `qr_type` : Type de QR code ('individual' ou 'batch')
    - `total_quantity` : Quantité totale
    - `available_quantity` : Quantité disponible

  2. Nouvelle table
    - `equipment_instances` : Instances individuelles pour les équipements avec QR individuels

  3. Sécurité
    - Enable RLS sur la nouvelle table
    - Politiques d'accès appropriées
*/

-- Ajouter les nouvelles colonnes à la table equipment
DO $$
BEGIN
  -- Ajouter article_number s'il n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'article_number'
  ) THEN
    ALTER TABLE equipment ADD COLUMN article_number text UNIQUE;
  END IF;

  -- Ajouter qr_type s'il n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'qr_type'
  ) THEN
    ALTER TABLE equipment ADD COLUMN qr_type text DEFAULT 'individual' CHECK (qr_type IN ('individual', 'batch'));
  END IF;

  -- Ajouter total_quantity s'il n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'total_quantity'
  ) THEN
    ALTER TABLE equipment ADD COLUMN total_quantity integer DEFAULT 1;
  END IF;

  -- Ajouter available_quantity s'il n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'available_quantity'
  ) THEN
    ALTER TABLE equipment ADD COLUMN available_quantity integer DEFAULT 1;
  END IF;
END $$;

-- Créer la table equipment_instances si elle n'existe pas
CREATE TABLE IF NOT EXISTS equipment_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid REFERENCES equipment(id) ON DELETE CASCADE,
  instance_number integer NOT NULL,
  qr_code text UNIQUE NOT NULL,
  status text DEFAULT 'available' CHECK (status IN ('available', 'checked-out', 'maintenance', 'retired')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(equipment_id, instance_number)
);

-- Enable RLS sur equipment_instances
ALTER TABLE equipment_instances ENABLE ROW LEVEL SECURITY;

-- Politiques pour equipment_instances
CREATE POLICY "Allow authenticated read access on equipment_instances"
  ON equipment_instances
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access on equipment_instances"
  ON equipment_instances
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access on equipment_instances"
  ON equipment_instances
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access on equipment_instances"
  ON equipment_instances
  FOR DELETE
  TO authenticated
  USING (true);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS equipment_instances_equipment_id_idx ON equipment_instances(equipment_id);
CREATE INDEX IF NOT EXISTS equipment_instances_status_idx ON equipment_instances(status);
CREATE INDEX IF NOT EXISTS equipment_instances_qr_code_idx ON equipment_instances(qr_code);

-- Fonction pour générer un numéro d'article automatique
CREATE OR REPLACE FUNCTION generate_article_number()
RETURNS text AS $$
DECLARE
  new_number text;
  counter integer;
BEGIN
  -- Générer un numéro d'article au format ART-YYYYMMDD-XXXX
  SELECT COALESCE(MAX(CAST(SUBSTRING(article_number FROM 'ART-\d{8}-(\d{4})') AS integer)), 0) + 1
  INTO counter
  FROM equipment
  WHERE article_number LIKE 'ART-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_number := 'ART-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::text, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-générer le numéro d'article
CREATE OR REPLACE FUNCTION set_article_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.article_number IS NULL THEN
    NEW.article_number := generate_article_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger s'il n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'equipment_article_number_trigger'
  ) THEN
    CREATE TRIGGER equipment_article_number_trigger
      BEFORE INSERT ON equipment
      FOR EACH ROW
      EXECUTE FUNCTION set_article_number();
  END IF;
END $$;

-- Mettre à jour les équipements existants sans numéro d'article
UPDATE equipment 
SET article_number = generate_article_number()
WHERE article_number IS NULL;