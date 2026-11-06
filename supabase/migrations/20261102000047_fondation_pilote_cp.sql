/*
  R2a : fondation PILOTE, renommage « cp_ » et clés de module alignées sur le cahier des charges.

  Pourquoi maintenant : il n'y a que des données de test ; plus tard le renommage coûterait cher.
  Ce que fait cette migration (rejouable sans effet une fois appliquée) :
    1. Tables du planning : préfixe cp_  (contractors → cp_contractors, site_zones → cp_site_zones, …).
    2. Fonctions : préfixe cp_  (create_intervention_series → cp_create_intervention_series, …) ; corps réécrits avec les nouveaux noms.
       Elle remplace aussi la migration 46 (restauration : les contrôles sont suspendus quand gomat.restoring = 'on') :
       inutile de coller la 46 si elle n'a pas été appliquée.
    3. Clés de module : chantiers_planning → cp.planning, personnes_externes → cp.workers, portails → cp.subcontractors,
       repas → cp.meals, allergies → cp.allergies, hotel → cp.lodging, facturation → cp.invoicing, temps_de_travail → cp.timesheets.
       Nouvelles clés : cp.projects (plan annuel et projets, module R3), cp.vouchers, cp.caterers.
       Les entreprises gardent leurs modules (les lignes organization_modules suivent la nouvelle clé).
    4. Droits : chantiers.planning:* → cp.planning:* (rôles système, rôles personnalisés et droits par défaut).
    5. Règles de sécurité des tables cp_ recréées avec les nouvelles clés (module activé ET droit).
  Aucune donnée n'est supprimée.
*/

-- 1. Tables ---------------------------------------------------------------------------------------------------
DO $$
DECLARE
  m text[];
BEGIN
  FOREACH m SLICE 1 IN ARRAY ARRAY[
    ['contractors', 'cp_contractors'], ['site_config', 'cp_site_config'], ['site_blocked_days', 'cp_site_blocked_days'],
    ['site_zones', 'cp_site_zones'], ['site_phases', 'cp_site_phases'], ['site_teams', 'cp_site_teams'],
    ['site_interventions', 'cp_site_interventions'], ['site_intervention_needs', 'cp_site_intervention_needs']
  ] LOOP
    IF to_regclass('public.' || m[1]) IS NOT NULL AND to_regclass('public.' || m[2]) IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I RENAME TO %I', m[1], m[2]);
    END IF;
  END LOOP;
END $$;

-- 2. Fonctions : nouveau nom (les branchements des déclencheurs suivent), puis corps réécrits ----------------------
DO $$
BEGIN
  IF to_regprocedure('public.site_child_guard()') IS NOT NULL THEN ALTER FUNCTION public.site_child_guard() RENAME TO cp_site_child_guard; END IF;
  IF to_regprocedure('public.site_interventions_check()') IS NOT NULL THEN ALTER FUNCTION public.site_interventions_check() RENAME TO cp_site_interventions_check; END IF;
  IF to_regprocedure('public.site_need_guard()') IS NOT NULL THEN ALTER FUNCTION public.site_need_guard() RENAME TO cp_site_need_guard; END IF;
  IF to_regprocedure('public.site_material_issues(uuid)') IS NOT NULL THEN ALTER FUNCTION public.site_material_issues(uuid) RENAME TO cp_site_material_issues; END IF;
  IF to_regprocedure('public.copy_interventions_day(uuid,date,date[])') IS NOT NULL THEN ALTER FUNCTION public.copy_interventions_day(uuid, date, date[]) RENAME TO cp_copy_interventions_day; END IF;
  IF to_regprocedure('public.create_intervention_series(uuid,uuid,uuid,uuid,text,text,date,date,integer[],time without time zone,time without time zone,integer,jsonb)') IS NOT NULL THEN
    ALTER FUNCTION public.create_intervention_series(uuid, uuid, uuid, uuid, text, text, date, date, integer[], time, time, integer, jsonb) RENAME TO cp_create_intervention_series;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cp_site_child_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = NEW.site_id AND s.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Chantier introuvable';
  END IF;
  IF TG_TABLE_NAME = 'cp_site_teams' THEN
    IF NEW.contractor_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.cp_contractors c WHERE c.id = NEW.contractor_id AND c.organization_id = NEW.organization_id) THEN
      RAISE EXCEPTION 'Prestataire introuvable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Règles d'une intervention (avec la suspension pendant une restauration, ex-migration 46)
