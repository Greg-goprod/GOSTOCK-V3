-- Lot 30 — Prolongation d'emprunts
-- 1. extension_conflict : y a-t-il une réservation qui empêche de garder un outil plus longtemps ?
-- 2. extend_checkouts   : le magasin prolonge des sorties (toute une sortie, ou seulement ce qui reste
--                         après un retour partiel)
-- 3. extend_request     : le magasin prolonge une demande « sortie » (outils restants et véhicule)
-- 4. request_extension  : le collaborateur demande une prolongation (avis au magasin)

-- 1. Conflit de réservation --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extension_conflict(p_equipment_id uuid, p_from timestamptz, p_to timestamptz, p_exclude uuid[])
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_name text;
  v_total integer;
  v_stay integer;
  v_maint integer;
  v_other integer;
  v_reserved numeric;
BEGIN
  SELECT name, total_quantity INTO v_name, v_total FROM public.equipment WHERE id = p_equipment_id;
  IF v_total IS NULL THEN
    RETURN NULL;
  END IF;
  -- Les sorties prolongées restent dehors pendant toute la période
  SELECT count(*) INTO v_stay FROM public.checkouts WHERE id = ANY (p_exclude) AND equipment_id = p_equipment_id;
  SELECT count(*) INTO v_maint FROM public.equipment_maintenance WHERE equipment_id = p_equipment_id AND status = 'in_progress';
  -- Autres sorties qui ne seront pas rentrées au début de la période
  SELECT count(*) INTO v_other FROM public.checkouts
  WHERE equipment_id = p_equipment_id AND NOT (id = ANY (p_exclude))
    AND (status IN ('overdue', 'lost') OR (status = 'active' AND due_date > p_from));
  -- Demandes validées ou prêtes qui chevauchent la période de prolongation
  SELECT COALESCE(sum(i.quantity), 0) INTO v_reserved
  FROM public.request_items i JOIN public.requests r ON r.id = i.request_id
  WHERE i.equipment_id = p_equipment_id AND r.status IN ('approved', 'ready')
    AND tstzrange(r.start_at, r.end_at, '[)') && tstzrange(p_from, p_to, '[)');
  IF v_total - v_maint - v_other - v_stay - v_reserved < 0 THEN
    RETURN format('« %s » est déjà réservé par d''autres demandes entre le %s et le %s',
                  v_name, to_char(p_from AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY'), to_char(p_to AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY'));
  END IF;
  RETURN NULL;
END;
$$;

