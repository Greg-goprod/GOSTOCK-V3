-- P13 : récurrence (cp_repeat_item), intervenants externes, suivi du temps (saisie et chronomètre). À lancer APRÈS isolation.sql.
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
CREATE FUNCTION zz.affected(p_sql text) RETURNS integer LANGUAGE plpgsql AS $$ DECLARE n integer; BEGIN EXECUTE p_sql; GET DIAGNOSTICS n = ROW_COUNT; RETURN n; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO authenticated;

UPDATE public.users SET rbac_role_id = (SELECT id FROM public.rbac_roles WHERE system_key = 'user' AND organization_id = :ORG1::uuid) WHERE email = 'u@iso.test';
INSERT INTO public.organization_modules (organization_id, module_key) VALUES (:ORG1::uuid, 'cp.projects'), (:ORG2::uuid, 'cp.projects') ON CONFLICT DO NOTHING;
SELECT id AS ua FROM public.users WHERE email = 'a@iso.test' AND organization_id = :ORG1::uuid \gset
SELECT id AS uu FROM public.users WHERE email = 'u@iso.test' AND organization_id = :ORG1::uuid \gset
SELECT id AS ub FROM public.users WHERE email = 'b@iso.test' AND organization_id = :ORG2::uuid \gset

SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.users (organization_id, email, first_name, last_name, role) VALUES (:ORG1::uuid, 'anne@p13.test', 'Anne', 'Dupont', 'user') RETURNING id AS anne \gset
INSERT INTO public.equipment (organization_id, name, serial_number, status, total_quantity, available_quantity) VALUES (:ORG1::uuid, 'Perceuse P13', 'P13-1', 'available', 5, 5) RETURNING id AS eq1 \gset
INSERT INTO public.vehicles (organization_id, name, plate) VALUES (:ORG1::uuid, 'Camion P13', 'ZZ 1301') RETURNING id AS ve1 \gset
SELECT set_config('app.org_guard_off', '', false);

