/*
  Module 0 — Fondation multi-entreprise (ChantierPilot), étapes 0.1 à 0.3

  Principe
    - Une « personne » (table users) est la fiche d'UNE personne dans UNE entreprise. Un même compte de
      connexion peut avoir une fiche par entreprise (même e-mail) : c'est ce qui permet d'appartenir à
      plusieurs entreprises, chacune avec ses propres rôles et droits.
    - L'entreprise active du compte est retenue dans account_context ; on en change avec
      switch_organization(), qui vérifie l'appartenance.
    - Toute table porte organization_id, rempli par défaut avec l'entreprise active, et une politique
      RESTRICTIVE « org_isolation » s'ajoute aux règles existantes : une ligne d'une autre entreprise n'est
      ni lisible ni modifiable, quelle que soit la règle permissive.
    - Les données existantes passent dans « ENTREPRISE TEST » (entreprise 0000…0001, déjà utilisée).
    - Seul un administrateur de plateforme (platform_admins) crée des entreprises.

  Ne couvre PAS (étapes suivantes) : fonctions SECURITY DEFINER (0.4), stockage de fichiers (0.5), interface (0.6).
*/

-- 0. Entreprises ---------------------------------------------------------------------------
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
UPDATE public.organizations SET name = 'ENTREPRISE TEST'
WHERE id = '00000000-0000-0000-0000-000000000001' AND name = 'Ma société';
CREATE UNIQUE INDEX IF NOT EXISTS organizations_article_series_key ON public.organizations (article_series);

