/*
  Console de la plateforme, étape C1 (version allégée) : base de données, aucun écran dans cette étape.

  Alignée sur Mannyx, où la plateforme est administrée par « owner_admins » (table + is_owner_admin()) et où le journal
  des actions s'appelle admin_audit_log. À la fusion, ces objets sont remplacés par ceux de Mannyx ; les modules activés par
  entreprise (organization_modules, futur company_modules) sont la pièce qui manque chez Mannyx : ils portent les modules payants
  (GO-Mat, ChantierPilot…).

  Contenu :
    1. owner_admins : la table des administrateurs de plateforme est renommée (même contenu, colonne user_id comme chez Mannyx) ;
       is_owner_admin() est la fonction de référence, is_platform_admin() reste comme synonyme pour le code existant.
    2. admin_audit_log : journal des actions de la plateforme, en ajout seul (colonnes de la spécification Mannyx).
    3. platform_modules / organization_modules : catalogue des modules et modules activés par entreprise. Le planning de chantier
       exige désormais d'être activé ; les entreprises existantes le gardent, les nouvelles partent sans module.
    4. Fonctions de la console : création / suspension d'une entreprise (journalisées), activation d'un module, liste des entreprises
       avec leurs modules, usage (des chiffres, jamais le contenu), journal.
  La console gère les entreprises, JAMAIS leurs données.
*/

-- 1. owner_admins ---------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.platform_admins') IS NOT NULL AND to_regclass('public.owner_admins') IS NULL THEN
    ALTER TABLE public.platform_admins RENAME TO owner_admins;
    ALTER TABLE public.owner_admins RENAME COLUMN auth_user_id TO user_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_owner_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$ SELECT EXISTS (SELECT 1 FROM public.owner_admins WHERE user_id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$ SELECT public.is_owner_admin() $$;
REVOKE EXECUTE ON FUNCTION public.is_owner_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner_admin() TO authenticated;

-- 2. Journal de la plateforme : ajout seul -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,                                   -- compte (auth.users) de la personne qui a agi
  action text NOT NULL,
  target_type text NOT NULL,                       -- company / module / owner_admin
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON public.admin_audit_log (target_type, target_id);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Le journal de la plateforme est en ajout seul';
END;
$$;
DROP TRIGGER IF EXISTS admin_audit_append_only_trigger ON public.admin_audit_log;
CREATE TRIGGER admin_audit_append_only_trigger BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.admin_audit_append_only();

CREATE OR REPLACE FUNCTION public.admin_log(p_action text, p_target_type text, p_target_id uuid, p_metadata jsonb DEFAULT '{}')
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, COALESCE(p_metadata, '{}'))
$$;
REVOKE EXECUTE ON FUNCTION public.admin_log(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- 3. Modules activés par entreprise -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_modules (
  key text PRIMARY KEY CHECK (key ~ '^[a-z0-9_]+$'),
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0
);
INSERT INTO public.platform_modules (key, label, description, position) VALUES
  ('chantiers_planning', 'Planning de chantier', 'Zones, équipes, prestataires, interventions et frise horaire', 1),
  ('personnes_externes', 'Personnes externes et badges', 'Ouvriers d''un prestataire, badges QR, chef d''équipe', 2),
  ('portails', 'Portails', 'Accès limité pour les prestataires', 3),
  ('repas', 'Repas', 'Plan de repas, bons, scan, statistiques', 4),
  ('allergies', 'Allergies', 'Allergies, consentement, accès restreint', 5),
  ('hotel', 'Hôtel et rooming list', 'Besoins d''hôtel et rooming list', 6),
  ('facturation', 'Facturation', 'Clients, factures, QR-bill', 7),
  ('temps_de_travail', 'Temps de travail', 'Heures réelles et pointage', 8)
ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.platform_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_modules_read ON public.platform_modules;
CREATE POLICY platform_modules_read ON public.platform_modules FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.platform_modules TO authenticated;
REVOKE ALL ON public.platform_modules FROM anon;

CREATE TABLE IF NOT EXISTS public.organization_modules (
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.platform_modules(key) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, module_key)
);
ALTER TABLE public.organization_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON public.organization_modules;
DROP POLICY IF EXISTS organization_modules_read ON public.organization_modules;
CREATE POLICY org_isolation ON public.organization_modules AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = (SELECT public.app_org_id())) WITH CHECK (organization_id = (SELECT public.app_org_id()));
CREATE POLICY organization_modules_read ON public.organization_modules FOR SELECT TO authenticated USING ((SELECT public.app_is_member()));
GRANT SELECT ON public.organization_modules TO authenticated;      -- lecture seule : l'écriture passe par la console
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_modules TO service_role;
REVOKE ALL ON public.organization_modules FROM anon;

