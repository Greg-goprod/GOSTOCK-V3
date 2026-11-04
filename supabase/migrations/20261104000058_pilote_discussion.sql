/*
  PILOTE : discussion d'un projet ou d'un élément (UI-7a).

  cp_comments : un fil de messages (texte seulement, 4 000 caractères au plus) rattaché à un projet, ou à un élément du projet.
  Les fichiers viendront à part (« Documents », UI-7b).

  Droits (décision de Greg, 2026-11-04) :
    - lire : toute personne qui voit les projets (module activé + droit de lecture) ;
    - écrire : l'équipe du projet et les responsables (droit de modification des projets) ; les autres lisent seulement ;
    - modifier : son propre message, tant qu'on peut encore écrire ; supprimer : son propre message, ou n'importe lequel avec
      le droit de suppression des projets.
  L'auteur est toujours la personne connectée (la base impose l'auteur, le client ne le choisit pas).

  Avis (décision de Greg) : nouveau type « cp_comment », dans l'application et en push par défaut, e-mail désactivé par défaut,
  chacun peut changer ses choix. Destinataires : l'équipe du projet (message sur le projet) ou les personnes assignées à
  l'élément (message sur l'élément), jamais l'auteur. Les messages rapprochés (moins de 10 minutes) sur la même fiche tant que
  l'avis n'est pas lu font un seul avis.
*/

