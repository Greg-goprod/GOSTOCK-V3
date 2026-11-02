/*
  Module 1.1 : planning de chantier, base de données (aucun écran dans cette étape).

  Un chantier (sites) reçoit :
    - une configuration (site_config) : heures de la journée, option 24 h/24, pas de planification (15 min par défaut) ;
    - des jours bloqués (site_blocked_days) ;
    - des zones (site_zones), des phases (site_phases), des équipes (site_teams), éventuellement rattachées à un prestataire (contractors) ;
    - des interventions (site_interventions) : une équipe, dans une zone, de telle heure à telle heure.
  La période du chantier reste celle de la fiche (sites.start_on / end_on) : elle n'est pas dupliquée.

  Contrôles faits par la base elle-même (aucun écran ne peut les contourner) :
    chantier ouvert · fin après début · heures sur le pas · dans les heures de la journée (sauf 24 h/24) ·
    dans la période du chantier · pas un jour bloqué · zone, équipe et phase du même chantier ·
    une équipe n'est jamais à deux endroits à la fois.

  Droits (clés Mannyx, entreprise par entreprise) : chantiers.planning:read / create / update / delete.
  Tous les rôles système lisent ; administrateur et responsable écrivent. Un nouveau module ajoute ses lignes dans
  rbac_default_permissions : toute nouvelle entreprise les reçoit, les entreprises existantes aussi (reprise plus bas).
*/

-- 1. Droits par défaut des rôles système (un module = quelques lignes ici)
CREATE TABLE IF NOT EXISTS public.rbac_default_permissions (
  system_key text NOT NULL CHECK (system_key IN ('admin', 'manager', 'technician', 'user')),
  permission_key text NOT NULL CHECK (permission_key ~ '^[a-z0-9_]+\.[a-z0-9_]+:(read|create|update|delete)$'),
  PRIMARY KEY (system_key, permission_key)
);
INSERT INTO public.rbac_default_permissions (system_key, permission_key) VALUES
  ('admin', 'chantiers.planning:read'), ('admin', 'chantiers.planning:create'), ('admin', 'chantiers.planning:update'), ('admin', 'chantiers.planning:delete'),
  ('manager', 'chantiers.planning:read'), ('manager', 'chantiers.planning:create'), ('manager', 'chantiers.planning:update'), ('manager', 'chantiers.planning:delete'),
  ('technician', 'chantiers.planning:read'),
  ('user', 'chantiers.planning:read')
ON CONFLICT DO NOTHING;
ALTER TABLE public.rbac_default_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rbac_defaults_read ON public.rbac_default_permissions;
CREATE POLICY rbac_defaults_read ON public.rbac_default_permissions FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.rbac_default_permissions TO authenticated;

