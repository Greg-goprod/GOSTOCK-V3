-- R3c : dépendances entre éléments et décalage en cascade (règles, modes, droits, isolation). À lancer APRÈS isolation.sql.
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
INSERT INTO public.cp_projects (name, type) VALUES ('Projet L', 'rd'), ('Projet G', 'rd'), ('Projet N', 'rd'), ('Projet S', 'rd');
UPDATE public.cp_projects SET link_mode = 'keep_gap', link_skip_weekends = false WHERE name = 'Projet G';
UPDATE public.cp_projects SET link_mode = 'none' WHERE name = 'Projet N';
SELECT zz.check('réglages par défaut d''un projet : décaler si chevauchement, éviter les week-ends', (SELECT link_mode = 'overlap' AND link_skip_weekends FROM public.cp_projects WHERE name = 'Projet L'));
SELECT zz.check('mode de dépendance inconnu refusé', zz.raises($$UPDATE public.cp_projects SET link_mode = 'magique' WHERE name = 'Projet L'$$) IS NOT NULL);

-- 2027-03-01 est un lundi : le 06 est un samedi, le 07 un dimanche
SELECT pg_temp.mk('Projet L', 'L-A', 'task', NULL, '2027-03-01', '2027-03-05');
SELECT pg_temp.mk('Projet L', 'L-B', 'task', NULL, '2027-03-03', '2027-03-08');
SELECT pg_temp.mk('Projet L', 'L-C', 'task', NULL, '2027-03-10', '2027-03-12');
SELECT pg_temp.mk('Projet L', 'L-U', 'task', NULL, NULL, NULL);
SELECT pg_temp.mk('Projet L', 'L-Ph', 'phase', NULL, '2027-04-05', '2027-04-30');
SELECT pg_temp.mk('Projet L', 'L-Ph-t', 'task', 'L-Ph', '2027-04-06', '2027-04-09');

-- Règles de création
SELECT coalesce(pg_temp.lk('L-A', 'L-B'), 'ok') AS e_ab \gset
SELECT zz.check('A crée une dépendance A → B', :'e_ab' = 'ok');
SELECT zz.check('à la création, B (qui chevauchait A) est décalé : début le lendemain de la fin de A, ramené au lundi, même durée', pg_temp.d('L-B') = '2027-03-08→2027-03-13');
SELECT zz.check('même dépendance deux fois : refusée', pg_temp.lk('L-A', 'L-B') IS NOT NULL);
SELECT zz.check('un élément ne dépend pas de lui-même', pg_temp.lk('L-A', 'L-A') IS NOT NULL);
SELECT zz.check('dépendance inverse (B → A) : refusée, boucle', pg_temp.lk('L-B', 'L-A') LIKE '%boucle%');
SELECT zz.check('une phase ne dépend pas de ce qu''elle contient, ni l''inverse', pg_temp.lk('L-Ph', 'L-Ph-t') LIKE '%parent%' AND pg_temp.lk('L-Ph-t', 'L-Ph') LIKE '%parent%');
SELECT pg_temp.mk('Projet G', 'G-P', 'task', NULL, '2027-03-01', '2027-03-05');
SELECT zz.check('deux éléments de projets différents : refusé', pg_temp.lk('L-A', 'G-P') LIKE '%même projet%');
SELECT zz.check('élément inconnu refusé', zz.raises($$INSERT INTO public.cp_item_links (predecessor_id, successor_id, project_id) SELECT id, gen_random_uuid(), project_id FROM public.cp_items WHERE name = 'L-A'$$) IS NOT NULL);
SELECT zz.check('journal d''audit : la dépendance y figure', (SELECT count(*) FROM public.audit_log WHERE table_name = 'cp_item_links' AND action = 'insert') >= 1);

-- Mode « seulement si chevauchement » + éviter les week-ends : cascade sur la chaîne A → B → C
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'L-A'), 7) AS n1 \gset
SELECT zz.check('A +7 jours : A 8→12 ; B chevauche, il passe au lundi 15 (le 13 est un samedi), même durée', pg_temp.d('L-A') = '2027-03-08→2027-03-12' AND pg_temp.d('L-B') = '2027-03-15→2027-03-20');
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'L-A'), -7) AS n2 \gset
SELECT zz.check('A reculé de 7 jours : B n''est pas ramené en arrière (on ne décale que pour résoudre un chevauchement)', pg_temp.d('L-A') = '2027-03-01→2027-03-05' AND pg_temp.d('L-B') = '2027-03-15→2027-03-20');
SELECT coalesce(pg_temp.lk('L-B', 'L-C'), 'ok') AS e_bc \gset
SELECT zz.check('dépendance B → C : C (qui chevauchait B) passe au lundi 22', :'e_bc' = 'ok' AND pg_temp.d('L-C') = '2027-03-22→2027-03-24');
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'L-A'), 14) AS n3 \gset
SELECT zz.check('A +14 jours : la cascade suit toute la chaîne (B au 22, C au 29 : un dimanche devient lundi)', pg_temp.d('L-A') = '2027-03-15→2027-03-19' AND pg_temp.d('L-B') = '2027-03-22→2027-03-27' AND pg_temp.d('L-C') = '2027-03-29→2027-03-31');
SELECT zz.check('C → A : refusé (boucle sur trois éléments)', pg_temp.lk('L-C', 'L-A') LIKE '%boucle%');
SELECT public.cp_shift_project((SELECT id FROM public.cp_projects WHERE name = 'Projet L'), -14) AS n4 \gset
SELECT zz.check('décaler tout le projet de -14 jours : chaque élément bouge de 14 jours, sans double décalage', pg_temp.d('L-A') = '2027-03-01→2027-03-05' AND pg_temp.d('L-B') = '2027-03-08→2027-03-13' AND pg_temp.d('L-C') = '2027-03-15→2027-03-17');

