/*
  Sécurité (revue de la pull request, 2026-11-05) : trois correctifs vérifiés sur GO-MAT avant d'être écrits.

  1. restore_missing_rows : la fonction s'exécute avec les droits du propriétaire (elle ignore les règles d'accès) et n'excluait que deux tables.
     Un administrateur d'entreprise pouvait donc s'inscrire dans owner_admins (administrateur de la plateforme), activer des modules payants
     (organization_modules), écrire dans la corbeille des fichiers (cp_document_trash : l'effacement d'un fichier d'une autre entreprise) ou insérer des lignes
     dans une AUTRE entreprise. Correctif : liste FERMÉE de tables (celles de la sauvegarde, sans « organizations » ni « audit_log »), et les lignes
     doivent porter l'identifiant de l'entreprise de la personne ; pour « users », le lien avec un compte de connexion est retiré (il se refait à la
     première connexion, par l'e-mail). Un appel sans personne connectée (propriétaire, clé de service) garde son comportement.
  2. users_guard : « rbac_role_id » (le rôle de droits fins PILOTE / planning) n'était pas protégé ; une personne qui a le droit « gérer les personnes » pouvait
     s'attribuer le rôle Administrateur sans être administrateur. Correctif : seul un administrateur modifie ce champ directement. Les changements de
     « role » continuent de le mettre à jour par le déclencheur de synchronisation. Aucun écran n'écrit ce champ.
  3. Fonctions « check_* » (échéances et rappels) : exécutables par toute personne connectée, avec les droits du propriétaire. Elles créent des avis dans
     chaque entreprise à partir de ses propres données (pas de contenu choisi par l'appelant) mais n'ont pas à être déclenchées par n'importe qui. La tâche
     planifiée (clé de service) les appelle déjà toutes les 5 minutes. Correctif : réservées à la clé de service ; l'application ne les appelle plus.
*/

-- 1. Restauration : liste fermée de tables, lignes de SON entreprise seulement --------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_missing_rows(p_table text, p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_allowed text[] := ARRAY[
    'rbac_roles', 'rbac_role_permissions', 'system_settings', 'depots', 'storage_bins', 'departments',
    'role_configs', 'status_configs', 'users', 'user_depots', 'trainings', 'user_trainings',
    'ppe_types', 'ppe_issues', 'user_ppe_sizes', 'categories', 'equipment_groups', 'equipment_subgroups',
    'suppliers', 'catalog_products', 'sites', 'rentals', 'equipment', 'equipment_instances',
    'equipment_accessories', 'consumable_stock', 'stock_movements', 'kits', 'kit_items', 'requests',
    'request_items', 'request_templates', 'delivery_notes', 'checkouts', 'return_checks', 'vehicles',
    'vehicle_trips', 'fuel_entries', 'maintenance_types', 'equipment_maintenance', 'maintenance_plans', 'maintenance_plan_runs',
    'repair_orders', 'incidents', 'inventory_counts', 'inventory_count_lines', 'purchase_orders', 'purchase_order_lines',
    'transfers', 'transfer_lines', 'rental_inspections', 'cp_contractors', 'cp_site_config', 'cp_site_blocked_days',
    'cp_site_zones', 'cp_site_phases', 'cp_site_teams', 'cp_site_interventions', 'cp_site_intervention_needs', 'cp_statuses',
    'cp_projects', 'cp_project_members', 'cp_items', 'cp_item_members', 'cp_item_checks', 'cp_item_links',
    'cp_comments', 'cp_documents', 'cp_notification_prefs', 'notification_recipients', 'notifications', 'notification_reads'
  ];
  v_select text;
  v_key text;
  v_count integer;
  v_org uuid;
  v_where text[] := ARRAY[]::text[];
BEGIN
  IF current_setting('role', true) = 'authenticated' THEN
    IF NOT public.app_has('settings') THEN
      RAISE EXCEPTION 'Accès refusé';
    END IF;
    v_org := public.app_org_id();
    IF v_org IS NULL THEN
      RAISE EXCEPTION 'Accès refusé';
    END IF;
  END IF;
  IF NOT (p_table = ANY (v_allowed)) OR NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = p_table
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = p_table AND column_name = 'organization_id'
  ) THEN
    RAISE EXCEPTION 'Table inconnue : %', p_table;
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN 0;
  END IF;
  -- Colonnes copiées ; le lien d'une fiche « users » avec un compte de connexion n'est jamais restauré (il se refait par l'e-mail à la première connexion)
  SELECT string_agg(CASE WHEN p_table = 'users' AND a.attname = 'auth_user_id' THEN 'NULL::uuid' ELSE quote_ident(a.attname) END, ', ' ORDER BY a.attnum) INTO v_select
  FROM pg_attribute a
  WHERE a.attrelid = format('public.%I', p_table)::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '';
  SELECT string_agg(format('x.%1$I = r.%1$I', a.attname), ' AND ') INTO v_key
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
  WHERE i.indrelid = format('public.%I', p_table)::regclass AND i.indisprimary;
  IF v_org IS NOT NULL THEN
    v_where := v_where || format('r.organization_id = %L::uuid', v_org);
  END IF;
  IF v_key IS NOT NULL THEN
    v_where := v_where || format('NOT EXISTS (SELECT 1 FROM public.%I x WHERE %s)', p_table, v_key);
  END IF;

  PERFORM set_config('gomat.restoring', 'on', true);
  EXECUTE format(
    'INSERT INTO public.%1$I (%2$s) SELECT %3$s FROM jsonb_populate_recordset(NULL::public.%1$I, $1) r %4$s ON CONFLICT DO NOTHING',
    p_table,
    (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid = format('public.%I', p_table)::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''),
    v_select,
    CASE WHEN cardinality(v_where) = 0 THEN '' ELSE 'WHERE ' || array_to_string(v_where, ' AND ') END
  ) USING p_rows;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config('gomat.restoring', 'off', true);
  RETURN v_count;
END;
$$;

-- 2. users_guard : le rôle de droits fins ne se change pas directement sans être administrateur ------------------------------
CREATE OR REPLACE FUNCTION public.users_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
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

    -- Le rôle de droits fins (PILOTE, planning) : seul un administrateur le change directement (sinon : s'attribuer le rôle Administrateur)
    IF TG_OP = 'UPDATE' AND NEW.rbac_role_id IS DISTINCT FROM OLD.rbac_role_id AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Seul un administrateur peut changer le rôle de droits d''une personne';
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

-- 3. Fonctions de rappels et d'échéances : réservées à la clé de service (la tâche planifiée les appelle toutes les 5 minutes) -----
REVOKE EXECUTE ON FUNCTION
  public.check_vehicle_deadlines(integer), public.check_maintenance_due(), public.check_due_reminders(), public.check_monthly_report(),
  public.check_training_rental_deadlines(), public.check_people_deadlines(), public.check_equipment_deadlines(), public.check_backup_reminder()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.check_vehicle_deadlines(integer), public.check_maintenance_due(), public.check_due_reminders(), public.check_monthly_report(),
  public.check_training_rental_deadlines(), public.check_people_deadlines(), public.check_equipment_deadlines(), public.check_backup_reminder()
TO service_role;
