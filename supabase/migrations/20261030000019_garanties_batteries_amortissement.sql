/*
  Garanties et réparations, batteries, amortissement, accessoires liés

  - equipment.purchase_date / warranty_until / depreciation_years : achat, fin de garantie et durée
    d'amortissement (paramètre « depreciation_years » par défaut, 5 ans).
  - repair_orders : outil envoyé chez le fournisseur ou un réparateur. Pendant la réparation, l'outil
    est en maintenance (indisponible) ; au retour, coût et date sont notés. Sous garantie si la date
    d'envoi précède la fin de garantie.
  - Batteries : equipment.is_battery avec durée de vie (mois) et/ou nombre de sorties ; la vue
    battery_status donne l'âge, les sorties et l'état (ok, bientôt, fin de vie) par exemplaire.
  - equipment_accessories : accessoires à proposer avec un outil (chargeur, batteries…) au comptoir.
  - equipment_depreciation : valeur d'achat, amortissement cumulé et valeur comptable à ce jour.
  - check_equipment_deadlines() : fins de garantie (30 jours), réparations en retard, batteries en fin de vie.
*/

ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS purchase_date date,
  ADD COLUMN IF NOT EXISTS warranty_until date,
  ADD COLUMN IF NOT EXISTS depreciation_years integer CHECK (depreciation_years IS NULL OR depreciation_years BETWEEN 1 AND 50),
  ADD COLUMN IF NOT EXISTS is_battery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS battery_life_months integer CHECK (battery_life_months IS NULL OR battery_life_months > 0),
  ADD COLUMN IF NOT EXISTS battery_max_uses integer CHECK (battery_max_uses IS NULL OR battery_max_uses > 0);

INSERT INTO public.system_settings (id, value, description)
VALUES ('depreciation_years', '5', 'Durée d''amortissement par défaut des outils (années)')
ON CONFLICT (id) DO NOTHING;

-- 1. Accessoires liés --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equipment_accessories (
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  accessory_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  PRIMARY KEY (equipment_id, accessory_id),
  CHECK (equipment_id <> accessory_id)
);

-- 2. Réparations chez le fournisseur ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.repair_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES public.equipment_instances(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  repairer text NOT NULL CHECK (btrim(repairer) <> ''),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  reference text,
  under_warranty boolean NOT NULL DEFAULT false,
  sent_on date NOT NULL DEFAULT current_date,
  expected_on date,
  returned_on date,
  cost numeric(10, 2) CHECK (cost IS NULL OR cost >= 0),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'returned', 'cancelled')),
  maintenance_id uuid REFERENCES public.equipment_maintenance(id) ON DELETE SET NULL,
  notes text,
  created_by uuid DEFAULT public.app_user_id() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS repair_orders_open_idx ON public.repair_orders (equipment_id) WHERE status = 'sent';

CREATE OR REPLACE FUNCTION public.send_repair(
  p_equipment_id uuid, p_instance_id uuid, p_repairer text, p_supplier_id uuid, p_reason text,
  p_expected_on date DEFAULT NULL, p_reference text DEFAULT NULL
)
RETURNS public.repair_orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item public.equipment;
  v_repair public.repair_orders;
  v_maintenance uuid;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT (public.app_has('manage_stock') OR public.app_has('scan')) THEN
    RAISE EXCEPTION 'Seul le magasin envoie un outil en réparation';
  END IF;
  SELECT * INTO v_item FROM public.equipment WHERE id = p_equipment_id;
  IF v_item.id IS NULL OR v_item.item_type = 'consumable' THEN
    RAISE EXCEPTION 'Outil introuvable';
  END IF;
  IF p_instance_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.checkouts WHERE instance_id = p_instance_id AND status IN ('active', 'overdue')) THEN
    RAISE EXCEPTION 'Cet exemplaire est sorti : à rendre avant l''envoi';
  END IF;
  IF EXISTS (SELECT 1 FROM public.repair_orders WHERE equipment_id = p_equipment_id AND status = 'sent'
             AND (instance_id IS NOT DISTINCT FROM p_instance_id)) THEN
    RAISE EXCEPTION 'Déjà en réparation';
  END IF;

  -- L'outil compte comme en maintenance tant qu'il est chez le réparateur
  INSERT INTO public.equipment_maintenance (equipment_id, maintenance_type_id, title, description, start_date, status, technician_name)
  VALUES (p_equipment_id, public.maintenance_type_id('Réparation externe', '#6366f1'), 'Réparation chez ' || btrim(p_repairer),
          btrim(p_reason), now(), 'in_progress', btrim(p_repairer))
  RETURNING id INTO v_maintenance;

  INSERT INTO public.repair_orders (equipment_id, instance_id, supplier_id, repairer, reason, reference, under_warranty, expected_on, maintenance_id)
  VALUES (p_equipment_id, p_instance_id, p_supplier_id, btrim(p_repairer), btrim(p_reason), NULLIF(btrim(p_reference), ''),
          v_item.warranty_until IS NOT NULL AND v_item.warranty_until >= current_date, p_expected_on, v_maintenance)
  RETURNING * INTO v_repair;

  IF p_instance_id IS NOT NULL THEN
    UPDATE public.equipment_instances SET status = 'maintenance' WHERE id = p_instance_id;
  END IF;
  RETURN v_repair;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_repair(p_repair_id uuid, p_returned_on date, p_cost numeric, p_notes text DEFAULT NULL, p_cancel boolean DEFAULT false)