-- Élément sans date, dépendance supprimée, élément supprimé
SELECT coalesce(pg_temp.lk('L-A', 'L-U'), 'ok') AS e_au \gset
SELECT zz.check('dépendance vers un élément sans date : rien n''est décalé', :'e_au' = 'ok' AND pg_temp.d('L-U') = '-→-');
SELECT zz.affected($$DELETE FROM public.cp_item_links WHERE successor_id = (SELECT id FROM public.cp_items WHERE name = 'L-C')$$) AS n_del \gset
SELECT zz.check('supprimer une dépendance ne touche pas aux dates', :n_del = 1 AND pg_temp.d('L-C') = '2027-03-15→2027-03-17');
SELECT count(*) AS avant FROM public.cp_item_links WHERE predecessor_id = (SELECT id FROM public.cp_items WHERE name = 'L-A') \gset
SELECT zz.affected($$DELETE FROM public.cp_items WHERE name = 'L-U'$$) AS n_del2 \gset
SELECT zz.check('supprimer un élément supprime ses dépendances (A → B reste, A → sans date part)', :n_del2 = 1 AND :avant = 2 AND (SELECT count(*) FROM public.cp_item_links WHERE predecessor_id = (SELECT id FROM public.cp_items WHERE name = 'L-A')) = 1);

-- Successeur avec contenu (projet S, réglages par défaut)
SELECT pg_temp.mk('Projet S', 'S-R', 'task', NULL, '2027-03-01', '2027-03-15');
SELECT pg_temp.mk('Projet S', 'S-Ph', 'phase', NULL, '2027-03-10', '2027-03-20');
SELECT pg_temp.mk('Projet S', 'S-Ph-t', 'task', 'S-Ph', '2027-03-12', '2027-03-14');
SELECT coalesce(pg_temp.lk('S-R', 'S-Ph'), 'ok') AS e_s \gset
SELECT zz.check('le successeur est décalé avec tout son contenu (phase + tâche : +6 jours)', :'e_s' = 'ok' AND pg_temp.d('S-Ph') = '2027-03-16→2027-03-26' AND pg_temp.d('S-Ph-t') = '2027-03-18→2027-03-20');
-- Prédécesseur et successeur déplacés ensemble (même phase) : ils bougent de la même durée, une seule fois
SELECT pg_temp.mk('Projet S', 'S-Pa', 'phase', NULL, '2027-05-03', '2027-05-14');
SELECT pg_temp.mk('Projet S', 'S-t1', 'task', 'S-Pa', '2027-05-03', '2027-05-07');
SELECT pg_temp.mk('Projet S', 'S-t2', 'task', 'S-Pa', '2027-05-10', '2027-05-14');
SELECT coalesce(pg_temp.lk('S-t1', 'S-t2'), 'ok') AS e_t \gset
SELECT zz.check('dépendance sans chevauchement : rien ne bouge', :'e_t' = 'ok' AND pg_temp.d('S-t2') = '2027-05-10→2027-05-14');
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'S-Pa'), 5) AS n5 \gset
SELECT zz.check('décaler la phase de +5 : les deux tâches liées bougent de 5 jours exactement', pg_temp.d('S-t1') = '2027-05-08→2027-05-12' AND pg_temp.d('S-t2') = '2027-05-15→2027-05-19');

-- Mode « garder l'intervalle » (projet G, week-ends permis)
SELECT pg_temp.mk('Projet G', 'G-Q', 'task', NULL, '2027-03-10', '2027-03-12');
SELECT coalesce(pg_temp.lk('G-P', 'G-Q'), 'ok') AS e_g \gset
SELECT zz.check('mode « garder l''intervalle » : créer la dépendance ne décale rien', :'e_g' = 'ok' AND pg_temp.d('G-Q') = '2027-03-10→2027-03-12');
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'G-P'), 3) AS n6 \gset
SELECT zz.check('P +3 jours : Q suit de 3 jours (intervalle gardé), même un week-end', pg_temp.d('G-P') = '2027-03-04→2027-03-08' AND pg_temp.d('G-Q') = '2027-03-13→2027-03-15');
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'G-P'), -2) AS n7 \gset
SELECT zz.check('P -2 jours : Q recule aussi de 2 jours', pg_temp.d('G-P') = '2027-03-02→2027-03-06' AND pg_temp.d('G-Q') = '2027-03-11→2027-03-13');
SELECT pg_temp.mk('Projet G', 'G-Pa', 'phase', NULL, '2027-06-01', '2027-06-14');
SELECT pg_temp.mk('Projet G', 'G-u1', 'task', 'G-Pa', '2027-06-01', '2027-06-04');
SELECT pg_temp.mk('Projet G', 'G-u2', 'task', 'G-Pa', '2027-06-10', '2027-06-12');
SELECT pg_temp.lk('G-u1', 'G-u2') AS rien \gset
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'G-Pa'), 4) AS n8 \gset
SELECT zz.check('mode « garder l''intervalle » : deux éléments liés déplacés ensemble ne bougent pas deux fois (+4, pas +8)', pg_temp.d('G-u1') = '2027-06-05→2027-06-08' AND pg_temp.d('G-u2') = '2027-06-14→2027-06-16');

