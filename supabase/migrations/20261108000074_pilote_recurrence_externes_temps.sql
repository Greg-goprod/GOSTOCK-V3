/*
  PILOTE P13 : récurrence, intervenants externes sans compte, suivi du temps.

  RÉCURRENCE. cp_repeat_item(élément, fréquence, nombre) crée de 1 à 52 occurrences supplémentaires d'une tâche, d'une sous-tâche ou d'un jalon :
    - fréquence 'weekly' (+7 jours), 'monthly' (même quantième, recalé sur la fin du mois : 31 janvier → 28 février, sans dérive d'un mois à l'autre
      car chaque occurrence se calcule depuis l'ORIGINE), 'yearly' (29 février → 28 février) ; la durée de l'élément est conservée ;
    - chaque occurrence copie nom, description, priorité, estimation, parent, liste à cocher (décochée), personnes assignées, matériel et véhicules,
      intervenants externes ; elle repart à l'état « pas commencé » ; les dépendances ne sont pas copiées ; aucun avis n'est envoyé aux personnes assignées ;
    - cp_items.series_id / series_index relient les occurrences. Une série ne se prolonge qu'à partir de sa DERNIÈRE occurrence ; 200 occurrences au plus.
    Refus : phase (répéter ses tâches une à une), élément qui a des sous-tâches (elles ne seraient pas copiées), élément sans aucune date.
    cp_delete_series_after(élément) supprime les occurrences SUIVANTES jamais touchées (état « pas commencé », aucun temps saisi, aucun message, aucun document) ;
    les autres sont gardées et comptées. Il faut le droit de suppression des projets.
  INTERVENANTS EXTERNES (noms assignables). cp_externals : une personne sans compte (nom, société, note) ; cp_item_externals : son affectation à un élément.
    Ils ne reçoivent aucun avis, n'entrent pas dans la Charge et ne sont pas copiés avec un projet. Droits des projets (lecture ; modification pour tout écrire).
  SUIVI DU TEMPS. cp_time_entries : une ligne = du temps passé sur un élément par UNE personne, un jour. Saisie manuelle (jour + minutes de 1 à 1 440) ou chronomètre
    (cp_timer_start / cp_timer_stop : un seul chronomètre en cours par personne ; en démarrer un autre arrête le premier ; la durée est mesurée par la base).
    - On ne saisit, modifie et supprime que SON propre temps, et seulement sur un projet dont on est de l'équipe (ou avec le droit de modification des projets).
    - On lit son propre temps ; les personnes qui ont le droit de modifier les projets lisent celui de tous (suivi d'un projet).
    - Pas de jour dans le futur. PAS de journal d'audit sur cette table (donnée personnelle : il se lit sans ces droits).
  restore_missing_rows est recréée (texte de la migration 72) avec cp_externals, cp_item_externals et cp_time_entries.
*/

-- 1. Récurrence : lien entre les occurrences ------------------------------------------------------------------------------------
ALTER TABLE public.cp_items ADD COLUMN IF NOT EXISTS series_id uuid;
ALTER TABLE public.cp_items ADD COLUMN IF NOT EXISTS series_index integer;
ALTER TABLE public.cp_items DROP CONSTRAINT IF EXISTS cp_items_series_check;
ALTER TABLE public.cp_items ADD CONSTRAINT cp_items_series_check CHECK ((series_id IS NULL) = (series_index IS NULL) AND (series_index IS NULL OR series_index BETWEEN 1 AND 200));
CREATE INDEX IF NOT EXISTS cp_items_series_idx ON public.cp_items (series_id, series_index) WHERE series_id IS NOT NULL;

-- 2. Intervenants externes -------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cp_externals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  name text NOT NULL CHECK (btrim(name) <> '' AND char_length(name) <= 80),
  company text CHECK (company IS NULL OR char_length(company) <= 80),
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cp_externals_name_key ON public.cp_externals (organization_id, lower(btrim(name)), lower(coalesce(btrim(company), '')));