CREATE OR REPLACE FUNCTION public.cp_site_interventions_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  tz constant text := 'Europe/Zurich';
  v_site public.sites%ROWTYPE;
  v_cfg public.cp_site_config%ROWTYPE;
  v_step integer;
  v_all_day boolean;
  v_from time;
  v_to time;
  ls timestamp;
  le timestamp;
  v_last_day date;
  v_blocked date;
BEGIN
  -- Restauration d'une sauvegarde : on remet des données déjà contrôlées autrefois (chantier clôturé depuis, etc.)
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;

  SELECT * INTO v_site FROM public.sites s WHERE s.id = NEW.site_id AND s.organization_id = NEW.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chantier introuvable'; END IF;
  IF v_site.status <> 'open' THEN RAISE EXCEPTION 'Ce chantier est clôturé : son planning ne peut plus être modifié'; END IF;
  IF NEW.ends_at <= NEW.starts_at THEN RAISE EXCEPTION 'La fin doit être après le début'; END IF;

  SELECT * INTO v_cfg FROM public.cp_site_config c WHERE c.site_id = NEW.site_id;
  v_step := COALESCE(v_cfg.step_minutes, 15);
  v_all_day := COALESCE(v_cfg.all_day, false);
  v_from := COALESCE(v_cfg.day_start, '07:00');
  v_to := COALESCE(v_cfg.day_end, '19:00');
  ls := NEW.starts_at AT TIME ZONE tz;
  le := NEW.ends_at AT TIME ZONE tz;

  IF date_trunc('minute', ls) <> ls OR date_trunc('minute', le) <> le
     OR ((extract(hour FROM ls) * 60 + extract(minute FROM ls))::integer % v_step) <> 0
     OR ((extract(hour FROM le) * 60 + extract(minute FROM le))::integer % v_step) <> 0 THEN
    RAISE EXCEPTION 'Les heures doivent tomber sur un pas de % minutes', v_step;
  END IF;

  IF NOT v_all_day THEN
    IF ls::date <> le::date THEN RAISE EXCEPTION 'Une intervention tient dans une seule journée (sauf chantier 24 h/24)'; END IF;
    IF ls::time < v_from OR le::time > v_to THEN
      RAISE EXCEPTION 'Hors des heures du chantier (% à %)', to_char(v_from, 'HH24:MI'), to_char(v_to, 'HH24:MI');
    END IF;
  END IF;

  v_last_day := (le - interval '1 second')::date;
  IF v_site.start_on IS NOT NULL AND ls::date < v_site.start_on THEN
    RAISE EXCEPTION 'Avant le début du chantier (%)', to_char(v_site.start_on, 'DD.MM.YYYY');
  END IF;
  IF v_site.end_on IS NOT NULL AND v_last_day > v_site.end_on THEN
    RAISE EXCEPTION 'Après la fin du chantier (%)', to_char(v_site.end_on, 'DD.MM.YYYY');
  END IF;

  SELECT b.day INTO v_blocked FROM public.cp_site_blocked_days b WHERE b.site_id = NEW.site_id AND b.day BETWEEN ls::date AND v_last_day LIMIT 1;
  IF v_blocked IS NOT NULL THEN RAISE EXCEPTION 'Jour bloqué : %', to_char(v_blocked, 'DD.MM.YYYY'); END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cp_site_zones z WHERE z.id = NEW.zone_id AND z.site_id = NEW.site_id) THEN RAISE EXCEPTION 'Zone inconnue pour ce chantier'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_site_teams t WHERE t.id = NEW.team_id AND t.site_id = NEW.site_id) THEN RAISE EXCEPTION 'Équipe inconnue pour ce chantier'; END IF;
  IF NEW.phase_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cp_site_phases p WHERE p.id = NEW.phase_id AND p.site_id = NEW.site_id) THEN RAISE EXCEPTION 'Phase inconnue pour ce chantier'; END IF;

  -- Une équipe n'est jamais à deux endroits à la fois (le verrou évite que deux enregistrements simultanés passent ensemble)
  PERFORM pg_advisory_xact_lock(hashtext('site_team:' || NEW.team_id::text));
  IF EXISTS (SELECT 1 FROM public.cp_site_interventions i WHERE i.team_id = NEW.team_id AND i.id <> NEW.id AND i.starts_at < NEW.ends_at AND i.ends_at > NEW.starts_at) THEN
    RAISE EXCEPTION 'Cette équipe a déjà une intervention sur ce créneau';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cp_site_need_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cp_site_interventions i WHERE i.id = NEW.intervention_id AND i.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Intervention introuvable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.equipment e WHERE e.id = NEW.equipment_id AND e.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Article introuvable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cp_create_intervention_series(
  p_site_id uuid, p_zone_id uuid, p_team_id uuid, p_phase_id uuid, p_title text, p_notes text,
  p_first_day date, p_last_day date, p_weekdays integer[], p_start time, p_end time,
  p_end_day_offset integer DEFAULT 0, p_needs jsonb DEFAULT '[]'
)
RETURNS TABLE (created integer, skipped_blocked integer, series_id uuid)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  tz constant text := 'Europe/Zurich';
  d date;
  v_series uuid := gen_random_uuid();
  v_created integer := 0;
  v_skipped integer := 0;
  v_id uuid;
  v_need jsonb;
