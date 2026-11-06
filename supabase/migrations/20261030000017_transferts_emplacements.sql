/*
  Transferts entre dépôts, emplacements, liste de préparation

  - transfers / transfer_lines : envoi d'un dépôt à l'autre (TRFAAMM-0001). À l'envoi, les
    consommables quittent le stock du dépôt de départ ; les outils restent rattachés au départ et
    ne peuvent plus sortir tant qu'ils sont « en route ». À la réception (au scanner), les
    consommables entrent dans le dépôt d'arrivée et les outils y sont rattachés. Clôturer une
    réception incomplète signale l'écart au magasin ; annuler un envoi sans réception remet tout
    au départ.
  - storage_bins : emplacements d'un dépôt (allée, étagère, bac) avec un ordre de parcours.
    Un outil a un emplacement ; un consommable a un emplacement par dépôt (consumable_stock).
  - request_pick_list : lignes d'une demande avec leur emplacement, dans l'ordre du parcours.
*/

-- 1. Emplacements ----------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.storage_bins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  depot_id uuid NOT NULL REFERENCES public.depots(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (btrim(code) <> ''),
  label text,
  -- Ordre de passage dans le dépôt (liste de préparation)
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS storage_bins_code_key ON public.storage_bins (depot_id, upper(btrim(code)));

ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS bin_id uuid REFERENCES public.storage_bins(id) ON DELETE SET NULL;
ALTER TABLE public.consumable_stock ADD COLUMN IF NOT EXISTS bin_id uuid REFERENCES public.storage_bins(id) ON DELETE SET NULL;

-- Liste de préparation : chaque ligne de la demande avec l'emplacement dans le dépôt de la demande
CREATE OR REPLACE VIEW public.request_pick_list WITH (security_invoker = true) AS
SELECT
  i.id AS item_id,
  i.request_id,
  i.item_kind,
  i.equipment_id,
  i.vehicle_id,
  COALESCE(e.name, v.name) AS name,
  COALESCE(e.article_number, v.plate) AS reference,
  i.quantity,
  CASE WHEN i.item_kind = 'consumable' THEN e.unit END AS unit,
  b.code AS bin_code,
  b.label AS bin_label,
  b.sort_order AS bin_order
FROM public.request_items i
JOIN public.requests r ON r.id = i.request_id
LEFT JOIN public.equipment e ON e.id = i.equipment_id
LEFT JOIN public.vehicles v ON v.id = i.vehicle_id
LEFT JOIN public.consumable_stock cs ON i.item_kind = 'consumable' AND cs.equipment_id = i.equipment_id AND cs.depot_id = r.depot_id
LEFT JOIN public.storage_bins b ON b.id = CASE WHEN i.item_kind = 'consumable' THEN cs.bin_id
                                               WHEN i.item_kind = 'tool' AND (e.depot_id IS NULL OR e.depot_id = r.depot_id) THEN e.bin_id END;

-- 2. Transferts ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  number text UNIQUE,
  from_depot_id uuid NOT NULL REFERENCES public.depots(id),
  to_depot_id uuid NOT NULL REFERENCES public.depots(id),
  status text NOT NULL DEFAULT 'in_transit' CHECK (status IN ('in_transit', 'received', 'cancelled')),
  sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  received_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  received_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_depot_id <> to_depot_id)
);

CREATE TABLE IF NOT EXISTS public.transfer_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipment(id),
  quantity numeric(12, 3) NOT NULL CHECK (quantity > 0),
  received numeric(12, 3) NOT NULL DEFAULT 0 CHECK (received >= 0),
  CHECK (received <= quantity)
);
CREATE INDEX IF NOT EXISTS transfer_lines_transfer_idx ON public.transfer_lines (transfer_id);
CREATE INDEX IF NOT EXISTS transfer_lines_equipment_idx ON public.transfer_lines (equipment_id);

CREATE OR REPLACE FUNCTION public.set_transfer_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix text := 'TRF' || to_char(now(), 'YYMM') || '-';
  v_next integer;