CREATE TABLE IF NOT EXISTS public.cp_item_externals (
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  item_id uuid NOT NULL REFERENCES public.cp_items(id) ON DELETE CASCADE,
  external_id uuid NOT NULL REFERENCES public.cp_externals(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, external_id)
);
CREATE INDEX IF NOT EXISTS cp_item_externals_external_idx ON public.cp_item_externals (external_id);
CREATE INDEX IF NOT EXISTS cp_item_externals_org_idx ON public.cp_item_externals (organization_id);

CREATE OR REPLACE FUNCTION public.cp_external_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  NEW.name := btrim(NEW.name);
  NEW.company := NULLIF(btrim(NEW.company), '');
  NEW.note := NULLIF(btrim(NEW.note), '');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_external_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS b_cp_external_guard ON public.cp_externals;
CREATE TRIGGER b_cp_external_guard BEFORE INSERT OR UPDATE ON public.cp_externals FOR EACH ROW EXECUTE FUNCTION public.cp_external_guard();

CREATE OR REPLACE FUNCTION public.cp_item_external_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_items i WHERE i.id = NEW.item_id AND i.organization_id = NEW.organization_id) THEN RAISE EXCEPTION 'Élément introuvable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_externals e WHERE e.id = NEW.external_id AND e.organization_id = NEW.organization_id) THEN RAISE EXCEPTION 'Intervenant introuvable'; END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_item_external_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS b_cp_item_external_guard ON public.cp_item_externals;
CREATE TRIGGER b_cp_item_external_guard BEFORE INSERT OR UPDATE ON public.cp_item_externals FOR EACH ROW EXECUTE FUNCTION public.cp_item_external_guard();

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cp_externals', 'cp_item_externals'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON public.%I', t);
    EXECUTE format('CREATE POLICY org_isolation ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (organization_id = (SELECT public.app_org_id())) WITH CHECK (organization_id = (SELECT public.app_org_id()))', t);
    EXECUTE format('DROP POLICY IF EXISTS projects_read ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS projects_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS projects_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS projects_delete ON public.%I', t);
    EXECUTE format('CREATE POLICY projects_read ON public.%I FOR SELECT TO authenticated USING ((SELECT public.org_module_enabled(''cp.projects'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.projects:read''])))', t);
    EXECUTE format('CREATE POLICY projects_insert ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.org_module_enabled(''cp.projects'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.projects:update''])))', t);
    EXECUTE format('CREATE POLICY projects_update ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.org_module_enabled(''cp.projects'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.projects:update'']))) WITH CHECK ((SELECT public.org_module_enabled(''cp.projects'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.projects:update''])))', t);
    EXECUTE format('CREATE POLICY projects_delete ON public.%I FOR DELETE TO authenticated USING ((SELECT public.org_module_enabled(''cp.projects'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.projects:update''])))', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('DROP TRIGGER IF EXISTS a_org_write_guard ON public.%I', t);
    EXECUTE format('CREATE TRIGGER a_org_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.org_write_guard()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_audit_trigger', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', t || '_audit_trigger', t);
  END LOOP;
END $$;

-- 3. Suivi du temps --------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cp_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  item_id uuid NOT NULL REFERENCES public.cp_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT public.app_user_id() REFERENCES public.users(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  minutes integer,
  started_at timestamptz,
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (minutes IS NULL OR (minutes >= 1 AND minutes <= 1440)),
  CHECK (minutes IS NOT NULL OR started_at IS NOT NULL)
);
-- Un seul chronomètre en cours (minutes vides) par personne
CREATE UNIQUE INDEX IF NOT EXISTS cp_time_one_running ON public.cp_time_entries (user_id) WHERE minutes IS NULL;
CREATE INDEX IF NOT EXISTS cp_time_item_idx ON public.cp_time_entries (item_id);
CREATE INDEX IF NOT EXISTS cp_time_user_idx ON public.cp_time_entries (organization_id, user_id, work_date);

-- Peut-on saisir du temps sur cet élément ? l'équipe du projet, ou le droit de modification des projets
CREATE OR REPLACE FUNCTION public.cp_can_log_time(p_item uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (SELECT 1 FROM public.cp_items i WHERE i.id = p_item AND i.organization_id = public.app_org_id()
                 AND (public.rbac_has_any_permission(ARRAY['cp.projects:update'])
                      OR EXISTS (SELECT 1 FROM public.cp_project_members m WHERE m.project_id = i.project_id AND m.user_id = public.app_user_id() AND m.organization_id = i.organization_id)))
$$;
REVOKE ALL ON FUNCTION public.cp_can_log_time(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_can_log_time(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cp_time_entry_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_items i WHERE i.id = NEW.item_id AND i.organization_id = NEW.organization_id) THEN RAISE EXCEPTION 'Élément introuvable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id AND u.organization_id = NEW.organization_id) THEN RAISE EXCEPTION 'Personne introuvable'; END IF;
  IF public.app_user_id() IS NOT NULL AND NEW.user_id <> public.app_user_id() THEN RAISE EXCEPTION 'Tu ne saisis que ton propre temps'; END IF;
  IF NEW.work_date > (now() AT TIME ZONE 'Europe/Zurich')::date THEN RAISE EXCEPTION 'Pas de temps passé dans le futur'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.item_id <> OLD.item_id OR NEW.user_id <> OLD.user_id THEN RAISE EXCEPTION 'Une saisie ne change ni de tâche ni de personne'; END IF;
    NEW.updated_at := now();
  END IF;
  NEW.note := NULLIF(btrim(NEW.note), '');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_time_entry_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS b_cp_time_entry_guard ON public.cp_time_entries;
CREATE TRIGGER b_cp_time_entry_guard BEFORE INSERT OR UPDATE ON public.cp_time_entries FOR EACH ROW EXECUTE FUNCTION public.cp_time_entry_guard();

ALTER TABLE public.cp_time_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON public.cp_time_entries;
CREATE POLICY org_isolation ON public.cp_time_entries AS RESTRICTIVE FOR ALL TO authenticated USING (organization_id = (SELECT public.app_org_id())) WITH CHECK (organization_id = (SELECT public.app_org_id()));
DROP POLICY IF EXISTS time_read ON public.cp_time_entries;
DROP POLICY IF EXISTS time_insert ON public.cp_time_entries;
DROP POLICY IF EXISTS time_update ON public.cp_time_entries;
DROP POLICY IF EXISTS time_delete ON public.cp_time_entries;
CREATE POLICY time_read ON public.cp_time_entries FOR SELECT TO authenticated
  USING ((SELECT public.org_module_enabled('cp.projects')) AND (user_id = (SELECT public.app_user_id()) OR (SELECT public.rbac_has_any_permission(ARRAY['cp.projects:update']))));
CREATE POLICY time_insert ON public.cp_time_entries FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.org_module_enabled('cp.projects')) AND user_id = (SELECT public.app_user_id()) AND (SELECT public.cp_can_log_time(item_id)));
CREATE POLICY time_update ON public.cp_time_entries FOR UPDATE TO authenticated
  USING ((SELECT public.org_module_enabled('cp.projects')) AND user_id = (SELECT public.app_user_id()))
  WITH CHECK ((SELECT public.org_module_enabled('cp.projects')) AND user_id = (SELECT public.app_user_id()));
CREATE POLICY time_delete ON public.cp_time_entries FOR DELETE TO authenticated
  USING ((SELECT public.org_module_enabled('cp.projects')) AND user_id = (SELECT public.app_user_id()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cp_time_entries TO authenticated, service_role;
REVOKE ALL ON public.cp_time_entries FROM anon;
DROP TRIGGER IF EXISTS a_org_write_guard ON public.cp_time_entries;
CREATE TRIGGER a_org_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.cp_time_entries FOR EACH ROW EXECUTE FUNCTION public.org_write_guard();
-- Volontairement PAS de journal d'audit (voir l'en-tête) ; on retire un éventuel déclencheur d'essai
DROP TRIGGER IF EXISTS cp_time_entries_audit_trigger ON public.cp_time_entries;

-- Chronomètre : démarrer (arrête celui qui tournait, rend l'identifiant) et arrêter (rend les minutes enregistrées, vide s'il n'y en avait pas)
CREATE OR REPLACE FUNCTION public.cp_timer_stop()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_minutes integer;
BEGIN
  UPDATE public.cp_time_entries SET minutes = LEAST(1440, GREATEST(1, round(extract(epoch FROM now() - started_at) / 60)::integer))
  WHERE user_id = public.app_user_id() AND minutes IS NULL
  RETURNING minutes INTO v_minutes;
  RETURN v_minutes;
END;
$$;
REVOKE ALL ON FUNCTION public.cp_timer_stop() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_timer_stop() TO authenticated;

CREATE OR REPLACE FUNCTION public.cp_timer_start(p_item uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT t.id INTO v_id FROM public.cp_time_entries t WHERE t.user_id = public.app_user_id() AND t.minutes IS NULL AND t.item_id = p_item;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;   -- déjà en cours sur cette tâche
  PERFORM public.cp_timer_stop();
  INSERT INTO public.cp_time_entries (item_id, work_date, started_at) VALUES (p_item, (now() AT TIME ZONE 'Europe/Zurich')::date, now()) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cp_timer_start(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_timer_start(uuid) TO authenticated;

-- 4. Répéter un élément ----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cp_shift_date(p_day date, p_freq text, p_k integer)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_freq
    WHEN 'weekly' THEN p_day + 7 * p_k
    WHEN 'monthly' THEN (p_day + make_interval(months => p_k))::date
    WHEN 'yearly' THEN (p_day + make_interval(years => p_k))::date
  END
$$;

CREATE OR REPLACE FUNCTION public.cp_repeat_item(p_item uuid, p_freq text, p_count integer)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_src public.cp_items%ROWTYPE;
  v_series uuid;
  v_first integer;
  v_max integer;
  v_status uuid;
  v_new uuid;
  v_start date;
  v_end date;
  v_k integer;
  v_prev text := current_setting('gomat.cp_copy', true);
BEGIN
  IF p_freq IS NULL OR p_freq NOT IN ('weekly', 'monthly', 'yearly') THEN RAISE EXCEPTION 'Fréquence inconnue : chaque semaine, chaque mois ou chaque année'; END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 52 THEN RAISE EXCEPTION 'Répète de 1 à 52 fois'; END IF;
  SELECT * INTO v_src FROM public.cp_items WHERE id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Élément introuvable'; END IF;
  IF v_src.kind = 'phase' THEN RAISE EXCEPTION 'Une phase ne se répète pas : répète ses tâches une à une'; END IF;
  IF EXISTS (SELECT 1 FROM public.cp_items c WHERE c.parent_id = p_item) THEN RAISE EXCEPTION 'Cet élément a des sous-tâches, qui ne seraient pas copiées : répète-les ou duplique le projet'; END IF;
  IF v_src.starts_on IS NULL AND v_src.ends_on IS NULL THEN RAISE EXCEPTION 'Donne d''abord une date à cet élément'; END IF;
  IF v_src.series_id IS NOT NULL THEN
    SELECT max(i.series_index) INTO v_max FROM public.cp_items i WHERE i.series_id = v_src.series_id;
    IF v_src.series_index < v_max THEN RAISE EXCEPTION 'Cet élément fait déjà partie d''une série : répète sa dernière occurrence pour la prolonger'; END IF;
    v_series := v_src.series_id; v_first := v_max;
  ELSE
    v_series := gen_random_uuid(); v_first := 1;
  END IF;
  IF v_first + p_count > 200 THEN RAISE EXCEPTION 'Une série compte 200 occurrences au plus'; END IF;
  SELECT s.id INTO v_status FROM public.cp_statuses s WHERE s.is_system AND s.family = 'not_started' LIMIT 1;
  IF v_src.series_id IS NULL THEN UPDATE public.cp_items SET series_id = v_series, series_index = 1 WHERE id = p_item; END IF;

  PERFORM set_config('gomat.cp_copy', 'on', true);
  FOR v_k IN 1..p_count LOOP
    v_start := CASE WHEN v_src.starts_on IS NOT NULL THEN public.cp_shift_date(v_src.starts_on, p_freq, v_k) END;
    v_end := CASE WHEN v_src.ends_on IS NULL THEN NULL
                  WHEN v_src.starts_on IS NOT NULL THEN v_start + (v_src.ends_on - v_src.starts_on)
                  ELSE public.cp_shift_date(v_src.ends_on, p_freq, v_k) END;
    INSERT INTO public.cp_items (project_id, parent_id, kind, name, description, status_id, priority, starts_on, ends_on, position, estimate_hours, series_id, series_index)
    VALUES (v_src.project_id, v_src.parent_id, v_src.kind, v_src.name, v_src.description, v_status, v_src.priority, v_start, v_end, v_src.position, v_src.estimate_hours, v_series, v_first + v_k)
    RETURNING id INTO v_new;
    INSERT INTO public.cp_item_checks (item_id, label, done, position) SELECT v_new, c.label, false, c.position FROM public.cp_item_checks c WHERE c.item_id = p_item;
    INSERT INTO public.cp_item_members (item_id, user_id) SELECT v_new, m.user_id FROM public.cp_item_members m WHERE m.item_id = p_item;
    INSERT INTO public.cp_item_resources (item_id, kind, equipment_id, vehicle_id, quantity, note) SELECT v_new, r.kind, r.equipment_id, r.vehicle_id, r.quantity, r.note FROM public.cp_item_resources r WHERE r.item_id = p_item;
    INSERT INTO public.cp_item_externals (item_id, external_id) SELECT v_new, e.external_id FROM public.cp_item_externals e WHERE e.item_id = p_item;
  END LOOP;
  PERFORM set_config('gomat.cp_copy', coalesce(v_prev, ''), true);
  RETURN p_count;
END;
$$;
REVOKE ALL ON FUNCTION public.cp_repeat_item(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_repeat_item(uuid, text, integer) TO authenticated;

-- Une occurrence est « intacte » : pas commencée, sans temps saisi, sans message, sans document (lue avec les droits de la base : même ce que la personne ne voit pas compte)
CREATE OR REPLACE FUNCTION public.cp_item_untouched(p_item uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (SELECT 1 FROM public.cp_items i JOIN public.cp_statuses s ON s.id = i.status_id
                 WHERE i.id = p_item AND i.organization_id = public.app_org_id() AND s.family = 'not_started')
     AND NOT EXISTS (SELECT 1 FROM public.cp_time_entries t WHERE t.item_id = p_item)
     AND NOT EXISTS (SELECT 1 FROM public.cp_comments c WHERE c.item_id = p_item)
     AND NOT EXISTS (SELECT 1 FROM public.cp_documents d WHERE d.item_id = p_item)
$$;
REVOKE ALL ON FUNCTION public.cp_item_untouched(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cp_delete_series_after(p_item uuid)
RETURNS TABLE (deleted integer, kept integer)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_series uuid;
  v_index integer;
  v_total integer;
  v_deleted integer;
BEGIN
  SELECT i.series_id, i.series_index INTO v_series, v_index FROM public.cp_items i WHERE i.id = p_item;
  IF v_series IS NULL THEN RAISE EXCEPTION 'Cet élément ne fait pas partie d''une série'; END IF;
  SELECT count(*) INTO v_total FROM public.cp_items i WHERE i.series_id = v_series AND i.series_index > v_index;
  WITH gone AS (
    DELETE FROM public.cp_items i
    WHERE i.series_id = v_series AND i.series_index > v_index AND public.cp_item_untouched(i.id)
    RETURNING 1
  ) SELECT count(*) INTO v_deleted FROM gone;
  RETURN QUERY SELECT v_deleted, v_total - v_deleted;
END;
$$;
REVOKE ALL ON FUNCTION public.cp_delete_series_after(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_delete_series_after(uuid) TO authenticated;
-- cp_item_untouched est appelée par cp_delete_series_after (droits de la personne) : on lui rend l'exécution
GRANT EXECUTE ON FUNCTION public.cp_item_untouched(uuid) TO authenticated;

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
    'cp_calendar_days', 'cp_user_capacity', 'cp_baseline_dates', 'cp_budget_lines', 'cp_user_rates', 'cp_item_resources', 'cp_externals', 'cp_item_externals', 'cp_time_entries'
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
