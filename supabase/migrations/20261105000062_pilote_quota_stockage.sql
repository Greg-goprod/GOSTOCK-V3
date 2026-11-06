/*
  PILOTE : quota de stockage des documents, par entreprise (décisions de Greg, 2026-11-05).

  Périmètre : seuls les documents PILOTE (bucket « cp-documents ») comptent. Limite par défaut : 2 Go (2 147 483 648 octets) ; NULL = illimité.
  Elle se règle entreprise par entreprise (platform_set_storage_quota, console plateforme, journalisée).

  Comment c'est mesuré : la TAILLE RÉELLE des fichiers stockés sous le dossier de l'entreprise (storage.objects), jamais la taille « déclarée » par
  le navigateur dans la ligne du document (un navigateur modifié pourrait y mentir). Les fichiers sans ligne (dépôt interrompu) et ceux en attente
  d'effacement comptent aussi : ils occupent de la place.

  Deux barrières, et ce qu'elles ne garantissent pas :
    1. Règle de dépôt du stockage : on n'accepte un nouveau fichier que si l'espace déjà utilisé est SOUS la limite. La taille du fichier à venir n'est
       pas connue de la règle : la limite est donc franchie d'au plus un fichier (50 Mo) par dépôt, et plusieurs dépôts simultanés peuvent la dépasser
       d'autant. C'est une limite « souple » côté stockage.
    2. Garde de la ligne du document : à l'enregistrement de la ligne, l'espace RÉEL (fichier déposé compris) doit tenir dans la limite, sinon la ligne
       est refusée (« L'espace de stockage de l'entreprise est plein ») et l'écran retire le fichier. C'est la barrière exacte pour tout ce qui passe par l'écran.

  Fichiers orphelins (déposés sans ligne : coupure entre l'envoi et l'enregistrement, ou client modifié) : cp_orphan_documents() les liste après 24 h ;
  la fonction d'e-mails (clé de service) les efface. Sans cela, des dépôts directs sans ligne rempliraient l'espace sans jamais être visibles.

  Droits : les fonctions de mesure lisent le stockage avec les droits du propriétaire (les règles de lecture empêcheraient de compter les fichiers des autres) ;
  elles ne répondent qu'au sujet de l'entreprise de l'appelant.
*/

-- 1. Limite par entreprise -------------------------------------------------------------------------------------------------
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS cp_storage_quota_bytes bigint DEFAULT 2147483648;
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_cp_storage_quota_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_cp_storage_quota_check CHECK (cp_storage_quota_bytes IS NULL OR cp_storage_quota_bytes >= 0);