BEGIN
  IF NEW.number IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('transfers_number'));
  SELECT COALESCE(MAX(substring(number FROM length(v_prefix) + 1)::integer), 0) + 1 INTO v_next
  FROM public.transfers WHERE number LIKE v_prefix || '%';
  NEW.number := v_prefix || lpad(v_next::text, 4, '0');
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'transfers_number_trigger' AND tgrelid = 'public.transfers'::regclass) THEN
    CREATE TRIGGER transfers_number_trigger
      BEFORE INSERT ON public.transfers
      FOR EACH ROW EXECUTE FUNCTION public.set_transfer_number();
  END IF;
END $$;

-- Droit d'agir sur un dépôt (magasin ou gestion du stock, limité aux dépôts de la personne)
CREATE OR REPLACE FUNCTION public.transfer_check_access(p_depot_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  IF current_setting('role', true) = 'authenticated'
     AND NOT ((public.app_has('scan') OR public.app_has('manage_stock')) AND public.app_depot_ok(p_depot_id)) THEN
    RAISE EXCEPTION 'Accès refusé à ce dépôt' USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- Envoi : lignes [{ "equipment_id": "…", "quantity": 2 }]
CREATE OR REPLACE FUNCTION public.send_transfer(p_from uuid, p_to uuid, p_lines jsonb, p_notes text DEFAULT NULL)
RETURNS public.transfers
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transfer public.transfers;
  v_line jsonb;
  v_item public.equipment;
  v_qty numeric;
  v_out integer;
BEGIN
  PERFORM public.transfer_check_access(p_from);
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Aucun article à transférer';
  END IF;

  INSERT INTO public.transfers (from_depot_id, to_depot_id, sent_by, notes)
  VALUES (p_from, p_to, public.app_user_id(), NULLIF(btrim(p_notes), ''))
  RETURNING * INTO v_transfer;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT * INTO v_item FROM public.equipment WHERE id = (v_line->>'equipment_id')::uuid FOR UPDATE;
    IF v_item.id IS NULL THEN
      RAISE EXCEPTION 'Article introuvable';
    END IF;
    v_qty := COALESCE((v_line->>'quantity')::numeric, 1);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantité invalide pour « % »', v_item.name;
    END IF;

    IF v_item.item_type = 'consumable' THEN
      PERFORM public.apply_stock_movement(v_item.id, p_from, 'transfer_out', -v_qty, public.app_user_id(), NULL, NULL,
                                          'Transfert ' || v_transfer.number);
    ELSE
      -- Un outil part entier : rattaché au dépôt de départ, rien de sorti, pas déjà en route
      IF v_item.depot_id IS NOT NULL AND v_item.depot_id <> p_from THEN
        RAISE EXCEPTION '« % » n''est pas rattaché à ce dépôt', v_item.name;
      END IF;
      SELECT count(*) INTO v_out FROM public.checkouts WHERE equipment_id = v_item.id AND status IN ('active', 'overdue');
      IF v_out > 0 THEN
        RAISE EXCEPTION '« % » est sorti (% en cours) : à rendre avant le transfert', v_item.name, v_out;
      END IF;
      IF EXISTS (SELECT 1 FROM public.transfer_lines l JOIN public.transfers t ON t.id = l.transfer_id
                 WHERE l.equipment_id = v_item.id AND t.status = 'in_transit' AND t.id <> v_transfer.id) THEN
        RAISE EXCEPTION '« % » est déjà en route', v_item.name;
      END IF;
      v_qty := COALESCE(v_item.total_quantity, 1);
    END IF;

    INSERT INTO public.transfer_lines (transfer_id, equipment_id, quantity) VALUES (v_transfer.id, v_item.id, v_qty);
  END LOOP;

  INSERT INTO public.notifications (organization_id, kind, title, message, depot_id, dedupe_key)
  SELECT public.default_organization_id(), 'transfer', 'Transfert en route : ' || v_transfer.number,
         format('%s article(s) en route depuis %s, à réceptionner au scanner.',
                (SELECT count(*) FROM public.transfer_lines WHERE transfer_id = v_transfer.id), d.name),
         p_to, 'transfer:' || v_transfer.id
  FROM public.depots d WHERE d.id = p_from;

  RETURN v_transfer;
END;
$$;

-- Réception d'une quantité sur une ligne (scan à l'arrivée)
CREATE OR REPLACE FUNCTION public.receive_transfer_line(p_line_id uuid, p_quantity numeric DEFAULT NULL)
RETURNS public.transfers
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_line public.transfer_lines;
  v_transfer public.transfers;
  v_item public.equipment;
  v_qty numeric;