-- 2. Prolonger des sorties ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extend_checkouts(p_checkout_ids uuid[], p_new_due timestamptz, p_note text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rows public.checkouts[];
  v_notes uuid[];
  v_eq record;
  v_problem text;
  v_who text;
  v_req record;
  v_vehicle uuid;
  v_count integer;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT (public.app_has('scan') OR public.app_has('approve')) THEN
    RAISE EXCEPTION 'Seul le magasin peut prolonger un emprunt';
  END IF;
  IF p_checkout_ids IS NULL OR cardinality(p_checkout_ids) = 0 THEN
    RAISE EXCEPTION 'Aucune sortie à prolonger';
  END IF;
  IF p_new_due IS NULL OR p_new_due <= now() THEN
    RAISE EXCEPTION 'La nouvelle date de retour doit être à venir';
  END IF;
  IF p_new_due > now() + interval '1 year' THEN
    RAISE EXCEPTION 'Une prolongation ne peut pas dépasser un an';
  END IF;

  SELECT array_agg(c) INTO v_rows FROM (SELECT * FROM public.checkouts WHERE id = ANY (p_checkout_ids) FOR UPDATE) c;
  IF v_rows IS NULL OR cardinality(v_rows) <> cardinality(p_checkout_ids)
     OR EXISTS (SELECT 1 FROM unnest(v_rows) x WHERE x.status NOT IN ('active', 'overdue')) THEN
    RAISE EXCEPTION 'Seules les sorties en cours (ni rendues ni perdues) peuvent être prolongées';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_rows) x WHERE x.due_date >= p_new_due) THEN
    RAISE EXCEPTION 'La nouvelle date doit être après le retour prévu';
  END IF;

  -- Outils : pas de conflit avec une réservation à venir
  FOR v_eq IN SELECT x.equipment_id, min(x.due_date) AS from_at FROM unnest(v_rows) x GROUP BY x.equipment_id LOOP
    v_problem := public.extension_conflict(v_eq.equipment_id, v_eq.from_at, p_new_due, p_checkout_ids);
    IF v_problem IS NOT NULL THEN
      RAISE EXCEPTION '%', v_problem;
    END IF;
  END LOOP;

  SELECT COALESCE(array_agg(DISTINCT x.delivery_note_id), '{}') INTO v_notes FROM unnest(v_rows) x WHERE x.delivery_note_id IS NOT NULL;

  -- Véhicule de la demande liée : encore dehors ? alors il ne doit pas être réservé par un autre
  FOR v_req IN SELECT * FROM public.requests WHERE delivery_note_id = ANY (v_notes) AND status = 'out' LOOP
    SELECT t.vehicle_id INTO v_vehicle FROM public.vehicle_trips t WHERE t.request_id = v_req.id AND t.end_at IS NULL LIMIT 1;
    IF v_vehicle IS NOT NULL THEN
      v_problem := public.vehicle_unavailability(v_vehicle, v_req.end_at, p_new_due, v_req.id);
      IF v_problem IS NOT NULL THEN
        RAISE EXCEPTION '%', v_problem;
      END IF;
    END IF;
  END LOOP;

  SELECT COALESCE(first_name || ' ' || last_name, 'le magasin') INTO v_who FROM public.users WHERE id = public.app_user_id();
  UPDATE public.checkouts
  SET due_date = p_new_due,
      status = CASE WHEN status = 'overdue' THEN 'active' ELSE status END,
      notes = concat_ws(E'\n', notes, format('Prolongé jusqu''au %s par %s%s', to_char(p_new_due AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY'), COALESCE(v_who, 'le magasin'),
                                             COALESCE(' : ' || NULLIF(trim(p_note), ''), '')))
  WHERE id = ANY (p_checkout_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.delivery_notes SET due_date = GREATEST(due_date, p_new_due) WHERE id = ANY (v_notes);
  UPDATE public.requests SET end_at = GREATEST(end_at, p_new_due) WHERE delivery_note_id = ANY (v_notes) AND status = 'out';

  -- Avis à chaque emprunteur concerné
  INSERT INTO public.notifications (kind, title, message, recipient_user_id, dedupe_key)
  SELECT 'loan_extended', 'Emprunt prolongé',
         format('Ton emprunt « %s » est prolongé jusqu''au %s.', e.name, to_char(p_new_due AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY')),
         x.user_id, 'loan_extended:' || x.id || ':' || to_char(p_new_due, 'YYYYMMDDHH24MI')
  FROM unnest(v_rows) x JOIN public.equipment e ON e.id = x.equipment_id
  WHERE x.user_id IS NOT NULL
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN v_count;
END;
$$;

-- 3. Prolonger une demande « sortie » (outils restants et/ou véhicule) -------------------------
CREATE OR REPLACE FUNCTION public.extend_request(p_request_id uuid, p_new_end timestamptz, p_note text DEFAULT NULL)
RETURNS public.requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_req public.requests;
  v_ids uuid[];
  v_vehicle uuid;
  v_problem text;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT (public.app_has('scan') OR public.app_has('approve')) THEN
    RAISE EXCEPTION 'Seul le magasin peut prolonger une demande';
  END IF;
  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable';
  END IF;
  IF v_req.status <> 'out' THEN
    RAISE EXCEPTION 'Seule une demande sortie peut être prolongée';
  END IF;
  IF p_new_end IS NULL OR p_new_end <= now() OR p_new_end <= v_req.end_at THEN
    RAISE EXCEPTION 'La nouvelle date doit être après le retour prévu (%)', to_char(v_req.end_at AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY');
  END IF;

  SELECT t.vehicle_id INTO v_vehicle FROM public.vehicle_trips t WHERE t.request_id = v_req.id AND t.end_at IS NULL LIMIT 1;
  IF v_vehicle IS NOT NULL THEN
    v_problem := public.vehicle_unavailability(v_vehicle, v_req.end_at, p_new_end, v_req.id);
    IF v_problem IS NOT NULL THEN
      RAISE EXCEPTION '%', v_problem;
    END IF;
  END IF;

  -- Seules les sorties encore dehors sont prolongées (un retour partiel laisse les autres tranquilles)
  SELECT COALESCE(array_agg(id), '{}') INTO v_ids FROM public.checkouts
  WHERE delivery_note_id = v_req.delivery_note_id AND status IN ('active', 'overdue');
  IF cardinality(v_ids) > 0 THEN
    PERFORM public.extend_checkouts(v_ids, p_new_end, p_note);
  END IF;

  UPDATE public.requests SET end_at = GREATEST(end_at, p_new_end) WHERE id = p_request_id RETURNING * INTO v_req;
  IF cardinality(v_ids) = 0 THEN
    INSERT INTO public.notifications (organization_id, kind, title, message, request_id, recipient_user_id, dedupe_key)
    VALUES (v_req.organization_id, 'loan_extended', 'Demande prolongée',
            format('Ta demande %s est prolongée jusqu''au %s.', v_req.number, to_char(p_new_end AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY')),
            v_req.id, v_req.requester_id, 'loan_extended:' || v_req.id || ':' || to_char(p_new_end, 'YYYYMMDDHH24MI'))
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;
  RETURN v_req;
END;
$$;

-- 4. Demande de prolongation par le collaborateur ---------------------------------------------
CREATE OR REPLACE FUNCTION public.request_extension(
  p_new_due timestamptz, p_reason text DEFAULT NULL, p_checkout_id uuid DEFAULT NULL, p_request_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_me uuid := public.app_user_id();
  v_name text;
  v_what text;
  v_due timestamptz;
  v_eq uuid;
  v_req_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF p_new_due IS NULL OR p_new_due <= now() OR p_new_due > now() + interval '90 days' THEN
    RAISE EXCEPTION 'Choisis une date de retour à venir (90 jours au plus)';
  END IF;
  SELECT first_name || ' ' || last_name INTO v_name FROM public.users WHERE id = v_me;

  IF p_checkout_id IS NOT NULL THEN
    SELECT e.name, c.due_date, c.equipment_id INTO v_what, v_due, v_eq
    FROM public.checkouts c JOIN public.equipment e ON e.id = c.equipment_id
    WHERE c.id = p_checkout_id AND c.user_id = v_me AND c.status IN ('active', 'overdue');
    IF v_what IS NULL THEN
      RAISE EXCEPTION 'Tu ne peux demander une prolongation que pour ton matériel en cours';
    END IF;
  ELSIF p_request_id IS NOT NULL THEN
    SELECT r.number, r.end_at INTO v_what, v_due FROM public.requests r WHERE r.id = p_request_id AND r.requester_id = v_me AND r.status = 'out';
    IF v_what IS NULL THEN
      RAISE EXCEPTION 'Tu ne peux demander une prolongation que pour ta demande en cours';
    END IF;
    v_what := 'demande ' || v_what;
    v_req_id := p_request_id;
  ELSE
    RAISE EXCEPTION 'Indique le matériel ou la demande à prolonger';
  END IF;
  IF p_new_due <= v_due THEN
    RAISE EXCEPTION 'La nouvelle date doit être après le retour prévu (%)', to_char(v_due AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY');
  END IF;

  -- Avis au magasin (sans destinataire précis) ; une même demande ne se répète pas
  INSERT INTO public.notifications (kind, title, message, equipment_id, request_id, dedupe_key)
  VALUES ('extension_request', 'Demande de prolongation : ' || v_what,
          format('%s demande de garder « %s » jusqu''au %s (retour prévu le %s)%s.', v_name, v_what,
                 to_char(p_new_due AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY'), to_char(v_due AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY'),
                 COALESCE(' : ' || NULLIF(trim(p_reason), ''), '')),
          v_eq, v_req_id, 'extension_request:' || COALESCE(p_checkout_id::text, p_request_id::text) || ':' || to_char(p_new_due, 'YYYYMMDD'))
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.extend_checkouts(uuid[], timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.extend_request(uuid, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_extension(timestamptz, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extend_checkouts(uuid[], timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_request(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_extension(timestamptz, text, uuid, uuid) TO authenticated;
