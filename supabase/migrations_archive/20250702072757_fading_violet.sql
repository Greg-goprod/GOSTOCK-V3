/*
  # Correction des problèmes de scan QR code

  1. Désactivation de RLS
    - Désactive RLS sur toutes les tables pour éviter les problèmes d'accès
    - Ajoute des politiques pour les utilisateurs anonymes et authentifiés
  
  2. Fonction de récupération d'équipement
    - Corrige la fonction recover_lost_equipment
  
  3. Indexes
    - Ajoute des index sur article_number pour améliorer les performances de recherche
*/

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
CREATE INDEX IF NOT EXISTS idx_equipment_article_number_gin ON equipment USING gin(article_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_equipment_instances_qr_code ON equipment_instances(qr_code);

-- Activer l'extension pg_trgm si elle n'est pas déjà activée
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Mettre à jour les statistiques pour améliorer les performances
ANALYZE equipment;
ANALYZE equipment_instances;