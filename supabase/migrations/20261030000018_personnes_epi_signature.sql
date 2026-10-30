/*
  Personnes : EPI, signature à la remise, départ, intérimaires et sous-traitants

  - users.person_kind / company / access_until : collaborateur, intérimaire ou sous-traitant.
    Passé la date de fin d'accès, la personne ne peut plus se connecter ni être servie au comptoir
    (badge refusé), et un emprunt ou une demande ne peut pas dépasser cette date.
  - users.left_on : date de départ (le solde de départ liste ce qui reste à rendre).
  - ppe_types / ppe_issues / user_ppe_sizes : EPI (casque, chaussures, harnais…) remis par personne,
    avec taille, date de renouvellement et signature ; un EPI lié à un article de consommable est
    décompté du stock du dépôt à la remise.
  - delivery_notes.signature : signature de la personne à la remise du matériel de valeur
    (article marqué « signature exigée » ou prix d'achat au-delà du seuil « signature_min_value »).
  - check_people_deadlines() : EPI à renouveler (30 jours) et fins de mission avec du matériel encore
    sorti (3 jours).
*/

-- 1. Intérimaires, sous-traitants, départs -----------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS person_kind text NOT NULL DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS access_until date,
  ADD COLUMN IF NOT EXISTS left_on date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_person_kind_check') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_person_kind_check CHECK (person_kind IN ('employee', 'temp', 'subcontractor'));
  END IF;
END $$;

-- Une fiche dont l'accès est échu compte comme inactive pour toutes les règles d'accès
CREATE OR REPLACE FUNCTION public.app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.users
  WHERE auth_user_id = auth.uid() AND active
    AND (access_until IS NULL OR access_until >= (now() AT TIME ZONE 'Europe/Zurich')::date);
$$;

