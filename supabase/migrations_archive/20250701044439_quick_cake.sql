/*
  # Nettoyage de la base de données pour la production

  1. Actions
    - Suppression des données de test dans les tables
    - Conservation des configurations et paramètres système
    - Préparation pour un déploiement en production propre
*/

-- Désactiver temporairement les contraintes de clé étrangère pour faciliter la suppression
SET session_replication_role = 'replica';

-- Supprimer toutes les données des tables de transactions
TRUNCATE TABLE checkouts CASCADE;
TRUNCATE TABLE delivery_notes CASCADE;
TRUNCATE TABLE equipment_maintenance CASCADE;

-- Supprimer les instances d'équipement
TRUNCATE TABLE equipment_instances CASCADE;

-- Réinitialiser les équipements (conserver les configurations mais supprimer les données)
UPDATE equipment SET 
  status = 'available',
  available_quantity = total_quantity,
  last_maintenance = NULL;

-- Réinitialiser les compteurs de séquence pour les numéros de bons et d'articles
-- (Cela permettra de redémarrer la numérotation à partir de 1)
DO $$
DECLARE
  prefix text;
BEGIN
  -- Récupérer le préfixe depuis les paramètres
  SELECT value INTO prefix FROM system_settings WHERE id = 'article_prefix';
  IF prefix IS NULL THEN
    prefix := 'GOMAT';
  END IF;
  
  -- Mettre à jour le dernier numéro de bon utilisé
  EXECUTE format('
    DO $inner$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM delivery_notes 
        WHERE note_number LIKE %L
      ) THEN
        PERFORM setval(
          pg_get_serial_sequence(''delivery_notes'', ''id''),
          1,
          false
        );
      END IF;
    END $inner$;
  ', prefix || '-BON-%');
END $$;

-- Réactiver les contraintes de clé étrangère
SET session_replication_role = 'origin';

-- Mettre à jour les statistiques des tables pour optimiser les performances
ANALYZE equipment;
ANALYZE equipment_instances;
ANALYZE checkouts;
ANALYZE delivery_notes;
ANALYZE equipment_maintenance;