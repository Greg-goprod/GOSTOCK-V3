/*
  Stock et achats

  - Inventaire tournant : chaque session propose les articles d'un dépôt comptés depuis le
    plus longtemps (puis les plus chers) ; on compte au scanner ; à la clôture, l'écart
    (compté − attendu) est appliqué au stock actuel des consommables, ce qui tient compte
    des sorties faites pendant le comptage. Les écarts d'outils sont signalés.
  - Commandes fournisseurs : numéro CMDAAMM-0001, brouillon → envoyée → reçue en partie →
    reçue ; création depuis la feuille de commande (sans recommander ce qui est déjà en
    commande) ; réception ligne à ligne, qui entre le stock.
  - Seuils proposés : consommation des 90 derniers jours × (délai fournisseur + 5 jours).
  - Coûts par chantier : consommables (quantité × prix d'achat) et outils (jours × tarif
    interne par jour), d'après le chantier saisi à la sortie.
  - Valeur du stock par dépôt.
*/

-- 1. Colonnes ----------------------------------------------------------------------------
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS lead_time_days integer NOT NULL DEFAULT 7;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS daily_rate numeric(10, 2) CHECK (daily_rate IS NULL OR daily_rate >= 0);
ALTER TABLE public.catalog_products ADD COLUMN IF NOT EXISTS price numeric(12, 2);