BEGIN
  IF p_first_day IS NULL OR p_last_day IS NULL THEN RAISE EXCEPTION 'Indique le premier et le dernier jour'; END IF;
  IF p_last_day < p_first_day THEN RAISE EXCEPTION 'Le dernier jour est avant le premier'; END IF;
  IF p_last_day - p_first_day > 120 THEN RAISE EXCEPTION 'Une série couvre 120 jours au plus'; END IF;
  IF p_weekdays IS NULL OR cardinality(p_weekdays) = 0 THEN RAISE EXCEPTION 'Choisis au moins un jour de la semaine'; END IF;
  IF p_end_day_offset IS NULL OR p_end_day_offset < 0 OR p_end_day_offset > 7 THEN RAISE EXCEPTION 'Décalage du jour de fin invalide'; END IF;
  FOR d IN SELECT g::date FROM generate_series(p_first_day::timestamp, p_last_day::timestamp, interval '1 day') g LOOP
    CONTINUE WHEN NOT (extract(isodow FROM d)::integer = ANY (p_weekdays));
    IF EXISTS (SELECT 1 FROM public.cp_site_blocked_days b WHERE b.site_id = p_site_id AND b.day = d) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    BEGIN
      INSERT INTO public.cp_site_interventions (site_id, zone_id, team_id, phase_id, title, notes, starts_at, ends_at, series_id)
      VALUES (p_site_id, p_zone_id, p_team_id, p_phase_id, p_title, p_notes, (d + p_start) AT TIME ZONE tz, ((d + p_end_day_offset) + p_end) AT TIME ZONE tz, v_series)
      RETURNING id INTO v_id;
      FOR v_need IN SELECT * FROM jsonb_array_elements(COALESCE(p_needs, '[]'::jsonb)) LOOP
        INSERT INTO public.cp_site_intervention_needs (intervention_id, equipment_id, quantity)
        VALUES (v_id, (v_need ->> 'equipment_id')::uuid, COALESCE((v_need ->> 'quantity')::integer, 1));
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION '%: %', to_char(d, 'DD.MM.YYYY'), SQLERRM;
    END;
    v_created := v_created + 1;
  END LOOP;
  IF v_created = 0 THEN RAISE EXCEPTION 'Aucun jour ne convient (jours de la semaine non choisis ou jours bloqués)'; END IF;
  RETURN QUERY SELECT v_created, v_skipped, v_series;
END;
$$;

CREATE OR REPLACE FUNCTION public.cp_copy_interventions_day(p_site_id uuid, p_from_day date, p_to_days date[])
RETURNS TABLE (created integer, skipped_blocked integer)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  tz constant text := 'Europe/Zurich';
  d date;
  r public.cp_site_interventions%ROWTYPE;
  v_id uuid;
  v_created integer := 0;
  v_skipped integer := 0;
  v_sources integer;
