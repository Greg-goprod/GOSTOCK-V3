/*
  Console de la plateforme, étape C1 : base de données (aucun écran dans cette étape).

  Qui : l'équipe de la plateforme, deux niveaux, indépendants des rôles d'une entreprise cliente.
    - propriétaire : tout, y compris gérer l'équipe, suspendre une entreprise, changer son plan, activer ses modules ;
    - support      : voit toutes les entreprises, leur usage et le journal ; crée une entreprise ; tient la note interne.
  Quoi : entreprises (identifiant lisible, plan, note interne, suspension), modules activés par entreprise,
         usage (personnes, dernière connexion, articles, sorties, stockage), équipe de la plateforme, journal des actions.
  La console gère les entreprises, JAMAIS leurs données : aucune fonction ne lit le contenu d'une entreprise cliente.

  Sécurité : chaque fonction vérifie le niveau côté base ; le journal est en ajout seul (ni modification ni suppression) ;
  la note interne est dans une table invisible par l'API.
  Le module « planning de chantier » exige désormais d'être activé pour l'entreprise (comme les modules à venir).
*/

-- 1. Entreprise : identifiant lisible et plan -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.slugify(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT COALESCE(NULLIF(trim(both '-' FROM regexp_replace(
    lower(translate(COALESCE(p_text, ''), 'àâäáãåéèêëíìîïóòôöõúùûüçñÀÂÄÁÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑ', 'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn')),
    '[^a-z0-9]+', '-', 'g')), ''), 'entreprise')
$$;

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'standard';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_plan_check') THEN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_plan_check CHECK (plan IN ('essai', 'standard', 'premium'));
  END IF;
END $$;
UPDATE public.organizations o SET slug = public.slugify(o.name) WHERE o.slug IS NULL;
UPDATE public.organizations o SET slug = o.slug || '-' || substr(o.id::text, 1, 4)
WHERE EXISTS (SELECT 1 FROM public.organizations p WHERE p.slug = o.slug AND p.created_at < o.created_at);
ALTER TABLE public.organizations ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_key ON public.organizations (slug);

-- Une entreprise ne change ni son plan ni son identifiant (comme déjà sa série d'articles et son état)
CREATE OR REPLACE FUNCTION public.organizations_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.article_series := OLD.article_series;
    NEW.article_counter := OLD.article_counter;
    NEW.active := OLD.active;
    NEW.created_at := OLD.created_at;
    NEW.slug := OLD.slug;
    NEW.plan := OLD.plan;
  END IF;
  RETURN NEW;
END;
$$;

-- Note interne : table sans aucune règle d'accès (invisible par l'API)
CREATE TABLE IF NOT EXISTS public.platform_organization_notes (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_organization_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_organization_notes FROM anon, authenticated;

-- 2. Équipe de la plateforme : niveaux ---------------------------------------------------------------------
ALTER TABLE public.platform_admins ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'owner';
ALTER TABLE public.platform_admins ADD COLUMN IF NOT EXISTS added_by uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_admins_level_check') THEN
    ALTER TABLE public.platform_admins ADD CONSTRAINT platform_admins_level_check CHECK (level IN ('owner', 'support'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.platform_level()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$ SELECT level FROM public.platform_admins WHERE auth_user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$ SELECT COALESCE(public.platform_level() = 'owner', false) $$;
GRANT EXECUTE ON FUNCTION public.platform_level(), public.is_platform_owner() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.platform_level(), public.is_platform_owner() FROM PUBLIC, anon;

-- Vérification commune : p_need = 'support' (toute l'équipe) ou 'owner'
CREATE OR REPLACE FUNCTION public.platform_require(p_need text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_level text := public.platform_level();
BEGIN
  IF v_level IS NULL THEN
    RAISE EXCEPTION 'Réservé à l''équipe de la plateforme';
  END IF;
  IF p_need = 'owner' AND v_level <> 'owner' THEN
    RAISE EXCEPTION 'Réservé au propriétaire de la plateforme';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_require(text) FROM PUBLIC, anon, authenticated;

-- 3. Journal des actions de la plateforme : ajout seul -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor_auth_user_id uuid,
  actor_email text,
  action text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  organization_name text,
  details jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS platform_audit_log_at_idx ON public.platform_audit_log (at DESC);
CREATE INDEX IF NOT EXISTS platform_audit_log_org_idx ON public.platform_audit_log (organization_id);
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_audit_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.platform_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Seule la suppression d'une entreprise détache ses lignes (organization_id → NULL) ; tout le reste est refusé
  IF TG_OP = 'UPDATE' AND NEW.organization_id IS NULL AND OLD.organization_id IS NOT NULL
     AND (to_jsonb(NEW) - 'organization_id') = (to_jsonb(OLD) - 'organization_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Le journal de la plateforme est en ajout seul';
END;
$$;
DROP TRIGGER IF EXISTS platform_audit_append_only_trigger ON public.platform_audit_log;
CREATE TRIGGER platform_audit_append_only_trigger BEFORE UPDATE OR DELETE ON public.platform_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.platform_audit_append_only();

CREATE OR REPLACE FUNCTION public.platform_log(p_action text, p_organization_id uuid, p_details jsonb DEFAULT '{}')
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  INSERT INTO public.platform_audit_log (actor_auth_user_id, actor_email, action, organization_id, organization_name, details)
  VALUES (auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()), p_action, p_organization_id,
          (SELECT name FROM public.organizations WHERE id = p_organization_id), COALESCE(p_details, '{}'))
$$;
REVOKE EXECUTE ON FUNCTION public.platform_log(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- 4. Modules activés par entreprise ----------------------------------------------------------------------------
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

-- Le planning exige le module activé : les règles d'accès de ses tables s'ajoutent le contrôle
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

-- 5. Fonctions de la console ------------------------------------------------------------------------------------
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
  v_s integer;
  v_slug text;
  v_base text;
  v_email text := lower(btrim(p_admin_email));
BEGIN
  PERFORM set_config('app.org_guard_off', 'on', true);
  PERFORM public.platform_require('support');
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
  v_base := public.slugify(p_name);
  v_slug := v_base;
  v_s := 1;
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) LOOP v_s := v_s + 1; v_slug := v_base || '-' || v_s; END LOOP;
  INSERT INTO public.organizations (id, name, slug, article_series)
  VALUES (v_id, btrim(p_name), v_slug, 'GM' || lpad(v_n::text, 4, '0'));
  PERFORM public.seed_organization(v_id);
  INSERT INTO public.users (organization_id, email, first_name, last_name, role, active)
  VALUES (v_id, v_email, btrim(p_admin_first_name), btrim(p_admin_last_name), 'admin', true);
  PERFORM public.platform_log('create_organization', v_id, jsonb_build_object('slug', v_slug, 'admin_email', v_email));
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
  PERFORM public.platform_require('owner');
  UPDATE public.organizations SET active = p_active WHERE id = p_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entreprise introuvable'; END IF;
  PERFORM public.platform_log(CASE WHEN p_active THEN 'reactivate_organization' ELSE 'suspend_organization' END, p_organization_id);
END;
$$;

-- Plan : propriétaire seulement. Note interne : toute l'équipe.
CREATE OR REPLACE FUNCTION public.platform_update_organization(p_organization_id uuid, p_plan text, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_old_plan text;
  v_old_note text;
  v_new_note text := COALESCE(p_note, '');
BEGIN
  PERFORM set_config('app.org_guard_off', 'on', true);
  PERFORM public.platform_require('support');
  IF p_plan NOT IN ('essai', 'standard', 'premium') THEN
    RAISE EXCEPTION 'Plan inconnu : essai, standard ou premium';
  END IF;
  SELECT plan INTO v_old_plan FROM public.organizations WHERE id = p_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entreprise introuvable'; END IF;
  IF p_plan <> v_old_plan THEN
    PERFORM public.platform_require('owner');
    UPDATE public.organizations SET plan = p_plan WHERE id = p_organization_id;
    PERFORM public.platform_log('change_plan', p_organization_id, jsonb_build_object('plan_before', v_old_plan, 'plan_after', p_plan));
  END IF;
  SELECT COALESCE((SELECT n.note FROM public.platform_organization_notes n WHERE n.organization_id = p_organization_id), '') INTO v_old_note;
  IF v_new_note <> v_old_note THEN
    INSERT INTO public.platform_organization_notes (organization_id, note, updated_at)
    VALUES (p_organization_id, v_new_note, now())
    ON CONFLICT (organization_id) DO UPDATE SET note = EXCLUDED.note, updated_at = now();
    PERFORM public.platform_log('update_note', p_organization_id);
  END IF;
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
  PERFORM public.platform_require('owner');
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN RAISE EXCEPTION 'Entreprise introuvable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_modules WHERE key = p_module_key) THEN RAISE EXCEPTION 'Module inconnu'; END IF;
  INSERT INTO public.organization_modules (organization_id, module_key, enabled, updated_at)
  VALUES (p_organization_id, p_module_key, COALESCE(p_enabled, false), now())
  ON CONFLICT (organization_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();
  PERFORM public.platform_log(CASE WHEN p_enabled THEN 'enable_module' ELSE 'disable_module' END, p_organization_id, jsonb_build_object('module', p_module_key));
END;
$$;

-- Liste des entreprises avec leurs modules (l'ancienne platform_list_organizations reste en place)
CREATE OR REPLACE FUNCTION public.platform_organizations()
RETURNS TABLE (id uuid, name text, slug text, plan text, active boolean, created_at timestamptz, people bigint, admins bigint, note text, modules text[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.platform_require('support');
  RETURN QUERY
  SELECT o.id, o.name, o.slug, o.plan, o.active, o.created_at,
         (SELECT count(*) FROM public.users u WHERE u.organization_id = o.id AND u.active),
         (SELECT count(*) FROM public.users u WHERE u.organization_id = o.id AND u.active AND u.role = 'admin'),
         COALESCE((SELECT n.note FROM public.platform_organization_notes n WHERE n.organization_id = o.id), ''),
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
  PERFORM public.platform_require('support');
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
RETURNS TABLE (id bigint, at timestamptz, actor_email text, action text, organization_name text, details jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.platform_require('support');
  RETURN QUERY
  SELECT l.id, l.at, l.actor_email, l.action, COALESCE((SELECT o.name FROM public.organizations o WHERE o.id = l.organization_id), l.organization_name), l.details
  FROM public.platform_audit_log l ORDER BY l.at DESC, l.id DESC LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
END;
$$;

-- 6. Équipe de la plateforme -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_team()
RETURNS TABLE (auth_user_id uuid, email text, level text, since timestamptz, added_by_email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.platform_require('support');
  RETURN QUERY
  SELECT p.auth_user_id, a.email, p.level, p.created_at, (SELECT b.email FROM auth.users b WHERE b.id = p.added_by)
  FROM public.platform_admins p LEFT JOIN auth.users a ON a.id = p.auth_user_id
  ORDER BY (p.level = 'owner') DESC, p.created_at;
END;
$$;

-- La personne doit s'être connectée au moins une fois (son compte existe) ; elle doit aussi avoir une fiche dans une entreprise pour ouvrir l'application
CREATE OR REPLACE FUNCTION public.platform_add_team_member(p_email text, p_level text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
BEGIN
  PERFORM public.platform_require('owner');
  IF p_level NOT IN ('owner', 'support') THEN RAISE EXCEPTION 'Niveau inconnu : propriétaire ou support'; END IF;
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(btrim(p_email)) LIMIT 1;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Aucun compte avec cette adresse : la personne doit d''abord se connecter une fois à l''application'; END IF;
  IF EXISTS (SELECT 1 FROM public.platform_admins WHERE auth_user_id = v_uid) THEN RAISE EXCEPTION 'Cette personne fait déjà partie de l''équipe'; END IF;
  INSERT INTO public.platform_admins (auth_user_id, level, added_by) VALUES (v_uid, p_level, auth.uid());
  PERFORM public.platform_log('add_team_member', NULL, jsonb_build_object('email', lower(btrim(p_email)), 'level', p_level));
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_team_level(p_auth_user_id uuid, p_level text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_old text;
BEGIN
  PERFORM public.platform_require('owner');
  IF p_level NOT IN ('owner', 'support') THEN RAISE EXCEPTION 'Niveau inconnu : propriétaire ou support'; END IF;
  SELECT level INTO v_old FROM public.platform_admins WHERE auth_user_id = p_auth_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Personne introuvable dans l''équipe'; END IF;
  IF v_old = 'owner' AND p_level <> 'owner' AND (SELECT count(*) FROM public.platform_admins WHERE level = 'owner') <= 1 THEN
    RAISE EXCEPTION 'Il doit toujours rester au moins un propriétaire';
  END IF;
  UPDATE public.platform_admins SET level = p_level WHERE auth_user_id = p_auth_user_id;
  PERFORM public.platform_log('set_team_level', NULL, jsonb_build_object('email', (SELECT email FROM auth.users WHERE id = p_auth_user_id), 'from', v_old, 'to', p_level));
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_remove_team_member(p_auth_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_old text;
BEGIN
  PERFORM public.platform_require('owner');
  SELECT level INTO v_old FROM public.platform_admins WHERE auth_user_id = p_auth_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Personne introuvable dans l''équipe'; END IF;
  IF v_old = 'owner' AND (SELECT count(*) FROM public.platform_admins WHERE level = 'owner') <= 1 THEN
    RAISE EXCEPTION 'Il doit toujours rester au moins un propriétaire';
  END IF;
  DELETE FROM public.platform_admins WHERE auth_user_id = p_auth_user_id;
  PERFORM public.platform_log('remove_team_member', NULL, jsonb_build_object('email', (SELECT email FROM auth.users WHERE id = p_auth_user_id), 'level', v_old));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.platform_create_organization(text, text, text, text), public.platform_set_organization_active(uuid, boolean),
  public.platform_update_organization(uuid, text, text), public.platform_set_module(uuid, text, boolean), public.platform_organizations(),
  public.platform_organization_usage(), public.platform_audit(integer), public.platform_team(), public.platform_add_team_member(text, text),
  public.platform_set_team_level(uuid, text), public.platform_remove_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_create_organization(text, text, text, text), public.platform_set_organization_active(uuid, boolean),
  public.platform_update_organization(uuid, text, text), public.platform_set_module(uuid, text, boolean), public.platform_organizations(),
  public.platform_organization_usage(), public.platform_audit(integer), public.platform_team(), public.platform_add_team_member(text, text),
  public.platform_set_team_level(uuid, text), public.platform_remove_team_member(uuid) TO authenticated;

-- 7. whoami : ajoute le niveau de plateforme (le reste est inchangé) -------------------------------------------------
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
    'platform_admin', public.is_platform_admin(),
    'platform_level', public.platform_level(),
    'modules', public.my_modules()
  );
END;
$function$;
