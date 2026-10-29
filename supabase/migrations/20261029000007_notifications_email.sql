/*
  Notifications par e-mail

  Les alertes (stock bas, demande à valider, échéance véhicule) sont déjà écrites dans
  public.notifications. La fonction Edge « send-notification-emails » les envoie par le
  relais SMTP de Mannyx, appelée toutes les 5 minutes par pg_cron.

  - notification_recipients : qui reçoit quoi (types d'alerte, dépôt facultatif)
  - claim_notification_emails() : réserve un lot d'alertes à envoyer ; deux exécutions
    simultanées ne prennent jamais la même alerte (FOR UPDATE SKIP LOCKED)
  - après 3 échecs, une alerte n'est plus retentée (erreur visible dans email_error)

  Les identifiants SMTP ne sont pas en base : ce sont des secrets de la fonction Edge.
  La planification pg_cron (URL du projet + clé publique) est faite hors migration,
  voir la fin du fichier.
*/

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_error text;

-- Les alertes existantes ne partent pas d'un coup à la mise en service
UPDATE public.notifications SET emailed_at = created_at WHERE emailed_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_email_pending_idx
  ON public.notifications (created_at) WHERE emailed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  name text NOT NULL,
  email text NOT NULL CHECK (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  kinds text[] NOT NULL DEFAULT ARRAY['low_stock', 'request_to_approve', 'vehicle_deadline'],
  -- NULL : tous les dépôts
  depot_id uuid REFERENCES public.depots(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_recipients' AND policyname = 'notification_recipients_open_access'
  ) THEN
    CREATE POLICY notification_recipients_open_access ON public.notification_recipients
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Réserve jusqu'à p_limit alertes à envoyer, avec le dépôt concerné et les destinataires
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
      -- une réservation abandonnée (fonction interrompue) se libère après 10 minutes
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
         ARRAY(
           SELECT nr.email FROM public.notification_recipients nr
           WHERE nr.active
             AND nr.organization_id = l.organization_id
             AND l.kind = ANY (nr.kinds)
             AND (nr.depot_id IS NULL OR nr.depot_id = l.resolved_depot_id)
           ORDER BY nr.email
         )
  FROM located l
  LEFT JOIN public.depots d ON d.id = l.resolved_depot_id;
END;
$$;

-- Résultat d'envoi d'une alerte (appelé par la fonction Edge). p_done : au moins un
-- destinataire l'a reçue ; on ne la renvoie pas, même si une autre adresse a échoué
CREATE OR REPLACE FUNCTION public.mark_notification_email(p_id uuid, p_error text DEFAULT NULL, p_done boolean DEFAULT NULL)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.notifications
  SET emailed_at = CASE WHEN COALESCE(p_done, p_error IS NULL) THEN now() ELSE emailed_at END,
      email_error = p_error,
      email_claimed_at = NULL
  WHERE id = p_id;
$$;

-- Réservées à la fonction Edge (clé service) : la clé publique ne peut pas vider la file
REVOKE EXECUTE ON FUNCTION public.claim_notification_emails(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_notification_email(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_emails(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_email(uuid, text, boolean) TO service_role;

ALTER FUNCTION public.claim_notification_emails(integer) SET search_path = public, extensions;
ALTER FUNCTION public.mark_notification_email(uuid, text, boolean) SET search_path = public, extensions;

-- Planification (à exécuter une fois par projet, hors migration) :
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;
-- SELECT cron.schedule('gomat-notification-emails', '*/5 * * * *', $cron$
--   SELECT net.http_post(
--     url := 'https://<projet>.supabase.co/functions/v1/send-notification-emails',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <clé anon>'),
--     body := '{}'::jsonb
--   );
-- $cron$);
