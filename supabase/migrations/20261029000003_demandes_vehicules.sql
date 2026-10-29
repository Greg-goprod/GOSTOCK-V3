/*
  Demandes, réservations et véhicules

  - vehicles : flotte (plaque, dépôt, kilométrage, carburant, échéances service / pneus / expertise)
  - requests + request_items : une demande d'un collaborateur regroupe outils, consommables
    et véhicule pour une période. États : requested → approved (ou rejected) → ready → out → closed
    (cancelled possible avant la sortie).
  - Validation : obligatoire dès qu'il y a un véhicule, ou un article marqué « validation requise »,
    ou une quantité au-delà du seuil réglé dans system_settings (approval_max_quantity, 10 par défaut).
    Sinon la demande est validée automatiquement.
  - Disponibilité vérifiée sur la période : outils (stock − maintenance − emprunts en cours − demandes
    validées qui se chevauchent), véhicules (pas deux réservations validées qui se chevauchent,
    expertise et service non échus).
  - issue_request : la sortie d'une demande crée le bon (outils), décompte les consommables et ouvre
    l'état des lieux du véhicule (vehicle_trips : km, carburant, dégâts, signature).
  - return_vehicle : état des lieux de retour ; la demande se clôt quand tout est revenu.
  - check_vehicle_deadlines : alertes (une seule par échéance) 30 jours avant service / pneus / expertise.

  À exécuter après 20261029000002_depots_consommables.sql.
*/

-- Réglage du seuil de validation ------------------------------------------------
INSERT INTO public.system_settings (id, value, description)
VALUES ('approval_max_quantity', '10', 'Au-delà de cette quantité par article, une demande doit être validée par un responsable')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false;

-- Véhicules ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  name text NOT NULL,
  plate text NOT NULL,
  depot_id uuid REFERENCES public.depots(id) ON DELETE SET NULL,
  license_category text NOT NULL DEFAULT 'B',
  seats smallint,
  current_km integer NOT NULL DEFAULT 0 CHECK (current_km >= 0),
  fuel_level smallint NOT NULL DEFAULT 8 CHECK (fuel_level BETWEEN 0 AND 8),  -- en huitièmes
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'retired')),
  next_service_date date,
  next_service_km integer,
  tires_date date,
  inspection_date date,          -- prochaine expertise
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, plate)
);

-- Demandes -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  number text UNIQUE,
  requester_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  destination text,                 -- chantier ou service
  depot_id uuid NOT NULL REFERENCES public.depots(id) ON DELETE RESTRICT,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'rejected', 'ready', 'out', 'closed', 'cancelled')),
  needs_approval boolean NOT NULL DEFAULT false,
  approval_reason text,
  notes text,
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  delivery_note_id uuid REFERENCES public.delivery_notes(id) ON DELETE SET NULL,
  issued_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS requests_period_idx ON public.requests USING gist (tstzrange(start_at, end_at, '[)'));
CREATE INDEX IF NOT EXISTS requests_status_idx ON public.requests (status, start_at);

