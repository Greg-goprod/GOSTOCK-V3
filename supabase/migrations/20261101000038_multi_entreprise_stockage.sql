/*
  Module 0 — étape 0.5 : fichiers rangés par entreprise

  Les nouveaux fichiers sont envoyés dans un dossier portant l'identifiant de l'entreprise :
    fichiers/<entreprise>/retours/….jpg      photos-articles/<entreprise>/2026/….jpg      backups/<entreprise>/….json
  Les anciens fichiers (sans dossier d'entreprise) appartiennent à l'entreprise historique : ils ne sont ni
  déplacés ni renommés, la règle d'accès les rattache à elle.
  Les règles d'accès comparent ce dossier à l'entreprise active de la personne connectée.
  Reprend aussi la table notification_reads (migration 37) dans l'isolation par entreprise.
*/

-- Entreprise d'un chemin de fichier : le 1er dossier s'il est un identifiant, sinon l'entreprise historique
CREATE OR REPLACE FUNCTION public.storage_path_org(p_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT CASE
    WHEN split_part(COALESCE(p_name, ''), '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN split_part(p_name, '/', 1)::uuid
    ELSE public.default_organization_id()
  END
$$;
REVOKE EXECUTE ON FUNCTION public.storage_path_org(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_path_org(text) TO authenticated, service_role;

-- Fichiers privés (photos de retour, PV)
DROP POLICY IF EXISTS fichiers_lecture_membres ON storage.objects;
DROP POLICY IF EXISTS fichiers_depot_membres ON storage.objects;
DROP POLICY IF EXISTS fichiers_suppression_reglages ON storage.objects;
CREATE POLICY fichiers_lecture_membres ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fichiers' AND public.app_is_member() AND public.storage_path_org(name) = public.app_org_id());
CREATE POLICY fichiers_depot_membres ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fichiers' AND public.app_is_member() AND public.storage_path_org(name) = public.app_org_id());
CREATE POLICY fichiers_suppression_reglages ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fichiers' AND public.app_has('settings') AND public.storage_path_org(name) = public.app_org_id());

-- Sauvegardes (lecture par l'administrateur de l'entreprise ; l'écriture se fait par la fonction de bord)
DROP POLICY IF EXISTS backups_read_admin ON storage.objects;
CREATE POLICY backups_read_admin ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'backups' AND public.app_has('settings') AND public.storage_path_org(name) = public.app_org_id());

-- Photos d'articles (lecture publique par lien ; écriture par la gestion du stock de l'entreprise)
DROP POLICY IF EXISTS photos_articles_ajout ON storage.objects;
DROP POLICY IF EXISTS photos_articles_modif ON storage.objects;
DROP POLICY IF EXISTS photos_articles_suppression ON storage.objects;
CREATE POLICY photos_articles_ajout ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos-articles' AND public.app_has('manage_stock') AND public.storage_path_org(name) = public.app_org_id());
CREATE POLICY photos_articles_modif ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'photos-articles' AND public.app_has('manage_stock') AND public.storage_path_org(name) = public.app_org_id());
CREATE POLICY photos_articles_suppression ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos-articles' AND public.app_has('manage_stock') AND public.storage_path_org(name) = public.app_org_id());

-- Table ajoutée par la migration 37, après la mise en place de l'isolation : mêmes règles que les autres tables
ALTER TABLE public.notification_reads
  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id);
ALTER TABLE public.notification_reads ALTER COLUMN organization_id SET DEFAULT public.new_row_org_id();
CREATE INDEX IF NOT EXISTS notification_reads_org_idx ON public.notification_reads (organization_id);
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON public.notification_reads;
CREATE POLICY org_isolation ON public.notification_reads AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = (SELECT public.app_org_id()))
  WITH CHECK (organization_id = (SELECT public.app_org_id()));
DROP TRIGGER IF EXISTS a_org_write_guard ON public.notification_reads;
CREATE TRIGGER a_org_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.notification_reads
  FOR EACH ROW EXECUTE FUNCTION public.org_write_guard();
