/*
  PILOTE P2 : calendrier de travail de l'entreprise (jours fériés et fermetures).

  Jusqu'ici, la cascade des dépendances (migration 51) évitait seulement les samedis et dimanches (réglage « link_skip_weekends » du projet).
  Une entreprise a aussi des jours fériés et des fermetures : un élément décalé automatiquement ne doit pas non plus y commencer.

  - Table cp_calendar_days : un jour par entreprise (unique), avec un libellé et un type (« férié » ou « fermeture »).
    Même isolation et mêmes droits que les projets : lecture = « cp.projects:read », écriture = create / update / delete du module.
  - Fonctions cp_is_working_day et cp_adjust_working_day : un jour est ouvré s'il n'est ni samedi, ni dimanche, ni dans le calendrier.
    Elles lisent la table avec les droits de la personne connectée (isolation par entreprise appliquée par la base).
  - cp_link_apply (décalage en cascade) est recréée : même signature, même comportement pour les week-ends, et évite en plus les jours du calendrier.
    Le réglage du projet « link_skip_weekends » (case « Éviter les week-ends ») couvre désormais aussi ces jours : le nom de la colonne ne change pas.

  Rien ne change pour une entreprise qui n'a saisi aucun jour : le calendrier est vide, seuls les week-ends comptent comme avant.
*/
CREATE TABLE IF NOT EXISTS public.cp_calendar_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  day date NOT NULL,
  label text NOT NULL CHECK (btrim(label) <> '' AND char_length(label) <= 120),
  kind text NOT NULL DEFAULT 'holiday' CHECK (kind IN ('holiday', 'closure')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT public.app_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, day)
);
CREATE INDEX IF NOT EXISTS cp_calendar_days_org_idx ON public.cp_calendar_days (organization_id, day);

DO $$
DECLARE
  t text := 'cp_calendar_days';
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

-- Jour ouvré : ni samedi, ni dimanche, ni jour du calendrier de l'entreprise
CREATE OR REPLACE FUNCTION public.cp_is_working_day(p_org uuid, p_day date)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT extract(isodow FROM p_day) < 6
         AND NOT EXISTS (SELECT 1 FROM public.cp_calendar_days c WHERE c.organization_id = p_org AND c.day = p_day)
$$;

-- Premier jour ouvré à partir de p_day, en avançant (p_step = 1) ou en reculant (p_step = -1) ; au plus un an de recul, puis le jour tel quel
CREATE OR REPLACE FUNCTION public.cp_adjust_working_day(p_org uuid, p_day date, p_step integer)
RETURNS date
LANGUAGE plpgsql STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v date := p_day;
  n integer := 0;
BEGIN
  IF p_step NOT IN (-1, 1) THEN RAISE EXCEPTION 'Sens invalide'; END IF;
  WHILE NOT public.cp_is_working_day(p_org, v) LOOP
    v := v + p_step;
    n := n + 1;
    IF n > 366 THEN RETURN p_day; END IF;
  END LOOP;
  RETURN v;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_is_working_day(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cp_adjust_working_day(uuid, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_is_working_day(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cp_adjust_working_day(uuid, date, integer) TO authenticated;

-- Décalage en cascade (remplace la version de la migration 51) : évite aussi les jours du calendrier quand « Éviter les week-ends » est coché
CREATE OR REPLACE FUNCTION public.cp_link_apply(p_successor uuid, p_pred_end date, p_end_delta integer)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_start date;
  v_mode text;
  v_skip boolean;
  v_org uuid;
  v_new date;
  v_delta integer := 0;
BEGIN
  SELECT i.starts_on, pr.link_mode, pr.link_skip_weekends, pr.organization_id INTO v_start, v_mode, v_skip, v_org
  FROM public.cp_items i JOIN public.cp_projects pr ON pr.id = i.project_id WHERE i.id = p_successor;
  IF v_start IS NULL OR v_mode = 'none' OR p_pred_end IS NULL THEN RETURN 0; END IF;
  IF pg_trigger_depth() > 60 THEN RAISE EXCEPTION 'Chaîne de dépendances trop longue'; END IF;

  IF v_mode = 'overlap' THEN
    -- Seulement si le successeur commence avant la fin de son prédécesseur : il commence le lendemain de cette fin (jour ouvré suivant si demandé)
    IF v_start <= p_pred_end THEN
      v_new := p_pred_end + 1;
      IF v_skip THEN v_new := public.cp_adjust_working_day(v_org, v_new, 1); END IF;
      v_delta := v_new - v_start;
    END IF;
  ELSIF v_mode = 'keep_gap' THEN
    -- Le successeur suit son prédécesseur du même nombre de jours (en avant comme en arrière) ; sur un jour non ouvré, il avance ou recule jusqu'au jour ouvré le plus proche dans ce sens
    IF p_end_delta IS NOT NULL AND p_end_delta <> 0 THEN
      v_new := v_start + p_end_delta;
      IF v_skip THEN v_new := public.cp_adjust_working_day(v_org, v_new, CASE WHEN p_end_delta > 0 THEN 1 ELSE -1 END); END IF;
      v_delta := v_new - v_start;
    END IF;
  END IF;

  IF v_delta <> 0 THEN
    WITH RECURSIVE tree AS (
      SELECT i.id FROM public.cp_items i WHERE i.id = p_successor
      UNION ALL SELECT c.id FROM public.cp_items c JOIN tree t ON c.parent_id = t.id
    )
    UPDATE public.cp_items i SET starts_on = i.starts_on + v_delta, ends_on = i.ends_on + v_delta WHERE i.id IN (SELECT id FROM tree);
  END IF;
  RETURN v_delta;
END;
$$;
