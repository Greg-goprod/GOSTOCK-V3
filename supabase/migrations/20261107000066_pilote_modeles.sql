/*
  PILOTE P3 : modèles de projet.

  Un modèle est un projet marqué « is_template » : mêmes phases, tâches, jalons, sous-tâches, dépendances et listes à cocher qu'un projet,
  mais il n'a ni équipe ni assignation, ne figure pas dans le Gantt ni dans les listes de projets (l'écran « Modèles » les montre à part),
  et n'envoie aucun avis (les avis d'échéance et d'assignation passent par les responsables, qu'un modèle ne peut pas avoir).

  - cp_projects.is_template (faux par défaut). La marque ne se pose ni ne s'enlève par une écriture directe : seules les fonctions
    ci-dessous la posent (réglage local à la transaction « gomat.cp_template_op »). Un modèle n'est jamais relié à un chantier.
  - cp_save_as_template(projet, nom) : copie un projet en modèle (même moteur que la duplication : une requête par niveau, aucune
    équipe, aucune assignation, état « Pas commencé », dates gardées pour fixer les écarts).
  - cp_create_from_template(modèle, nom, début) : crée un vrai projet à partir d'un modèle, dates décalées sur le nouveau début.
  - cp_seed_starter_templates() : crée, À LA DEMANDE de la personne, trois modèles de départ (montage d'un événement, recrutement,
    conception / R&D) s'ils n'existent pas déjà sous le même nom dans son entreprise. Rien n'est créé automatiquement.
  - Un modèle refuse toute équipe et toute assignation (déclencheurs).

  Sécurité : toutes les fonctions s'exécutent avec les droits de la personne (SECURITY INVOKER) : il faut le droit de création sur les
  projets, éléments, dépendances ; l'isolation par entreprise et les contrôles de ligne existants s'appliquent à chaque ligne.
*/
ALTER TABLE public.cp_projects ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;
ALTER TABLE public.cp_projects DROP CONSTRAINT IF EXISTS cp_projects_template_no_site;
ALTER TABLE public.cp_projects ADD CONSTRAINT cp_projects_template_no_site CHECK (NOT is_template OR site_id IS NULL);
CREATE INDEX IF NOT EXISTS cp_projects_template_idx ON public.cp_projects (organization_id) WHERE is_template;

-- 1. La marque « modèle » ne change que par les fonctions de modèle ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cp_template_flag_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' OR current_setting('gomat.cp_template_op', true) = 'on' THEN RETURN NEW; END IF;
  IF (TG_OP = 'INSERT' AND NEW.is_template) OR (TG_OP = 'UPDATE' AND NEW.is_template IS DISTINCT FROM OLD.is_template) THEN
    RAISE EXCEPTION 'Un modèle se crée avec « Enregistrer comme modèle » ; sa marque ne se change pas à la main';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS a_cp_template_flag_guard ON public.cp_projects;
CREATE TRIGGER a_cp_template_flag_guard BEFORE INSERT OR UPDATE ON public.cp_projects FOR EACH ROW EXECUTE FUNCTION public.cp_template_flag_guard();

-- 2. Un modèle n'a ni équipe ni assignation --------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cp_template_no_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_project uuid;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'cp_project_members' THEN v_project := NEW.project_id;
  ELSE SELECT i.project_id INTO v_project FROM public.cp_items i WHERE i.id = NEW.item_id; END IF;
  IF EXISTS (SELECT 1 FROM public.cp_projects p WHERE p.id = v_project AND p.is_template) THEN
    RAISE EXCEPTION 'Un modèle n''a ni équipe ni assignations : crée un projet à partir du modèle pour cela';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_template_no_members() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS a_cp_template_no_members ON public.cp_project_members;
CREATE TRIGGER a_cp_template_no_members BEFORE INSERT ON public.cp_project_members FOR EACH ROW EXECUTE FUNCTION public.cp_template_no_members();
DROP TRIGGER IF EXISTS a_cp_template_no_members ON public.cp_item_members;
CREATE TRIGGER a_cp_template_no_members BEFORE INSERT ON public.cp_item_members FOR EACH ROW EXECUTE FUNCTION public.cp_template_no_members();

