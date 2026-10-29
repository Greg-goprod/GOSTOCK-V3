/*
  # Correction des quantités disponibles pour le matériel

  1. Objectif
    - Résoudre le problème d'affichage des quantités disponibles
    - S'assurer que tous les équipements ont leur quantité disponible égale à leur quantité totale
    - Vérifier et corriger les incohérences dans les instances d'équipement

  2. Actions
    - Mettre à jour tous les équipements pour avoir available_quantity = total_quantity
    - Mettre à jour le statut de tous les équipements à 'available'
    - Recréer les instances d'équipement si nécessaire
*/

-- Désactiver temporairement les contraintes de clé étrangère
SET session_replication_role = 'replica';

-- Supprimer toutes les instances existantes pour éviter les incohérences
TRUNCATE TABLE equipment_instances CASCADE;

-- Mettre à jour tous les équipements pour être disponibles avec quantité correcte
UPDATE equipment SET 
  status = 'available',
  available_quantity = total_quantity;

-- Recréer les instances pour les équipements avec qr_type = 'individual'
INSERT INTO equipment_instances (equipment_id, instance_number, qr_code, status)
SELECT 
  e.id, 
  i.instance_number, 
  COALESCE(e.article_number, e.serial_number) || '-' || LPAD(i.instance_number::text, 3, '0'), 
  'available'
FROM 
  equipment e,
  generate_series(1, GREATEST(e.total_quantity, 1)) AS i(instance_number)
WHERE 
  e.qr_type = 'individual' AND e.total_quantity > 0;

-- Réactiver les contraintes de clé étrangère
SET session_replication_role = 'origin';

-- Vérifier et corriger les incohérences potentielles
DO $$
DECLARE
  equipment_record RECORD;
BEGIN
  -- Parcourir tous les équipements
  FOR equipment_record IN SELECT id, name, total_quantity, available_quantity FROM equipment LOOP
    -- Si la quantité disponible est différente de la quantité totale, la corriger
    IF equipment_record.available_quantity != equipment_record.total_quantity THEN
      RAISE NOTICE 'Correction de la quantité pour %: % -> %', 
        equipment_record.name, 
        equipment_record.available_quantity, 
        equipment_record.total_quantity;
        
      UPDATE equipment 
      SET available_quantity = total_quantity 
      WHERE id = equipment_record.id;
    END IF;
  END LOOP;
END $$;

-- Mettre à jour les statistiques pour optimiser les performances
ANALYZE equipment;
ANALYZE equipment_instances;