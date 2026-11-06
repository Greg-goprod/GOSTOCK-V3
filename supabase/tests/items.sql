-- R3a : éléments de projet (phase, tâche, jalon, sous-tâche), responsables, liste à cocher (niveaux, droits, isolation). À lancer APRÈS isolation.sql.
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
SELECT id AS uu FROM public.users WHERE email = 'u@iso.test' AND organization_id = :ORG1::uuid \gset
SELECT id AS ub FROM public.users WHERE email = 'b@iso.test' AND organization_id = :ORG2::uuid \gset
INSERT INTO public.organization_modules (organization_id, module_key) VALUES (:ORG1::uuid, 'cp.projects'), (:ORG2::uuid, 'cp.projects') ON CONFLICT DO NOTHING;

-- Outil : crée un élément et renvoie NULL ou le message d'erreur
CREATE FUNCTION pg_temp.item(p_project text, p_parent text, p_kind text, p_name text, p_from date DEFAULT NULL, p_to date DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.cp_items (project_id, parent_id, kind, name, starts_on, ends_on)
  VALUES ((SELECT id FROM public.cp_projects WHERE name = p_project), (SELECT id FROM public.cp_items WHERE name = p_parent), p_kind, p_name, p_from, p_to);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN SQLERRM;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.item(text, text, text, text, date, date) TO authenticated;

-- Préparation par l'administrateur de l'entreprise 1
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_projects (name, type) VALUES ('Projet X', 'rd'), ('Projet Y', 'rd');
SELECT zz.check('droits cp.projects aussi sur les éléments : A crée une phase', pg_temp.item('Projet X', NULL, 'phase', 'Étude', '2027-02-01', '2027-03-31') IS NULL);
SELECT zz.check('tâche sous la phase', pg_temp.item('Projet X', 'Étude', 'task', 'Cahier des charges', '2027-02-01', '2027-02-15') IS NULL);
SELECT zz.check('sous-tâche sous la tâche', pg_temp.item('Projet X', 'Cahier des charges', 'subtask', 'Relecture', '2027-02-10', '2027-02-12') IS NULL);
SELECT zz.check('jalon sous la phase', pg_temp.item('Projet X', 'Étude', 'milestone', 'Validation étude', '2027-03-31', '2027-03-31') IS NULL);
SELECT zz.check('tâche directement sous le projet (phase facultative)', pg_temp.item('Projet X', NULL, 'task', 'Tâche libre', '2027-04-01', '2027-04-05') IS NULL);
SELECT zz.check('jalon directement sous le projet', pg_temp.item('Projet X', NULL, 'milestone', 'Lancement', '2027-05-01', '2027-05-01') IS NULL);
SELECT zz.check('jalon sans date (plateau « sans date »)', pg_temp.item('Projet X', NULL, 'milestone', 'Jalon à dater') IS NULL);
SELECT zz.check('tâche sans date acceptée', pg_temp.item('Projet X', NULL, 'task', 'Tâche à dater') IS NULL);
SELECT zz.check('sans état précisé, l''élément est « Pas commencé »', (SELECT bool_and(s.family = 'not_started' AND s.is_system) FROM public.cp_items i JOIN public.cp_statuses s ON s.id = i.status_id));
SELECT zz.check('journal d''audit : les éléments y figurent', (SELECT count(*) FROM public.audit_log WHERE table_name = 'cp_items' AND action = 'insert') = 8);

-- Règles de niveaux
SELECT zz.check('phase sous une tâche : refusée', pg_temp.item('Projet X', 'Cahier des charges', 'phase', 'Phase mal placée') LIKE '%directement sous le projet%');
SELECT zz.check('phase sous une phase : refusée', pg_temp.item('Projet X', 'Étude', 'phase', 'Phase sous phase') LIKE '%directement sous le projet%');
SELECT zz.check('tâche sous une tâche : refusée', pg_temp.item('Projet X', 'Cahier des charges', 'task', 'Tâche sous tâche') LIKE '%sous une phase ou directement%');
SELECT zz.check('jalon sous une tâche : refusé', pg_temp.item('Projet X', 'Cahier des charges', 'milestone', 'Jalon sous tâche') IS NOT NULL);
SELECT zz.check('sous-tâche directement sous le projet : refusée', pg_temp.item('Projet X', NULL, 'subtask', 'Sous-tâche seule') LIKE '%sous une tâche%');
SELECT zz.check('sous-tâche sous une phase : refusée', pg_temp.item('Projet X', 'Étude', 'subtask', 'Sous-tâche sous phase') LIKE '%sous une tâche%');
SELECT zz.check('sous-tâche sous une sous-tâche : refusée (pas de 6e niveau)', pg_temp.item('Projet X', 'Relecture', 'subtask', 'Sous-sous-tâche') LIKE '%sous une tâche%');
SELECT zz.check('rien sous un jalon', pg_temp.item('Projet X', 'Validation étude', 'subtask', 'Sous le jalon') IS NOT NULL AND pg_temp.item('Projet X', 'Validation étude', 'task', 'Tâche sous jalon') IS NOT NULL);
SELECT zz.check('parent d''un autre projet : refusé', pg_temp.item('Projet Y', 'Étude', 'task', 'Tâche mal rattachée') LIKE '%même projet%');
SELECT zz.check('type inconnu refusé', pg_temp.item('Projet X', NULL, 'epic', 'Bizarre') IS NOT NULL);
SELECT zz.check('nom vide refusé', pg_temp.item('Projet X', NULL, 'task', '  ') IS NOT NULL);
SELECT zz.check('fin avant début refusée', pg_temp.item('Projet X', NULL, 'task', 'Inversée', '2027-05-10', '2027-05-01') IS NOT NULL);
SELECT zz.check('jalon sur deux jours différents refusé', pg_temp.item('Projet X', NULL, 'milestone', 'Jalon étalé', '2027-05-01', '2027-05-03') IS NOT NULL);
SELECT zz.check('priorité inconnue refusée', zz.raises($$INSERT INTO public.cp_items (project_id, kind, name, priority) SELECT id, 'task', 'Urgent', 'critique' FROM public.cp_projects WHERE name = 'Projet X'$$) IS NOT NULL);

-- Modifications
SELECT zz.check('le type ne change pas', zz.raises($$UPDATE public.cp_items SET kind = 'milestone' WHERE name = 'Tâche libre'$$) LIKE '%ne change pas%');
SELECT zz.check('l''élément ne change pas de projet', zz.raises($$UPDATE public.cp_items SET project_id = (SELECT id FROM public.cp_projects WHERE name = 'Projet Y') WHERE name = 'Tâche libre'$$) LIKE '%ne change pas de projet%');
SELECT zz.check('une tâche peut changer de phase (même projet)', zz.raises($$UPDATE public.cp_items SET parent_id = (SELECT id FROM public.cp_items WHERE name = 'Étude') WHERE name = 'Tâche libre'$$) IS NULL);
SELECT zz.check('une tâche peut revenir sous le projet', zz.raises($$UPDATE public.cp_items SET parent_id = NULL WHERE name = 'Tâche libre'$$) IS NULL);
SELECT zz.check('une tâche ne devient pas son propre parent', zz.raises($$UPDATE public.cp_items SET parent_id = id WHERE name = 'Tâche libre'$$) IS NOT NULL);
SELECT zz.check('une sous-tâche ne passe pas sous une phase', zz.raises($$UPDATE public.cp_items SET parent_id = (SELECT id FROM public.cp_items WHERE name = 'Étude') WHERE name = 'Relecture'$$) IS NOT NULL);
SELECT pg_sleep(0.02);
UPDATE public.cp_items SET description = 'Mise à jour' WHERE name = 'Cahier des charges';
SELECT zz.check('la date de modification suit', (SELECT updated_at > created_at FROM public.cp_items WHERE name = 'Cahier des charges'));
UPDATE public.cp_items SET status_id = (SELECT id FROM public.cp_statuses WHERE is_system AND family = 'done') WHERE name = 'Relecture';
SELECT zz.check('un état utilisé par un élément ne se supprime pas', zz.raises($$DELETE FROM public.cp_statuses WHERE is_system AND family = 'done'$$) IS NOT NULL);

-- Responsables et liste à cocher
-- Depuis la migration 52, on n'assigne qu'une personne de l'équipe du projet
INSERT INTO public.cp_project_members (project_id, user_id, role) SELECT id, :'ua'::uuid, 'lead' FROM public.cp_projects WHERE name = 'Projet X';
INSERT INTO public.cp_project_members (project_id, user_id, role) SELECT id, :'uu'::uuid, 'member' FROM public.cp_projects WHERE name = 'Projet X';
INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, :'ua'::uuid FROM public.cp_items WHERE name = 'Cahier des charges';
INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, :'uu'::uuid FROM public.cp_items WHERE name = 'Cahier des charges';
SELECT zz.check('un élément a plusieurs responsables', (SELECT count(*) FROM public.cp_item_members) = 2);
SELECT zz.check('le même responsable deux fois : refusé', zz.raises(format('INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, %L FROM public.cp_items WHERE name = ''Cahier des charges''', :'ua')) IS NOT NULL);
INSERT INTO public.cp_item_checks (item_id, label, position) SELECT id, 'Rédiger le plan', 0 FROM public.cp_items WHERE name = 'Cahier des charges';
INSERT INTO public.cp_item_checks (item_id, label, position, done) SELECT id, 'Valider avec le client', 1, true FROM public.cp_items WHERE name = 'Cahier des charges';
SELECT zz.check('liste à cocher : 2 lignes dont 1 cochée', (SELECT count(*) FROM public.cp_item_checks) = 2 AND (SELECT count(*) FROM public.cp_item_checks WHERE done) = 1);
SELECT zz.check('ligne à cocher vide refusée', zz.raises($$INSERT INTO public.cp_item_checks (item_id, label) SELECT id, ' ' FROM public.cp_items WHERE name = 'Cahier des charges'$$) IS NOT NULL);
SELECT zz.affected($$UPDATE public.cp_item_checks SET done = true WHERE label = 'Rédiger le plan'$$) AS n_coche \gset
SELECT zz.check('cocher une ligne', :n_coche = 1 AND (SELECT count(*) FROM public.cp_item_checks WHERE done) = 2);

-- Décalage en bloc (migration 50)
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'Étude'), 3) AS n_shift \gset
SELECT zz.check('décaler une phase décale la phase et ses 3 descendants (4 lignes)', :n_shift = 4);
SELECT zz.check('dates après décalage de +3 jours : phase, tâche, sous-tâche, jalon', (SELECT array_agg(name || ':' || starts_on || ':' || ends_on ORDER BY name) FROM public.cp_items WHERE name IN ('Étude', 'Cahier des charges', 'Relecture', 'Validation étude'))
  = ARRAY['Cahier des charges:2027-02-04:2027-02-18', 'Relecture:2027-02-13:2027-02-15', 'Validation étude:2027-04-03:2027-04-03', 'Étude:2027-02-04:2027-04-03']);
