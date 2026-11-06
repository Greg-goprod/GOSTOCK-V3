/*
  # Correction des politiques RLS et amélioration des performances de recherche
  
  1. Sécurité
    - Désactivation de RLS sur toutes les tables pour simplifier l'accès
    - Ajout de politiques pour l'accès anonyme et authentifié
  
  2. Fonctionnalités
    - Création d'une fonction pour récupérer les équipements perdus
  
  3. Performance
    - Création d'index standards pour améliorer les performances de recherche
    - Activation de l'extension pg_trgm pour la recherche textuelle
*/

-- Activer l'extension pg_trgm si elle n'est pas déjà activée
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Désactiver RLS sur toutes les tables
ALTER TABLE IF EXISTS departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS equipment DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS checkouts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS equipment_instances DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS delivery_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS status_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS role_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS equipment_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS equipment_subgroups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS maintenance_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS equipment_maintenance DISABLE ROW LEVEL SECURITY;

-- Ajouter des politiques pour l'accès anonyme et authentifié
DO $$
BEGIN
  -- Departments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'departments' AND policyname = 'departments_anon_policy'
  ) THEN
    CREATE POLICY "departments_anon_policy"
      ON departments
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'departments' AND policyname = 'departments_authenticated_policy'
  ) THEN
    CREATE POLICY "departments_authenticated_policy"
      ON departments
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Equipment
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'equipment' AND policyname = 'equipment_anon_policy'
  ) THEN
    CREATE POLICY "equipment_anon_policy"
      ON equipment
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'equipment' AND policyname = 'equipment_authenticated_policy'
  ) THEN
    CREATE POLICY "equipment_authenticated_policy"
      ON equipment
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Categories
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'categories' AND policyname = 'categories_anon_policy'
  ) THEN
    CREATE POLICY "categories_anon_policy"
      ON categories
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'categories' AND policyname = 'categories_authenticated_policy'
  ) THEN
    CREATE POLICY "categories_authenticated_policy"
      ON categories
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Suppliers
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suppliers' AND policyname = 'suppliers_anon_policy'
  ) THEN
    CREATE POLICY "suppliers_anon_policy"
      ON suppliers
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suppliers' AND policyname = 'suppliers_authenticated_policy'
  ) THEN
    CREATE POLICY "suppliers_authenticated_policy"
      ON suppliers
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Users
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND policyname = 'users_anon_policy'
  ) THEN
    CREATE POLICY "users_anon_policy"
      ON users
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Checkouts
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'checkouts' AND policyname = 'checkouts_anon_policy'
  ) THEN
    CREATE POLICY "checkouts_anon_policy"
      ON checkouts
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'checkouts' AND policyname = 'checkouts_authenticated_policy'
  ) THEN
    CREATE POLICY "checkouts_authenticated_policy"
      ON checkouts
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Equipment Instances
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'equipment_instances' AND policyname = 'equipment_instances_anon_policy'
  ) THEN
    CREATE POLICY "equipment_instances_anon_policy"
      ON equipment_instances
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'equipment_instances' AND policyname = 'equipment_instances_authenticated_policy'
  ) THEN
    CREATE POLICY "equipment_instances_authenticated_policy"
      ON equipment_instances
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Supprimer la fonction existante si elle existe
DROP FUNCTION IF EXISTS recover_lost_equipment(UUID);

-- Créer une fonction pour récupérer les équipements perdus
CREATE FUNCTION recover_lost_equipment(checkout_id UUID)
RETURNS VOID AS $$
DECLARE
  v_equipment_id UUID;
  v_current_available INT;
  v_total_quantity INT;
BEGIN
  -- Récupérer l'ID de l'équipement
  SELECT equipment_id INTO v_equipment_id
  FROM checkouts
  WHERE id = checkout_id;
  
  -- Mettre à jour le statut du checkout
  UPDATE checkouts
  SET status = 'returned',
      return_date = NOW(),
      notes = COALESCE(notes, '') || E'\nMatériel retrouvé le ' || TO_CHAR(NOW(), 'DD/MM/YYYY')
  WHERE id = checkout_id;
  
  -- Récupérer les quantités actuelles
  SELECT available_quantity, total_quantity INTO v_current_available, v_total_quantity
  FROM equipment
  WHERE id = v_equipment_id;
  
  -- Mettre à jour l'équipement
  UPDATE equipment
  SET available_quantity = v_current_available + 1,
      status = CASE 
                WHEN (v_current_available + 1) >= v_total_quantity THEN 'available'
                ELSE 'checked-out'
              END
  WHERE id = v_equipment_id;
END;
$$ LANGUAGE plpgsql;

-- Ajouter des index spécifiques pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_equipment_article_number ON equipment(article_number);
CREATE INDEX IF NOT EXISTS idx_equipment_instances_qr_code ON equipment_instances(qr_code);

-- Index pour la recherche textuelle avec pg_trgm
-- Utilisation de la syntaxe correcte pour les index gin_trgm_ops
CREATE INDEX IF NOT EXISTS idx_equipment_name_trgm ON equipment USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_equipment_serial_number_trgm ON equipment USING gin (serial_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_equipment_article_number_trgm ON equipment USING gin (article_number gin_trgm_ops);

-- Mettre à jour les statistiques pour améliorer les performances
ANALYZE equipment;
ANALYZE equipment_instances;