-- 3. Enregistrer un projet comme modèle -------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cp_save_as_template(p_project uuid, p_name text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_new uuid;
  v_prev text := current_setting('gomat.cp_template_op', true);
BEGIN
  IF btrim(coalesce(p_name, '')) = '' THEN RAISE EXCEPTION 'Donne un nom au modèle'; END IF;
  PERFORM set_config('gomat.cp_template_op', 'on', true);
  v_new := public.cp_duplicate_project(p_project, p_name, NULL, false, false);
  UPDATE public.cp_projects SET is_template = true WHERE id = v_new;
  PERFORM set_config('gomat.cp_template_op', coalesce(v_prev, ''), true);
  RETURN v_new;
END;
$$;

-- 4. Créer un projet à partir d'un modèle ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cp_create_from_template(p_template uuid, p_name text, p_start date)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cp_projects WHERE id = p_template) THEN RAISE EXCEPTION 'Modèle introuvable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_projects WHERE id = p_template AND is_template) THEN RAISE EXCEPTION 'Ce projet n''est pas un modèle'; END IF;
  RETURN public.cp_duplicate_project(p_template, p_name, p_start, false, false);
END;
$$;

-- 5. Modèles de départ (à la demande) -----------------------------------------------------------------------------------------------
-- Construit un modèle à partir d'un plan : éléments (code, parent, type, nom, jour de début, durée en jours, liste à cocher) et dépendances (codes).
-- Les jours sont comptés depuis un lundi de référence ; le projet créé à partir du modèle décale tout sur son propre début.
CREATE OR REPLACE FUNCTION public.cp_build_template(p_name text, p_type text, p_color text, p_description text, p_plan jsonb, p_links jsonb)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_base constant date := DATE '2027-01-04';
  v_status uuid;
  v_project uuid;
  v_item uuid;
  v_ids jsonb := '{}'::jsonb;
  e jsonb;
  c text;
  l jsonb;
  n integer := 0;
  v_first integer;
  v_last integer;
  v_prev_op text := current_setting('gomat.cp_template_op', true);
  v_prev_copy text := current_setting('gomat.cp_copy', true);
BEGIN
  SELECT s.id INTO v_status FROM public.cp_statuses s WHERE s.is_system AND s.family = 'not_started' LIMIT 1;
  IF v_status IS NULL THEN RAISE EXCEPTION 'État « Pas commencé » introuvable'; END IF;
  SELECT min((x->>'start')::integer), max((x->>'start')::integer + greatest((x->>'days')::integer - 1, 0)) INTO v_first, v_last FROM jsonb_array_elements(p_plan) x;
  PERFORM set_config('gomat.cp_template_op', 'on', true);
  PERFORM set_config('gomat.cp_copy', 'on', true);
  INSERT INTO public.cp_projects (name, type, description, status_id, color, starts_on, ends_on, is_template)
  VALUES (p_name, p_type, p_description, v_status, p_color, v_base + v_first, v_base + v_last, true) RETURNING id INTO v_project;
  FOR e IN SELECT * FROM jsonb_array_elements(p_plan) LOOP
    n := n + 1;
    INSERT INTO public.cp_items (project_id, parent_id, kind, name, status_id, starts_on, ends_on, position)
    VALUES (v_project, (v_ids->>(e->>'parent'))::uuid, e->>'kind', e->>'name', v_status,
            v_base + (e->>'start')::integer, v_base + (e->>'start')::integer + greatest((e->>'days')::integer - 1, 0), n)
    RETURNING id INTO v_item;
    v_ids := v_ids || jsonb_build_object(e->>'code', v_item);
    IF e ? 'checks' THEN
      INSERT INTO public.cp_item_checks (item_id, label, position)
      SELECT v_item, t.label, t.ord FROM jsonb_array_elements_text(e->'checks') WITH ORDINALITY AS t(label, ord);
    END IF;
  END LOOP;
  FOR l IN SELECT * FROM jsonb_array_elements(p_links) LOOP
    INSERT INTO public.cp_item_links (predecessor_id, successor_id) VALUES ((v_ids->>(l->>0))::uuid, (v_ids->>(l->>1))::uuid);
  END LOOP;
  PERFORM set_config('gomat.cp_template_op', coalesce(v_prev_op, ''), true);
  PERFORM set_config('gomat.cp_copy', coalesce(v_prev_copy, ''), true);
  RETURN v_project;