SELECT zz.check('ce qui est hors de la phase ne bouge pas', (SELECT starts_on = '2027-04-01' AND ends_on = '2027-04-05' FROM public.cp_items WHERE name = 'Tâche libre') AND (SELECT starts_on = '2027-05-01' FROM public.cp_items WHERE name = 'Lancement'));
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'Étude'), -3) AS n_back \gset
SELECT zz.check('décaler de -3 jours remet les dates d''origine', :n_back = 4 AND (SELECT starts_on = '2027-02-01' AND ends_on = '2027-03-31' FROM public.cp_items WHERE name = 'Étude')
  AND (SELECT starts_on = '2027-03-31' AND ends_on = '2027-03-31' FROM public.cp_items WHERE name = 'Validation étude'));
SELECT zz.check('un jalon décalé reste sur un seul jour', (SELECT bool_and(starts_on = ends_on) FROM public.cp_items WHERE kind = 'milestone' AND starts_on IS NOT NULL));
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'Relecture'), 1) AS n_leaf \gset
SELECT zz.check('décaler une sous-tâche ne décale qu''elle (1 ligne)', :n_leaf = 1 AND (SELECT starts_on = '2027-02-11' FROM public.cp_items WHERE name = 'Relecture') AND (SELECT starts_on = '2027-02-01' FROM public.cp_items WHERE name = 'Cahier des charges'));
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'Relecture'), -1) AS n_leaf2 \gset
SELECT public.cp_shift_project((SELECT id FROM public.cp_projects WHERE name = 'Projet X'), 10) AS n_proj \gset
SELECT zz.check('décaler un projet décale le projet et ses 8 éléments, 9 lignes (le projet sans dates reste sans dates)', :n_proj = 9 AND (SELECT starts_on IS NULL AND ends_on IS NULL FROM public.cp_projects WHERE name = 'Projet X')
  AND (SELECT starts_on = '2027-02-11' AND ends_on = '2027-04-10' FROM public.cp_items WHERE name = 'Étude'));