-- 2. Inventaire tournant -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  depot_id uuid NOT NULL REFERENCES public.depots(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  started_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  closed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_counts_one_open_idx ON public.inventory_counts (depot_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS public.inventory_count_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id uuid NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  expected numeric(12, 2) NOT NULL,
  counted numeric(12, 2) CHECK (counted IS NULL OR counted >= 0),
  -- Article trouvé sur place mais absent de la liste proposée
  added boolean NOT NULL DEFAULT false,
  reason text,
  counted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  counted_at timestamptz,
  UNIQUE (count_id, equipment_id)
);

-- Quantité attendue sur place : stock du dépôt (consommables) ou exemplaires disponibles (outils)
CREATE OR REPLACE FUNCTION public.inventory_expected(p_equipment_id uuid, p_depot_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT CASE e.item_type
    WHEN 'consumable' THEN COALESCE((SELECT s.quantity FROM public.consumable_stock s WHERE s.equipment_id = e.id AND s.depot_id = p_depot_id), 0)
    ELSE COALESCE(e.available_quantity, 0)
  END
  FROM public.equipment e WHERE e.id = p_equipment_id;
$$;

CREATE OR REPLACE FUNCTION public.start_inventory_count(p_depot_id uuid, p_size integer DEFAULT 20)
RETURNS public.inventory_counts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count public.inventory_counts;
  v_default uuid := (SELECT id FROM public.depots WHERE is_default LIMIT 1);
BEGIN
  IF current_setting('role', true) = 'authenticated'
     AND (NOT (public.app_has('manage_stock') OR public.app_has('scan')) OR NOT public.app_depot_ok(p_depot_id)) THEN
    RAISE EXCEPTION 'Inventaire réservé au magasin de ce dépôt';
  END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_counts WHERE depot_id = p_depot_id AND status = 'open') THEN
    RAISE EXCEPTION 'Un inventaire est déjà en cours dans ce dépôt';
  END IF;

  INSERT INTO public.inventory_counts (depot_id, started_by) VALUES (p_depot_id, public.app_user_id())
  RETURNING * INTO v_count;

  -- Les articles du dépôt comptés depuis le plus longtemps (jamais comptés d'abord), puis les plus chers
  INSERT INTO public.inventory_count_lines (count_id, equipment_id, expected)
  SELECT v_count.id, c.id, public.inventory_expected(c.id, p_depot_id)
  FROM (
    SELECT e.id,
           (SELECT max(l.counted_at) FROM public.inventory_count_lines l
              JOIN public.inventory_counts ic ON ic.id = l.count_id
             WHERE l.equipment_id = e.id AND ic.depot_id = p_depot_id AND l.counted IS NOT NULL) AS last_counted,
           COALESCE(e.purchase_price, 0) * public.inventory_expected(e.id, p_depot_id) AS value
    FROM public.equipment e
    WHERE e.status <> 'retired'
      AND ((e.item_type = 'consumable' AND EXISTS (SELECT 1 FROM public.consumable_stock s WHERE s.equipment_id = e.id AND s.depot_id = p_depot_id))
        OR (COALESCE(e.item_type, 'tool') <> 'consumable' AND COALESCE(e.depot_id, v_default) = p_depot_id))
    ORDER BY last_counted NULLS FIRST, value DESC
    LIMIT GREATEST(1, p_size)
  ) c;

  RETURN v_count;
END;
$$;

-- Comptage par scan (+1) ou par saisie (quantité exacte) ; un article hors liste est ajouté
CREATE OR REPLACE FUNCTION public.record_inventory_count(
  p_count_id uuid, p_equipment_id uuid, p_counted numeric DEFAULT NULL, p_increment numeric DEFAULT NULL, p_reason text DEFAULT NULL
)
RETURNS public.inventory_count_lines
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count public.inventory_counts;
  v_line public.inventory_count_lines;
BEGIN
  SELECT * INTO v_count FROM public.inventory_counts WHERE id = p_count_id;
  IF NOT FOUND OR v_count.status <> 'open' THEN
    RAISE EXCEPTION 'Inventaire introuvable ou déjà clôturé';
  END IF;
  IF current_setting('role', true) = 'authenticated'
     AND (NOT (public.app_has('manage_stock') OR public.app_has('scan')) OR NOT public.app_depot_ok(v_count.depot_id)) THEN
    RAISE EXCEPTION 'Inventaire réservé au magasin de ce dépôt';
  END IF;

  INSERT INTO public.inventory_count_lines (count_id, equipment_id, expected, added)
  VALUES (p_count_id, p_equipment_id, public.inventory_expected(p_equipment_id, v_count.depot_id), true)
  ON CONFLICT (count_id, equipment_id) DO NOTHING;

  UPDATE public.inventory_count_lines
  SET counted = CASE WHEN p_counted IS NOT NULL THEN p_counted ELSE COALESCE(counted, 0) + COALESCE(p_increment, 1) END,
      reason = COALESCE(NULLIF(trim(p_reason), ''), reason),
      counted_by = public.app_user_id(),
      counted_at = now()
  WHERE count_id = p_count_id AND equipment_id = p_equipment_id
  RETURNING * INTO v_line;
  RETURN v_line;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_inventory_count(p_count_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count public.inventory_counts;
  v_line record;
  v_current numeric;
  v_gaps integer := 0;
  v_depot text;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT public.app_has('manage_stock') THEN
    RAISE EXCEPTION 'Seul un gestionnaire de stock clôture un inventaire';
  END IF;
  SELECT * INTO v_count FROM public.inventory_counts WHERE id = p_count_id FOR UPDATE;
  IF NOT FOUND OR v_count.status <> 'open' THEN
    RAISE EXCEPTION 'Inventaire introuvable ou déjà clôturé';
  END IF;
  SELECT name INTO v_depot FROM public.depots WHERE id = v_count.depot_id;

  FOR v_line IN
    SELECT l.*, e.item_type, e.name
    FROM public.inventory_count_lines l JOIN public.equipment e ON e.id = l.equipment_id
    WHERE l.count_id = p_count_id AND l.counted IS NOT NULL AND l.counted <> l.expected
  LOOP
    v_gaps := v_gaps + 1;
    IF v_line.item_type = 'consumable' THEN
      -- Écart appliqué au stock actuel : les sorties pendant le comptage restent comptées
      SELECT quantity INTO v_current FROM public.consumable_stock WHERE equipment_id = v_line.equipment_id AND depot_id = v_count.depot_id;
      PERFORM public.count_stock(v_line.equipment_id, v_count.depot_id,
        GREATEST(0, COALESCE(v_current, 0) + v_line.counted - v_line.expected),
        'Inventaire tournant' || COALESCE(' : ' || v_line.reason, ''));
    ELSE
      INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id, depot_id)
      VALUES (v_count.organization_id, 'inventory_gap', 'Écart d''inventaire : ' || v_line.name,
              format('%s au %s : %s compté(s) pour %s attendu(s)%s.', v_line.name, v_depot,
                     trim_scale(v_line.counted), trim_scale(v_line.expected), COALESCE(' (' || v_line.reason || ')', '')),
              v_line.equipment_id, v_count.depot_id);
    END IF;
  END LOOP;

  UPDATE public.inventory_counts SET status = 'closed', closed_at = now(), closed_by = public.app_user_id() WHERE id = p_count_id;
  RETURN v_gaps;
END;
$$;

-- 3. Commandes fournisseurs --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  number text UNIQUE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  depot_id uuid NOT NULL REFERENCES public.depots(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partial', 'received', 'cancelled')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  expected_at date,
  notes text
);

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
  quantity numeric(12, 2) NOT NULL CHECK (quantity > 0),
  received numeric(12, 2) NOT NULL DEFAULT 0 CHECK (received >= 0),
  unit_price numeric(12, 2),
  UNIQUE (order_id, equipment_id)
);

CREATE OR REPLACE FUNCTION public.set_purchase_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix text := 'CMD' || to_char(now(), 'YYMM') || '-';
  v_next integer;
BEGIN
  IF NEW.number IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('purchase_orders_number'));
  SELECT COALESCE(MAX(substring(number FROM length(v_prefix) + 1)::integer), 0) + 1 INTO v_next
  FROM public.purchase_orders WHERE number LIKE v_prefix || '%';
  NEW.number := v_prefix || lpad(v_next::text, 4, '0');
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'purchase_orders_number_trigger' AND tgrelid = 'public.purchase_orders'::regclass) THEN
    CREATE TRIGGER purchase_orders_number_trigger
      BEFORE INSERT ON public.purchase_orders
      FOR EACH ROW EXECUTE FUNCTION public.set_purchase_order_number();
  END IF;
