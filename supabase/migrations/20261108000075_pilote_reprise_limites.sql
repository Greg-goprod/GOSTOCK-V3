/*
  P13 (suite) — reprise des limites connues + durcissement

  1. Sécurité : cp_shift_date (calcul de date pur) n'était pas réservée aux personnes connectées et n'avait pas de search_path fixé ;
     cp_pref_defaults non plus (search_path). Les deux sont corrigées. Rien d'autre n'est modifié hors de PILOTE.
  2. Dupliquer un projet avec ses assignations copie aussi les intervenants externes (cp_duplicate_project recréée, texte de la migration 72
     + une copie de cp_item_externals). Sans « copier les assignations » (et pour les modèles) ils ne sont toujours pas copiés.
  3. Répéter une tâche :
       - une tâche qui a des SOUS-TÂCHES se répète : chaque occurrence reçoit sa copie des sous-tâches (liste à cocher décochée, personnes, matériel,
         intervenants), avec le même décalage par rapport à la tâche ; elles n'entrent pas dans la série (seule la tâche porte le lien de série) ;
       - nouvelle option p_skip_nonworking (faux par défaut) : une occurrence qui tombe un week-end ou un jour du calendrier de travail
         (migration 65) est avancée au premier jour ouvré ; la durée en jours est conservée.
     La fonction à 3 paramètres est remplacée par celle à 4 paramètres (valeur par défaut : un appel à 3 paramètres fonctionne comme avant).
  4. Budget : cp_project_time_by_user(projet) donne le temps saisi par personne sur un projet, réservé aux personnes qui ont le droit
     « budget » (le temps des autres est personnel : il n'est lisible autrement que par les responsables) — pour valoriser le temps réellement passé.
*/

