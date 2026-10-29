/*
  Retours et entretien

  - Photos et PV : compartiment de stockage privé « fichiers » (images et PDF, 10 Mo max),
    lisible par les membres connectés seulement.
  - return_checks : état constaté au retour (ok, sale, incomplet, à réparer, cassé), remarque,
    photos. « À réparer » et « cassé » mettent l'outil en maintenance (il sort du stock
    disponible) et alertent ; « cassé » ouvre aussi un incident à décider.
  - incidents : perte, vol ou casse, avec la personne responsable, le coût et la décision
    (remplacé, retenue, assurance, passé en perte, retrouvé).
  - maintenance_plans : entretien préventif ou contrôle électrique (OIBT) tous les X mois
    et/ou toutes les X sorties ; un contrôle échu peut bloquer les sorties de l'outil.
    maintenance_plan_runs garde chaque intervention (résultat, technicien, coût, PV).
  - check_maintenance_due() crée les alertes d'échéance (sans doublon).
*/

-- 1. Stockage des photos et PV ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fichiers', 'fichiers', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'fichiers_lecture_membres') THEN
    CREATE POLICY fichiers_lecture_membres ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'fichiers' AND public.app_is_member());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'fichiers_depot_membres') THEN
    CREATE POLICY fichiers_depot_membres ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'fichiers' AND public.app_is_member());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'fichiers_suppression_reglages') THEN
    CREATE POLICY fichiers_suppression_reglages ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'fichiers' AND public.app_has('settings'));
  END IF;
END $$;