-- Mode « ne rien décaler » (projet N)
SELECT pg_temp.mk('Projet N', 'N-A', 'task', NULL, '2027-03-01', '2027-03-05');
SELECT pg_temp.mk('Projet N', 'N-B', 'task', NULL, '2027-03-03', '2027-03-08');
SELECT coalesce(pg_temp.lk('N-A', 'N-B'), 'ok') AS e_n \gset
SELECT zz.check('mode « ne rien décaler » : la dépendance est créée, B reste où il est', :'e_n' = 'ok' AND pg_temp.d('N-B') = '2027-03-03→2027-03-08');
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'N-A'), 10) AS n9 \gset
SELECT zz.check('mode « ne rien décaler » : décaler A ne touche pas B', pg_temp.d('N-A') = '2027-03-11→2027-03-15' AND pg_temp.d('N-B') = '2027-03-03→2027-03-08');

-- Collaborateur : lit, n'écrit pas
RESET ROLE;
SELECT id AS lk_a FROM public.cp_items WHERE name = 'L-A' \gset
SELECT id AS lk_b FROM public.cp_items WHERE name = 'L-B' \gset
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U lit les dépendances', (SELECT count(*) FROM public.cp_item_links) >= 5);
SELECT zz.check('U ne crée pas de dépendance', zz.raises(format('INSERT INTO public.cp_item_links (predecessor_id, successor_id, project_id) SELECT %L::uuid, i.id, i.project_id FROM public.cp_items i WHERE i.name = ''L-C''', :'lk_b')) IS NOT NULL);
SELECT zz.check('U ne supprime rien', zz.affected($$DELETE FROM public.cp_item_links$$) = 0);
SELECT zz.check('U ne décale rien (pas de droit de modification)', zz.raises(format('SELECT public.cp_shift_item(%L, 1)', :'lk_a')) LIKE '%non autorisée%');
RESET ROLE;

-- Isolation : l'entreprise B
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B ne voit aucune dépendance de A', (SELECT count(*) FROM public.cp_item_links) = 0);
SELECT zz.check('B ne lie pas deux éléments de A', zz.raises(format('INSERT INTO public.cp_item_links (predecessor_id, successor_id, project_id) SELECT %L::uuid, i.id, i.project_id FROM public.cp_items i WHERE false', :'lk_a')) IS NULL
  AND zz.raises(format('INSERT INTO public.cp_item_links (predecessor_id, successor_id, project_id) VALUES (%L, %L, gen_random_uuid())', :'lk_a', :'lk_b')) IS NOT NULL);
INSERT INTO public.cp_projects (name, type) VALUES ('Projet B liens', 'admin');
SELECT pg_temp.mk('Projet B liens', 'B-1', 'task', NULL, '2027-03-01', '2027-03-05');
SELECT pg_temp.mk('Projet B liens', 'B-2', 'task', NULL, '2027-03-03', '2027-03-08');
SELECT coalesce(pg_temp.lk('B-1', 'B-2'), 'ok') AS e_b \gset
SELECT zz.check('B crée ses propres dépendances (et la cascade s''applique chez lui)', :'e_b' = 'ok' AND pg_temp.d('B-2') = '2027-03-08→2027-03-13');
SELECT zz.check('B ne lie pas son élément à un élément de A', zz.raises(format('INSERT INTO public.cp_item_links (predecessor_id, successor_id, project_id) SELECT i.id, %L::uuid, i.project_id FROM public.cp_items i WHERE i.name = ''B-1''', :'lk_a')) IS NOT NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A ne voit pas les dépendances de B', (SELECT count(*) FROM public.cp_item_links WHERE project_id IN (SELECT id FROM public.cp_projects WHERE name = 'Projet B liens')) = 0);
RESET ROLE;

-- Restauration : contrôles et cascade suspendus
SELECT set_config('gomat.restoring', 'on', false);
SELECT zz.check('pendant une restauration, la cascade ne rejoue pas les décalages', zz.affected($$UPDATE public.cp_items SET starts_on = starts_on + 1, ends_on = ends_on + 1 WHERE name = 'N-A'$$) = 1);
SELECT set_config('gomat.restoring', '', false);
SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.cp_items;
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
