/*
  Stock calculé par la base

  Avant : chaque écran de l'app calculait et écrivait lui-même equipment.available_quantity
  (sortie : −quantité, retour par scan : +1, retour par la page Sorties : rien). Le stock
  dérivait, pouvait devenir négatif et deux sorties simultanées s'écrasaient.

  Maintenant :
    disponible = total − emprunts (active, overdue, lost) − maintenances en cours
  recalculé par la base à chaque modification d'un équipement, d'un emprunt ou d'une
  maintenance. Les valeurs envoyées par l'app pour available_quantity sont ignorées.

  Statut calculé :
    - 'retired' reste 'retired' (choix manuel) et rend 0 disponible
    - disponible > 0                 → 'available'
    - 0 disponible et maintenance    → 'maintenance'
    - 0 disponible sinon             → 'checked-out'

  Une sortie est refusée si l'équipement n'a plus de disponible (verrou sur la ligne :
  deux sorties simultanées ne peuvent pas dépasser le stock).

  create_checkout() crée le bon et ses emprunts en une seule transaction.

  À exécuter dans Supabase → SQL Editor après 20261029000000_schema_initial.sql.
*/

-- Calcul du stock d'un équipement
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
BEGIN
  SELECT count(*) INTO v_out
  FROM public.checkouts c
  WHERE c.equipment_id = p_equipment_id
    AND c.status IN ('active', 'overdue', 'lost');

  SELECT count(*) INTO v_maintenance
  FROM public.equipment_maintenance m
  WHERE m.equipment_id = p_equipment_id
    AND m.status = 'in_progress';

  IF p_current_status = 'retired' THEN
    available_quantity := 0;
    status := 'retired';
    RETURN;
  END IF;

  available_quantity := GREATEST(COALESCE(p_total_quantity, 1) - v_out - v_maintenance, 0);
  status := CASE
    WHEN available_quantity > 0 THEN 'available'
    WHEN v_maintenance > 0 THEN 'maintenance'
    ELSE 'checked-out'
  END;
END;
$$;

-- Sur l'équipement lui-même : available_quantity et status sont toujours recalculés
CREATE OR REPLACE FUNCTION public.equipment_apply_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock record;
BEGIN
  v_stock := public.compute_equipment_stock(NEW.id, NEW.total_quantity, NEW.status);
  NEW.available_quantity := v_stock.available_quantity;
  NEW.status := v_stock.status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS equipment_apply_stock_trigger ON public.equipment;
CREATE TRIGGER equipment_apply_stock_trigger
  BEFORE INSERT OR UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.equipment_apply_stock();

-- Recalcul d'un équipement (le trigger ci-dessus fait le calcul)
CREATE OR REPLACE FUNCTION public.refresh_equipment_stock(p_equipment_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.equipment SET total_quantity = total_quantity WHERE id = p_equipment_id;
$$;

-- Emprunts et maintenances : recalcul après chaque changement
CREATE OR REPLACE FUNCTION public.refresh_stock_after_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.refresh_equipment_stock(OLD.equipment_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.equipment_id IS DISTINCT FROM OLD.equipment_id OR NEW.status IS DISTINCT FROM OLD.status) THEN
    PERFORM public.refresh_equipment_stock(NEW.equipment_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS checkouts_refresh_stock_trigger ON public.checkouts;
CREATE TRIGGER checkouts_refresh_stock_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.checkouts
  FOR EACH ROW EXECUTE FUNCTION public.refresh_stock_after_change();

DROP TRIGGER IF EXISTS equipment_maintenance_refresh_stock_trigger ON public.equipment_maintenance;
CREATE TRIGGER equipment_maintenance_refresh_stock_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.equipment_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.refresh_stock_after_change();

-- Refus d'une sortie sans stock disponible
CREATE OR REPLACE FUNCTION public.checkouts_check_availability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_equipment record;
  v_stock record;
BEGIN
  IF NEW.status NOT IN ('active', 'overdue') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('active', 'overdue', 'lost') AND OLD.equipment_id = NEW.equipment_id THEN
    RETURN NEW;
  END IF;

  -- Le verrou sérialise les sorties concurrentes sur le même équipement
  SELECT id, name, total_quantity, status INTO v_equipment
  FROM public.equipment
  WHERE id = NEW.equipment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Équipement introuvable';
  END IF;

  v_stock := public.compute_equipment_stock(v_equipment.id, v_equipment.total_quantity, v_equipment.status);
  IF v_stock.available_quantity <= 0 THEN
    RAISE EXCEPTION 'Plus de stock disponible pour « % »', v_equipment.name
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checkouts_check_availability_trigger ON public.checkouts;
CREATE TRIGGER checkouts_check_availability_trigger
  BEFORE INSERT OR UPDATE OF status, equipment_id ON public.checkouts
  FOR EACH ROW EXECUTE FUNCTION public.checkouts_check_availability();

-- L'ancien trigger de maintenance modifiait lui-même le stock : il ne garde que la date de dernière maintenance
CREATE OR REPLACE FUNCTION public.update_equipment_status_on_maintenance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    UPDATE public.equipment
    SET last_maintenance = COALESCE(NEW.end_date, now())
    WHERE id = NEW.equipment_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Sortie complète (bon + emprunts) en une transaction
-- p_items : [{"equipment_id": "...", "quantity": 2}, ...]
CREATE OR REPLACE FUNCTION public.create_checkout(
  p_user_id uuid,
  p_due_date timestamptz,
  p_items jsonb,
  p_notes text DEFAULT NULL
)
RETURNS public.delivery_notes
LANGUAGE plpgsql
AS $$
DECLARE
  v_note public.delivery_notes;
  v_item jsonb;
  v_quantity integer;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Aucun équipement à sortir';
  END IF;

  INSERT INTO public.delivery_notes (user_id, due_date, notes)
  VALUES (p_user_id, p_due_date, p_notes)
  RETURNING * INTO v_note;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_quantity := COALESCE((v_item->>'quantity')::integer, 1);
    IF v_quantity < 1 THEN
      RAISE EXCEPTION 'Quantité invalide';
    END IF;

    -- Une ligne par unité : le trigger refuse la sortie dès qu'il n'y a plus de stock
    INSERT INTO public.checkouts (equipment_id, user_id, delivery_note_id, due_date, status, notes)
    SELECT (v_item->>'equipment_id')::uuid, p_user_id, v_note.id, p_due_date, 'active', p_notes
    FROM generate_series(1, v_quantity);
  END LOOP;

  RETURN v_note;
END;
$$;

-- Matériel perdu puis retrouvé : le total ne change plus, l'emprunt repasse simplement en « retourné »
CREATE OR REPLACE FUNCTION public.recover_lost_equipment(checkout_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.checkouts c
  SET status = 'returned',
      return_date = now(),
      notes = COALESCE(c.notes || E'\n', '') || 'Matériel retrouvé le ' || to_char(now(), 'DD/MM/YYYY')
  WHERE c.id = recover_lost_equipment.checkout_id
    AND c.status = 'lost';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Emprunt perdu introuvable';
  END IF;
END;
$$;

-- Ancienne version qui diminuait le total en plus de compter l'emprunt perdu (double décompte)
DROP FUNCTION IF EXISTS public.mark_equipment_lost(uuid);

-- Recalcul global (utilisé par le bouton « mettre à jour les quantités »)
CREATE OR REPLACE FUNCTION public.update_equipment_availability()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.equipment SET total_quantity = total_quantity;
$$;

-- Remise à niveau des stocks existants
SELECT public.update_equipment_availability();
