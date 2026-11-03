/*
  PILOTE : performance des opérations en masse (copie d'un projet, import, décalage d'un gros projet).

  Constat (mesuré sur la base de test locale, 190 éléments) : créer 190 tâches prenait 3,4 s, les assigner 3,0 s, décaler
  un projet de 200 éléments 2,6 s. Sur Supabase, une requête est coupée à 8 s : un projet un peu plus gros échouait
  (« canceling statement due to statement timeout »).

  Cause : les contrôles de ligne (cp_item_guard, cp_item_member_guard, cp_item_check_guard, cp_project_member_guard)
  relisaient projets, états, éléments, personnes avec les droits de l'utilisateur, donc sous la sécurité par ligne
  (≈ 4 ms par lecture, 3 à 4 lectures par ligne). Mesure : même lecture sans sécurité par ligne = 0,005 ms.

  Correction : ces quatre contrôles s'exécutent avec les droits du propriétaire de la fonction (SECURITY DEFINER),
  ce qui est sans risque ici parce que
    - chaque lecture est limitée à l'entreprise de la ligne écrite (organization_id = NEW.organization_id), et
    - l'entreprise de la ligne écrite est déjà imposée avant (a_org_write_guard + règle RESTRICTIVE org_isolation) ;
  les fonctions ne font que lire et refuser : elles ne renvoient rien d'une autre entreprise.
  Les règles et les messages ne changent pas (mêmes tests). Les fonctions ne sont pas appelables à la main.
*/

