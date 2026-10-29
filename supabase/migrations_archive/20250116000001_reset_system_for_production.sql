/*
  # Remise à zéro du système pour mise en production

  1. Suppression complète des données transactionnelles
    - Tous les emprunts et historique (checkouts)
    - Tous les bons de livraison (delivery_notes) 
    - Toutes les maintenances (equipment_maintenance)
    - Toutes les instances d'équipement (equipment_instances)

  2. Remise en disponibilité de tout le matériel
    - available_quantity = total_quantity
    - status = 'available'
    - last_maintenance = NULL

  3. Conservation des données de référence
    - Utilisateurs, départements, catégories, fournisseurs
    - Équipements de base (nom, description, etc.)
    - Configurations système

  ⚠️ ATTENTION: Cette migration supprime définitivement toutes les données d'emprunt et de maintenance !
*/

-- Désactiver temporairement les triggers pour éviter les conflits en cascade
DO $$
BEGIN
  -- Désactiver les triggers sur les tables principales
  EXECUTE 'ALTER TABLE checkouts DISABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE delivery_notes DISABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE equipment DISABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE equipment_instances DISABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE equipment_maintenance DISABLE TRIGGER ALL';
  
  RAISE NOTICE 'Triggers désactivés temporairement';
END $$;

-- 1. SUPPRESSION DES DONNÉES TRANSACTIONNELLES

-- Supprimer tous les emprunts (checkouts)
DELETE FROM checkouts;
RAISE NOTICE 'Tous les emprunts supprimés: % lignes', (SELECT COUNT(*) FROM checkouts);

-- Supprimer tous les bons de livraison (delivery_notes) 
DELETE FROM delivery_notes;
RAISE NOTICE 'Tous les bons de livraison supprimés: % lignes', (SELECT COUNT(*) FROM delivery_notes);

-- Supprimer toutes les maintenances (equipment_maintenance)
DELETE FROM equipment_maintenance;
RAISE NOTICE 'Toutes les maintenances supprimées: % lignes', (SELECT COUNT(*) FROM equipment_maintenance);

-- Supprimer toutes les instances d'équipement (equipment_instances)
DELETE FROM equipment_instances;
RAISE NOTICE 'Toutes les instances d''équipement supprimées: % lignes', (SELECT COUNT(*) FROM equipment_instances);

-- 2. REMISE EN DISPONIBILITÉ DE TOUT LE MATÉRIEL

-- Remettre tous les équipements disponibles
UPDATE equipment
SET 
  status = 'available',
  available_quantity = total_quantity,
  last_maintenance = NULL;

RAISE NOTICE 'Tous les équipements remis en disponibilité: % lignes mises à jour', 
  (SELECT COUNT(*) FROM equipment WHERE status = 'available');

-- 3. RÉINITIALISATION DES COMPTEURS ET SEQUENCES

-- Réinitialiser les séquences si elles existent
DO $$
DECLARE
  seq_name TEXT;
BEGIN
  -- Réinitialiser la séquence des bons de livraison si elle existe
  FOR seq_name IN 
    SELECT sequence_name 
    FROM information_schema.sequences 
    WHERE sequence_name LIKE '%delivery_note%' OR sequence_name LIKE '%bon%'
  LOOP
    EXECUTE 'ALTER SEQUENCE ' || seq_name || ' RESTART WITH 1';
    RAISE NOTICE 'Séquence % réinitialisée', seq_name;
  END LOOP;
END $$;

-- 4. NETTOYAGE DU CACHE ET NOTIFICATIONS

-- Supprimer les notifications stockées dans system_settings si elles existent
DELETE FROM system_settings WHERE id LIKE '%notification%' OR id LIKE '%cache%';

-- Ajouter un paramètre pour marquer la date de remise à zéro
INSERT INTO system_settings (id, value, description)
VALUES ('system_reset_date', NOW()::text, 'Date de remise à zéro du système pour la production')
ON CONFLICT (id) DO UPDATE
SET 
  value = NOW()::text, 
  updated_at = NOW(),
  description = 'Date de remise à zéro du système pour la production';

-- 5. RÉACTIVATION DES TRIGGERS

DO $$
BEGIN
  -- Réactiver les triggers sur les tables principales
  EXECUTE 'ALTER TABLE checkouts ENABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE delivery_notes ENABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE equipment ENABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE equipment_instances ENABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE equipment_maintenance ENABLE TRIGGER ALL';
  
  RAISE NOTICE 'Triggers réactivés';
END $$;

-- 6. RAPPORT FINAL

DO $$
DECLARE
  equipment_count INT;
  total_quantity_sum INT;
  user_count INT;
  category_count INT;
BEGIN
  -- Compter les équipements
  SELECT COUNT(*), SUM(total_quantity) 
  INTO equipment_count, total_quantity_sum
  FROM equipment;
  
  -- Compter les utilisateurs
  SELECT COUNT(*) INTO user_count FROM users;
  
  -- Compter les catégories
  SELECT COUNT(*) INTO category_count FROM categories;
  
  RAISE NOTICE '========== RAPPORT DE REMISE À ZÉRO ==========';
  RAISE NOTICE 'Équipements conservés: % (% unités total)', equipment_count, total_quantity_sum;
  RAISE NOTICE 'Utilisateurs conservés: %', user_count;
  RAISE NOTICE 'Catégories conservées: %', category_count;
  RAISE NOTICE 'Emprunts supprimés: TOUS';
  RAISE NOTICE 'Bons de livraison supprimés: TOUS';
  RAISE NOTICE 'Maintenances supprimées: TOUTES';
  RAISE NOTICE 'Instances d''équipement supprimées: TOUTES';
  RAISE NOTICE 'Statut: Tous les équipements sont maintenant DISPONIBLES';
  RAISE NOTICE '=============================================';
END $$;

-- Mettre à jour les statistiques des tables pour optimiser les performances
ANALYZE equipment;
ANALYZE checkouts;
ANALYZE delivery_notes;
ANALYZE equipment_maintenance;
ANALYZE equipment_instances; 