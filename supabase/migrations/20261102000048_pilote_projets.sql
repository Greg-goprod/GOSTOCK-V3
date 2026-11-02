/*
  R2b-1 : PILOTE, base des programmes et des projets (aucun écran dans cette étape).

  Modèle (décidé avec Greg, voir docs/chantierpilot/inspiration-notion.md) :
    - cp_statuses        : états d'avancement par entreprise. 4 états de base (Pas commencé / En cours / Terminé / Annulé),
                           chacun dans une « famille » ; l'entreprise peut en ajouter (même famille obligatoire), jamais retirer les 4 de base.
    - cp_programs        : regroupe des projets (une année, une gamme, un client). Pas d'état propre.
    - cp_projects        : l'objet principal. Type : chantier (site), R&D (rd), conception (design), recrutement (recruitment),
                           administratif (admin), évènement (event). Un projet « chantier » peut être relié à un chantier de
                           Logistique (sites) ; Logistique ne connaît pas PILOTE (le lien va dans un seul sens).
    - cp_project_members : plusieurs responsables par projet (personnes de la table users).
  Les niveaux suivants (phase, tâche, jalon, sous-tâche) viendront en R3 dans une table d'éléments.

  Droits : cp.projects:read / create / update / delete. Tous les rôles système lisent ; administrateur et responsable écrivent.
  Le module cp.projects doit être activé pour l'entreprise (console de la plateforme).
  Contrôles faits par la base : même entreprise partout (programme, état, chantier, personnes), lien chantier réservé au type
  chantier, un seul projet par chantier, fin après début, les 4 états de base ne se suppriment pas et gardent leur famille.
*/

