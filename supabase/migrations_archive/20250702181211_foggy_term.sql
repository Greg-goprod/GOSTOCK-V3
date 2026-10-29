/*
  # Ajout de QR code aux bons de sortie

  1. Nouvelles fonctionnalités
    - Ajout d'une colonne qr_code à la table delivery_notes
    - Mise à jour des bons existants avec un QR code au format 'DN-{note_number}'
    - Modification de la fonction de génération des numéros de bons pour inclure le QR code
    - Ajout d'une contrainte d'unicité sur le QR code
    - Création d'un index pour la recherche rapide par QR code

  2. Sécurité
    - Aucun changement de sécurité
*/

-- Vérifier si la colonne qr_code existe déjà dans la table delivery_notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'delivery_notes' AND column_name = 'qr_code'
  ) THEN
    -- Ajouter la colonne qr_code à la table delivery_notes
    ALTER TABLE delivery_notes ADD COLUMN qr_code text;
    
    -- Mettre à jour les enregistrements existants avec un QR code
    UPDATE delivery_notes SET qr_code = 'DN-' || note_number;
    
    -- Ajouter une contrainte d'unicité sur qr_code
    ALTER TABLE delivery_notes ADD CONSTRAINT delivery_notes_qr_code_key UNIQUE (qr_code);
  END IF;
END $$;

-- Créer un index pour la recherche rapide par QR code
CREATE INDEX IF NOT EXISTS idx_delivery_notes_qr_code ON delivery_notes(qr_code);

-- Mettre à jour la fonction de génération des numéros de bons pour inclure le QR code
CREATE OR REPLACE FUNCTION set_delivery_note_number()
RETURNS TRIGGER AS $$
DECLARE
  year_month TEXT;
  counter INT;
  new_note_number TEXT;
BEGIN
  -- Format: DNyymm-xxxx (ex: DN2307-0001)
  year_month := to_char(CURRENT_DATE, 'yymm');
  
  -- Trouver le dernier compteur pour ce mois
  SELECT COALESCE(MAX(CAST(SUBSTRING(note_number FROM 8) AS INTEGER)), 0)
  INTO counter
  FROM delivery_notes
  WHERE note_number LIKE 'DN' || year_month || '-%';
  
  -- Incrémenter le compteur
  counter := counter + 1;
  
  -- Créer le nouveau numéro de bon
  new_note_number := 'DN' || year_month || '-' || LPAD(counter::TEXT, 4, '0');
  
  -- Assigner le nouveau numéro
  NEW.note_number := new_note_number;
  
  -- Assigner le QR code
  NEW.qr_code := 'DN-' || new_note_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Vérifier si le trigger existe déjà et le supprimer si c'est le cas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'delivery_notes_number_trigger'
  ) THEN
    DROP TRIGGER IF EXISTS delivery_notes_number_trigger ON delivery_notes;
  END IF;
END $$;

-- Recréer le trigger avec la fonction mise à jour
CREATE TRIGGER delivery_notes_number_trigger
BEFORE INSERT ON delivery_notes
FOR EACH ROW
EXECUTE FUNCTION set_delivery_note_number();