-- 2. Tables -------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.return_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  checkout_id uuid NOT NULL UNIQUE REFERENCES public.checkouts(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES public.equipment_instances(id) ON DELETE SET NULL,
  condition text NOT NULL CHECK (condition IN ('ok', 'dirty', 'incomplete', 'to_repair', 'broken')),
  notes text,
  photos text[] NOT NULL DEFAULT '{}',
  checked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS return_checks_equipment_idx ON public.return_checks (equipment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  kind text NOT NULL CHECK (kind IN ('lost', 'stolen', 'broken')),
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES public.equipment_instances(id) ON DELETE SET NULL,
  checkout_id uuid REFERENCES public.checkouts(id) ON DELETE SET NULL,
  responsible_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reported_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  description text,
  photos text[] NOT NULL DEFAULT '{}',
  cost numeric(12, 2) CHECK (cost IS NULL OR cost >= 0),
  decision text NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('pending', 'replaced', 'deducted', 'insurance', 'written_off', 'found')),
  decision_note text,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incidents_equipment_idx ON public.incidents (equipment_id);
CREATE INDEX IF NOT EXISTS incidents_responsible_idx ON public.incidents (responsible_id);

CREATE TABLE IF NOT EXISTS public.maintenance_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'maintenance' CHECK (kind IN ('maintenance', 'electrical_check')),
  title text NOT NULL,
  interval_months integer CHECK (interval_months IS NULL OR interval_months > 0),
  interval_checkouts integer CHECK (interval_checkouts IS NULL OR interval_checkouts > 0),
  last_done_at timestamptz NOT NULL DEFAULT now(),
  blocks_checkout boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (interval_months IS NOT NULL OR interval_checkouts IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS maintenance_plans_equipment_idx ON public.maintenance_plans (equipment_id);

CREATE TABLE IF NOT EXISTS public.maintenance_plan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.maintenance_plans(id) ON DELETE CASCADE,
  done_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL DEFAULT 'ok' CHECK (result IN ('ok', 'failed')),
  technician text,
  cost numeric(12, 2) CHECK (cost IS NULL OR cost >= 0),
  notes text,
  report_path text,
  done_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. État des plans : échéance par date et par usage --------------------------------------
CREATE OR REPLACE VIEW public.maintenance_plan_status WITH (security_invoker = true) AS
SELECT
  p.*,
  e.name AS equipment_name,
  e.article_number,
  CASE WHEN p.interval_months IS NOT NULL
       THEN (p.last_done_at + make_interval(months => p.interval_months))::date END AS due_date,
  u.uses_since,
  CASE WHEN p.interval_checkouts IS NOT NULL THEN p.interval_checkouts - u.uses_since END AS uses_left,
  CASE
    WHEN NOT p.active THEN 'inactive'
    WHEN (p.interval_months IS NOT NULL AND p.last_done_at + make_interval(months => p.interval_months) < now())
      OR (p.interval_checkouts IS NOT NULL AND u.uses_since >= p.interval_checkouts) THEN 'overdue'
    WHEN (p.interval_months IS NOT NULL AND p.last_done_at + make_interval(months => p.interval_months) < now() + interval '30 days')
      OR (p.interval_checkouts IS NOT NULL AND p.interval_checkouts - u.uses_since <= GREATEST(1, ceil(p.interval_checkouts * 0.1))) THEN 'soon'
    ELSE 'ok'
  END AS state
FROM public.maintenance_plans p
JOIN public.equipment e ON e.id = p.equipment_id
CROSS JOIN LATERAL (
  SELECT count(*)::integer AS uses_since
  FROM public.checkouts c
  WHERE c.equipment_id = p.equipment_id AND c.checkout_date > p.last_done_at
) u;

-- Type de maintenance par nom (créé s'il n'existe pas) : equipment_maintenance l'exige
CREATE OR REPLACE FUNCTION public.maintenance_type_id(p_name text, p_color text DEFAULT '#f59e0b')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.maintenance_types WHERE lower(name) = lower(p_name) LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.maintenance_types (name, color, description)
    VALUES (p_name, p_color, 'Créé automatiquement par GO-Mat')
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

-- 4. Retour avec contrôle -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.return_with_check(
  p_checkout_id uuid, p_condition text DEFAULT 'ok', p_notes text DEFAULT NULL, p_photos text[] DEFAULT '{}'
)
RETURNS public.return_checks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_checkout public.checkouts;
  v_check public.return_checks;
  v_name text;
  v_person text;
  v_label text := CASE p_condition
    WHEN 'ok' THEN 'bon état' WHEN 'dirty' THEN 'sale' WHEN 'incomplete' THEN 'incomplet'
    WHEN 'to_repair' THEN 'à réparer' WHEN 'broken' THEN 'cassé' END;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT public.app_has('scan') THEN
    RAISE EXCEPTION 'Seul le magasin enregistre les retours';
  END IF;
  IF v_label IS NULL THEN
    RAISE EXCEPTION 'État de retour inconnu : %', p_condition;
  END IF;

  SELECT * INTO v_checkout FROM public.checkouts WHERE id = p_checkout_id FOR UPDATE;
  IF NOT FOUND OR v_checkout.status NOT IN ('active', 'overdue') THEN
    RAISE EXCEPTION 'Emprunt non trouvé ou déjà retourné';
  END IF;

  PERFORM public.return_equipment(p_checkout_id,
    'Retour : ' || v_label || COALESCE(' — ' || NULLIF(trim(p_notes), ''), ''));

  INSERT INTO public.return_checks (checkout_id, equipment_id, instance_id, condition, notes, photos, checked_by)
  VALUES (p_checkout_id, v_checkout.equipment_id, v_checkout.instance_id, p_condition,
          NULLIF(trim(p_notes), ''), COALESCE(p_photos, '{}'), public.app_user_id())
  RETURNING * INTO v_check;

  IF p_condition IN ('to_repair', 'broken') THEN
    SELECT name INTO v_name FROM public.equipment WHERE id = v_checkout.equipment_id;
    SELECT first_name || ' ' || last_name INTO v_person FROM public.users WHERE id = v_checkout.user_id;

    -- L'outil passe en maintenance : il ne peut plus sortir tant qu'elle n'est pas terminée
    INSERT INTO public.equipment_maintenance (equipment_id, maintenance_type_id, title, description, start_date, status)
    VALUES (v_checkout.equipment_id, public.maintenance_type_id('Réparation', '#dc2626'),
            CASE p_condition WHEN 'broken' THEN 'Cassé au retour' ELSE 'À réparer (retour)' END,
            concat_ws(' — ', 'Rendu par ' || v_person, NULLIF(trim(p_notes), '')), now(), 'in_progress');

    IF p_condition = 'broken' THEN
      INSERT INTO public.incidents (kind, equipment_id, instance_id, checkout_id, responsible_id, reported_by, description, photos)
      VALUES ('broken', v_checkout.equipment_id, v_checkout.instance_id, p_checkout_id, v_checkout.user_id,
              public.app_user_id(), NULLIF(trim(p_notes), ''), COALESCE(p_photos, '{}'));
    END IF;

    INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id)
    VALUES (v_check.organization_id, 'tool_damaged',
            initcap(v_label) || ' : ' || v_name,
            format('%s rendu %s par %s%s.', v_name, v_label, v_person, COALESCE(' (' || NULLIF(trim(p_notes), '') || ')', '')),
            v_checkout.equipment_id);
  END IF;

  RETURN v_check;
END;
$$;

-- 5. Incidents ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.declare_incident(
  p_kind text, p_equipment_id uuid, p_checkout_id uuid DEFAULT NULL, p_responsible_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL, p_photos text[] DEFAULT '{}', p_occurred_at timestamptz DEFAULT now()
)
RETURNS public.incidents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_checkout public.checkouts;
  v_incident public.incidents;
  v_name text;
BEGIN
  IF p_checkout_id IS NOT NULL THEN
    SELECT * INTO v_checkout FROM public.checkouts WHERE id = p_checkout_id FOR UPDATE;
    IF NOT FOUND OR v_checkout.equipment_id <> p_equipment_id THEN
      RAISE EXCEPTION 'Emprunt introuvable pour cet article';
    END IF;
  END IF;

  -- Le magasin déclare pour tout le monde ; un collaborateur pour son propre emprunt
  IF current_setting('role', true) = 'authenticated' AND NOT public.app_has('scan')
     AND (v_checkout.id IS NULL OR v_checkout.user_id IS DISTINCT FROM public.app_user_id()) THEN
    RAISE EXCEPTION 'Vous ne pouvez déclarer un incident que sur votre propre emprunt';
  END IF;

  INSERT INTO public.incidents (kind, equipment_id, instance_id, checkout_id, responsible_id, reported_by, occurred_at, description, photos)
  VALUES (p_kind, p_equipment_id, v_checkout.instance_id, p_checkout_id,
          COALESCE(p_responsible_id, v_checkout.user_id), public.app_user_id(),
          COALESCE(p_occurred_at, now()), NULLIF(trim(p_description), ''), COALESCE(p_photos, '{}'))
  RETURNING * INTO v_incident;

  -- Perdu ou volé : l'emprunt reste compté hors stock, mais n'est plus « en retard »
  IF p_kind IN ('lost', 'stolen') AND v_checkout.status IN ('active', 'overdue') THEN
    UPDATE public.checkouts SET status = 'lost',
      notes = concat_ws(E'\n', notes, CASE p_kind WHEN 'lost' THEN 'Déclaré perdu' ELSE 'Déclaré volé' END || ' le ' || to_char(now(), 'DD.MM.YYYY'))
    WHERE id = p_checkout_id;
  END IF;

  SELECT name INTO v_name FROM public.equipment WHERE id = p_equipment_id;
  INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id)
  VALUES (v_incident.organization_id, 'incident',
          CASE p_kind WHEN 'lost' THEN 'Perte' WHEN 'stolen' THEN 'Vol' ELSE 'Casse' END || ' : ' || v_name,
          concat_ws(' — ', v_name, NULLIF(trim(p_description), '')), p_equipment_id);

  RETURN v_incident;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_incident(p_id uuid, p_decision text, p_cost numeric DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS public.incidents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_incident public.incidents;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT public.app_has('approve') THEN
    RAISE EXCEPTION 'Seul un responsable décide de la suite d''un incident';
  END IF;
  IF p_decision NOT IN ('pending', 'replaced', 'deducted', 'insurance', 'written_off', 'found') THEN
    RAISE EXCEPTION 'Décision inconnue : %', p_decision;
  END IF;

  UPDATE public.incidents
  SET decision = p_decision,
      cost = COALESCE(p_cost, cost),
      decision_note = NULLIF(trim(p_note), ''),
      decided_by = (SELECT first_name || ' ' || last_name FROM public.users WHERE id = public.app_user_id()),
      decided_at = CASE WHEN p_decision = 'pending' THEN NULL ELSE now() END
  WHERE id = p_id
  RETURNING * INTO v_incident;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident introuvable';
  END IF;

  -- Retrouvé : l'article revient en stock
  IF p_decision = 'found' AND v_incident.checkout_id IS NOT NULL THEN
    UPDATE public.checkouts SET status = 'returned', return_date = now(),
      notes = concat_ws(E'\n', notes, 'Retrouvé le ' || to_char(now(), 'DD.MM.YYYY'))
    WHERE id = v_incident.checkout_id AND status = 'lost';
  END IF;

  RETURN v_incident;
END;
$$;

-- 6. Entretien préventif ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_maintenance_plan(
  p_plan_id uuid, p_done_at timestamptz DEFAULT now(), p_result text DEFAULT 'ok',
  p_technician text DEFAULT NULL, p_cost numeric DEFAULT NULL, p_notes text DEFAULT NULL, p_report_path text DEFAULT NULL
)
RETURNS public.maintenance_plan_runs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan public.maintenance_plans;
  v_run public.maintenance_plan_runs;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT public.app_has('manage_stock') THEN
    RAISE EXCEPTION 'Seul le magasin enregistre un entretien';
  END IF;
  SELECT * INTO v_plan FROM public.maintenance_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan d''entretien introuvable';
  END IF;

  INSERT INTO public.maintenance_plan_runs (plan_id, done_at, result, technician, cost, notes, report_path, done_by)
  VALUES (p_plan_id, COALESCE(p_done_at, now()), p_result, NULLIF(trim(p_technician), ''), p_cost,
          NULLIF(trim(p_notes), ''), p_report_path, public.app_user_id())
  RETURNING * INTO v_run;

  IF p_result = 'ok' THEN
    UPDATE public.maintenance_plans SET last_done_at = v_run.done_at WHERE id = p_plan_id;
    UPDATE public.equipment SET last_maintenance = v_run.done_at WHERE id = v_plan.equipment_id;
  ELSE
    -- Non conforme : l'outil est retiré du stock disponible jusqu'à réparation
    INSERT INTO public.equipment_maintenance (equipment_id, maintenance_type_id, title, description, start_date, status, technician_name, cost)
    VALUES (v_plan.equipment_id, public.maintenance_type_id(CASE v_plan.kind WHEN 'electrical_check' THEN 'Contrôle électrique' ELSE 'Entretien' END), v_plan.title || ' : non conforme', NULLIF(trim(p_notes), ''), now(), 'in_progress',
            NULLIF(trim(p_technician), ''), p_cost);
  END IF;

  RETURN v_run;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_maintenance_due()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id, dedupe_key)
  SELECT s.organization_id, 'maintenance_due',
         CASE s.state WHEN 'overdue' THEN 'Échu : ' ELSE 'Bientôt : ' END || s.title || ' · ' || s.equipment_name,
         concat_ws(' · ', s.equipment_name || COALESCE(' (' || s.article_number || ')', ''),
                   CASE WHEN s.due_date IS NOT NULL THEN 'échéance le ' || to_char(s.due_date, 'DD.MM.YYYY') END,
                   CASE WHEN s.uses_left IS NOT NULL THEN greatest(s.uses_left, 0) || ' sortie(s) restante(s)' END),
         s.equipment_id,
         'plan:' || s.id || ':' || s.state || ':' || to_char(s.last_done_at, 'YYYYMMDD')
  FROM public.maintenance_plan_status s
  WHERE s.state IN ('overdue', 'soon')
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Un contrôle échu qui « bloque les sorties » refuse la sortie de l'outil
CREATE OR REPLACE FUNCTION public.checkouts_check_plans()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_title text;
BEGIN
  IF NEW.status NOT IN ('active', 'overdue') THEN
    RETURN NEW;
  END IF;
  SELECT s.title || ' (' || s.equipment_name || ')' INTO v_title
  FROM public.maintenance_plan_status s
  WHERE s.equipment_id = NEW.equipment_id AND s.blocks_checkout AND s.state = 'overdue'
  LIMIT 1;
  IF v_title IS NOT NULL THEN
    RAISE EXCEPTION 'Sortie bloquée : contrôle échu — %', v_title USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'checkouts_check_plans_trigger' AND tgrelid = 'public.checkouts'::regclass) THEN
    CREATE TRIGGER checkouts_check_plans_trigger
      BEFORE INSERT ON public.checkouts
      FOR EACH ROW EXECUTE FUNCTION public.checkouts_check_plans();
  END IF;
