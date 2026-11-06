/*
  PILOTE : dupliquer un projet (UI-8, premier « modèle »).

  cp_duplicate_project(projet, nom, nouveau début, copier l'équipe, copier les assignations) → identifiant du nouveau projet.

  Ce qui est copié : le projet (nom, type, description, priorité, couleur, réglages des dépendances), toutes ses phases, tâches,
  jalons et sous-tâches avec la même arborescence, leurs dépendances, leur liste à cocher (remise à « non fait »).
  Dates : tout est décalé de l'écart entre le début actuel du projet (le sien, sinon le plus ancien de ses éléments) et le
  nouveau début ; sans nouveau début, les dates sont gardées telles quelles. L'état repart de « Pas commencé » pour le projet
  et tous ses éléments.
  Jamais copiés : le chantier lié (un chantier n'a qu'un projet), la discussion et les documents (à venir), les assignations
  si l'équipe n'est pas copiée (une tâche ne s'assigne qu'à l'équipe du projet).

  Sécurité : la fonction s'exécute avec les droits de la personne (SECURITY INVOKER) : il faut donc voir le projet source et avoir
  le droit de création sur les projets, les éléments, les dépendances et l'équipe ; l'isolation par entreprise et les contrôles
  de ligne existants s'appliquent à chaque ligne copiée. Rien de nouveau n'est ouvert.

  Performance : une requête par niveau de l'arborescence (et une par type de ligne), jamais une boucle par élément.

  Avis : la copie de l'équipe et des assignations ne doit pas envoyer « tu as été ajouté » / « on t'a assigné » à tout le monde.
  Les deux déclencheurs d'avis respectent donc un réglage local à la transaction (gomat.cp_copy), posé seulement par cette fonction.

  Dépendances : la copie garde exactement les mêmes écarts que la source (tout est décalé du même nombre de jours). Le même réglage
  évite donc le recalcul « décaler le successeur » à chaque dépendance copiée : il coûtait environ 15 ms par dépendance (mesuré :
  1,2 s pour 80 dépendances), pour ne rien changer.
*/

-- 1. Les avis d'équipe et d'assignation se taisent quand la copie le demande ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.cp_notify_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  i record;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF current_setting('gomat.cp_copy', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.user_id IS NOT DISTINCT FROM public.app_user_id() THEN RETURN NEW; END IF;
  SELECT it.id, it.name, it.kind, it.ends_on, it.project_id, p.name AS project_name INTO i
  FROM public.cp_items it JOIN public.cp_projects p ON p.id = it.project_id WHERE it.id = NEW.item_id;
  IF i.id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.cp_notify(
    NEW.user_id, 'cp_assigned', 'Nouvelle assignation',
    format('%s t''a assigné %s « %s » (projet « %s »)%s.', public.cp_actor_name(),
           CASE i.kind WHEN 'phase' THEN 'la phase' WHEN 'task' THEN 'la tâche' WHEN 'milestone' THEN 'le jalon' ELSE 'la sous-tâche' END,
           i.name, i.project_name, CASE WHEN i.ends_on IS NULL THEN '' ELSE ', à terminer le ' || to_char(i.ends_on, 'DD.MM.YYYY') END),
    i.project_id, i.id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_notify_assigned() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cp_notify_team_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_project text;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF current_setting('gomat.cp_copy', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.user_id IS NOT DISTINCT FROM public.app_user_id() THEN RETURN NEW; END IF;
  SELECT p.name INTO v_project FROM public.cp_projects p WHERE p.id = NEW.project_id;
  IF v_project IS NULL THEN RETURN NEW; END IF;
  PERFORM public.cp_notify(
    NEW.user_id, 'cp_team_added', 'Tu rejoins un projet',
    format('%s t''a ajouté à l''équipe du projet « %s » (%s).', public.cp_actor_name(), v_project, CASE NEW.role WHEN 'lead' THEN 'responsable' ELSE 'membre' END),
    NEW.project_id, NULL);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_notify_team_added() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cp_link_enforce_new()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_end date;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NULL; END IF;
  IF current_setting('gomat.cp_copy', true) = 'on' THEN RETURN NULL; END IF;
  SELECT i.ends_on INTO v_end FROM public.cp_items i WHERE i.id = NEW.predecessor_id;
  PERFORM public.cp_link_apply(NEW.successor_id, v_end, 0);
  RETURN NULL;
END;
$$;

-- 2. La copie ---------------------------------------------------------------------------------------------------------------------
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
    INSERT INTO public.cp_items (id, project_id, parent_id, kind, name, description, status_id, priority, starts_on, ends_on, position)
    SELECT m.new_id, v_new, pm.new_id, s.kind, s.name, s.description, v_status, s.priority, s.starts_on + v_delta, s.ends_on + v_delta, s.position
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
