/*
  # Ajout des groupes d'équipements et configuration des préfixes

  1. Nouvelles tables
    - `equipment_groups` : Groupes d'équipements configurables
    - `system_settings` : Configuration système (préfixe article, etc.)

  2. Modifications
    - Ajout de la colonne `group_id` à la table equipment
    - Mise à jour de la fonction de génération des numéros d'articles

  3. Sécurité
    - Enable RLS sur les nouvelles tables
    - Politiques d'accès pour les utilisateurs authentifiés
*/

-- Créer la table des groupes d'équipements
CREATE TABLE IF NOT EXISTS equipment_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT '#64748b',
  created_at timestamptz DEFAULT now()
);

-- Créer la table des paramètres système
CREATE TABLE IF NOT EXISTS system_settings (
  id text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Ajouter la colonne group_id à equipment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE equipment ADD COLUMN group_id uuid REFERENCES equipment_groups(id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE equipment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Politiques pour equipment_groups
CREATE POLICY "Allow authenticated read access on equipment_groups"
  ON equipment_groups
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access on equipment_groups"
  ON equipment_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access on equipment_groups"
  ON equipment_groups
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access on equipment_groups"
  ON equipment_groups
  FOR DELETE
  TO authenticated
  USING (true);

-- Politiques pour system_settings
CREATE POLICY "Allow authenticated read access on system_settings"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated update access on system_settings"
  ON system_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated insert access on system_settings"
  ON system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS equipment_group_id_idx ON equipment(group_id);

-- Insérer les paramètres par défaut
INSERT INTO system_settings (id, value, description) 
VALUES ('article_prefix', 'GOMAT', 'Préfixe pour les numéros d''articles (5 caractères max)')
ON CONFLICT (id) DO NOTHING;

-- Mettre à jour la fonction de génération des numéros d'articles
CREATE OR REPLACE FUNCTION generate_article_number()
RETURNS text AS $$
DECLARE
  new_number text;
  counter integer;
  prefix text;
BEGIN
  -- Récupérer le préfixe depuis les paramètres
  SELECT value INTO prefix FROM system_settings WHERE id = 'article_prefix';
  IF prefix IS NULL THEN
    prefix := 'GOMAT';
  END IF;
  
  -- Générer un numéro d'article au format PREFIX-YYYYMMDD-XXXX
  SELECT COALESCE(MAX(CAST(SUBSTRING(article_number FROM prefix || '-\d{8}-(\d{4})') AS integer)), 0) + 1
  INTO counter
  FROM equipment
  WHERE article_number LIKE prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_number := prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::text, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Insérer quelques groupes par défaut
INSERT INTO equipment_groups (name, description, color) VALUES
  ('Électronique', 'Appareils électroniques et informatiques', '#3b82f6'),
  ('Outils', 'Outils manuels et électriques', '#f59e0b'),
  ('Mobilier', 'Mobilier et équipement de bureau', '#10b981'),
  ('Sécurité', 'Équipement de protection et sécurité', '#ef4444')
ON CONFLICT DO NOTHING;