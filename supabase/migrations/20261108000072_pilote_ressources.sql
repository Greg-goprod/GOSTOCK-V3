/*
  PILOTE P8 : matériel et véhicules rattachés aux tâches, avec avertissement de disponibilité.

  - cp_item_resources : un article de matériel (avec une quantité) OU un véhicule rattaché à un élément de projet. Modèle SÉPARÉ du « matériel
    nécessaire » du planning de chantier. Élément supprimé, article supprimé ou véhicule supprimé = ligne supprimée. Mêmes droits que les projets :
    lecture « cp.projects:read » ; ajout, modification et retrait demandent « cp.projects:update » (rattacher du matériel modifie la tâche).
  - cp_resource_issues(élément) : les ressources qui POSENT PROBLÈME, jamais plus. Elle AVERTIT, ne bloque rien et NE RÉSERVE RIEN dans Logistique.
      * Période d'un élément : de son premier jour à la fin de son dernier jour (heure de Zurich) ; sans aucune date, rien n'est vérifié.
      * Matériel : quantité libre selon Logistique (tool_availability : demandes validées, emprunts en cours, maintenance) MOINS ce que d'AUTRES
        éléments PILOTE se réservent sur des jours qui se chevauchent. Manque = quantité demandée supérieure à ce qui reste.
      * Véhicule : raison donnée par vehicle_unavailability (en maintenance, expertise ou service échus, déjà réservé) ou autre élément PILOTE qui
        l'utilise sur des jours qui se chevauchent (chacun des deux est alors signalé).
      * Ne comptent pas : éléments terminés ou annulés, éléments d'un modèle, éléments sans date.
    Les fonctions de Logistique s'exécutent avec les droits de la personne : ce qu'elle ne peut pas lire de Logistique n'est pas compté.
  - cp_duplicate_project recréée (texte de la migration 67) pour copier aussi les ressources : dupliquer un projet, l'enregistrer comme modèle ou
    en créer un depuis un modèle garde son matériel et ses véhicules.
  - restore_missing_rows recréée (texte de la migration 71) avec cp_item_resources dans la liste FERMÉE. Ordre de restauration : après cp_items.
*/
CREATE TABLE IF NOT EXISTS public.cp_item_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  item_id uuid NOT NULL REFERENCES public.cp_items(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('equipment', 'vehicle')),
  equipment_id uuid REFERENCES public.equipment(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 9999),
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'equipment') = (equipment_id IS NOT NULL)),
  CHECK ((kind = 'vehicle') = (vehicle_id IS NOT NULL)),
  CHECK (kind <> 'vehicle' OR quantity = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS cp_item_resources_equipment_key ON public.cp_item_resources (item_id, equipment_id) WHERE equipment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cp_item_resources_vehicle_key ON public.cp_item_resources (item_id, vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cp_item_resources_equipment_idx ON public.cp_item_resources (equipment_id) WHERE equipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cp_item_resources_vehicle_idx ON public.cp_item_resources (vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cp_item_resources_org_idx ON public.cp_item_resources (organization_id, item_id);

-- Un rattachement ne concerne qu'un élément, un article et un véhicule de SON entreprise (les clés étrangères seules ne le garantissent pas)
CREATE OR REPLACE FUNCTION public.cp_item_resource_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_items i WHERE i.id = NEW.item_id AND i.organization_id = NEW.organization_id) THEN RAISE EXCEPTION 'Élément introuvable'; END IF;
  IF NEW.equipment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.equipment e WHERE e.id = NEW.equipment_id AND e.organization_id = NEW.organization_id) THEN RAISE EXCEPTION 'Article introuvable'; END IF;
  IF NEW.vehicle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = NEW.vehicle_id AND v.organization_id = NEW.organization_id) THEN RAISE EXCEPTION 'Véhicule introuvable'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.item_id <> OLD.item_id OR NEW.kind <> OLD.kind OR NEW.equipment_id IS DISTINCT FROM OLD.equipment_id OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id) THEN
    RAISE EXCEPTION 'Seuls la quantité et la note d''un rattachement se modifient';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_item_resource_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS b_cp_item_resource_guard ON public.cp_item_resources;
CREATE TRIGGER b_cp_item_resource_guard BEFORE INSERT OR UPDATE ON public.cp_item_resources FOR EACH ROW EXECUTE FUNCTION public.cp_item_resource_guard();

DO $$
DECLARE
  t text := 'cp_item_resources';
BEGIN
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
END $$;

