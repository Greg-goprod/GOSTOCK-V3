/*
  Corrections issues de la batterie de tests Chrome (rapport docs/tests/rapport-chrome.md).

  P10 — L'exemplaire n'était pas rattaché aux sorties par demande et par kit : l'exemplaire restait
        « disponible » alors que l'outil était dehors.
        * create_checkout : un outil suivi par exemplaires reçoit un exemplaire disponible quand
          aucun n'est indiqué (un par unité sortie).
        * issue_request : les exemplaires scannés à la préparation sont ceux qui sortent.
        * Réparation des sorties en cours sans exemplaire.
  P8  — La préparation d'une demande est enregistrée en base (par ligne, avec les exemplaires),
        au lieu d'exister seulement dans la fiche ouverte : set_request_preparation().
  P9  — Restauration : les lignes déjà présentes (même clé primaire) sont écartées avant l'insertion,
        et les contrôles des nouvelles sorties (stock, formation, personne, réparation, transit,
        entretien) ne s'appliquent pas aux sorties remises depuis une sauvegarde.
*/

-- 1. Préparation enregistrée -----------------------------------------------------------------------
ALTER TABLE public.request_items
  ADD COLUMN IF NOT EXISTS prepared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prepared_instance_ids uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.set_request_preparation(p_item_id uuid, p_prepared boolean, p_instance_ids uuid[] DEFAULT '{}')
RETURNS public.request_items
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item public.request_items;
  v_status text;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT public.app_has('scan') THEN
    RAISE EXCEPTION 'Seul le magasin prépare les demandes';
  END IF;
  SELECT * INTO v_item FROM public.request_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ligne de demande introuvable';
  END IF;
  SELECT status INTO v_status FROM public.requests WHERE id = v_item.request_id;
  IF v_status NOT IN ('approved', 'ready') THEN
    RAISE EXCEPTION 'Seule une demande validée peut être préparée';
  END IF;
  IF COALESCE(array_length(p_instance_ids, 1), 0) > 0 AND EXISTS (
    SELECT 1 FROM unnest(p_instance_ids) AS x(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.equipment_instances ei WHERE ei.id = x.id AND ei.equipment_id = v_item.equipment_id)
  ) THEN
    RAISE EXCEPTION 'Cet exemplaire ne correspond pas à l''article de la demande';
  END IF;
  IF COALESCE(array_length(p_instance_ids, 1), 0) > ceil(v_item.quantity) THEN
    RAISE EXCEPTION 'Plus d''exemplaires scannés que demandés';
  END IF;
  UPDATE public.request_items
  SET prepared = p_prepared, prepared_instance_ids = COALESCE(p_instance_ids, '{}')
  WHERE id = p_item_id
  RETURNING * INTO v_item;
  RETURN v_item;
END;
$$;

