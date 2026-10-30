-- Lot 16 : un véhicule ou un outil loué devient un objet temporaire du stock, avec un état des lieux
-- à la réception chez le loueur et à la restitution (document interne : photos, dégâts déjà présents,
-- accessoires, relevés, signatures).
--
-- Déroulement :
--   1. la location est saisie avec son type (véhicule, outil / engin, ou « autre » = coût seulement) ;
--   2. à la réception, l'état des lieux crée le véhicule (flotte) ou l'outil (matériel), réservable
--      dans les demandes et sortable au comptoir jusqu'à la date de fin du contrat ;
--   3. à la restitution, l'état des lieux retire l'objet du stock (historique gardé) et clôt la location.

-- 1. Type de location et objets rattachés --------------------------------------------------------
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS plate text,
  ADD COLUMN IF NOT EXISTS license_category text,
  -- Permis machine ou formation exigé pour l'engin loué (repris sur l'outil créé à la réception)
  ADD COLUMN IF NOT EXISTS required_training_id uuid REFERENCES public.trainings(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rentals_kind_check') THEN
    ALTER TABLE public.rentals ADD CONSTRAINT rentals_kind_check CHECK (kind IN ('vehicle', 'equipment', 'other'));
  END IF;
END $$;

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS rental_id uuid REFERENCES public.rentals(id) ON DELETE SET NULL;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS rental_id uuid REFERENCES public.rentals(id) ON DELETE SET NULL;
-- Fin de location recopiée sur l'objet : visible par tous (la location elle-même est réservée au magasin)
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS rental_until date;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS rental_until date;
CREATE INDEX IF NOT EXISTS vehicles_rental_idx ON public.vehicles (rental_id) WHERE rental_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS equipment_rental_idx ON public.equipment (rental_id) WHERE rental_id IS NOT NULL;

-- 2. États des lieux ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rental_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('reception', 'return')),
  done_at timestamptz NOT NULL DEFAULT now(),          -- heure du serveur : preuve de la date
  done_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  km integer CHECK (km >= 0),
  fuel_level smallint CHECK (fuel_level BETWEEN 0 AND 8),
  hours numeric(10, 1) CHECK (hours >= 0),             -- compteur d'heures d'un engin
  photos jsonb NOT NULL DEFAULT '{}',                  -- { "front": "chemin", "back": … } vues guidées
  extra_photos text[] NOT NULL DEFAULT '{}',
  damages jsonb NOT NULL DEFAULT '[]',                 -- [{ "zone", "description", "photo" }]
  accessories jsonb NOT NULL DEFAULT '[]',             -- [{ "label", "present" }]
  notes text,
  staff_name text NOT NULL,
  staff_signature text NOT NULL,                       -- image PNG en data URL
  lessor_name text,
  lessor_signature text,
  UNIQUE (rental_id, kind)
);

ALTER TABLE public.rental_inspections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rental_inspections' AND policyname = 'rental_inspections_read') THEN
    -- Lecture : comme la location elle-même (la règle de « rentals » s'applique dans la sous-requête)
    CREATE POLICY rental_inspections_read ON public.rental_inspections FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.rentals r WHERE r.id = rental_id));
  END IF;
END $$;