BEGIN
  SELECT * INTO v_line FROM public.transfer_lines WHERE id = p_line_id FOR UPDATE;
  SELECT * INTO v_transfer FROM public.transfers WHERE id = v_line.transfer_id FOR UPDATE;
  IF v_transfer.id IS NULL THEN
    RAISE EXCEPTION 'Transfert introuvable';
  END IF;
  PERFORM public.transfer_check_access(v_transfer.to_depot_id);
  IF v_transfer.status <> 'in_transit' THEN
    RAISE EXCEPTION 'Le transfert % n''est plus en route', v_transfer.number;
  END IF;
  SELECT * INTO v_item FROM public.equipment WHERE id = v_line.equipment_id;

  IF v_item.item_type = 'consumable' THEN
    v_qty := LEAST(COALESCE(p_quantity, v_line.quantity - v_line.received), v_line.quantity - v_line.received);
  ELSE
    v_qty := v_line.quantity - v_line.received;
  END IF;
  IF v_qty <= 0 THEN
    RAISE EXCEPTION '« % » est déjà réceptionné', v_item.name;
  END IF;

  UPDATE public.transfer_lines SET received = received + v_qty WHERE id = v_line.id;

  IF v_item.item_type = 'consumable' THEN
    PERFORM public.apply_stock_movement(v_item.id, v_transfer.to_depot_id, 'transfer_in', v_qty, public.app_user_id(), NULL, NULL,
                                        'Transfert ' || v_transfer.number);
  ELSE
    -- Arrivé : rattaché au nouveau dépôt, sans l'emplacement de l'ancien
    UPDATE public.equipment SET depot_id = v_transfer.to_depot_id, bin_id = NULL WHERE id = v_item.id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.transfer_lines WHERE transfer_id = v_transfer.id AND received < quantity) THEN
    UPDATE public.transfers SET status = 'received', received_at = now(), received_by = public.app_user_id()
    WHERE id = v_transfer.id RETURNING * INTO v_transfer;
  END IF;
  RETURN v_transfer;
END;
$$;

-- Clôture d'une réception incomplète (écart signalé) ou annulation d'un envoi sans réception
CREATE OR REPLACE FUNCTION public.close_transfer(p_transfer_id uuid, p_cancel boolean DEFAULT false)
RETURNS public.transfers
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transfer public.transfers;
  v_line record;
  v_missing text;
BEGIN
  SELECT * INTO v_transfer FROM public.transfers WHERE id = p_transfer_id FOR UPDATE;
  IF v_transfer.id IS NULL OR v_transfer.status <> 'in_transit' THEN
    RAISE EXCEPTION 'Ce transfert n''est plus en route';
  END IF;

  IF p_cancel THEN
    PERFORM public.transfer_check_access(v_transfer.from_depot_id);
    IF EXISTS (SELECT 1 FROM public.transfer_lines WHERE transfer_id = p_transfer_id AND received > 0) THEN
      RAISE EXCEPTION 'Déjà en partie réceptionné : clôturez la réception au lieu d''annuler';
    END IF;
    -- Les consommables reviennent au départ ; les outils n'avaient pas changé de dépôt
    FOR v_line IN SELECT l.*, e.item_type FROM public.transfer_lines l JOIN public.equipment e ON e.id = l.equipment_id
                  WHERE l.transfer_id = p_transfer_id AND e.item_type = 'consumable' LOOP
      PERFORM public.apply_stock_movement(v_line.equipment_id, v_transfer.from_depot_id, 'transfer_in', v_line.quantity,
                                          public.app_user_id(), NULL, NULL, 'Transfert annulé ' || v_transfer.number);
    END LOOP;
    UPDATE public.transfers SET status = 'cancelled' WHERE id = p_transfer_id RETURNING * INTO v_transfer;
    RETURN v_transfer;
  END IF;

  PERFORM public.transfer_check_access(v_transfer.to_depot_id);
  SELECT string_agg(format('%s × %s', trim_scale(l.quantity - l.received), e.name), ', ') INTO v_missing
  FROM public.transfer_lines l JOIN public.equipment e ON e.id = l.equipment_id
  WHERE l.transfer_id = p_transfer_id AND l.received < l.quantity;

  UPDATE public.transfers SET status = 'received', received_at = now(), received_by = public.app_user_id(),
         notes = concat_ws(E'\n', notes, 'Manquant à la réception : ' || v_missing)
  WHERE id = p_transfer_id RETURNING * INTO v_transfer;

  IF v_missing IS NOT NULL THEN
    INSERT INTO public.notifications (organization_id, kind, title, message, depot_id, dedupe_key)
    VALUES (public.default_organization_id(), 'transfer', 'Écart de transfert : ' || v_transfer.number,
            'Pas arrivé : ' || v_missing || '. Les outils manquants restent rattachés au dépôt de départ.',
            v_transfer.from_depot_id, 'transfer_gap:' || v_transfer.id);
  END IF;
  RETURN v_transfer;