RETURNS public.repair_orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_repair public.repair_orders;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT (public.app_has('manage_stock') OR public.app_has('scan')) THEN
    RAISE EXCEPTION 'Seul le magasin réceptionne une réparation';
  END IF;
  SELECT * INTO v_repair FROM public.repair_orders WHERE id = p_repair_id FOR UPDATE;
  IF v_repair.id IS NULL OR v_repair.status <> 'sent' THEN
    RAISE EXCEPTION 'Cette réparation est déjà close';
  END IF;

  UPDATE public.repair_orders
  SET status = CASE WHEN p_cancel THEN 'cancelled' ELSE 'returned' END,
      returned_on = CASE WHEN p_cancel THEN NULL ELSE COALESCE(p_returned_on, current_date) END,
      cost = CASE WHEN p_cancel THEN NULL ELSE p_cost END,
      notes = concat_ws(E'\n', notes, NULLIF(btrim(p_notes), ''))
  WHERE id = p_repair_id
  RETURNING * INTO v_repair;

  UPDATE public.equipment_maintenance
  SET status = CASE WHEN p_cancel THEN 'cancelled' ELSE 'completed' END,
      end_date = CASE WHEN p_cancel THEN now() ELSE COALESCE(p_returned_on::timestamptz, now()) END,
      cost = CASE WHEN p_cancel THEN cost ELSE p_cost END
  WHERE id = v_repair.maintenance_id;

  IF v_repair.instance_id IS NOT NULL THEN
    UPDATE public.equipment_instances SET status = 'available' WHERE id = v_repair.instance_id AND status = 'maintenance';
  END IF;
  RETURN v_repair;
END;
$$;

-- Un exemplaire chez le réparateur ne sort pas
CREATE OR REPLACE FUNCTION public.checkouts_check_repair()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_repairer text;
BEGIN
  IF NEW.status NOT IN ('active', 'overdue') OR NEW.instance_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT repairer INTO v_repairer FROM public.repair_orders WHERE instance_id = NEW.instance_id AND status = 'sent' LIMIT 1;
  IF v_repairer IS NOT NULL THEN
    RAISE EXCEPTION 'Sortie refusée : cet exemplaire est en réparation chez %', v_repairer USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'checkouts_check_repair_trigger' AND tgrelid = 'public.checkouts'::regclass) THEN
    CREATE TRIGGER checkouts_check_repair_trigger
      BEFORE INSERT ON public.checkouts
      FOR EACH ROW EXECUTE FUNCTION public.checkouts_check_repair();
  END IF;
END $$;

-- 3. Batteries -------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.battery_status WITH (security_invoker = true) AS
WITH units AS (
  -- Une ligne par exemplaire numéroté, sinon une ligne pour l'article
  SELECT e.id AS equipment_id, i.id AS instance_id, e.name, COALESCE(i.qr_code, e.article_number) AS code,
         COALESCE(e.purchase_date, i.created_at::date, e.created_at::date) AS since,
         e.battery_life_months, e.battery_max_uses, e.depot_id
  FROM public.equipment e
  LEFT JOIN public.equipment_instances i ON i.equipment_id = e.id AND i.status <> 'retired'
  WHERE e.is_battery AND e.status <> 'retired'
)
SELECT
  u.*,
  (extract(year FROM age(current_date, u.since)) * 12 + extract(month FROM age(current_date, u.since)))::integer AS age_months,
  c.uses,
  CASE
    WHEN (u.battery_life_months IS NOT NULL AND age(current_date, u.since) >= make_interval(months => u.battery_life_months))
      OR (u.battery_max_uses IS NOT NULL AND c.uses >= u.battery_max_uses) THEN 'end'
    WHEN (u.battery_life_months IS NOT NULL AND age(current_date, u.since) >= make_interval(months => ceil(u.battery_life_months * 0.9)::integer))
      OR (u.battery_max_uses IS NOT NULL AND c.uses >= ceil(u.battery_max_uses * 0.9)) THEN 'soon'
    ELSE 'ok'
  END AS state
FROM units u
CROSS JOIN LATERAL (
  SELECT count(*)::integer AS uses FROM public.checkouts ck
  WHERE ck.equipment_id = u.equipment_id AND (u.instance_id IS NULL OR ck.instance_id = u.instance_id)
) c;

