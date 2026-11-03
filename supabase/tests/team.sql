-- Équipe du projet (migration 52) : rôle, assignation limitée à l'équipe, désassignation, reprise des données. À lancer dans l'ordre de run.sh (après isolation.sql et rbac.sql).
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

-- Équipe du projet : rôle (responsable / membre), assignation limitée à l'équipe, désassignation en quittant l'équipe, reprise des données
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_projects (name, type) VALUES ('Équipe 1', 'rd'), ('Équipe 2', 'admin');
INSERT INTO public.cp_items (project_id, kind, name) SELECT id, 'task', 'E1-tâche' FROM public.cp_projects WHERE name = 'Équipe 1';
INSERT INTO public.cp_items (project_id, kind, name) SELECT id, 'task', 'E1-autre' FROM public.cp_projects WHERE name = 'Équipe 1';
INSERT INTO public.cp_items (project_id, kind, name) SELECT id, 'task', 'E2-tâche' FROM public.cp_projects WHERE name = 'Équipe 2';
INSERT INTO public.cp_project_members (project_id, user_id) SELECT id, :'ua'::uuid FROM public.cp_projects WHERE name = 'Équipe 1';
SELECT zz.check('sans rôle précisé, on est responsable (comme avant la migration)', (SELECT role FROM public.cp_project_members) = 'lead');
SELECT zz.check('rôle inconnu refusé', zz.raises(format('INSERT INTO public.cp_project_members (project_id, user_id, role) SELECT id, %L, ''chef'' FROM public.cp_projects WHERE name = ''Équipe 1''', :'uu')) IS NOT NULL);

-- Assignation : seulement l'équipe du projet
SELECT zz.check('assigner quelqu''un hors équipe : refusé avec un message clair', zz.raises(format('INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, %L FROM public.cp_items WHERE name = ''E1-tâche''', :'uu')) LIKE '%ne fait pas partie de l''équipe%');
SELECT zz.check('assigner un responsable de l''équipe : accepté', zz.raises(format('INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, %L FROM public.cp_items WHERE name = ''E1-tâche''', :'ua')) IS NULL);
SELECT zz.check('être dans l''équipe d''un autre projet ne suffit pas', zz.raises(format('INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, %L FROM public.cp_items WHERE name = ''E2-tâche''', :'ua')) LIKE '%ne fait pas partie de l''équipe%');
INSERT INTO public.cp_project_members (project_id, user_id, role) SELECT id, :'uu'::uuid, 'member' FROM public.cp_projects WHERE name = 'Équipe 1';
INSERT INTO public.cp_project_members (project_id, user_id, role) SELECT id, :'uu'::uuid, 'member' FROM public.cp_projects WHERE name = 'Équipe 2';
SELECT coalesce(zz.raises(format('INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, %L FROM public.cp_items WHERE name IN (''E1-tâche'', ''E1-autre'', ''E2-tâche'')', :'uu')), 'ok') AS e_member \gset
SELECT zz.check('un membre (pas responsable) peut être assigné', :'e_member' = 'ok'
  AND (SELECT count(*) FROM public.cp_item_members WHERE user_id = :'uu'::uuid) = 3);

-- Changer le rôle ne désassigne personne
UPDATE public.cp_project_members SET role = 'lead' WHERE user_id = :'uu'::uuid AND project_id = (SELECT id FROM public.cp_projects WHERE name = 'Équipe 1');
UPDATE public.cp_project_members SET role = 'member' WHERE user_id = :'uu'::uuid AND project_id = (SELECT id FROM public.cp_projects WHERE name = 'Équipe 1');
SELECT zz.check('membre → responsable → membre : les tâches assignées restent assignées', (SELECT count(*) FROM public.cp_item_members WHERE user_id = :'uu'::uuid) = 3
  AND (SELECT role FROM public.cp_project_members WHERE user_id = :'uu'::uuid AND project_id = (SELECT id FROM public.cp_projects WHERE name = 'Équipe 1')) = 'member');

-- Quitter l'équipe : désassigné de ce projet seulement
DELETE FROM public.cp_project_members WHERE user_id = :'uu'::uuid AND project_id = (SELECT id FROM public.cp_projects WHERE name = 'Équipe 1');
SELECT zz.check('quitter l''équipe d''un projet désassigne de toutes ses tâches', (SELECT count(*) FROM public.cp_item_members m JOIN public.cp_items i ON i.id = m.item_id WHERE m.user_id = :'uu'::uuid AND i.name IN ('E1-tâche', 'E1-autre')) = 0);
SELECT zz.check('…mais pas de celles d''un autre projet où la personne reste', (SELECT count(*) FROM public.cp_item_members m JOIN public.cp_items i ON i.id = m.item_id WHERE m.user_id = :'uu'::uuid AND i.name = 'E2-tâche') = 1);
SELECT zz.check('…et les autres membres de l''équipe gardent leurs tâches', (SELECT count(*) FROM public.cp_item_members m JOIN public.cp_items i ON i.id = m.item_id WHERE m.user_id = :'ua'::uuid AND i.name = 'E1-tâche') = 1);
SELECT zz.check('la personne retirée ne peut plus être réassignée', zz.raises(format('INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, %L FROM public.cp_items WHERE name = ''E1-autre''', :'uu')) LIKE '%ne fait pas partie de l''équipe%');

