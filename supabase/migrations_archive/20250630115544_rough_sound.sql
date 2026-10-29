/*
  # Création de la table des sous-groupes d'équipements

  1. Nouvelle table
    - `equipment_subgroups` : Sous-groupes d'équipements avec relation vers les groupes
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `description` (text, optional)
      - `color` (text, default '#64748b')
      - `group_id` (uuid, foreign key vers equipment_groups)
      - `created_at` (timestamp)

  2. Modifications
    - Ajouter la colonne `subgroup_id` à la table equipment

  3. Sécurité
    - Enable RLS sur la nouvelle table
    - Politiques d'accès pour les utilisateurs authentifiés
*/

-- Créer la table des sous-groupes d'équipements
CREATE TABLE IF NOT EXISTS equipment_subgroups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT '#64748b',
  group_id uuid REFERENCES equipment_groups(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Ajouter la colonne subgroup_id à equipment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'subgroup_id'
  ) THEN
    ALTER TABLE equipment ADD COLUMN subgroup_id uuid REFERENCES equipment_subgroups(id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE equipment_subgroups ENABLE ROW LEVEL SECURITY;

-- Politiques pour equipment_subgroups
CREATE POLICY "Allow authenticated read access on equipment_subgroups"
  ON equipment_subgroups
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access on equipment_subgroups"
  ON equipment_subgroups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access on equipment_subgroups"
  ON equipment_subgroups
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access on equipment_subgroups"
  ON equipment_subgroups
  FOR DELETE
  TO authenticated
  USING (true);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS equipment_subgroups_group_id_idx ON equipment_subgroups(group_id);
CREATE INDEX IF NOT EXISTS equipment_subgroup_id_idx ON equipment(subgroup_id);

-- Insérer quelques sous-groupes par défaut
INSERT INTO equipment_subgroups (name, description, color, group_id) 
SELECT 
  'Ordinateurs portables', 
  'Laptops et ordinateurs portables', 
  '#1e40af',
  g.id
FROM equipment_groups g 
WHERE g.name = 'Électronique'
ON CONFLICT DO NOTHING;

INSERT INTO equipment_subgroups (name, description, color, group_id) 
SELECT 
  'Outils électriques', 
  'Perceuses, visseuses et outils électriques', 
  '#ea580c',
  g.id
FROM equipment_groups g 
WHERE g.name = 'Outils'
ON CONFLICT DO NOTHING;

INSERT INTO equipment_subgroups (name, description, color, group_id) 
SELECT 
  'Chaises de bureau', 
  'Sièges et chaises ergonomiques', 
  '#059669',
  g.id
FROM equipment_groups g 
WHERE g.name = 'Mobilier'
ON CONFLICT DO NOTHING;