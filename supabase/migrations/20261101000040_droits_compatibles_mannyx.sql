/*
  Droits : tables et fonction COMPATIBLES avec Mannyx (étape 1, aucun changement visible)

  Mannyx définit ses rôles par entreprise (rbac_roles) et ses droits par clé « module.page:action »
  (rbac_role_permissions), vérifiés par rbac_has_any_permission(ARRAY[...]). On reprend les mêmes noms et la même forme.
  La clé d'entreprise reste organization_id (convention GO-Mat) ; à la fusion elle devient company_id par simple renommage.

  Cette étape n'en change aucun usage : app_has('scan') et toutes les règles actuelles répondent exactement comme avant.
    - 4 rôles système par entreprise (Administrateur, Responsable, Magasinier, Collaborateur), avec les droits actuels
      exprimés en clés ; rbac_legacy_permission_map relie chaque droit actuel à sa clé.
    - users.rbac_role_id : rôle de la personne, tenu à jour quand son rôle change.
    - rbac_has_any_permission(clés) : vrai si la personne a une de ces clés, soit par son rôle (rbac_role_permissions : c'est
      là que naîtront les droits des nouveaux modules), soit par un droit actuel équivalent.
  Un nouveau module crée ses clés (ex. chantiers.planning:update) et les accorde à des rôles : aucune modification de app_has.
*/

CREATE TABLE IF NOT EXISTS public.rbac_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  name text NOT NULL CHECK (btrim(name) <> ''),
  is_system boolean NOT NULL DEFAULT false,
  system_key text,                     -- admin / manager / technician / user pour les rôles système
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS rbac_roles_org_name_key ON public.rbac_roles (organization_id, lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS rbac_roles_org_system_key ON public.rbac_roles (organization_id, system_key) WHERE system_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS rbac_roles_org_idx ON public.rbac_roles (organization_id);

CREATE TABLE IF NOT EXISTS public.rbac_role_permissions (
  role_id uuid NOT NULL REFERENCES public.rbac_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL CHECK (permission_key ~ '^[a-z0-9_]+\.[a-z0-9_]+:(read|create|update|delete)$'),
  granted boolean NOT NULL DEFAULT true,
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  PRIMARY KEY (role_id, permission_key)
);
CREATE INDEX IF NOT EXISTS rbac_role_permissions_org_idx ON public.rbac_role_permissions (organization_id);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS rbac_role_id uuid REFERENCES public.rbac_roles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS users_rbac_role_idx ON public.users (rbac_role_id);

-- Droit actuel → clé Mannyx
CREATE TABLE IF NOT EXISTS public.rbac_legacy_permission_map (
  legacy text PRIMARY KEY,
  permission_key text NOT NULL UNIQUE
);
INSERT INTO public.rbac_legacy_permission_map (legacy, permission_key) VALUES
  ('scan', 'magasin.comptoir:update'),
  ('approve', 'magasin.demandes:update'),
  ('view_all', 'magasin.demandes:read'),
  ('all_depots', 'magasin.depots:read'),
  ('manage_stock', 'materiel.articles:update'),
  ('manage_fleet', 'vehicules.flotte:update'),
  ('manage_people', 'personnes.fiches:update'),
  ('settings', 'reglages.parametres:update')
ON CONFLICT (legacy) DO NOTHING;
ALTER TABLE public.rbac_legacy_permission_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rbac_map_read ON public.rbac_legacy_permission_map;
CREATE POLICY rbac_map_read ON public.rbac_legacy_permission_map FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.rbac_legacy_permission_map TO authenticated;

-- Règles d'accès : lecture pour les membres, écriture réservée aux réglages ; un rôle système ne se modifie ni ne se supprime
ALTER TABLE public.rbac_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON public.rbac_roles;
DROP POLICY IF EXISTS org_isolation ON public.rbac_role_permissions;
CREATE POLICY org_isolation ON public.rbac_roles AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = (SELECT public.app_org_id())) WITH CHECK (organization_id = (SELECT public.app_org_id()));
CREATE POLICY org_isolation ON public.rbac_role_permissions AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = (SELECT public.app_org_id())) WITH CHECK (organization_id = (SELECT public.app_org_id()));
DROP POLICY IF EXISTS rbac_roles_read ON public.rbac_roles;
DROP POLICY IF EXISTS rbac_roles_write ON public.rbac_roles;
DROP POLICY IF EXISTS rbac_perms_read ON public.rbac_role_permissions;
DROP POLICY IF EXISTS rbac_perms_write ON public.rbac_role_permissions;
CREATE POLICY rbac_roles_read ON public.rbac_roles FOR SELECT TO authenticated USING ((SELECT public.app_is_member()));
CREATE POLICY rbac_roles_write ON public.rbac_roles FOR ALL TO authenticated
  USING ((SELECT public.app_has('settings')) AND NOT is_system) WITH CHECK ((SELECT public.app_has('settings')) AND NOT is_system);