SELECT zz.check('les éléments sans date restent sans date après décalage', (SELECT bool_and(starts_on IS NULL AND ends_on IS NULL) FROM public.cp_items WHERE name IN ('Jalon à dater', 'Tâche à dater')));
SELECT public.cp_shift_project((SELECT id FROM public.cp_projects WHERE name = 'Projet X'), -10) AS n_proj2 \gset
SELECT zz.check('décalage 0 refusé', zz.raises($$SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'Étude'), 0)$$) LIKE '%décalage%');
SELECT zz.check('décalage de plus de 10 ans refusé', zz.raises($$SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'Étude'), 4000)$$) LIKE '%trop grand%');
SELECT zz.check('élément ou projet inconnu refusé', zz.raises($$SELECT public.cp_shift_item(gen_random_uuid(), 1)$$) LIKE '%introuvable%' AND zz.raises($$SELECT public.cp_shift_project(gen_random_uuid(), 1)$$) LIKE '%introuvable%');
SELECT zz.check('le journal d''audit garde les décalages', (SELECT count(*) FROM public.audit_log WHERE table_name = 'cp_items' AND action = 'update') >= 4);

-- Collaborateur (rôle système « user ») : lit, n'écrit pas
RESET ROLE;
SELECT id AS free_id FROM public.cp_items WHERE name = 'Tâche libre' \gset
SELECT id AS proj_a FROM public.cp_projects WHERE name = 'Projet X' \gset
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U lit éléments, responsables et liste à cocher', (SELECT count(*) FROM public.cp_items) = 8 AND (SELECT count(*) FROM public.cp_item_members) = 2 AND (SELECT count(*) FROM public.cp_item_checks) = 2);
SELECT zz.check('U ne décale rien (lecture seule)', zz.raises(format('SELECT public.cp_shift_item(%L, 2)', :'free_id')) LIKE '%non autorisée%' AND zz.raises(format('SELECT public.cp_shift_project(%L, 2)', :'proj_a')) LIKE '%non autorisée%');
SELECT zz.check('U ne crée pas d''élément', pg_temp.item('Projet X', NULL, 'task', 'Piraté') IS NOT NULL);
SELECT zz.check('U ne crée ni responsable ni ligne à cocher', zz.raises(format('INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, %L FROM public.cp_items WHERE name = ''Tâche libre''', :'uu')) IS NOT NULL
  AND zz.raises($$INSERT INTO public.cp_item_checks (item_id, label) SELECT id, 'Piraté' FROM public.cp_items WHERE name = 'Tâche libre'$$) IS NOT NULL);