-- Collaborateur (lecture seule)
RESET ROLE;
SELECT id AS e1 FROM public.cp_projects WHERE name = 'Équipe 1' \gset
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U lit l''équipe avec les rôles', (SELECT count(*) FROM public.cp_project_members WHERE role IN ('lead', 'member')) >= 2);
SELECT zz.check('U ne change aucun rôle et ne retire personne', zz.affected($$UPDATE public.cp_project_members SET role = 'member'$$) = 0 AND zz.affected($$DELETE FROM public.cp_project_members$$) = 0
  AND zz.raises(format('INSERT INTO public.cp_project_members (project_id, user_id, role) VALUES (%L, %L, ''lead'')', :'e1', :'uu')) IS NOT NULL);
RESET ROLE;

-- Isolation : l'autre entreprise ne rejoint pas l'équipe, et n'y fait pas entrer des gens d'ailleurs
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B ne voit aucune équipe de A', (SELECT count(*) FROM public.cp_project_members) = 0);
SELECT zz.check('B n''ajoute personne à un projet de A', zz.raises(format('INSERT INTO public.cp_project_members (project_id, user_id, role) VALUES (%L, %L, ''member'')', :'e1', :'ub')) IS NOT NULL);
INSERT INTO public.cp_projects (name, type) VALUES ('Équipe B', 'admin');
SELECT zz.check('B ne met pas un collaborateur de A dans son équipe', zz.raises(format('INSERT INTO public.cp_project_members (project_id, user_id, role) SELECT id, %L, ''member'' FROM public.cp_projects WHERE name = ''Équipe B''', :'ua')) LIKE '%Personne introuvable%');
RESET ROLE;

-- Restauration : la règle d'équipe est suspendue (les tables se rechargent dans un ordre quelconque)
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('gomat.restoring', 'on', false);
SELECT zz.check('pendant une restauration, on recharge une assignation sans exiger l''équipe', zz.raises(format('INSERT INTO public.cp_item_members (item_id, user_id, organization_id) SELECT id, %L, organization_id FROM public.cp_items WHERE name = ''E1-autre''', :'uu')) IS NULL);
SELECT set_config('gomat.restoring', '', false);

-- Reprise des données : on rejoue la migration 52 telle quelle sur un état « ancien » (assigné sans être dans l'équipe)
SELECT zz.check('état ancien reconstitué : assigné mais hors équipe', (SELECT count(*) FROM public.cp_item_members m JOIN public.cp_items i ON i.id = m.item_id
  WHERE i.name = 'E1-autre' AND m.user_id = :'uu'::uuid) = 1
  AND NOT EXISTS (SELECT 1 FROM public.cp_project_members WHERE project_id = :'e1'::uuid AND user_id = :'uu'::uuid));
SELECT set_config('request.jwt.claim.sub', '', false);
\i ../migrations/20261103000052_pilote_equipe.sql
SELECT zz.check('la migration ajoute la personne assignée à l''équipe comme membre', (SELECT role FROM public.cp_project_members WHERE project_id = :'e1'::uuid AND user_id = :'uu'::uuid) = 'member');
SELECT zz.check('…sans toucher aux responsables existants', (SELECT role FROM public.cp_project_members WHERE project_id = :'e1'::uuid AND user_id = :'ua'::uuid) = 'lead');
SELECT zz.check('rejouer la migration ne change rien (idempotente)', (SELECT count(*) FROM public.cp_project_members WHERE project_id = :'e1'::uuid) = 2);

-- Supprimer un projet supprime son équipe et ses assignations
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
DELETE FROM public.cp_projects WHERE name = 'Équipe 1';
SELECT zz.check('supprimer un projet supprime son équipe et ses assignations', (SELECT count(*) FROM public.cp_project_members WHERE project_id = :'e1'::uuid) = 0
  AND (SELECT count(*) FROM public.cp_item_members m JOIN public.cp_items i ON i.id = m.item_id WHERE i.name IN ('E1-tâche', 'E1-autre')) = 0);
RESET ROLE;

SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.cp_projects WHERE name LIKE 'Équipe%';
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
