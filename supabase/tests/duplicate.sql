-- Dupliquer un projet (migration 56) : copie de l'arborescence, décalage des dates, remise à zéro, options, avis tus, droits, isolation, performance. À lancer dans l'ordre de run.sh (après isolation.sql et rbac.sql).
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

-- Préparation : un projet « Src » avec arborescence, dates, liste à cocher, dépendance, équipe, assignations
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_projects (name, type, description, priority, color, starts_on, ends_on, link_mode)
VALUES ('Src', 'rd', 'description d''origine', 'high', '#123456', '2027-03-01', '2027-06-30', 'keep_gap');
SELECT id AS src FROM public.cp_projects WHERE name = 'Src' \gset
SELECT id AS st_done FROM public.cp_statuses WHERE is_system AND family = 'done' \gset
INSERT INTO public.cp_items (project_id, kind, name, starts_on, ends_on, position) VALUES (:'src', 'phase', 'Phase', '2027-03-01', '2027-03-31', 0);
INSERT INTO public.cp_items (project_id, parent_id, kind, name, starts_on, ends_on, status_id, position)
  SELECT :'src', id, 'task', 'T1', '2027-03-01', '2027-03-10', :'st_done', 1 FROM public.cp_items WHERE name = 'Phase' AND project_id = :'src';
INSERT INTO public.cp_items (project_id, parent_id, kind, name, starts_on, ends_on, position)
  SELECT :'src', id, 'task', 'T2', '2027-03-11', '2027-03-20', 2 FROM public.cp_items WHERE name = 'Phase' AND project_id = :'src';
INSERT INTO public.cp_items (project_id, parent_id, kind, name, starts_on, ends_on, position)
  SELECT :'src', id, 'subtask', 'S', '2027-03-02', '2027-03-04', 0 FROM public.cp_items WHERE name = 'T1' AND project_id = :'src';
INSERT INTO public.cp_items (project_id, kind, name, starts_on, ends_on, position) VALUES (:'src', 'milestone', 'Jalon', '2027-06-30', '2027-06-30', 3);
INSERT INTO public.cp_items (project_id, kind, name, position) VALUES (:'src', 'task', 'Sans date', 4);
INSERT INTO public.cp_item_checks (item_id, label, done, position) SELECT id, 'Étape 1', true, 0 FROM public.cp_items WHERE name = 'T1' AND project_id = :'src';
INSERT INTO public.cp_item_checks (item_id, label, done, position) SELECT id, 'Étape 2', false, 1 FROM public.cp_items WHERE name = 'T1' AND project_id = :'src';
INSERT INTO public.cp_item_links (predecessor_id, successor_id)
  SELECT (SELECT id FROM public.cp_items WHERE name = 'T1' AND project_id = :'src'), (SELECT id FROM public.cp_items WHERE name = 'T2' AND project_id = :'src');
INSERT INTO public.cp_project_members (project_id, user_id, role) VALUES (:'src', :'ua', 'lead'), (:'src', :'uu', 'member');
INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, :'uu'::uuid FROM public.cp_items WHERE name = 'T1' AND project_id = :'src';
INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, :'ua'::uuid FROM public.cp_items WHERE name = 'T2' AND project_id = :'src';
RESET ROLE;
SELECT count(*) AS notifs_src FROM public.notifications WHERE cp_project_id = :'src'::uuid AND recipient_user_id = :'uu'::uuid \gset
SELECT zz.check('préparation : l''assignation normale prévient le membre (le test des avis tus n''est pas vide)', :notifs_src >= 1);

-- Copie 1 : nouveau début 2027-09-06 (+189 jours = 27 semaines exactement), équipe copiée, assignations non
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT public.cp_duplicate_project(:'src', '  Copie 1  ', '2027-09-06') AS c1 \gset
RESET ROLE;
SELECT zz.check('la copie existe, nom nettoyé, état « Pas commencé », mêmes type, priorité, couleur, réglage des dépendances', (
  SELECT p.name = 'Copie 1' AND p.type = 'rd' AND p.priority = 'high' AND p.color = '#123456' AND p.link_mode = 'keep_gap' AND p.description = 'description d''origine'
     AND s.family = 'not_started' FROM public.cp_projects p JOIN public.cp_statuses s ON s.id = p.status_id WHERE p.id = :'c1'::uuid));
