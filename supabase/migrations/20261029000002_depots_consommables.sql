/*
  Dépôts, consommables, seuils et alertes de stock

  - organizations : la société propriétaire des données. Chaque nouvelle table en porte
    l'identifiant, pour que GO-Mat puisse devenir un module de Mannyx sans migration de données.
  - depots : plusieurs dépôts ; un dépôt par défaut.
  - equipment.item_type : 'tool' (outil prêté, revient) ou 'consumable' (consommable, décompté).
  - consumable_stock : quantité et seuil minimum d'un consommable dans un dépôt.
  - stock_movements : historique de chaque mouvement (consommation, réception, inventaire, transfert).
  - Fonctions consume_stock, receive_stock, count_stock, transfer_stock : seules portes d'entrée
    pour modifier le stock d'un consommable (verrou sur la ligne, pas de stock négatif).
  - notifications : une alerte est créée dès qu'un consommable passe sous son seuil dans un dépôt.
  - low_stock_items : vue de la feuille de commande (sous le seuil), avec fournisseur.

  À exécuter dans Supabase → SQL Editor après 20261029000001_stock_calcule_en_base.sql.
*/

-- Société ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Ma société')
ON CONFLICT (id) DO NOTHING;

-- Société par défaut tant qu'il n'y a qu'une société (remplacée par la société de l'utilisateur connecté plus tard)
CREATE OR REPLACE FUNCTION public.default_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;

-- Dépôts -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.depots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  name text NOT NULL,
  address text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

-- Un seul dépôt par défaut par société
CREATE UNIQUE INDEX IF NOT EXISTS depots_one_default_per_org ON public.depots (organization_id) WHERE is_default;

INSERT INTO public.depots (name, is_default)
SELECT 'Dépôt principal', true
WHERE NOT EXISTS (SELECT 1 FROM public.depots);

-- Articles : outil ou consommable -----------------------------------------
ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'tool',
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'pièce',
  ADD COLUMN IF NOT EXISTS supplier_reference text,
  ADD COLUMN IF NOT EXISTS purchase_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS depot_id uuid REFERENCES public.depots(id) ON DELETE SET NULL;