SELECT zz.check('U ne modifie ni ne supprime rien', zz.affected($$UPDATE public.cp_items SET name = 'Piraté'$$) = 0 AND zz.affected($$DELETE FROM public.cp_items$$) = 0
  AND zz.affected($$UPDATE public.cp_item_checks SET done = false$$) = 0 AND zz.affected($$DELETE FROM public.cp_item_members$$) = 0);
RESET ROLE;

-- Isolation : l'entreprise B
SELECT id AS item_a FROM public.cp_items WHERE name = 'Étude' \gset
SELECT id AS free_id FROM public.cp_items WHERE name = 'Tâche libre' \gset
SELECT id AS task_a FROM public.cp_items WHERE name = 'Cahier des charges' \gset
SELECT id AS proj_a FROM public.cp_projects WHERE name = 'Projet X' \gset
SELECT id AS status_a FROM public.cp_statuses WHERE is_system AND family = 'done' AND organization_id = :ORG1::uuid \gset
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B ne voit rien des éléments de A', (SELECT count(*) FROM public.cp_items) = 0 AND (SELECT count(*) FROM public.cp_item_members) = 0 AND (SELECT count(*) FROM public.cp_item_checks) = 0);
SELECT zz.check('B ne crée pas d''élément dans un projet de A', zz.raises(format('INSERT INTO public.cp_items (project_id, kind, name) VALUES (%L, ''task'', ''Volé'')', :'proj_a')) IS NOT NULL);
INSERT INTO public.cp_projects (name, type) VALUES ('Projet B éléments', 'admin');
SELECT zz.check('B ne rattache pas un élément à un parent de A', zz.raises(format('INSERT INTO public.cp_items (project_id, parent_id, kind, name) SELECT id, %L, ''task'', ''Volé'' FROM public.cp_projects WHERE name = ''Projet B éléments''', :'item_a')) IS NOT NULL);
SELECT zz.check('B n''utilise pas un état de A', zz.raises(format('INSERT INTO public.cp_items (project_id, kind, name, status_id) SELECT id, ''task'', ''Volé'', %L FROM public.cp_projects WHERE name = ''Projet B éléments''', :'status_a')) IS NOT NULL);
INSERT INTO public.cp_items (project_id, kind, name) SELECT id, 'phase', 'Phase de B' FROM public.cp_projects WHERE name = 'Projet B éléments';
SELECT zz.check('B crée ses éléments, état par défaut de B', (SELECT count(*) FROM public.cp_items) = 1 AND (SELECT s.organization_id = :ORG2::uuid AND s.family = 'not_started' FROM public.cp_items i JOIN public.cp_statuses s ON s.id = i.status_id));
SELECT zz.check('B ne désigne pas un responsable de A', zz.raises(format('INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, %L FROM public.cp_items', :'uu')) IS NOT NULL);
SELECT zz.check('B n''ajoute pas de responsable ni de ligne à cocher à un élément de A', zz.raises(format('INSERT INTO public.cp_item_members (item_id, user_id) VALUES (%L, %L)', :'task_a', :'ub')) IS NOT NULL
  AND zz.raises(format('INSERT INTO public.cp_item_checks (item_id, label) VALUES (%L, ''Volé'')', :'task_a')) IS NOT NULL);