END $$;

-- 7. Règles d'accès -----------------------------------------------------------------------
ALTER TABLE public.return_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_plan_runs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  staff constant text := '(public.app_has(''view_all'') OR public.app_has(''scan'') OR public.app_has(''approve'') OR public.app_has(''manage_stock''))';
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    -- table, nom, commande, USING, WITH CHECK
    ('return_checks', 'return_checks_read', 'SELECT',
       staff || ' OR EXISTS (SELECT 1 FROM public.checkouts c WHERE c.id = checkout_id AND c.user_id = public.app_user_id())', NULL),
    ('incidents', 'incidents_read', 'SELECT', staff || ' OR responsible_id = public.app_user_id() OR reported_by = public.app_user_id()', NULL),
    ('maintenance_plans', 'maintenance_plans_read', 'SELECT', 'public.app_is_member()', NULL),
    ('maintenance_plans', 'maintenance_plans_write', 'ALL', 'public.app_has(''manage_stock'')', 'public.app_has(''manage_stock'')'),
    ('maintenance_plan_runs', 'maintenance_plan_runs_read', 'SELECT', 'public.app_is_member()', NULL)
  ) AS t(tbl, pol, cmd, using_expr, check_expr) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tbl AND policyname = r.pol) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated USING (%s)%s',
        r.pol, r.tbl, r.cmd, r.using_expr, CASE WHEN r.check_expr IS NOT NULL THEN format(' WITH CHECK (%s)', r.check_expr) ELSE '' END);
    END IF;
  END LOOP;