-- 4. Amortissement ---------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.equipment_depreciation WITH (security_invoker = true) AS
WITH base AS (
  SELECT e.id AS equipment_id, e.name, e.article_number,
         COALESCE(e.purchase_date, e.added_date::date, e.created_at::date) AS since,
         e.purchase_price * GREATEST(COALESCE(e.total_quantity, 1), 1) AS value,
         COALESCE(e.depreciation_years, NULLIF((SELECT value FROM public.system_settings WHERE id = 'depreciation_years'), '')::integer, 5) AS years
  FROM public.equipment e
  WHERE e.item_type <> 'consumable' AND e.status <> 'retired' AND COALESCE(e.purchase_price, 0) > 0
)
SELECT b.*,
       round(b.value / b.years, 2) AS annual,
       round(LEAST(b.value, b.value / b.years * GREATEST(current_date - b.since, 0) / 365.25), 2) AS accumulated,
       round(b.value - LEAST(b.value, b.value / b.years * GREATEST(current_date - b.since, 0) / 365.25), 2) AS book_value
FROM base b;

-- 5. Échéances -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_equipment_deadlines()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_count integer := 0;
  v_n integer;
BEGIN
  INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id, depot_id, dedupe_key)
  SELECT public.default_organization_id(), 'warranty_end', 'Fin de garantie : ' || e.name,
         format('La garantie de « %s » se termine le %s. Un défaut à signaler ? C''est le moment de l''envoyer.', e.name, to_char(e.warranty_until, 'DD.MM.YYYY')),
         e.id, e.depot_id, 'warranty_end:' || e.id || ':' || e.warranty_until
  FROM public.equipment e
  WHERE e.warranty_until BETWEEN v_today AND v_today + 30 AND e.status <> 'retired'
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id, dedupe_key)
  SELECT public.default_organization_id(), 'repair_late', 'Réparation en retard : ' || e.name,
         format('« %s » est chez %s depuis le %s (retour prévu le %s).', e.name, r.repairer, to_char(r.sent_on, 'DD.MM.YYYY'), to_char(r.expected_on, 'DD.MM.YYYY')),
         e.id, 'repair_late:' || r.id || ':' || r.expected_on
  FROM public.repair_orders r JOIN public.equipment e ON e.id = r.equipment_id
  WHERE r.status = 'sent' AND r.expected_on < v_today
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id, depot_id, dedupe_key)
  SELECT public.default_organization_id(), 'battery_end', 'Batterie en fin de vie : ' || b.name,
         format('« %s »%s : %s mois, %s sorties. À tester ou remplacer.', b.name, COALESCE(' (' || b.code || ')', ''), b.age_months, b.uses),
         b.equipment_id, b.depot_id, 'battery_end:' || COALESCE(b.instance_id, b.equipment_id)
  FROM public.battery_status b
  WHERE b.state = 'end'
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  RETURN v_count;
END;
$$;

-- 6. Règles d'accès --------------------------------------------------------------------------------
ALTER TABLE public.equipment_accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_orders ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  staff constant text := '(public.app_has(''view_all'') OR public.app_has(''scan'') OR public.app_has(''approve'') OR public.app_has(''manage_stock''))';
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('equipment_accessories', 'equipment_accessories_read', 'SELECT', 'public.app_is_member()', NULL),
    ('equipment_accessories', 'equipment_accessories_write', 'ALL', 'public.app_has(''manage_stock'')', 'public.app_has(''manage_stock'')'),
    ('repair_orders', 'repair_orders_read', 'SELECT', staff, NULL),
    ('repair_orders', 'repair_orders_update', 'UPDATE', 'public.app_has(''manage_stock'')', 'public.app_has(''manage_stock'')')
  ) AS t(tbl, pol, cmd, using_expr, check_expr) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tbl AND policyname = r.pol) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated USING (%s)%s',
        r.pol, r.tbl, r.cmd, r.using_expr, CASE WHEN r.check_expr IS NOT NULL THEN format(' WITH CHECK (%s)', r.check_expr) ELSE '' END);
    END IF;
  END LOOP;
END $$;

GRANT SELECT, INSERT, DELETE ON public.equipment_accessories TO authenticated;
GRANT SELECT, UPDATE ON public.repair_orders TO authenticated;
GRANT SELECT ON public.battery_status, public.equipment_depreciation TO authenticated;
GRANT ALL ON public.equipment_accessories, public.repair_orders TO service_role;
GRANT SELECT ON public.battery_status, public.equipment_depreciation TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'repair_orders_audit_trigger' AND tgrelid = 'public.repair_orders'::regclass) THEN
    CREATE TRIGGER repair_orders_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.repair_orders
      FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.checkouts_check_repair() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_repair(uuid, uuid, text, uuid, text, date, text), public.close_repair(uuid, date, numeric, text, boolean),
  public.check_equipment_deadlines() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_repair(uuid, uuid, text, uuid, text, date, text), public.close_repair(uuid, date, numeric, text, boolean),
  public.check_equipment_deadlines() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_equipment_deadlines() TO service_role;

ALTER FUNCTION public.send_repair(uuid, uuid, text, uuid, text, date, text) SET search_path = public, extensions;
ALTER FUNCTION public.close_repair(uuid, date, numeric, text, boolean) SET search_path = public, extensions;
ALTER FUNCTION public.checkouts_check_repair() SET search_path = public, extensions;
ALTER FUNCTION public.check_equipment_deadlines() SET search_path = public, extensions;