-- La limite ne se règle PAS depuis l'application : le garde de la table remet la valeur d'origine quand la modification vient d'un utilisateur connecté
-- (même un administrateur d'entreprise pourrait sinon se mettre « illimité »). Seules les fonctions de la console (droits du propriétaire) la changent.
CREATE OR REPLACE FUNCTION public.organizations_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.article_series := OLD.article_series;
    NEW.article_counter := OLD.article_counter;
    NEW.active := OLD.active;
    NEW.created_at := OLD.created_at;
    NEW.cp_storage_quota_bytes := OLD.cp_storage_quota_bytes;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Espace réellement utilisé par une entreprise (interne : aucun accès direct pour les utilisateurs) ---------------------------
CREATE OR REPLACE FUNCTION public.cp_storage_used_bytes(p_org uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(SUM(COALESCE((o.metadata ->> 'size')::bigint, 0)), 0)::bigint
  FROM storage.objects o
  WHERE o.bucket_id = 'cp-documents' AND o.name LIKE p_org::text || '/%'
$$;
REVOKE EXECUTE ON FUNCTION public.cp_storage_used_bytes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cp_storage_used_bytes(uuid) TO service_role;

-- 3. Pour l'écran : « X utilisés sur Y » (entreprise de l'appelant, module PILOTE actif, droit de lecture des projets) -----------
CREATE OR REPLACE FUNCTION public.cp_storage_status()
RETURNS TABLE(used_bytes bigint, quota_bytes bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_org uuid := public.app_org_id();
BEGIN
  IF v_org IS NULL OR NOT public.org_module_enabled('cp.projects') OR NOT public.rbac_has_any_permission(ARRAY['cp.projects:read']) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  RETURN QUERY SELECT public.cp_storage_used_bytes(v_org), (SELECT o.cp_storage_quota_bytes FROM public.organizations o WHERE o.id = v_org);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_storage_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_storage_status() TO authenticated;

-- 4. Pour la règle de dépôt : reste-t-il de la place (l'espace utilisé est-il SOUS la limite) ? -----------------------------------
CREATE OR REPLACE FUNCTION public.cp_storage_has_room()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_org uuid := public.app_org_id();
  v_quota bigint;
BEGIN
  IF v_org IS NULL THEN RETURN false; END IF;
  SELECT o.cp_storage_quota_bytes INTO v_quota FROM public.organizations o WHERE o.id = v_org;
  RETURN v_quota IS NULL OR public.cp_storage_used_bytes(v_org) < v_quota;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_storage_has_room() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_storage_has_room() TO authenticated;

-- 5. Barrière exacte : la ligne d'un document est refusée si l'espace RÉEL (fichier déposé compris) dépasse la limite --------------
CREATE OR REPLACE FUNCTION public.cp_document_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_item_project uuid;
  v_quota bigint;
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
  -- Quota de l'entreprise (taille réelle des fichiers stockés, celui-ci compris)
  SELECT o.cp_storage_quota_bytes INTO v_quota FROM public.organizations o WHERE o.id = NEW.organization_id;
  IF v_quota IS NOT NULL AND public.cp_storage_used_bytes(NEW.organization_id) > v_quota THEN
    RAISE EXCEPTION 'L''espace de stockage de l''entreprise est plein';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_document_guard() FROM PUBLIC, anon, authenticated;

-- 6. Règle de dépôt du stockage : en plus des contrôles existants, il doit rester de la place -------------------------------------
DROP POLICY IF EXISTS cp_documents_depot ON storage.objects;
CREATE POLICY cp_documents_depot ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cp-documents'
    AND (SELECT public.org_module_enabled('cp.projects'))
    AND public.storage_path_org(name) = (SELECT public.app_org_id())
    AND public.cp_doc_path_project(name) IS NOT NULL
    -- (« storage.objects.name » : dans la sous-requête, « name » désignerait le nom du projet)
    AND EXISTS (SELECT 1 FROM public.cp_projects p WHERE p.id = public.cp_doc_path_project(storage.objects.name))
    AND (SELECT public.cp_can_discuss(public.cp_doc_path_project(name)))
    AND (SELECT public.cp_storage_has_room()));

-- 7. Console plateforme : voir et régler la limite de chaque entreprise (administrateur de la plateforme seulement, journalisé) ----
CREATE OR REPLACE FUNCTION public.platform_storage_quotas()
RETURNS TABLE(organization_id uuid, quota_bytes bigint, used_bytes bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_owner_admin() THEN
    RAISE EXCEPTION 'Réservé à l''administrateur de la plateforme';
  END IF;
  RETURN QUERY SELECT o.id, o.cp_storage_quota_bytes, public.cp_storage_used_bytes(o.id) FROM public.organizations o ORDER BY o.created_at;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_storage_quotas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_storage_quotas() TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_set_storage_quota(p_organization_id uuid, p_bytes bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM set_config('app.org_guard_off', 'on', true);
  IF NOT public.is_owner_admin() THEN
    RAISE EXCEPTION 'Réservé à l''administrateur de la plateforme';
  END IF;
  IF p_bytes IS NOT NULL AND p_bytes < 0 THEN
    RAISE EXCEPTION 'La limite ne peut pas être négative';
  END IF;
  UPDATE public.organizations SET cp_storage_quota_bytes = p_bytes WHERE id = p_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entreprise introuvable'; END IF;
  PERFORM public.admin_log('set_storage_quota', 'company', p_organization_id,
    jsonb_build_object('name', (SELECT name FROM public.organizations WHERE id = p_organization_id), 'quota_bytes', p_bytes));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_set_storage_quota(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_set_storage_quota(uuid, bigint) TO authenticated;

-- 8. Fichiers orphelins : sans ligne de document, sans demande d'effacement, plus vieux que le délai (clé de service seulement) ---
CREATE OR REPLACE FUNCTION public.cp_orphan_documents(p_older_than interval DEFAULT interval '24 hours', p_limit integer DEFAULT 200)
RETURNS TABLE(storage_path text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT o.name
  FROM storage.objects o
  WHERE o.bucket_id = 'cp-documents'
    AND o.created_at < now() - p_older_than
    AND NOT EXISTS (SELECT 1 FROM public.cp_documents d WHERE d.storage_path = o.name)
    AND NOT EXISTS (SELECT 1 FROM public.cp_document_trash t WHERE t.storage_path = o.name)
  ORDER BY o.created_at
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000))
$$;
REVOKE EXECUTE ON FUNCTION public.cp_orphan_documents(interval, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cp_orphan_documents(interval, integer) TO service_role;
