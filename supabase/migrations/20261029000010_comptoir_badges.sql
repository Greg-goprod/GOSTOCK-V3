/*
  Comptoir : badges des personnes et sortie par exemplaire

  - user_badges : un code de badge par personne, contenu du QR « GOMAT-USER:<code> ».
    Le code est aléatoire (impossible à deviner) et peut être régénéré si un badge est perdu :
    l'ancien cesse alors de fonctionner. Chacun voit son propre badge (sur son téléphone) ;
    seul le magasin et les gestionnaires de personnes voient ceux des autres.
  - find_user_by_badge() : retrouve la personne d'un badge scanné (droit « scanner »).
  - create_checkout() accepte un exemplaire précis (instance_id) : un QR individuel ne peut
    pas être sorti deux fois, et l'état de l'exemplaire suit les sorties et retours.
*/

CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(9), 'hex'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.user_badges (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.users_create_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_badges (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_create_badge_trigger' AND tgrelid = 'public.users'::regclass) THEN
    CREATE TRIGGER users_create_badge_trigger
      AFTER INSERT ON public.users
      FOR EACH ROW EXECUTE FUNCTION public.users_create_badge();
  END IF;
END $$;

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_badges' AND policyname = 'user_badges_read') THEN
    CREATE POLICY user_badges_read ON public.user_badges FOR SELECT TO authenticated
      USING (user_id = public.app_user_id() OR public.app_has('scan') OR public.app_has('manage_people'));
  END IF;
END $$;

GRANT SELECT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;

-- Personne correspondant à un badge scanné
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
  WHERE b.code = v_code AND u.active;
  RETURN v_user;
END;
$$;

-- Nouveau code de badge (badge ou téléphone perdu) : soi-même ou un gestionnaire de personnes
CREATE OR REPLACE FUNCTION public.regenerate_badge(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
BEGIN
  IF p_user_id IS DISTINCT FROM public.app_user_id() AND NOT public.app_has('manage_people') THEN
    RAISE EXCEPTION 'Vous ne pouvez régénérer que votre propre badge';
  END IF;
  INSERT INTO public.user_badges (user_id, code, updated_at)
  VALUES (p_user_id, encode(extensions.gen_random_bytes(9), 'hex'), now())
  ON CONFLICT (user_id) DO UPDATE SET code = excluded.code, updated_at = now()
  RETURNING code INTO v_code;
  RETURN v_code;
END;
$$;

-- Sortie : un exemplaire précis peut être demandé (QR individuel)
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
  v_instance uuid;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Aucun équipement à sortir';
  END IF;

  INSERT INTO public.delivery_notes (user_id, due_date, notes)
  VALUES (p_user_id, p_due_date, p_notes)
  RETURNING * INTO v_note;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_instance := NULLIF(v_item->>'instance_id', '')::uuid;

    IF v_instance IS NOT NULL THEN
      -- Le verrou sérialise deux sorties simultanées du même exemplaire
      PERFORM 1 FROM public.equipment_instances
      WHERE id = v_instance AND equipment_id = (v_item->>'equipment_id')::uuid
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Exemplaire introuvable pour cet équipement';
      END IF;
      IF EXISTS (SELECT 1 FROM public.checkouts WHERE instance_id = v_instance AND status IN ('active', 'overdue')) THEN
        RAISE EXCEPTION 'Cet exemplaire est déjà sorti';
      END IF;
      INSERT INTO public.checkouts (equipment_id, instance_id, user_id, delivery_note_id, due_date, status, notes)
      VALUES ((v_item->>'equipment_id')::uuid, v_instance, p_user_id, v_note.id, p_due_date, 'active', p_notes);
      CONTINUE;
    END IF;

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

-- L'état d'un exemplaire suit ses sorties (sorti, perdu, disponible)
CREATE OR REPLACE FUNCTION public.checkouts_sync_instance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.instance_id IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.equipment_instances
  SET status = CASE NEW.status
    WHEN 'active' THEN 'checked-out'
    WHEN 'overdue' THEN 'checked-out'
    WHEN 'lost' THEN 'lost'
    ELSE 'available'
  END
  WHERE id = NEW.instance_id;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'checkouts_sync_instance_trigger' AND tgrelid = 'public.checkouts'::regclass) THEN
    CREATE TRIGGER checkouts_sync_instance_trigger
      AFTER INSERT OR UPDATE OF status ON public.checkouts
      FOR EACH ROW EXECUTE FUNCTION public.checkouts_sync_instance();
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.users_create_badge() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.checkouts_sync_instance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_user_by_badge(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.regenerate_badge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_user_by_badge(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_badge(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_checkout(uuid, timestamptz, jsonb, text) FROM PUBLIC, anon;

ALTER FUNCTION public.users_create_badge() SET search_path = public, extensions;
ALTER FUNCTION public.find_user_by_badge(text) SET search_path = public, extensions;
ALTER FUNCTION public.regenerate_badge(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.create_checkout(uuid, timestamptz, jsonb, text) SET search_path = public, extensions;
ALTER FUNCTION public.checkouts_sync_instance() SET search_path = public, extensions;
