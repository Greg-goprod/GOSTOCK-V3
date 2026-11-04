/*
  PILOTE : documents d'un projet ou d'un élément — la « mini-Dropbox » (UI-7b).

  Décisions de Greg (2026-11-04) : écrire = l'équipe du projet et les responsables (comme la discussion) ; lire = toute personne qui
  voit les projets ; 50 Mo par fichier ; types courants, pas d'exécutables ; téléchargement par lien signé de courte durée.

  Rangement : bucket PRIVÉ « cp-documents », fichiers « <entreprise>/<projet>/<identifiant>-<nom> ».
  Table cp_documents : une ligne par fichier (nom d'origine, taille, type, qui, quand, chemin) ; le fichier lui-même est dans le stockage.

  Règles d'accès du stockage (bucket cp-documents) :
    - déposer : module activé, dossier de SON entreprise, projet existant dont on peut écrire la discussion (équipe ou responsable) ;
    - lire (donc créer un lien signé) : module activé, dossier de son entreprise, ET une ligne cp_documents existe pour ce chemin, avec le droit
      de lecture des projets : un fichier dont la ligne a été supprimée n'est plus lisible par les lecteurs, même avant son effacement physique.
      Les personnes qui peuvent écrire dans le projet voient en plus les fichiers SANS ligne (dépôt interrompu, ou ligne supprimée en attente
      d'effacement, au plus quelques minutes) : c'est nécessaire pour les supprimer ;
    - supprimer un fichier SANS ligne (dépôt interrompu) : les personnes qui peuvent écrire dans le projet.
  Suppression d'un document : on supprime sa LIGNE (uploader, ou droit de suppression des projets) ; un déclencheur met son chemin dans
  cp_document_trash, et la fonction d'e-mails (clé de service, toutes les 5 minutes) efface le fichier du stockage. Cela couvre aussi la
  suppression d'un projet ou d'un élément (suppression en cascade des lignes) : aucun fichier orphelin. (Supprimer une ligne de storage.objects
  par SQL n'effacerait PAS le fichier : seul l'appel au service de stockage le fait.)
*/

