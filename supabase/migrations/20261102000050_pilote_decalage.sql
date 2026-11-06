/*
  R3b-2 : décaler un élément (ou un projet) en bloc, d'un nombre de jours entier, en une seule opération.

  Quand on glisse une barre du Gantt, l'élément ET tout ce qu'il contient (phase → tâches → sous-tâches, ou projet → tous ses
  éléments) se décalent du même nombre de jours. Les dates vides restent vides ; un jalon reste sur un seul jour.
  Tout ou rien : si une ligne est refusée, rien ne bouge. Les fonctions s'exécutent avec les droits de la personne (sécurité
  par ligne, module activé, droit cp.projects:update) : sans ces droits, ou pour un élément d'une autre entreprise, elles refusent.

    cp_shift_item(p_item_id, p_days)       : l'élément et ses descendants ; renvoie le nombre d'éléments décalés
    cp_shift_project(p_project_id, p_days) : le projet (ses dates) et tous ses éléments ; renvoie le nombre de lignes décalées
*/

CREATE OR REPLACE FUNCTION public.cp_shift_item(p_item_id uuid, p_days integer)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_n integer;
BEGIN
  IF p_days IS NULL OR p_days = 0 THEN RAISE EXCEPTION 'Indique un décalage en jours (différent de 0)'; END IF;
  IF abs(p_days) > 3650 THEN RAISE EXCEPTION 'Décalage trop grand (10 ans au plus)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_items i WHERE i.id = p_item_id) THEN
    RAISE EXCEPTION 'Élément introuvable';
  END IF;
  WITH RECURSIVE tree AS (
    SELECT i.id FROM public.cp_items i WHERE i.id = p_item_id
    UNION ALL
    SELECT c.id FROM public.cp_items c JOIN tree t ON c.parent_id = t.id
  )
  UPDATE public.cp_items i
  SET starts_on = i.starts_on + p_days, ends_on = i.ends_on + p_days
  WHERE i.id IN (SELECT id FROM tree);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  -- Sous la sécurité par ligne, une modification interdite ne touche aucune ligne : on refuse au lieu de réussir en silence
  IF v_n = 0 THEN RAISE EXCEPTION 'Modification non autorisée'; END IF;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.cp_shift_project(p_project_id uuid, p_days integer)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_n integer;
  v_items integer;
BEGIN
  IF p_days IS NULL OR p_days = 0 THEN RAISE EXCEPTION 'Indique un décalage en jours (différent de 0)'; END IF;
  IF abs(p_days) > 3650 THEN RAISE EXCEPTION 'Décalage trop grand (10 ans au plus)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_projects p WHERE p.id = p_project_id) THEN
    RAISE EXCEPTION 'Projet introuvable';
  END IF;
  UPDATE public.cp_projects p
  SET starts_on = p.starts_on + p_days, ends_on = p.ends_on + p_days
  WHERE p.id = p_project_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RAISE EXCEPTION 'Modification non autorisée'; END IF;
  UPDATE public.cp_items i
  SET starts_on = i.starts_on + p_days, ends_on = i.ends_on + p_days
  WHERE i.project_id = p_project_id;
  GET DIAGNOSTICS v_items = ROW_COUNT;
  RETURN v_n + v_items;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cp_shift_item(uuid, integer), public.cp_shift_project(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_shift_item(uuid, integer), public.cp_shift_project(uuid, integer) TO authenticated;