CREATE TABLE IF NOT EXISTS public.request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  item_kind text NOT NULL CHECK (item_kind IN ('tool', 'consumable', 'vehicle')),
  equipment_id uuid REFERENCES public.equipment(id) ON DELETE RESTRICT,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  quantity numeric(12, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  CHECK ((item_kind = 'vehicle') = (vehicle_id IS NOT NULL)),
  CHECK ((item_kind <> 'vehicle') = (equipment_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS request_items_request_idx ON public.request_items (request_id);
CREATE INDEX IF NOT EXISTS request_items_vehicle_idx ON public.request_items (vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS request_items_equipment_idx ON public.request_items (equipment_id) WHERE equipment_id IS NOT NULL;

-- Numéro de demande : DEM2611-0001
CREATE OR REPLACE FUNCTION public.set_request_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix text := 'DEM' || to_char(now(), 'YYMM') || '-';
  v_next integer;
BEGIN
  IF NEW.number IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Verrou de transaction : deux demandes simultanées n'obtiennent pas le même numéro
  PERFORM pg_advisory_xact_lock(hashtext('requests_number'));
  SELECT COALESCE(MAX(substring(number FROM length(v_prefix) + 1)::integer), 0) + 1 INTO v_next
  FROM public.requests WHERE number LIKE v_prefix || '%';
  NEW.number := v_prefix || lpad(v_next::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER requests_number_trigger
  BEFORE INSERT ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.set_request_number();

-- États des lieux des véhicules ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  start_at timestamptz NOT NULL DEFAULT now(),
  start_km integer NOT NULL CHECK (start_km >= 0),
  start_fuel smallint NOT NULL CHECK (start_fuel BETWEEN 0 AND 8),
  start_damages text,
  start_signature text,           -- image PNG en data URL
  end_at timestamptz,
  end_km integer,
  end_fuel smallint CHECK (end_fuel BETWEEN 0 AND 8),
  end_damages text,
  end_signature text,
  CHECK (end_km IS NULL OR end_km >= start_km)
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_trips_one_open ON public.vehicle_trips (vehicle_id) WHERE end_at IS NULL;

-- Notifications : véhicule concerné et clé anti-doublon
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.requests(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx ON public.notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Disponibilités ------------------------------------------------------------------
-- Outil : quantité encore réservable sur une période
CREATE OR REPLACE FUNCTION public.tool_availability(
  p_equipment_id uuid, p_start timestamptz, p_end timestamptz, p_exclude_request uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_total integer;
  v_status text;
  v_maintenance integer;
  v_out integer;
  v_reserved numeric;
BEGIN
  SELECT total_quantity, status INTO v_total, v_status FROM public.equipment WHERE id = p_equipment_id;
  IF v_total IS NULL OR v_status = 'retired' THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO v_maintenance FROM public.equipment_maintenance
  WHERE equipment_id = p_equipment_id AND status = 'in_progress';

  -- Emprunts en cours qui ne seront pas rentrés avant le début de la période (les retards comptent)
  SELECT count(*) INTO v_out FROM public.checkouts
  WHERE equipment_id = p_equipment_id
    AND (status IN ('overdue', 'lost') OR (status = 'active' AND due_date > p_start));

  -- Demandes validées mais pas encore sorties, qui chevauchent la période
  SELECT COALESCE(sum(i.quantity), 0) INTO v_reserved
  FROM public.request_items i
  JOIN public.requests r ON r.id = i.request_id
  WHERE i.equipment_id = p_equipment_id
    AND r.status IN ('approved', 'ready')
    AND (p_exclude_request IS NULL OR r.id <> p_exclude_request)
    AND tstzrange(r.start_at, r.end_at, '[)') && tstzrange(p_start, p_end, '[)');

  RETURN GREATEST(v_total - v_maintenance - v_out - ceil(v_reserved)::integer, 0);
END;
$$;

-- Véhicule : raison pour laquelle il n'est pas réservable sur la période (NULL = libre)
CREATE OR REPLACE FUNCTION public.vehicle_unavailability(
  p_vehicle_id uuid, p_start timestamptz, p_end timestamptz, p_exclude_request uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_vehicle public.vehicles;
  v_conflict text;
BEGIN
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id = p_vehicle_id;
  IF NOT FOUND THEN
    RETURN 'Véhicule introuvable';
  END IF;
  IF v_vehicle.status = 'retired' THEN
    RETURN v_vehicle.name || ' est retiré du service';
  END IF;
  IF v_vehicle.status = 'maintenance' THEN
    RETURN v_vehicle.name || ' est en maintenance';
  END IF;
  IF v_vehicle.inspection_date IS NOT NULL AND v_vehicle.inspection_date < p_end::date THEN
    RETURN format('Expertise de %s échue le %s', v_vehicle.name, to_char(v_vehicle.inspection_date, 'DD.MM.YYYY'));
  END IF;
  IF v_vehicle.next_service_date IS NOT NULL AND v_vehicle.next_service_date < p_start::date THEN
    RETURN format('Service de %s dépassé depuis le %s', v_vehicle.name, to_char(v_vehicle.next_service_date, 'DD.MM.YYYY'));
  END IF;

  SELECT r.number || ' (' || to_char(r.start_at, 'DD.MM') || ' → ' || to_char(r.end_at, 'DD.MM') || ')' INTO v_conflict
  FROM public.request_items i
  JOIN public.requests r ON r.id = i.request_id
  WHERE i.vehicle_id = p_vehicle_id
    AND r.status IN ('approved', 'ready', 'out')
    AND (p_exclude_request IS NULL OR r.id <> p_exclude_request)
    AND tstzrange(r.start_at, r.end_at, '[)') && tstzrange(p_start, p_end, '[)')
  LIMIT 1;
  IF v_conflict IS NOT NULL THEN
    RETURN format('%s est déjà réservé : %s', v_vehicle.name, v_conflict);
  END IF;
  RETURN NULL;
END;
$$;

-- Contrôle de disponibilité de toute une demande (lève une erreur lisible)
CREATE OR REPLACE FUNCTION public.check_request_availability(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_req public.requests;
  v_item record;
  v_free integer;
  v_reason text;
BEGIN
  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id;
  FOR v_item IN
    SELECT i.*, e.name AS equipment_name FROM public.request_items i
    LEFT JOIN public.equipment e ON e.id = i.equipment_id
    WHERE i.request_id = p_request_id
  LOOP
    IF v_item.item_kind = 'tool' THEN
      v_free := public.tool_availability(v_item.equipment_id, v_req.start_at, v_req.end_at, p_request_id);
      IF v_item.quantity > v_free THEN
        RAISE EXCEPTION 'Pas assez de « % » sur la période : % disponible(s), % demandé(s)', v_item.equipment_name, v_free, trim_scale(v_item.quantity)
          USING ERRCODE = 'check_violation';
      END IF;
    ELSIF v_item.item_kind = 'vehicle' THEN
      v_reason := public.vehicle_unavailability(v_item.vehicle_id, v_req.start_at, v_req.end_at, p_request_id);
      IF v_reason IS NOT NULL THEN
        RAISE EXCEPTION '%', v_reason USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Création d'une demande -----------------------------------------------------------
-- p_items : [{"kind": "tool"|"consumable"|"vehicle", "id": "<uuid>", "quantity": 2}, ...]
CREATE OR REPLACE FUNCTION public.create_request(
  p_requester_id uuid,
  p_depot_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_items jsonb,
  p_destination text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.requests
LANGUAGE plpgsql
AS $$
DECLARE
  v_req public.requests;
  v_item jsonb;
  v_kind text;
  v_qty numeric;
  v_threshold numeric;
  v_reasons text[] := '{}';
  v_name text;
  v_type text;
  v_requires boolean;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La demande ne contient aucun article';
  END IF;
  IF p_end <= p_start THEN
    RAISE EXCEPTION 'La date de fin doit être après la date de début';
  END IF;

  SELECT COALESCE(NULLIF(value, '')::numeric, 10) INTO v_threshold FROM public.system_settings WHERE id = 'approval_max_quantity';
  v_threshold := COALESCE(v_threshold, 10);

  INSERT INTO public.requests (requester_id, depot_id, start_at, end_at, destination, notes)
  VALUES (p_requester_id, p_depot_id, p_start, p_end, NULLIF(trim(p_destination), ''), p_notes)
  RETURNING * INTO v_req;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_kind := v_item->>'kind';
    v_qty := COALESCE((v_item->>'quantity')::numeric, 1);

    IF v_kind = 'vehicle' THEN
      INSERT INTO public.request_items (request_id, item_kind, vehicle_id, quantity)
      VALUES (v_req.id, 'vehicle', (v_item->>'id')::uuid, 1);
      v_reasons := array_append(v_reasons, 'véhicule');
    ELSIF v_kind IN ('tool', 'consumable') THEN
      SELECT name, item_type, requires_approval INTO v_name, v_type, v_requires
      FROM public.equipment WHERE id = (v_item->>'id')::uuid;
      IF v_type IS NULL THEN
        RAISE EXCEPTION 'Article introuvable';
      END IF;
      IF v_type <> v_kind THEN
        RAISE EXCEPTION '« % » n''est pas un %', v_name, CASE v_kind WHEN 'tool' THEN 'outil' ELSE 'consommable' END;
      END IF;
      INSERT INTO public.request_items (request_id, item_kind, equipment_id, quantity)
      VALUES (v_req.id, v_kind, (v_item->>'id')::uuid, v_qty);
      IF v_requires THEN
        v_reasons := array_append(v_reasons, format('« %s » demande une validation', v_name));
      ELSIF v_qty > v_threshold THEN
        v_reasons := array_append(v_reasons, format('quantité de « %s » au-delà de %s', v_name, trim_scale(v_threshold)));
      END IF;
    ELSE
      RAISE EXCEPTION 'Type d''article inconnu : %', v_kind;
    END IF;
  END LOOP;

  PERFORM public.check_request_availability(v_req.id);

  UPDATE public.requests
  SET needs_approval = cardinality(v_reasons) > 0,
      approval_reason = NULLIF(array_to_string(ARRAY(SELECT DISTINCT unnest(v_reasons)), ', '), ''),
      status = CASE WHEN cardinality(v_reasons) > 0 THEN 'requested' ELSE 'approved' END,
      decided_by = CASE WHEN cardinality(v_reasons) > 0 THEN NULL ELSE 'Validation automatique' END,
      decided_at = CASE WHEN cardinality(v_reasons) > 0 THEN NULL ELSE now() END
  WHERE id = v_req.id
  RETURNING * INTO v_req;

  IF v_req.needs_approval THEN
    INSERT INTO public.notifications (organization_id, kind, title, message, request_id)
    SELECT v_req.organization_id, 'request_to_approve', 'Demande à valider : ' || v_req.number,
           format('%s %s demande du matériel du %s au %s (%s).', u.first_name, u.last_name,
                  to_char(v_req.start_at, 'DD.MM.YYYY'), to_char(v_req.end_at, 'DD.MM.YYYY'), v_req.approval_reason),
           v_req.id
    FROM public.users u WHERE u.id = v_req.requester_id;
  END IF;

  RETURN v_req;
END;
$$;

-- Validation ou refus --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decide_request(
  p_request_id uuid, p_approve boolean, p_decided_by text, p_note text DEFAULT NULL
)
RETURNS public.requests
LANGUAGE plpgsql
AS $$
DECLARE
  v_req public.requests;
BEGIN
  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable';
  END IF;
  IF v_req.status <> 'requested' THEN
    RAISE EXCEPTION 'La demande % n''est plus en attente de validation', v_req.number;
  END IF;
  IF NULLIF(trim(p_decided_by), '') IS NULL THEN
    RAISE EXCEPTION 'Indiquez qui valide';
  END IF;
  IF NOT p_approve AND NULLIF(trim(p_note), '') IS NULL THEN
    RAISE EXCEPTION 'Indiquez la raison du refus';
  END IF;

  IF p_approve THEN
    -- Une autre demande a pu être validée entre-temps sur le même véhicule
    PERFORM public.check_request_availability(p_request_id);
  END IF;

  UPDATE public.requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      decided_by = trim(p_decided_by), decided_at = now(), decision_note = NULLIF(trim(p_note), '')
  WHERE id = p_request_id
  RETURNING * INTO v_req;

  UPDATE public.notifications SET read_at = now()
  WHERE request_id = p_request_id AND kind = 'request_to_approve' AND read_at IS NULL;

  RETURN v_req;
END;
$$;

-- Préparée / annulée -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_request_status(p_request_id uuid, p_status text)
RETURNS public.requests
LANGUAGE plpgsql
AS $$
DECLARE
  v_req public.requests;
BEGIN
  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable';
  END IF;
  IF p_status = 'ready' AND v_req.status <> 'approved' THEN
    RAISE EXCEPTION 'Seule une demande validée peut être marquée prête';
  END IF;
  IF p_status = 'approved' AND v_req.status <> 'ready' THEN
    RAISE EXCEPTION 'Seule une demande prête peut revenir en préparation';
  END IF;
  IF p_status = 'cancelled' AND v_req.status NOT IN ('requested', 'approved', 'ready') THEN
    RAISE EXCEPTION 'Une demande déjà sortie ne peut plus être annulée';
  END IF;
  IF p_status NOT IN ('ready', 'approved', 'cancelled') THEN
    RAISE EXCEPTION 'Changement d''état non autorisé';
  END IF;

  UPDATE public.requests SET status = p_status WHERE id = p_request_id RETURNING * INTO v_req;
  UPDATE public.notifications SET read_at = now()
  WHERE request_id = p_request_id AND kind = 'request_to_approve' AND read_at IS NULL AND p_status = 'cancelled';
  RETURN v_req;
END;
$$;

-- Sortie d'une demande ----------------------------------------------------------------
-- p_vehicle : {"km": 84215, "fuel": 6, "damages": "rayure porte AR", "signature": "data:image/png;base64,…"}
CREATE OR REPLACE FUNCTION public.issue_request(p_request_id uuid, p_vehicle jsonb DEFAULT NULL)
RETURNS public.requests
LANGUAGE plpgsql
AS $$
DECLARE
  v_req public.requests;
  v_tools jsonb;
  v_note public.delivery_notes;
  v_item record;
  v_vehicle public.vehicles;
  v_label text;
BEGIN
  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable';
  END IF;
  IF v_req.status NOT IN ('approved', 'ready') THEN
    RAISE EXCEPTION 'La demande % doit être validée avant la sortie', v_req.number;
  END IF;
  v_label := 'Demande ' || v_req.number;

  -- Outils : bon de sortie + emprunts (contrôle de stock dans create_checkout)
  SELECT jsonb_agg(jsonb_build_object('equipment_id', equipment_id, 'quantity', ceil(quantity)::integer))
  INTO v_tools
  FROM public.request_items WHERE request_id = p_request_id AND item_kind = 'tool';

  IF v_tools IS NOT NULL THEN
    v_note := public.create_checkout(v_req.requester_id, v_req.end_at, v_tools, concat_ws(' · ', v_label, v_req.destination));
  ELSE
    INSERT INTO public.delivery_notes (user_id, due_date, notes, status)
    VALUES (v_req.requester_id, v_req.end_at, concat_ws(' · ', v_label, v_req.destination), 'returned')
    RETURNING * INTO v_note;
  END IF;

  -- Consommables : décomptés du dépôt de la demande
  FOR v_item IN SELECT * FROM public.request_items WHERE request_id = p_request_id AND item_kind = 'consumable' LOOP
    PERFORM public.consume_stock(v_item.equipment_id, v_req.depot_id, v_item.quantity,
                                 v_req.requester_id, COALESCE(v_req.destination, v_label), v_label, v_note.id);
  END LOOP;

  -- Véhicule : état des lieux de départ
  FOR v_item IN SELECT * FROM public.request_items WHERE request_id = p_request_id AND item_kind = 'vehicle' LOOP
    IF p_vehicle IS NULL OR p_vehicle->>'km' IS NULL OR p_vehicle->>'fuel' IS NULL THEN
      RAISE EXCEPTION 'Relevez le kilométrage et le carburant du véhicule avant la sortie';
    END IF;
    SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_item.vehicle_id FOR UPDATE;
    IF v_vehicle.status <> 'available' THEN
      RAISE EXCEPTION '% n''est pas disponible (déjà sorti ou en maintenance)', v_vehicle.name;
    END IF;
    IF (p_vehicle->>'km')::integer < v_vehicle.current_km THEN
      RAISE EXCEPTION 'Le kilométrage saisi (%) est inférieur au dernier relevé (%)', p_vehicle->>'km', v_vehicle.current_km;
    END IF;
    INSERT INTO public.vehicle_trips (vehicle_id, request_id, driver_id, start_km, start_fuel, start_damages, start_signature)
    VALUES (v_vehicle.id, p_request_id, v_req.requester_id, (p_vehicle->>'km')::integer, (p_vehicle->>'fuel')::smallint,
            NULLIF(trim(p_vehicle->>'damages'), ''), p_vehicle->>'signature');
    UPDATE public.vehicles
    SET status = 'in_use', current_km = (p_vehicle->>'km')::integer, fuel_level = (p_vehicle->>'fuel')::smallint
    WHERE id = v_vehicle.id;
  END LOOP;

  UPDATE public.requests SET status = 'out', delivery_note_id = v_note.id, issued_at = now()
  WHERE id = p_request_id;

  PERFORM public.refresh_request_status(p_request_id);
  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id;
  RETURN v_req;
END;
$$;

-- Clôture automatique quand tout est revenu ----------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_request_status(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_req public.requests;
BEGIN
  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND OR v_req.status <> 'out' THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.checkouts WHERE delivery_note_id = v_req.delivery_note_id AND status IN ('active', 'overdue')) THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.vehicle_trips WHERE request_id = p_request_id AND end_at IS NULL) THEN
    RETURN;
  END IF;
  UPDATE public.requests SET status = 'closed', closed_at = now() WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.checkouts_refresh_request()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_request_id uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.delivery_note_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id INTO v_request_id FROM public.requests WHERE delivery_note_id = NEW.delivery_note_id;
  IF v_request_id IS NOT NULL THEN
    PERFORM public.refresh_request_status(v_request_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER checkouts_refresh_request_trigger
  AFTER UPDATE OF status ON public.checkouts
  FOR EACH ROW EXECUTE FUNCTION public.checkouts_refresh_request();

-- Retour d'un véhicule -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.return_vehicle(
  p_vehicle_id uuid, p_km integer, p_fuel smallint, p_damages text DEFAULT NULL, p_signature text DEFAULT NULL
)
RETURNS public.vehicle_trips
LANGUAGE plpgsql
AS $$
DECLARE
  v_trip public.vehicle_trips;
BEGIN
  SELECT * INTO v_trip FROM public.vehicle_trips WHERE vehicle_id = p_vehicle_id AND end_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ce véhicule n''est pas sorti';
  END IF;
  IF p_km IS NULL OR p_km < v_trip.start_km THEN
    RAISE EXCEPTION 'Le kilométrage de retour doit être au moins %', v_trip.start_km;
  END IF;
  IF p_fuel IS NULL OR p_fuel NOT BETWEEN 0 AND 8 THEN
    RAISE EXCEPTION 'Niveau de carburant invalide';
  END IF;

  UPDATE public.vehicle_trips
  SET end_at = now(), end_km = p_km, end_fuel = p_fuel, end_damages = NULLIF(trim(p_damages), ''), end_signature = p_signature
  WHERE id = v_trip.id
  RETURNING * INTO v_trip;

  UPDATE public.vehicles
  SET status = 'available', current_km = p_km, fuel_level = p_fuel
  WHERE id = p_vehicle_id;

  IF v_trip.request_id IS NOT NULL THEN
    PERFORM public.refresh_request_status(v_trip.request_id);
  END IF;
  RETURN v_trip;
END;
$$;

-- Échéances de la flotte ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_vehicle_deadlines(p_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer := 0;
  v_rows integer;
BEGIN
  INSERT INTO public.notifications (organization_id, kind, title, message, vehicle_id, dedupe_key)
  SELECT v.organization_id, 'vehicle_deadline', d.label || ' : ' || v.name,
         format('%s (%s) : %s le %s.', v.name, v.plate, lower(d.label), to_char(d.due, 'DD.MM.YYYY')),
         v.id, 'vehicle:' || v.id || ':' || d.code || ':' || d.due
  FROM public.vehicles v
  CROSS JOIN LATERAL (VALUES
    ('service', 'Service', v.next_service_date),
    ('tires', 'Changement de pneus', v.tires_date),
    ('inspection', 'Expertise', v.inspection_date)
  ) AS d(code, label, due)
  WHERE v.status <> 'retired'
    AND d.due IS NOT NULL
    AND d.due <= current_date + p_days
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;
  RETURN v_count;
END;
$$;

-- Vue des demandes avec demandeur et contenu (listes et planning) ---------------------------
CREATE OR REPLACE VIEW public.requests_overview WITH (security_invoker = true) AS
SELECT
  r.*,
  u.first_name || ' ' || u.last_name AS requester_name,
  d.name AS depot_name,
  (SELECT count(*) FROM public.request_items i WHERE i.request_id = r.id AND i.item_kind = 'tool') AS tool_lines,
  (SELECT count(*) FROM public.request_items i WHERE i.request_id = r.id AND i.item_kind = 'consumable') AS consumable_lines,
  (SELECT string_agg(v.name, ', ') FROM public.request_items i JOIN public.vehicles v ON v.id = i.vehicle_id WHERE i.request_id = r.id) AS vehicle_names
FROM public.requests r
JOIN public.users u ON u.id = r.requester_id
JOIN public.depots d ON d.id = r.depot_id;

-- Sécurité : RLS (ouverte tant que l'app n'a pas de connexion, comme le reste) ---------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vehicles', 'requests', 'request_items', 'vehicle_trips'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_open_access') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t || '_open_access', t);
    END IF;
  END LOOP;
END $$;
