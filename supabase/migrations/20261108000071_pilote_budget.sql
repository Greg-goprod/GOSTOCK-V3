/*
  PILOTE P7 : budget par projet et taux horaires.

  - cp_budget_lines : lignes de budget d'un projet, en francs suisses (CHF) : catégorie libre (matériel, prestataires, déplacements…),
    PRÉVU, ENGAGÉ (commandé, pas encore payé) et RÉEL (payé). Saisie à la main ; aucun lien automatique avec les commandes fournisseurs.
    Projet supprimé = lignes supprimées. Montants de 0 à 99 999 999,99 (pas de montant négatif : une note de crédit se déduit du réel à la main).
  - cp_user_rates : taux horaire d'une personne (CHF/h, 0 à 9 999,99). Sert à valoriser les heures estimées de la Charge (calcul à l'écran).
  - Droits SÉPARÉS de ceux des projets, car un budget est sensible : « cp.budget:read / create / update / delete » (+ module cp.projects activé).
    Par défaut : administrateur ET responsable (les quatre actions) ; magasinier et collaborateur : rien. Rôles personnalisés : à accorder.
    Les entreprises existantes reçoivent ces droits par défaut (reprise en bas).
  - Même isolation par entreprise et mêmes gardes que les autres tables PILOTE. PAS de journal d'audit sur ces deux tables (voir plus bas : il ferait fuiter les montants).
  - restore_missing_rows est recréée à partir du texte exact de la migration 69, avec ces deux tables en plus dans la liste FERMÉE.
  Ordre de restauration (écran et sauvegarde automatique) : cp_user_rates après users ; cp_budget_lines après cp_projects.
*/
CREATE TABLE IF NOT EXISTS public.cp_budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  project_id uuid NOT NULL REFERENCES public.cp_projects(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (btrim(category) <> '' AND char_length(category) <= 80),
  planned numeric(12,2) NOT NULL DEFAULT 0 CHECK (planned >= 0 AND planned <= 99999999.99),
  committed numeric(12,2) NOT NULL DEFAULT 0 CHECK (committed >= 0 AND committed <= 99999999.99),
  actual numeric(12,2) NOT NULL DEFAULT 0 CHECK (actual >= 0 AND actual <= 99999999.99),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cp_budget_lines_project_idx ON public.cp_budget_lines (organization_id, project_id);

CREATE TABLE IF NOT EXISTS public.cp_user_rates (
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hourly_rate numeric(7,2) NOT NULL CHECK (hourly_rate >= 0 AND hourly_rate <= 9999.99),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE OR REPLACE FUNCTION public.cp_budget_line_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_projects p WHERE p.id = NEW.project_id AND p.organization_id = NEW.organization_id) THEN RAISE EXCEPTION 'Projet introuvable'; END IF;
  NEW.category := btrim(NEW.category);
  IF TG_OP = 'UPDATE' THEN
    IF NEW.project_id <> OLD.project_id THEN RAISE EXCEPTION 'Une ligne de budget ne change pas de projet'; END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_budget_line_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS b_cp_budget_line_guard ON public.cp_budget_lines;
CREATE TRIGGER b_cp_budget_line_guard BEFORE INSERT OR UPDATE ON public.cp_budget_lines FOR EACH ROW EXECUTE FUNCTION public.cp_budget_line_guard();

CREATE OR REPLACE FUNCTION public.cp_user_rate_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id AND u.organization_id = NEW.organization_id) THEN RAISE EXCEPTION 'Personne introuvable'; END IF;
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_user_rate_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS b_cp_user_rate_guard ON public.cp_user_rates;
CREATE TRIGGER b_cp_user_rate_guard BEFORE INSERT OR UPDATE ON public.cp_user_rates FOR EACH ROW EXECUTE FUNCTION public.cp_user_rate_guard();

-- Droits par défaut (administrateur et responsable) ; les rôles personnalisés les reçoivent à la main
INSERT INTO public.rbac_default_permissions (system_key, permission_key) VALUES
  ('admin', 'cp.budget:read'), ('admin', 'cp.budget:create'), ('admin', 'cp.budget:update'), ('admin', 'cp.budget:delete'),
  ('manager', 'cp.budget:read'), ('manager', 'cp.budget:create'), ('manager', 'cp.budget:update'), ('manager', 'cp.budget:delete')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cp_budget_lines', 'cp_user_rates'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON public.%I', t);
    EXECUTE format('CREATE POLICY org_isolation ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (organization_id = (SELECT public.app_org_id())) WITH CHECK (organization_id = (SELECT public.app_org_id()))', t);
    EXECUTE format('DROP POLICY IF EXISTS budget_read ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS budget_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS budget_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS budget_delete ON public.%I', t);
    EXECUTE format('CREATE POLICY budget_read ON public.%I FOR SELECT TO authenticated USING ((SELECT public.org_module_enabled(''cp.projects'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.budget:read''])))', t);
    EXECUTE format('CREATE POLICY budget_insert ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.org_module_enabled(''cp.projects'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.budget:create''])))', t);
    EXECUTE format('CREATE POLICY budget_update ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.org_module_enabled(''cp.projects'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.budget:update'']))) WITH CHECK ((SELECT public.org_module_enabled(''cp.projects'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.budget:update''])))', t);
    EXECUTE format('CREATE POLICY budget_delete ON public.%I FOR DELETE TO authenticated USING ((SELECT public.org_module_enabled(''cp.projects'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.budget:delete''])))', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('DROP TRIGGER IF EXISTS a_org_write_guard ON public.%I', t);
    EXECUTE format('CREATE TRIGGER a_org_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.org_write_guard()', t);
    -- Volontairement PAS de journal d'audit : il recopie les champs modifiés (montants, taux horaires) et se lit avec les droits « approuver » ou
    -- « paramètres », sans le droit cp.budget. L'ajouter ferait fuiter ces chiffres. On retire aussi un éventuel déclencheur laissé par un essai.
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_audit_trigger', t);
  END LOOP;
END $$;

-- Les entreprises existantes reçoivent les droits par défaut
DO $$
DECLARE
  o record;
BEGIN
  PERFORM set_config('app.org_guard_off', 'on', true);
  FOR o IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_rbac_roles(o.id);
  END LOOP;
END $$;

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
    'cp_calendar_days', 'cp_user_capacity', 'cp_baseline_dates', 'cp_budget_lines', 'cp_user_rates'
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