-- Ressources qui posent problème (voir l'en-tête). p_item : se limiter à un élément (les autres éléments comptent quand même comme concurrents).
CREATE OR REPLACE FUNCTION public.cp_resource_issues(p_item uuid DEFAULT NULL)
RETURNS TABLE (resource_id uuid, item_id uuid, kind text, ref_id uuid, name text, needed integer, available integer, reason text)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  WITH live AS (
    -- Tout ce qui est rattaché à un élément daté, pas terminé ni annulé, d'un vrai projet (pas un modèle)
    SELECT r.id AS rid, r.item_id AS iid, r.kind, r.equipment_id, r.vehicle_id, r.quantity, i.name AS item_name,
           COALESCE(i.starts_on, i.ends_on) AS d1, GREATEST(COALESCE(i.ends_on, i.starts_on), COALESCE(i.starts_on, i.ends_on)) AS d2
    FROM public.cp_item_resources r
    JOIN public.cp_items i ON i.id = r.item_id
    JOIN public.cp_projects p ON p.id = i.project_id AND NOT p.is_template
    JOIN public.cp_statuses s ON s.id = i.status_id AND s.family NOT IN ('done', 'cancelled')
    WHERE COALESCE(i.starts_on, i.ends_on) IS NOT NULL
  ), calc AS (
    SELECT l.*,
           (l.d1::timestamp AT TIME ZONE 'Europe/Zurich') AS t1, ((l.d2 + 1)::timestamp AT TIME ZONE 'Europe/Zurich') AS t2,
           COALESCE((SELECT sum(o.quantity) FROM live o
                     WHERE o.kind = 'equipment' AND o.equipment_id = l.equipment_id AND o.iid <> l.iid
                       AND o.d1 <= l.d2 AND o.d2 >= l.d1), 0)::integer AS others,
           (SELECT o.item_name || ' (' || to_char(o.d1, 'DD.MM') || ' → ' || to_char(o.d2, 'DD.MM') || ')' FROM live o
             WHERE o.kind = 'vehicle' AND o.vehicle_id = l.vehicle_id AND o.iid <> l.iid AND o.d1 <= l.d2 AND o.d2 >= l.d1
             ORDER BY o.d1, o.iid LIMIT 1) AS vehicle_rival
    FROM live l
    WHERE p_item IS NULL OR l.iid = p_item
  ), eq AS (
    SELECT c.rid, c.iid, 'equipment'::text AS kind, c.equipment_id AS ref, e.name::text AS nm, c.quantity AS needed,
           GREATEST(public.tool_availability(c.equipment_id, c.t1, c.t2) - c.others, 0) AS avail
    FROM calc c JOIN public.equipment e ON e.id = c.equipment_id
    WHERE c.kind = 'equipment'
  ), ve AS (
    SELECT c.rid, c.iid, 'vehicle'::text AS kind, c.vehicle_id AS ref, v.name::text AS nm, 1 AS needed, 0 AS avail,
           COALESCE(public.vehicle_unavailability(c.vehicle_id, c.t1, c.t2),
                    CASE WHEN c.vehicle_rival IS NOT NULL THEN v.name || ' est déjà prévu pour « ' || c.vehicle_rival || ' »' END) AS why
    FROM calc c JOIN public.vehicles v ON v.id = c.vehicle_id
    WHERE c.kind = 'vehicle'
  )
  SELECT eq.rid, eq.iid, eq.kind, eq.ref, eq.nm, eq.needed, eq.avail, NULL::text FROM eq WHERE eq.needed > eq.avail
  UNION ALL
  SELECT ve.rid, ve.iid, ve.kind, ve.ref, ve.nm, ve.needed, ve.avail, ve.why FROM ve WHERE ve.why IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.cp_resource_issues(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_resource_issues(uuid) TO authenticated;

-- La copie d'un projet garde aussi le matériel et les véhicules (remplace la version de la migration 67)
CREATE OR REPLACE FUNCTION public.cp_duplicate_project(
  p_project uuid, p_name text, p_new_start date DEFAULT NULL, p_copy_team boolean DEFAULT true, p_copy_assignments boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_src public.cp_projects%ROWTYPE;
  v_name text := btrim(coalesce(p_name, ''));
  v_status uuid;
  v_ref date;
  v_delta integer := 0;
  v_new uuid;
  v_old uuid[];
  v_map uuid[];
  v_depth integer[];
  v_max integer;
  v_d integer;
  v_prev text := current_setting('gomat.cp_copy', true);
BEGIN
  IF v_name = '' THEN RAISE EXCEPTION 'Donne un nom à la copie'; END IF;
  IF p_copy_assignments AND NOT p_copy_team THEN RAISE EXCEPTION 'Les assignations ne se copient qu''avec l''équipe'; END IF;
  SELECT * INTO v_src FROM public.cp_projects WHERE id = p_project;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projet introuvable'; END IF;
  SELECT s.id INTO v_status FROM public.cp_statuses s WHERE s.is_system AND s.family = 'not_started' LIMIT 1;

  -- Décalage : écart entre le début actuel (celui du projet, sinon le plus ancien de ses éléments) et le nouveau début
  v_ref := coalesce(v_src.starts_on, (SELECT min(i.starts_on) FROM public.cp_items i WHERE i.project_id = p_project));
  IF p_new_start IS NOT NULL AND v_ref IS NOT NULL THEN v_delta := p_new_start - v_ref; END IF;

  -- Plan de copie : ancien identifiant → nouvel identifiant, et profondeur dans l'arborescence (ordre total : les trois tableaux restent alignés)
  WITH RECURSIVE t AS (
    SELECT i.id, 0 AS d FROM public.cp_items i WHERE i.project_id = p_project AND i.parent_id IS NULL
    UNION ALL
    SELECT c.id, t.d + 1 FROM public.cp_items c JOIN t ON c.parent_id = t.id
  ), numbered AS (SELECT id, d, gen_random_uuid() AS new_id FROM t)
  SELECT coalesce(array_agg(id ORDER BY d, id), '{}'), coalesce(array_agg(new_id ORDER BY d, id), '{}'), coalesce(array_agg(d ORDER BY d, id), '{}'), coalesce(max(d), -1)
    INTO v_old, v_map, v_depth, v_max FROM numbered;

  PERFORM set_config('gomat.cp_copy', 'on', true);

  INSERT INTO public.cp_projects (name, type, description, status_id, priority, color, starts_on, ends_on, link_mode, link_skip_weekends)
  VALUES (v_name, v_src.type, v_src.description, v_status, v_src.priority, v_src.color, v_src.starts_on + v_delta, v_src.ends_on + v_delta, v_src.link_mode, v_src.link_skip_weekends)
  RETURNING id INTO v_new;

  -- Éléments, un niveau à la fois (un parent existe avant ses enfants)
  FOR v_d IN 0..v_max LOOP
    INSERT INTO public.cp_items (id, project_id, parent_id, kind, name, description, status_id, priority, starts_on, ends_on, position, estimate_hours)
    SELECT m.new_id, v_new, pm.new_id, s.kind, s.name, s.description, v_status, s.priority, s.starts_on + v_delta, s.ends_on + v_delta, s.position, s.estimate_hours
    FROM public.cp_items s
    JOIN unnest(v_old, v_map, v_depth) AS m(old_id, new_id, d) ON m.old_id = s.id AND m.d = v_d
    LEFT JOIN unnest(v_old, v_map) AS pm(old_id, new_id) ON pm.old_id = s.parent_id;
  END LOOP;

  IF v_max >= 0 THEN
    INSERT INTO public.cp_item_checks (item_id, label, done, position)
    SELECT m.new_id, c.label, false, c.position
    FROM public.cp_item_checks c JOIN unnest(v_old, v_map) AS m(old_id, new_id) ON m.old_id = c.item_id;

    INSERT INTO public.cp_item_links (predecessor_id, successor_id)
    SELECT mp.new_id, ms.new_id
    FROM public.cp_item_links l
    JOIN unnest(v_old, v_map) AS mp(old_id, new_id) ON mp.old_id = l.predecessor_id
    JOIN unnest(v_old, v_map) AS ms(old_id, new_id) ON ms.old_id = l.successor_id;

    -- Le matériel et les véhicules rattachés aux éléments suivent la copie (les avertissements de disponibilité se recalculent sur les nouvelles dates)
    INSERT INTO public.cp_item_resources (item_id, kind, equipment_id, vehicle_id, quantity, note)
    SELECT m.new_id, r.kind, r.equipment_id, r.vehicle_id, r.quantity, r.note
    FROM public.cp_item_resources r JOIN unnest(v_old, v_map) AS m(old_id, new_id) ON m.old_id = r.item_id;
  END IF;

  IF p_copy_team THEN
    INSERT INTO public.cp_project_members (project_id, user_id, role)
    SELECT v_new, pm.user_id, pm.role FROM public.cp_project_members pm WHERE pm.project_id = p_project;
    IF p_copy_assignments AND v_max >= 0 THEN
      INSERT INTO public.cp_item_members (item_id, user_id)
      SELECT m.new_id, im.user_id
      FROM public.cp_item_members im JOIN unnest(v_old, v_map) AS m(old_id, new_id) ON m.old_id = im.item_id;
    END IF;
  END IF;

  PERFORM set_config('gomat.cp_copy', coalesce(v_prev, ''), true);
  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.cp_duplicate_project(uuid, text, date, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_duplicate_project(uuid, text, date, boolean, boolean) TO authenticated;

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
    'cp_calendar_days', 'cp_user_capacity', 'cp_baseline_dates', 'cp_budget_lines', 'cp_user_rates', 'cp_item_resources'
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
