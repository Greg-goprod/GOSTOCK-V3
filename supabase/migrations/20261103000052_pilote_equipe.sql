/*
  Étape 1 de PILOTE (équipe) : « personnel » du projet, en plus des responsables.

  - cp_project_members reçoit un rôle : 'lead' (responsable, comme jusqu'ici) ou 'member' (membre de l'équipe).
    Les lignes existantes sont des responsables : elles restent 'lead'.
  - Une tâche ne s'assigne qu'à quelqu'un de l'équipe du projet (responsable ou membre) :
    cp_item_member_guard refuse sinon « Cette personne ne fait pas partie de l'équipe du projet ».
  - Retirer quelqu'un de l'équipe le désassigne aussi de tous les éléments de ce projet (cp_unassign_on_team_leave).
  - Reprise des données existantes : une personne déjà assignée à un élément sans être dans l'équipe y est ajoutée comme « membre ».
  - Restauration d'une sauvegarde (gomat.restoring = 'on') : la règle d'équipe n'est pas appliquée, comme pour les autres contrôles.
*/

-- 1. Rôle dans l'équipe -----------------------------------------------------------------------------------------
ALTER TABLE public.cp_project_members ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'lead';
ALTER TABLE public.cp_project_members DROP CONSTRAINT IF EXISTS cp_project_members_role_check;
ALTER TABLE public.cp_project_members ADD CONSTRAINT cp_project_members_role_check CHECK (role IN ('lead', 'member'));

-- 2. Reprise : les personnes déjà assignées à un élément entrent dans l'équipe comme « membres » ------------------
DO $$
BEGIN
  PERFORM set_config('app.org_guard_off', 'on', true);
  INSERT INTO public.cp_project_members (project_id, user_id, organization_id, role)
  SELECT DISTINCT i.project_id, im.user_id, im.organization_id, 'member'
  FROM public.cp_item_members im
  JOIN public.cp_items i ON i.id = im.item_id
  ON CONFLICT (project_id, user_id) DO NOTHING;
  PERFORM set_config('app.org_guard_off', 'off', true);
END $$;

-- 3. Une tâche ne s'assigne qu'à l'équipe du projet ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cp_item_member_guard()
RETURNS trigger
LANGUAGE plpgsql
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
  IF NOT EXISTS (
    SELECT 1 FROM public.cp_items i
    JOIN public.cp_project_members pm ON pm.project_id = i.project_id
    WHERE i.id = NEW.item_id AND pm.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Cette personne ne fait pas partie de l''équipe du projet';
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Quitter l'équipe = être désassigné des éléments du projet --------------------------------------------------
CREATE OR REPLACE FUNCTION public.cp_unassign_on_team_leave()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  DELETE FROM public.cp_item_members im
  USING public.cp_items i
  WHERE im.item_id = i.id AND i.project_id = OLD.project_id AND im.user_id = OLD.user_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS c_cp_unassign_on_team_leave ON public.cp_project_members;
CREATE TRIGGER c_cp_unassign_on_team_leave AFTER DELETE ON public.cp_project_members
  FOR EACH ROW EXECUTE FUNCTION public.cp_unassign_on_team_leave();
