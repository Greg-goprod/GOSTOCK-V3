/*
  Connexion et rôles

  Connexion : Supabase Auth, e-mail + code (signInWithOtp / verifyOtp). Un compte Auth n'a accès
  à rien tant que son adresse ne correspond pas à une personne active de public.users ; le lien
  (users.auth_user_id) est fait par whoami() à la première connexion.

  Rôles (colonne users.role, valeurs existantes conservées) :
    admin      → Administrateur : tout, y compris les réglages
    manager    → Responsable    : valide les demandes, gère personnes, stock et flotte
    technician → Magasinier     : scanne, prépare, sorties/retours, stock (dépôts attribués)
    user       → Collaborateur  : fait ses demandes, voit son matériel
  Droits à la carte (users.permissions) ajoutés aux droits du rôle :
    settings, manage_people, manage_stock, manage_fleet, scan, approve, view_all, all_depots
  Dépôts (user_depots) : un magasinier sans dépôt attribué travaille sur tous les dépôts.

  Sécurité :
  - aucun accès anonyme aux tables et fonctions ;
  - règles par table (RLS) selon les droits ; les politiques existantes sont modifiées
    (ALTER POLICY) plutôt que supprimées ;
  - les fonctions internes (déclencheurs, calculs de stock, numérotation) passent en
    SECURITY DEFINER : elles maintiennent des données dérivées quel que soit l'utilisateur ;
  - un garde sur requests contrôle chaque changement de statut fait par un utilisateur.
*/

-- 1. Personnes : lien avec le compte de connexion, droits, activation --------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_permissions_known') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_permissions_known CHECK (
      permissions <@ ARRAY['settings', 'manage_people', 'manage_stock', 'manage_fleet', 'scan', 'approve', 'view_all', 'all_depots']
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_depots (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  depot_id uuid NOT NULL REFERENCES public.depots(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, depot_id)
);

-- Premier administrateur : le propriétaire de l'instance
INSERT INTO public.users (first_name, last_name, email, role)
SELECT 'Administrateur', 'GO-Mat', 'contact@gc-entertainment.ch', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE role = 'admin');

-- 2. Droits ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.role_permissions(p_role text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'admin' THEN ARRAY['settings', 'manage_people', 'manage_stock', 'manage_fleet', 'scan', 'approve', 'view_all', 'all_depots']
    WHEN 'manager' THEN ARRAY['manage_people', 'manage_stock', 'manage_fleet', 'scan', 'approve', 'view_all', 'all_depots']
    WHEN 'technician' THEN ARRAY['manage_stock', 'scan', 'view_all']
    ELSE ARRAY[]::text[]
  END;
$$;

-- Personne connectée (NULL si le compte n'est lié à aucune personne active)
CREATE OR REPLACE FUNCTION public.app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() AND active;
$$;

CREATE OR REPLACE FUNCTION public.app_permissions()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT ARRAY(SELECT DISTINCT unnest(public.role_permissions(role) || permissions))
     FROM public.users WHERE auth_user_id = auth.uid() AND active),
    ARRAY[]::text[]
  );
$$;

