/*
  # Ajouter la colonne available_quantity si elle n'existe pas

  1. Modifications
    - Vérifier et ajouter la colonne available_quantity à la table equipment
    - Mettre à jour les équipements existants avec une valeur par défaut

  2. Sécurité
    - Aucune modification des politiques RLS nécessaire
*/

-- Ajouter la colonne available_quantity si elle n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'available_quantity'
  ) THEN
    ALTER TABLE equipment ADD COLUMN available_quantity integer DEFAULT 1;
  END IF;
END $$;

-- Mettre à jour les équipements existants qui n'ont pas de valeur available_quantity
UPDATE equipment 
SET available_quantity = COALESCE(total_quantity, 1)
WHERE available_quantity IS NULL;

-- S'assurer que available_quantity n'est jamais NULL
ALTER TABLE equipment ALTER COLUMN available_quantity SET NOT NULL;
ALTER TABLE equipment ALTER COLUMN available_quantity SET DEFAULT 1;