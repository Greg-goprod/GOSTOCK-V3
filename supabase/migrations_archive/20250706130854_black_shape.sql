/*
  # Amélioration de l'affichage des images

  1. Ajout d'une fonction pour valider les URLs d'images
  2. Ajout d'un trigger pour vérifier les URLs d'images lors de l'insertion/mise à jour
  3. Mise à jour des URLs d'images par défaut pour les exemples
*/

-- Fonction pour valider les URLs d'images
CREATE OR REPLACE FUNCTION is_valid_image_url(url TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Vérifier si l'URL est null ou vide
  IF url IS NULL OR url = '' THEN
    RETURN TRUE; -- Permettre les URLs vides
  END IF;
  
  -- Vérifier si l'URL commence par http:// ou https://
  IF NOT (url LIKE 'http://%' OR url LIKE 'https://%') THEN
    RETURN FALSE;
  END IF;
  
  -- Vérifier si l'URL se termine par une extension d'image commune
  IF url ~* '\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$' THEN
    RETURN TRUE;
  END IF;
  
  -- Vérifier les domaines d'images courants
  IF url ~* '(pexels\.com|unsplash\.com|imgur\.com|cloudinary\.com|images\.com)' THEN
    RETURN TRUE;
  END IF;
  
  -- Par défaut, accepter l'URL
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour valider les URLs d'images
CREATE OR REPLACE FUNCTION validate_image_url()
RETURNS TRIGGER AS $$
BEGIN
  -- Vérifier si l'URL d'image est valide
  IF NEW.image_url IS NOT NULL AND NEW.image_url != '' AND NOT is_valid_image_url(NEW.image_url) THEN
    RAISE WARNING 'URL d''image potentiellement invalide: %', NEW.image_url;
    -- Ne pas bloquer l'opération, juste avertir
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger sur la table equipment
DROP TRIGGER IF EXISTS validate_image_url_trigger ON equipment;
CREATE TRIGGER validate_image_url_trigger
BEFORE INSERT OR UPDATE OF image_url ON equipment
FOR EACH ROW
EXECUTE FUNCTION validate_image_url();

-- Mettre à jour les URLs d'images par défaut pour les exemples
UPDATE equipment
SET image_url = 'https://images.pexels.com/photos/7974/pexels-photo.jpg'
WHERE image_url = 'https://images.pexels.com/photos/18105/pexels-photo.jpg';

UPDATE equipment
SET image_url = 'https://images.pexels.com/photos/162553/keys-workshop-mechanic-tools-162553.jpeg'
WHERE image_url = 'https://images.pexels.com/photos/1029243/pexels-photo-1029243.jpeg';

UPDATE equipment
SET image_url = 'https://images.pexels.com/photos/1957477/pexels-photo-1957477.jpeg'
WHERE image_url = 'https://images.pexels.com/photos/1957478/pexels-photo-1957478.jpeg';

-- Ajouter une colonne pour le cache d'image
ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS image_cache_key TEXT;

-- Fonction pour générer une clé de cache d'image
CREATE OR REPLACE FUNCTION generate_image_cache_key()
RETURNS TRIGGER AS $$
BEGIN
  -- Générer une clé de cache basée sur l'URL et un timestamp
  IF NEW.image_url IS NOT NULL AND NEW.image_url != '' THEN
    NEW.image_cache_key := encode(digest(NEW.image_url || now()::text, 'md5'), 'hex');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour générer la clé de cache
DROP TRIGGER IF EXISTS generate_image_cache_key_trigger ON equipment;
CREATE TRIGGER generate_image_cache_key_trigger
BEFORE INSERT OR UPDATE OF image_url ON equipment
FOR EACH ROW
EXECUTE FUNCTION generate_image_cache_key();

-- Mettre à jour les clés de cache pour les équipements existants
UPDATE equipment
SET image_cache_key = encode(digest(image_url || now()::text, 'md5'), 'hex')
WHERE image_url IS NOT NULL AND image_url != '';