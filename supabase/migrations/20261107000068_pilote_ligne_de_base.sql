/*
  PILOTE P9 : ligne de base d'un projet.

  Une ligne de base est une photo des dates d'un projet et de ses éléments à un moment donné (« le plan accepté »). Le Gantt peut ensuite
  montrer, sous chaque barre, où elle était prévue, et l'écart de fin (en jours). Un projet n'a qu'UNE ligne de base : en figer une
  nouvelle remplace la précédente.

  - cp_baseline_dates : une ligne pour le projet (item_id vide) et une par élément daté ; projet et élément supprimés = ligne supprimée.
    Même isolation et mêmes droits que les projets (lecture « cp.projects:read », écriture create / update / delete).
  - cp_set_baseline(projet) : remplace la ligne de base du projet par l'état actuel ; renvoie le nombre de lignes. Il faut donc les droits de
    création, de modification et de suppression sur les projets (administrateur, responsable).
  - cp_clear_baseline(projet) : efface la ligne de base du projet.
  Les fonctions s'exécutent avec les droits de la personne (SECURITY INVOKER) ; l'isolation par entreprise s'applique à chaque ligne.
*/
CREATE TABLE IF NOT EXISTS public.cp_baseline_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  project_id uuid NOT NULL REFERENCES public.cp_projects(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.cp_items(id) ON DELETE CASCADE,
  starts_on date,
  ends_on date,
  taken_at timestamptz NOT NULL DEFAULT now(),
  taken_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT public.app_user_id(),
  CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS cp_baseline_project_key ON public.cp_baseline_dates (project_id) WHERE item_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cp_baseline_item_key ON public.cp_baseline_dates (item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cp_baseline_org_idx ON public.cp_baseline_dates (organization_id, project_id);

CREATE OR REPLACE FUNCTION public.cp_baseline_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_projects p WHERE p.id = NEW.project_id AND p.organization_id = NEW.organization_id) THEN RAISE EXCEPTION 'Projet introuvable'; END IF;
  IF NEW.item_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cp_items i WHERE i.id = NEW.item_id AND i.project_id = NEW.project_id AND i.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Élément introuvable dans ce projet';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_baseline_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS b_cp_baseline_guard ON public.cp_baseline_dates;
CREATE TRIGGER b_cp_baseline_guard BEFORE INSERT OR UPDATE ON public.cp_baseline_dates FOR EACH ROW EXECUTE FUNCTION public.cp_baseline_guard();

DO $$
DECLARE
  t text := 'cp_baseline_dates';
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS org_isolation ON public.%I', t);
  EXECUTE format('CREATE POLICY org_isolation ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (organization_id = (SELECT public.app_org_id())) WITH CHECK (organization_id = (SELECT public.app_org_id()))', t);
  EXECUTE format('DROP POLICY IF EXISTS projects_read ON public.%I', t);
  EXECUTE format('DROP POLICY IF EXISTS projects_insert ON public.%I', t);
  EXECUTE format('DROP POLICY IF EXISTS projects_update ON public.%I', t);
  EXECUTE format('DROP POLICY IF EXISTS projects_delete ON public.%I', t);
  EXECUTE format('CREATE POLICY projects_read ON public.%I FOR SELECT TO authenticated USING ((SELECT public.org_module_enabled(''cp.projects'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.projects:read''])))', t);
  EXECUTE format('CREATE POLICY projects_insert ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.org_module_enabled(''cp.projects'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.projects:create''])))', t);
  EXECUTE format('CREATE POLICY projects_update ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.org_module_enabled(''cp.projects'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.projects:update'']))) WITH CHECK ((SELECT public.org_module_enabled(''cp.projects'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.projects:update''])))', t);
  EXECUTE format('CREATE POLICY projects_delete ON public.%I FOR DELETE TO authenticated USING ((SELECT public.org_module_enabled(''cp.projects'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.projects:delete''])))', t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role', t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  EXECUTE format('DROP TRIGGER IF EXISTS a_org_write_guard ON public.%I', t);
  EXECUTE format('CREATE TRIGGER a_org_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.org_write_guard()', t);
  -- Pas de journal ligne par ligne : figer une ligne de base écrit une ligne par élément, le bruit n'aurait aucune valeur
END $$;

-- Fige la ligne de base : remplace celle du projet par l'état actuel (projet + éléments datés)
CREATE OR REPLACE FUNCTION public.cp_set_baseline(p_project uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_proj public.cp_projects%ROWTYPE;
  v_now timestamptz := now();
  v_n integer;
BEGIN
  SELECT * INTO v_proj FROM public.cp_projects WHERE id = p_project;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projet introuvable'; END IF;
  IF v_proj.is_template THEN RAISE EXCEPTION 'Un modèle n''a pas de ligne de base'; END IF;
  DELETE FROM public.cp_baseline_dates WHERE project_id = p_project;
  INSERT INTO public.cp_baseline_dates (project_id, item_id, starts_on, ends_on, taken_at)
  SELECT p_project, NULL, v_proj.starts_on, v_proj.ends_on, v_now;
  INSERT INTO public.cp_baseline_dates (project_id, item_id, starts_on, ends_on, taken_at)
  SELECT p_project, i.id, i.starts_on, i.ends_on, v_now FROM public.cp_items i WHERE i.project_id = p_project AND (i.starts_on IS NOT NULL OR i.ends_on IS NOT NULL);
  SELECT count(*) INTO v_n FROM public.cp_baseline_dates WHERE project_id = p_project;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.cp_clear_baseline(p_project uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cp_projects WHERE id = p_project) THEN RAISE EXCEPTION 'Projet introuvable'; END IF;
  WITH d AS (DELETE FROM public.cp_baseline_dates WHERE project_id = p_project RETURNING 1) SELECT count(*) INTO v_n FROM d;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.cp_set_baseline(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cp_clear_baseline(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_set_baseline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cp_clear_baseline(uuid) TO authenticated;
