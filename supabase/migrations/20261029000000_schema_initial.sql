/*
  GO-Mat — schéma initial (remplace les 79 migrations archivées dans supabase/migrations_archive/)

  Reconstruit à partir des anciennes migrations, rejouées dans l'ordre et testées sur une base neuve.
  Corrections apportées par rapport à l'historique :
    - vues checkout_status_view / equipment_status_view : vues classiques au lieu de vues
      matérialisées (le rafraîchissement exigeait d'en être propriétaire : toute sortie/retour échouait)
    - check_equipment_availability : colonne ambiguë corrigée (le scan d'ajout en sortie échouait)
    - numéros de bon : format DNaamm-0001 (au lieu de « DNyymm-aamm-0001 »)
    - equipment.short_title et checkouts.instance_id ajoutées (utilisées par l'app, absentes des migrations)
    - users.department : facultatif et libre (l'app le saisit en texte libre)
    - RLS activée sur toutes les tables
    - get_equipment_with_status supprimée (cassée et inutilisée)
    - migration de remise à zéro (reset_system_for_production) non reprise

  ⚠️ Les règles RLS restent ouvertes au rôle anon tant que l'app n'a pas d'authentification.

  Utilisation : coller ce fichier dans Supabase → SQL Editor → Run, sur un projet neuf.
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: check_equipment_availability(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_equipment_availability(equipment_id uuid, requested_quantity integer DEFAULT 1) RETURNS TABLE(is_available boolean, available_quantity integer, status text, message text)
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_equipment RECORD;
  v_maintenance_count INT;
BEGIN
  -- Récupérer les informations de l'équipement
  SELECT e.available_quantity, e.total_quantity, e.status, e.name
  INTO v_equipment
  FROM equipment e
  WHERE e.id = equipment_id;
  
  -- Vérifier s'il y a une maintenance en cours
  SELECT COUNT(*)
  INTO v_maintenance_count
  FROM equipment_maintenance em
  WHERE em.equipment_id = check_equipment_availability.equipment_id 
    AND em.status = 'in_progress';
  
  -- Déterminer la disponibilité
  IF v_equipment.status = 'retired' THEN
    RETURN QUERY SELECT 
      FALSE, 
      COALESCE(v_equipment.available_quantity, 0),
      v_equipment.status,
      'Équipement retiré du service'::TEXT;
  ELSIF v_equipment.status = 'maintenance' OR v_maintenance_count > 0 THEN
    RETURN QUERY SELECT 
      FALSE, 
      COALESCE(v_equipment.available_quantity, 0),
      v_equipment.status,
      'Équipement en maintenance'::TEXT;
  ELSIF COALESCE(v_equipment.available_quantity, 0) < requested_quantity THEN
    RETURN QUERY SELECT 
      FALSE, 
      COALESCE(v_equipment.available_quantity, 0),
      v_equipment.status,
      FORMAT('Quantité insuffisante (disponible: %s, demandée: %s)', 
             COALESCE(v_equipment.available_quantity, 0), 
             requested_quantity)::TEXT;
  ELSE
    RETURN QUERY SELECT 
      TRUE, 
      COALESCE(v_equipment.available_quantity, 0),
      v_equipment.status,
      'Équipement disponible'::TEXT;
  END IF;
END;
$$;


--
-- Name: checkout_equipment(uuid, uuid, uuid, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.checkout_equipment(p_equipment_id uuid, p_user_id uuid, p_delivery_note_id uuid, p_due_date timestamp with time zone, p_notes text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_checkout_id UUID;
  v_available_quantity INTEGER;
BEGIN
  -- Vérifier la disponibilité de l'équipement
  SELECT calculated_available_quantity INTO v_available_quantity
  FROM equipment_status_view
  WHERE id = p_equipment_id;
  
  IF v_available_quantity <= 0 THEN
    RAISE EXCEPTION 'Équipement non disponible';
  END IF;
  
  -- Créer l'emprunt
  INSERT INTO checkouts (
    equipment_id,
    user_id,
    delivery_note_id,
    checkout_date,
    due_date,
    status,
    notes
  ) VALUES (
    p_equipment_id,
    p_user_id,
    p_delivery_note_id,
    CURRENT_TIMESTAMP,
    p_due_date,
    'active',
    p_notes
  ) RETURNING id INTO v_checkout_id;
  
  -- Rafraîchir les vues
  PERFORM refresh_all_status_views();
  
  RETURN v_checkout_id;
END;
$$;


--
-- Name: force_update_overdue_checkouts(timestamp without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.force_update_overdue_checkouts(reference_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Mettre à jour les emprunts en retard en fonction de la date de référence
  -- Nous comparons uniquement les dates sans tenir compte de l'heure
  UPDATE checkouts
  SET status = 'overdue'
  WHERE 
    status = 'active' AND 
    DATE(due_date) < DATE(reference_timestamp); -- La date d'échéance est strictement antérieure à la date de référence
    
  -- Mettre à jour le statut des bons de livraison en fonction des emprunts
  WITH checkout_counts AS (
    SELECT 
      delivery_note_id,
      COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
      COUNT(*) FILTER (WHERE status = 'returned') AS returned_count,
      COUNT(*) AS total_count
    FROM checkouts
    WHERE delivery_note_id IS NOT NULL
    GROUP BY delivery_note_id
  )
  UPDATE delivery_notes dn
  SET status = 
    CASE 
      WHEN cc.overdue_count > 0 THEN 'overdue'
      WHEN cc.returned_count = cc.total_count THEN 'returned'
      WHEN cc.returned_count > 0 AND cc.returned_count < cc.total_count THEN 'partial'
      ELSE 'active'
    END
  FROM checkout_counts cc
  WHERE dn.id = cc.delivery_note_id;
  
  -- Retourner le nombre d'emprunts mis à jour
  RAISE NOTICE 'Emprunts mis à jour avec la date de référence: %', reference_timestamp;
END;
$$;


--
-- Name: generate_article_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_article_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  new_number text;
  counter integer;
  prefix text;
BEGIN
  -- Récupérer le préfixe depuis les paramètres
  SELECT value INTO prefix FROM system_settings WHERE id = 'article_prefix';
  IF prefix IS NULL THEN
    prefix := 'GOMAT';
  END IF;
  
  -- Générer un numéro d'article au format PREFIX-YYYYMMDD-XXXX
  SELECT COALESCE(MAX(CAST(SUBSTRING(article_number FROM prefix || '-\d{8}-(\d{4})') AS integer)), 0) + 1
  INTO counter
  FROM equipment
  WHERE article_number LIKE prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_number := prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::text, 4, '0');
  
  RETURN new_number;
END;
$$;


--
-- Name: generate_delivery_note_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_delivery_note_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  new_number text;
  counter integer;
  prefix text;
BEGIN
  -- Récupérer le préfixe depuis les paramètres système
  SELECT value INTO prefix FROM system_settings WHERE id = 'article_prefix';
  IF prefix IS NULL THEN
    prefix := 'GOMAT';
  END IF;
  
  -- Générer un numéro de bon au format PREFIX-BON-YYYYMMDD-XXXX
  SELECT COALESCE(MAX(CAST(SUBSTRING(note_number FROM prefix || '-BON-\d{8}-(\d{4})') AS integer)), 0) + 1
  INTO counter
  FROM delivery_notes
  WHERE note_number LIKE prefix || '-BON-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_number := prefix || '-BON-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::text, 4, '0');
  
  RETURN new_number;
END;
$$;


--
-- Name: generate_equipment_instances_fixed(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_equipment_instances_fixed(equipment_id_param uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: generate_image_cache_key(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_image_cache_key() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Générer une clé de cache basée sur l'URL et un timestamp
  IF NEW.image_url IS NOT NULL AND NEW.image_url != '' THEN
    NEW.image_cache_key := encode(digest(NEW.image_url || now()::text, 'md5'), 'hex');
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: get_checkout_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_checkout_status(checkout_id uuid) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  status TEXT;
BEGIN
  -- Rafraîchir la vue pour s'assurer que les données sont à jour
  PERFORM refresh_checkout_status_view();
  
  -- Récupérer le statut calculé
  SELECT calculated_status INTO status
  FROM checkout_status_view
  WHERE id = checkout_id;
  
  RETURN status;
END;
$$;


--
-- Name: get_checkouts_with_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_checkouts_with_status() RETURNS TABLE(id uuid, equipment_id uuid, user_id uuid, delivery_note_id uuid, checkout_date timestamp with time zone, due_date timestamp with time zone, return_date timestamp with time zone, notes text, status text, equipment_name text, total_quantity integer, available_quantity integer, first_name text, last_name text)
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Rafraîchir la vue pour s'assurer que les données sont à jour
  PERFORM refresh_checkout_status_view();
  
  -- Retourner les données de la vue
  RETURN QUERY SELECT 
    csv.id,
    csv.equipment_id,
    csv.user_id,
    csv.delivery_note_id,
    csv.checkout_date,
    csv.due_date,
    csv.return_date,
    csv.notes,
    csv.calculated_status,
    csv.equipment_name,
    csv.total_quantity,
    csv.available_quantity,
    csv.first_name,
    csv.last_name
  FROM 
    checkout_status_view csv
  ORDER BY 
    csv.checkout_date DESC;
END;
$$;


--
-- Name: get_equipment_available_quantity(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_equipment_available_quantity(equipment_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  quantity INTEGER;
BEGIN
  -- Rafraîchir la vue pour s'assurer que les données sont à jour
  PERFORM refresh_equipment_status_view();
  
  -- Récupérer la quantité disponible calculée
  SELECT calculated_available_quantity INTO quantity
  FROM equipment_status_view
  WHERE id = equipment_id;
  
  RETURN quantity;
END;
$$;


--
-- Name: get_equipment_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_equipment_status(equipment_id uuid) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  status TEXT;
BEGIN
  -- Rafraîchir la vue pour s'assurer que les données sont à jour
  PERFORM refresh_equipment_status_view();
  
  -- Récupérer le statut calculé
  SELECT calculated_status INTO status
  FROM equipment_status_view
  WHERE id = equipment_id;
  
  RETURN status;
END;
$$;


--
-- Name: get_status_badge_text(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_status_badge_text(p_status text, p_available_quantity integer, p_total_quantity integer) RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF p_status = 'available' THEN
    -- For available status, show available/total
    IF p_total_quantity = 0 THEN
      RETURN '0/0';
    ELSE
      RETURN p_available_quantity || '/' || p_total_quantity;
    END IF;
  ELSE
    -- For other statuses, just show the status name
    RETURN p_status;
  END IF;
END;
$$;


--
-- Name: is_valid_image_url(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_valid_image_url(url text) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$
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
$_$;


--
-- Name: mark_equipment_lost(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_equipment_lost(checkout_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_equipment_id UUID;
  v_current_available INT;
  v_total_quantity INT;
BEGIN
  -- Récupérer l'ID de l'équipement
  SELECT equipment_id INTO v_equipment_id
  FROM checkouts
  WHERE id = checkout_id;
  
  -- Récupérer les quantités actuelles
  SELECT available_quantity, total_quantity 
  INTO v_current_available, v_total_quantity
  FROM equipment
  WHERE id = v_equipment_id;
  
  -- Mettre à jour le checkout comme perdu
  UPDATE checkouts
  SET 
    status = 'lost',
    notes = COALESCE(notes, '') || E'\nMatériel déclaré perdu le ' || TO_CHAR(NOW(), 'DD/MM/YYYY')
  WHERE id = checkout_id;
  
  -- Décrémenter total_quantity car l'équipement est définitivement perdu
  -- Note: on ne touche pas available_quantity car l'équipement était déjà sorti
  UPDATE equipment
  SET 
    total_quantity = GREATEST(1, COALESCE(v_total_quantity, 1) - 1),
    status = CASE 
      WHEN COALESCE(v_current_available, 0) > 0 THEN 'available'
      WHEN COALESCE(v_current_available, 0) = 0 AND GREATEST(1, COALESCE(v_total_quantity, 1) - 1) > 0 THEN 'checked-out'
      ELSE 'retired'
    END
  WHERE id = v_equipment_id;
END;
$$;


--
-- Name: mark_equipment_lost(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_equipment_lost(p_checkout_id uuid, p_notes text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Mettre à jour l'emprunt
  UPDATE checkouts
  SET 
    status = 'lost',
    notes = CASE 
      WHEN p_notes IS NOT NULL THEN 
        CASE 
          WHEN notes IS NOT NULL THEN notes || E'\n' || 'Perdu: ' || p_notes
          ELSE 'Perdu: ' || p_notes
        END
      ELSE 
        CASE 
          WHEN notes IS NOT NULL THEN notes || E'\n' || 'Marqué comme perdu'
          ELSE 'Marqué comme perdu'
        END
    END
  WHERE 
    id = p_checkout_id AND
    status IN ('active', 'overdue');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Emprunt non trouvé ou déjà retourné/perdu';
  END IF;
  
  -- Rafraîchir les vues
  PERFORM refresh_all_status_views();
  
  RETURN TRUE;
END;
$$;


--
-- Name: recover_lost_equipment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recover_lost_equipment(checkout_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_equipment_id UUID;
  v_available_quantity INT;
  v_total_quantity INT;
  v_new_status TEXT;
BEGIN
  -- Récupérer l'ID de l'équipement
  SELECT equipment_id INTO v_equipment_id
  FROM checkouts
  WHERE id = checkout_id;
  
  -- Mettre à jour le checkout comme retourné
  UPDATE checkouts
  SET 
    status = 'returned',
    return_date = NOW(),
    notes = COALESCE(notes, '') || E'\nMatériel retrouvé le ' || TO_CHAR(NOW(), 'DD/MM/YYYY')
  WHERE id = checkout_id;
  
  -- Récupérer les quantités actuelles
  SELECT 
    available_quantity, 
    total_quantity 
  INTO 
    v_available_quantity, 
    v_total_quantity
  FROM equipment
  WHERE id = v_equipment_id;
  
  -- Incrémenter available_quantity ET total_quantity (car l'équipement revient dans le stock)
  v_available_quantity := COALESCE(v_available_quantity, 0) + 1;
  v_total_quantity := COALESCE(v_total_quantity, 1) + 1;
  
  -- Déterminer le nouveau statut
  IF v_available_quantity >= v_total_quantity THEN
    v_new_status := 'available';
  ELSE
    v_new_status := 'checked-out';
  END IF;
  
  -- Mettre à jour l'équipement
  UPDATE equipment
  SET 
    status = v_new_status,
    available_quantity = v_available_quantity,
    total_quantity = v_total_quantity
  WHERE id = v_equipment_id;
  
  -- Mettre à jour le statut du bon de livraison si nécessaire
  WITH checkout_counts AS (
    SELECT 
      delivery_note_id,
      COUNT(*) FILTER (WHERE status = 'returned') AS returned_count,
      COUNT(*) AS total_count
    FROM checkouts
    WHERE delivery_note_id = (SELECT delivery_note_id FROM checkouts WHERE id = checkout_id)
    GROUP BY delivery_note_id
  )
  UPDATE delivery_notes dn
  SET status = 
    CASE 
      WHEN cc.returned_count = cc.total_count THEN 'returned'
      WHEN cc.returned_count > 0 AND cc.returned_count < cc.total_count THEN 'partial'
      ELSE dn.status
    END
  FROM checkout_counts cc
  WHERE dn.id = cc.delivery_note_id;
END;
$$;


--
-- Name: refresh_all_status_views(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_all_status_views() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM refresh_checkout_status_view();
  PERFORM refresh_equipment_status_view();
END;
$$;


--
-- Name: refresh_checkout_status_view(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_checkout_status_view() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Vue classique : toujours à jour, rien à rafraîchir.
  NULL;
END;
$$;


--
-- Name: refresh_checkout_status_view_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_checkout_status_view_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM refresh_checkout_status_view();
  RETURN NULL;
END;
$$;


--
-- Name: refresh_equipment_status_view(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_equipment_status_view() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Vue classique : toujours à jour, rien à rafraîchir.
  NULL;
END;
$$;


--
-- Name: refresh_equipment_status_view_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_equipment_status_view_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM refresh_equipment_status_view();
  RETURN NULL;
END;
$$;


--
-- Name: return_equipment(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.return_equipment(p_checkout_id uuid, p_notes text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Mettre à jour l'emprunt
  UPDATE checkouts
  SET 
    status = 'returned',
    return_date = CURRENT_TIMESTAMP,
    notes = CASE 
      WHEN p_notes IS NOT NULL THEN 
        CASE 
          WHEN notes IS NOT NULL THEN notes || E'\n' || p_notes
          ELSE p_notes
        END
      ELSE notes
    END
  WHERE 
    id = p_checkout_id AND
    status IN ('active', 'overdue');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Emprunt non trouvé ou déjà retourné';
  END IF;
  
  -- Rafraîchir les vues
  PERFORM refresh_all_status_views();
  
  RETURN TRUE;
END;
$$;


--
-- Name: set_article_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_article_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  prefix TEXT;
  year_date TEXT;
  next_number INT;
BEGIN
  -- Get the prefix from system settings or use default
  SELECT COALESCE(value, 'ART') INTO prefix
  FROM system_settings
  WHERE id = 'article_prefix';
  
  -- Format: ART-yyyymmdd-xxxx (e.g., ART-20230615-0001)
  year_date := TO_CHAR(CURRENT_DATE, 'yyyymmdd');
  
  -- Get the next number for this date
  SELECT COALESCE(MAX(CAST(SUBSTRING(article_number FROM LENGTH(prefix || '-' || year_date || '-') + 1) AS INTEGER)), 0) + 1
  INTO next_number
  FROM equipment
  WHERE article_number LIKE (prefix || '-' || year_date || '-%');
  
  -- Set the article number
  NEW.article_number := prefix || '-' || year_date || '-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN NEW;
END;
$$;


--
-- Name: set_delivery_note_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_delivery_note_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  year_month TEXT;
  next_number INT;
  note_prefix TEXT := 'DN';
BEGIN
  -- Format: DNyymm-xxxx (e.g., DN2306-0001)
  year_month := TO_CHAR(CURRENT_DATE, 'yymm');
  
  -- Get the next number for this month
  SELECT COALESCE(MAX(CAST(SUBSTRING(note_number FROM LENGTH(note_prefix || year_month || '-') + 1) AS INTEGER)), 0) + 1
  INTO next_number
  FROM delivery_notes
  WHERE note_number LIKE (note_prefix || year_month || '-%');
  
  -- Set the note number
  NEW.note_number := note_prefix || year_month || '-' || LPAD(next_number::TEXT, 4, '0');
  
  -- Set the QR code if not already set
  IF NEW.qr_code IS NULL THEN
    NEW.qr_code := 'DN-' || NEW.note_number;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: sync_equipment_instances_fixed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_equipment_instances_fixed() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: update_delivery_note_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_delivery_note_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_delivery_note_id UUID;
  v_active_count INT;
  v_returned_count INT;
  v_total_count INT;
  v_new_status TEXT;
BEGIN
  -- Get the delivery note ID
  IF NEW.delivery_note_id IS NOT NULL THEN
    v_delivery_note_id := NEW.delivery_note_id;
  ELSIF OLD.delivery_note_id IS NOT NULL THEN
    v_delivery_note_id := OLD.delivery_note_id;
  ELSE
    RETURN NEW;
  END IF;
  
  -- Count checkouts by status
  SELECT 
    COUNT(*) FILTER (WHERE status = 'active' OR status = 'overdue'),
    COUNT(*) FILTER (WHERE status = 'returned'),
    COUNT(*)
  INTO 
    v_active_count,
    v_returned_count,
    v_total_count
  FROM checkouts
  WHERE delivery_note_id = v_delivery_note_id;
  
  -- Determine new status
  IF v_returned_count = v_total_count THEN
    v_new_status := 'returned';
  ELSIF v_returned_count > 0 AND v_active_count > 0 THEN
    v_new_status := 'partial';
  ELSIF v_active_count = v_total_count THEN
    -- Check if any are overdue
    IF EXISTS (
      SELECT 1 FROM checkouts 
      WHERE delivery_note_id = v_delivery_note_id 
      AND status = 'overdue'
    ) THEN
      v_new_status := 'overdue';
    ELSE
      v_new_status := 'active';
    END IF;
  ELSE
    v_new_status := 'active'; -- Default
  END IF;
  
  -- Update the delivery note status
  UPDATE delivery_notes
  SET status = v_new_status
  WHERE id = v_delivery_note_id;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_delivery_note_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_delivery_note_status(checkout_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_delivery_note_id uuid;
  v_total_items integer;
  v_returned_items integer;
  v_note_status text;
BEGIN
  -- Get the delivery note ID
  SELECT delivery_note_id INTO v_delivery_note_id
  FROM checkouts
  WHERE id = checkout_id;
  
  -- If there's no delivery note, exit
  IF v_delivery_note_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Count total and returned items for this delivery note
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned
  INTO v_total_items, v_returned_items
  FROM checkouts 
  WHERE delivery_note_id = v_delivery_note_id;
  
  -- Determine the new status
  IF v_returned_items = 0 THEN
    v_note_status := 'active';
  ELSIF v_returned_items = v_total_items THEN
    v_note_status := 'returned';
  ELSE
    v_note_status := 'partial';
  END IF;
  
  -- Check if overdue
  IF v_note_status IN ('active', 'partial') THEN
    SELECT CASE 
      WHEN due_date < NOW() THEN 'overdue'
      ELSE v_note_status
    END INTO v_note_status
    FROM delivery_notes 
    WHERE id = v_delivery_note_id;
  END IF;
  
  -- Update the delivery note status
  UPDATE delivery_notes 
  SET 
    status = v_note_status,
    updated_at = NOW()
  WHERE id = v_delivery_note_id;
END;
$$;


--
-- Name: update_equipment_availability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_equipment_availability() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  eq RECORD;
  active_count INT;
BEGIN
  -- Pour chaque équipement
  FOR eq IN SELECT id, total_quantity FROM equipment LOOP
    -- Compter les emprunts actifs, en retard et perdus
    SELECT COUNT(*) INTO active_count
    FROM checkouts
    WHERE equipment_id = eq.id AND (status = 'active' OR status = 'overdue' OR status = 'lost');
    
    -- Mettre à jour la quantité disponible
    UPDATE equipment
    SET 
      available_quantity = GREATEST(total_quantity - active_count, 0),
      status = CASE 
        WHEN total_quantity - active_count <= 0 THEN 'checked-out'
        ELSE 'available'
      END
    WHERE id = eq.id;
  END LOOP;
END;
$$;


--
-- Name: update_equipment_status_on_maintenance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_equipment_status_on_maintenance() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_current_available INT;
  v_total_quantity INT;
  v_equipment_status TEXT;
BEGIN
  -- Récupérer les informations actuelles de l'équipement
  SELECT available_quantity, total_quantity, status 
  INTO v_current_available, v_total_quantity, v_equipment_status
  FROM equipment 
  WHERE id = NEW.equipment_id;

  -- Si maintenance commence (in_progress)
  IF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status != 'in_progress') THEN
    -- Si l'équipement n'était pas déjà en maintenance ou emprunté
    IF v_equipment_status NOT IN ('maintenance', 'checked-out') THEN
      -- Décrémenter available_quantity de 1 (une unité part en maintenance)
      UPDATE equipment
      SET 
        status = 'maintenance',
        available_quantity = GREATEST(0, COALESCE(v_current_available, 0) - 1)
      WHERE id = NEW.equipment_id;
    ELSE
      -- Si déjà en maintenance ou emprunté, juste mettre à jour le statut
      UPDATE equipment
      SET status = 'maintenance'
      WHERE id = NEW.equipment_id;
    END IF;

  -- Si maintenance terminée (completed)
  ELSIF NEW.status = 'completed' AND OLD.status = 'in_progress' THEN
    -- Incrémenter available_quantity de 1 (une unité revient de maintenance)
    UPDATE equipment
    SET 
      status = CASE 
        WHEN (COALESCE(v_current_available, 0) + 1) >= COALESCE(v_total_quantity, 1) THEN 'available'
        ELSE 'checked-out'
      END,
      available_quantity = LEAST(COALESCE(v_total_quantity, 1), COALESCE(v_current_available, 0) + 1),
      last_maintenance = NEW.end_date
    WHERE id = NEW.equipment_id;

  -- Si maintenance annulée (cancelled)
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'in_progress' THEN
    -- Incrémenter available_quantity de 1 (une unité revient de maintenance)
    UPDATE equipment
    SET 
      status = CASE 
        WHEN (COALESCE(v_current_available, 0) + 1) >= COALESCE(v_total_quantity, 1) THEN 'available'
        ELSE 'checked-out'
      END,
      available_quantity = LEAST(COALESCE(v_total_quantity, 1), COALESCE(v_current_available, 0) + 1)
    WHERE id = NEW.equipment_id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_overdue_checkouts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_overdue_checkouts() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update checkouts to overdue status when due date has passed (dès 00h01 le lendemain)
  -- Nous comparons uniquement les dates sans tenir compte de l'heure
  UPDATE checkouts
  SET status = 'overdue'
  WHERE 
    status = 'active' AND 
    DATE(due_date) < CURRENT_DATE; -- La date d'échéance est strictement antérieure à la date actuelle
    
  -- Update delivery notes status based on checkouts
  WITH checkout_counts AS (
    SELECT 
      delivery_note_id,
      COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
      COUNT(*) FILTER (WHERE status = 'returned') AS returned_count,
      COUNT(*) AS total_count
    FROM checkouts
    WHERE delivery_note_id IS NOT NULL
    GROUP BY delivery_note_id
  )
  UPDATE delivery_notes dn
  SET status = 
    CASE 
      WHEN cc.overdue_count > 0 THEN 'overdue'
      WHEN cc.returned_count = cc.total_count THEN 'returned'
      WHEN cc.returned_count > 0 AND cc.returned_count < cc.total_count THEN 'partial'
      ELSE 'active'
    END
  FROM checkout_counts cc
  WHERE dn.id = cc.delivery_note_id;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: validate_image_url(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_image_url() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Vérifier si l'URL d'image est valide
  IF NEW.image_url IS NOT NULL AND NEW.image_url != '' AND NOT is_valid_image_url(NEW.image_url) THEN
    RAISE WARNING 'URL d''image potentiellement invalide: %', NEW.image_url;
    -- Ne pas bloquer l'opération, juste avertir
  END IF;
  
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    color text DEFAULT '#64748b'::text
);


--
-- Name: checkouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkouts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    equipment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    checkout_date timestamp with time zone DEFAULT now() NOT NULL,
    due_date timestamp with time zone NOT NULL,
    return_date timestamp with time zone,
    status text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    delivery_note_id uuid,
    instance_id uuid,
    CONSTRAINT checkouts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'returned'::text, 'overdue'::text, 'lost'::text])))
);


--
-- Name: equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    category_id uuid,
    serial_number text NOT NULL,
    status text NOT NULL,
    added_date timestamp with time zone DEFAULT now(),
    last_maintenance timestamp with time zone,
    image_url text,
    supplier_id uuid,
    location text,
    created_at timestamp with time zone DEFAULT now(),
    article_number text,
    qr_type text DEFAULT 'individual'::text,
    total_quantity integer DEFAULT 1,
    available_quantity integer DEFAULT 1 NOT NULL,
    group_id uuid,
    subgroup_id uuid,
    image_cache_key text,
    short_title text,
    CONSTRAINT equipment_qr_type_check CHECK ((qr_type = ANY (ARRAY['individual'::text, 'batch'::text]))),
    CONSTRAINT equipment_status_check CHECK ((status = ANY (ARRAY['available'::text, 'checked-out'::text, 'maintenance'::text, 'retired'::text, 'lost'::text])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    email text NOT NULL,
    phone text,
    department text,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    first_name text NOT NULL,
    last_name text NOT NULL,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'user'::text, 'technician'::text])))
);


--
-- Name: checkout_status_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.checkout_status_view WITH (security_invoker = true) AS
 SELECT c.id,
    c.equipment_id,
    c.user_id,
    c.delivery_note_id,
    c.checkout_date,
    c.due_date,
    c.return_date,
    c.notes,
        CASE
            WHEN (c.return_date IS NOT NULL) THEN 'returned'::text
            WHEN (c.status = 'lost'::text) THEN 'lost'::text
            WHEN (((c.due_date + '1 day'::interval) < CURRENT_TIMESTAMP) AND (c.return_date IS NULL)) THEN 'overdue'::text
            ELSE 'active'::text
        END AS calculated_status,
    e.name AS equipment_name,
    e.total_quantity,
    e.available_quantity,
    u.first_name,
    u.last_name
   FROM ((public.checkouts c
     JOIN public.equipment e ON ((c.equipment_id = e.id)))
     JOIN public.users u ON ((c.user_id = u.id)));


--
-- Name: delivery_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    note_number text NOT NULL,
    user_id uuid NOT NULL,
    issue_date timestamp with time zone DEFAULT now() NOT NULL,
    due_date timestamp with time zone NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    qr_code text,
    CONSTRAINT delivery_notes_status_check CHECK ((status = ANY (ARRAY['active'::text, 'returned'::text, 'partial'::text, 'overdue'::text])))
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#64748b'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: equipment_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#64748b'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: equipment_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    equipment_id uuid,
    instance_number integer NOT NULL,
    qr_code text NOT NULL,
    status text DEFAULT 'available'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT equipment_instances_status_check CHECK ((status = ANY (ARRAY['available'::text, 'checked-out'::text, 'maintenance'::text, 'retired'::text])))
);


--
-- Name: equipment_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_maintenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    equipment_id uuid NOT NULL,
    maintenance_type_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    start_date timestamp with time zone DEFAULT now() NOT NULL,
    end_date timestamp with time zone,
    status text DEFAULT 'in_progress'::text NOT NULL,
    technician_name text,
    cost numeric(10,2),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT equipment_maintenance_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: equipment_status_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.equipment_status_stats AS
 SELECT status,
    count(*) AS total_count,
    sum(total_quantity) AS total_quantity,
    sum(available_quantity) AS available_quantity
   FROM public.equipment
  GROUP BY status;


--
-- Name: equipment_status_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.equipment_status_view WITH (security_invoker = true) AS
 SELECT id,
    name,
    description,
    category_id,
    supplier_id,
    group_id,
    subgroup_id,
    serial_number,
    article_number,
    location,
    total_quantity,
    qr_type,
    image_url,
    created_at,
    last_maintenance,
    ( SELECT count(*) AS count
           FROM public.checkouts c
          WHERE ((c.equipment_id = e.id) AND ((c.status = 'active'::text) OR (c.status = 'overdue'::text) OR (c.status = 'lost'::text)))) AS checked_out_count,
    ( SELECT count(*) AS count
           FROM public.equipment_maintenance em
          WHERE ((em.equipment_id = e.id) AND (em.status = 'in_progress'::text))) AS maintenance_count,
    GREATEST(((total_quantity - ( SELECT count(*) AS count
           FROM public.checkouts c
          WHERE ((c.equipment_id = e.id) AND ((c.status = 'active'::text) OR (c.status = 'overdue'::text) OR (c.status = 'lost'::text))))) - ( SELECT count(*) AS count
           FROM public.equipment_maintenance em
          WHERE ((em.equipment_id = e.id) AND (em.status = 'in_progress'::text)))), (0)::bigint) AS calculated_available_quantity,
        CASE
            WHEN (( SELECT count(*) AS count
               FROM public.equipment_maintenance em
              WHERE ((em.equipment_id = e.id) AND (em.status = 'in_progress'::text))) > 0) THEN 'maintenance'::text
            WHEN (GREATEST(((total_quantity - ( SELECT count(*) AS count
               FROM public.checkouts c
              WHERE ((c.equipment_id = e.id) AND ((c.status = 'active'::text) OR (c.status = 'overdue'::text) OR (c.status = 'lost'::text))))) - ( SELECT count(*) AS count
               FROM public.equipment_maintenance em
              WHERE ((em.equipment_id = e.id) AND (em.status = 'in_progress'::text)))), (0)::bigint) = 0) THEN 'checked-out'::text
            ELSE 'available'::text
        END AS calculated_status
   FROM public.equipment e;


--
-- Name: equipment_subgroups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_subgroups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#64748b'::text,
    group_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: maintenance_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#f59e0b'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: role_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_configs (
    id text NOT NULL,
    name text NOT NULL,
    color text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: status_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.status_configs (
    id text NOT NULL,
    name text NOT NULL,
    color text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    contact_person text,
    email text,
    phone text,
    website text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id text NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: checkouts checkouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkouts
    ADD CONSTRAINT checkouts_pkey PRIMARY KEY (id);


--
-- Name: delivery_notes delivery_notes_note_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_notes
    ADD CONSTRAINT delivery_notes_note_number_key UNIQUE (note_number);


--
-- Name: delivery_notes delivery_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_notes
    ADD CONSTRAINT delivery_notes_pkey PRIMARY KEY (id);


--
-- Name: delivery_notes delivery_notes_qr_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_notes
    ADD CONSTRAINT delivery_notes_qr_code_key UNIQUE (qr_code);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: equipment equipment_article_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_article_number_key UNIQUE (article_number);


--
-- Name: equipment_groups equipment_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_groups
    ADD CONSTRAINT equipment_groups_pkey PRIMARY KEY (id);


--
-- Name: equipment_instances equipment_instances_equipment_id_instance_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_instances
    ADD CONSTRAINT equipment_instances_equipment_id_instance_number_key UNIQUE (equipment_id, instance_number);


--
-- Name: equipment_instances equipment_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_instances
    ADD CONSTRAINT equipment_instances_pkey PRIMARY KEY (id);


--
-- Name: equipment_instances equipment_instances_qr_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_instances
    ADD CONSTRAINT equipment_instances_qr_code_key UNIQUE (qr_code);


--
-- Name: equipment_maintenance equipment_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance
    ADD CONSTRAINT equipment_maintenance_pkey PRIMARY KEY (id);


--
-- Name: equipment equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);


--
-- Name: equipment equipment_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_serial_number_key UNIQUE (serial_number);


--
-- Name: equipment_subgroups equipment_subgroups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_subgroups
    ADD CONSTRAINT equipment_subgroups_pkey PRIMARY KEY (id);


--
-- Name: maintenance_types maintenance_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_types
    ADD CONSTRAINT maintenance_types_pkey PRIMARY KEY (id);


--
-- Name: role_configs role_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_configs
    ADD CONSTRAINT role_configs_pkey PRIMARY KEY (id);


--
-- Name: status_configs status_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_configs
    ADD CONSTRAINT status_configs_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: checkouts_delivery_note_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checkouts_delivery_note_id_idx ON public.checkouts USING btree (delivery_note_id);


--
-- Name: checkouts_equipment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checkouts_equipment_id_idx ON public.checkouts USING btree (equipment_id);


--
-- Name: checkouts_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checkouts_status_idx ON public.checkouts USING btree (status);


--
-- Name: checkouts_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checkouts_user_id_idx ON public.checkouts USING btree (user_id);


--
-- Name: delivery_notes_due_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_notes_due_date_idx ON public.delivery_notes USING btree (due_date);


--
-- Name: delivery_notes_issue_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_notes_issue_date_idx ON public.delivery_notes USING btree (issue_date);


--
-- Name: delivery_notes_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_notes_status_idx ON public.delivery_notes USING btree (status);


--
-- Name: delivery_notes_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_notes_user_id_idx ON public.delivery_notes USING btree (user_id);


--
-- Name: departments_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX departments_name_idx ON public.departments USING btree (name);


--
-- Name: equipment_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX equipment_category_id_idx ON public.equipment USING btree (category_id);


--
-- Name: equipment_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX equipment_group_id_idx ON public.equipment USING btree (group_id);


--
-- Name: equipment_instances_equipment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX equipment_instances_equipment_id_idx ON public.equipment_instances USING btree (equipment_id);


--
-- Name: equipment_instances_qr_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX equipment_instances_qr_code_idx ON public.equipment_instances USING btree (qr_code);


--
-- Name: equipment_instances_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX equipment_instances_status_idx ON public.equipment_instances USING btree (status);


--
-- Name: equipment_maintenance_equipment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX equipment_maintenance_equipment_id_idx ON public.equipment_maintenance USING btree (equipment_id);


--
-- Name: equipment_maintenance_start_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX equipment_maintenance_start_date_idx ON public.equipment_maintenance USING btree (start_date);


--
-- Name: equipment_maintenance_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX equipment_maintenance_status_idx ON public.equipment_maintenance USING btree (status);


--
-- Name: equipment_maintenance_type_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX equipment_maintenance_type_id_idx ON public.equipment_maintenance USING btree (maintenance_type_id);


--
-- Name: equipment_subgroup_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX equipment_subgroup_id_idx ON public.equipment USING btree (subgroup_id);


--
-- Name: equipment_subgroups_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX equipment_subgroups_group_id_idx ON public.equipment_subgroups USING btree (group_id);


--
-- Name: equipment_supplier_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX equipment_supplier_id_idx ON public.equipment USING btree (supplier_id);


--
-- Name: idx_categories_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_name ON public.categories USING btree (name);


--
-- Name: idx_checkouts_checkout_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkouts_checkout_date ON public.checkouts USING btree (checkout_date);


--
-- Name: idx_checkouts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkouts_created_at ON public.checkouts USING btree (created_at);


--
-- Name: idx_checkouts_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkouts_due_date ON public.checkouts USING btree (due_date);


--
-- Name: idx_checkouts_equipment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkouts_equipment_status ON public.checkouts USING btree (equipment_id, status);


--
-- Name: idx_checkouts_return_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkouts_return_date ON public.checkouts USING btree (return_date);


--
-- Name: idx_checkouts_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkouts_user_status ON public.checkouts USING btree (user_id, status);


--
-- Name: idx_delivery_notes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_notes_created_at ON public.delivery_notes USING btree (created_at);


--
-- Name: idx_delivery_notes_qr_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_notes_qr_code ON public.delivery_notes USING btree (qr_code);


--
-- Name: idx_equipment_added_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_added_date ON public.equipment USING btree (added_date);


--
-- Name: idx_equipment_article_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_article_number ON public.equipment USING btree (article_number);


--
-- Name: idx_equipment_article_number_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_article_number_gin ON public.equipment USING gin (article_number extensions.gin_trgm_ops);


--
-- Name: idx_equipment_article_number_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_article_number_trgm ON public.equipment USING gin (article_number extensions.gin_trgm_ops);


--
-- Name: idx_equipment_category_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_category_status ON public.equipment USING btree (category_id, status);


--
-- Name: idx_equipment_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_created_at ON public.equipment USING btree (created_at);


--
-- Name: idx_equipment_instances_qr_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_instances_qr_code ON public.equipment_instances USING btree (qr_code);


--
-- Name: idx_equipment_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_location ON public.equipment USING btree (location);


--
-- Name: idx_equipment_name_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_name_search ON public.equipment USING gin (to_tsvector('french'::regconfig, name));


--
-- Name: idx_equipment_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_name_trgm ON public.equipment USING gin (name extensions.gin_trgm_ops);


--
-- Name: idx_equipment_serial_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_serial_number ON public.equipment USING btree (serial_number);


--
-- Name: idx_equipment_serial_number_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_serial_number_trgm ON public.equipment USING gin (serial_number extensions.gin_trgm_ops);


--
-- Name: idx_equipment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_status ON public.equipment USING btree (status);


--
-- Name: idx_equipment_status_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_status_category ON public.equipment USING btree (status, category_id);


--
-- Name: idx_equipment_supplier_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_supplier_status ON public.equipment USING btree (supplier_id, status);


--
-- Name: idx_suppliers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_name ON public.suppliers USING btree (name);


--
-- Name: idx_users_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_created_at ON public.users USING btree (created_at);


--
-- Name: idx_users_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_department ON public.users USING btree (department);


--
-- Name: idx_users_first_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_first_name ON public.users USING btree (first_name);


--
-- Name: idx_users_full_name_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_full_name_search ON public.users USING gin (to_tsvector('french'::regconfig, ((first_name || ' '::text) || last_name)));


--
-- Name: idx_users_last_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_last_name ON public.users USING btree (last_name);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: users_department_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_department_idx ON public.users USING btree (department);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role_idx ON public.users USING btree (role);


--
-- Name: delivery_notes delivery_notes_number_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER delivery_notes_number_trigger BEFORE INSERT ON public.delivery_notes FOR EACH ROW EXECUTE FUNCTION public.set_delivery_note_number();


--
-- Name: equipment equipment_article_number_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER equipment_article_number_trigger BEFORE INSERT ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.set_article_number();


--
-- Name: equipment generate_image_cache_key_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER generate_image_cache_key_trigger BEFORE INSERT OR UPDATE OF image_url ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.generate_image_cache_key();


--
-- Name: equipment sync_equipment_instances_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_equipment_instances_trigger AFTER UPDATE OF total_quantity, qr_type ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.sync_equipment_instances_fixed();


--
-- Name: checkouts update_delivery_note_status_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_delivery_note_status_trigger AFTER UPDATE OF status ON public.checkouts FOR EACH ROW WHEN (((old.delivery_note_id IS NOT NULL) OR (new.delivery_note_id IS NOT NULL))) EXECUTE FUNCTION public.update_delivery_note_status();


--
-- Name: equipment_maintenance update_equipment_maintenance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_equipment_maintenance_updated_at BEFORE UPDATE ON public.equipment_maintenance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: equipment_maintenance update_equipment_status_on_maintenance_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_equipment_status_on_maintenance_trigger AFTER INSERT OR UPDATE OF status ON public.equipment_maintenance FOR EACH ROW EXECUTE FUNCTION public.update_equipment_status_on_maintenance();


--
-- Name: equipment validate_image_url_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_image_url_trigger BEFORE INSERT OR UPDATE OF image_url ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.validate_image_url();


--
-- Name: checkouts checkouts_delivery_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkouts
    ADD CONSTRAINT checkouts_delivery_note_id_fkey FOREIGN KEY (delivery_note_id) REFERENCES public.delivery_notes(id);


--
-- Name: checkouts checkouts_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkouts
    ADD CONSTRAINT checkouts_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id);


--
-- Name: checkouts checkouts_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkouts
    ADD CONSTRAINT checkouts_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.equipment_instances(id) ON DELETE SET NULL;


--
-- Name: checkouts checkouts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkouts
    ADD CONSTRAINT checkouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: delivery_notes delivery_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_notes
    ADD CONSTRAINT delivery_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: equipment equipment_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: equipment equipment_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.equipment_groups(id);


--
-- Name: equipment_instances equipment_instances_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_instances
    ADD CONSTRAINT equipment_instances_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_maintenance equipment_maintenance_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance
    ADD CONSTRAINT equipment_maintenance_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_maintenance equipment_maintenance_maintenance_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance
    ADD CONSTRAINT equipment_maintenance_maintenance_type_id_fkey FOREIGN KEY (maintenance_type_id) REFERENCES public.maintenance_types(id);


--
-- Name: equipment equipment_subgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_subgroup_id_fkey FOREIGN KEY (subgroup_id) REFERENCES public.equipment_subgroups(id);


--
-- Name: equipment_subgroups equipment_subgroups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_subgroups
    ADD CONSTRAINT equipment_subgroups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.equipment_groups(id) ON DELETE CASCADE;


--
-- Name: equipment equipment_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: categories categories_anon_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_anon_policy ON public.categories TO anon USING (true) WITH CHECK (true);


--
-- Name: categories categories_authenticated_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_authenticated_policy ON public.categories TO authenticated USING (true) WITH CHECK (true);


--
-- Name: checkouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checkouts ENABLE ROW LEVEL SECURITY;

--
-- Name: checkouts checkouts_anon_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkouts_anon_policy ON public.checkouts TO anon USING (true) WITH CHECK (true);


--
-- Name: checkouts checkouts_authenticated_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkouts_authenticated_policy ON public.checkouts TO authenticated USING (true) WITH CHECK (true);


--
-- Name: delivery_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_notes delivery_notes_anon_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivery_notes_anon_policy ON public.delivery_notes TO anon USING (true) WITH CHECK (true);


--
-- Name: delivery_notes delivery_notes_authenticated_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivery_notes_authenticated_policy ON public.delivery_notes TO authenticated USING (true) WITH CHECK (true);


--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: departments departments_anon_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY departments_anon_policy ON public.departments TO anon USING (true) WITH CHECK (true);


--
-- Name: departments departments_authenticated_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY departments_authenticated_policy ON public.departments TO authenticated USING (true) WITH CHECK (true);


--
-- Name: equipment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment equipment_anon_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_anon_policy ON public.equipment TO anon USING (true) WITH CHECK (true);


--
-- Name: equipment equipment_authenticated_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_authenticated_policy ON public.equipment TO authenticated USING (true) WITH CHECK (true);


--
-- Name: equipment_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_groups equipment_groups_anon_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_groups_anon_policy ON public.equipment_groups TO anon USING (true) WITH CHECK (true);


--
-- Name: equipment_groups equipment_groups_authenticated_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_groups_authenticated_policy ON public.equipment_groups TO authenticated USING (true) WITH CHECK (true);


--
-- Name: equipment_instances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_instances ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_instances equipment_instances_anon_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_instances_anon_policy ON public.equipment_instances TO anon USING (true) WITH CHECK (true);


--
-- Name: equipment_instances equipment_instances_authenticated_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_instances_authenticated_policy ON public.equipment_instances TO authenticated USING (true) WITH CHECK (true);


--
-- Name: equipment_maintenance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_maintenance ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_maintenance equipment_maintenance_anon_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_maintenance_anon_policy ON public.equipment_maintenance TO anon USING (true) WITH CHECK (true);


--
-- Name: equipment_maintenance equipment_maintenance_authenticated_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_maintenance_authenticated_policy ON public.equipment_maintenance TO authenticated USING (true) WITH CHECK (true);


--
-- Name: equipment_subgroups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_subgroups ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_subgroups equipment_subgroups_anon_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_subgroups_anon_policy ON public.equipment_subgroups TO anon USING (true) WITH CHECK (true);


--
-- Name: equipment_subgroups equipment_subgroups_authenticated_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_subgroups_authenticated_policy ON public.equipment_subgroups TO authenticated USING (true) WITH CHECK (true);


--
-- Name: maintenance_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maintenance_types ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_types maintenance_types_anon_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY maintenance_types_anon_policy ON public.maintenance_types TO anon USING (true) WITH CHECK (true);


--
-- Name: maintenance_types maintenance_types_authenticated_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY maintenance_types_authenticated_policy ON public.maintenance_types TO authenticated USING (true) WITH CHECK (true);


--
-- Name: role_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: role_configs role_configs_anon_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_configs_anon_policy ON public.role_configs TO anon USING (true) WITH CHECK (true);


--
-- Name: role_configs role_configs_authenticated_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_configs_authenticated_policy ON public.role_configs TO authenticated USING (true) WITH CHECK (true);


--
-- Name: status_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.status_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: status_configs status_configs_anon_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY status_configs_anon_policy ON public.status_configs TO anon USING (true) WITH CHECK (true);


--
-- Name: status_configs status_configs_authenticated_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY status_configs_authenticated_policy ON public.status_configs TO authenticated USING (true) WITH CHECK (true);


--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers suppliers_anon_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suppliers_anon_policy ON public.suppliers TO anon USING (true) WITH CHECK (true);


--
-- Name: suppliers suppliers_authenticated_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suppliers_authenticated_policy ON public.suppliers TO authenticated USING (true) WITH CHECK (true);


--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings system_settings_anon_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_settings_anon_policy ON public.system_settings TO anon USING (true) WITH CHECK (true);


--
-- Name: system_settings system_settings_authenticated_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_settings_authenticated_policy ON public.system_settings TO authenticated USING (true) WITH CHECK (true);


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_anon_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_anon_policy ON public.users TO anon USING (true) WITH CHECK (true);


--
-- PostgreSQL database dump complete
--



--
-- Données de référence
--

INSERT INTO public.equipment_groups (id, name, description, color, created_at) VALUES ('bf30ae00-2930-4ff0-94ad-cdc37433e88d', 'Électronique', 'Appareils électroniques et informatiques', '#3b82f6', '2026-10-29 11:18:27.578378+00');
INSERT INTO public.equipment_groups (id, name, description, color, created_at) VALUES ('8b9aa5ad-de5a-4052-bbc9-747671f36e30', 'Outils', 'Outils manuels et électriques', '#f59e0b', '2026-10-29 11:18:27.578378+00');
INSERT INTO public.equipment_groups (id, name, description, color, created_at) VALUES ('cb8c66f6-84ea-4d1b-9200-1953d1615559', 'Mobilier', 'Mobilier et équipement de bureau', '#10b981', '2026-10-29 11:18:27.578378+00');
INSERT INTO public.equipment_groups (id, name, description, color, created_at) VALUES ('6d0e0b25-c86b-40da-90a1-79cdc14ea8f7', 'Sécurité', 'Équipement de protection et sécurité', '#ef4444', '2026-10-29 11:18:27.578378+00');
INSERT INTO public.equipment_subgroups (id, name, description, color, group_id, created_at) VALUES ('748c7298-0ca9-4064-ba69-02fd0d8614b2', 'Ordinateurs portables', 'Laptops et ordinateurs portables', '#1e40af', 'bf30ae00-2930-4ff0-94ad-cdc37433e88d', '2026-10-29 11:18:27.76049+00');
INSERT INTO public.equipment_subgroups (id, name, description, color, group_id, created_at) VALUES ('f47fdf93-65d3-4244-988f-bbd3a03d7fdd', 'Outils électriques', 'Perceuses, visseuses et outils électriques', '#ea580c', '8b9aa5ad-de5a-4052-bbc9-747671f36e30', '2026-10-29 11:18:27.761156+00');
INSERT INTO public.equipment_subgroups (id, name, description, color, group_id, created_at) VALUES ('02b391d5-86fb-4233-b786-ca49d1eba022', 'Chaises de bureau', 'Sièges et chaises ergonomiques', '#059669', 'cb8c66f6-84ea-4d1b-9200-1953d1615559', '2026-10-29 11:18:27.761495+00');
INSERT INTO public.maintenance_types (id, name, description, color, created_at) VALUES ('95dad515-7705-42d5-bc5d-fe47f963426e', 'Maintenance préventive', 'Maintenance programmée et préventive', '#10b981', '2026-10-29 11:18:27.795617+00');
INSERT INTO public.maintenance_types (id, name, description, color, created_at) VALUES ('7d5e2331-414b-4af6-84c8-e3615f3662b7', 'Panne électrique', 'Problème électrique ou électronique', '#ef4444', '2026-10-29 11:18:27.795617+00');
INSERT INTO public.maintenance_types (id, name, description, color, created_at) VALUES ('73462cd9-e084-4600-8d52-bd644b099f0d', 'Panne mécanique', 'Problème mécanique ou usure', '#f59e0b', '2026-10-29 11:18:27.795617+00');
INSERT INTO public.maintenance_types (id, name, description, color, created_at) VALUES ('19920d03-177d-48e4-b4a1-7ebf70de4167', 'Mise à jour logicielle', 'Installation de mises à jour', '#3b82f6', '2026-10-29 11:18:27.795617+00');
INSERT INTO public.maintenance_types (id, name, description, color, created_at) VALUES ('5b520e4e-dc66-4425-a0b0-1bc0bf7881ec', 'Nettoyage/Entretien', 'Nettoyage et entretien général', '#8b5cf6', '2026-10-29 11:18:27.795617+00');
INSERT INTO public.maintenance_types (id, name, description, color, created_at) VALUES ('c61b6cba-fcdc-4bcb-a022-187a5b4f00bf', 'Réparation', 'Réparation suite à dommage', '#ec4899', '2026-10-29 11:18:27.795617+00');
INSERT INTO public.status_configs (id, name, color, created_at) VALUES ('available', 'Disponible', '#10b981', '2026-10-29 11:18:27.725902+00');
INSERT INTO public.status_configs (id, name, color, created_at) VALUES ('checked-out', 'Emprunté', '#f59e0b', '2026-10-29 11:18:27.725902+00');
INSERT INTO public.status_configs (id, name, color, created_at) VALUES ('maintenance', 'En maintenance', '#3b82f6', '2026-10-29 11:18:27.725902+00');
INSERT INTO public.status_configs (id, name, color, created_at) VALUES ('retired', 'Retiré', '#ef4444', '2026-10-29 11:18:27.725902+00');
INSERT INTO public.status_configs (id, name, color, created_at) VALUES ('lost', 'Perdu', '#6b7280', '2026-10-29 11:18:28.707908+00');
INSERT INTO public.system_settings (id, value, description, updated_at) VALUES ('article_prefix', 'GOMAT', 'Préfixe pour les numéros d''articles (5 caractères max)', '2026-10-29 11:18:27.577205+00');
INSERT INTO public.system_settings (id, value, description, updated_at) VALUES ('company_logo', '', 'Logo de l''entreprise (base64)', '2026-10-29 11:18:27.644844+00');

-- Remettre le search_path par défaut pour la suite de la session
SELECT pg_catalog.set_config('search_path', '"$user", public, extensions', false);
