/*
  Fonctions de déclencheurs : pas d'appel direct par l'API

  Un déclencheur s'exécute sans que l'utilisateur ait le droit EXECUTE sur sa fonction ;
  on retire donc ce droit (signalé par le conseiller de sécurité Supabase pour les fonctions
  SECURITY DEFINER). Les autres fonctions SECURITY DEFINER restent appelables par les membres
  connectés, volontairement : whoami, app_* (utilisées par les règles RLS), create_request,
  disponibilités et recalculs de données dérivées.
*/
DO $$
BEGIN
  EXECUTE COALESCE((
    SELECT string_agg(format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', p.oid::regprocedure), '; ')
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prorettype = 'trigger'::regtype
  ), 'SELECT 1');
END $$;
