/*
  # Nettoyage des données pour la mise en production

  1. Opérations
    - Vider les tables de sortie et entrée de matériel (checkouts, delivery_notes)
    - Réinitialiser les quantités disponibles des équipements
    - Réinitialiser les statuts des équipements
    - Conserver les données de référence (utilisateurs, catégories, etc.)

  2. Sécurité
    - Aucune modification des politiques RLS
*/

-- Désactiver temporairement les triggers pour éviter les effets en cascade
DO $$
BEGIN
  -- Désactiver les triggers sur les tables concernées
  EXECUTE 'ALTER TABLE checkouts DISABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE delivery_notes DISABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE equipment DISABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE equipment_instances DISABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE equipment_maintenance DISABLE TRIGGER ALL';

  -- Vider les tables de sortie et entrée
  DELETE FROM checkouts;
  DELETE FROM delivery_notes;
  DELETE FROM equipment_maintenance;

  -- Réinitialiser les statuts et quantités des équipements
  UPDATE equipment
  SET 
    status = 'available',
    available_quantity = total_quantity,
    last_maintenance = NULL;

  -- Réinitialiser les instances d'équipement
  UPDATE equipment_instances
  SET status = 'available';

  -- Réactiver les triggers
  EXECUTE 'ALTER TABLE checkouts ENABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE delivery_notes ENABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE equipment ENABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE equipment_instances ENABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE equipment_maintenance ENABLE TRIGGER ALL';
END $$;

-- Insérer un paramètre système pour indiquer la date de mise en production
INSERT INTO system_settings (id, value, description)
VALUES ('production_reset_date', NOW()::text, 'Date de réinitialisation pour la mise en production')
ON CONFLICT (id) DO UPDATE
SET value = NOW()::text, updated_at = NOW();

-- Ajouter un message dans les logs
DO $$
BEGIN
  RAISE NOTICE 'Base de données nettoyée pour la mise en production le %', NOW();
END $$;