-- 1. États -----------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cp_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  name text NOT NULL CHECK (btrim(name) <> ''),
  family text NOT NULL CHECK (family IN ('not_started', 'in_progress', 'done', 'cancelled')),
  color text NOT NULL DEFAULT '#6b7280',
  position integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cp_statuses_org_name_key ON public.cp_statuses (organization_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS cp_statuses_org_idx ON public.cp_statuses (organization_id);

-- 2. Programmes ------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cp_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text,
  color text NOT NULL DEFAULT '#6366f1',
  starts_on date,
  ends_on date,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT public.app_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS cp_programs_org_name_key ON public.cp_programs (organization_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS cp_programs_org_idx ON public.cp_programs (organization_id);

-- 3. Projets ---------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cp_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  program_id uuid REFERENCES public.cp_programs(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,          -- chantier de Logistique (type « site » seulement)
  type text NOT NULL DEFAULT 'site' CHECK (type IN ('site', 'rd', 'design', 'recruitment', 'admin', 'event')),
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text,
  status_id uuid NOT NULL REFERENCES public.cp_statuses(id) ON DELETE RESTRICT,
  priority text CHECK (priority IN ('low', 'medium', 'high')),
  color text NOT NULL DEFAULT '#0ea5e9',
  starts_on date,
  ends_on date,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT public.app_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on),
  CHECK (site_id IS NULL OR type = 'site')
);
CREATE UNIQUE INDEX IF NOT EXISTS cp_projects_site_key ON public.cp_projects (site_id) WHERE site_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cp_projects_org_idx ON public.cp_projects (organization_id);
CREATE INDEX IF NOT EXISTS cp_projects_program_idx ON public.cp_projects (program_id);
CREATE INDEX IF NOT EXISTS cp_projects_status_idx ON public.cp_projects (status_id);
CREATE INDEX IF NOT EXISTS cp_projects_dates_idx ON public.cp_projects (starts_on, ends_on);

-- 4. Responsables (plusieurs par projet) ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cp_project_members (
  project_id uuid NOT NULL REFERENCES public.cp_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS cp_project_members_org_idx ON public.cp_project_members (organization_id);
CREATE INDEX IF NOT EXISTS cp_project_members_user_idx ON public.cp_project_members (user_id);

-- 5. Contrôles -----------------------------------------------------------------------------------------------------
-- 5a. États : les 4 de base ne se suppriment pas et gardent leur famille
CREATE OR REPLACE FUNCTION public.cp_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN RAISE EXCEPTION 'Les 4 états de base ne peuvent pas être supprimés'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.is_system AND (NEW.family <> OLD.family OR NEW.is_system <> OLD.is_system) THEN
    RAISE EXCEPTION 'Un état de base garde sa famille';
  END IF;
  IF NOT OLD.is_system AND NEW.is_system THEN RAISE EXCEPTION 'Seuls les états de base sont des états système'; END IF;
  RETURN NEW;
END;
$$;

-- 5b. Projets : tout reste dans la même entreprise ; l'état par défaut est « Pas commencé »
CREATE OR REPLACE FUNCTION public.cp_project_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.status_id IS NULL THEN
    SELECT s.id INTO NEW.status_id FROM public.cp_statuses s
    WHERE s.organization_id = NEW.organization_id AND s.is_system AND s.family = 'not_started' LIMIT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_statuses s WHERE s.id = NEW.status_id AND s.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'État introuvable';
  END IF;
  IF NEW.program_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.cp_programs p WHERE p.id = NEW.program_id AND p.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Programme introuvable';
  END IF;
  IF NEW.site_id IS NOT NULL THEN
    IF NEW.type <> 'site' THEN RAISE EXCEPTION 'Seul un projet de type chantier peut être relié à un chantier'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = NEW.site_id AND s.organization_id = NEW.organization_id) THEN
      RAISE EXCEPTION 'Chantier introuvable';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
  RETURN NEW;
END;
$$;

-- 5c. Responsables : projet et personne de la même entreprise
CREATE OR REPLACE FUNCTION public.cp_project_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cp_projects p WHERE p.id = NEW.project_id AND p.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Projet introuvable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id AND u.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Personne introuvable';
  END IF;
  RETURN NEW;
END;
$$;

-- 5d. Les 4 états de base de chaque entreprise (existantes et futures)
CREATE OR REPLACE FUNCTION public.cp_seed_statuses(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM set_config('app.org_guard_off', 'on', true);
  INSERT INTO public.cp_statuses (organization_id, name, family, color, position, is_system)
  SELECT p_organization_id, v.name, v.family, v.color, v.position, true
  FROM (VALUES ('Pas commencé', 'not_started', '#6b7280', 0), ('En cours', 'in_progress', '#3b82f6', 1),
               ('Terminé', 'done', '#16a34a', 2), ('Annulé', 'cancelled', '#dc2626', 3)) AS v(name, family, color, position)
  WHERE NOT EXISTS (SELECT 1 FROM public.cp_statuses s WHERE s.organization_id = p_organization_id AND s.is_system AND s.family = v.family);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_seed_statuses(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cp_seed_statuses_on_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.cp_seed_statuses(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_seed_statuses_on_org() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS cp_seed_statuses_trigger ON public.organizations;
CREATE TRIGGER cp_seed_statuses_trigger AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.cp_seed_statuses_on_org();

DO $$
DECLARE
  o record;
BEGIN
  FOR o IN SELECT id FROM public.organizations LOOP
    PERFORM public.cp_seed_statuses(o.id);
  END LOOP;
END $$;

-- 6. Droits par défaut des rôles système ----------------------------------------------------------------------------
INSERT INTO public.rbac_default_permissions (system_key, permission_key) VALUES
  ('admin', 'cp.projects:read'), ('admin', 'cp.projects:create'), ('admin', 'cp.projects:update'), ('admin', 'cp.projects:delete'),
  ('manager', 'cp.projects:read'), ('manager', 'cp.projects:create'), ('manager', 'cp.projects:update'), ('manager', 'cp.projects:delete'),
  ('technician', 'cp.projects:read'),
  ('user', 'cp.projects:read')
ON CONFLICT DO NOTHING;

-- 7. Branchements : isolation entreprise, garde d'écriture, contrôles, journal d'audit, règles (module activé ET droit)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cp_statuses', 'cp_programs', 'cp_projects', 'cp_project_members'] LOOP
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
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS b_cp_status_guard ON public.cp_statuses;
CREATE TRIGGER b_cp_status_guard BEFORE UPDATE OR DELETE ON public.cp_statuses FOR EACH ROW EXECUTE FUNCTION public.cp_status_guard();
DROP TRIGGER IF EXISTS b_cp_project_guard ON public.cp_projects;
CREATE TRIGGER b_cp_project_guard BEFORE INSERT OR UPDATE ON public.cp_projects FOR EACH ROW EXECUTE FUNCTION public.cp_project_guard();
DROP TRIGGER IF EXISTS b_cp_project_member_guard ON public.cp_project_members;
CREATE TRIGGER b_cp_project_member_guard BEFORE INSERT OR UPDATE ON public.cp_project_members FOR EACH ROW EXECUTE FUNCTION public.cp_project_member_guard();

-- 8. Les entreprises existantes reçoivent les droits du module -------------------------------------------------------------
DO $$
DECLARE
  o record;
BEGIN
  PERFORM set_config('app.org_guard_off', 'on', true);
  FOR o IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_rbac_roles(o.id);
  END LOOP;
END $$;