CREATE POLICY rbac_perms_read ON public.rbac_role_permissions FOR SELECT TO authenticated USING ((SELECT public.app_is_member()));
CREATE POLICY rbac_perms_write ON public.rbac_role_permissions FOR ALL TO authenticated
  USING ((SELECT public.app_has('settings')) AND NOT EXISTS (SELECT 1 FROM public.rbac_roles r WHERE r.id = role_id AND r.is_system))
  WITH CHECK ((SELECT public.app_has('settings')) AND NOT EXISTS (SELECT 1 FROM public.rbac_roles r WHERE r.id = role_id AND r.is_system));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rbac_roles, public.rbac_role_permissions TO authenticated, service_role;
REVOKE ALL ON public.rbac_roles, public.rbac_role_permissions FROM anon;

-- Garde d'écriture entre entreprises, comme sur les autres tables
DROP TRIGGER IF EXISTS a_org_write_guard ON public.rbac_roles;
CREATE TRIGGER a_org_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.rbac_roles FOR EACH ROW EXECUTE FUNCTION public.org_write_guard();
DROP TRIGGER IF EXISTS a_org_write_guard ON public.rbac_role_permissions;
CREATE TRIGGER a_org_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.rbac_role_permissions FOR EACH ROW EXECUTE FUNCTION public.org_write_guard();

-- Les 4 rôles système d'une entreprise, avec les droits actuels exprimés en clés
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
    INSERT INTO public.rbac_role_permissions (role_id, permission_key, granted, organization_id)
    SELECT v_role, m.permission_key, true, p_organization_id
    FROM public.rbac_legacy_permission_map m
    WHERE m.legacy = ANY (public.role_permissions(r.system_key))
    ON CONFLICT (role_id, permission_key) DO NOTHING;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_rbac_roles(uuid) FROM PUBLIC, anon, authenticated;

-- Toute nouvelle entreprise reçoit ses rôles
CREATE OR REPLACE FUNCTION public.organizations_seed_rbac()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.seed_rbac_roles(NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS organizations_seed_rbac_trigger ON public.organizations;
CREATE TRIGGER organizations_seed_rbac_trigger AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.organizations_seed_rbac();
REVOKE EXECUTE ON FUNCTION public.organizations_seed_rbac() FROM PUBLIC, anon, authenticated;

-- Le rôle de la personne suit sa colonne « role » (rôles système)
CREATE OR REPLACE FUNCTION public.users_sync_rbac_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.rbac_role_id := (SELECT r.id FROM public.rbac_roles r WHERE r.organization_id = NEW.organization_id AND r.system_key = NEW.role);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS users_sync_rbac_role_trigger ON public.users;
CREATE TRIGGER users_sync_rbac_role_trigger BEFORE INSERT OR UPDATE OF role ON public.users FOR EACH ROW EXECUTE FUNCTION public.users_sync_rbac_role();
REVOKE EXECUTE ON FUNCTION public.users_sync_rbac_role() FROM PUBLIC, anon, authenticated;

-- Reprise de l'existant : rôles de chaque entreprise et rôle de chaque personne
DO $$
DECLARE
  o record;
BEGIN
  PERFORM set_config('app.org_guard_off', 'on', true);
  FOR o IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_rbac_roles(o.id);
  END LOOP;
  UPDATE public.users u SET rbac_role_id = r.id
  FROM public.rbac_roles r
  WHERE r.organization_id = u.organization_id AND r.system_key = u.role AND u.rbac_role_id IS DISTINCT FROM r.id;
END $$;

-- Vérification d'un droit, même nom et même forme que Mannyx
CREATE OR REPLACE FUNCTION public.rbac_has_any_permission(p_keys text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.rbac_role_permissions rp ON rp.role_id = u.rbac_role_id
      WHERE u.id = public.app_user_id() AND rp.granted AND rp.permission_key = ANY (p_keys)
    )
    OR EXISTS (
      SELECT 1 FROM public.rbac_legacy_permission_map m
      WHERE m.permission_key = ANY (p_keys) AND m.legacy = ANY (public.app_permissions())
    ),
    false)
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_has_any_permission(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rbac_has_any_permission(text[]) TO authenticated;
