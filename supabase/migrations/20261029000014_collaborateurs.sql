/*
  Collaborateurs : avis personnels, paniers favoris, retrait par un tiers

  - notifications.recipient_user_id : avis adressé à une personne (sa demande est validée,
    refusée ou prête à retirer). Elle le voit dans l'application, et le reçoit par e-mail
    dès que l'envoi est configuré (claim_notification_emails l'adresse à son e-mail).
  - request_templates : paniers favoris d'une personne (articles et chantier habituels).
  - requests.picked_up_by : personne venue retirer la demande, si ce n'est pas le demandeur
    (chef d'équipe pour son équipe). Le demandeur reste responsable du matériel.
*/

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON public.notifications (recipient_user_id) WHERE recipient_user_id IS NOT NULL;

-- Le destinataire voit et marque comme lus ses propres avis
ALTER POLICY notifications_open_access ON public.notifications
  USING ((public.app_has('view_all') OR public.app_has('scan') OR public.app_has('approve') OR public.app_has('manage_stock'))
         OR recipient_user_id = public.app_user_id())
  WITH CHECK (public.app_is_member());
ALTER POLICY notifications_update_rule ON public.notifications
  USING ((public.app_has('view_all') OR public.app_has('scan') OR public.app_has('approve') OR public.app_has('manage_stock'))
         OR recipient_user_id = public.app_user_id())
  WITH CHECK ((public.app_has('view_all') OR public.app_has('scan') OR public.app_has('approve') OR public.app_has('manage_stock'))
         OR recipient_user_id = public.app_user_id());

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS picked_up_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Avis au demandeur quand sa demande avance
CREATE OR REPLACE FUNCTION public.requests_notify_requester()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kind text;
  v_title text;
  v_message text;
  v_depot text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_depot FROM public.depots WHERE id = NEW.depot_id;

  IF NEW.status = 'ready' THEN
    v_kind := 'request_ready';
    v_title := 'Prête à retirer : ' || NEW.number;
    v_message := format('Votre demande %s est prête au %s (retrait prévu le %s).', NEW.number, COALESCE(v_depot, 'magasin'), to_char(NEW.start_at AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY à HH24:MI'));
  -- Validée par un responsable (pas la validation automatique d'une demande sans contrôle)
  ELSIF NEW.status = 'approved' AND OLD.status = 'requested' AND NEW.needs_approval THEN
    v_kind := 'request_approved';
    v_title := 'Demande validée : ' || NEW.number;
    v_message := format('Votre demande %s a été validée%s.', NEW.number, COALESCE(' par ' || NEW.decided_by, ''));
  ELSIF NEW.status = 'rejected' THEN
    v_kind := 'request_rejected';
    v_title := 'Demande refusée : ' || NEW.number;
    v_message := format('Votre demande %s a été refusée%s.', NEW.number, COALESCE(' : ' || NEW.decision_note, ''));
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (organization_id, kind, title, message, request_id, recipient_user_id, dedupe_key)
  VALUES (NEW.organization_id, v_kind, v_title, v_message, NEW.id, NEW.requester_id, v_kind || ':' || NEW.id)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'requests_notify_requester_trigger' AND tgrelid = 'public.requests'::regclass) THEN
    CREATE TRIGGER requests_notify_requester_trigger
      AFTER UPDATE OF status ON public.requests
      FOR EACH ROW EXECUTE FUNCTION public.requests_notify_requester();
  END IF;
END $$;

-- Envoi des e-mails : un avis personnel part à son destinataire, les autres à la liste
CREATE OR REPLACE FUNCTION public.claim_notification_emails(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  kind text,
  title text,
  message text,
  created_at timestamptz,
  depot_name text,
  recipients text[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT n.id
    FROM public.notifications n
    WHERE n.emailed_at IS NULL
      AND n.email_attempts < 3
      AND (n.email_claimed_at IS NULL OR n.email_claimed_at < now() - interval '10 minutes')
    ORDER BY n.created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.notifications n
    SET email_claimed_at = now(), email_attempts = n.email_attempts + 1
    FROM picked
    WHERE n.id = picked.id
    RETURNING n.*
  ),
  located AS (
    SELECT c.*,
           COALESCE(c.depot_id, r.depot_id, v.depot_id) AS resolved_depot_id
    FROM claimed c
    LEFT JOIN public.requests r ON r.id = c.request_id
    LEFT JOIN public.vehicles v ON v.id = c.vehicle_id
  )
  SELECT l.id, l.kind, l.title, l.message, l.created_at, d.name,
         CASE WHEN l.recipient_user_id IS NOT NULL THEN
           ARRAY(SELECT u.email FROM public.users u WHERE u.id = l.recipient_user_id AND u.active AND u.email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')
         ELSE
           ARRAY(
             SELECT nr.email FROM public.notification_recipients nr
             WHERE nr.active
               AND nr.organization_id = l.organization_id
               AND l.kind = ANY (nr.kinds)
               AND (nr.depot_id IS NULL OR nr.depot_id = l.resolved_depot_id)
             ORDER BY nr.email
           )
         END
  FROM located l
  LEFT JOIN public.depots d ON d.id = l.resolved_depot_id;
END;
$$;

-- Paniers favoris
CREATE TABLE IF NOT EXISTS public.request_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  destination text,
  items jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.request_templates ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'request_templates' AND policyname = 'request_templates_own') THEN
    CREATE POLICY request_templates_own ON public.request_templates FOR ALL TO authenticated
      USING (user_id = public.app_user_id()) WITH CHECK (user_id = public.app_user_id());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_templates TO authenticated;
GRANT ALL ON public.request_templates TO service_role;

REVOKE EXECUTE ON FUNCTION public.requests_notify_requester() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_notification_emails(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_emails(integer) TO service_role;
ALTER FUNCTION public.requests_notify_requester() SET search_path = public, extensions;
ALTER FUNCTION public.claim_notification_emails(integer) SET search_path = public, extensions;