CREATE OR REPLACE FUNCTION public.org_module_enabled(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_modules m WHERE m.organization_id = public.app_org_id() AND m.module_key = p_key AND m.enabled)
$$;
REVOKE EXECUTE ON FUNCTION public.org_module_enabled(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_module_enabled(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_modules()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(array_agg(m.module_key ORDER BY m.module_key), ARRAY[]::text[])
  FROM public.organization_modules m WHERE m.organization_id = public.app_org_id() AND m.enabled AND public.app_is_member()
$$;
REVOKE EXECUTE ON FUNCTION public.my_modules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_modules() TO authenticated;

-- Les entreprises existantes gardent le planning de chantier (déjà livré) ; les nouvelles partent sans module
INSERT INTO public.organization_modules (organization_id, module_key)
SELECT o.id, 'chantiers_planning' FROM public.organizations o
ON CONFLICT DO NOTHING;

-- Le planning exige le module activé
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contractors', 'site_config', 'site_blocked_days', 'site_zones', 'site_phases', 'site_teams', 'site_interventions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS planning_read ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS planning_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS planning_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS planning_delete ON public.%I', t);
    EXECUTE format('CREATE POLICY planning_read ON public.%I FOR SELECT TO authenticated USING ((SELECT public.org_module_enabled(''chantiers_planning'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''chantiers.planning:read''])))', t);
    EXECUTE format('CREATE POLICY planning_insert ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.org_module_enabled(''chantiers_planning'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''chantiers.planning:create''])))', t);
    EXECUTE format('CREATE POLICY planning_update ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.org_module_enabled(''chantiers_planning'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''chantiers.planning:update'']))) WITH CHECK ((SELECT public.org_module_enabled(''chantiers_planning'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''chantiers.planning:update''])))', t);
    EXECUTE format('CREATE POLICY planning_delete ON public.%I FOR DELETE TO authenticated USING ((SELECT public.org_module_enabled(''chantiers_planning'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''chantiers.planning:delete''])))', t);
  END LOOP;
END $$;