-- 2. Sortie : un exemplaire pour chaque unité d'un outil suivi par exemplaires ----------------------
CREATE OR REPLACE FUNCTION public.create_checkout(p_user_id uuid, p_due_date timestamptz, p_items jsonb, p_notes text DEFAULT NULL)
RETURNS public.delivery_notes
LANGUAGE plpgsql
AS $$
DECLARE
  v_note public.delivery_notes;
  v_item jsonb;
  v_quantity integer;
  v_instance uuid;
  v_kit uuid;
  v_equipment uuid;
  v_auto uuid;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Aucun équipement à sortir';
  END IF;

  INSERT INTO public.delivery_notes (user_id, due_date, notes)
  VALUES (p_user_id, p_due_date, p_notes)
  RETURNING * INTO v_note;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_instance := NULLIF(v_item->>'instance_id', '')::uuid;
    v_kit := NULLIF(v_item->>'kit_id', '')::uuid;
    v_equipment := (v_item->>'equipment_id')::uuid;

    IF v_instance IS NOT NULL THEN
      PERFORM 1 FROM public.equipment_instances
      WHERE id = v_instance AND equipment_id = v_equipment
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Exemplaire introuvable pour cet équipement';
      END IF;
      IF EXISTS (SELECT 1 FROM public.checkouts WHERE instance_id = v_instance AND status IN ('active', 'overdue')) THEN
        RAISE EXCEPTION 'Cet exemplaire est déjà sorti';
      END IF;
      INSERT INTO public.checkouts (equipment_id, instance_id, user_id, delivery_note_id, due_date, status, notes, kit_id)
      VALUES (v_equipment, v_instance, p_user_id, v_note.id, p_due_date, 'active', p_notes, v_kit);
      CONTINUE;
    END IF;

    v_quantity := COALESCE((v_item->>'quantity')::integer, 1);
    IF v_quantity < 1 THEN
      RAISE EXCEPTION 'Quantité invalide';
    END IF;

    -- Outil suivi par exemplaires : chaque unité part avec un exemplaire disponible
    IF EXISTS (SELECT 1 FROM public.equipment_instances WHERE equipment_id = v_equipment) THEN
      FOR i IN 1..v_quantity LOOP
        SELECT ei.id INTO v_auto
        FROM public.equipment_instances ei
        WHERE ei.equipment_id = v_equipment AND ei.status = 'available'
          AND NOT EXISTS (SELECT 1 FROM public.checkouts c WHERE c.instance_id = ei.id AND c.status IN ('active', 'overdue'))
        ORDER BY ei.instance_number
        LIMIT 1
        FOR UPDATE SKIP LOCKED;
        -- Sans exemplaire libre, le contrôle de stock de la base refuse la sortie avec son message
        INSERT INTO public.checkouts (equipment_id, instance_id, user_id, delivery_note_id, due_date, status, notes, kit_id)
        VALUES (v_equipment, v_auto, p_user_id, v_note.id, p_due_date, 'active', p_notes, v_kit);
      END LOOP;
      CONTINUE;
    END IF;

    INSERT INTO public.checkouts (equipment_id, user_id, delivery_note_id, due_date, status, notes, kit_id)
    SELECT v_equipment, p_user_id, v_note.id, p_due_date, 'active', p_notes, v_kit
    FROM generate_series(1, v_quantity);
  END LOOP;

  RETURN v_note;
END;
$$;

-- 3. Sortie d'une demande : les exemplaires scannés à la préparation ---------------------------------
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

  -- Une ligne par exemplaire scanné, puis le reste de la quantité (exemplaire attribué par create_checkout)
  SELECT jsonb_agg(line) INTO v_tools FROM (
    SELECT jsonb_build_object('equipment_id', ri.equipment_id, 'instance_id', inst) AS line
    FROM public.request_items ri, unnest(ri.prepared_instance_ids) AS inst
    WHERE ri.request_id = p_request_id AND ri.item_kind = 'tool'
    UNION ALL
    SELECT jsonb_build_object('equipment_id', ri.equipment_id,
                              'quantity', ceil(ri.quantity)::integer - COALESCE(array_length(ri.prepared_instance_ids, 1), 0))
    FROM public.request_items ri
    WHERE ri.request_id = p_request_id AND ri.item_kind = 'tool'
      AND ceil(ri.quantity)::integer > COALESCE(array_length(ri.prepared_instance_ids, 1), 0)
  ) lines;

  IF v_tools IS NOT NULL THEN
    v_note := public.create_checkout(v_req.requester_id, v_req.end_at, v_tools, concat_ws(' · ', v_label, v_req.destination));
  ELSE
    INSERT INTO public.delivery_notes (user_id, due_date, notes, status)
    VALUES (v_req.requester_id, v_req.end_at, concat_ws(' · ', v_label, v_req.destination), 'returned')
    RETURNING * INTO v_note;
  END IF;

  FOR v_item IN SELECT * FROM public.request_items WHERE request_id = p_request_id AND item_kind = 'consumable' LOOP
    PERFORM public.consume_stock(v_item.equipment_id, v_req.depot_id, v_item.quantity,
                                 v_req.requester_id, COALESCE(v_req.destination, v_label), v_label, v_note.id);
  END LOOP;

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

