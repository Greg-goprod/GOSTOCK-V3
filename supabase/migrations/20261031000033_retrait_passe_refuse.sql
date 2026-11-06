-- Lot 29 — Le serveur refuse un retrait dans le passé (avant aujourd'hui, heure suisse).
-- Reprend create_request tel quel (migration 00018) et ajoute ce contrôle.

CREATE OR REPLACE FUNCTION public.create_request(
  p_requester_id uuid, p_depot_id uuid, p_start timestamptz, p_end timestamptz,
  p_items jsonb, p_destination text DEFAULT NULL, p_notes text DEFAULT NULL
)
RETURNS public.requests
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item jsonb;
  v_problem text;
BEGIN
  IF current_setting('role', true) = 'authenticated' THEN
    IF public.app_user_id() IS NULL THEN
      RAISE EXCEPTION 'Accès refusé';
    END IF;
    IF p_requester_id IS DISTINCT FROM public.app_user_id()
       AND NOT (public.app_has('scan') OR public.app_has('approve')) THEN
      RAISE EXCEPTION 'Vous ne pouvez faire une demande que pour vous-même';
    END IF;
  END IF;

  -- Un retrait ne peut pas être antérieur à aujourd'hui (heure suisse) : l'interface le bloque déjà,
  -- le serveur le refuse aussi. Les appels internes (console, déclencheurs) ne sont pas concernés.
  IF current_setting('role', true) = 'authenticated'
     AND p_start < (date_trunc('day', now() AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich') THEN
    RAISE EXCEPTION 'Le retrait est dans le passé : choisis une date à venir.' USING ERRCODE = 'check_violation';
  END IF;

  v_problem := public.person_problem(p_requester_id, p_end);
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION '%', v_problem;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    v_problem := NULL;
    IF v_item->>'kind' = 'vehicle' THEN
      SELECT public.license_covers(p_requester_id, v.license_category, p_end) INTO v_problem
      FROM public.vehicles v WHERE v.id = (v_item->>'id')::uuid;
    ELSIF v_item->>'kind' = 'tool' THEN
      v_problem := public.training_problem(p_requester_id, (v_item->>'id')::uuid, p_end);
    END IF;
    IF v_problem IS NOT NULL THEN
      RAISE EXCEPTION '%', v_problem;
    END IF;
  END LOOP;

  RETURN public.create_request_impl(p_requester_id, p_depot_id, p_start, p_end, p_items, p_destination, p_notes);
END;
$$;
ALTER FUNCTION public.create_request(uuid, uuid, timestamptz, timestamptz, jsonb, text, text) SET search_path = public, extensions;
