/*
  Fonction d'e-mails : n'accepter que la tâche planifiée de la base (revue de sécurité de la pull request, point 2).

  Constat (vérifié sur GO-MAT) : la tâche planifiée appelle la fonction avec la clé PUBLIQUE du projet (rôle « anon »), et la fonction accepte tout appel muni
  d'une clé du projet : toute personne qui lit la clé publique (elle est dans l'application) pouvait déclencher les rappels, les e-mails, les SMS, les notifications
  téléphone et les sauvegardes.

  Correctif : un secret PROPRE À LA BASE, généré par la base (jamais saisi ni affiché), gardé dans une table réservée au propriétaire. La tâche planifiée le lit
  au moment de l'appel et l'envoie dans l'en-tête « x-cron-secret » ; la fonction d'e-mails le fait vérifier par verify_cron_secret() (clé de service seulement).
  Le secret ne figure ni dans le dépôt, ni dans la définition de la tâche (qui contient seulement « lis-le dans la table »).
  Pour le changer : UPDATE public.cron_secret SET secret = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '').
*/
CREATE TABLE IF NOT EXISTS public.cron_secret (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  secret text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
ALTER TABLE public.cron_secret ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cron_secret FROM PUBLIC, anon, authenticated;
INSERT INTO public.cron_secret (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_cron_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT p_secret IS NOT NULL AND length(p_secret) >= 32 AND EXISTS (SELECT 1 FROM public.cron_secret c WHERE c.secret = p_secret)
$$;
REVOKE EXECUTE ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;

-- La tâche planifiée (si pg_cron est là) envoie le secret dans l'en-tête « x-cron-secret » (lu dans la table à chaque appel)
DO $$
DECLARE
  v_job bigint;
  v_cmd text;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN; END IF;
  SELECT jobid, command INTO v_job, v_cmd FROM cron.job WHERE jobname = 'gomat-notification-emails';
  IF v_job IS NOT NULL AND v_cmd NOT LIKE '%x-cron-secret%' THEN
    PERFORM cron.alter_job(v_job, command := replace(v_cmd, '''Content-Type'', ''application/json'',',
      '''Content-Type'', ''application/json'', ''x-cron-secret'', (SELECT secret FROM public.cron_secret),'));
  END IF;
END $$;
