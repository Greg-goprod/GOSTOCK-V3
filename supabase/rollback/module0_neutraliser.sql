/*
  Retour arrière d'urgence du module 0 (migrations 35 et 36) — NEUTRALISE l'isolation, ne supprime aucune donnée.

  À utiliser seulement si l'application cesse de fonctionner juste après la mise en place du module 0 :
  les règles d'isolation et les gardes d'écriture sont retirés ; les colonnes organization_id, les entreprises et les
  fonctions restent (elles fonctionnent aussi avec une seule entreprise). Tant que ce script a été joué, il ne faut
  PAS créer de deuxième entreprise : rien ne les séparerait.
  Pour revenir complètement en arrière : restaurer la sauvegarde faite avant la migration.
*/
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
      AND c.relname NOT IN ('organizations', 'platform_admins', 'account_context')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS a_org_write_guard ON public.%I', t);
  END LOOP;
END $$;