-- Un consommable n'a pas de numéro de série
ALTER TABLE public.equipment ALTER COLUMN serial_number DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.equipment ADD CONSTRAINT equipment_item_type_check CHECK (item_type IN ('tool', 'consumable'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Les outils existants sont rattachés au dépôt par défaut
UPDATE public.equipment
SET depot_id = (SELECT id FROM public.depots WHERE is_default LIMIT 1)
WHERE depot_id IS NULL AND item_type = 'tool';

-- Stock des consommables par dépôt ----------------------------------------
CREATE TABLE IF NOT EXISTS public.consumable_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  depot_id uuid NOT NULL REFERENCES public.depots(id) ON DELETE RESTRICT,
  quantity numeric(12, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity numeric(12, 2) NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipment_id, depot_id)
);

-- Historique des mouvements ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  depot_id uuid NOT NULL REFERENCES public.depots(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('consumption', 'reception', 'count', 'transfer_out', 'transfer_in')),
  quantity numeric(12, 2) NOT NULL,          -- signé : négatif pour une sortie
  quantity_after numeric(12, 2) NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,  -- pour qui (consommation)
  destination text,                           -- chantier ou service
  delivery_note_id uuid REFERENCES public.delivery_notes(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_equipment_idx ON public.stock_movements (equipment_id, created_at DESC);

-- Notifications ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  kind text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  equipment_id uuid REFERENCES public.equipment(id) ON DELETE CASCADE,
  depot_id uuid REFERENCES public.depots(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications (organization_id, created_at DESC) WHERE read_at IS NULL;

-- Alerte au franchissement du seuil (une seule, pas à chaque mouvement sous le seuil)
CREATE OR REPLACE FUNCTION public.consumable_stock_alert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_name text;
  v_unit text;
  v_depot text;
  v_was_ok boolean;
BEGIN
  IF NEW.min_quantity <= 0 OR NEW.quantity >= NEW.min_quantity THEN
    RETURN NEW;
  END IF;
  v_was_ok := TG_OP = 'INSERT' OR OLD.quantity >= OLD.min_quantity;
  IF NOT v_was_ok THEN
    RETURN NEW;
  END IF;

  SELECT e.name, e.unit INTO v_name, v_unit FROM public.equipment e WHERE e.id = NEW.equipment_id;
  SELECT d.name INTO v_depot FROM public.depots d WHERE d.id = NEW.depot_id;

  INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id, depot_id)
  VALUES (
    NEW.organization_id, 'low_stock', 'Stock bas : ' || v_name,
    format('%s : il reste %s %s au %s (seuil %s).', v_name, trim_scale(NEW.quantity), v_unit, v_depot, trim_scale(NEW.min_quantity)),
    NEW.equipment_id, NEW.depot_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consumable_stock_alert_trigger ON public.consumable_stock;
CREATE TRIGGER consumable_stock_alert_trigger
  AFTER INSERT OR UPDATE OF quantity, min_quantity ON public.consumable_stock
  FOR EACH ROW EXECUTE FUNCTION public.consumable_stock_alert();

-- Le disponible d'un consommable = somme de ses stocks ; il ne se prête pas ----------------
CREATE OR REPLACE FUNCTION public.compute_equipment_stock(
  p_equipment_id uuid,
  p_total_quantity integer,
  p_current_status text,
  OUT available_quantity integer,
  OUT status text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_out integer;
  v_maintenance integer;
  v_type text;
  v_stock numeric;
BEGIN
  SELECT e.item_type INTO v_type FROM public.equipment e WHERE e.id = p_equipment_id;

  IF p_current_status = 'retired' THEN
    available_quantity := 0;
    status := 'retired';
    RETURN;
  END IF;

  IF v_type = 'consumable' THEN
    SELECT COALESCE(sum(s.quantity), 0) INTO v_stock FROM public.consumable_stock s WHERE s.equipment_id = p_equipment_id;
    available_quantity := floor(v_stock)::integer;
    status := CASE WHEN v_stock > 0 THEN 'available' ELSE 'checked-out' END;
    RETURN;
  END IF;

  SELECT count(*) INTO v_out
  FROM public.checkouts c
  WHERE c.equipment_id = p_equipment_id
    AND c.status IN ('active', 'overdue', 'lost');

  SELECT count(*) INTO v_maintenance
  FROM public.equipment_maintenance m
  WHERE m.equipment_id = p_equipment_id
    AND m.status = 'in_progress';

  available_quantity := GREATEST(COALESCE(p_total_quantity, 1) - v_out - v_maintenance, 0);
  status := CASE
    WHEN available_quantity > 0 THEN 'available'
    WHEN v_maintenance > 0 THEN 'maintenance'
    ELSE 'checked-out'
  END;
END;
$$;

-- equipment_apply_stock (BEFORE INSERT) voit l'item_type de NEW, pas encore en base
CREATE OR REPLACE FUNCTION public.equipment_apply_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock record;
BEGIN
  IF NEW.item_type = 'consumable' THEN
    IF NEW.status = 'retired' THEN
      NEW.available_quantity := 0;
    ELSE
      SELECT floor(COALESCE(sum(s.quantity), 0))::integer INTO NEW.available_quantity
      FROM public.consumable_stock s WHERE s.equipment_id = NEW.id;
      NEW.status := CASE WHEN NEW.available_quantity > 0 THEN 'available' ELSE 'checked-out' END;
    END IF;
    RETURN NEW;
  END IF;

  v_stock := public.compute_equipment_stock(NEW.id, NEW.total_quantity, NEW.status);
  NEW.available_quantity := v_stock.available_quantity;
  NEW.status := v_stock.status;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.consumable_stock_refresh_equipment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.refresh_equipment_stock(COALESCE(NEW.equipment_id, OLD.equipment_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS consumable_stock_refresh_equipment_trigger ON public.consumable_stock;
CREATE TRIGGER consumable_stock_refresh_equipment_trigger
  AFTER INSERT OR UPDATE OF quantity OR DELETE ON public.consumable_stock
  FOR EACH ROW EXECUTE FUNCTION public.consumable_stock_refresh_equipment();

-- Un consommable ne passe pas par un emprunt
CREATE OR REPLACE FUNCTION public.checkouts_reject_consumables()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.equipment e WHERE e.id = NEW.equipment_id AND e.item_type = 'consumable') THEN
    RAISE EXCEPTION 'Un consommable ne s''emprunte pas : il se consomme'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checkouts_reject_consumables_trigger ON public.checkouts;
CREATE TRIGGER checkouts_reject_consumables_trigger
  BEFORE INSERT ON public.checkouts
  FOR EACH ROW EXECUTE FUNCTION public.checkouts_reject_consumables();

-- Fonctions de mouvement ---------------------------------------------------
-- Verrouille (ou crée) la ligne de stock d'un consommable dans un dépôt
CREATE OR REPLACE FUNCTION public.lock_consumable_stock(p_equipment_id uuid, p_depot_id uuid)
RETURNS public.consumable_stock
LANGUAGE plpgsql
AS $$
DECLARE
  v_row public.consumable_stock;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.equipment e WHERE e.id = p_equipment_id AND e.item_type = 'consumable') THEN
    RAISE EXCEPTION 'Cet article n''est pas un consommable';
  END IF;

  INSERT INTO public.consumable_stock (equipment_id, depot_id)
  VALUES (p_equipment_id, p_depot_id)
  ON CONFLICT (equipment_id, depot_id) DO NOTHING;

  SELECT * INTO v_row FROM public.consumable_stock
  WHERE equipment_id = p_equipment_id AND depot_id = p_depot_id
  FOR UPDATE;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  p_equipment_id uuid, p_depot_id uuid, p_kind text, p_delta numeric,
  p_user_id uuid, p_destination text, p_delivery_note_id uuid, p_notes text
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_row public.consumable_stock;
  v_after numeric;
  v_name text;
BEGIN
  v_row := public.lock_consumable_stock(p_equipment_id, p_depot_id);
  v_after := v_row.quantity + p_delta;
  IF v_after < 0 THEN
    SELECT name INTO v_name FROM public.equipment WHERE id = p_equipment_id;
    RAISE EXCEPTION 'Stock insuffisant pour « % » : % disponible(s)', v_name, trim_scale(v_row.quantity)
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.consumable_stock SET quantity = v_after, updated_at = now() WHERE id = v_row.id;

  INSERT INTO public.stock_movements (organization_id, equipment_id, depot_id, kind, quantity, quantity_after, user_id, destination, delivery_note_id, notes)
  VALUES (v_row.organization_id, p_equipment_id, p_depot_id, p_kind, p_delta, v_after, p_user_id, p_destination, p_delivery_note_id, p_notes);

  RETURN v_after;
END;
$$;

-- Sortie d'un consommable pour une personne, un chantier ou un service
CREATE OR REPLACE FUNCTION public.consume_stock(
  p_equipment_id uuid, p_depot_id uuid, p_quantity numeric,
  p_user_id uuid DEFAULT NULL, p_destination text DEFAULT NULL,
  p_notes text DEFAULT NULL, p_delivery_note_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;
  IF p_user_id IS NULL AND NULLIF(trim(p_destination), '') IS NULL THEN
    RAISE EXCEPTION 'Indiquez pour qui : une personne, un chantier ou un service';
  END IF;
  RETURN public.apply_stock_movement(p_equipment_id, p_depot_id, 'consumption', -p_quantity, p_user_id, p_destination, p_delivery_note_id, p_notes);
END;
$$;

-- Réception d'une livraison
CREATE OR REPLACE FUNCTION public.receive_stock(
  p_equipment_id uuid, p_depot_id uuid, p_quantity numeric, p_notes text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;
  RETURN public.apply_stock_movement(p_equipment_id, p_depot_id, 'reception', p_quantity, NULL, NULL, NULL, p_notes);
END;
$$;

-- Inventaire : fixe la quantité comptée
CREATE OR REPLACE FUNCTION public.count_stock(
  p_equipment_id uuid, p_depot_id uuid, p_counted numeric, p_notes text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_row public.consumable_stock;
BEGIN
  IF p_counted IS NULL OR p_counted < 0 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;
  v_row := public.lock_consumable_stock(p_equipment_id, p_depot_id);
  RETURN public.apply_stock_movement(p_equipment_id, p_depot_id, 'count', p_counted - v_row.quantity, NULL, NULL, NULL, p_notes);
END;
$$;

-- Transfert entre deux dépôts
CREATE OR REPLACE FUNCTION public.transfer_stock(
  p_equipment_id uuid, p_from_depot_id uuid, p_to_depot_id uuid, p_quantity numeric, p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_from_depot_id = p_to_depot_id THEN
    RAISE EXCEPTION 'Choisissez deux dépôts différents';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;
  PERFORM public.apply_stock_movement(p_equipment_id, p_from_depot_id, 'transfer_out', -p_quantity, NULL, NULL, NULL, p_notes);
  PERFORM public.apply_stock_movement(p_equipment_id, p_to_depot_id, 'transfer_in', p_quantity, NULL, NULL, NULL, p_notes);
END;
$$;

-- Seuil minimum d'un consommable dans un dépôt
CREATE OR REPLACE FUNCTION public.set_min_quantity(
  p_equipment_id uuid, p_depot_id uuid, p_min_quantity numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_row public.consumable_stock;
BEGIN
  IF p_min_quantity IS NULL OR p_min_quantity < 0 THEN
    RAISE EXCEPTION 'Seuil invalide';
  END IF;
  v_row := public.lock_consumable_stock(p_equipment_id, p_depot_id);
  UPDATE public.consumable_stock SET min_quantity = p_min_quantity, updated_at = now() WHERE id = v_row.id;
END;
$$;

-- Feuille de commande : consommables sous le seuil, avec fournisseur ------------------------
CREATE OR REPLACE VIEW public.low_stock_items WITH (security_invoker = true) AS
SELECT
  s.id AS stock_id,
  s.organization_id,
  e.id AS equipment_id,
  e.name,
  e.article_number,
  e.unit,
  e.supplier_reference,
  e.purchase_price,
  d.id AS depot_id,
  d.name AS depot_name,
  sp.id AS supplier_id,
  COALESCE(sp.name, 'Sans fournisseur') AS supplier_name,
  sp.email AS supplier_email,
  sp.phone AS supplier_phone,
  s.quantity,
  s.min_quantity,
  -- Remonter au seuil, au minimum une unité
  GREATEST(s.min_quantity - s.quantity, 1) AS quantity_to_order
FROM public.consumable_stock s
JOIN public.equipment e ON e.id = s.equipment_id
JOIN public.depots d ON d.id = s.depot_id
LEFT JOIN public.suppliers sp ON sp.id = e.supplier_id
WHERE e.item_type = 'consumable'
  AND e.status <> 'retired'
  AND s.min_quantity > 0
  AND s.quantity < s.min_quantity;

-- Sécurité : RLS sur les nouvelles tables (ouverte tant que l'app n'a pas de connexion, comme le reste)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations', 'depots', 'consumable_stock', 'stock_movements', 'notifications'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_open_access', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t || '_open_access', t);
  END LOOP;
END $$;