CREATE OR REPLACE FUNCTION public.cp_item_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_parent public.cp_items%ROWTYPE;
BEGIN
  -- Restauration d'une sauvegarde : des données déjà contrôlées autrefois, remises dans l'ordre du fichier
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.kind <> OLD.kind THEN RAISE EXCEPTION 'Le type d''un élément ne change pas : supprime-le et recrée-le'; END IF;
    IF NEW.project_id <> OLD.project_id THEN RAISE EXCEPTION 'Un élément ne change pas de projet'; END IF;
    NEW.updated_at := now();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cp_projects p WHERE p.id = NEW.project_id AND p.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Projet introuvable';
  END IF;

  IF NEW.status_id IS NULL THEN
    SELECT s.id INTO NEW.status_id FROM public.cp_statuses s
    WHERE s.organization_id = NEW.organization_id AND s.is_system AND s.family = 'not_started' LIMIT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_statuses s WHERE s.id = NEW.status_id AND s.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'État introuvable';
  END IF;

  IF NEW.parent_id IS NULL THEN
    IF NEW.kind = 'subtask' THEN RAISE EXCEPTION 'Une sous-tâche se range sous une tâche'; END IF;
  ELSE
    IF NEW.parent_id = NEW.id THEN RAISE EXCEPTION 'Un élément ne peut pas être son propre parent'; END IF;
    SELECT * INTO v_parent FROM public.cp_items i WHERE i.id = NEW.parent_id AND i.organization_id = NEW.organization_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Élément parent introuvable'; END IF;
    IF v_parent.project_id <> NEW.project_id THEN RAISE EXCEPTION 'Le parent doit être dans le même projet'; END IF;
    IF NEW.kind = 'phase' THEN RAISE EXCEPTION 'Une phase se range directement sous le projet'; END IF;
    IF NEW.kind IN ('task', 'milestone') AND v_parent.kind <> 'phase' THEN RAISE EXCEPTION 'Une tâche ou un jalon se range sous une phase ou directement sous le projet'; END IF;
    IF NEW.kind = 'subtask' AND v_parent.kind <> 'task' THEN RAISE EXCEPTION 'Une sous-tâche se range sous une tâche'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cp_item_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cp_items i WHERE i.id = NEW.item_id AND i.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Élément introuvable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id AND u.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Personne introuvable';
  END IF;
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  -- Une tâche ne s'assigne qu'à l'équipe du projet (lectures limitées à l'entreprise de la ligne)
  IF NOT EXISTS (
    SELECT 1 FROM public.cp_items i
    JOIN public.cp_project_members pm ON pm.project_id = i.project_id AND pm.organization_id = NEW.organization_id
    WHERE i.id = NEW.item_id AND i.organization_id = NEW.organization_id AND pm.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Cette personne ne fait pas partie de l''équipe du projet';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cp_item_check_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cp_items i WHERE i.id = NEW.item_id AND i.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Élément introuvable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cp_project_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cp_projects p WHERE p.id = NEW.project_id AND p.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Projet introuvable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id AND u.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Personne introuvable';
  END IF;
  RETURN NEW;
END;
$$;

-- Des fonctions de déclenchement : personne n'a besoin de les appeler à la main
REVOKE EXECUTE ON FUNCTION public.cp_item_guard(), public.cp_item_member_guard(), public.cp_item_check_guard(), public.cp_project_member_guard() FROM PUBLIC, anon, authenticated;

-- Dépendances : même principe (les parcours récursifs sont maintenant limités à l'entreprise de la ligne)
CREATE OR REPLACE FUNCTION public.cp_item_link_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pred public.cp_items%ROWTYPE;
  v_succ public.cp_items%ROWTYPE;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.predecessor_id <> OLD.predecessor_id OR NEW.successor_id <> OLD.successor_id) THEN
    RAISE EXCEPTION 'Une dépendance ne change pas d''éléments : supprime-la et recrée-la';
  END IF;
  SELECT * INTO v_pred FROM public.cp_items i WHERE i.id = NEW.predecessor_id AND i.organization_id = NEW.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Élément introuvable'; END IF;
  SELECT * INTO v_succ FROM public.cp_items i WHERE i.id = NEW.successor_id AND i.organization_id = NEW.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Élément introuvable'; END IF;
  IF v_pred.project_id <> v_succ.project_id THEN RAISE EXCEPTION 'Les deux éléments doivent être dans le même projet'; END IF;
  NEW.project_id := v_pred.project_id;
  -- Un élément ne dépend pas de son parent (ni de ses ancêtres) ni de ce qu'il contient
  IF EXISTS (
    WITH RECURSIVE up AS (
      SELECT i.id, i.parent_id FROM public.cp_items i WHERE i.id = NEW.successor_id AND i.organization_id = NEW.organization_id
      UNION ALL SELECT p.id, p.parent_id FROM public.cp_items p JOIN up ON p.id = up.parent_id AND p.organization_id = NEW.organization_id
    ) SELECT 1 FROM up WHERE up.id = NEW.predecessor_id
  ) OR EXISTS (
    WITH RECURSIVE up AS (
      SELECT i.id, i.parent_id FROM public.cp_items i WHERE i.id = NEW.predecessor_id AND i.organization_id = NEW.organization_id
      UNION ALL SELECT p.id, p.parent_id FROM public.cp_items p JOIN up ON p.id = up.parent_id AND p.organization_id = NEW.organization_id
    ) SELECT 1 FROM up WHERE up.id = NEW.successor_id
  ) THEN
    RAISE EXCEPTION 'Un élément ne dépend pas de son parent ni de ce qu''il contient';
  END IF;
  -- Pas de boucle : le prédécesseur ne doit pas déjà dépendre (même de loin) du successeur ; le verrou évite deux créations simultanées
  PERFORM pg_advisory_xact_lock(hashtext('cp_links:' || NEW.project_id::text));
  IF EXISTS (
    WITH RECURSIVE down AS (
      SELECT l.successor_id AS id FROM public.cp_item_links l WHERE l.predecessor_id = NEW.successor_id AND l.organization_id = NEW.organization_id
      UNION SELECT l.successor_id FROM public.cp_item_links l JOIN down d ON l.predecessor_id = d.id AND l.organization_id = NEW.organization_id
    ) SELECT 1 FROM down WHERE down.id = NEW.predecessor_id
  ) THEN
    RAISE EXCEPTION 'Cette dépendance créerait une boucle';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_item_link_guard() FROM PUBLIC, anon, authenticated;