BEGIN
  IF p_to_days IS NULL OR cardinality(p_to_days) = 0 THEN RAISE EXCEPTION 'Choisis au moins un jour de destination'; END IF;
  IF cardinality(p_to_days) > 60 THEN RAISE EXCEPTION 'Copie sur 60 jours au plus'; END IF;
  SELECT count(*) INTO v_sources FROM public.cp_site_interventions i WHERE i.site_id = p_site_id AND (i.starts_at AT TIME ZONE tz)::date = p_from_day;
  IF v_sources = 0 THEN RAISE EXCEPTION 'Aucune intervention ce jour-là'; END IF;
  FOR d IN SELECT DISTINCT x FROM unnest(p_to_days) AS x ORDER BY x LOOP
    CONTINUE WHEN d = p_from_day;
    IF EXISTS (SELECT 1 FROM public.cp_site_blocked_days b WHERE b.site_id = p_site_id AND b.day = d) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    FOR r IN SELECT * FROM public.cp_site_interventions i WHERE i.site_id = p_site_id AND (i.starts_at AT TIME ZONE tz)::date = p_from_day ORDER BY i.starts_at LOOP
      BEGIN
        INSERT INTO public.cp_site_interventions (site_id, zone_id, team_id, phase_id, title, notes, starts_at, ends_at)
        VALUES (r.site_id, r.zone_id, r.team_id, r.phase_id, r.title, r.notes,
                (d + (r.starts_at AT TIME ZONE tz)::time) AT TIME ZONE tz,
                ((d + ((r.ends_at AT TIME ZONE tz)::date - (r.starts_at AT TIME ZONE tz)::date)) + (r.ends_at AT TIME ZONE tz)::time) AT TIME ZONE tz)
        RETURNING id INTO v_id;
        INSERT INTO public.cp_site_intervention_needs (intervention_id, equipment_id, quantity)
        SELECT v_id, n.equipment_id, n.quantity FROM public.cp_site_intervention_needs n WHERE n.intervention_id = r.id;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION '%: % (%)', to_char(d, 'DD.MM.YYYY'), SQLERRM, r.title;
      END;
      v_created := v_created + 1;
    END LOOP;
  END LOOP;
  IF v_created = 0 THEN RAISE EXCEPTION 'Rien n''a été copié (jours bloqués ou identiques au jour d''origine)'; END IF;
  RETURN QUERY SELECT v_created, v_skipped;
END;
$$;

CREATE OR REPLACE FUNCTION public.cp_site_material_issues(p_site_id uuid)
RETURNS TABLE (intervention_id uuid, equipment_id uuid, equipment_name text, needed integer, available integer, shortage integer)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  WITH n AS (
    SELECT s.intervention_id, s.equipment_id, s.quantity, i.starts_at, i.ends_at
    FROM public.cp_site_intervention_needs s
    JOIN public.cp_site_interventions i ON i.id = s.intervention_id
    WHERE i.site_id = p_site_id
  ), calc AS (
    SELECT n.*,
           public.tool_availability(n.equipment_id, n.starts_at, n.ends_at) AS avail,
           COALESCE((SELECT sum(o.quantity)
                     FROM public.cp_site_intervention_needs o
                     JOIN public.cp_site_interventions oi ON oi.id = o.intervention_id
                     WHERE o.equipment_id = n.equipment_id AND o.intervention_id <> n.intervention_id
                       AND tstzrange(oi.starts_at, oi.ends_at, '[)') && tstzrange(n.starts_at, n.ends_at, '[)')), 0)::integer AS others
    FROM n
  )
  SELECT c.intervention_id, c.equipment_id, e.name::text, c.quantity,
         GREATEST(c.avail - c.others, 0), c.quantity - GREATEST(c.avail - c.others, 0)
  FROM calc c JOIN public.equipment e ON e.id = c.equipment_id
  WHERE c.quantity > GREATEST(c.avail - c.others, 0)
$$;

-- 3. Clés de module -------------------------------------------------------------------------------------------
ALTER TABLE public.platform_modules DROP CONSTRAINT IF EXISTS platform_modules_key_check;
ALTER TABLE public.platform_modules ADD CONSTRAINT platform_modules_key_check CHECK (key ~ '^[a-z0-9_.]+$');

INSERT INTO public.platform_modules (key, label, description, position) VALUES
  ('cp.planning', 'Planning de chantier', 'Zones, équipes, prestataires, interventions et frise horaire', 1),
  ('cp.projects', 'Plan annuel et projets', 'Programmes, projets, phases, tâches, jalons et Gantt (chantier, R&D, conception, recrutement…)', 2),
  ('cp.workers', 'Personnes externes et badges', 'Ouvriers d''un prestataire, badges QR, chef d''équipe', 3),
  ('cp.subcontractors', 'Portails', 'Accès limité pour les prestataires', 4),
  ('cp.meals', 'Repas', 'Plan de repas, bons, scan, statistiques', 5),
  ('cp.vouchers', 'Bons repas', 'Bons, scan et pointage des repas', 6),
  ('cp.caterers', 'Traiteurs', 'Traiteurs, commandes et portail traiteur', 7),
  ('cp.allergies', 'Allergies', 'Allergies, consentement, accès restreint', 8),
  ('cp.lodging', 'Hôtel et rooming list', 'Besoins d''hôtel et rooming list', 9),
  ('cp.invoicing', 'Facturation', 'Clients, factures, QR-bill', 10),
  ('cp.timesheets', 'Temps de travail', 'Heures réelles et pointage', 11)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, position = EXCLUDED.position;