-- 4. Réparation des sorties en cours sans exemplaire (outils suivis par exemplaires) ----------------
DO $$
DECLARE
  v_checkout record;
  v_instance uuid;
BEGIN
  FOR v_checkout IN
    SELECT c.id, c.equipment_id FROM public.checkouts c
    WHERE c.status IN ('active', 'overdue') AND c.instance_id IS NULL
      AND EXISTS (SELECT 1 FROM public.equipment_instances ei WHERE ei.equipment_id = c.equipment_id)
    ORDER BY c.checkout_date
  LOOP
    SELECT ei.id INTO v_instance
    FROM public.equipment_instances ei
    WHERE ei.equipment_id = v_checkout.equipment_id AND ei.status = 'available'
      AND NOT EXISTS (SELECT 1 FROM public.checkouts c WHERE c.instance_id = ei.id AND c.status IN ('active', 'overdue'))
    ORDER BY ei.instance_number
    LIMIT 1;
    CONTINUE WHEN v_instance IS NULL;
    UPDATE public.checkouts SET instance_id = v_instance WHERE id = v_checkout.id;
    UPDATE public.equipment_instances SET status = 'checked-out' WHERE id = v_instance;
  END LOOP;
END $$;

-- 5. Restauration : lignes présentes écartées, contrôles de sortie suspendus -----------------------
-- Les contrôles des nouvelles sorties ne s'appliquent pas à l'historique remis depuis une sauvegarde
DO $$
DECLARE
  v_fn text;
  v_def text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY['checkouts_check_availability', 'checkouts_check_person', 'checkouts_check_plans',
                              'checkouts_check_repair', 'checkouts_check_training', 'checkouts_check_transit'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_fn;
    CONTINUE WHEN v_def IS NULL OR v_def LIKE '%gomat.restoring%';
    -- Fins de ligne Unix ou Windows selon l'origine de la fonction
    EXECUTE regexp_replace(v_def, E'\\nBEGIN\\r?\\n',
      E'\nBEGIN\n  IF current_setting(''gomat.restoring'', true) = ''on'' THEN\n    RETURN NEW;\n  END IF;\n');
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.restore_missing_rows(p_table text, p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_columns text;
  v_key text;
  v_count integer;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT public.app_has('settings') THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF p_table IN ('user_badges', 'push_subscriptions') OR NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = p_table
  ) THEN
    RAISE EXCEPTION 'Table inconnue : %', p_table;
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN 0;
  END IF;
  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO v_columns
  FROM pg_attribute a
  WHERE a.attrelid = format('public.%I', p_table)::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '';
  -- Clé primaire : une ligne déjà présente n'est même pas présentée à l'insertion (ni contrôle, ni conflit)
  SELECT string_agg(format('x.%1$I = r.%1$I', a.attname), ' AND ') INTO v_key
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
  WHERE i.indrelid = format('public.%I', p_table)::regclass AND i.indisprimary;

  PERFORM set_config('gomat.restoring', 'on', true);
  EXECUTE format(
    'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_recordset(NULL::public.%1$I, $1) r %3$s ON CONFLICT DO NOTHING',
    p_table, v_columns,
    CASE WHEN v_key IS NULL THEN '' ELSE format('WHERE NOT EXISTS (SELECT 1 FROM public.%I x WHERE %s)', p_table, v_key) END
  ) USING p_rows;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config('gomat.restoring', 'off', true);
  RETURN v_count;
END;
$$;

-- 6. Droits ----------------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.set_request_preparation(uuid, boolean, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_request_preparation(uuid, boolean, uuid[]) TO authenticated, service_role;
ALTER FUNCTION public.set_request_preparation(uuid, boolean, uuid[]) SET search_path = public, extensions;
ALTER FUNCTION public.create_checkout(uuid, timestamptz, jsonb, text) SET search_path = public, extensions;
ALTER FUNCTION public.issue_request(uuid, jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.restore_missing_rows(text, jsonb) SET search_path = public, extensions;