CREATE OR REPLACE FUNCTION public.whoami()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_user public.users;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_user FROM public.users WHERE auth_user_id = v_uid;
  IF NOT FOUND THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    UPDATE public.users SET auth_user_id = v_uid
    WHERE lower(email) = lower(v_email) AND auth_user_id IS NULL
    RETURNING * INTO v_user;
  END IF;
  IF v_user.id IS NULL OR NOT v_user.active
     OR (v_user.access_until IS NOT NULL AND v_user.access_until < (now() AT TIME ZONE 'Europe/Zurich')::date) THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'id', v_user.id,
    'first_name', v_user.first_name,
    'last_name', v_user.last_name,
    'email', v_user.email,
    'role', v_user.role,
    'permissions', to_jsonb(public.app_permissions()),
    'depot_ids', COALESCE((SELECT jsonb_agg(depot_id) FROM public.user_depots WHERE user_id = v_user.id), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.find_user_by_badge(p_code text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_code text := lower(regexp_replace(trim(p_code), '^GOMAT-USER:', '', 'i'));
  v_user uuid;
BEGIN
  IF NOT public.app_has('scan') THEN
    RAISE EXCEPTION 'Seul le magasin peut scanner un badge';
  END IF;
  SELECT b.user_id INTO v_user
  FROM public.user_badges b JOIN public.users u ON u.id = b.user_id
  WHERE b.code = v_code AND u.active
    AND (u.access_until IS NULL OR u.access_until >= (now() AT TIME ZONE 'Europe/Zurich')::date);
  RETURN v_user;
END;
$$;

-- La personne peut-elle emprunter jusqu'à cette date ? NULL = oui, sinon la raison
CREATE OR REPLACE FUNCTION public.person_problem(p_user_id uuid, p_until timestamptz)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user public.users;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF v_user.id IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT v_user.active THEN
    RETURN format('%s %s n''a plus accès (fiche désactivée)', v_user.first_name, v_user.last_name);
  END IF;
  IF v_user.access_until IS NOT NULL AND v_user.access_until < (now() AT TIME ZONE 'Europe/Zurich')::date THEN
    RETURN format('L''accès de %s %s a pris fin le %s', v_user.first_name, v_user.last_name, to_char(v_user.access_until, 'DD.MM.YYYY'));
  END IF;
  IF v_user.access_until IS NOT NULL AND (p_until AT TIME ZONE 'Europe/Zurich')::date > v_user.access_until THEN
    RETURN format('%s %s termine sa mission le %s : retour à prévoir au plus tard ce jour-là',
                  v_user.first_name, v_user.last_name, to_char(v_user.access_until, 'DD.MM.YYYY'));
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.checkouts_check_person()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_problem text;
BEGIN
  IF NEW.status NOT IN ('active', 'overdue') THEN
    RETURN NEW;
  END IF;
  v_problem := public.person_problem(NEW.user_id, GREATEST(NEW.due_date, now()));
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION 'Sortie refusée : %', v_problem USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'checkouts_check_person_trigger' AND tgrelid = 'public.checkouts'::regclass) THEN
    CREATE TRIGGER checkouts_check_person_trigger
      BEFORE INSERT ON public.checkouts
      FOR EACH ROW EXECUTE FUNCTION public.checkouts_check_person();
  END IF;
END $$;

-- create_request : fin d'accès, permis pour les véhicules, formation pour les outils
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

-- 2. EPI -------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ppe_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  name text NOT NULL CHECK (btrim(name) <> ''),
  -- Tailles proposées (ex. S, M, L ou 38…47) ; vide = taille unique
  sizes text[] NOT NULL DEFAULT '{}',
  renewal_months integer CHECK (renewal_months IS NULL OR renewal_months > 0),
  -- À rendre au départ (harnais, appareil respiratoire) ; sinon gardé par la personne
  returnable boolean NOT NULL DEFAULT false,
  -- Article de consommable décompté à la remise (facultatif)
  equipment_id uuid REFERENCES public.equipment(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ppe_types_name_key ON public.ppe_types (organization_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.user_ppe_sizes (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ppe_type_id uuid NOT NULL REFERENCES public.ppe_types(id) ON DELETE CASCADE,
  size text NOT NULL,
  PRIMARY KEY (user_id, ppe_type_id)
);

CREATE TABLE IF NOT EXISTS public.ppe_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ppe_type_id uuid NOT NULL REFERENCES public.ppe_types(id) ON DELETE CASCADE,
  size text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  issued_on date NOT NULL DEFAULT current_date,
  renew_on date,
  returned_on date,
  signature text,
  issued_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ppe_issues_user_idx ON public.ppe_issues (user_id);

-- Remise d'un EPI : enregistrement, taille retenue pour la prochaine fois, stock décompté
CREATE OR REPLACE FUNCTION public.issue_ppe(
  p_user_id uuid, p_ppe_type_id uuid, p_size text, p_quantity integer, p_depot_id uuid,
  p_signature text DEFAULT NULL, p_notes text DEFAULT NULL
)
RETURNS public.ppe_issues
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_type public.ppe_types;
  v_issue public.ppe_issues;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT (public.app_has('scan') OR public.app_has('manage_people')) THEN
    RAISE EXCEPTION 'Seul le magasin remet les EPI';
  END IF;
  SELECT * INTO v_type FROM public.ppe_types WHERE id = p_ppe_type_id;
  IF v_type.id IS NULL THEN
    RAISE EXCEPTION 'Type d''EPI introuvable';
  END IF;

  INSERT INTO public.ppe_issues (user_id, ppe_type_id, size, quantity, renew_on, signature, issued_by, notes)
  VALUES (p_user_id, p_ppe_type_id, NULLIF(btrim(p_size), ''), GREATEST(COALESCE(p_quantity, 1), 1),
          CASE WHEN v_type.renewal_months IS NOT NULL THEN (current_date + make_interval(months => v_type.renewal_months))::date END,
          p_signature, public.app_user_id(), NULLIF(btrim(p_notes), ''))
  RETURNING * INTO v_issue;

  IF NULLIF(btrim(p_size), '') IS NOT NULL THEN
    INSERT INTO public.user_ppe_sizes (user_id, ppe_type_id, size) VALUES (p_user_id, p_ppe_type_id, btrim(p_size))
    ON CONFLICT (user_id, ppe_type_id) DO UPDATE SET size = EXCLUDED.size;
  END IF;

  IF v_type.equipment_id IS NOT NULL AND p_depot_id IS NOT NULL THEN
    PERFORM public.apply_stock_movement(v_type.equipment_id, p_depot_id, 'consumption', -v_issue.quantity, p_user_id,
                                        'EPI', NULL, 'EPI remis : ' || v_type.name || COALESCE(' ' || v_issue.size, ''));
  END IF;
  RETURN v_issue;
END;
$$;

-- 3. Signature à la remise --------------------------------------------------------------------------
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS requires_signature boolean NOT NULL DEFAULT false;
ALTER TABLE public.delivery_notes
  ADD COLUMN IF NOT EXISTS signature text,
  ADD COLUMN IF NOT EXISTS signed_name text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz;

INSERT INTO public.system_settings (id, value, description)
VALUES ('signature_min_value', '500', 'Prix d''achat (CHF) à partir duquel la signature est demandée à la remise')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sign_delivery_note(p_note_id uuid, p_signature text, p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT public.app_has('scan') THEN
    RAISE EXCEPTION 'Seul le magasin fait signer la remise';
  END IF;
  IF p_signature IS NULL OR p_signature !~ '^data:image/png;base64,' THEN
    RAISE EXCEPTION 'Signature invalide';
  END IF;
  UPDATE public.delivery_notes SET signature = p_signature, signed_name = NULLIF(btrim(p_name), ''), signed_at = now()
  WHERE id = p_note_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bon introuvable';
  END IF;
END;
$$;

-- 4. Échéances : EPI à renouveler, fins de mission ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_people_deadlines()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_count integer := 0;
  v_n integer;
BEGIN
  -- EPI à renouveler dans 30 jours : la personne et le magasin, une fois par échéance
  INSERT INTO public.notifications (organization_id, kind, title, message, recipient_user_id, dedupe_key)
  SELECT public.default_organization_id(), 'ppe_renewal', 'EPI à renouveler : ' || t.name,
         format('Votre %s%s est à renouveler le %s. Passez au magasin.', t.name, COALESCE(' (taille ' || i.size || ')', ''), to_char(i.renew_on, 'DD.MM.YYYY')),
         i.user_id, 'ppe_renewal:user:' || i.id
  FROM public.ppe_issues i
  JOIN public.ppe_types t ON t.id = i.ppe_type_id
  JOIN public.users u ON u.id = i.user_id AND u.active
  WHERE i.renew_on IS NOT NULL AND i.renew_on <= v_today + 30 AND i.returned_on IS NULL
    -- Pas d'alerte si un EPI du même type a été remis depuis
    AND NOT EXISTS (SELECT 1 FROM public.ppe_issues n WHERE n.user_id = i.user_id AND n.ppe_type_id = i.ppe_type_id AND n.issued_on > i.issued_on)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  INSERT INTO public.notifications (organization_id, kind, title, message, dedupe_key)
  SELECT public.default_organization_id(), 'ppe_renewal', 'EPI à renouveler : ' || u.first_name || ' ' || u.last_name,
         format('%s %s : %s%s à renouveler le %s.', u.first_name, u.last_name, t.name, COALESCE(' taille ' || i.size, ''), to_char(i.renew_on, 'DD.MM.YYYY')),
         'ppe_renewal:staff:' || i.id
  FROM public.ppe_issues i
  JOIN public.ppe_types t ON t.id = i.ppe_type_id
  JOIN public.users u ON u.id = i.user_id AND u.active
  WHERE i.renew_on IS NOT NULL AND i.renew_on <= v_today + 30 AND i.returned_on IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.ppe_issues n WHERE n.user_id = i.user_id AND n.ppe_type_id = i.ppe_type_id AND n.issued_on > i.issued_on)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  -- Fin de mission dans 3 jours ou moins avec du matériel encore sorti
  INSERT INTO public.notifications (organization_id, kind, title, message, dedupe_key)
  SELECT public.default_organization_id(), 'mission_end', 'Fin de mission : ' || u.first_name || ' ' || u.last_name,
         format('%s %s%s termine le %s et a encore : %s.', u.first_name, u.last_name, COALESCE(' (' || u.company || ')', ''),
                to_char(u.access_until, 'DD.MM.YYYY'), string_agg(e.name, ', ' ORDER BY e.name)),
         'mission_end:' || u.id || ':' || u.access_until
  FROM public.users u
  JOIN public.checkouts c ON c.user_id = u.id AND c.status IN ('active', 'overdue')
  JOIN public.equipment e ON e.id = c.equipment_id
  WHERE u.access_until IS NOT NULL AND u.access_until BETWEEN v_today AND v_today + 3
  GROUP BY u.id
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  RETURN v_count;
END;
$$;

-- 5. Règles d'accès --------------------------------------------------------------------------------
ALTER TABLE public.ppe_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ppe_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ppe_issues ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  staff constant text := '(public.app_has(''view_all'') OR public.app_has(''scan'') OR public.app_has(''manage_people''))';
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('ppe_types', 'ppe_types_read', 'SELECT', 'public.app_is_member()', NULL),
    ('ppe_types', 'ppe_types_write', 'ALL', 'public.app_has(''manage_people'') OR public.app_has(''manage_stock'')',
       'public.app_has(''manage_people'') OR public.app_has(''manage_stock'')'),
    ('user_ppe_sizes', 'user_ppe_sizes_read', 'SELECT', 'user_id = public.app_user_id() OR ' || staff, NULL),
    ('user_ppe_sizes', 'user_ppe_sizes_write', 'ALL', 'user_id = public.app_user_id() OR public.app_has(''scan'') OR public.app_has(''manage_people'')',
       'user_id = public.app_user_id() OR public.app_has(''scan'') OR public.app_has(''manage_people'')'),
    ('ppe_issues', 'ppe_issues_read', 'SELECT', 'user_id = public.app_user_id() OR ' || staff, NULL),
    ('ppe_issues', 'ppe_issues_update', 'UPDATE', 'public.app_has(''scan'') OR public.app_has(''manage_people'')',
       'public.app_has(''scan'') OR public.app_has(''manage_people'')'),
    ('ppe_issues', 'ppe_issues_delete', 'DELETE', 'public.app_has(''manage_people'')', NULL)
  ) AS t(tbl, pol, cmd, using_expr, check_expr) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tbl AND policyname = r.pol) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated USING (%s)%s',
        r.pol, r.tbl, r.cmd, r.using_expr, CASE WHEN r.check_expr IS NOT NULL THEN format(' WITH CHECK (%s)', r.check_expr) ELSE '' END);
    END IF;
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppe_types, public.user_ppe_sizes, public.ppe_issues TO authenticated;
GRANT ALL ON public.ppe_types, public.user_ppe_sizes, public.ppe_issues TO service_role;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ppe_types', 'ppe_issues'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = t || '_audit_trigger' AND tgrelid = ('public.' || t)::regclass) THEN
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()',
                     t || '_audit_trigger', t);
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.checkouts_check_person() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.person_problem(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.person_problem(uuid, timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.issue_ppe(uuid, uuid, text, integer, uuid, text, text), public.sign_delivery_note(uuid, text, text),
  public.check_people_deadlines() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_ppe(uuid, uuid, text, integer, uuid, text, text), public.sign_delivery_note(uuid, text, text),
  public.check_people_deadlines() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_people_deadlines() TO service_role;

ALTER FUNCTION public.app_user_id() SET search_path = public, extensions;
ALTER FUNCTION public.whoami() SET search_path = public, extensions;
ALTER FUNCTION public.find_user_by_badge(text) SET search_path = public, extensions;
ALTER FUNCTION public.person_problem(uuid, timestamptz) SET search_path = public, extensions;
ALTER FUNCTION public.checkouts_check_person() SET search_path = public, extensions;
ALTER FUNCTION public.create_request(uuid, uuid, timestamptz, timestamptz, jsonb, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.issue_ppe(uuid, uuid, text, integer, uuid, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.sign_delivery_note(uuid, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.check_people_deadlines() SET search_path = public, extensions;
