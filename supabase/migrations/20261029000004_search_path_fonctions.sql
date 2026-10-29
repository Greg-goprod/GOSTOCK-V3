/*
  Sécurité : chemin de recherche fixe pour toutes les fonctions de l'app
  (avertissement Supabase « function_search_path_mutable »). Les fonctions des extensions
  ne sont pas concernées. À rejouer après chaque migration qui ajoute des fonctions.
*/
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname = 'public' AND d.objid IS NULL AND p.prokind IN ('f', 'p')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', f.signature);
  END LOOP;
END $$;