END $$;

-- Quantités déjà en commande (non reçues) par article et dépôt
CREATE OR REPLACE VIEW public.open_order_quantities WITH (security_invoker = true) AS
SELECT l.equipment_id, o.depot_id, sum(GREATEST(l.quantity - l.received, 0)) AS quantity
FROM public.purchase_order_lines l
JOIN public.purchase_orders o ON o.id = l.order_id
WHERE o.status IN ('draft', 'sent', 'partial')
GROUP BY l.equipment_id, o.depot_id;

-- Une commande brouillon par fournisseur pour ce qui est sous le seuil et pas déjà commandé
CREATE OR REPLACE FUNCTION public.create_orders_from_low_stock(p_depot_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supplier uuid;
  v_order uuid;
  v_orders integer := 0;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT public.app_has('manage_stock') THEN
    RAISE EXCEPTION 'Seul un gestionnaire de stock passe commande';
  END IF;

  -- Fournisseurs ayant au moins une ligne à commander (sous le seuil, pas déjà en commande)
  FOR v_supplier IN
    SELECT DISTINCT e.supplier_id
    FROM public.low_stock_items lsi
    JOIN public.equipment e ON e.id = lsi.equipment_id
    LEFT JOIN public.open_order_quantities oq ON oq.equipment_id = lsi.equipment_id AND oq.depot_id = lsi.depot_id
    WHERE lsi.depot_id = p_depot_id AND e.supplier_id IS NOT NULL
      AND lsi.quantity_to_order - COALESCE(oq.quantity, 0) > 0
  LOOP
    INSERT INTO public.purchase_orders (supplier_id, depot_id, created_by)
    VALUES (v_supplier, p_depot_id, public.app_user_id())
    RETURNING id INTO v_order;

    INSERT INTO public.purchase_order_lines (order_id, equipment_id, quantity, unit_price)
    SELECT v_order, lsi.equipment_id, lsi.quantity_to_order - COALESCE(oq.quantity, 0), e.purchase_price
    FROM public.low_stock_items lsi
    JOIN public.equipment e ON e.id = lsi.equipment_id
    LEFT JOIN public.open_order_quantities oq ON oq.equipment_id = lsi.equipment_id AND oq.depot_id = lsi.depot_id
    WHERE lsi.depot_id = p_depot_id AND e.supplier_id = v_supplier
      AND lsi.quantity_to_order - COALESCE(oq.quantity, 0) > 0;

    v_orders := v_orders + 1;
  END LOOP;
  RETURN v_orders;
END;
$$;

-- Réception d'une ligne : entrée en stock et état de la commande
CREATE OR REPLACE FUNCTION public.receive_order_line(p_line_id uuid, p_quantity numeric)
RETURNS public.purchase_orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_line public.purchase_order_lines;
  v_order public.purchase_orders;
  v_type text;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT (public.app_has('manage_stock') OR public.app_has('scan')) THEN
    RAISE EXCEPTION 'Réception réservée au magasin';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;
  SELECT * INTO v_line FROM public.purchase_order_lines WHERE id = p_line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ligne de commande introuvable';
  END IF;
  SELECT * INTO v_order FROM public.purchase_orders WHERE id = v_line.order_id FOR UPDATE;
  IF v_order.status IN ('received', 'cancelled') THEN
    RAISE EXCEPTION 'Commande % déjà %', v_order.number, CASE v_order.status WHEN 'received' THEN 'reçue' ELSE 'annulée' END;
  END IF;

  SELECT item_type INTO v_type FROM public.equipment WHERE id = v_line.equipment_id;
  IF v_type = 'consumable' THEN
    PERFORM public.receive_stock(v_line.equipment_id, v_order.depot_id, p_quantity, 'Commande ' || v_order.number);
  ELSE
    -- Outil commandé : la quantité totale augmente (le stock disponible suit)
    UPDATE public.equipment SET total_quantity = COALESCE(total_quantity, 0) + ceil(p_quantity)::integer WHERE id = v_line.equipment_id;
  END IF;

  UPDATE public.purchase_order_lines SET received = received + p_quantity WHERE id = p_line_id;

  UPDATE public.purchase_orders o
  SET status = CASE WHEN NOT EXISTS (SELECT 1 FROM public.purchase_order_lines l WHERE l.order_id = o.id AND l.received < l.quantity)
                    THEN 'received' ELSE 'partial' END
  WHERE o.id = v_order.id
  RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

-- 4. Seuils proposés ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.suggested_thresholds WITH (security_invoker = true) AS
SELECT
  s.id AS stock_id,
  s.equipment_id,
  s.depot_id,
  e.name,
  e.unit,
  s.quantity,
  s.min_quantity,
  COALESCE(sup.lead_time_days, 7) AS lead_time_days,
  round(COALESCE(c.used, 0) / 90.0, 3) AS daily_use,
  CASE WHEN COALESCE(c.used, 0) > 0
       THEN GREATEST(1, ceil(c.used / 90.0 * (COALESCE(sup.lead_time_days, 7) + 5)))
       ELSE 0 END AS suggested_min
FROM public.consumable_stock s
JOIN public.equipment e ON e.id = s.equipment_id
LEFT JOIN public.suppliers sup ON sup.id = e.supplier_id
LEFT JOIN LATERAL (
  SELECT sum(-m.quantity) AS used
  FROM public.stock_movements m
  WHERE m.equipment_id = s.equipment_id AND m.depot_id = s.depot_id
    AND m.kind = 'consumption' AND m.created_at > now() - interval '90 days'
) c ON true
WHERE e.status <> 'retired';

-- 5. Coûts par chantier ------------------------------------------------------------------
CREATE OR REPLACE VIEW public.site_cost_lines WITH (security_invoker = true) AS
SELECT
  'consumable'::text AS source,
  COALESCE(NULLIF(trim(m.destination), ''), 'Sans chantier') AS site,
  m.created_at AS at,
  m.equipment_id,
  e.name,
  -m.quantity AS quantity,
  e.unit,
  COALESCE(e.purchase_price, 0) AS unit_cost,
  -m.quantity * COALESCE(e.purchase_price, 0) AS amount,
  m.user_id
FROM public.stock_movements m
JOIN public.equipment e ON e.id = m.equipment_id
WHERE m.kind = 'consumption'
UNION ALL
SELECT
  'tool',
  COALESCE(NULLIF(trim(r.destination), ''), NULLIF(trim(dn.notes), ''), 'Sans chantier'),
  c.checkout_date,
  c.equipment_id,
  e.name,
  GREATEST(1, ceil(extract(epoch FROM COALESCE(c.return_date, now()) - c.checkout_date) / 86400.0))::numeric,
  'jour',
  COALESCE(e.daily_rate, 0),
  GREATEST(1, ceil(extract(epoch FROM COALESCE(c.return_date, now()) - c.checkout_date) / 86400.0)) * COALESCE(e.daily_rate, 0),
  c.user_id
FROM public.checkouts c
JOIN public.equipment e ON e.id = c.equipment_id
LEFT JOIN public.delivery_notes dn ON dn.id = c.delivery_note_id
LEFT JOIN public.requests r ON r.delivery_note_id = c.delivery_note_id;

-- 6. Valeur du stock par dépôt -----------------------------------------------------------
CREATE OR REPLACE VIEW public.stock_value WITH (security_invoker = true) AS
SELECT s.depot_id, 'consumable'::text AS item_type, count(*) AS items, sum(s.quantity * COALESCE(e.purchase_price, 0)) AS value
FROM public.consumable_stock s JOIN public.equipment e ON e.id = s.equipment_id
WHERE e.status <> 'retired'
GROUP BY s.depot_id
UNION ALL
SELECT COALESCE(e.depot_id, (SELECT id FROM public.depots WHERE is_default LIMIT 1)), 'tool', count(*), sum(COALESCE(e.total_quantity, 1) * COALESCE(e.purchase_price, 0))
FROM public.equipment e
WHERE COALESCE(e.item_type, 'tool') <> 'consumable' AND e.status <> 'retired'
GROUP BY 1;

-- 7. Règles d'accès ----------------------------------------------------------------------
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  staff constant text := '(public.app_has(''view_all'') OR public.app_has(''scan'') OR public.app_has(''approve'') OR public.app_has(''manage_stock''))';
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('inventory_counts', 'inventory_counts_read', 'SELECT', staff, NULL),
    ('inventory_count_lines', 'inventory_count_lines_read', 'SELECT', staff, NULL),
    ('purchase_orders', 'purchase_orders_read', 'SELECT', staff, NULL),
    ('purchase_orders', 'purchase_orders_write', 'ALL', 'public.app_has(''manage_stock'')', 'public.app_has(''manage_stock'')'),
    ('purchase_order_lines', 'purchase_order_lines_read', 'SELECT', staff, NULL),
    ('purchase_order_lines', 'purchase_order_lines_write', 'ALL', 'public.app_has(''manage_stock'')', 'public.app_has(''manage_stock'')')
  ) AS t(tbl, pol, cmd, using_expr, check_expr) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tbl AND policyname = r.pol) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated USING (%s)%s',
        r.pol, r.tbl, r.cmd, r.using_expr, CASE WHEN r.check_expr IS NOT NULL THEN format(' WITH CHECK (%s)', r.check_expr) ELSE '' END);
    END IF;
  END LOOP;