-- 1. Table ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cp_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  project_id uuid NOT NULL REFERENCES public.cp_projects(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.cp_items(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT public.app_user_id(),
  body text NOT NULL CHECK (btrim(body) <> '' AND char_length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);
CREATE INDEX IF NOT EXISTS cp_comments_thread_idx ON public.cp_comments (project_id, item_id, created_at);
CREATE INDEX IF NOT EXISTS cp_comments_item_idx ON public.cp_comments (item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cp_comments_org_idx ON public.cp_comments (organization_id);

-- 2. Qui peut écrire dans la discussion d'un projet : l'équipe, ou un responsable (droit de modification) ---------------------
CREATE OR REPLACE FUNCTION public.cp_can_discuss(p_project uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT public.rbac_has_any_permission(ARRAY['cp.projects:update'])
      OR EXISTS (SELECT 1 FROM public.cp_project_members m
                 WHERE m.project_id = p_project AND m.user_id = public.app_user_id() AND m.organization_id = public.app_org_id())
$$;
REVOKE EXECUTE ON FUNCTION public.cp_can_discuss(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_can_discuss(uuid) TO authenticated;

-- 3. Contrôles de ligne (avec les droits du propriétaire, lectures limitées à l'entreprise de la ligne : même principe que la migration 54)
CREATE OR REPLACE FUNCTION public.cp_comment_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_item_project uuid;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    -- L'auteur est la personne connectée : le client ne choisit pas (sans session, par exemple la fonction de service, on garde la valeur donnée)
    IF public.app_user_id() IS NOT NULL THEN NEW.author_id := public.app_user_id(); END IF;
    IF NOT EXISTS (SELECT 1 FROM public.cp_projects p WHERE p.id = NEW.project_id AND p.organization_id = NEW.organization_id) THEN
      RAISE EXCEPTION 'Projet introuvable';
    END IF;
    IF NEW.item_id IS NOT NULL THEN
      SELECT i.project_id INTO v_item_project FROM public.cp_items i WHERE i.id = NEW.item_id AND i.organization_id = NEW.organization_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Élément introuvable'; END IF;
      IF v_item_project <> NEW.project_id THEN RAISE EXCEPTION 'Cet élément n''est pas dans ce projet'; END IF;
    END IF;
  ELSE
    IF NEW.project_id <> OLD.project_id OR NEW.item_id IS DISTINCT FROM OLD.item_id OR NEW.author_id IS DISTINCT FROM OLD.author_id OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'Un message ne change ni de fiche, ni d''auteur, ni de date';
    END IF;
    IF NEW.body <> OLD.body THEN NEW.edited_at := now(); ELSE NEW.edited_at := OLD.edited_at; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_comment_guard() FROM PUBLIC, anon, authenticated;

-- 4. Branchements : isolation entreprise, garde d'écriture, contrôles, journal d'audit, règles -------------------------------
ALTER TABLE public.cp_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON public.cp_comments;
CREATE POLICY org_isolation ON public.cp_comments AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = (SELECT public.app_org_id())) WITH CHECK (organization_id = (SELECT public.app_org_id()));
DROP POLICY IF EXISTS comments_read ON public.cp_comments;
DROP POLICY IF EXISTS comments_insert ON public.cp_comments;
DROP POLICY IF EXISTS comments_update ON public.cp_comments;
DROP POLICY IF EXISTS comments_delete ON public.cp_comments;
CREATE POLICY comments_read ON public.cp_comments FOR SELECT TO authenticated
  USING ((SELECT public.org_module_enabled('cp.projects')) AND (SELECT public.rbac_has_any_permission(ARRAY['cp.projects:read'])));
CREATE POLICY comments_insert ON public.cp_comments FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.org_module_enabled('cp.projects')) AND (SELECT public.cp_can_discuss(project_id)));
CREATE POLICY comments_update ON public.cp_comments FOR UPDATE TO authenticated
  USING ((SELECT public.org_module_enabled('cp.projects')) AND author_id = (SELECT public.app_user_id()) AND (SELECT public.cp_can_discuss(project_id)))
  WITH CHECK ((SELECT public.org_module_enabled('cp.projects')) AND author_id = (SELECT public.app_user_id()) AND (SELECT public.cp_can_discuss(project_id)));
CREATE POLICY comments_delete ON public.cp_comments FOR DELETE TO authenticated
  USING ((SELECT public.org_module_enabled('cp.projects'))
         AND (author_id = (SELECT public.app_user_id()) OR (SELECT public.rbac_has_any_permission(ARRAY['cp.projects:delete']))));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cp_comments TO authenticated, service_role;
REVOKE ALL ON public.cp_comments FROM anon;
DROP TRIGGER IF EXISTS a_org_write_guard ON public.cp_comments;
CREATE TRIGGER a_org_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.cp_comments FOR EACH ROW EXECUTE FUNCTION public.org_write_guard();
DROP TRIGGER IF EXISTS b_cp_comment_guard ON public.cp_comments;
CREATE TRIGGER b_cp_comment_guard BEFORE INSERT OR UPDATE ON public.cp_comments FOR EACH ROW EXECUTE FUNCTION public.cp_comment_guard();
DROP TRIGGER IF EXISTS cp_comments_audit_trigger ON public.cp_comments;
CREATE TRIGGER cp_comments_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.cp_comments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- 5. Avis « nouveau message » -------------------------------------------------------------------------------------------
ALTER TABLE public.cp_notification_prefs DROP CONSTRAINT IF EXISTS cp_notification_prefs_kind_check;
ALTER TABLE public.cp_notification_prefs ADD CONSTRAINT cp_notification_prefs_kind_check
  CHECK (kind IN ('cp_assigned', 'cp_team_added', 'cp_dates_changed', 'cp_due_soon', 'cp_overdue', 'cp_comment'));

CREATE OR REPLACE FUNCTION public.cp_pref_defaults()
RETURNS TABLE (kind text, in_app boolean, email boolean, push boolean, ord integer)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT * FROM (VALUES
    ('cp_assigned'::text, true, true, true, 1),
    ('cp_team_added', true, true, true, 2),
    ('cp_dates_changed', true, false, true, 3),
    ('cp_due_soon', true, true, true, 4),
    ('cp_overdue', true, true, true, 5),
    ('cp_comment', true, false, true, 6)
  ) v (kind, in_app, email, push, ord)
$$;

CREATE OR REPLACE FUNCTION public.cp_notify_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_target text;
  v_excerpt text;
  r record;
  v_id uuid;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.item_id IS NULL THEN
    SELECT p.name INTO v_target FROM public.cp_projects p WHERE p.id = NEW.project_id;
  ELSE
    SELECT i.name INTO v_target FROM public.cp_items i WHERE i.id = NEW.item_id;
  END IF;
  IF v_target IS NULL THEN RETURN NEW; END IF;
  v_excerpt := regexp_replace(NEW.body, '\s+', ' ', 'g');
  IF char_length(v_excerpt) > 90 THEN v_excerpt := left(v_excerpt, 89) || '…'; END IF;

  FOR r IN
    SELECT DISTINCT u.user_id
    FROM (
      SELECT m.user_id FROM public.cp_project_members m WHERE NEW.item_id IS NULL AND m.project_id = NEW.project_id
      UNION
      SELECT im.user_id FROM public.cp_item_members im WHERE NEW.item_id IS NOT NULL AND im.item_id = NEW.item_id
    ) u
    WHERE u.user_id IS DISTINCT FROM NEW.author_id
  LOOP
    -- Un avis non lu de moins de 10 minutes sur la même fiche : on le met à jour au lieu d'en créer un autre
    v_id := NULL;
    UPDATE public.notifications SET
      title = 'Nouveaux messages',
      message = format('Plusieurs nouveaux messages dans « %s ».', v_target)
    WHERE id = (
      SELECT x.id FROM public.notifications x
      WHERE x.recipient_user_id = r.user_id AND x.kind = 'cp_comment' AND x.cp_project_id = NEW.project_id
        AND x.cp_item_id IS NOT DISTINCT FROM NEW.item_id
        AND x.created_at > now() - interval '10 minutes'
        AND x.read_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.notification_reads rd WHERE rd.notification_id = x.id AND rd.user_id = r.user_id AND rd.is_read)
      ORDER BY x.created_at DESC LIMIT 1)
    RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN CONTINUE; END IF;
    PERFORM public.cp_notify(
      r.user_id, 'cp_comment', 'Nouveau message',
      format('%s a écrit dans « %s » : « %s ».', public.cp_actor_name(), v_target, v_excerpt),
      NEW.project_id, NEW.item_id);
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_notify_comment() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS c_cp_notify_comment ON public.cp_comments;
CREATE TRIGGER c_cp_notify_comment AFTER INSERT ON public.cp_comments FOR EACH ROW EXECUTE FUNCTION public.cp_notify_comment();
