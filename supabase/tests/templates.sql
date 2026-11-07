-- P3 : modèles de projet (marque protégée, copie, création depuis un modèle, modèles de départ, droits, isolation). À lancer APRÈS isolation.sql.
\set ON_ERROR_STOP on
\set A '''a0000000-0000-0000-0000-00000000000a'''
\set B '''b0000000-0000-0000-0000-00000000000b'''
\set U '''d0000000-0000-0000-0000-00000000000d'''
\set ORG1 '''00000000-0000-0000-0000-000000000001'''
SELECT id AS org2 FROM public.organizations WHERE name = 'Entreprise B' \gset
\set ORG2 '''':org2''''
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.headers', '', false);
SELECT set_config('request.jwt.claims', '{}', false);
DROP SCHEMA IF EXISTS zz CASCADE;
CREATE SCHEMA zz;
CREATE TABLE zz.results (n serial, name text, ok boolean, detail text);
GRANT USAGE ON SCHEMA zz TO authenticated;
CREATE FUNCTION zz.check(p_name text, p_ok boolean, p_detail text DEFAULT NULL) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ INSERT INTO zz.results (name, ok, detail) VALUES (p_name, COALESCE(p_ok, false), p_detail) $$;
CREATE FUNCTION zz.raises(p_sql text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN EXECUTE p_sql; RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM; END $$;
CREATE FUNCTION zz.count(p_sql text) RETURNS integer LANGUAGE plpgsql AS $$ DECLARE n integer; BEGIN EXECUTE 'SELECT count(*) FROM (' || p_sql || ') s' INTO n; RETURN n; END $$;
CREATE FUNCTION zz.affected(p_sql text) RETURNS integer LANGUAGE plpgsql AS $$ DECLARE n integer; BEGIN EXECUTE p_sql; GET DIAGNOSTICS n = ROW_COUNT; RETURN n; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO authenticated;

-- rbac.sql laisse U avec un rôle personnalisé : on le remet dans son rôle système
UPDATE public.users SET rbac_role_id = (SELECT id FROM public.rbac_roles WHERE system_key = 'user' AND organization_id = :ORG1::uuid) WHERE email = 'u@iso.test';


SELECT id AS ua FROM public.users WHERE email = 'a@iso.test' AND organization_id = :ORG1::uuid \gset
SELECT id AS ub FROM public.users WHERE email = 'b@iso.test' AND organization_id = :ORG2::uuid \gset
INSERT INTO public.organization_modules (organization_id, module_key) VALUES (:ORG1::uuid, 'cp.projects'), (:ORG2::uuid, 'cp.projects') ON CONFLICT DO NOTHING;

-- Outils : un élément (nom unique), une dépendance (renvoie NULL ou le message d'erreur), les dates d'un élément
CREATE FUNCTION pg_temp.mk(p_project text, p_name text, p_kind text, p_parent text, p_from date, p_to date) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.cp_items (project_id, parent_id, kind, name, starts_on, ends_on)
  VALUES ((SELECT id FROM public.cp_projects WHERE name = p_project), (SELECT id FROM public.cp_items WHERE name = p_parent), p_kind, p_name, p_from, p_to);
END $$;
CREATE FUNCTION pg_temp.lk(p_pred text, p_succ text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.cp_item_links (predecessor_id, successor_id, project_id)
  VALUES ((SELECT id FROM public.cp_items WHERE name = p_pred), (SELECT id FROM public.cp_items WHERE name = p_succ), (SELECT project_id FROM public.cp_items WHERE name = p_pred));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN SQLERRM;
END $$;
CREATE FUNCTION pg_temp.d(p_name text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(starts_on::text, '-') || '→' || coalesce(ends_on::text, '-') FROM public.cp_items WHERE name = p_name $$;
GRANT EXECUTE ON FUNCTION pg_temp.mk(text, text, text, text, date, date), pg_temp.lk(text, text), pg_temp.d(text) TO authenticated;

SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;

SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_projects (name, type, starts_on, ends_on, color) VALUES ('Projet Source', 'event', '2027-03-01', '2027-03-31', '#ff0000');
SELECT pg_temp.mk('Projet Source', 'S-Ph', 'phase', NULL, '2027-03-01', '2027-03-20');
SELECT pg_temp.mk('Projet Source', 'S-T1', 'task', 'S-Ph', '2027-03-01', '2027-03-05');
SELECT pg_temp.mk('Projet Source', 'S-T2', 'task', 'S-Ph', '2027-03-08', '2027-03-12');
SELECT pg_temp.mk('Projet Source', 'S-M', 'milestone', NULL, '2027-03-31', '2027-03-31');
SELECT coalesce(pg_temp.lk('S-T1', 'S-T2'), 'ok') AS e_l \gset
INSERT INTO public.cp_item_checks (item_id, label, done) SELECT id, 'Case à cocher', true FROM public.cp_items WHERE name = 'S-T1';
INSERT INTO public.cp_project_members (project_id, user_id, role) SELECT p.id, :'ua'::uuid, 'lead' FROM public.cp_projects p WHERE p.name = 'Projet Source';
INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, :'ua'::uuid FROM public.cp_items WHERE name = 'S-T1';
SELECT zz.check('préparation : la source a équipe, assignation, dépendance, case cochée', :'e_l' = 'ok' AND (SELECT count(*) FROM public.cp_project_members) = 1 AND (SELECT count(*) FROM public.cp_item_members) = 1);

-- 0b. Un collaborateur (sans droit de création) ne peut pas créer les modèles de départ : aucun n'existe encore, l'insertion est refusée
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U ne crée pas les modèles de départ (refusé par les droits)', zz.raises($$SELECT public.cp_seed_starter_templates()$$) IS NOT NULL);
SELECT zz.check('aucun modèle n''a été créé par ce refus', (SELECT count(*) FROM public.cp_projects WHERE is_template) = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;

-- 1. Enregistrer comme modèle
SELECT public.cp_save_as_template((SELECT id FROM public.cp_projects WHERE name = 'Projet Source'), 'Modèle test') AS tpl \gset
SELECT zz.check('le modèle existe, marqué modèle', (SELECT is_template FROM public.cp_projects WHERE id = :'tpl'::uuid));
SELECT zz.check('la source n''est pas touchée (pas modèle, équipe et assignations gardées)', NOT (SELECT is_template FROM public.cp_projects WHERE name = 'Projet Source') AND (SELECT count(*) FROM public.cp_project_members) = 1 AND (SELECT count(*) FROM public.cp_item_members) = 1);
SELECT zz.check('même arborescence : 4 éléments, 1 dépendance, 1 case', (SELECT count(*) FROM public.cp_items WHERE project_id = :'tpl'::uuid) = 4 AND (SELECT count(*) FROM public.cp_item_links WHERE project_id = :'tpl'::uuid) = 1 AND (SELECT count(*) FROM public.cp_item_checks c JOIN public.cp_items i ON i.id = c.item_id WHERE i.project_id = :'tpl'::uuid) = 1);
SELECT zz.check('la case est remise à « non fait »', NOT (SELECT done FROM public.cp_item_checks c JOIN public.cp_items i ON i.id = c.item_id WHERE i.project_id = :'tpl'::uuid));
SELECT zz.check('le modèle n''a ni équipe ni assignation', (SELECT count(*) FROM public.cp_project_members WHERE project_id = :'tpl'::uuid) = 0 AND (SELECT count(*) FROM public.cp_item_members m JOIN public.cp_items i ON i.id = m.item_id WHERE i.project_id = :'tpl'::uuid) = 0);
SELECT zz.check('dates gardées telles quelles, état « Pas commencé »', (SELECT starts_on::text || ends_on::text FROM public.cp_projects WHERE id = :'tpl'::uuid) = '2027-03-012027-03-31' AND (SELECT s.family FROM public.cp_projects p JOIN public.cp_statuses s ON s.id = p.status_id WHERE p.id = :'tpl'::uuid) = 'not_started');
SELECT zz.check('nom vide refusé', zz.raises($$SELECT public.cp_save_as_template((SELECT id FROM public.cp_projects WHERE name = 'Projet Source'), '   ')$$) LIKE '%nom%');
SELECT zz.check('projet inconnu refusé', zz.raises($$SELECT public.cp_save_as_template(gen_random_uuid(), 'X')$$) LIKE '%introuvable%');
SELECT zz.check('journal d''audit : le modèle y figure', (SELECT count(*) FROM public.audit_log WHERE table_name = 'cp_projects' AND action = 'insert') >= 2);

-- 2. La marque ne se manipule pas à la main
SELECT zz.check('marquer un projet comme modèle à la main : refusé', zz.raises($$UPDATE public.cp_projects SET is_template = true WHERE name = 'Projet Source'$$) LIKE '%Enregistrer comme modèle%');
SELECT zz.check('créer directement un modèle : refusé', zz.raises($$INSERT INTO public.cp_projects (name, type, is_template) VALUES ('Faux modèle', 'rd', true)$$) LIKE '%Enregistrer comme modèle%');
SELECT zz.check('retirer la marque à la main : refusé', zz.raises(format('UPDATE public.cp_projects SET is_template = false WHERE id = %L', :'tpl')) LIKE '%Enregistrer comme modèle%');
SELECT zz.check('renommer un modèle reste possible', zz.affected(format('UPDATE public.cp_projects SET name = %L WHERE id = %L', 'Modèle renommé', :'tpl')) = 1);

-- 3. Pas d'équipe ni d'assignation sur un modèle ; pas de chantier
SELECT zz.check('équipe refusée sur un modèle', zz.raises(format('INSERT INTO public.cp_project_members (project_id, user_id, role) VALUES (%L, %L, %L)', :'tpl', :'ua', 'lead')) LIKE '%ni équipe ni assignations%');
SELECT id AS tpl_item FROM public.cp_items WHERE project_id = :'tpl'::uuid AND name = 'S-T1' \gset
SELECT zz.check('assignation refusée sur un élément de modèle', zz.raises(format('INSERT INTO public.cp_item_members (item_id, user_id) VALUES (%L, %L)', :'tpl_item', :'ua')) LIKE '%ni équipe ni assignations%');
SELECT zz.check('un modèle ne se relie pas à un chantier', zz.raises(format('UPDATE public.cp_projects SET site_id = (SELECT id FROM public.sites LIMIT 1) WHERE id = %L', :'tpl')) IS NOT NULL);

-- 4. Créer un projet depuis le modèle (début décalé : 2027-03-01 → 2027-06-07, soit +98 jours)
SELECT public.cp_create_from_template(:'tpl'::uuid, 'Projet issu du modèle', '2027-06-07') AS np \gset
SELECT zz.check('le nouveau projet n''est pas un modèle', NOT (SELECT is_template FROM public.cp_projects WHERE id = :'np'::uuid));
SELECT zz.check('dates décalées de 98 jours (projet et éléments)', (SELECT starts_on::text || ends_on::text FROM public.cp_projects WHERE id = :'np'::uuid) = '2027-06-072027-07-07'
  AND (SELECT starts_on::text || ends_on::text FROM public.cp_items WHERE project_id = :'np'::uuid AND name = 'S-T2') = '2027-06-142027-06-18'
  AND (SELECT starts_on::text FROM public.cp_items WHERE project_id = :'np'::uuid AND name = 'S-M') = '2027-07-07');
SELECT zz.check('arborescence, dépendance et case copiées ; aucune équipe', (SELECT count(*) FROM public.cp_items WHERE project_id = :'np'::uuid) = 4 AND (SELECT count(*) FROM public.cp_item_links WHERE project_id = :'np'::uuid) = 1
  AND (SELECT count(*) FROM public.cp_project_members WHERE project_id = :'np'::uuid) = 0);
SELECT zz.check('le modèle reste intact après usage', (SELECT count(*) FROM public.cp_items WHERE project_id = :'tpl'::uuid) = 4 AND (SELECT starts_on::text FROM public.cp_projects WHERE id = :'tpl'::uuid) = '2027-03-01');
SELECT zz.check('créer depuis un projet ordinaire : refusé', zz.raises($$SELECT public.cp_create_from_template((SELECT id FROM public.cp_projects WHERE name = 'Projet Source'), 'X', '2027-01-01')$$) LIKE '%pas un modèle%');
SELECT zz.check('modèle inconnu refusé', zz.raises($$SELECT public.cp_create_from_template(gen_random_uuid(), 'X', '2027-01-01')$$) LIKE '%introuvable%');
SELECT zz.check('nom vide refusé', zz.raises(format('SELECT public.cp_create_from_template(%L, %L, %L)', :'tpl', ' ', '2027-01-01')) LIKE '%nom%');
SELECT zz.check('les avis ne partent pas à la création (aucune notification d''assignation)', (SELECT count(*) FROM public.notifications WHERE kind IN ('cp_assigned', 'cp_team_added')) = 0);

-- 5. Modèles de départ
SELECT public.cp_seed_starter_templates() AS n1 \gset
SELECT zz.check('trois modèles de départ créés', :n1 = 3 AND (SELECT count(*) FROM public.cp_projects WHERE is_template AND name IN ('Montage d''un événement', 'Recrutement', 'Conception / R&D')) = 3);
SELECT public.cp_seed_starter_templates() AS n2 \gset
SELECT zz.check('rejouer ne crée rien de plus', :n2 = 0 AND (SELECT count(*) FROM public.cp_projects WHERE is_template AND name IN ('Montage d''un événement', 'Recrutement', 'Conception / R&D')) = 3);
SELECT zz.check('« Montage d''un événement » : 18 éléments (4 phases, 14 tâches/jalons), 7 dépendances, 2 jalons', (SELECT count(*) FROM public.cp_items i JOIN public.cp_projects p ON p.id = i.project_id WHERE p.name = 'Montage d''un événement') = 18
  AND (SELECT count(*) FROM public.cp_item_links l JOIN public.cp_projects p ON p.id = l.project_id WHERE p.name = 'Montage d''un événement') = 7
  AND (SELECT count(*) FROM public.cp_items i JOIN public.cp_projects p ON p.id = i.project_id WHERE p.name = 'Montage d''un événement' AND i.kind = 'milestone') = 2);
SELECT zz.check('« Recrutement » : 18 éléments, 8 dépendances', (SELECT count(*) FROM public.cp_items i JOIN public.cp_projects p ON p.id = i.project_id WHERE p.name = 'Recrutement') = 18
  AND (SELECT count(*) FROM public.cp_item_links l JOIN public.cp_projects p ON p.id = l.project_id WHERE p.name = 'Recrutement') = 8);
SELECT zz.check('« Conception / R&D » : 14 éléments, 9 dépendances', (SELECT count(*) FROM public.cp_items i JOIN public.cp_projects p ON p.id = i.project_id WHERE p.name = 'Conception / R&D') = 14
  AND (SELECT count(*) FROM public.cp_item_links l JOIN public.cp_projects p ON p.id = l.project_id WHERE p.name = 'Conception / R&D') = 9);
SELECT zz.check('modèles de départ : aucune équipe, dates cohérentes (fin ≥ début, jalons d''un jour), la case à cocher du modèle d''événement est là',
  (SELECT count(*) FROM public.cp_project_members m JOIN public.cp_projects p ON p.id = m.project_id WHERE p.is_template AND p.name IN ('Montage d''un événement', 'Recrutement', 'Conception / R&D')) = 0
  AND NOT EXISTS (SELECT 1 FROM public.cp_items i JOIN public.cp_projects p ON p.id = i.project_id WHERE p.is_template AND (i.ends_on < i.starts_on OR (i.kind = 'milestone' AND i.ends_on <> i.starts_on)))
  AND (SELECT count(*) FROM public.cp_item_checks c JOIN public.cp_items i ON i.id = c.item_id JOIN public.cp_projects p ON p.id = i.project_id WHERE p.name = 'Montage d''un événement') = 7);
SELECT zz.check('les liens des modèles de départ n''ont décalé aucune date (aucun chevauchement : le premier jalon reste au jour 34)', (SELECT i.starts_on::text FROM public.cp_items i JOIN public.cp_projects p ON p.id = i.project_id WHERE p.name = 'Montage d''un événement' AND i.name = 'Ouverture au public') = '2027-02-07'
  AND (SELECT i.starts_on::text FROM public.cp_items i JOIN public.cp_projects p ON p.id = i.project_id WHERE p.name = 'Montage d''un événement' AND i.name = 'Tests et répétitions') = '2027-02-04');
SELECT public.cp_create_from_template((SELECT id FROM public.cp_projects WHERE name = 'Recrutement' AND is_template), 'Recrutement technicien', '2027-09-06') AS rp \gset
SELECT zz.check('un projet se crée depuis un modèle de départ, début au 6 septembre', (SELECT starts_on::text FROM public.cp_projects WHERE id = :'rp'::uuid) = '2027-09-06' AND (SELECT count(*) FROM public.cp_items WHERE project_id = :'rp'::uuid) = 18);
RESET ROLE;

-- 6. Les échéances n'écrivent rien pour un modèle
SELECT public.check_cp_deadlines() AS dl \gset
SELECT zz.check('les rappels d''échéance ignorent les modèles (aucun avis pour un élément de modèle)', (SELECT count(*) FROM public.notifications n JOIN public.cp_items i ON i.id = n.cp_item_id JOIN public.cp_projects p ON p.id = i.project_id WHERE p.is_template) = 0);

-- 7. Collaborateur : voit les modèles, n'en crée pas
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U voit les modèles (lecture)', (SELECT count(*) FROM public.cp_projects WHERE is_template) = 4);
SELECT zz.check('U n''enregistre pas de modèle', zz.raises($$SELECT public.cp_save_as_template((SELECT id FROM public.cp_projects WHERE name = 'Projet Source'), 'Intrus')$$) IS NOT NULL);
SELECT zz.check('U ne crée pas de projet depuis un modèle', zz.raises($$SELECT public.cp_create_from_template((SELECT id FROM public.cp_projects WHERE name = 'Recrutement' AND is_template), 'Intrus', '2027-01-01')$$) IS NOT NULL);
SELECT zz.check('U relançant les modèles de départ : rien de nouveau (ils existent déjà)', public.cp_seed_starter_templates() = 0 AND (SELECT count(*) FROM public.cp_projects WHERE is_template) = 4);
RESET ROLE;

-- 8. Isolation : l'entreprise B
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B ne voit aucun modèle de A', (SELECT count(*) FROM public.cp_projects WHERE is_template) = 0);
SELECT zz.check('B ne crée pas un projet depuis un modèle de A', zz.raises(format('SELECT public.cp_create_from_template(%L, %L, %L)', :'tpl', 'Vol', '2027-01-01')) LIKE '%introuvable%');
SELECT public.cp_seed_starter_templates() AS nb \gset
SELECT zz.check('B crée ses propres modèles de départ (le nom existe chez A, sans effet sur B)', :nb = 3 AND (SELECT count(*) FROM public.cp_projects WHERE is_template) = 3);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A ne voit pas les modèles de B (4 modèles de A, pas 7)', (SELECT count(*) FROM public.cp_projects WHERE is_template) = 4);
RESET ROLE;

-- 9. anonyme
GRANT USAGE ON SCHEMA zz TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO anon;
SET ROLE anon;
SELECT zz.check('anon n''exécute aucune fonction de modèle', zz.raises($$SELECT public.cp_seed_starter_templates()$$) IS NOT NULL AND zz.raises($$SELECT public.cp_save_as_template(gen_random_uuid(), 'X')$$) IS NOT NULL);
RESET ROLE;

-- 10. Restauration : la marque passe (données déjà contrôlées)
SELECT set_config('gomat.restoring', 'on', false);
SELECT zz.check('pendant une restauration, un modèle peut être rétabli', zz.affected($$INSERT INTO public.cp_projects (name, type, is_template, organization_id) SELECT 'Modèle restauré', 'rd', true, organization_id FROM public.cp_projects WHERE name = 'Projet Source'$$) = 1);
SELECT set_config('gomat.restoring', '', false);

SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.cp_items; DELETE FROM public.cp_projects;
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