SELECT zz.check('les dates du projet sont décalées de 189 jours', (SELECT starts_on = '2027-03-01'::date + 189 AND ends_on = '2027-06-30'::date + 189 FROM public.cp_projects WHERE id = :'c1'::uuid));
SELECT zz.check('6 éléments copiés, comme la source', (SELECT count(*) FROM public.cp_items WHERE project_id = :'c1'::uuid) = 6 AND (SELECT count(*) FROM public.cp_items WHERE project_id = :'src'::uuid) = 6);
SELECT zz.check('mêmes noms et mêmes types', (SELECT array_agg(kind || ':' || name ORDER BY name) FROM public.cp_items WHERE project_id = :'c1'::uuid) = (SELECT array_agg(kind || ':' || name ORDER BY name) FROM public.cp_items WHERE project_id = :'src'::uuid));
SELECT zz.check('même arborescence, rattachée aux COPIES (jamais aux originaux)', (
  SELECT bool_and(coalesce(pc.name, '') = coalesce(po.name, '') AND (c.parent_id IS NULL OR pc.project_id = :'c1'::uuid))
  FROM public.cp_items c JOIN public.cp_items o ON o.name = c.name AND o.project_id = :'src'::uuid
  LEFT JOIN public.cp_items pc ON pc.id = c.parent_id LEFT JOIN public.cp_items po ON po.id = o.parent_id
  WHERE c.project_id = :'c1'::uuid));
SELECT zz.check('dates des éléments décalées de 189 jours ; l''élément sans date reste sans date', (
  SELECT bool_and(CASE WHEN o.starts_on IS NULL THEN c.starts_on IS NULL AND c.ends_on IS NULL ELSE c.starts_on = o.starts_on + 189 AND c.ends_on = o.ends_on + 189 END)
  FROM public.cp_items c JOIN public.cp_items o ON o.name = c.name AND o.project_id = :'src'::uuid WHERE c.project_id = :'c1'::uuid));
SELECT zz.check('tous les éléments repartent de « Pas commencé » (même celui qui était terminé)', (
  SELECT bool_and(s.family = 'not_started') FROM public.cp_items i JOIN public.cp_statuses s ON s.id = i.status_id WHERE i.project_id = :'c1'::uuid)
  AND (SELECT s.family FROM public.cp_items i JOIN public.cp_statuses s ON s.id = i.status_id WHERE i.name = 'T1' AND i.project_id = :'src'::uuid) = 'done');
SELECT zz.check('liste à cocher copiée, tout remis à « non fait », ordre gardé', (
  SELECT array_agg(label || ':' || done ORDER BY k.position) FROM public.cp_item_checks k JOIN public.cp_items i ON i.id = k.item_id WHERE i.project_id = :'c1'::uuid) = ARRAY['Étape 1:false', 'Étape 2:false']
  AND (SELECT count(*) FROM public.cp_item_checks k JOIN public.cp_items i ON i.id = k.item_id WHERE i.project_id = :'src'::uuid AND k.done) = 1);
SELECT zz.check('la dépendance T1 → T2 est copiée entre les COPIES ; l''originale est intacte', (
  SELECT count(*) = 1 AND bool_and(a.project_id = :'c1'::uuid AND b.project_id = :'c1'::uuid AND a.name = 'T1' AND b.name = 'T2' AND l.project_id = :'c1'::uuid)
  FROM public.cp_item_links l JOIN public.cp_items a ON a.id = l.predecessor_id JOIN public.cp_items b ON b.id = l.successor_id WHERE l.project_id = :'c1'::uuid)
  AND (SELECT count(*) FROM public.cp_item_links WHERE project_id = :'src'::uuid) = 1);
SELECT zz.check('l''équipe est copiée avec ses rôles ; les assignations ne le sont pas par défaut', (
  SELECT array_agg(role ORDER BY role) FROM public.cp_project_members WHERE project_id = :'c1'::uuid) = ARRAY['lead', 'member']
  AND (SELECT count(*) FROM public.cp_item_members m JOIN public.cp_items i ON i.id = m.item_id WHERE i.project_id = :'c1'::uuid) = 0);
SELECT zz.check('la source est inchangée (dates, équipe, assignations)', (SELECT starts_on FROM public.cp_projects WHERE id = :'src'::uuid) = '2027-03-01'
  AND (SELECT count(*) FROM public.cp_project_members WHERE project_id = :'src'::uuid) = 2
  AND (SELECT count(*) FROM public.cp_item_members m JOIN public.cp_items i ON i.id = m.item_id WHERE i.project_id = :'src'::uuid) = 2
  AND (SELECT starts_on FROM public.cp_items WHERE name = 'T1' AND project_id = :'src'::uuid) = '2027-03-01');
