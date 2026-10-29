/*
  # Correction des fonctions de gestion des instances d'équipement

  1. Nouvelles fonctions
    - `generate_equipment_instances_fixed` - Version corrigée de la fonction pour générer des instances d'équipement
    - `sync_equipment_instances_fixed` - Version corrigée du trigger pour synchroniser les instances

  2. Changements
    - Suppression des anciennes fonctions et triggers
    - Création de nouvelles fonctions avec des noms différents pour éviter les conflits
    - Correction du problème de paramètre dans la fonction generate_equipment_instances
*/

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS sync_equipment_instances_trigger ON equipment;

-- Supprimer l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS sync_equipment_instances();
DROP FUNCTION IF EXISTS generate_equipment_instances(UUID);

-- Fonction corrigée pour générer des instances pour l'équipement
CREATE OR REPLACE FUNCTION generate_equipment_instances_fixed(equipment_id_param UUID)
RETURNS VOID AS $$
DECLARE
  v_equipment RECORD;
  v_instance_count INT;
  v_instances_to_create INT;
  v_article_number TEXT;
BEGIN
  -- Get equipment details
  SELECT id, article_number, serial_number, total_quantity, qr_type
  INTO v_equipment
  FROM equipment
  WHERE id = equipment_id_param;
  
  -- Only proceed for individual QR type
  IF v_equipment.qr_type != 'individual' THEN
    RETURN;
  END IF;
  
  -- Count existing instances
  SELECT COUNT(*)
  INTO v_instance_count
  FROM equipment_instances
  WHERE equipment_id = equipment_id_param;
  
  -- Calculate how many instances to create
  v_instances_to_create := v_equipment.total_quantity - v_instance_count;
  
  -- If we need to create instances
  IF v_instances_to_create > 0 THEN
    -- Use article number if available, otherwise use serial number
    v_article_number := COALESCE(v_equipment.article_number, v_equipment.serial_number);
    
    -- Create instances
    FOR i IN 1..v_instances_to_create LOOP
      INSERT INTO equipment_instances (
        equipment_id,
        instance_number,
        qr_code,
        status
      ) VALUES (
        equipment_id_param,
        v_instance_count + i,
        v_article_number || '-' || LPAD((v_instance_count + i)::TEXT, 3, '0'),
        'available'
      );
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Fonction corrigée pour synchroniser les instances d'équipement
CREATE OR REPLACE FUNCTION sync_equipment_instances_fixed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed for individual QR type
  IF NEW.qr_type = 'individual' THEN
    -- If total quantity changed or QR type changed
    IF (OLD.total_quantity != NEW.total_quantity) OR (OLD.qr_type != NEW.qr_type) THEN
      -- Generate instances
      PERFORM generate_equipment_instances_fixed(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer un nouveau trigger pour les mises à jour d'équipement
CREATE TRIGGER sync_equipment_instances_trigger
AFTER UPDATE OF total_quantity, qr_type ON equipment
FOR EACH ROW
EXECUTE FUNCTION sync_equipment_instances_fixed();

-- Mettre à jour les instances d'équipement existantes
DO $$
DECLARE
  eq RECORD;
BEGIN
  -- Pour chaque équipement avec QR type individuel
  FOR eq IN 
    SELECT id 
    FROM equipment 
    WHERE qr_type = 'individual'
  LOOP
    -- Générer les instances
    PERFORM generate_equipment_instances_fixed(eq.id);
  END LOOP;
END $$;