END $$;

-- Écritures par les fonctions ci-dessus ; lecture directe pour les membres concernés
GRANT SELECT ON public.return_checks, public.incidents, public.maintenance_plan_runs, public.maintenance_plan_status TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_plans TO authenticated;
GRANT ALL ON public.return_checks, public.incidents, public.maintenance_plans, public.maintenance_plan_runs TO service_role;

REVOKE EXECUTE ON FUNCTION public.checkouts_check_plans() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.maintenance_type_id(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.return_with_check(uuid, text, text, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.declare_incident(text, uuid, uuid, uuid, text, text[], timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decide_incident(uuid, text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_maintenance_plan(uuid, timestamptz, text, text, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_maintenance_due() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_with_check(uuid, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.declare_incident(text, uuid, uuid, uuid, text, text[], timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_incident(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_maintenance_plan(uuid, timestamptz, text, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_maintenance_due() TO authenticated, service_role;

ALTER FUNCTION public.return_with_check(uuid, text, text, text[]) SET search_path = public, extensions;
ALTER FUNCTION public.declare_incident(text, uuid, uuid, uuid, text, text[], timestamptz) SET search_path = public, extensions;
ALTER FUNCTION public.decide_incident(uuid, text, numeric, text) SET search_path = public, extensions;
ALTER FUNCTION public.complete_maintenance_plan(uuid, timestamptz, text, text, numeric, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.check_maintenance_due() SET search_path = public, extensions;
ALTER FUNCTION public.checkouts_check_plans() SET search_path = public, extensions;
ALTER FUNCTION public.maintenance_type_id(text, text) SET search_path = public, extensions;