CREATE OR REPLACE FUNCTION public.seed_rbac_roles(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r record;
  v_role uuid;
BEGIN
  PERFORM set_config('app.org_guard_off', 'on', true);
  FOR r IN SELECT * FROM (VALUES ('admin', 'Administrateur'), ('manager', 'Responsable'), ('technician', 'Magasinier'), ('user', 'Collaborateur')) AS t(system_key, name) LOOP
    INSERT INTO public.rbac_roles (organization_id, name, is_system, system_key)
    VALUES (p_organization_id, r.name, true, r.system_key)
    ON CONFLICT (organization_id, system_key) WHERE system_key IS NOT NULL DO NOTHING;
    SELECT id INTO v_role FROM public.rbac_roles WHERE organization_id = p_organization_id AND system_key = r.system_key;
    -- Droits actuels, exprimés en clés
    INSERT INTO public.rbac_role_permissions (role_id, permission_key, granted, organization_id)
    SELECT v_role, m.permission_key, true, p_organization_id
    FROM public.rbac_legacy_permission_map m
    WHERE m.legacy = ANY (public.role_permissions(r.system_key))
    ON CONFLICT (role_id, permission_key) DO NOTHING;
    -- Droits des modules
    INSERT INTO public.rbac_role_permissions (role_id, permission_key, granted, organization_id)
    SELECT v_role, d.permission_key, true, p_organization_id
    FROM public.rbac_default_permissions d
    WHERE d.system_key = r.system_key
    ON CONFLICT (role_id, permission_key) DO NOTHING;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_rbac_roles(uuid) FROM PUBLIC, anon, authenticated;

-- 2. Tables
CREATE TABLE IF NOT EXISTS public.contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  name text NOT NULL CHECK (btrim(name) <> ''),
  contact_name text,
  email text,
  phone text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS contractors_org_name_key ON public.contractors (organization_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.site_config (
  site_id uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  day_start time NOT NULL DEFAULT '07:00',
  day_end time NOT NULL DEFAULT '19:00',
  all_day boolean NOT NULL DEFAULT false,
  step_minutes integer NOT NULL DEFAULT 15 CHECK (step_minutes IN (5, 15, 30, 60)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (all_day OR day_end > day_start)
);

CREATE TABLE IF NOT EXISTS public.site_blocked_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  day date NOT NULL,
  reason text,
  UNIQUE (site_id, day)
);

CREATE TABLE IF NOT EXISTS public.site_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  color text NOT NULL DEFAULT '#6366f1',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_zones_site_name_key ON public.site_zones (site_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.site_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  start_on date,
  end_on date,
  color text NOT NULL DEFAULT '#0ea5e9',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_on IS NULL OR end_on IS NULL OR end_on >= start_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS site_phases_site_name_key ON public.site_phases (site_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.site_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  contractor_id uuid REFERENCES public.contractors(id) ON DELETE SET NULL,  -- vide = équipe interne
  name text NOT NULL CHECK (btrim(name) <> ''),
  color text NOT NULL DEFAULT '#f59e0b',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_teams_site_name_key ON public.site_teams (site_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.site_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES public.site_zones(id) ON DELETE RESTRICT,
  team_id uuid NOT NULL REFERENCES public.site_teams(id) ON DELETE RESTRICT,
  phase_id uuid REFERENCES public.site_phases(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (btrim(title) <> ''),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  notes text,
  series_id uuid,                       -- interventions créées ensemble par une récurrence
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT public.app_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS site_interventions_site_start_idx ON public.site_interventions (site_id, starts_at);
CREATE INDEX IF NOT EXISTS site_interventions_team_start_idx ON public.site_interventions (team_id, starts_at);
CREATE INDEX IF NOT EXISTS site_interventions_zone_idx ON public.site_interventions (zone_id);
CREATE INDEX IF NOT EXISTS contractors_org_idx ON public.contractors (organization_id);
CREATE INDEX IF NOT EXISTS site_config_org_idx ON public.site_config (organization_id);
CREATE INDEX IF NOT EXISTS site_blocked_days_site_idx ON public.site_blocked_days (site_id);
CREATE INDEX IF NOT EXISTS site_zones_site_idx ON public.site_zones (site_id);
CREATE INDEX IF NOT EXISTS site_phases_site_idx ON public.site_phases (site_id);
CREATE INDEX IF NOT EXISTS site_teams_site_idx ON public.site_teams (site_id);
CREATE INDEX IF NOT EXISTS site_teams_contractor_idx ON public.site_teams (contractor_id);
CREATE INDEX IF NOT EXISTS site_interventions_phase_idx ON public.site_interventions (phase_id);

-- 3. Contrôles
-- 3a. Un élément du planning ne se rattache qu'à un chantier de SA entreprise (les clés étrangères ignorent la sécurité par ligne)
CREATE OR REPLACE FUNCTION public.site_child_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = NEW.site_id AND s.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Chantier introuvable';
  END IF;
  IF TG_TABLE_NAME = 'site_teams' THEN
    IF NEW.contractor_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = NEW.contractor_id AND c.organization_id = NEW.organization_id) THEN
      RAISE EXCEPTION 'Prestataire introuvable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3b. Les règles d'une intervention
CREATE OR REPLACE FUNCTION public.site_interventions_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  tz constant text := 'Europe/Zurich';
  v_site public.sites%ROWTYPE;
  v_cfg public.site_config%ROWTYPE;
  v_step integer;
  v_all_day boolean;
  v_from time;
  v_to time;
  ls timestamp;
  le timestamp;
  v_last_day date;
  v_blocked date;
BEGIN
  SELECT * INTO v_site FROM public.sites s WHERE s.id = NEW.site_id AND s.organization_id = NEW.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chantier introuvable'; END IF;
  IF v_site.status <> 'open' THEN RAISE EXCEPTION 'Ce chantier est clôturé : son planning ne peut plus être modifié'; END IF;
  IF NEW.ends_at <= NEW.starts_at THEN RAISE EXCEPTION 'La fin doit être après le début'; END IF;

  SELECT * INTO v_cfg FROM public.site_config c WHERE c.site_id = NEW.site_id;
  v_step := COALESCE(v_cfg.step_minutes, 15);
  v_all_day := COALESCE(v_cfg.all_day, false);
  v_from := COALESCE(v_cfg.day_start, '07:00');
  v_to := COALESCE(v_cfg.day_end, '19:00');
  ls := NEW.starts_at AT TIME ZONE tz;
  le := NEW.ends_at AT TIME ZONE tz;

  IF date_trunc('minute', ls) <> ls OR date_trunc('minute', le) <> le
     OR ((extract(hour FROM ls) * 60 + extract(minute FROM ls))::integer % v_step) <> 0
     OR ((extract(hour FROM le) * 60 + extract(minute FROM le))::integer % v_step) <> 0 THEN
    RAISE EXCEPTION 'Les heures doivent tomber sur un pas de % minutes', v_step;
  END IF;

  IF NOT v_all_day THEN
    IF ls::date <> le::date THEN RAISE EXCEPTION 'Une intervention tient dans une seule journée (sauf chantier 24 h/24)'; END IF;
    IF ls::time < v_from OR le::time > v_to THEN
      RAISE EXCEPTION 'Hors des heures du chantier (% à %)', to_char(v_from, 'HH24:MI'), to_char(v_to, 'HH24:MI');
    END IF;
  END IF;

  v_last_day := (le - interval '1 second')::date;
  IF v_site.start_on IS NOT NULL AND ls::date < v_site.start_on THEN
    RAISE EXCEPTION 'Avant le début du chantier (%)', to_char(v_site.start_on, 'DD.MM.YYYY');
  END IF;
  IF v_site.end_on IS NOT NULL AND v_last_day > v_site.end_on THEN
    RAISE EXCEPTION 'Après la fin du chantier (%)', to_char(v_site.end_on, 'DD.MM.YYYY');
  END IF;

  SELECT b.day INTO v_blocked FROM public.site_blocked_days b WHERE b.site_id = NEW.site_id AND b.day BETWEEN ls::date AND v_last_day LIMIT 1;
  IF v_blocked IS NOT NULL THEN RAISE EXCEPTION 'Jour bloqué : %', to_char(v_blocked, 'DD.MM.YYYY'); END IF;

  IF NOT EXISTS (SELECT 1 FROM public.site_zones z WHERE z.id = NEW.zone_id AND z.site_id = NEW.site_id) THEN RAISE EXCEPTION 'Zone inconnue pour ce chantier'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.site_teams t WHERE t.id = NEW.team_id AND t.site_id = NEW.site_id) THEN RAISE EXCEPTION 'Équipe inconnue pour ce chantier'; END IF;
  IF NEW.phase_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.site_phases p WHERE p.id = NEW.phase_id AND p.site_id = NEW.site_id) THEN RAISE EXCEPTION 'Phase inconnue pour ce chantier'; END IF;

  -- Une équipe n'est jamais à deux endroits à la fois (le verrou évite que deux enregistrements simultanés passent ensemble)
  PERFORM pg_advisory_xact_lock(hashtext('site_team:' || NEW.team_id::text));
  IF EXISTS (SELECT 1 FROM public.site_interventions i WHERE i.team_id = NEW.team_id AND i.id <> NEW.id AND i.starts_at < NEW.ends_at AND i.ends_at > NEW.starts_at) THEN
    RAISE EXCEPTION 'Cette équipe a déjà une intervention sur ce créneau';
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Branchements : isolation entreprise, garde d'écriture, contrôles, journal d'audit, droits
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contractors', 'site_config', 'site_blocked_days', 'site_zones', 'site_phases', 'site_teams', 'site_interventions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON public.%I', t);
    EXECUTE format('CREATE POLICY org_isolation ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (organization_id = (SELECT public.app_org_id())) WITH CHECK (organization_id = (SELECT public.app_org_id()))', t);
    EXECUTE format('DROP POLICY IF EXISTS planning_read ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS planning_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS planning_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS planning_delete ON public.%I', t);
    EXECUTE format('CREATE POLICY planning_read ON public.%I FOR SELECT TO authenticated USING ((SELECT public.rbac_has_any_permission(ARRAY[''chantiers.planning:read''])))', t);
    EXECUTE format('CREATE POLICY planning_insert ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.rbac_has_any_permission(ARRAY[''chantiers.planning:create''])))', t);
    EXECUTE format('CREATE POLICY planning_update ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.rbac_has_any_permission(ARRAY[''chantiers.planning:update'']))) WITH CHECK ((SELECT public.rbac_has_any_permission(ARRAY[''chantiers.planning:update''])))', t);
    EXECUTE format('CREATE POLICY planning_delete ON public.%I FOR DELETE TO authenticated USING ((SELECT public.rbac_has_any_permission(ARRAY[''chantiers.planning:delete''])))', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('DROP TRIGGER IF EXISTS a_org_write_guard ON public.%I', t);
    EXECUTE format('CREATE TRIGGER a_org_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.org_write_guard()', t);
    IF t <> 'contractors' AND t <> 'site_interventions' THEN
      EXECUTE format('DROP TRIGGER IF EXISTS b_site_child_guard ON public.%I', t);
      EXECUTE format('CREATE TRIGGER b_site_child_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.site_child_guard()', t);
    END IF;
    IF t <> 'site_blocked_days' THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_audit_trigger', t);
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', t || '_audit_trigger', t);
    END IF;
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS b_site_interventions_check ON public.site_interventions;
CREATE TRIGGER b_site_interventions_check BEFORE INSERT OR UPDATE ON public.site_interventions FOR EACH ROW EXECUTE FUNCTION public.site_interventions_check();

-- 5. Les entreprises existantes reçoivent les droits du module
DO $$
DECLARE
  o record;
BEGIN
  PERFORM set_config('app.org_guard_off', 'on', true);
  FOR o IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_rbac_roles(o.id);
  END LOOP;
END $$;