-- Administrateurs de plateforme : invisibles par l'API, gérés uniquement depuis la console SQL
CREATE TABLE IF NOT EXISTS public.platform_admins (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM anon, authenticated;

-- Entreprise active de chaque compte
CREATE TABLE IF NOT EXISTS public.account_context (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_context FROM anon, authenticated;

-- 1. Fiches par entreprise -------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id);

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_auth_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_org_email_key ON public.users (organization_id, lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_org_auth_key ON public.users (organization_id, auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_auth_idx ON public.users (auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 2. Qui est connecté, dans quelle entreprise ----------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$ SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE auth_user_id = auth.uid()) $$;

-- Entreprise active : celle choisie si le compte y a une fiche active, sinon sa plus ancienne fiche.
-- NULL si le compte n'a aucune fiche active dans une entreprise active.
CREATE OR REPLACE FUNCTION public.app_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(
    (SELECT u.organization_id
     FROM public.account_context c
     JOIN public.users u ON u.auth_user_id = c.auth_user_id AND u.organization_id = c.organization_id
     JOIN public.organizations o ON o.id = u.organization_id AND o.active
     WHERE c.auth_user_id = auth.uid() AND u.active
       AND (u.access_until IS NULL OR u.access_until >= (now() AT TIME ZONE 'Europe/Zurich')::date)),
    (SELECT u.organization_id
     FROM public.users u
     JOIN public.organizations o ON o.id = u.organization_id AND o.active
     WHERE u.auth_user_id = auth.uid() AND u.active
       AND (u.access_until IS NULL OR u.access_until >= (now() AT TIME ZONE 'Europe/Zurich')::date)
     ORDER BY u.created_at, u.id
     LIMIT 1)
  );
$$;

-- Entreprise d'une nouvelle ligne : l'entreprise active ; sans utilisateur (tâches planifiées, console),
-- l'entreprise historique. Les tâches planifiées doivent poser l'entreprise explicitement (étape 0.4).
CREATE OR REPLACE FUNCTION public.new_row_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$ SELECT COALESCE(public.app_org_id(), public.default_organization_id()) $$;

CREATE OR REPLACE FUNCTION public.app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT id FROM public.users
  WHERE auth_user_id = auth.uid() AND active
    AND organization_id = public.app_org_id()
    AND (access_until IS NULL OR access_until >= (now() AT TIME ZONE 'Europe/Zurich')::date);
$$;

CREATE OR REPLACE FUNCTION public.app_permissions()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(
    (SELECT ARRAY(SELECT DISTINCT unnest(public.role_permissions(role) || permissions))
     FROM public.users
     WHERE auth_user_id = auth.uid() AND active AND organization_id = public.app_org_id()),
    ARRAY[]::text[]
  );
$$;

-- 3. Entreprises du compte, changement d'entreprise, profil --------------------------------
CREATE OR REPLACE FUNCTION public.my_organizations()
RETURNS TABLE (id uuid, name text, role text, is_current boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT o.id, o.name, u.role, o.id = public.app_org_id()
  FROM public.users u
  JOIN public.organizations o ON o.id = u.organization_id AND o.active
  WHERE u.auth_user_id = auth.uid() AND u.active
    AND (u.access_until IS NULL OR u.access_until >= (now() AT TIME ZONE 'Europe/Zurich')::date)
  ORDER BY o.name;
$$;

CREATE OR REPLACE FUNCTION public.whoami()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_org uuid;
  v_user public.users;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  -- Un compte dont l'e-mail est confirmé est lié à toutes les fiches de même e-mail (une par entreprise)
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
    'platform_admin', public.is_platform_admin()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.switch_organization(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.my_organizations() m WHERE m.id = p_organization_id) THEN
    RAISE EXCEPTION 'Tu n''as pas accès à cette entreprise';
  END IF;
  INSERT INTO public.account_context (auth_user_id, organization_id, updated_at)
  VALUES (auth.uid(), p_organization_id, now())
  ON CONFLICT (auth_user_id) DO UPDATE SET organization_id = EXCLUDED.organization_id, updated_at = now();
  RETURN public.whoami();
END;
$$;

-- 4. Toutes les tables portent organization_id ----------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
      AND c.relname NOT IN ('organizations', 'platform_admins', 'account_context')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns k
                      WHERE k.table_schema = 'public' AND k.table_name = c.relname AND k.column_name = 'organization_id')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id)', t);
  END LOOP;

  -- Désormais : l'entreprise active à chaque création de ligne ; un index pour le filtre d'isolation
  FOR t IN
    SELECT c.relname FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
      AND c.relname NOT IN ('organizations', 'platform_admins', 'account_context')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET DEFAULT public.new_row_org_id()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (organization_id)', t || '_org_idx', t);
  END LOOP;
END $$;

-- Clés propres à chaque entreprise (les codes QR restent uniques partout : un scan ne doit jamais hésiter)
ALTER TABLE public.system_settings DROP CONSTRAINT system_settings_pkey, ADD PRIMARY KEY (organization_id, id);
ALTER TABLE public.status_configs DROP CONSTRAINT status_configs_pkey, ADD PRIMARY KEY (organization_id, id);
ALTER TABLE public.role_configs DROP CONSTRAINT role_configs_pkey, ADD PRIMARY KEY (organization_id, id);
ALTER TABLE public.equipment DROP CONSTRAINT IF EXISTS equipment_article_number_key;
ALTER TABLE public.equipment DROP CONSTRAINT IF EXISTS equipment_serial_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS equipment_org_article_key ON public.equipment (organization_id, article_number);
CREATE UNIQUE INDEX IF NOT EXISTS equipment_org_serial_key ON public.equipment (organization_id, serial_number);

-- Numéro d'article : série de l'entreprise de l'article
CREATE OR REPLACE FUNCTION public.next_article_number(p_organization_id uuid DEFAULT public.new_row_org_id())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_series text;
  v_counter bigint;
  v_number text;
BEGIN
  LOOP
    UPDATE public.organizations
    SET article_counter = article_counter + 1
    WHERE id = p_organization_id
    RETURNING article_series, article_counter INTO v_series, v_counter;

    IF v_series IS NULL THEN
      RAISE EXCEPTION 'Organisation introuvable : %', p_organization_id;
    END IF;

    v_number := v_series || '-' || lpad(v_counter::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.equipment WHERE organization_id = p_organization_id AND article_number = v_number);
  END LOOP;
  RETURN v_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_article_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.article_number IS NULL OR btrim(NEW.article_number) = '' THEN
    NEW.article_number := public.next_article_number(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Isolation : une règle RESTRICTIVE sur chaque table ---------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
      AND c.relname NOT IN ('organizations', 'platform_admins', 'account_context')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON public.%I', t);
    EXECUTE format($f$CREATE POLICY org_isolation ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
      USING (organization_id = (SELECT public.app_org_id()))
      WITH CHECK (organization_id = (SELECT public.app_org_id()))$f$, t);
  END LOOP;
END $$;

-- Entreprises : chacun lit celles où il a une fiche active ; un administrateur renomme la sienne ;
-- la création passe uniquement par platform_create_organization()
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organizations' LOOP
    EXECUTE format('DROP POLICY %I ON public.organizations', pol.policyname);
  END LOOP;
END $$;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_read ON public.organizations FOR SELECT TO authenticated
  USING (id IN (SELECT m.id FROM public.my_organizations() m));
CREATE POLICY organizations_rename ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.app_org_id() AND public.app_has('settings'))
  WITH CHECK (id = public.app_org_id() AND public.app_has('settings'));

-- Un administrateur ne change ni la série d'articles ni le compteur ni l'état de son entreprise
CREATE OR REPLACE FUNCTION public.organizations_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.article_series := OLD.article_series;
    NEW.article_counter := OLD.article_counter;
    NEW.active := OLD.active;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS organizations_guard_trigger ON public.organizations;
CREATE TRIGGER organizations_guard_trigger BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.organizations_guard();

-- 6. Garde sur les personnes : « dernier administrateur » compté par entreprise -------------
CREATE OR REPLACE FUNCTION public.users_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_is_admin boolean := 'settings' = ANY (public.app_permissions()) AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid() AND organization_id = public.app_org_id() AND role = 'admin' AND active
  );
  v_admin_left integer;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.role = 'admin' AND OLD.active
     AND (TG_OP = 'DELETE' OR NEW.role <> 'admin' OR NOT NEW.active) THEN
    SELECT count(*) INTO v_admin_left FROM public.users
    WHERE organization_id = OLD.organization_id AND role = 'admin' AND active AND id <> OLD.id;
    IF v_admin_left = 0 THEN
      RAISE EXCEPTION 'Il faut garder au moins un administrateur actif';
    END IF;
  END IF;

  -- Règles réservées aux utilisateurs de l'application (pas aux fonctions internes ni à la console)
  IF current_user = 'authenticated' THEN
    IF TG_OP = 'DELETE' THEN
      IF OLD.role = 'admin' AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Seul un administrateur peut supprimer un administrateur';
      END IF;
      RETURN OLD;
    END IF;

    IF (NEW.role = 'admin' OR 'settings' = ANY (NEW.permissions)
        OR (TG_OP = 'UPDATE' AND (OLD.role = 'admin' OR 'settings' = ANY (OLD.permissions))))
       AND NOT v_is_admin
       AND (TG_OP = 'INSERT' OR NEW.role IS DISTINCT FROM OLD.role OR NEW.permissions IS DISTINCT FROM OLD.permissions
            OR NEW.active IS DISTINCT FROM OLD.active) THEN
      RAISE EXCEPTION 'Seul un administrateur peut attribuer ou retirer le rôle administrateur ou le droit « réglages »';
    END IF;

    IF TG_OP = 'INSERT' THEN
      NEW.auth_user_id := NULL;
    ELSIF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
      NEW.auth_user_id := OLD.auth_user_id;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND lower(NEW.email) IS DISTINCT FROM lower(OLD.email) THEN
    NEW.auth_user_id := NULL;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- 7. Console de la plateforme (administrateurs de plateforme uniquement) ----------------------
CREATE OR REPLACE FUNCTION public.seed_organization(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_template uuid := public.default_organization_id();
BEGIN
  INSERT INTO public.depots (organization_id, name, is_default) VALUES (p_organization_id, 'Dépôt principal', true)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.status_configs (organization_id, id, name, color)
  SELECT p_organization_id, id, name, color FROM public.status_configs WHERE organization_id = v_template
  ON CONFLICT DO NOTHING;
  INSERT INTO public.maintenance_types (organization_id, name, description, color)
  SELECT p_organization_id, name, description, color FROM public.maintenance_types WHERE organization_id = v_template
  ON CONFLICT DO NOTHING;
  -- Réglages généraux ; ni logo, ni téléphone, ni dates d'état propres à l'entreprise modèle
  INSERT INTO public.system_settings (organization_id, id, value, description)
  SELECT p_organization_id, id, value, description FROM public.system_settings
  WHERE organization_id = v_template
    AND id NOT IN ('company_logo', 'found_phone') AND id NOT LIKE 'last\_%'
  ON CONFLICT DO NOTHING;
END;
$$;

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
  IF NOT public.is_platform_admin() THEN
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
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_list_organizations()
RETURNS TABLE (id uuid, name text, active boolean, created_at timestamptz, people bigint, admins bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Réservé à l''administrateur de la plateforme';
  END IF;
  RETURN QUERY
  SELECT o.id, o.name, o.active, o.created_at,
         (SELECT count(*) FROM public.users u WHERE u.organization_id = o.id AND u.active),
         (SELECT count(*) FROM public.users u WHERE u.organization_id = o.id AND u.active AND u.role = 'admin')
  FROM public.organizations o ORDER BY o.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_organization_active(p_organization_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Réservé à l''administrateur de la plateforme';
  END IF;
  UPDATE public.organizations SET active = p_active WHERE id = p_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entreprise introuvable'; END IF;
END;
$$;

-- 8. Droits d'exécution ------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION
  public.is_platform_admin(), public.app_org_id(), public.new_row_org_id(), public.my_organizations(),
  public.switch_organization(uuid), public.seed_organization(uuid),
  public.platform_create_organization(text, text, text, text), public.platform_list_organizations(),
  public.platform_set_organization_active(uuid, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.is_platform_admin(), public.app_org_id(), public.new_row_org_id(), public.my_organizations(),
  public.switch_organization(uuid), public.platform_create_organization(text, text, text, text),
  public.platform_list_organizations(), public.platform_set_organization_active(uuid, boolean)
TO authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_organization(uuid) FROM authenticated;