SELECT zz.check('copier l''équipe n''a prévenu personne (avis « tu rejoins » tus), et le réglage ne reste pas posé', (SELECT count(*) FROM public.notifications WHERE cp_project_id = :'c1'::uuid) = 0
  AND coalesce(current_setting('gomat.cp_copy', true), '') IN ('', 'off'));

-- Copie 2 : avec les assignations, sans nouveau début (dates gardées) ; puis un avis normal arrive bien après
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT public.cp_duplicate_project(:'src', 'Copie 2', NULL, true, true) AS c2 \gset
RESET ROLE;
SELECT zz.check('sans nouveau début : les dates sont gardées telles quelles', (SELECT bool_and(c.starts_on IS NOT DISTINCT FROM o.starts_on AND c.ends_on IS NOT DISTINCT FROM o.ends_on)
  FROM public.cp_items c JOIN public.cp_items o ON o.name = c.name AND o.project_id = :'src'::uuid WHERE c.project_id = :'c2'::uuid)
  AND (SELECT starts_on FROM public.cp_projects WHERE id = :'c2'::uuid) = '2027-03-01');
SELECT zz.check('assignations copiées sur les COPIES, aux mêmes personnes, toujours sans avis', (
  SELECT array_agg(i.name || ':' || m.user_id::text ORDER BY i.name) FROM public.cp_item_members m JOIN public.cp_items i ON i.id = m.item_id WHERE i.project_id = :'c2'::uuid)
  = (SELECT array_agg(i.name || ':' || m.user_id::text ORDER BY i.name) FROM public.cp_item_members m JOIN public.cp_items i ON i.id = m.item_id WHERE i.project_id = :'src'::uuid)
  AND (SELECT count(*) FROM public.notifications WHERE cp_project_id = :'c2'::uuid) = 0);
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, :'uu'::uuid FROM public.cp_items WHERE name = 'T2' AND project_id = :'c2'::uuid;
RESET ROLE;
SELECT zz.check('après la copie, une assignation normale prévient de nouveau (le silence ne fuit pas)', (SELECT count(*) FROM public.notifications WHERE cp_project_id = :'c2'::uuid AND kind = 'cp_assigned') = 1);

-- Erreurs et cas limites
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('nom vide refusé', zz.raises(format('SELECT public.cp_duplicate_project(%L, ''   '')', :'src')) LIKE '%nom%');
SELECT zz.check('assignations sans équipe refusées', zz.raises(format('SELECT public.cp_duplicate_project(%L, ''X'', NULL, false, true)', :'src')) LIKE '%assignations%');
SELECT zz.check('projet inconnu refusé', zz.raises('SELECT public.cp_duplicate_project(gen_random_uuid(), ''X'')') LIKE '%introuvable%');
INSERT INTO public.cp_projects (name, type) VALUES ('Vide', 'admin');
SELECT id AS vide FROM public.cp_projects WHERE name = 'Vide' \gset
SELECT public.cp_duplicate_project(:'vide', 'Vide copie', '2027-01-01', false, false) AS cv \gset
RESET ROLE;
SELECT zz.check('un projet sans élément ni dates se copie (rien à décaler)', (SELECT count(*) FROM public.cp_projects WHERE id = :'cv'::uuid AND starts_on IS NULL) = 1 AND (SELECT count(*) FROM public.cp_items WHERE project_id = :'cv'::uuid) = 0);

-- Le chantier lié n'est pas copié (un chantier n'a qu'un projet)
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.sites (name) VALUES ('Chantier Dup');
INSERT INTO public.cp_projects (name, type, site_id) SELECT 'Src chantier', 'site', id FROM public.sites WHERE name = 'Chantier Dup';
SELECT public.cp_duplicate_project((SELECT id FROM public.cp_projects WHERE name = 'Src chantier'), 'Copie chantier') AS cs \gset
RESET ROLE;
SELECT zz.check('le chantier lié n''est pas copié (et la copie ne se heurte pas à la règle « un chantier, un projet »)', (SELECT site_id IS NULL AND type = 'site' FROM public.cp_projects WHERE id = :'cs'::uuid)
  AND (SELECT site_id IS NOT NULL FROM public.cp_projects WHERE name = 'Src chantier'));

