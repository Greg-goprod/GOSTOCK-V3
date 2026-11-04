/*
  PILOTE : suppression définitive de la notion de « programme » (décision de Greg, 2026-11-04).

  Un projet regroupe des phases, tâches et jalons ; le « programme » (regroupement de projets) n'était pas clair
  et n'est plus proposé nulle part dans l'application.

  Ce que fait cette migration :
    - le contrôle de ligne d'un projet (cp_project_guard) ne vérifie plus de programme ;
    - la colonne cp_projects.program_id est supprimée (avec sa clé étrangère et son index) ;
    - la table cp_programs est supprimée (avec ses règles de sécurité, son journal et ses index).

  ATTENTION, IRRÉVERSIBLE : les programmes existants et le lien projet → programme disparaissent. Les projets,
  eux, sont conservés tels quels. Une ancienne sauvegarde qui contient cp_programs se restaure sans erreur :
  la restauration ignore la table et la colonne qui n'existent plus.

  À lancer APRÈS la mise en ligne de la version de l'application qui ne lit plus cp_programs, et APRÈS le
  redéploiement de la fonction send-notification-emails (v23, qui ne sauvegarde plus cp_programs).
*/

CREATE OR REPLACE FUNCTION public.cp_project_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.status_id IS NULL THEN
    SELECT s.id INTO NEW.status_id FROM public.cp_statuses s
    WHERE s.organization_id = NEW.organization_id AND s.is_system AND s.family = 'not_started' LIMIT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_statuses s WHERE s.id = NEW.status_id AND s.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'État introuvable';
  END IF;
  IF NEW.site_id IS NOT NULL THEN
    IF NEW.type <> 'site' THEN RAISE EXCEPTION 'Seul un projet de type chantier peut être relié à un chantier'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = NEW.site_id AND s.organization_id = NEW.organization_id) THEN
      RAISE EXCEPTION 'Chantier introuvable';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.cp_projects DROP COLUMN IF EXISTS program_id;
DROP TABLE IF EXISTS public.cp_programs;