END;
$$;

-- Un outil en route ne sort pas
CREATE OR REPLACE FUNCTION public.checkouts_check_transit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_number text;
BEGIN
  IF NEW.status NOT IN ('active', 'overdue') THEN
    RETURN NEW;
  END IF;
  SELECT t.number INTO v_number
  FROM public.transfer_lines l JOIN public.transfers t ON t.id = l.transfer_id
  WHERE l.equipment_id = NEW.equipment_id AND t.status = 'in_transit' AND l.received < l.quantity
  LIMIT 1;
  IF v_number IS NOT NULL THEN
    RAISE EXCEPTION 'Sortie refusée : cet outil est en route (transfert %)', v_number USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'checkouts_check_transit_trigger' AND tgrelid = 'public.checkouts'::regclass) THEN
    CREATE TRIGGER checkouts_check_transit_trigger
      BEFORE INSERT ON public.checkouts
      FOR EACH ROW EXECUTE FUNCTION public.checkouts_check_transit();
  END IF;
END $$;

-- 3. Règles d'accès --------------------------------------------------------------------------------
ALTER TABLE public.storage_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_lines ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  staff constant text := '(public.app_has(''view_all'') OR public.app_has(''scan'') OR public.app_has(''approve'') OR public.app_has(''manage_stock''))';
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('storage_bins', 'storage_bins_read', 'SELECT', 'public.app_is_member()', NULL),
    ('storage_bins', 'storage_bins_write', 'ALL', 'public.app_has(''manage_stock'') AND public.app_depot_ok(depot_id)',
       'public.app_has(''manage_stock'') AND public.app_depot_ok(depot_id)'),
    ('transfers', 'transfers_read', 'SELECT', staff, NULL),
    ('transfer_lines', 'transfer_lines_read', 'SELECT', staff, NULL)
  ) AS t(tbl, pol, cmd, using_expr, check_expr) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tbl AND policyname = r.pol) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated USING (%s)%s',
        r.pol, r.tbl, r.cmd, r.using_expr, CASE WHEN r.check_expr IS NOT NULL THEN format(' WITH CHECK (%s)', r.check_expr) ELSE '' END);
    END IF;
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_bins TO authenticated;
GRANT SELECT ON public.transfers, public.transfer_lines, public.request_pick_list TO authenticated;
GRANT ALL ON public.storage_bins, public.transfers, public.transfer_lines TO service_role;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['storage_bins', 'transfers'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = t || '_audit_trigger' AND tgrelid = ('public.' || t)::regclass) THEN
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()',
                     t || '_audit_trigger', t);
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.set_transfer_number(), public.checkouts_check_transit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_check_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_transfer(uuid, uuid, jsonb, text), public.receive_transfer_line(uuid, numeric),
  public.close_transfer(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_transfer(uuid, uuid, jsonb, text), public.receive_transfer_line(uuid, numeric),
  public.close_transfer(uuid, boolean) TO authenticated;

ALTER FUNCTION public.set_transfer_number() SET search_path = public, extensions;
ALTER FUNCTION public.transfer_check_access(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.send_transfer(uuid, uuid, jsonb, text) SET search_path = public, extensions;
ALTER FUNCTION public.receive_transfer_line(uuid, numeric) SET search_path = public, extensions;
ALTER FUNCTION public.close_transfer(uuid, boolean) SET search_path = public, extensions;
ALTER FUNCTION public.checkouts_check_transit() SET search_path = public, extensions;