CREATE FUNCTION pg_temp.it(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT i.id FROM public.cp_items i JOIN public.cp_projects p ON p.id = i.project_id WHERE i.name = p_name AND p.name = 'Projet P13' ORDER BY i.series_index NULLS FIRST, i.created_at LIMIT 1 $$;
CREATE FUNCTION pg_temp.mk(p_name text, p_kind text, p_parent text, p_from date, p_to date) RETURNS void LANGUAGE plpgsql AS $$
BEGIN INSERT INTO public.cp_items (project_id, parent_id, kind, name, starts_on, ends_on) VALUES ((SELECT id FROM public.cp_projects WHERE name = 'Projet P13'), pg_temp.it(p_parent), p_kind, p_name, p_from, p_to); END $$;
-- Dates des occurrences d'une série (par nom d'origine), « début→fin » dans l'ordre de la série
CREATE FUNCTION pg_temp.ser(p_name text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(coalesce(starts_on::text, '-') || '→' || coalesce(ends_on::text, '-'), ' | ' ORDER BY series_index)
  FROM public.cp_items WHERE series_id = (SELECT series_id FROM public.cp_items WHERE id = pg_temp.it(p_name)) $$;
CREATE FUNCTION pg_temp.rep(p_name text, p_freq text, p_count int) RETURNS text LANGUAGE plpgsql AS $$
BEGIN PERFORM public.cp_repeat_item(pg_temp.it(p_name), p_freq, p_count); RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM; END $$;
CREATE FUNCTION pg_temp.nc(p_user uuid, p_kind text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT count(*)::integer FROM public.notifications WHERE recipient_user_id = p_user AND kind = p_kind $$;
GRANT EXECUTE ON FUNCTION pg_temp.it(text), pg_temp.mk(text, text, text, date, date), pg_temp.ser(text), pg_temp.rep(text, text, int), pg_temp.nc(uuid, text) TO authenticated;

SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_projects (name, type) VALUES ('Projet P13', 'site');
SELECT id AS p1, organization_id AS org_a FROM public.cp_projects WHERE name = 'Projet P13' \gset
RESET ROLE;
SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.cp_project_members (project_id, user_id, role) VALUES (:'p1'::uuid, :'anne'::uuid, 'member');
SELECT set_config('app.org_guard_off', '', false);

/* ------------------------------------------------------------------ 0. calcul des dates */
SELECT zz.check('0a chaque semaine : +7 jours', (SELECT array_agg(public.cp_shift_date('2027-03-01', 'weekly', k) ORDER BY k) FROM generate_series(1, 3) k) = ARRAY['2027-03-08', '2027-03-15', '2027-03-22']::date[]);
SELECT zz.check('0b chaque mois : 31 janvier → 28 février (fin de mois)', public.cp_shift_date('2027-01-31', 'monthly', 1) = '2027-02-28');
SELECT zz.check('0c chaque mois : pas de dérive (31 janvier + 2 mois = 31 mars, pas 28)', public.cp_shift_date('2027-01-31', 'monthly', 2) = '2027-03-31' AND public.cp_shift_date('2027-01-31', 'monthly', 3) = '2027-04-30');
SELECT zz.check('0d chaque mois : passage d''année (15 novembre + 3 mois)', public.cp_shift_date('2026-11-15', 'monthly', 3) = '2027-02-15');
SELECT zz.check('0e chaque année : 29 février 2028 → 28 février 2029, puis 29 février 2032', public.cp_shift_date('2028-02-29', 'yearly', 1) = '2029-02-28' AND public.cp_shift_date('2028-02-29', 'yearly', 4) = '2032-02-29');
SELECT zz.check('0f fréquence inconnue : pas de date', public.cp_shift_date('2027-03-01', 'daily', 1) IS NULL);

/* ------------------------------------------------------------------ 1. récurrence */
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT pg_temp.mk('R-hebdo', 'task', NULL, '2027-03-01', '2027-03-03');
UPDATE public.cp_items SET description = 'Description R', priority = 'high', estimate_hours = 6.5 WHERE name = 'R-hebdo';
INSERT INTO public.cp_item_checks (item_id, label, done, position) VALUES (pg_temp.it('R-hebdo'), 'Étape 1', true, 0), (pg_temp.it('R-hebdo'), 'Étape 2', false, 1);
RESET ROLE;
SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.cp_item_members (item_id, user_id) VALUES (pg_temp.it('R-hebdo'), :'anne'::uuid);
INSERT INTO public.cp_item_resources (organization_id, item_id, kind, equipment_id, quantity) VALUES (:ORG1::uuid, pg_temp.it('R-hebdo'), 'equipment', :'eq1'::uuid, 2);
INSERT INTO public.cp_item_resources (organization_id, item_id, kind, vehicle_id) VALUES (:ORG1::uuid, pg_temp.it('R-hebdo'), 'vehicle', :'ve1'::uuid);
INSERT INTO public.cp_externals (organization_id, name, company) VALUES (:ORG1::uuid, 'Jean Prestataire', 'Sono SA') RETURNING id AS ext1 \gset
INSERT INTO public.cp_item_externals (organization_id, item_id, external_id) VALUES (:ORG1::uuid, pg_temp.it('R-hebdo'), :'ext1'::uuid);
DELETE FROM public.notifications WHERE kind IN ('cp_assigned', 'cp_team_added');
SELECT set_config('app.org_guard_off', '', false);
SELECT pg_temp.nc(:'anne'::uuid, 'cp_assigned') AS assigned_before \gset

SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT COALESCE(pg_temp.rep('R-hebdo', 'weekly', 3), 'ok') AS r1 \gset
SELECT zz.check('1 chaque semaine ×3 : 4 occurrences (l''origine + 3), mêmes durées de 3 jours, lundi à mercredi', :'r1' = 'ok' AND pg_temp.ser('R-hebdo') = '2027-03-01→2027-03-03 | 2027-03-08→2027-03-10 | 2027-03-15→2027-03-17 | 2027-03-22→2027-03-24', pg_temp.ser('R-hebdo'));
SELECT zz.check('2 l''origine reçoit le rang 1, les occurrences 2 à 4, toutes dans la même série', (SELECT array_agg(series_index ORDER BY series_index) = ARRAY[1, 2, 3, 4] AND count(DISTINCT series_id) = 1 FROM public.cp_items WHERE name = 'R-hebdo'));
SELECT zz.check('3 les occurrences copient nom, description, priorité, estimation, parent et projet', (SELECT bool_and(description = 'Description R' AND priority = 'high' AND estimate_hours = 6.5 AND project_id = :'p1'::uuid AND parent_id IS NULL AND kind = 'task') FROM public.cp_items WHERE name = 'R-hebdo'));
SELECT zz.check('4 les occurrences repartent à « pas commencé »', (SELECT bool_and(s.family = 'not_started') FROM public.cp_items i JOIN public.cp_statuses s ON s.id = i.status_id WHERE i.name = 'R-hebdo' AND i.series_index > 1));
-- L'origine est EN COURS : ses copies repartent quand même à « pas commencé »
SELECT pg_temp.mk('R-statut', 'task', NULL, '2027-04-05', '2027-04-06');
UPDATE public.cp_items SET status_id = (SELECT id FROM public.cp_statuses WHERE family = 'in_progress' AND is_system LIMIT 1) WHERE id = pg_temp.it('R-statut');
SELECT COALESCE(pg_temp.rep('R-statut', 'weekly', 2), 'ok') AS rst \gset
SELECT zz.check('4b origine « en cours » : l''origine le reste, ses 2 copies repartent à « pas commencé »', :'rst' = 'ok'
  AND (SELECT s.family FROM public.cp_items i JOIN public.cp_statuses s ON s.id = i.status_id WHERE i.name = 'R-statut' AND i.series_index = 1) = 'in_progress'
  AND (SELECT count(*) FROM public.cp_items i JOIN public.cp_statuses s ON s.id = i.status_id WHERE i.name = 'R-statut' AND i.series_index > 1 AND s.family = 'not_started') = 2);
SELECT zz.check('5 liste à cocher copiée, DÉCOCHÉE (l''origine garde sa case cochée)', (SELECT count(*) FROM public.cp_item_checks c JOIN public.cp_items i ON i.id = c.item_id WHERE i.name = 'R-hebdo' AND i.series_index > 1) = 6
  AND (SELECT count(*) FROM public.cp_item_checks c JOIN public.cp_items i ON i.id = c.item_id WHERE i.name = 'R-hebdo' AND i.series_index > 1 AND c.done) = 0
  AND (SELECT count(*) FROM public.cp_item_checks WHERE item_id = pg_temp.it('R-hebdo') AND done) = 1);
SELECT zz.check('6 personnes assignées, matériel, véhicule et externe copiés sur chaque occurrence', (SELECT count(*) FROM public.cp_item_members m JOIN public.cp_items i ON i.id = m.item_id WHERE i.name = 'R-hebdo' AND i.series_index > 1) = 3
  AND (SELECT count(*) FROM public.cp_item_resources r JOIN public.cp_items i ON i.id = r.item_id WHERE i.name = 'R-hebdo' AND i.series_index > 1 AND r.kind = 'equipment' AND r.quantity = 2) = 3
  AND (SELECT count(*) FROM public.cp_item_resources r JOIN public.cp_items i ON i.id = r.item_id WHERE i.name = 'R-hebdo' AND i.series_index > 1 AND r.kind = 'vehicle') = 3
  AND (SELECT count(*) FROM public.cp_item_externals e JOIN public.cp_items i ON i.id = e.item_id WHERE i.name = 'R-hebdo' AND i.series_index > 1) = 3);
RESET ROLE;
SELECT zz.check('7 aucun avis d''assignation envoyé pour les copies', pg_temp.nc(:'anne'::uuid, 'cp_assigned') = :assigned_before);

SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
-- fin de mois, durée conservée
SELECT pg_temp.mk('R-mois', 'task', NULL, '2027-01-31', '2027-02-02');
SELECT COALESCE(pg_temp.rep('R-mois', 'monthly', 3), 'ok') AS r2 \gset
SELECT zz.check('8 chaque mois depuis le 31 janvier : 28 fév., 31 mars, 30 avril ; durée de 2 jours conservée', :'r2' = 'ok' AND pg_temp.ser('R-mois') = '2027-01-31→2027-02-02 | 2027-02-28→2027-03-02 | 2027-03-31→2027-04-02 | 2027-04-30→2027-05-02', pg_temp.ser('R-mois'));
SELECT pg_temp.mk('R-mois2', 'task', NULL, '2027-01-30', '2027-01-31');
SELECT COALESCE(pg_temp.rep('R-mois2', 'monthly', 2), 'ok') AS r2b \gset
SELECT zz.check('8b chaque mois du 30 au 31 janvier : la durée d''un jour est conservée (28 février → 1er mars), puis 30 → 31 mars', :'r2b' = 'ok' AND pg_temp.ser('R-mois2') = '2027-01-30→2027-01-31 | 2027-02-28→2027-03-01 | 2027-03-30→2027-03-31', pg_temp.ser('R-mois2'));
SELECT pg_temp.mk('R-an', 'task', NULL, '2028-02-29', '2028-02-29');
SELECT COALESCE(pg_temp.rep('R-an', 'yearly', 2), 'ok') AS r3 \gset
SELECT zz.check('9 chaque année depuis le 29 février 2028 : 28 février 2029 et 2030', :'r3' = 'ok' AND pg_temp.ser('R-an') = '2028-02-29→2028-02-29 | 2029-02-28→2029-02-28 | 2030-02-28→2030-02-28', pg_temp.ser('R-an'));
SELECT pg_temp.mk('R-jalon', 'milestone', NULL, '2027-03-10', '2027-03-10');
SELECT COALESCE(pg_temp.rep('R-jalon', 'weekly', 2), 'ok') AS r4 \gset
SELECT zz.check('10 un jalon se répète (même jour début et fin)', :'r4' = 'ok' AND pg_temp.ser('R-jalon') = '2027-03-10→2027-03-10 | 2027-03-17→2027-03-17 | 2027-03-24→2027-03-24');
SELECT pg_temp.mk('R-debut', 'task', NULL, '2027-03-01', NULL);
SELECT pg_temp.mk('R-fin', 'task', NULL, NULL, '2027-03-05');
SELECT COALESCE(pg_temp.rep('R-debut', 'weekly', 1), 'ok') AS r5 \gset
SELECT COALESCE(pg_temp.rep('R-fin', 'weekly', 1), 'ok') AS r6 \gset
SELECT zz.check('11 un élément avec seulement un début, ou seulement une fin, se répète', :'r5' = 'ok' AND :'r6' = 'ok' AND pg_temp.ser('R-debut') = '2027-03-01→- | 2027-03-08→-' AND pg_temp.ser('R-fin') = '-→2027-03-05 | -→2027-03-12', pg_temp.ser('R-debut') || ' // ' || pg_temp.ser('R-fin'));

-- Refus
SELECT pg_temp.mk('R-phase', 'phase', NULL, '2027-03-01', '2027-03-31');
SELECT pg_temp.mk('R-parent', 'task', 'R-phase', '2027-03-01', '2027-03-05');
SELECT pg_temp.mk('R-enfant', 'subtask', 'R-parent', '2027-03-01', '2027-03-02');
SELECT pg_temp.mk('R-sans-date', 'task', NULL, NULL, NULL);
SELECT zz.check('12 une phase ne se répète pas', pg_temp.rep('R-phase', 'weekly', 1) LIKE 'Une phase ne se répète pas%');
SELECT COALESCE(pg_temp.rep('R-parent', 'weekly', 1), 'ok') AS r13 \gset
SELECT zz.check('13 un élément qui a des sous-tâches se répète (migration 75 : elles sont copiées, voir les contrôles 76 et suivants)', :'r13' = 'ok' AND (SELECT count(*) FROM public.cp_items WHERE name = 'R-enfant') = 2, :'r13' || ' / ' || (SELECT count(*) FROM public.cp_items WHERE name = 'R-enfant'));
SELECT zz.check('14 une sous-tâche sans enfants se répète', pg_temp.rep('R-enfant', 'weekly', 1) IS NULL);
SELECT zz.check('15 un élément sans aucune date ne se répète pas', pg_temp.rep('R-sans-date', 'weekly', 1) LIKE 'Donne d''abord une date%');
SELECT zz.check('16 fréquence inconnue refusée', pg_temp.rep('R-hebdo', 'daily', 1) LIKE 'Fréquence inconnue%');
SELECT zz.check('17 0 répétition et 53 répétitions refusées', pg_temp.rep('R-mois', 'weekly', 0) LIKE 'Répète de 1 à 52%' AND pg_temp.rep('R-mois', 'weekly', 53) LIKE 'Répète de 1 à 52%');
SELECT zz.check('18 répéter une occurrence qui n''est pas la dernière est refusé', zz.raises(format('SELECT public.cp_repeat_item(%L, ''weekly'', 1)', (SELECT id FROM public.cp_items WHERE name = 'R-hebdo' AND series_index = 2))) LIKE '%dernière occurrence%');
SELECT id AS last_hebdo FROM public.cp_items WHERE name = 'R-hebdo' AND series_index = 4 \gset
SELECT public.cp_repeat_item(:'last_hebdo'::uuid, 'weekly', 2) AS ext_n \gset
SELECT zz.check('19 prolonger la série depuis sa dernière occurrence : le rang continue (5 et 6), les dates suivent', :ext_n = 2 AND pg_temp.ser('R-hebdo') LIKE '%| 2027-03-29→2027-03-31 | 2027-04-05→2027-04-07' AND (SELECT max(series_index) FROM public.cp_items WHERE name = 'R-hebdo') = 6);
-- Plafond de 200 occurrences
SELECT pg_temp.mk('R-plafond', 'task', NULL, '2027-05-03', '2027-05-04');
RESET ROLE;
SELECT set_config('app.org_guard_off', 'on', false);
UPDATE public.cp_items SET series_id = gen_random_uuid(), series_index = 199 WHERE id = pg_temp.it('R-plafond');
SELECT set_config('app.org_guard_off', '', false);
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('20 plafond de 200 occurrences : 2 de plus depuis le rang 199 refusé', pg_temp.rep('R-plafond', 'weekly', 2) LIKE '%200 occurrences au plus%');
SELECT zz.check('21 mais 1 de plus (rang 200) accepté', pg_temp.rep('R-plafond', 'weekly', 1) IS NULL);
SELECT zz.check('22 le rang doit rester entre 1 et 200 (contrainte)', zz.raises($$UPDATE public.cp_items SET series_index = 201 WHERE series_index = 200$$) IS NOT NULL AND zz.raises($$UPDATE public.cp_items SET series_id = NULL WHERE name = 'R-plafond' AND series_index = 200$$) IS NOT NULL);
RESET ROLE;

-- Droits
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT count(public.whoami());
SELECT zz.check('23 un collaborateur (rôle « user ») ne répète rien', zz.raises(format('SELECT public.cp_repeat_item(%L, ''weekly'', 1)', (SELECT id FROM public.cp_items WHERE name = 'R-jalon' AND series_index = 3))) IS NOT NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('24 une autre entreprise ne répète pas l''élément', zz.raises(format('SELECT public.cp_repeat_item(%L, ''weekly'', 1)', (SELECT id FROM public.cp_items WHERE name = 'R-jalon' AND series_index = 3))) LIKE 'Élément introuvable%');
RESET ROLE;

-- Supprimer les occurrences suivantes : seulement celles jamais touchées
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT pg_temp.mk('S-serie', 'task', NULL, '2027-06-01', '2027-06-02');
SELECT pg_temp.rep('S-serie', 'weekly', 5);
RESET ROLE;
SELECT set_config('app.org_guard_off', 'on', false);
UPDATE public.cp_items SET status_id = (SELECT id FROM public.cp_statuses WHERE family = 'in_progress' AND is_system AND organization_id = :ORG1::uuid LIMIT 1) WHERE name = 'S-serie' AND series_index = 3;
INSERT INTO public.cp_comments (organization_id, project_id, item_id, author_id, body) SELECT :ORG1::uuid, :'p1'::uuid, id, :'ua'::uuid, 'message' FROM public.cp_items WHERE name = 'S-serie' AND series_index = 4;
INSERT INTO public.cp_time_entries (organization_id, item_id, user_id, work_date, minutes) SELECT :ORG1::uuid, id, :'ua'::uuid, current_date - 1, 30 FROM public.cp_items WHERE name = 'S-serie' AND series_index = 5;
SELECT set_config('app.org_guard_off', '', false);
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('25 un collaborateur ne supprime aucune occurrence (rien n''est effacé)', (SELECT d.deleted FROM public.cp_delete_series_after((SELECT id FROM public.cp_items WHERE name = 'S-serie' AND series_index = 1)) d) = 0 AND (SELECT count(*) FROM public.cp_items WHERE name = 'S-serie') = 6);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT d.deleted AS del_n, d.kept AS kept_n FROM public.cp_delete_series_after((SELECT id FROM public.cp_items WHERE name = 'S-serie' AND series_index = 2)) d \gset
SELECT zz.check('26 depuis le rang 2 : les rangs 6 (intact) supprimé ; 3 (commencé), 4 (message), 5 (temps saisi) gardés', :del_n = 1 AND :kept_n = 3 AND (SELECT array_agg(series_index ORDER BY series_index) FROM public.cp_items WHERE name = 'S-serie') = ARRAY[1, 2, 3, 4, 5], (SELECT array_agg(series_index ORDER BY series_index)::text FROM public.cp_items WHERE name = 'S-serie'));
SELECT zz.check('27 les occurrences AVANT le rang choisi ne sont jamais touchées', (SELECT count(*) FROM public.cp_items WHERE name = 'S-serie' AND series_index <= 2) = 2);
SELECT zz.check('28 un élément hors série : refusé', zz.raises(format('SELECT * FROM public.cp_delete_series_after(%L)', pg_temp.it('R-sans-date'))) LIKE '%ne fait pas partie d''une série%');
SELECT d.deleted AS del2 FROM public.cp_delete_series_after((SELECT id FROM public.cp_items WHERE name = 'S-serie' AND series_index = 2)) d \gset
SELECT zz.check('29 rappelée : plus rien à supprimer', :del2 = 0);
RESET ROLE;

/* ------------------------------------------------------------------ 2. intervenants externes */
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_externals (name, company, note) VALUES ('  Marie Électricienne  ', '   ', '  ');
SELECT zz.check('30 nom nettoyé, société et note vides = absentes, entreprise posée par la base', (SELECT name = 'Marie Électricienne' AND company IS NULL AND note IS NULL AND organization_id = :'org_a'::uuid AND active FROM public.cp_externals WHERE name LIKE 'Marie%'));
SELECT zz.check('31 même nom, même société (majuscules / espaces indifférents) refusé', zz.raises($$INSERT INTO public.cp_externals (name) VALUES (' MARIE électricienne')$$) IS NOT NULL OR zz.raises($$INSERT INTO public.cp_externals (name) VALUES ('MARIE ÉLECTRICIENNE')$$) IS NOT NULL);
SELECT zz.check('32 même nom dans une autre société accepté', zz.raises($$INSERT INTO public.cp_externals (name, company) VALUES ('Marie Électricienne', 'Autre SA')$$) IS NULL);
SELECT zz.check('33 nom de 80 caractères accepté, 81 refusé, vide refusé', zz.raises(format('INSERT INTO public.cp_externals (name) VALUES (%L)', repeat('n', 80))) IS NULL AND zz.raises(format('INSERT INTO public.cp_externals (name) VALUES (%L)', repeat('n', 81))) IS NOT NULL AND zz.raises($$INSERT INTO public.cp_externals (name) VALUES ('   ')$$) IS NOT NULL);
SELECT zz.check('34 société 80 / 81 et note 300 / 301', zz.raises(format('INSERT INTO public.cp_externals (name, company) VALUES (''S80'', %L)', repeat('c', 80))) IS NULL AND zz.raises(format('INSERT INTO public.cp_externals (name, company) VALUES (''S81'', %L)', repeat('c', 81))) IS NOT NULL
  AND zz.raises(format('INSERT INTO public.cp_externals (name, note) VALUES (''N300'', %L)', repeat('n', 300))) IS NULL AND zz.raises(format('INSERT INTO public.cp_externals (name, note) VALUES (''N301'', %L)', repeat('n', 301))) IS NOT NULL);
SELECT id AS ext2 FROM public.cp_externals WHERE name = 'Marie Électricienne' AND company IS NULL \gset
INSERT INTO public.cp_item_externals (item_id, external_id) VALUES (pg_temp.it('R-debut'), :'ext2'::uuid);
SELECT zz.check('35 affecter un intervenant à une tâche : entreprise posée par la base', (SELECT organization_id = :'org_a'::uuid FROM public.cp_item_externals WHERE external_id = :'ext2'::uuid));
SELECT zz.check('36 la même affectation deux fois refusée', zz.raises(format('INSERT INTO public.cp_item_externals (item_id, external_id) VALUES (%L, %L)', pg_temp.it('R-debut'), :'ext2')) IS NOT NULL);
SELECT zz.check('37 le journal d''audit garde la création de l''intervenant', (SELECT count(*) FROM public.audit_log WHERE table_name = 'cp_externals') >= 1);
RESET ROLE;
SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.cp_externals (organization_id, name) VALUES (:ORG2::uuid, 'Externe de B') RETURNING id AS extb \gset
SELECT set_config('app.org_guard_off', '', false);
SELECT zz.check('38 un intervenant d''une autre entreprise ne s''affecte pas (garde)', zz.raises(format('INSERT INTO public.cp_item_externals (organization_id, item_id, external_id) VALUES (%L, %L, %L)', :'org_a', pg_temp.it('R-debut'), :'extb')) LIKE 'Intervenant introuvable%');
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('39 un collaborateur lit les intervenants et leurs affectations', (SELECT count(*) FROM public.cp_externals) >= 4 AND (SELECT count(*) FROM public.cp_item_externals) >= 1);
SELECT zz.check('40 un collaborateur n''en crée, modifie ni supprime aucun', zz.raises($$INSERT INTO public.cp_externals (name) VALUES ('Pirate')$$) IS NOT NULL AND zz.affected($$UPDATE public.cp_externals SET active = false$$) = 0 AND zz.affected($$DELETE FROM public.cp_externals$$) = 0 AND zz.affected($$DELETE FROM public.cp_item_externals$$) = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('41 l''autre entreprise ne voit rien', (SELECT count(*) FROM public.cp_externals WHERE name <> 'Externe de B') = 0 AND (SELECT count(*) FROM public.cp_item_externals) = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.affected(format('DELETE FROM public.cp_externals WHERE id = %L', :'ext2')) AS n_del_ext \gset
SELECT zz.check('42 supprimer un intervenant retire ses affectations', :n_del_ext = 1 AND (SELECT count(*) FROM public.cp_item_externals WHERE external_id = :'ext2'::uuid) = 0);
RESET ROLE;

/* ------------------------------------------------------------------ 3. suivi du temps */
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT pg_temp.mk('T-tache', 'task', NULL, '2027-03-01', '2027-03-05');
SELECT pg_temp.mk('T-autre', 'task', NULL, '2027-03-01', '2027-03-05');
RESET ROLE;
SELECT (now() AT TIME ZONE 'Europe/Zurich')::date AS today \gset
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('43 U n''est pas de l''équipe : il ne saisit pas de temps', zz.raises(format('INSERT INTO public.cp_time_entries (item_id, work_date, minutes) VALUES (%L, %L, 60)', pg_temp.it('T-tache'), :'today')) IS NOT NULL);
RESET ROLE;
SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.cp_project_members (project_id, user_id, role) VALUES (:'p1'::uuid, :'uu'::uuid, 'member');
SELECT set_config('app.org_guard_off', '', false);
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT COALESCE(zz.raises(format('INSERT INTO public.cp_time_entries (item_id, work_date, minutes, note) VALUES (%L, %L, 90, ''  Montage  '')', pg_temp.it('T-tache'), :'today')), 'ok') AS ins44 \gset
SELECT zz.check('44 U (équipe) saisit 90 minutes pour aujourd''hui : note nettoyée, personne et entreprise posées par la base, pas de chronomètre', :'ins44' = 'ok'
  AND (SELECT minutes = 90 AND note = 'Montage' AND user_id = :'uu'::uuid AND organization_id = :'org_a'::uuid AND started_at IS NULL FROM public.cp_time_entries WHERE item_id = pg_temp.it('T-tache') AND minutes = 90), :'ins44');
SELECT zz.check('45 1 minute et 1 440 minutes acceptées', zz.raises(format('INSERT INTO public.cp_time_entries (item_id, work_date, minutes) VALUES (%L, %L, 1)', pg_temp.it('T-tache'), :'today')) IS NULL AND zz.raises(format('INSERT INTO public.cp_time_entries (item_id, work_date, minutes) VALUES (%L, %L, 1440)', pg_temp.it('T-tache'), :'today')) IS NULL);
SELECT zz.check('46 0 et 1 441 minutes refusées', zz.raises(format('INSERT INTO public.cp_time_entries (item_id, work_date, minutes) VALUES (%L, %L, 0)', pg_temp.it('T-tache'), :'today')) IS NOT NULL AND zz.raises(format('INSERT INTO public.cp_time_entries (item_id, work_date, minutes) VALUES (%L, %L, 1441)', pg_temp.it('T-tache'), :'today')) IS NOT NULL);
SELECT zz.check('47 un jour dans le futur refusé', zz.raises(format('INSERT INTO public.cp_time_entries (item_id, work_date, minutes) VALUES (%L, %L::date + 1, 30)', pg_temp.it('T-tache'), :'today')) LIKE '%futur%');
SELECT zz.check('48 hier accepté', zz.raises(format('INSERT INTO public.cp_time_entries (item_id, work_date, minutes) VALUES (%L, %L::date - 1, 30)', pg_temp.it('T-tache'), :'today')) IS NULL);
SELECT zz.check('49 note de 301 caractères refusée', zz.raises(format('INSERT INTO public.cp_time_entries (item_id, work_date, minutes, note) VALUES (%L, %L, 5, %L)', pg_temp.it('T-tache'), :'today', repeat('n', 301))) IS NOT NULL);
SELECT zz.check('50 ni minutes ni chronomètre : refusé', zz.raises(format('INSERT INTO public.cp_time_entries (item_id, work_date) VALUES (%L, %L)', pg_temp.it('T-tache'), :'today')) IS NOT NULL);
SELECT zz.check('51 saisir au nom d''une autre personne refusé', zz.raises(format('INSERT INTO public.cp_time_entries (item_id, user_id, work_date, minutes) VALUES (%L, %L, %L, 30)', pg_temp.it('T-tache'), :'ua', :'today')) IS NOT NULL);
SELECT zz.check('52 U modifie sa saisie (minutes, note)', zz.affected($$UPDATE public.cp_time_entries SET minutes = 100, note = 'Corrigé' WHERE minutes = 90$$) = 1);
SELECT zz.check('53 une saisie ne change ni de tâche ni de personne', zz.raises(format('UPDATE public.cp_time_entries SET item_id = %L WHERE minutes = 100', pg_temp.it('T-autre'))) LIKE '%ne change ni de tâche ni de personne%' AND zz.raises(format('UPDATE public.cp_time_entries SET user_id = %L WHERE minutes = 100', :'ua')) IS NOT NULL);
RESET ROLE;

-- Chronomètre (U)
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT public.cp_timer_start(pg_temp.it('T-tache')) AS tm1 \gset
SELECT zz.check('54 démarrer : une saisie sans minutes, avec l''heure de début, au jour d''aujourd''hui', (SELECT minutes IS NULL AND started_at IS NOT NULL AND work_date = :'today'::date AND user_id = :'uu'::uuid FROM public.cp_time_entries WHERE id = :'tm1'::uuid));
SELECT public.cp_timer_start(pg_temp.it('T-tache')) AS tm1b \gset
SELECT zz.check('55 redémarrer sur la même tâche : le même chronomètre, toujours un seul en cours', :'tm1b' = :'tm1' AND (SELECT count(*) FROM public.cp_time_entries WHERE user_id = :'uu'::uuid AND minutes IS NULL) = 1);
SELECT zz.check('56 un second chronomètre en direct est refusé (un seul par personne)', zz.raises(format('INSERT INTO public.cp_time_entries (item_id, work_date, started_at) VALUES (%L, %L, now())', pg_temp.it('T-autre'), :'today')) IS NOT NULL);
RESET ROLE;
UPDATE public.cp_time_entries SET started_at = now() - interval '3 hours' WHERE id = :'tm1'::uuid;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT public.cp_timer_start(pg_temp.it('T-autre')) AS tm2 \gset
SELECT zz.check('57 démarrer sur une autre tâche arrête la première (≈ 180 minutes mesurées par la base)', (SELECT minutes BETWEEN 179 AND 181 FROM public.cp_time_entries WHERE id = :'tm1'::uuid) AND (SELECT minutes IS NULL FROM public.cp_time_entries WHERE id = :'tm2'::uuid), (SELECT minutes::text FROM public.cp_time_entries WHERE id = :'tm1'::uuid));
SELECT public.cp_timer_stop() AS stopped \gset
SELECT zz.check('58 arrêter : au moins 1 minute enregistrée (démarré à l''instant)', :stopped >= 1 AND :stopped <= 2 AND (SELECT minutes = :stopped FROM public.cp_time_entries WHERE id = :'tm2'::uuid));
SELECT zz.check('59 arrêter sans chronomètre en cours : rien', public.cp_timer_stop() IS NULL);
RESET ROLE;
SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.cp_time_entries (organization_id, item_id, user_id, work_date, started_at) VALUES (:ORG1::uuid, pg_temp.it('T-tache'), :'uu'::uuid, :'today'::date, now() - interval '3 days') RETURNING id AS tm3 \gset
SELECT set_config('app.org_guard_off', '', false);
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT public.cp_timer_stop() AS capped \gset
SELECT zz.check('60 un chronomètre oublié depuis 3 jours est plafonné à 1 440 minutes', :capped = 1440);
SELECT zz.check('61 démarrer sur une tâche qu''on ne peut pas suivre est refusé (autre entreprise inconnue)', zz.raises($$SELECT public.cp_timer_start(gen_random_uuid())$$) IS NOT NULL);

-- Visibilité : U ne lit que son temps ; A (droit de modification) lit tout
INSERT INTO public.cp_time_entries (item_id, work_date, minutes) VALUES (pg_temp.it('T-autre'), :'today', 15);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('62 A (droit de modification des projets) saisit du temps sur une tâche', zz.raises(format('INSERT INTO public.cp_time_entries (item_id, work_date, minutes) VALUES (%L, %L, 45)', pg_temp.it('T-tache'), :'today')) IS NULL);
SELECT zz.check('63 A lit le temps de tout le monde', (SELECT count(DISTINCT user_id) FROM public.cp_time_entries WHERE item_id IN (pg_temp.it('T-tache'), pg_temp.it('T-autre'))) = 2);
SELECT count(*) AS u_entries, COALESCE(sum(minutes), 0) AS u_minutes FROM public.cp_time_entries WHERE user_id = :'uu'::uuid \gset
SELECT zz.raises(format('UPDATE public.cp_time_entries SET minutes = 1 WHERE user_id = %L', :'uu')) AS try_upd \gset
SELECT zz.raises(format('DELETE FROM public.cp_time_entries WHERE user_id = %L', :'uu')) AS try_del \gset
SELECT zz.check('63b A lit tout le temps mais ne modifie ni ne supprime celui de U (chacun ne touche qu''au sien) : rien n''a changé', (SELECT count(*) FROM public.cp_time_entries WHERE user_id = :'uu'::uuid) = :u_entries
  AND (SELECT COALESCE(sum(minutes), 0) FROM public.cp_time_entries WHERE user_id = :'uu'::uuid) = :u_minutes AND :u_entries >= 4, :u_entries || ' lignes, ' || :u_minutes || ' min');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('64 U ne lit que son propre temps', (SELECT count(*) FROM public.cp_time_entries WHERE user_id <> :'uu'::uuid) = 0 AND (SELECT count(*) FROM public.cp_time_entries) >= 4);
SELECT zz.check('65 U ne modifie ni ne supprime le temps de A', zz.affected(format('UPDATE public.cp_time_entries SET minutes = 1 WHERE user_id = %L', :'ua')) = 0 AND zz.affected(format('DELETE FROM public.cp_time_entries WHERE user_id = %L', :'ua')) = 0);
SELECT zz.check('66 U supprime sa propre saisie', zz.affected($$DELETE FROM public.cp_time_entries WHERE minutes = 15$$) = 1);
RESET ROLE;
SELECT zz.check('67 aucun journal d''audit sur le temps (donnée personnelle)', (SELECT count(*) FROM public.audit_log WHERE table_name = 'cp_time_entries') = 0);
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('68 l''autre entreprise ne voit aucun temps', (SELECT count(*) FROM public.cp_time_entries) = 0);
RESET ROLE;
GRANT USAGE ON SCHEMA zz TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO anon;
SET ROLE anon;
SELECT zz.check('69 anonyme : ni temps, ni intervenants, ni fonctions', zz.raises($$SELECT count(*) FROM public.cp_time_entries$$) IS NOT NULL AND zz.raises($$SELECT count(*) FROM public.cp_externals$$) IS NOT NULL AND zz.raises($$SELECT public.cp_timer_stop()$$) IS NOT NULL AND zz.raises($$SELECT public.cp_repeat_item(gen_random_uuid(), 'weekly', 1)$$) IS NOT NULL);
RESET ROLE;

/* ------------------------------------------------------------------ 4. module désactivé, sauvegarde, cascades */
SELECT set_config('request.jwt.claim.sub', '', false);
DELETE FROM public.organization_modules WHERE organization_id = :ORG1::uuid AND module_key = 'cp.projects';
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('70 module PILOTE désactivé : A ne lit ni temps ni intervenants', (SELECT count(*) FROM public.cp_time_entries) = 0 AND (SELECT count(*) FROM public.cp_externals) = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
INSERT INTO public.organization_modules (organization_id, module_key) VALUES (:ORG1::uuid, 'cp.projects') ON CONFLICT DO NOTHING;

SELECT zz.check('71 restore_missing_rows connaît les trois nouvelles tables', pg_get_functiondef('public.restore_missing_rows(text, jsonb)'::regprocedure) LIKE '%''cp_externals'', ''cp_item_externals'', ''cp_time_entries''%');
CREATE TEMP TABLE keep_t AS SELECT * FROM public.cp_time_entries WHERE organization_id = :ORG1::uuid;
CREATE TEMP TABLE keep_e AS SELECT * FROM public.cp_externals WHERE organization_id = :ORG1::uuid;
SELECT count(*) AS n_t FROM keep_t \gset
SELECT count(*) AS n_e FROM keep_e \gset
SELECT jsonb_agg(to_jsonb(k)) AS rows_t FROM keep_t k \gset
SELECT jsonb_agg(to_jsonb(k)) AS rows_e FROM keep_e k \gset
SELECT set_config('app.org_guard_off', 'on', false);
SET session_replication_role = replica;
DELETE FROM public.cp_time_entries WHERE organization_id = :ORG1::uuid;
DELETE FROM public.cp_externals WHERE organization_id = :ORG1::uuid;
SET session_replication_role = origin;
SELECT set_config('app.org_guard_off', '', false);
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT public.restore_missing_rows('cp_externals', :'rows_e'::jsonb) AS rest_e \gset
SELECT public.restore_missing_rows('cp_time_entries', :'rows_t'::jsonb) AS rest_t \gset
SELECT zz.check('72 restauration : intervenants et temps remis (le chronomètre arrêté, les minutes gardées)', :rest_e = :n_e AND :rest_t = :n_t AND (SELECT count(*) FROM public.cp_time_entries) = :n_t);
SELECT public.restore_missing_rows('cp_time_entries', :'rows_t'::jsonb) AS replay \gset
SELECT zz.check('73 rejouer ne duplique rien', :replay = 0);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('app.org_guard_off', 'on', false);
SELECT count(*) AS before_item FROM public.cp_time_entries WHERE item_id = pg_temp.it('T-tache') \gset
DELETE FROM public.cp_items WHERE id = pg_temp.it('T-tache');
SELECT zz.check('74 supprimer une tâche supprime son temps', :before_item > 0 AND (SELECT count(*) FROM public.cp_time_entries WHERE item_id NOT IN (SELECT id FROM public.cp_items)) = 0);
INSERT INTO public.users (organization_id, email, first_name, last_name, role) VALUES (:ORG1::uuid, 'temp-p13@iso.test', 'Temp', 'P13', 'user') RETURNING id AS utemp \gset
INSERT INTO public.cp_time_entries (organization_id, item_id, user_id, work_date, minutes) VALUES (:ORG1::uuid, pg_temp.it('T-autre'), :'utemp'::uuid, :'today'::date, 20);
DELETE FROM public.users WHERE id = :'utemp'::uuid;
SELECT zz.check('75 supprimer une personne supprime son temps', (SELECT count(*) FROM public.cp_time_entries WHERE user_id = :'utemp'::uuid) = 0);

/* ------------------------------------------------------------------ 76+. reprise des limites (migration 75) */
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT pg_temp.mk('S-tache', 'task', NULL, '2027-05-03', '2027-05-07');
SELECT pg_temp.mk('S-sub1', 'subtask', 'S-tache', '2027-05-03', '2027-05-04');
SELECT pg_temp.mk('S-sub2', 'subtask', 'S-tache', '2027-05-06', '2027-05-07');
INSERT INTO public.cp_externals (name, company) VALUES ('Ext S', 'Société S');
SELECT id AS exs FROM public.cp_externals WHERE name = 'Ext S' \gset
INSERT INTO public.cp_item_externals (item_id, external_id) VALUES (pg_temp.it('S-tache'), :'exs'::uuid), (pg_temp.it('S-sub1'), :'exs'::uuid);
INSERT INTO public.cp_item_checks (item_id, label, done, position) VALUES (pg_temp.it('S-sub1'), 'Vérifier', true, 1);
INSERT INTO public.cp_item_members (item_id, user_id) VALUES (pg_temp.it('S-sub1'), :'anne'::uuid);
INSERT INTO public.cp_item_resources (item_id, kind, equipment_id, quantity) VALUES (pg_temp.it('S-sub2'), 'equipment', :'eq1'::uuid, 1);
SELECT pg_temp.nc(:'anne'::uuid, 'cp_assigned') AS n_assigned_avant \gset
SELECT public.cp_repeat_item(pg_temp.it('S-tache'), 'weekly', 2) AS rep76 \gset
SELECT zz.check('76 répéter une tâche qui a des sous-tâches (appel à 3 paramètres) : chaque occurrence a ses deux sous-tâches', :rep76 = 2 AND (SELECT count(*) FROM public.cp_items WHERE name = 'S-sub1') = 3 AND (SELECT count(*) FROM public.cp_items WHERE name = 'S-sub2') = 3 AND (SELECT count(DISTINCT parent_id) FROM public.cp_items WHERE name IN ('S-sub1', 'S-sub2')) = 3);
SELECT zz.check('77 mêmes écarts que l''original, par rapport à la nouvelle date de la tâche (occurrence 2 : tâche 10→14 mai, sous-tâches 10→11 et 13→14)',
  (SELECT string_agg(c.name || ':' || c.starts_on || '→' || c.ends_on, ' ' ORDER BY c.name) FROM public.cp_items c JOIN public.cp_items p ON p.id = c.parent_id WHERE p.name = 'S-tache' AND p.series_index = 2) = 'S-sub1:2027-05-10→2027-05-11 S-sub2:2027-05-13→2027-05-14',
  (SELECT string_agg(c.name || ':' || c.starts_on || '→' || c.ends_on, ' ' ORDER BY c.name) FROM public.cp_items c JOIN public.cp_items p ON p.id = c.parent_id WHERE p.name = 'S-tache' AND p.series_index = 2));
SELECT zz.check('78 la copie reprend liste à cocher (décochée), personne, matériel et intervenant externe de la sous-tâche',
  (SELECT count(*) FROM public.cp_item_checks k JOIN public.cp_items c ON c.id = k.item_id JOIN public.cp_items p ON p.id = c.parent_id WHERE c.name = 'S-sub1' AND p.series_index = 2 AND k.label = 'Vérifier' AND NOT k.done) = 1
  AND (SELECT count(*) FROM public.cp_item_members m JOIN public.cp_items c ON c.id = m.item_id JOIN public.cp_items p ON p.id = c.parent_id WHERE c.name = 'S-sub1' AND p.series_index = 2 AND m.user_id = :'anne'::uuid) = 1
  AND (SELECT count(*) FROM public.cp_item_resources r JOIN public.cp_items c ON c.id = r.item_id JOIN public.cp_items p ON p.id = c.parent_id WHERE c.name = 'S-sub2' AND p.series_index = 2 AND r.equipment_id = :'eq1'::uuid) = 1
  AND (SELECT count(*) FROM public.cp_item_externals e JOIN public.cp_items c ON c.id = e.item_id JOIN public.cp_items p ON p.id = c.parent_id WHERE c.name = 'S-sub1' AND p.series_index = 2 AND e.external_id = :'exs'::uuid) = 1);
SELECT zz.check('79 seule la tâche porte le lien de série : ni la série ni le rang n''apparaissent sur les sous-tâches ; l''original garde ses 2 sous-tâches',
  (SELECT count(*) FROM public.cp_items WHERE name IN ('S-sub1', 'S-sub2') AND (series_id IS NOT NULL OR series_index IS NOT NULL)) = 0
  AND (SELECT count(*) FROM public.cp_items WHERE parent_id = pg_temp.it('S-tache') AND series_id IS NULL) = 2 AND (SELECT count(*) FROM public.cp_items WHERE name = 'S-tache') = 3);
SELECT zz.check('80 la copie n''envoie aucun avis d''assignation (la personne de la sous-tâche n''est pas prévenue 2 fois)', pg_temp.nc(:'anne'::uuid, 'cp_assigned') = :n_assigned_avant);

-- Jours ouvrés (option) : 30 avril 2027 = vendredi ; le 30 mai est un dimanche, le 31 mai est fermé (calendrier), le 1er juin est un mardi
RESET ROLE;
SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.cp_calendar_days (organization_id, day, label, kind) VALUES (:ORG1::uuid, '2027-05-31', 'Fermeture P13', 'closure');
SELECT set_config('app.org_guard_off', '', false);
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT pg_temp.mk('S-mois', 'task', NULL, '2027-04-30', '2027-05-04');
SELECT pg_temp.mk('S-mois-sub', 'subtask', 'S-mois', '2027-05-01', '2027-05-01');
SELECT pg_temp.mk('S-brut', 'task', NULL, '2027-04-30', '2027-05-04');
SELECT public.cp_repeat_item(pg_temp.it('S-brut'), 'monthly', 2, false);
SELECT public.cp_repeat_item(pg_temp.it('S-mois'), 'monthly', 2, true);
SELECT zz.check('81 sans l''option : dimanche et jour fermé ne sont pas évités (30 mai → 3 juin)', pg_temp.ser('S-brut') = '2027-04-30→2027-05-04 | 2027-05-30→2027-06-03 | 2027-06-30→2027-07-04', pg_temp.ser('S-brut'));
SELECT zz.check('82 avec l''option : 30 mai (dimanche) → 31 mai (fermé) → mardi 1er juin ; la durée de 4 jours est gardée ; 30 juin (mercredi) ne bouge pas', pg_temp.ser('S-mois') = '2027-04-30→2027-05-04 | 2027-06-01→2027-06-05 | 2027-06-30→2027-07-04', pg_temp.ser('S-mois'));
SELECT zz.check('83 avec l''option, la sous-tâche suit la NOUVELLE date de la tâche (+1 jour : 2 juin, puis 1er juillet)',
  (SELECT string_agg(c.starts_on::text, ' ' ORDER BY p.series_index) FROM public.cp_items c JOIN public.cp_items p ON p.id = c.parent_id WHERE c.name = 'S-mois-sub' AND p.series_index IN (2, 3)) = '2027-06-02 2027-07-01',
  (SELECT string_agg(c.starts_on::text, ' ' ORDER BY p.series_index) FROM public.cp_items c JOIN public.cp_items p ON p.id = c.parent_id WHERE c.name = 'S-mois-sub' AND p.series_index IN (2, 3)));
SELECT zz.check('84 une fréquence inconnue ou un nombre hors limites reste refusé avec le nouveau paramètre', pg_temp.rep('S-mois', 'daily', 1) LIKE 'Fréquence inconnue%' AND zz.raises($q$SELECT public.cp_repeat_item(pg_temp.it('S-brut'), 'weekly', 0, true)$q$) LIKE 'Répète de 1 à 52%');

-- Dupliquer un projet : les intervenants externes suivent les assignations
SELECT public.cp_duplicate_project(:'p1'::uuid, 'Copie avec assignations', NULL, true, true) AS dup_a \gset
SELECT public.cp_duplicate_project(:'p1'::uuid, 'Copie sans assignations', NULL, true, false) AS dup_b \gset
SELECT zz.check('85 copie AVEC assignations : les intervenants externes de la tâche et de sa sous-tâche sont copiés',
  (SELECT count(*) FROM public.cp_item_externals e JOIN public.cp_items i ON i.id = e.item_id WHERE i.project_id = :'dup_a'::uuid AND e.external_id = :'exs'::uuid) >= 2);
SELECT zz.check('86 copie SANS assignations : aucun intervenant externe copié (mais le matériel l''est toujours)',
  (SELECT count(*) FROM public.cp_item_externals e JOIN public.cp_items i ON i.id = e.item_id WHERE i.project_id = :'dup_b'::uuid) = 0
  AND (SELECT count(*) FROM public.cp_item_resources r JOIN public.cp_items i ON i.id = r.item_id WHERE i.project_id = :'dup_b'::uuid) >= 1);

-- Sécurité
SELECT zz.check('87 cp_shift_date et cp_pref_defaults ont un search_path fixé ; cp_shift_date n''est plus exécutable sans connexion',
  (SELECT proconfig::text LIKE '%search_path%' FROM pg_proc WHERE oid = 'public.cp_shift_date(date, text, integer)'::regprocedure)
  AND (SELECT proconfig::text LIKE '%search_path%' FROM pg_proc WHERE oid = 'public.cp_pref_defaults()'::regprocedure)
  AND NOT has_function_privilege('anon', 'public.cp_shift_date(date, text, integer)', 'execute')
  AND has_function_privilege('authenticated', 'public.cp_shift_date(date, text, integer)', 'execute')
  AND NOT has_function_privilege('anon', 'public.cp_repeat_item(uuid, text, integer, boolean)', 'execute')
  AND NOT has_function_privilege('anon', 'public.cp_project_time_by_user(uuid)', 'execute'));

-- Temps par personne (valorisation du budget)
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.cp_time_entries (organization_id, item_id, user_id, work_date, minutes) VALUES
  (:ORG1::uuid, pg_temp.it('S-sub1'), :'ua'::uuid, :'today'::date, 90),
  (:ORG1::uuid, pg_temp.it('S-sub2'), :'ua'::uuid, :'today'::date, 30),
  (:ORG1::uuid, pg_temp.it('S-sub1'), :'anne'::uuid, :'today'::date, 45);
SELECT set_config('app.org_guard_off', '', false);
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('88 le temps par personne : 120 min pour l''administrateur, 45 pour Anne (le chronomètre en cours n''est pas compté)',
  (SELECT string_agg(user_id || ':' || minutes, ' ' ORDER BY minutes DESC) FROM public.cp_project_time_by_user(:'p1'::uuid)) LIKE :'ua' || ':%' AND
  (SELECT minutes FROM public.cp_project_time_by_user(:'p1'::uuid) WHERE user_id = :'ua'::uuid) >= 120 AND (SELECT minutes FROM public.cp_project_time_by_user(:'p1'::uuid) WHERE user_id = :'anne'::uuid) >= 45);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('89 une personne sans le droit « budget » n''obtient rien (le temps des autres reste personnel)', (SELECT count(*) FROM public.cp_project_time_by_user(:'p1'::uuid)) = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('90 une autre entreprise n''obtient rien, même avec le droit « budget »', (SELECT count(*) FROM public.cp_project_time_by_user(:'p1'::uuid)) = 0);
RESET ROLE;
SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.cp_calendar_days WHERE label = 'Fermeture P13';
SELECT set_config('request.jwt.claim.sub', '', false);

DELETE FROM public.cp_time_entries; DELETE FROM public.cp_item_externals; DELETE FROM public.cp_externals; DELETE FROM public.cp_item_resources; DELETE FROM public.cp_comments; DELETE FROM public.cp_item_members; DELETE FROM public.cp_item_checks; DELETE FROM public.cp_items; DELETE FROM public.cp_project_members; DELETE FROM public.cp_projects;
DELETE FROM public.equipment WHERE name = 'Perceuse P13'; DELETE FROM public.vehicles WHERE plate = 'ZZ 1301'; DELETE FROM public.users WHERE email LIKE '%@p13.test';
DELETE FROM public.notifications;
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name || COALESCE(' — ' || detail, '') AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