-- 4. Fonctions de la console (réservées à un owner_admin) -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_create_organization(
  p_name text, p_admin_email text, p_admin_first_name text, p_admin_last_name text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_n integer;
  v_email text := lower(btrim(p_admin_email));
BEGIN
  PERFORM set_config('app.org_guard_off', 'on', true);
  IF NOT public.is_owner_admin() THEN
    RAISE EXCEPTION 'Réservé à l''administrateur de la plateforme';
  END IF;
  IF btrim(COALESCE(p_name, '')) = '' THEN RAISE EXCEPTION 'Le nom de l''entreprise est obligatoire'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Adresse e-mail de l''administrateur invalide'; END IF;
  IF btrim(COALESCE(p_admin_first_name, '')) = '' OR btrim(COALESCE(p_admin_last_name, '')) = '' THEN
    RAISE EXCEPTION 'Le prénom et le nom de l''administrateur sont obligatoires';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organizations WHERE lower(btrim(name)) = lower(btrim(p_name))) THEN
    RAISE EXCEPTION 'Une entreprise porte déjà ce nom';
  END IF;
  SELECT count(*) + 1 INTO v_n FROM public.organizations;
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE article_series = 'GM' || lpad(v_n::text, 4, '0')) LOOP v_n := v_n + 1; END LOOP;
  INSERT INTO public.organizations (id, name, article_series) VALUES (v_id, btrim(p_name), 'GM' || lpad(v_n::text, 4, '0'));
  PERFORM public.seed_organization(v_id);
  INSERT INTO public.users (organization_id, email, first_name, last_name, role, active)
  VALUES (v_id, v_email, btrim(p_admin_first_name), btrim(p_admin_last_name), 'admin', true);
  PERFORM public.admin_log('create_company', 'company', v_id, jsonb_build_object('name', btrim(p_name), 'admin_email', v_email));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_organization_active(p_organization_id uuid, p_active boolean)
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
  UPDATE public.organizations SET active = p_active WHERE id = p_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entreprise introuvable'; END IF;
  PERFORM public.admin_log(CASE WHEN p_active THEN 'reactivate_company' ELSE 'suspend_company' END, 'company', p_organization_id,
    jsonb_build_object('name', (SELECT name FROM public.organizations WHERE id = p_organization_id)));
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_module(p_organization_id uuid, p_module_key text, p_enabled boolean)
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
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN RAISE EXCEPTION 'Entreprise introuvable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_modules WHERE key = p_module_key) THEN RAISE EXCEPTION 'Module inconnu'; END IF;
  INSERT INTO public.organization_modules (organization_id, module_key, enabled, updated_at)
  VALUES (p_organization_id, p_module_key, COALESCE(p_enabled, false), now())
  ON CONFLICT (organization_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();
  PERFORM public.admin_log(CASE WHEN p_enabled THEN 'enable_module' ELSE 'disable_module' END, 'company', p_organization_id,
    jsonb_build_object('module', p_module_key, 'name', (SELECT name FROM public.organizations WHERE id = p_organization_id)));
END;
$$;

-- Liste des entreprises avec leurs modules (l'ancienne platform_list_organizations reste en place)
CREATE OR REPLACE FUNCTION public.platform_organizations()
RETURNS TABLE (id uuid, name text, active boolean, created_at timestamptz, people bigint, admins bigint, modules text[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_owner_admin() THEN
    RAISE EXCEPTION 'Réservé à l''administrateur de la plateforme';
  END IF;
  RETURN QUERY
  SELECT o.id, o.name, o.active, o.created_at,
         (SELECT count(*) FROM public.users u WHERE u.organization_id = o.id AND u.active),
         (SELECT count(*) FROM public.users u WHERE u.organization_id = o.id AND u.active AND u.role = 'admin'),
         COALESCE((SELECT array_agg(m.module_key ORDER BY m.module_key) FROM public.organization_modules m WHERE m.organization_id = o.id AND m.enabled), ARRAY[]::text[])
  FROM public.organizations o ORDER BY o.created_at;
END;
$$;

-- Usage : des chiffres, jamais le contenu
CREATE OR REPLACE FUNCTION public.platform_organization_usage()
RETURNS TABLE (organization_id uuid, people_active bigint, last_sign_in timestamptz, equipment bigint, checkouts_30d bigint, storage_bytes bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_owner_admin() THEN
    RAISE EXCEPTION 'Réservé à l''administrateur de la plateforme';
  END IF;
  RETURN QUERY
  SELECT o.id,
         (SELECT count(*) FROM public.users u WHERE u.organization_id = o.id AND u.active),
         (SELECT max(a.last_sign_in_at) FROM auth.users a WHERE a.id IN (SELECT u.auth_user_id FROM public.users u WHERE u.organization_id = o.id AND u.auth_user_id IS NOT NULL)),
         (SELECT count(*) FROM public.equipment e WHERE e.organization_id = o.id),
         (SELECT count(*) FROM public.checkouts c WHERE c.organization_id = o.id AND c.checkout_date >= now() - interval '30 days'),
         COALESCE((SELECT sum(COALESCE((s.metadata ->> 'size')::bigint, 0)) FROM storage.objects s WHERE public.storage_path_org(s.name) = o.id), 0)::bigint
  FROM public.organizations o ORDER BY o.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_audit(p_limit integer DEFAULT 100)
RETURNS TABLE (id uuid, at timestamptz, actor_email text, action text, target_type text, target_name text, metadata jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_owner_admin() THEN
    RAISE EXCEPTION 'Réservé à l''administrateur de la plateforme';
  END IF;
  RETURN QUERY
  SELECT l.id, l.created_at, (SELECT a.email FROM auth.users a WHERE a.id = l.actor_id), l.action, l.target_type,
         COALESCE((SELECT o.name FROM public.organizations o WHERE o.id = l.target_id), l.metadata ->> 'name'), l.metadata
  FROM public.admin_audit_log l ORDER BY l.created_at DESC, l.id DESC LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.platform_create_organization(text, text, text, text), public.platform_set_organization_active(uuid, boolean),
  public.platform_set_module(uuid, text, boolean), public.platform_organizations(), public.platform_organization_usage(), public.platform_audit(integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_create_organization(text, text, text, text), public.platform_set_organization_active(uuid, boolean),
  public.platform_set_module(uuid, text, boolean), public.platform_organizations(), public.platform_organization_usage(), public.platform_audit(integer)
  TO authenticated;

-- 5. whoami : ajoute les modules de l'entreprise active (le reste est inchangé) ---------------------------------------
CREATE OR REPLACE FUNCTION public.whoami()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_org uuid;
  v_user public.users;
BEGIN
  PERFORM set_config('app.org_guard_off', 'on', true);
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = v_uid) THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid AND email_confirmed_at IS NOT NULL;
    IF v_email IS NOT NULL THEN
      UPDATE public.users SET auth_user_id = v_uid
      WHERE lower(email) = lower(v_email) AND auth_user_id IS NULL;
    END IF;
  END IF;
  v_org := public.app_org_id();
  IF v_org IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_user FROM public.users WHERE auth_user_id = v_uid AND organization_id = v_org AND active;
  IF v_user.id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'id', v_user.id,
    'first_name', v_user.first_name,
    'last_name', v_user.last_name,
    'email', v_user.email,
    'role', v_user.role,
    'permissions', to_jsonb(public.app_permissions()),
    'depot_ids', COALESCE((SELECT jsonb_agg(depot_id) FROM public.user_depots WHERE user_id = v_user.id), '[]'::jsonb),
    'organization', (SELECT jsonb_build_object('id', o.id, 'name', o.name) FROM public.organizations o WHERE o.id = v_org),
    'organizations', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'role', m.role, 'current', m.is_current)) FROM public.my_organizations() m), '[]'::jsonb),
    'platform_admin', public.is_owner_admin(),
    'modules', public.my_modules()
  );
END;
$function$;