-- 1. Sécurité -------------------------------------------------------------------------------------------------------------------------
ALTER FUNCTION public.cp_shift_date(date, text, integer) SET search_path = public, extensions;
REVOKE EXECUTE ON FUNCTION public.cp_shift_date(date, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_shift_date(date, text, integer) TO authenticated;
ALTER FUNCTION public.cp_pref_defaults() SET search_path = public, extensions;

-- 2. Dupliquer un projet : intervenants externes avec les assignations -------------------------------------------------------------------
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
      -- Les intervenants externes sont des assignations par le nom : ils suivent la copie des assignations
      INSERT INTO public.cp_item_externals (item_id, external_id)
      SELECT m.new_id, e.external_id
      FROM public.cp_item_externals e JOIN unnest(v_old, v_map) AS m(old_id, new_id) ON m.old_id = e.item_id;
    END IF;
  END IF;

  PERFORM set_config('gomat.cp_copy', coalesce(v_prev, ''), true);
  RETURN v_new;
END;
$$;

-- (droits inchangés : ceux de la migration 72 sont conservés par CREATE OR REPLACE)

-- 3. Répéter une tâche : sous-tâches et jours ouvrés ------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.cp_repeat_item(uuid, text, integer);

CREATE OR REPLACE FUNCTION public.cp_repeat_item(p_item uuid, p_freq text, p_count integer, p_skip_nonworking boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_src public.cp_items%ROWTYPE;
  v_child public.cp_items%ROWTYPE;
  v_series uuid;
  v_first integer;
  v_max integer;
  v_status uuid;
  v_new uuid;
  v_cnew uuid;
  v_start date;
  v_end date;
  v_cs date;
  v_ce date;
  v_anchor_src date;
  v_anchor_new date;
  v_k integer;
  v_prev text := current_setting('gomat.cp_copy', true);
BEGIN
  IF p_freq IS NULL OR p_freq NOT IN ('weekly', 'monthly', 'yearly') THEN RAISE EXCEPTION 'Fréquence inconnue : chaque semaine, chaque mois ou chaque année'; END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 52 THEN RAISE EXCEPTION 'Répète de 1 à 52 fois'; END IF;
  SELECT * INTO v_src FROM public.cp_items WHERE id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Élément introuvable'; END IF;
  IF v_src.kind = 'phase' THEN RAISE EXCEPTION 'Une phase ne se répète pas : répète ses tâches une à une'; END IF;
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
  v_anchor_src := coalesce(v_src.starts_on, v_src.ends_on);

  PERFORM set_config('gomat.cp_copy', 'on', true);
  FOR v_k IN 1..p_count LOOP
    v_start := CASE WHEN v_src.starts_on IS NOT NULL THEN public.cp_shift_date(v_src.starts_on, p_freq, v_k) END;
    v_end := CASE WHEN v_src.ends_on IS NULL THEN NULL
                  WHEN v_src.starts_on IS NOT NULL THEN NULL
                  ELSE public.cp_shift_date(v_src.ends_on, p_freq, v_k) END;
    IF p_skip_nonworking THEN
      IF v_start IS NOT NULL THEN v_start := public.cp_adjust_working_day(v_src.organization_id, v_start, 1); END IF;
      IF v_end IS NOT NULL THEN v_end := public.cp_adjust_working_day(v_src.organization_id, v_end, 1); END IF;
    END IF;
    IF v_src.ends_on IS NOT NULL AND v_src.starts_on IS NOT NULL THEN v_end := v_start + (v_src.ends_on - v_src.starts_on); END IF;
    v_anchor_new := coalesce(v_start, v_end);
    INSERT INTO public.cp_items (project_id, parent_id, kind, name, description, status_id, priority, starts_on, ends_on, position, estimate_hours, series_id, series_index)
    VALUES (v_src.project_id, v_src.parent_id, v_src.kind, v_src.name, v_src.description, v_status, v_src.priority, v_start, v_end, v_src.position, v_src.estimate_hours, v_series, v_first + v_k)
    RETURNING id INTO v_new;
    INSERT INTO public.cp_item_checks (item_id, label, done, position) SELECT v_new, c.label, false, c.position FROM public.cp_item_checks c WHERE c.item_id = p_item;
    INSERT INTO public.cp_item_members (item_id, user_id) SELECT v_new, m.user_id FROM public.cp_item_members m WHERE m.item_id = p_item;
    INSERT INTO public.cp_item_resources (item_id, kind, equipment_id, vehicle_id, quantity, note) SELECT v_new, r.kind, r.equipment_id, r.vehicle_id, r.quantity, r.note FROM public.cp_item_resources r WHERE r.item_id = p_item;
    INSERT INTO public.cp_item_externals (item_id, external_id) SELECT v_new, e.external_id FROM public.cp_item_externals e WHERE e.item_id = p_item;

    -- Sous-tâches : même écart que dans la tâche d'origine, par rapport à la nouvelle date de la tâche
    FOR v_child IN SELECT * FROM public.cp_items c WHERE c.parent_id = p_item ORDER BY c.position, c.created_at, c.id LOOP
      v_cs := CASE WHEN v_child.starts_on IS NOT NULL AND v_anchor_src IS NOT NULL AND v_anchor_new IS NOT NULL THEN v_anchor_new + (v_child.starts_on - v_anchor_src) END;
      v_ce := CASE WHEN v_child.ends_on IS NULL THEN NULL
                   WHEN v_child.starts_on IS NOT NULL THEN NULL
                   WHEN v_anchor_src IS NOT NULL AND v_anchor_new IS NOT NULL THEN v_anchor_new + (v_child.ends_on - v_anchor_src) END;
      IF p_skip_nonworking THEN
        IF v_cs IS NOT NULL THEN v_cs := public.cp_adjust_working_day(v_src.organization_id, v_cs, 1); END IF;
        IF v_ce IS NOT NULL THEN v_ce := public.cp_adjust_working_day(v_src.organization_id, v_ce, 1); END IF;
      END IF;
      IF v_child.starts_on IS NOT NULL AND v_child.ends_on IS NOT NULL AND v_cs IS NOT NULL THEN v_ce := v_cs + (v_child.ends_on - v_child.starts_on); END IF;
      INSERT INTO public.cp_items (project_id, parent_id, kind, name, description, status_id, priority, starts_on, ends_on, position, estimate_hours)
      VALUES (v_child.project_id, v_new, v_child.kind, v_child.name, v_child.description, v_status, v_child.priority, v_cs, v_ce, v_child.position, v_child.estimate_hours)
      RETURNING id INTO v_cnew;
      INSERT INTO public.cp_item_checks (item_id, label, done, position) SELECT v_cnew, c.label, false, c.position FROM public.cp_item_checks c WHERE c.item_id = v_child.id;
      INSERT INTO public.cp_item_members (item_id, user_id) SELECT v_cnew, m.user_id FROM public.cp_item_members m WHERE m.item_id = v_child.id;
      INSERT INTO public.cp_item_resources (item_id, kind, equipment_id, vehicle_id, quantity, note) SELECT v_cnew, r.kind, r.equipment_id, r.vehicle_id, r.quantity, r.note FROM public.cp_item_resources r WHERE r.item_id = v_child.id;
      INSERT INTO public.cp_item_externals (item_id, external_id) SELECT v_cnew, e.external_id FROM public.cp_item_externals e WHERE e.item_id = v_child.id;
    END LOOP;
  END LOOP;
  PERFORM set_config('gomat.cp_copy', coalesce(v_prev, ''), true);
  RETURN p_count;
END;
$$;
REVOKE ALL ON FUNCTION public.cp_repeat_item(uuid, text, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_repeat_item(uuid, text, integer, boolean) TO authenticated;

-- 4. Temps réellement passé, par personne, pour valoriser le budget -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cp_project_time_by_user(p_project uuid)
RETURNS TABLE (user_id uuid, minutes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT t.user_id, sum(t.minutes)::bigint
  FROM public.cp_time_entries t
  JOIN public.cp_items i ON i.id = t.item_id
  JOIN public.cp_projects p ON p.id = i.project_id
  WHERE p.id = p_project
    AND p.organization_id = public.app_org_id()
    AND public.rbac_has_any_permission(ARRAY['cp.budget:read'])
    AND t.minutes IS NOT NULL
  GROUP BY t.user_id
$$;
REVOKE ALL ON FUNCTION public.cp_project_time_by_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_project_time_by_user(uuid) TO authenticated;