-- 1. Table ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cp_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  project_id uuid NOT NULL REFERENCES public.cp_projects(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.cp_items(id) ON DELETE CASCADE,
  file_name text NOT NULL CHECK (btrim(file_name) <> '' AND char_length(file_name) <= 200 AND file_name !~ '[/\\]'),
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 52428800),
  mime_type text CHECK (mime_type IS NULL OR char_length(mime_type) <= 200),
  storage_path text NOT NULL UNIQUE,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT public.app_user_id(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cp_documents_thread_idx ON public.cp_documents (project_id, item_id, created_at);
CREATE INDEX IF NOT EXISTS cp_documents_item_idx ON public.cp_documents (item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cp_documents_org_idx ON public.cp_documents (organization_id);

-- Fichiers à effacer du stockage (alimenté par un déclencheur, vidé par la fonction d'e-mails) : personne d'autre n'y touche
CREATE TABLE IF NOT EXISTS public.cp_document_trash (
  storage_path text PRIMARY KEY,
  organization_id uuid NOT NULL,
  queued_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cp_document_trash ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cp_document_trash FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.cp_document_trash TO service_role;

-- 2. Chemin d'un fichier : le projet est le 2e dossier --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cp_doc_path_project(p_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT CASE WHEN split_part(COALESCE(p_name, ''), '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN split_part(p_name, '/', 2)::uuid END
$$;
REVOKE EXECUTE ON FUNCTION public.cp_doc_path_project(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_doc_path_project(text) TO authenticated, service_role;

-- 3. Contrôles de ligne (droits du propriétaire, lectures limitées à l'entreprise de la ligne : même principe que la migration 54) --
CREATE OR REPLACE FUNCTION public.cp_document_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_item_project uuid;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Un document ne se modifie pas : supprime-le et envoie-le de nouveau'; END IF;
  IF public.app_user_id() IS NOT NULL THEN NEW.uploaded_by := public.app_user_id(); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_projects p WHERE p.id = NEW.project_id AND p.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Projet introuvable';
  END IF;
  IF NEW.item_id IS NOT NULL THEN
    SELECT i.project_id INTO v_item_project FROM public.cp_items i WHERE i.id = NEW.item_id AND i.organization_id = NEW.organization_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Élément introuvable'; END IF;
    IF v_item_project <> NEW.project_id THEN RAISE EXCEPTION 'Cet élément n''est pas dans ce projet'; END IF;
  END IF;
  -- Le fichier est rangé dans le dossier de SON entreprise et de SON projet (une ligne ne peut pas désigner le fichier d'un autre)
  IF split_part(NEW.storage_path, '/', 1) <> NEW.organization_id::text OR public.cp_doc_path_project(NEW.storage_path) IS DISTINCT FROM NEW.project_id THEN
    RAISE EXCEPTION 'Le fichier n''est pas rangé dans le dossier de ce projet';
  END IF;
  -- Pas d'exécutables ni de scripts (et pas de pages web, qui pourraient exécuter du code à l'ouverture)
  IF lower(NEW.file_name) ~ '\.(exe|msi|bat|cmd|com|scr|pif|ps1|psm1|vbs|vbe|js|jse|mjs|wsf|wsh|jar|apk|app|dmg|pkg|deb|rpm|dll|sys|so|hta|lnk|reg|cpl|msc|html|htm|xhtml|svg|php|py|sh|bash)$' THEN
    RAISE EXCEPTION 'Ce type de fichier n''est pas accepté (exécutable, script ou page web)';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_document_guard() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cp_document_to_trash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.cp_document_trash (storage_path, organization_id) VALUES (OLD.storage_path, OLD.organization_id) ON CONFLICT DO NOTHING;
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_document_to_trash() FROM PUBLIC, anon, authenticated;

-- 4. Branchements de la table : isolation entreprise, garde d'écriture, contrôles, journal d'audit, règles ---------------------
ALTER TABLE public.cp_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON public.cp_documents;
CREATE POLICY org_isolation ON public.cp_documents AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = (SELECT public.app_org_id())) WITH CHECK (organization_id = (SELECT public.app_org_id()));
DROP POLICY IF EXISTS documents_read ON public.cp_documents;
DROP POLICY IF EXISTS documents_insert ON public.cp_documents;
DROP POLICY IF EXISTS documents_delete ON public.cp_documents;
CREATE POLICY documents_read ON public.cp_documents FOR SELECT TO authenticated
  USING ((SELECT public.org_module_enabled('cp.projects')) AND (SELECT public.rbac_has_any_permission(ARRAY['cp.projects:read'])));
CREATE POLICY documents_insert ON public.cp_documents FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.org_module_enabled('cp.projects')) AND (SELECT public.cp_can_discuss(project_id)));
CREATE POLICY documents_delete ON public.cp_documents FOR DELETE TO authenticated
  USING ((SELECT public.org_module_enabled('cp.projects'))
         AND (uploaded_by = (SELECT public.app_user_id()) OR (SELECT public.rbac_has_any_permission(ARRAY['cp.projects:delete']))));
GRANT SELECT, INSERT, DELETE ON public.cp_documents TO authenticated, service_role;
REVOKE ALL ON public.cp_documents FROM anon;
DROP TRIGGER IF EXISTS a_org_write_guard ON public.cp_documents;
CREATE TRIGGER a_org_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.cp_documents FOR EACH ROW EXECUTE FUNCTION public.org_write_guard();
DROP TRIGGER IF EXISTS b_cp_document_guard ON public.cp_documents;
CREATE TRIGGER b_cp_document_guard BEFORE INSERT OR UPDATE ON public.cp_documents FOR EACH ROW EXECUTE FUNCTION public.cp_document_guard();
DROP TRIGGER IF EXISTS c_cp_document_trash ON public.cp_documents;
CREATE TRIGGER c_cp_document_trash AFTER DELETE ON public.cp_documents FOR EACH ROW EXECUTE FUNCTION public.cp_document_to_trash();
DROP TRIGGER IF EXISTS cp_documents_audit_trigger ON public.cp_documents;
CREATE TRIGGER cp_documents_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.cp_documents FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- 5. Le bucket et ses règles d'accès --------------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cp-documents', 'cp-documents', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

DROP POLICY IF EXISTS cp_documents_depot ON storage.objects;
DROP POLICY IF EXISTS cp_documents_lecture ON storage.objects;
DROP POLICY IF EXISTS cp_documents_suppression_orphelin ON storage.objects;
CREATE POLICY cp_documents_depot ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cp-documents'
    AND (SELECT public.org_module_enabled('cp.projects'))
    AND public.storage_path_org(name) = (SELECT public.app_org_id())
    AND public.cp_doc_path_project(name) IS NOT NULL
    -- (« storage.objects.name » : dans la sous-requête, « name » désignerait le nom du projet)
    AND EXISTS (SELECT 1 FROM public.cp_projects p WHERE p.id = public.cp_doc_path_project(storage.objects.name))
    AND (SELECT public.cp_can_discuss(public.cp_doc_path_project(name))));
CREATE POLICY cp_documents_lecture ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cp-documents'
    AND (SELECT public.org_module_enabled('cp.projects'))
    AND public.storage_path_org(name) = (SELECT public.app_org_id())
    AND (
      -- Un fichier qui a sa ligne : lisible par toute personne qui voit les projets
      (EXISTS (SELECT 1 FROM public.cp_documents d WHERE d.storage_path = storage.objects.name) AND (SELECT public.rbac_has_any_permission(ARRAY['cp.projects:read'])))
      -- Un fichier SANS ligne (dépôt en cours, interrompu, ou ligne supprimée en attente d'effacement) : visible seulement par ceux qui écrivent dans le projet
      -- (il faut pouvoir le voir pour le supprimer : une suppression ciblée lit la ligne)
      OR (public.cp_doc_path_project(name) IS NOT NULL AND (SELECT public.cp_can_discuss(public.cp_doc_path_project(name)))
          AND NOT EXISTS (SELECT 1 FROM public.cp_documents d WHERE d.storage_path = storage.objects.name))
    ));
CREATE POLICY cp_documents_suppression_orphelin ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cp-documents'
    AND (SELECT public.org_module_enabled('cp.projects'))
    AND public.storage_path_org(name) = (SELECT public.app_org_id())
    AND public.cp_doc_path_project(name) IS NOT NULL
    AND (SELECT public.cp_can_discuss(public.cp_doc_path_project(name)))
    AND NOT EXISTS (SELECT 1 FROM public.cp_documents d WHERE d.storage_path = storage.objects.name));