CREATE OR REPLACE FUNCTION public.app_is_member()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.app_user_id() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.app_has(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_permission = ANY (public.app_permissions());
$$;

-- Le dépôt fait-il partie de ceux de la personne connectée ?
CREATE OR REPLACE FUNCTION public.app_depot_ok(p_depot_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT p_depot_id IS NULL
      OR public.app_has('all_depots')
      OR NOT EXISTS (SELECT 1 FROM public.user_depots WHERE user_id = public.app_user_id())
      OR EXISTS (SELECT 1 FROM public.user_depots WHERE user_id = public.app_user_id() AND depot_id = p_depot_id);
$$;

-- Profil de la personne connectée ; lie le compte à la fiche de même e-mail à la 1re connexion
CREATE OR REPLACE FUNCTION public.whoami()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_user public.users;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_user FROM public.users WHERE auth_user_id = v_uid;
  IF NOT FOUND THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    UPDATE public.users SET auth_user_id = v_uid
    WHERE lower(email) = lower(v_email) AND auth_user_id IS NULL
    RETURNING * INTO v_user;
  END IF;

  IF v_user.id IS NULL OR NOT v_user.active THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_user.id,
    'first_name', v_user.first_name,
    'last_name', v_user.last_name,
    'email', v_user.email,
    'role', v_user.role,
    'permissions', to_jsonb(public.app_permissions()),
    'depot_ids', COALESCE((SELECT jsonb_agg(depot_id) FROM public.user_depots WHERE user_id = v_user.id), '[]'::jsonb)
  );
END;
$$;

-- 3. Garde sur les personnes ------------------------------------------------------------
-- Seul un administrateur donne ou retire le rôle admin et le droit « réglages » ;
-- le dernier administrateur actif ne peut pas être retiré ; le lien de connexion n'est
-- modifiable que par whoami() et saute quand l'e-mail change.
CREATE OR REPLACE FUNCTION public.users_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_admin boolean := 'settings' = ANY (public.app_permissions()) AND EXISTS (
    SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'admin' AND active
  );
  v_admin_left integer;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.role = 'admin' AND OLD.active
     AND (TG_OP = 'DELETE' OR NEW.role <> 'admin' OR NOT NEW.active) THEN
    SELECT count(*) INTO v_admin_left FROM public.users WHERE role = 'admin' AND active AND id <> OLD.id;
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_guard_trigger' AND tgrelid = 'public.users'::regclass) THEN
    CREATE TRIGGER users_guard_trigger
      BEFORE INSERT OR UPDATE OR DELETE ON public.users
      FOR EACH ROW EXECUTE FUNCTION public.users_guard();
  END IF;
END $$;

-- 4. Garde sur les demandes -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.requests_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_me uuid := public.app_user_id();
  v_staff boolean := public.app_has('scan') OR public.app_has('approve');
  v_name text;
BEGIN
  -- Fonctions internes (create_request, déclencheurs) et console : pas de contrôle ici
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'requested' THEN
      RAISE EXCEPTION 'Une demande est créée « à valider » ; utilisez create_request';
    END IF;
    IF NEW.requester_id <> v_me AND NOT v_staff THEN
      RAISE EXCEPTION 'Vous ne pouvez faire une demande que pour vous-même';
    END IF;
    RETURN NEW;
  END IF;

  -- Un collaborateur ne peut qu'annuler sa propre demande, sans rien changer d'autre
  IF NOT v_staff THEN
    IF OLD.requester_id <> v_me
       OR NEW.status <> 'cancelled' OR OLD.status NOT IN ('requested', 'approved')
       OR (to_jsonb(NEW) - 'status' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updated_at') THEN
      RAISE EXCEPTION 'Vous pouvez seulement annuler votre demande tant qu''elle n''est pas préparée';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.needs_approval IS DISTINCT FROM OLD.needs_approval AND NOT public.app_has('approve') THEN
    RAISE EXCEPTION 'Seul un responsable peut changer l''obligation de validation';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('approved', 'rejected') AND OLD.status = 'requested' AND NOT public.app_has('approve') THEN
      RAISE EXCEPTION 'Seul un responsable peut valider ou refuser une demande';
    END IF;
    IF NEW.status IN ('ready', 'out', 'closed') AND NOT public.app_has('scan') THEN
      RAISE EXCEPTION 'Seul le magasin peut préparer, sortir ou clôturer une demande';
    END IF;
    IF NEW.status = 'requested' AND NOT public.app_has('approve') THEN
      RAISE EXCEPTION 'Seul un responsable peut remettre une demande à valider';
    END IF;
    -- La décision porte le nom de la personne connectée, pas un nom saisi
    IF NEW.status IN ('approved', 'rejected') AND OLD.status = 'requested' THEN
      SELECT first_name || ' ' || last_name INTO v_name FROM public.users WHERE id = v_me;
      NEW.decided_by := v_name;
      NEW.decided_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'requests_guard_trigger' AND tgrelid = 'public.requests'::regclass) THEN
    CREATE TRIGGER requests_guard_trigger
      BEFORE INSERT OR UPDATE ON public.requests
      FOR EACH ROW EXECUTE FUNCTION public.requests_guard();
  END IF;
END $$;

-- create_request : la validation automatique se fait dans la fonction ; elle s'exécute donc
-- avec des droits étendus, après avoir vérifié pour qui la demande est faite
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_request_impl' AND pronamespace = 'public'::regnamespace) THEN
    ALTER FUNCTION public.create_request(uuid, uuid, timestamptz, timestamptz, jsonb, text, text) RENAME TO create_request_impl;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_request(
  p_requester_id uuid, p_depot_id uuid, p_start timestamptz, p_end timestamptz,
  p_items jsonb, p_destination text DEFAULT NULL, p_notes text DEFAULT NULL
)
RETURNS public.requests
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Dans une fonction SECURITY DEFINER, current_user est le propriétaire ; le réglage « role »
  -- garde le rôle de la session (authenticated pour l'app). Console et clé service : pas de contrôle.
  IF current_setting('role', true) = 'authenticated' THEN
    IF public.app_user_id() IS NULL THEN
      RAISE EXCEPTION 'Accès refusé';
    END IF;
    IF p_requester_id IS DISTINCT FROM public.app_user_id()
       AND NOT (public.app_has('scan') OR public.app_has('approve')) THEN
      RAISE EXCEPTION 'Vous ne pouvez faire une demande que pour vous-même';
    END IF;
  END IF;
  RETURN public.create_request_impl(p_requester_id, p_depot_id, p_start, p_end, p_items, p_destination, p_notes);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_request_impl(uuid, uuid, timestamptz, timestamptz, jsonb, text, text) FROM PUBLIC, anon, authenticated;

-- 5. Fonctions internes : droits étendus ------------------------------------------------
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'compute_equipment_stock', 'equipment_apply_stock', 'refresh_equipment_stock', 'refresh_stock_after_change',
    'checkouts_check_availability', 'checkouts_refresh_request', 'checkouts_reject_consumables',
    'consumable_stock_alert', 'consumable_stock_refresh_equipment', 'update_equipment_status_on_maintenance',
    'update_delivery_note_status', 'set_delivery_note_number', 'set_request_number', 'set_article_number',
    'next_article_number', 'sync_equipment_instances_fixed', 'generate_equipment_instances_fixed',
    'refresh_request_status', 'check_request_availability', 'check_vehicle_deadlines',
    -- disponibilités : un collaborateur ne voit pas les demandes des autres, mais elles comptent
    'tool_availability', 'vehicle_unavailability',
    -- recalculs de données dérivées que l'application déclenche pour tout membre
    'update_equipment_availability', 'force_update_overdue_checkouts', 'update_overdue_checkouts',
    'refresh_all_status_views', 'refresh_checkout_status_view', 'refresh_equipment_status_view',
    'generate_image_cache_key', 'validate_image_url', 'update_updated_at_column',
    'refresh_checkout_status_view_trigger', 'refresh_equipment_status_view_trigger'
  ] LOOP
    EXECUTE COALESCE((
      SELECT string_agg(format('ALTER FUNCTION %s SECURITY DEFINER', p.oid::regprocedure), '; ')
      FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f
    ), 'SELECT 1');
  END LOOP;
END $$;

-- 6. Plus aucun accès anonyme -----------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_request_impl(uuid, uuid, timestamptz, timestamptz, jsonb, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_notification_emails(integer) FROM authenticated;
DO $$
BEGIN
  -- Les deux signatures existent selon que la correction e-mail (backlog) est appliquée ou non
  EXECUTE COALESCE((
    SELECT string_agg(format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', p.oid::regprocedure), '; ')
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'mark_notification_email'
  ), 'SELECT 1');
END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_depots TO authenticated, service_role;

-- 7. Règles par table -------------------------------------------------------------------
-- Pour chaque table : lecture, écriture (INSERT/UPDATE), et règles restrictives facultatives
-- propres à INSERT, UPDATE et DELETE (sinon l'écriture s'applique aussi à la suppression).
CREATE OR REPLACE FUNCTION pg_temp.apply_rules(
  p_table text, p_read text, p_write text,
  p_insert text DEFAULT NULL, p_update text DEFAULT NULL, p_delete text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  pol record;
  v_member_policy text;
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);

  FOR pol IN SELECT policyname, roles FROM pg_policies WHERE schemaname = 'public' AND tablename = p_table AND permissive = 'PERMISSIVE' LOOP
    IF 'authenticated' = ANY (pol.roles) AND v_member_policy IS NULL THEN
      v_member_policy := pol.policyname;
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated USING (%s) WITH CHECK (%s)', pol.policyname, p_table, p_read, p_write);
    ELSE
      -- Anciennes politiques anonymes ou en double : neutralisées
      EXECUTE format('ALTER POLICY %I ON public.%I USING (false) WITH CHECK (false)', pol.policyname, p_table);
    END IF;
  END LOOP;

  IF v_member_policy IS NULL THEN
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)', p_table || '_member', p_table, p_read, p_write);
  END IF;

  PERFORM pg_temp.restrictive(p_table, 'insert', 'INSERT', NULL, COALESCE(p_insert, p_write));
  PERFORM pg_temp.restrictive(p_table, 'update', 'UPDATE', COALESCE(p_update, p_write), COALESCE(p_update, p_write));
  PERFORM pg_temp.restrictive(p_table, 'delete', 'DELETE', COALESCE(p_delete, p_write), NULL);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.restrictive(p_table text, p_suffix text, p_cmd text, p_using text, p_check text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_name text := p_table || '_' || p_suffix || '_rule';
  v_clauses text := concat_ws(' ',
    CASE WHEN p_using IS NOT NULL THEN format('USING (%s)', p_using) END,
    CASE WHEN p_check IS NOT NULL THEN format('WITH CHECK (%s)', p_check) END);
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = p_table AND policyname = v_name) THEN
    EXECUTE format('ALTER POLICY %I ON public.%I %s', v_name, p_table, v_clauses);
  ELSE
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s', v_name, p_table, p_cmd, v_clauses);
  END IF;
END;
$$;

DO $$
DECLARE
  member constant text := 'public.app_is_member()';
  staff constant text := '(public.app_has(''view_all'') OR public.app_has(''scan'') OR public.app_has(''approve'') OR public.app_has(''manage_stock''))';
  stock constant text := '(public.app_has(''manage_stock'') OR public.app_has(''settings''))';
  settings constant text := 'public.app_has(''settings'')';
  t text;
BEGIN
  -- Données de référence : lues par tous, modifiées par le stock ou les réglages
  FOREACH t IN ARRAY ARRAY['categories', 'equipment_groups', 'equipment_subgroups', 'suppliers', 'maintenance_types', 'status_configs'] LOOP
    PERFORM pg_temp.apply_rules(t, member, stock);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['departments', 'role_configs', 'system_settings', 'organizations', 'depots'] LOOP
    PERFORM pg_temp.apply_rules(t, member, settings);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['equipment', 'equipment_maintenance', 'catalog_products'] LOOP
    PERFORM pg_temp.apply_rules(t, member, 'public.app_has(''manage_stock'')');
  END LOOP;

  PERFORM pg_temp.apply_rules('equipment_instances', member, '(public.app_has(''manage_stock'') OR public.app_has(''scan''))');

  PERFORM pg_temp.apply_rules('consumable_stock', member,
    '((public.app_has(''manage_stock'') OR public.app_has(''scan'')) AND public.app_depot_ok(depot_id))');
  PERFORM pg_temp.apply_rules('stock_movements', staff,
    '((public.app_has(''manage_stock'') OR public.app_has(''scan'')) AND public.app_depot_ok(depot_id))');

  -- Emprunts : chacun voit les siens, le magasin voit tout
  PERFORM pg_temp.apply_rules('checkouts',
    '(user_id = public.app_user_id() OR public.app_has(''view_all'') OR public.app_has(''scan''))',
    'public.app_has(''scan'')');
  PERFORM pg_temp.apply_rules('delivery_notes',
    '(user_id = public.app_user_id() OR public.app_has(''view_all'') OR public.app_has(''scan''))',
    'public.app_has(''scan'')');

  -- Demandes : le demandeur et le personnel ; le garde requests_guard contrôle les statuts
  PERFORM pg_temp.apply_rules('requests',
    '(requester_id = public.app_user_id() OR public.app_has(''view_all'') OR public.app_has(''approve'') OR public.app_has(''scan''))',
    '(requester_id = public.app_user_id() OR public.app_has(''scan'') OR public.app_has(''approve''))',
    NULL,
    '(requester_id = public.app_user_id() OR ((public.app_has(''scan'') OR public.app_has(''approve'')) AND public.app_depot_ok(depot_id)))',
    settings);
  PERFORM pg_temp.apply_rules('request_items',
    'EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id)',
    '(public.app_has(''scan'') OR public.app_has(''approve''))');

  -- Flotte : la création et la suppression aux gestionnaires, le magasin met à jour km et état
  PERFORM pg_temp.apply_rules('vehicles', member,
    '(public.app_has(''manage_fleet'') OR public.app_has(''scan''))',
    'public.app_has(''manage_fleet'')', NULL, 'public.app_has(''manage_fleet'')');
  PERFORM pg_temp.apply_rules('vehicle_trips',
    '(driver_id = public.app_user_id() OR public.app_has(''scan'') OR public.app_has(''manage_fleet'') OR public.app_has(''view_all''))',
    '(public.app_has(''scan'') OR public.app_has(''manage_fleet''))');

  -- Alertes : créées par les fonctions des membres, lues et traitées par le personnel
  PERFORM pg_temp.apply_rules('notifications', staff, member, member, staff, settings);
  PERFORM pg_temp.apply_rules('notification_recipients', settings, settings);

  -- Personnes : lues par les membres, gérées par manage_people (garde users_guard en plus)
  PERFORM pg_temp.apply_rules('users', member, 'public.app_has(''manage_people'')');
  PERFORM pg_temp.apply_rules('user_depots', member, 'public.app_has(''manage_people'')');
END $$;

-- search_path fixe pour les nouvelles fonctions (comme la migration 00004)
ALTER FUNCTION public.role_permissions(text) SET search_path = public, extensions;
ALTER FUNCTION public.app_user_id() SET search_path = public, extensions;
ALTER FUNCTION public.app_permissions() SET search_path = public, extensions;
ALTER FUNCTION public.app_is_member() SET search_path = public, extensions;
ALTER FUNCTION public.app_has(text) SET search_path = public, extensions;
ALTER FUNCTION public.app_depot_ok(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.whoami() SET search_path = public, extensions;
ALTER FUNCTION public.users_guard() SET search_path = public, extensions;
ALTER FUNCTION public.requests_guard() SET search_path = public, extensions;
ALTER FUNCTION public.create_request(uuid, uuid, timestamptz, timestamptz, jsonb, text, text) SET search_path = public, extensions;
