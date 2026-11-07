/*
  PILOTE P6 : charge par personne.

  - cp_items.estimate_hours : heures estimées d'un élément (vide = non estimé ; 0 à 9 999, une décimale). Le total d'une personne par semaine
    se calcule à l'écran : les heures d'un élément sont réparties sur ses jours ouvrés (calendrier de travail compris) et partagées entre
    ses assignés.
  - cp_user_capacity : heures de travail par semaine d'une personne (40 par défaut quand rien n'est saisi). Même isolation et mêmes droits
    que les projets (lecture « cp.projects:read », écriture create / update / delete). La personne doit être de la même entreprise.
  - cp_duplicate_project est recréée (même signature, même comportement) pour copier aussi l'estimation : un projet dupliqué ou créé depuis
    un modèle garde ses heures estimées.
*/
ALTER TABLE public.cp_items ADD COLUMN IF NOT EXISTS estimate_hours numeric(6,1);
ALTER TABLE public.cp_items DROP CONSTRAINT IF EXISTS cp_items_estimate_hours_check;
ALTER TABLE public.cp_items ADD CONSTRAINT cp_items_estimate_hours_check CHECK (estimate_hours IS NULL OR (estimate_hours >= 0 AND estimate_hours <= 9999));

CREATE TABLE IF NOT EXISTS public.cp_user_capacity (
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hours_per_week numeric(4,1) NOT NULL CHECK (hours_per_week >= 0 AND hours_per_week <= 80),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE OR REPLACE FUNCTION public.cp_user_capacity_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id AND u.organization_id = NEW.organization_id) THEN RAISE EXCEPTION 'Personne introuvable'; END IF;
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_user_capacity_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS b_cp_user_capacity_guard ON public.cp_user_capacity;
CREATE TRIGGER b_cp_user_capacity_guard BEFORE INSERT OR UPDATE ON public.cp_user_capacity FOR EACH ROW EXECUTE FUNCTION public.cp_user_capacity_guard();

DO $$
DECLARE
  t text := 'cp_user_capacity';
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
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_audit_trigger', t);
  EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', t || '_audit_trigger', t);
END $$;

-- La copie d'un projet (et un projet créé depuis un modèle) garde l'estimation des éléments (remplace la version de la migration 56)
CREATE OR REPLACE FUNCTION public.cp_duplicate_project(
  p_project uuid, p_name text, p_new_start date DEFAULT NULL, p_copy_team boolean DEFAULT true, p_copy_assignments boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_src public.cp_projects%ROWTYPE;
  v_name text := btrim(coalesce(p_name, ''));
  v_status uuid;
  v_ref date;
  v_delta integer := 0;
  v_new uuid;
  v_old uuid[];
  v_map uuid[];
  v_depth integer[];
  v_max integer;
  v_d integer;
  v_prev text := current_setting('gomat.cp_copy', true);
BEGIN
  IF v_name = '' THEN RAISE EXCEPTION 'Donne un nom à la copie'; END IF;
  IF p_copy_assignments AND NOT p_copy_team THEN RAISE EXCEPTION 'Les assignations ne se copient qu''avec l''équipe'; END IF;
  SELECT * INTO v_src FROM public.cp_projects WHERE id = p_project;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projet introuvable'; END IF;
  SELECT s.id INTO v_status FROM public.cp_statuses s WHERE s.is_system AND s.family = 'not_started' LIMIT 1;

  -- Décalage : écart entre le début actuel (celui du projet, sinon le plus ancien de ses éléments) et le nouveau début
  v_ref := coalesce(v_src.starts_on, (SELECT min(i.starts_on) FROM public.cp_items i WHERE i.project_id = p_project));
  IF p_new_start IS NOT NULL AND v_ref IS NOT NULL THEN v_delta := p_new_start - v_ref; END IF;

  -- Plan de copie : ancien identifiant → nouvel identifiant, et profondeur dans l'arborescence (ordre total : les trois tableaux restent alignés)
  WITH RECURSIVE t AS (
    SELECT i.id, 0 AS d FROM public.cp_items i WHERE i.project_id = p_project AND i.parent_id IS NULL
    UNION ALL
    SELECT c.id, t.d + 1 FROM public.cp_items c JOIN t ON c.parent_id = t.id
  ), numbered AS (SELECT id, d, gen_random_uuid() AS new_id FROM t)
  SELECT coalesce(array_agg(id ORDER BY d, id), '{}'), coalesce(array_agg(new_id ORDER BY d, id), '{}'), coalesce(array_agg(d ORDER BY d, id), '{}'), coalesce(max(d), -1)
    INTO v_old, v_map, v_depth, v_max FROM numbered;

  PERFORM set_config('gomat.cp_copy', 'on', true);

  INSERT INTO public.cp_projects (name, type, description, status_id, priority, color, starts_on, ends_on, link_mode, link_skip_weekends)
  VALUES (v_name, v_src.type, v_src.description, v_status, v_src.priority, v_src.color, v_src.starts_on + v_delta, v_src.ends_on + v_delta, v_src.link_mode, v_src.link_skip_weekends)
  RETURNING id INTO v_new;

  -- Éléments, un niveau à la fois (un parent existe avant ses enfants)
  FOR v_d IN 0..v_max LOOP
    INSERT INTO public.cp_items (id, project_id, parent_id, kind, name, description, status_id, priority, starts_on, ends_on, position, estimate_hours)
    SELECT m.new_id, v_new, pm.new_id, s.kind, s.name, s.description, v_status, s.priority, s.starts_on + v_delta, s.ends_on + v_delta, s.position, s.estimate_hours
    FROM public.cp_items s
    JOIN unnest(v_old, v_map, v_depth) AS m(old_id, new_id, d) ON m.old_id = s.id AND m.d = v_d
    LEFT JOIN unnest(v_old, v_map) AS pm(old_id, new_id) ON pm.old_id = s.parent_id;
  END LOOP;

  IF v_max >= 0 THEN
    INSERT INTO public.cp_item_checks (item_id, label, done, position)
    SELECT m.new_id, c.label, false, c.position
    FROM public.cp_item_checks c JOIN unnest(v_old, v_map) AS m(old_id, new_id) ON m.old_id = c.item_id;

    INSERT INTO public.cp_item_links (predecessor_id, successor_id)
    SELECT mp.new_id, ms.new_id
    FROM public.cp_item_links l
    JOIN unnest(v_old, v_map) AS mp(old_id, new_id) ON mp.old_id = l.predecessor_id
    JOIN unnest(v_old, v_map) AS ms(old_id, new_id) ON ms.old_id = l.successor_id;
  END IF;

  IF p_copy_team THEN
    INSERT INTO public.cp_project_members (project_id, user_id, role)
    SELECT v_new, pm.user_id, pm.role FROM public.cp_project_members pm WHERE pm.project_id = p_project;
    IF p_copy_assignments AND v_max >= 0 THEN
      INSERT INTO public.cp_item_members (item_id, user_id)
      SELECT m.new_id, im.user_id
      FROM public.cp_item_members im JOIN unnest(v_old, v_map) AS m(old_id, new_id) ON m.old_id = im.item_id;
    END IF;
  END IF;

  PERFORM set_config('gomat.cp_copy', coalesce(v_prev, ''), true);
  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.cp_duplicate_project(uuid, text, date, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_duplicate_project(uuid, text, date, boolean, boolean) TO authenticated;