DO $$
DECLARE
  m text[];
BEGIN
  FOREACH m SLICE 1 IN ARRAY ARRAY[
    ['chantiers_planning', 'cp.planning'], ['personnes_externes', 'cp.workers'], ['portails', 'cp.subcontractors'],
    ['repas', 'cp.meals'], ['allergies', 'cp.allergies'], ['hotel', 'cp.lodging'],
    ['facturation', 'cp.invoicing'], ['temps_de_travail', 'cp.timesheets']
  ] LOOP
    -- les entreprises gardent leur choix (activé ou non) sous la nouvelle clé
    INSERT INTO public.organization_modules (organization_id, module_key, enabled, updated_at)
    SELECT o.organization_id, m[2], o.enabled, o.updated_at FROM public.organization_modules o WHERE o.module_key = m[1]
    ON CONFLICT (organization_id, module_key) DO NOTHING;
    DELETE FROM public.organization_modules WHERE module_key = m[1];
    DELETE FROM public.platform_modules WHERE key = m[1];
  END LOOP;
END $$;

-- 4. Droits : chantiers.planning:* devient cp.planning:* -------------------------------------------------------------
UPDATE public.rbac_default_permissions SET permission_key = replace(permission_key, 'chantiers.planning:', 'cp.planning:')
WHERE permission_key LIKE 'chantiers.planning:%'
  AND NOT EXISTS (SELECT 1 FROM public.rbac_default_permissions x
                  WHERE x.system_key = rbac_default_permissions.system_key AND x.permission_key = replace(rbac_default_permissions.permission_key, 'chantiers.planning:', 'cp.planning:'));
DELETE FROM public.rbac_default_permissions WHERE permission_key LIKE 'chantiers.planning:%';

DO $$
BEGIN
  PERFORM set_config('app.org_guard_off', 'on', true);
  UPDATE public.rbac_role_permissions p SET permission_key = replace(p.permission_key, 'chantiers.planning:', 'cp.planning:')
  WHERE p.permission_key LIKE 'chantiers.planning:%'
    AND NOT EXISTS (SELECT 1 FROM public.rbac_role_permissions x
                    WHERE x.role_id = p.role_id AND x.permission_key = replace(p.permission_key, 'chantiers.planning:', 'cp.planning:'));
  DELETE FROM public.rbac_role_permissions WHERE permission_key LIKE 'chantiers.planning:%';
END $$;

-- 5. Règles de sécurité des tables cp_ : module activé ET droit ----------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cp_contractors', 'cp_site_config', 'cp_site_blocked_days', 'cp_site_zones', 'cp_site_phases', 'cp_site_teams', 'cp_site_interventions', 'cp_site_intervention_needs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS planning_read ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS planning_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS planning_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS planning_delete ON public.%I', t);
    EXECUTE format('CREATE POLICY planning_read ON public.%I FOR SELECT TO authenticated USING ((SELECT public.org_module_enabled(''cp.planning'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.planning:read''])))', t);
    EXECUTE format('CREATE POLICY planning_insert ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.org_module_enabled(''cp.planning'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.planning:create''])))', t);
    EXECUTE format('CREATE POLICY planning_update ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.org_module_enabled(''cp.planning'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.planning:update'']))) WITH CHECK ((SELECT public.org_module_enabled(''cp.planning'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.planning:update''])))', t);
    EXECUTE format('CREATE POLICY planning_delete ON public.%I FOR DELETE TO authenticated USING ((SELECT public.org_module_enabled(''cp.planning'')) AND (SELECT public.rbac_has_any_permission(ARRAY[''cp.planning:delete''])))', t);
  END LOOP;
END $$;

-- 6. Droits d'appel des fonctions (le renommage les conserve ; on les réaffirme) ---------------------------------------
REVOKE EXECUTE ON FUNCTION public.cp_create_intervention_series(uuid, uuid, uuid, uuid, text, text, date, date, integer[], time, time, integer, jsonb),
  public.cp_copy_interventions_day(uuid, date, date[]), public.cp_site_material_issues(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_create_intervention_series(uuid, uuid, uuid, uuid, text, text, date, date, integer[], time, time, integer, jsonb),
  public.cp_copy_interventions_day(uuid, date, date[]), public.cp_site_material_issues(uuid) TO authenticated;