SELECT zz.check('B ne décale rien chez A (élément et projet introuvables pour lui)', zz.raises(format('SELECT public.cp_shift_item(%L, 2)', :'free_id')) LIKE '%introuvable%' AND zz.raises(format('SELECT public.cp_shift_project(%L, 2)', :'proj_a')) LIKE '%introuvable%');
SELECT zz.check('B ne modifie ni ne supprime rien chez A', zz.affected($$UPDATE public.cp_items SET name = 'Piraté' WHERE name <> 'Phase de B'$$) = 0 AND zz.affected($$DELETE FROM public.cp_items WHERE name <> 'Phase de B'$$) = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A ne voit pas la phase de B', (SELECT count(*) FROM public.cp_items WHERE name = 'Phase de B') = 0);

-- Suppressions en cascade
DELETE FROM public.cp_items WHERE name = 'Cahier des charges';
SELECT zz.check('supprimer une tâche supprime sa sous-tâche, ses responsables et sa liste à cocher', (SELECT count(*) FROM public.cp_items WHERE name IN ('Cahier des charges', 'Relecture')) = 0
  AND (SELECT count(*) FROM public.cp_item_members) = 0 AND (SELECT count(*) FROM public.cp_item_checks) = 0);
DELETE FROM public.cp_items WHERE name = 'Étude';
SELECT zz.check('supprimer une phase supprime ses tâches et jalons', (SELECT count(*) FROM public.cp_items WHERE name IN ('Étude', 'Validation étude')) = 0 AND (SELECT count(*) FROM public.cp_items WHERE name = 'Lancement') = 1);
DELETE FROM public.cp_projects WHERE name = 'Projet X';
SELECT zz.check('supprimer un projet supprime tous ses éléments', (SELECT count(*) FROM public.cp_items) = 0);
RESET ROLE;
-- Restauration : les contrôles sont suspendus (données déjà contrôlées autrefois)
SELECT set_config('gomat.restoring', 'on', false);
SELECT zz.check('pendant une restauration, l''ordre des lignes du fichier n''est pas contrôlé', zz.raises($$INSERT INTO public.cp_items (id, organization_id, project_id, parent_id, kind, name, status_id) SELECT gen_random_uuid(), p.organization_id, p.id, NULL, 'subtask', 'Restaurée', (SELECT id FROM public.cp_statuses WHERE organization_id = p.organization_id AND family = 'not_started' LIMIT 1) FROM public.cp_projects p WHERE p.name = 'Projet Y'$$) IS NULL);
SELECT set_config('gomat.restoring', '', false);
SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.cp_items;
SELECT set_config('app.org_guard_off', '', false);
-- On remet les modules comme avant (les batteries suivantes comptent les modules)
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