-- Droits et isolation
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('un lecteur (sans droit de création) ne copie rien', zz.raises(format('SELECT public.cp_duplicate_project(%L, ''Piraté'')', :'src')) IS NOT NULL
  AND (SELECT count(*) FROM public.cp_projects WHERE name = 'Piraté') = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('l''autre entreprise ne copie pas un projet qu''elle ne voit pas', zz.raises(format('SELECT public.cp_duplicate_project(%L, ''Volé'')', :'src')) LIKE '%introuvable%'
  AND (SELECT count(*) FROM public.cp_projects WHERE name LIKE 'Copie%') = 0);
RESET ROLE;
SELECT zz.check('la fonction n''est pas ouverte au public anonyme', NOT has_function_privilege('anon', 'public.cp_duplicate_project(uuid, text, date, boolean, boolean)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.cp_duplicate_project(uuid, text, date, boolean, boolean)', 'EXECUTE'));

-- Performance : 20 phases et 180 tâches (200 éléments), une liste à cocher par tâche, des dépendances entre tâches voisines
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_projects (name, type, starts_on, ends_on) VALUES ('Gros', 'event', '2027-01-04', '2027-12-31');
SELECT id AS gros FROM public.cp_projects WHERE name = 'Gros' \gset
INSERT INTO public.cp_items (project_id, kind, name, starts_on, ends_on, position)
  SELECT :'gros', 'phase', 'Ph ' || g, '2027-01-04'::date + g * 10, '2027-01-04'::date + g * 10 + 8, g FROM generate_series(1, 20) g;
INSERT INTO public.cp_items (project_id, parent_id, kind, name, starts_on, ends_on, position)
  SELECT :'gros', p.id, 'task', 'T ' || p.position || '-' || g, p.starts_on + g, p.starts_on + g + 1, g
  FROM public.cp_items p, generate_series(1, 9) g WHERE p.project_id = :'gros' AND p.kind = 'phase';
INSERT INTO public.cp_item_checks (item_id, label, position) SELECT id, 'Étape', 0 FROM public.cp_items WHERE project_id = :'gros' AND kind = 'task';
INSERT INTO public.cp_item_links (predecessor_id, successor_id)
  SELECT a.id, b.id FROM public.cp_items a JOIN public.cp_items b ON b.project_id = a.project_id AND b.parent_id = a.parent_id AND b.position = a.position + 1
  WHERE a.project_id = :'gros' AND a.kind = 'task' AND a.position % 2 = 1 AND a.position < 9;
SELECT zz.check('préparation : 200 éléments, des listes à cocher et des dépendances', (SELECT count(*) FROM public.cp_items WHERE project_id = :'gros') = 200
  AND (SELECT count(*) FROM public.cp_item_links WHERE project_id = :'gros') >= 60);
SELECT clock_timestamp() AS t0 \gset
SELECT public.cp_duplicate_project(:'gros', 'Gros copie', '2028-01-03', true, true) AS cg \gset
SELECT extract(epoch FROM clock_timestamp() - :'t0'::timestamptz) AS secondes \gset
RESET ROLE;
SELECT zz.check('copie de 200 éléments en moins de 1,5 seconde (mesuré : ' || :'secondes' || ' s)', :secondes::numeric < 1.5);
SELECT zz.check('la grosse copie est complète (éléments, listes, dépendances) et les dates suivent', (SELECT count(*) FROM public.cp_items WHERE project_id = :'cg'::uuid) = 200
  AND (SELECT count(*) FROM public.cp_item_checks k JOIN public.cp_items i ON i.id = k.item_id WHERE i.project_id = :'cg'::uuid) = 180
  AND (SELECT count(*) FROM public.cp_item_links WHERE project_id = :'cg'::uuid) = (SELECT count(*) FROM public.cp_item_links WHERE project_id = :'gros'::uuid)
  AND (SELECT min(starts_on) FROM public.cp_items WHERE project_id = :'cg'::uuid) = (SELECT min(starts_on) FROM public.cp_items WHERE project_id = :'gros'::uuid) + ('2028-01-03'::date - '2027-01-04'::date));

-- Ménage
SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.notifications WHERE cp_project_id IN (SELECT id FROM public.cp_projects WHERE name IN ('Src', 'Copie 1', 'Copie 2', 'Vide', 'Vide copie', 'Src chantier', 'Copie chantier', 'Gros', 'Gros copie'));
DELETE FROM public.cp_projects WHERE name IN ('Src', 'Copie 1', 'Copie 2', 'Vide', 'Vide copie', 'Src chantier', 'Copie chantier', 'Gros', 'Gros copie');
DELETE FROM public.sites WHERE name = 'Chantier Dup';
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
