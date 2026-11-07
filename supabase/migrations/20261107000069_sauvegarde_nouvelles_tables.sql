/*
  PILOTE P14 : les nouvelles tables entrent dans la sauvegarde et la restauration.

  Tables ajoutées à la liste FERMÉE de restore_missing_rows (migration 63) : cp_calendar_days (calendrier de travail, migration 65),
  cp_user_capacity (capacités, migration 67) et cp_baseline_dates (lignes de base, migration 68). Rien d'autre ne change : même texte que la
  migration 63 (administrateur seulement, lignes de SON entreprise seulement, insertion des lignes manquantes sans rien écraser).
  Les colonnes ajoutées aux tables existantes (cp_projects.is_template, cp_items.estimate_hours) voyagent déjà avec leurs lignes.
  Ordre de restauration (côté écran et sauvegarde automatique) : cp_user_capacity après users ; cp_baseline_dates après cp_projects et cp_items.
*/
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
    'cp_comments', 'cp_documents', 'cp_notification_prefs', 'notification_recipients', 'notifications', 'notification_reads',
    'cp_calendar_days', 'cp_user_capacity', 'cp_baseline_dates'
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
