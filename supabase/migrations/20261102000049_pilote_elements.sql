/*
  R3a : PILOTE, éléments de planning d'un projet (aucun écran dans cette étape).

  Les 5 niveaux validés avec Greg :
    1 Programme (cp_programs)  →  2 Projet (cp_projects)  →  3 Phase  →  4 Tâche ou jalon  →  5 Sous-tâche
  Les niveaux 3 à 5 sont dans une seule table, cp_items, avec un parent et un type (kind) :
    phase       : directement sous le projet ;
    task        : sous une phase, ou directement sous le projet (une phase est facultative) ;
    milestone   : un jalon (échéance sans durée) : sous une phase ou directement sous le projet, sans enfant ;
    subtask     : le détail d'une tâche (parent = une tâche).
  La base refuse tout autre rattachement : on ne peut donc pas dépasser 5 niveaux, ni mettre une phase sous une tâche, etc.
  Le type et le projet d'un élément ne changent plus après la création (on supprime et on recrée) ; le parent peut changer
  (même projet, mêmes règles). Supprimer un élément supprime ses enfants.

  À côté : cp_item_members (plusieurs responsables par élément) et cp_item_checks (liste à cocher : mini-étapes sans date ni responsable).
  Même module (cp.projects) et mêmes droits (cp.projects:read / create / update / delete) que les projets.
  L'avancement (pourcentage d'éléments terminés, par phase puis par projet) est calculé à l'affichage à partir de la famille de l'état.
  Les dépendances entre éléments viendront après le Gantt (R3c).
*/

-- 1. Éléments ------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cp_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  project_id uuid NOT NULL REFERENCES public.cp_projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.cp_items(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('phase', 'task', 'milestone', 'subtask')),
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text,
  status_id uuid NOT NULL REFERENCES public.cp_statuses(id) ON DELETE RESTRICT,
  priority text CHECK (priority IN ('low', 'medium', 'high')),
  starts_on date,
  ends_on date,
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT public.app_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on),
  CHECK (kind <> 'milestone' OR starts_on IS NOT DISTINCT FROM ends_on)           -- un jalon est un point : même jour (ou pas encore de date)
);
CREATE INDEX IF NOT EXISTS cp_items_org_idx ON public.cp_items (organization_id);
CREATE INDEX IF NOT EXISTS cp_items_project_idx ON public.cp_items (project_id, position);
CREATE INDEX IF NOT EXISTS cp_items_parent_idx ON public.cp_items (parent_id);
CREATE INDEX IF NOT EXISTS cp_items_status_idx ON public.cp_items (status_id);
CREATE INDEX IF NOT EXISTS cp_items_dates_idx ON public.cp_items (starts_on, ends_on);

-- 2. Responsables (plusieurs par élément) --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cp_item_members (
  item_id uuid NOT NULL REFERENCES public.cp_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, user_id)
);
CREATE INDEX IF NOT EXISTS cp_item_members_org_idx ON public.cp_item_members (organization_id);
CREATE INDEX IF NOT EXISTS cp_item_members_user_idx ON public.cp_item_members (user_id);

-- 3. Liste à cocher ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cp_item_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  item_id uuid NOT NULL REFERENCES public.cp_items(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (btrim(label) <> ''),
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cp_item_checks_org_idx ON public.cp_item_checks (organization_id);
CREATE INDEX IF NOT EXISTS cp_item_checks_item_idx ON public.cp_item_checks (item_id, position);

-- 4. Contrôles ------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cp_item_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_parent public.cp_items%ROWTYPE;
BEGIN
  -- Restauration d'une sauvegarde : des données déjà contrôlées autrefois, remises dans l'ordre du fichier
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.kind <> OLD.kind THEN RAISE EXCEPTION 'Le type d''un élément ne change pas : supprime-le et recrée-le'; END IF;
    IF NEW.project_id <> OLD.project_id THEN RAISE EXCEPTION 'Un élément ne change pas de projet'; END IF;
    NEW.updated_at := now();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cp_projects p WHERE p.id = NEW.project_id AND p.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Projet introuvable';
  END IF;

  IF NEW.status_id IS NULL THEN
    SELECT s.id INTO NEW.status_id FROM public.cp_statuses s
    WHERE s.organization_id = NEW.organization_id AND s.is_system AND s.family = 'not_started' LIMIT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_statuses s WHERE s.id = NEW.status_id AND s.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'État introuvable';
  END IF;

  IF NEW.parent_id IS NULL THEN
    IF NEW.kind = 'subtask' THEN RAISE EXCEPTION 'Une sous-tâche se range sous une tâche'; END IF;
  ELSE
    IF NEW.parent_id = NEW.id THEN RAISE EXCEPTION 'Un élément ne peut pas être son propre parent'; END IF;
    SELECT * INTO v_parent FROM public.cp_items i WHERE i.id = NEW.parent_id AND i.organization_id = NEW.organization_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Élément parent introuvable'; END IF;
    IF v_parent.project_id <> NEW.project_id THEN RAISE EXCEPTION 'Le parent doit être dans le même projet'; END IF;
    IF NEW.kind = 'phase' THEN RAISE EXCEPTION 'Une phase se range directement sous le projet'; END IF;
    IF NEW.kind IN ('task', 'milestone') AND v_parent.kind <> 'phase' THEN RAISE EXCEPTION 'Une tâche ou un jalon se range sous une phase ou directement sous le projet'; END IF;
    IF NEW.kind = 'subtask' AND v_parent.kind <> 'task' THEN RAISE EXCEPTION 'Une sous-tâche se range sous une tâche'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cp_item_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cp_items i WHERE i.id = NEW.item_id AND i.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Élément introuvable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id AND u.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Personne introuvable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cp_item_check_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cp_items i WHERE i.id = NEW.item_id AND i.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Élément introuvable';
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Branchements : isolation entreprise, garde d'écriture, contrôles, journal d'audit, règles (module activé ET droit) ----------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cp_items', 'cp_item_members', 'cp_item_checks'] LOOP
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
    -- La liste à cocher n'entre pas au journal (trop de bruit) ; les éléments et leurs responsables y figurent
    IF t <> 'cp_item_checks' THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_audit_trigger', t);
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', t || '_audit_trigger', t);
    END IF;
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS b_cp_item_guard ON public.cp_items;
CREATE TRIGGER b_cp_item_guard BEFORE INSERT OR UPDATE ON public.cp_items FOR EACH ROW EXECUTE FUNCTION public.cp_item_guard();
DROP TRIGGER IF EXISTS b_cp_item_member_guard ON public.cp_item_members;
CREATE TRIGGER b_cp_item_member_guard BEFORE INSERT OR UPDATE ON public.cp_item_members FOR EACH ROW EXECUTE FUNCTION public.cp_item_member_guard();
DROP TRIGGER IF EXISTS b_cp_item_check_guard ON public.cp_item_checks;
CREATE TRIGGER b_cp_item_check_guard BEFORE INSERT OR UPDATE ON public.cp_item_checks FOR EACH ROW EXECUTE FUNCTION public.cp_item_check_guard();