END $$;

GRANT SELECT ON public.inventory_counts, public.inventory_count_lines, public.open_order_quantities,
  public.suggested_thresholds, public.site_cost_lines, public.stock_value TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders, public.purchase_order_lines TO authenticated;
GRANT ALL ON public.inventory_counts, public.inventory_count_lines, public.purchase_orders, public.purchase_order_lines TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_purchase_order_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inventory_expected(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_inventory_count(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_inventory_count(uuid, uuid, numeric, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.close_inventory_count(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_orders_from_low_stock(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.receive_order_line(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_inventory_count(uuid, integer), public.record_inventory_count(uuid, uuid, numeric, numeric, text),
  public.close_inventory_count(uuid), public.create_orders_from_low_stock(uuid), public.receive_order_line(uuid, numeric) TO authenticated;

ALTER FUNCTION public.set_purchase_order_number() SET search_path = public, extensions;
ALTER FUNCTION public.inventory_expected(uuid, uuid) SET search_path = public, extensions;
ALTER FUNCTION public.start_inventory_count(uuid, integer) SET search_path = public, extensions;
ALTER FUNCTION public.record_inventory_count(uuid, uuid, numeric, numeric, text) SET search_path = public, extensions;
ALTER FUNCTION public.close_inventory_count(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.create_orders_from_low_stock(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.receive_order_line(uuid, numeric) SET search_path = public, extensions;