END;
$$;
-- Droits de la personne (INVOKER) : elle ne peut rien créer que ses droits sur les projets ne lui permettent déjà ; la fonction doit rester appelable par cp_seed_starter_templates
REVOKE ALL ON FUNCTION public.cp_build_template(text, text, text, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_build_template(text, text, text, text, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.cp_seed_starter_templates()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cp_projects WHERE is_template AND name = 'Montage d''un événement') THEN
    PERFORM public.cp_build_template('Montage d''un événement', 'event', '#8b5cf6',
      'Du repérage au bilan : préparation, montage, exploitation, démontage. À adapter à ton évènement.',
      jsonb_build_array(
        jsonb_build_object('code','prep','parent',NULL,'kind','phase','name','Préparation','start',0,'days',20),
        jsonb_build_object('code','plan','parent','prep','kind','task','name','Repérage et plan d''implantation','start',0,'days',5,'checks',jsonb_build_array('Visiter le site','Relever les accès et les contraintes','Valider le plan avec le client')),
        jsonb_build_object('code','tech','parent','prep','kind','task','name','Cahier technique et besoins en matériel','start',5,'days',5,'checks',jsonb_build_array('Lister le matériel nécessaire','Vérifier la disponibilité en stock')),
        jsonb_build_object('code','order','parent','prep','kind','task','name','Commandes et réservations (matériel, véhicules)','start',10,'days',5),
        jsonb_build_object('code','staff','parent','prep','kind','task','name','Planning des équipes et des prestataires','start',10,'days',5),
        jsonb_build_object('code','safe','parent','prep','kind','task','name','Autorisations et plan de sécurité','start',15,'days',5),
        jsonb_build_object('code','mont','parent',NULL,'kind','phase','name','Montage','start',20,'days',14),
        jsonb_build_object('code','deliv','parent','mont','kind','task','name','Livraisons et chargement','start',20,'days',2),
        jsonb_build_object('code','struct','parent','mont','kind','task','name','Montage des structures et de la scène','start',22,'days',4),
        jsonb_build_object('code','audio','parent','mont','kind','task','name','Montage son, lumière et vidéo','start',26,'days',5),
        jsonb_build_object('code','test','parent','mont','kind','task','name','Tests et répétitions','start',31,'days',3),
        jsonb_build_object('code','expl','parent',NULL,'kind','phase','name','Exploitation','start',34,'days',4),
        jsonb_build_object('code','open','parent','expl','kind','milestone','name','Ouverture au public','start',34,'days',0),
        jsonb_build_object('code','run','parent','expl','kind','task','name','Exploitation','start',34,'days',4),
        jsonb_build_object('code','demo','parent',NULL,'kind','phase','name','Démontage','start',38,'days',8),
        jsonb_build_object('code','dem','parent','demo','kind','task','name','Démontage','start',38,'days',4),
        jsonb_build_object('code','ret','parent','demo','kind','task','name','Retour du matériel et contrôle','start',42,'days',3,'checks',jsonb_build_array('Pointer le matériel rendu','Signaler les casses et les pertes')),
        jsonb_build_object('code','close','parent','demo','kind','milestone','name','Bilan et clôture','start',45,'days',0)),
      jsonb_build_array(jsonb_build_array('order','deliv'), jsonb_build_array('deliv','struct'), jsonb_build_array('struct','audio'), jsonb_build_array('audio','test'),
                        jsonb_build_array('test','run'), jsonb_build_array('run','dem'), jsonb_build_array('dem','ret')));
    v_count := v_count + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cp_projects WHERE is_template AND name = 'Recrutement') THEN
    PERFORM public.cp_build_template('Recrutement', 'recruitment', '#10b981',
      'De la fiche de poste au premier mois d''intégration. À adapter au poste.',
      jsonb_build_array(
        jsonb_build_object('code','def','parent',NULL,'kind','phase','name','Définition du besoin','start',0,'days',7),
        jsonb_build_object('code','fiche','parent','def','kind','task','name','Rédiger la fiche de poste','start',0,'days',4),
        jsonb_build_object('code','valid','parent','def','kind','task','name','Valider le budget et le profil','start',4,'days',3),
        jsonb_build_object('code','src','parent',NULL,'kind','phase','name','Sourcing','start',7,'days',21),
        jsonb_build_object('code','pub','parent','src','kind','task','name','Publier l''annonce','start',7,'days',2),
        jsonb_build_object('code','net','parent','src','kind','task','name','Chercher dans le réseau et auprès de cabinets','start',9,'days',12),
        jsonb_build_object('code','cv','parent','src','kind','task','name','Présélectionner les candidatures','start',21,'days',7),
        jsonb_build_object('code','int','parent',NULL,'kind','phase','name','Entretiens','start',28,'days',21),
        jsonb_build_object('code','tel','parent','int','kind','task','name','Entretiens téléphoniques','start',28,'days',7),
        jsonb_build_object('code','ent','parent','int','kind','task','name','Entretiens en personne','start',35,'days',7),
        jsonb_build_object('code','ref','parent','int','kind','task','name','Tests et vérification des références','start',42,'days',7),
        jsonb_build_object('code','dec','parent',NULL,'kind','phase','name','Décision','start',49,'days',8),
        jsonb_build_object('code','offre','parent','dec','kind','task','name','Faire l''offre et négocier','start',49,'days',7),
        jsonb_build_object('code','sign','parent','dec','kind','milestone','name','Contrat signé','start',56,'days',0),
        jsonb_build_object('code','integ','parent',NULL,'kind','phase','name','Intégration','start',57,'days',44),
        jsonb_build_object('code','prep','parent','integ','kind','task','name','Préparer le poste, le matériel et les accès','start',57,'days',14,'checks',jsonb_build_array('Commander le matériel','Créer les comptes et les accès','Préparer le programme du premier jour')),
        jsonb_build_object('code','first','parent','integ','kind','milestone','name','Premier jour','start',71,'days',0),
        jsonb_build_object('code','month','parent','integ','kind','task','name','Point à un mois','start',100,'days',1)),
      jsonb_build_array(jsonb_build_array('fiche','valid'), jsonb_build_array('valid','pub'), jsonb_build_array('pub','net'), jsonb_build_array('net','cv'), jsonb_build_array('cv','tel'),
                        jsonb_build_array('tel','ent'), jsonb_build_array('ent','ref'), jsonb_build_array('ref','offre')));
    v_count := v_count + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cp_projects WHERE is_template AND name = 'Conception / R&D') THEN
    PERFORM public.cp_build_template('Conception / R&D', 'rd', '#3b82f6',
      'Du cadrage à la décision Go / No-go. À adapter au produit.',
      jsonb_build_array(
        jsonb_build_object('code','cad','parent',NULL,'kind','phase','name','Cadrage','start',0,'days',14),
        jsonb_build_object('code','need','parent','cad','kind','task','name','Recueillir le besoin et les contraintes','start',0,'days',7),
        jsonb_build_object('code','spec','parent','cad','kind','task','name','Rédiger les spécifications','start',7,'days',7),
        jsonb_build_object('code','conc','parent',NULL,'kind','phase','name','Conception','start',14,'days',28),
        jsonb_build_object('code','concept','parent','conc','kind','task','name','Explorer des concepts','start',14,'days',14),
        jsonb_build_object('code','rev','parent','conc','kind','task','name','Revue de conception','start',28,'days',2),
        jsonb_build_object('code','det','parent','conc','kind','task','name','Conception détaillée','start',30,'days',12),
        jsonb_build_object('code','proto','parent',NULL,'kind','phase','name','Prototype','start',42,'days',28),
        jsonb_build_object('code','build','parent','proto','kind','task','name','Réaliser le prototype','start',42,'days',21),
        jsonb_build_object('code','essai','parent','proto','kind','task','name','Essais et mesures','start',63,'days',7),
        jsonb_build_object('code','val','parent',NULL,'kind','phase','name','Validation','start',70,'days',14),
        jsonb_build_object('code','corr','parent','val','kind','task','name','Corrections','start',70,'days',7),
        jsonb_build_object('code','go','parent','val','kind','milestone','name','Décision Go / No-go','start',77,'days',0),
        jsonb_build_object('code','doc','parent','val','kind','task','name','Documentation et transfert','start',78,'days',6)),
      jsonb_build_array(jsonb_build_array('need','spec'), jsonb_build_array('spec','concept'), jsonb_build_array('concept','rev'), jsonb_build_array('rev','det'),
                        jsonb_build_array('det','build'), jsonb_build_array('build','essai'), jsonb_build_array('essai','corr'), jsonb_build_array('corr','go'), jsonb_build_array('go','doc')));
    v_count := v_count + 1;
  END IF;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cp_save_as_template(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cp_create_from_template(uuid, text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cp_seed_starter_templates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_save_as_template(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cp_create_from_template(uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cp_seed_starter_templates() TO authenticated;
