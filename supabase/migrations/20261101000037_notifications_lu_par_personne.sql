/*
  Notifications : « lu / non lu » propre à chaque personne

  Avant : un seul champ notifications.read_at pour tout le monde. Une alerte du magasin lue par une personne
  disparaissait pour toutes les autres, et l'écran « Notifications » gardait à côté une liste recalculée dont
  l'état « lu » n'était pas enregistré.

  Maintenant :
    - notification_reads : l'état lu / non lu de CHAQUE personne (une ligne par personne et par notification) ;
    - my_notifications() : les notifications que la personne a le droit de voir (les siennes, et celles du magasin
      si elle fait partie du personnel), avec son état lu ;
    - unread_notification_count() : le nombre affiché sur la pastille ;
    - mark_notifications_read(), mark_notification_unread(), mark_all_notifications_read().
  Les anciennes alertes déjà lues (read_at renseigné) restent lues pour tout le monde, sauf si une personne
  les remet en « non lue ». Le champ read_at n'est plus modifié par l'application.
*/

CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_read boolean NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);
CREATE INDEX IF NOT EXISTS notification_reads_user_idx ON public.notification_reads (user_id);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_reads_own ON public.notification_reads;
CREATE POLICY notification_reads_own ON public.notification_reads FOR ALL TO authenticated
  USING (user_id = public.app_user_id()) WITH CHECK (user_id = public.app_user_id());
REVOKE ALL ON public.notification_reads FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_reads TO authenticated, service_role;

-- La notification est-elle destinée à la personne connectée ? (même règle que la lecture de la table)
CREATE OR REPLACE FUNCTION public.notification_is_mine(p_recipient uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT public.app_user_id() IS NOT NULL
     AND (p_recipient = public.app_user_id()
          OR (p_recipient IS NULL
              AND (public.app_has('view_all') OR public.app_has('scan') OR public.app_has('approve') OR public.app_has('manage_stock'))))
$$;

CREATE OR REPLACE FUNCTION public.my_notifications(p_limit integer DEFAULT 200)
RETURNS TABLE (
  id uuid, kind text, title text, message text, equipment_id uuid, depot_id uuid, request_id uuid,
  vehicle_id uuid, recipient_user_id uuid, created_at timestamptz, is_read boolean
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT n.id, n.kind, n.title, n.message, n.equipment_id, n.depot_id, n.request_id, n.vehicle_id,
         n.recipient_user_id, n.created_at, COALESCE(r.is_read, n.read_at IS NOT NULL)
  FROM public.notifications n
  LEFT JOIN public.notification_reads r ON r.notification_id = n.id AND r.user_id = public.app_user_id()
  WHERE public.notification_is_mine(n.recipient_user_id)
  ORDER BY n.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 500))
$$;

CREATE OR REPLACE FUNCTION public.unread_notification_count()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT count(*)::integer
  FROM public.notifications n
  LEFT JOIN public.notification_reads r ON r.notification_id = n.id AND r.user_id = public.app_user_id()
  WHERE public.notification_is_mine(n.recipient_user_id)
    AND NOT COALESCE(r.is_read, n.read_at IS NOT NULL)
$$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_me uuid := public.app_user_id();
  v_n integer;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;
  INSERT INTO public.notification_reads (notification_id, user_id, is_read)
  SELECT n.id, v_me, true FROM public.notifications n
  WHERE n.id = ANY (COALESCE(p_ids, '{}')) AND public.notification_is_mine(n.recipient_user_id)
  ON CONFLICT (notification_id, user_id) DO UPDATE SET is_read = true, changed_at = now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_unread(p_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_me uuid := public.app_user_id();
  v_n integer;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;
  INSERT INTO public.notification_reads (notification_id, user_id, is_read)
  SELECT n.id, v_me, false FROM public.notifications n
  WHERE n.id = p_id AND public.notification_is_mine(n.recipient_user_id)
  ON CONFLICT (notification_id, user_id) DO UPDATE SET is_read = false, changed_at = now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_me uuid := public.app_user_id();
  v_n integer;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;
  INSERT INTO public.notification_reads (notification_id, user_id, is_read)
  SELECT n.id, v_me, true
  FROM public.notifications n
  LEFT JOIN public.notification_reads r ON r.notification_id = n.id AND r.user_id = v_me
  WHERE public.notification_is_mine(n.recipient_user_id) AND NOT COALESCE(r.is_read, n.read_at IS NOT NULL)
  ON CONFLICT (notification_id, user_id) DO UPDATE SET is_read = true, changed_at = now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.notification_is_mine(uuid), public.my_notifications(integer), public.unread_notification_count(),
  public.mark_notifications_read(uuid[]), public.mark_notification_unread(uuid), public.mark_all_notifications_read()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.notification_is_mine(uuid), public.my_notifications(integer), public.unread_notification_count(),
  public.mark_notifications_read(uuid[]), public.mark_notification_unread(uuid), public.mark_all_notifications_read()
TO authenticated;