-- Écriture seulement par la fonction record_rental_inspection (pas d'état des lieux modifié après coup)
GRANT SELECT ON public.rental_inspections TO authenticated;
GRANT ALL ON public.rental_inspections TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rental_inspections_audit_trigger') THEN
    CREATE TRIGGER rental_inspections_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.rental_inspections
      FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
  END IF;
END $$;

-- 3. Fenêtre de location : réservation et sortie seulement jusqu'à la fin du contrat --------------
CREATE OR REPLACE FUNCTION public.rental_window_problem(p_rental_id uuid, p_until timestamptz)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_rental public.rentals;
BEGIN
  IF p_rental_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_rental FROM public.rentals WHERE id = p_rental_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_rental.returned_on IS NOT NULL THEN
    RETURN format('Location « %s » déjà rendue au loueur', v_rental.description);
  END IF;
  IF p_until IS NOT NULL AND (p_until AT TIME ZONE 'Europe/Zurich')::date > v_rental.end_on THEN
    RETURN format('Location « %s » jusqu''au %s : choisissez un retour avant cette date ou prolongez la location',
                  v_rental.description, to_char(v_rental.end_on, 'DD.MM.YYYY'));
  END IF;
  RETURN NULL;
END;
$$;

-- Ligne de demande : la fin de la demande doit tomber dans la location
CREATE OR REPLACE FUNCTION public.request_items_check_rental()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_end timestamptz;
  v_problem text;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN
    RETURN NEW;
  END IF;
  SELECT end_at INTO v_end FROM public.requests WHERE id = NEW.request_id;
  IF NEW.vehicle_id IS NOT NULL THEN
    v_problem := public.rental_window_problem((SELECT rental_id FROM public.vehicles WHERE id = NEW.vehicle_id), v_end);
  ELSIF NEW.equipment_id IS NOT NULL THEN
    v_problem := public.rental_window_problem((SELECT rental_id FROM public.equipment WHERE id = NEW.equipment_id), v_end);
  END IF;
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION '%', v_problem;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS request_items_check_rental_trigger ON public.request_items;
CREATE TRIGGER request_items_check_rental_trigger
  BEFORE INSERT OR UPDATE OF vehicle_id, equipment_id ON public.request_items
  FOR EACH ROW EXECUTE FUNCTION public.request_items_check_rental();

-- Demande dont on repousse la fin : même contrôle pour chaque objet loué
CREATE OR REPLACE FUNCTION public.requests_check_rental()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_problem text;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' OR NEW.end_at <= OLD.end_at
     OR NEW.status IN ('rejected', 'closed', 'cancelled') THEN
    RETURN NEW;
  END IF;
  SELECT p INTO v_problem FROM (
    SELECT public.rental_window_problem(COALESCE(v.rental_id, e.rental_id), NEW.end_at) AS p
    FROM public.request_items ri
    LEFT JOIN public.vehicles v ON v.id = ri.vehicle_id
    LEFT JOIN public.equipment e ON e.id = ri.equipment_id
    WHERE ri.request_id = NEW.id
  ) x WHERE p IS NOT NULL LIMIT 1;
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION '%', v_problem;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS requests_check_rental_trigger ON public.requests;
CREATE TRIGGER requests_check_rental_trigger
  BEFORE UPDATE OF end_at ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.requests_check_rental();

-- Sortie au comptoir ou sur bon : retour prévu avant la fin de la location
CREATE OR REPLACE FUNCTION public.checkouts_check_rental()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_problem text;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN
    RETURN NEW;
  END IF;
  v_problem := public.rental_window_problem((SELECT rental_id FROM public.equipment WHERE id = NEW.equipment_id), NEW.due_date);
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION '%', v_problem;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checkouts_check_rental_trigger ON public.checkouts;
CREATE TRIGGER checkouts_check_rental_trigger
  BEFORE INSERT ON public.checkouts
  FOR EACH ROW EXECUTE FUNCTION public.checkouts_check_rental();

-- Prolongation (ou correction) de la date de fin : suivie par l'objet
CREATE OR REPLACE FUNCTION public.rentals_sync_until()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.vehicles SET rental_until = NEW.end_on WHERE rental_id = NEW.id AND rental_until IS DISTINCT FROM NEW.end_on;
  UPDATE public.equipment SET rental_until = NEW.end_on WHERE rental_id = NEW.id AND rental_until IS DISTINCT FROM NEW.end_on;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rentals_sync_until_trigger ON public.rentals;
CREATE TRIGGER rentals_sync_until_trigger
  AFTER UPDATE OF end_on ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.rentals_sync_until();

-- 4. Enregistrement d'un état des lieux ----------------------------------------------------------
-- p_data : km, fuel_level, hours, photos, extra_photos, damages, accessories, notes,
--          staff_signature, lessor_name, lessor_signature
CREATE OR REPLACE FUNCTION public.record_rental_inspection(p_rental_id uuid, p_kind text, p_data jsonb)
RETURNS public.rental_inspections
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rental public.rentals;
  v_inspection public.rental_inspections;
  v_required text[];
  v_missing text[];
  v_staff text;
  v_vehicle_id uuid;
  v_equipment_id uuid;
  v_busy text;
BEGIN
  SELECT * INTO v_rental FROM public.rentals WHERE id = p_rental_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Location introuvable';
  END IF;
  -- Le magasin, la gestion du stock ou de la flotte, ou le responsable de la location
  IF current_setting('role', true) = 'authenticated'
     AND NOT (public.app_has('scan') OR public.app_has('manage_stock') OR public.app_has('manage_fleet')
              OR v_rental.responsible_id = public.app_user_id()) THEN
    RAISE EXCEPTION 'Seul le magasin ou le responsable de la location fait l''état des lieux';
  END IF;
  IF v_rental.kind = 'other' THEN
    RAISE EXCEPTION 'Choisissez d''abord le type de la location (véhicule ou outil)';
  END IF;
  IF p_kind NOT IN ('reception', 'return') THEN
    RAISE EXCEPTION 'État des lieux inconnu : %', p_kind;
  END IF;
  IF v_rental.returned_on IS NOT NULL THEN
    RAISE EXCEPTION 'Location déjà rendue';
  END IF;
  IF EXISTS (SELECT 1 FROM public.rental_inspections WHERE rental_id = p_rental_id AND kind = p_kind) THEN
    RAISE EXCEPTION '%', CASE p_kind WHEN 'reception' THEN 'Réception déjà faite' ELSE 'Restitution déjà faite' END;
  END IF;
  IF p_kind = 'return' AND NOT EXISTS (SELECT 1 FROM public.rental_inspections WHERE rental_id = p_rental_id AND kind = 'reception') THEN
    RAISE EXCEPTION 'Faites d''abord l''état des lieux de réception';
  END IF;

  -- Vues obligatoires
  v_required := CASE v_rental.kind
    WHEN 'vehicle' THEN ARRAY['front', 'back', 'left', 'right', 'dashboard']
    ELSE ARRAY['overview', 'plate'] END;
  SELECT array_agg(v) INTO v_missing FROM unnest(v_required) v
  WHERE COALESCE(NULLIF(p_data->'photos'->>v, ''), NULL) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Photos manquantes : %', array_to_string(ARRAY(
      SELECT CASE m WHEN 'front' THEN 'avant' WHEN 'back' THEN 'arrière' WHEN 'left' THEN 'côté gauche'
        WHEN 'right' THEN 'côté droit' WHEN 'dashboard' THEN 'compteur' WHEN 'overview' THEN 'vue d''ensemble'
        WHEN 'plate' THEN 'plaque signalétique' ELSE m END FROM unnest(v_missing) m), ', ');
  END IF;
  IF v_rental.kind = 'vehicle' AND (p_data->>'km' IS NULL OR p_data->>'fuel_level' IS NULL) THEN
    RAISE EXCEPTION 'Relevez le kilométrage et le carburant';
  END IF;
  IF COALESCE(p_data->>'staff_signature', '') = '' THEN
    RAISE EXCEPTION 'Signature de notre collaborateur manquante';
  END IF;

  SELECT first_name || ' ' || last_name INTO v_staff FROM public.users WHERE id = public.app_user_id();
  SELECT id INTO v_vehicle_id FROM public.vehicles WHERE rental_id = p_rental_id LIMIT 1;
  SELECT id INTO v_equipment_id FROM public.equipment WHERE rental_id = p_rental_id LIMIT 1;

  IF p_kind = 'return' THEN
    -- Rien ne doit être encore dehors ni réservé
    IF v_vehicle_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.vehicle_trips WHERE vehicle_id = v_vehicle_id AND end_at IS NULL) THEN
      RAISE EXCEPTION 'Le véhicule est encore en route : clôturez le trajet d''abord';
    END IF;
    IF v_equipment_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.checkouts WHERE equipment_id = v_equipment_id AND status IN ('active', 'overdue')) THEN
      RAISE EXCEPTION 'L''outil est encore sorti : enregistrez son retour au comptoir d''abord';
    END IF;
    SELECT string_agg(DISTINCT r.number, ', ') INTO v_busy
    FROM public.request_items ri JOIN public.requests r ON r.id = ri.request_id
    WHERE r.status IN ('requested', 'approved', 'ready', 'out')
      AND ((v_vehicle_id IS NOT NULL AND ri.vehicle_id = v_vehicle_id) OR (v_equipment_id IS NOT NULL AND ri.equipment_id = v_equipment_id));
    IF v_busy IS NOT NULL THEN
      RAISE EXCEPTION 'Encore prévu dans les demandes % : clôturez-les ou retirez-le d''abord', v_busy;
    END IF;
  END IF;

  INSERT INTO public.rental_inspections (rental_id, kind, done_by, km, fuel_level, hours, photos, extra_photos, damages,
                                         accessories, notes, staff_name, staff_signature, lessor_name, lessor_signature)
  VALUES (p_rental_id, p_kind, public.app_user_id(),
          NULLIF(p_data->>'km', '')::integer, NULLIF(p_data->>'fuel_level', '')::smallint, NULLIF(p_data->>'hours', '')::numeric,
          COALESCE(p_data->'photos', '{}'),
          COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_data->'extra_photos', '[]'))), '{}'),
          COALESCE(p_data->'damages', '[]'), COALESCE(p_data->'accessories', '[]'),
          NULLIF(trim(p_data->>'notes'), ''), COALESCE(v_staff, 'Collaborateur'), p_data->>'staff_signature',
          NULLIF(trim(p_data->>'lessor_name'), ''), NULLIF(p_data->>'lessor_signature', ''))
  RETURNING * INTO v_inspection;

  IF p_kind = 'reception' THEN
    -- L'objet entre dans le stock
    IF v_rental.kind = 'vehicle' THEN
      INSERT INTO public.vehicles (name, plate, depot_id, license_category, current_km, fuel_level, status, rental_id, rental_until, notes)
      VALUES (v_rental.description, COALESCE(NULLIF(trim(v_rental.plate), ''), 'LOC-' || left(p_rental_id::text, 8)),
              v_rental.depot_id, COALESCE(NULLIF(v_rental.license_category, ''), 'B'),
              COALESCE(v_inspection.km, 0), COALESCE(v_inspection.fuel_level, 8), 'available', p_rental_id,
              v_rental.end_on, 'Loué chez ' || v_rental.rental_company);
    ELSE
      -- Pas de prix par jour : le coût est déjà compté par la location
      INSERT INTO public.equipment (name, description, status, qr_type, total_quantity, available_quantity,
                                    article_number, rental_id, rental_until, depot_id, required_training_id)
      VALUES (v_rental.description, 'Loué chez ' || v_rental.rental_company || COALESCE(' · contrat ' || v_rental.contract_ref, ''),
              'available', 'batch', v_rental.quantity, v_rental.quantity,
              'LOC-' || upper(left(p_rental_id::text, 8)), p_rental_id, v_rental.end_on, v_rental.depot_id,
              v_rental.required_training_id);
    END IF;
  ELSE
    -- L'objet quitte le stock ; l'historique reste
    UPDATE public.vehicles SET status = 'retired', current_km = GREATEST(current_km, COALESCE(v_inspection.km, current_km)),
      fuel_level = COALESCE(v_inspection.fuel_level, fuel_level)
    WHERE rental_id = p_rental_id;
    UPDATE public.equipment SET status = 'retired' WHERE rental_id = p_rental_id;
    UPDATE public.rentals SET returned_on = GREATEST((now() AT TIME ZONE 'Europe/Zurich')::date, start_on) WHERE id = p_rental_id;
  END IF;

  RETURN v_inspection;
END;
$$;

-- 5. Droits et réglages -------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.request_items_check_rental(), public.requests_check_rental(), public.rentals_sync_until(),
  public.checkouts_check_rental() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rental_window_problem(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rental_window_problem(uuid, timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_rental_inspection(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_rental_inspection(uuid, text, jsonb) TO authenticated;

ALTER FUNCTION public.rental_window_problem(uuid, timestamptz) SET search_path = public, extensions;
ALTER FUNCTION public.request_items_check_rental() SET search_path = public, extensions;
ALTER FUNCTION public.requests_check_rental() SET search_path = public, extensions;
ALTER FUNCTION public.rentals_sync_until() SET search_path = public, extensions;
ALTER FUNCTION public.checkouts_check_rental() SET search_path = public, extensions;
ALTER FUNCTION public.record_rental_inspection(uuid, text, jsonb) SET search_path = public, extensions;
