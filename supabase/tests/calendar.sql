-- P2 : calendrier de travail (jours fériés et fermetures) : droits, isolation, jours ouvrés, cascade des dépendances. À lancer APRÈS isolation.sql.
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

-- Outil : appliquer une règle de projet
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_projects (name, type) VALUES ('Projet H', 'rd'), ('Projet W', 'rd'), ('Projet K', 'rd');
UPDATE public.cp_projects SET link_skip_weekends = false WHERE name = 'Projet W';
UPDATE public.cp_projects SET link_mode = 'keep_gap' WHERE name = 'Projet K';
SELECT organization_id AS org_a FROM public.cp_projects WHERE name = 'Projet H' \gset

-- 1. La table : saisie, contraintes
INSERT INTO public.cp_calendar_days (day, label, kind) VALUES ('2027-03-05', 'Jour férié test', 'holiday'), ('2027-03-08', 'Fermeture test', 'closure');
SELECT zz.check('A saisit des jours : l''entreprise est posée par la base', (SELECT count(*) FROM public.cp_calendar_days WHERE organization_id = :'org_a'::uuid) = 2);
SELECT zz.check('un même jour deux fois : refusé', zz.raises($$INSERT INTO public.cp_calendar_days (day, label) VALUES ('2027-03-05', 'Doublon')$$) IS NOT NULL);
SELECT zz.check('type inconnu refusé', zz.raises($$INSERT INTO public.cp_calendar_days (day, label, kind) VALUES ('2027-04-01', 'X', 'magie')$$) IS NOT NULL);
SELECT zz.check('libellé vide refusé', zz.raises($$INSERT INTO public.cp_calendar_days (day, label) VALUES ('2027-04-01', '   ')$$) IS NOT NULL);
SELECT zz.check('libellé de plus de 120 caractères refusé', zz.raises(format('INSERT INTO public.cp_calendar_days (day, label) VALUES (%L, %L)', '2027-04-01', repeat('x', 121))) IS NOT NULL);
SELECT zz.check('journal d''audit : l''ajout y figure', (SELECT count(*) FROM public.audit_log WHERE table_name = 'cp_calendar_days' AND action = 'insert') >= 2);

-- 2. Jours ouvrés (2027-03-01 est un lundi : le 06 est un samedi, le 07 un dimanche)
SELECT zz.check('lundi ordinaire : ouvré', public.cp_is_working_day(:'org_a'::uuid, '2027-03-01'));
SELECT zz.check('samedi : non ouvré', NOT public.cp_is_working_day(:'org_a'::uuid, '2027-03-06'));
SELECT zz.check('dimanche : non ouvré', NOT public.cp_is_working_day(:'org_a'::uuid, '2027-03-07'));
SELECT zz.check('jour férié de la semaine : non ouvré', NOT public.cp_is_working_day(:'org_a'::uuid, '2027-03-05'));
SELECT zz.check('fermeture : non ouvrée', NOT public.cp_is_working_day(:'org_a'::uuid, '2027-03-08'));
SELECT zz.check('avancer depuis le vendredi férié : mardi 9 (week-end et fermeture du lundi passés)', public.cp_adjust_working_day(:'org_a'::uuid, '2027-03-05', 1) = '2027-03-09');
SELECT zz.check('reculer depuis le lundi fermé : jeudi 4 (le vendredi est férié)', public.cp_adjust_working_day(:'org_a'::uuid, '2027-03-08', -1) = '2027-03-04');
SELECT zz.check('un jour ouvré reste tel quel', public.cp_adjust_working_day(:'org_a'::uuid, '2027-03-02', 1) = '2027-03-02' AND public.cp_adjust_working_day(:'org_a'::uuid, '2027-03-02', -1) = '2027-03-02');
SELECT zz.check('sens invalide refusé', zz.raises(format('SELECT public.cp_adjust_working_day(%L::uuid, %L::date, 0)', :'org_a', '2027-03-05')) LIKE '%Sens invalide%');

-- 3. Cascade : mode « seulement si chevauchement », avec « éviter les week-ends et jours non travaillés » (projet H)
SELECT pg_temp.mk('Projet H', 'H-A', 'task', NULL, '2027-03-01', '2027-03-04');
SELECT pg_temp.mk('Projet H', 'H-B', 'task', NULL, '2027-03-03', '2027-03-06');
SELECT coalesce(pg_temp.lk('H-A', 'H-B'), 'ok') AS e_h \gset
SELECT zz.check('H-B chevauchait H-A (fin jeudi 4) : il ne commence ni le vendredi férié, ni le week-end, ni le lundi fermé → mardi 9, même durée', :'e_h' = 'ok' AND pg_temp.d('H-B') = '2027-03-09→2027-03-12');
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'H-A'), 7) AS n1 \gset
SELECT zz.check('H-A +7 jours (fin jeudi 11) : H-B, qui chevauche, passe au vendredi 12 (ouvré), durée gardée', pg_temp.d('H-A') = '2027-03-08→2027-03-11' AND pg_temp.d('H-B') = '2027-03-12→2027-03-15');

-- 4. Le même cas sans éviter les non ouvrés (projet W) : seul le chevauchement compte
SELECT pg_temp.mk('Projet W', 'W-A', 'task', NULL, '2027-03-01', '2027-03-04');
SELECT pg_temp.mk('Projet W', 'W-B', 'task', NULL, '2027-03-03', '2027-03-06');
SELECT coalesce(pg_temp.lk('W-A', 'W-B'), 'ok') AS e_w \gset
SELECT zz.check('case « éviter » décochée : W-B commence le lendemain de la fin de W-A, même un jour férié', :'e_w' = 'ok' AND pg_temp.d('W-B') = '2027-03-05→2027-03-08');

-- 5. Mode « garder l'intervalle » (projet K) : sens avant puis arrière
SELECT pg_temp.mk('Projet K', 'K-P', 'task', NULL, '2027-03-01', '2027-03-02');
SELECT pg_temp.mk('Projet K', 'K-Q', 'task', NULL, '2027-03-02', '2027-03-03');
SELECT coalesce(pg_temp.lk('K-P', 'K-Q'), 'ok') AS e_k \gset
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'K-P'), 3) AS n2 \gset
SELECT zz.check('K-P +3 : K-Q devrait commencer le vendredi 5 (férié) : il avance au mardi 9, durée gardée', pg_temp.d('K-P') = '2027-03-04→2027-03-05' AND pg_temp.d('K-Q') = '2027-03-09→2027-03-10');
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'K-P'), -3) AS n3 \gset
SELECT zz.check('K-P -3 : K-Q recule vers le jeudi 4 (jour ouvré le plus proche en arrière depuis le 6)', pg_temp.d('K-P') = '2027-03-01→2027-03-02' AND pg_temp.d('K-Q') = '2027-03-04→2027-03-05');

-- 6. Retirer un jour du calendrier : la cascade suivante en tient compte
SELECT zz.affected($$DELETE FROM public.cp_calendar_days WHERE day = '2027-03-05'$$) AS n_del \gset
SELECT zz.check('suppression d''un jour du calendrier', :n_del = 1 AND NOT public.cp_is_working_day(:'org_a'::uuid, '2027-03-08') AND public.cp_is_working_day(:'org_a'::uuid, '2027-03-05'));
SELECT zz.affected($$UPDATE public.cp_calendar_days SET label = 'Fermeture renommée', kind = 'holiday' WHERE day = '2027-03-08'$$) AS n_upd \gset
SELECT zz.check('un jour se renomme et change de type', :n_upd = 1 AND (SELECT label || kind FROM public.cp_calendar_days WHERE day = '2027-03-08') = 'Fermeture renomméeholiday');
RESET ROLE;

-- 7. Collaborateur : lit, n'écrit pas
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U lit le calendrier', (SELECT count(*) FROM public.cp_calendar_days) = 1);
SELECT zz.check('U n''ajoute pas de jour', zz.raises($$INSERT INTO public.cp_calendar_days (day, label) VALUES ('2027-05-01', 'Non')$$) IS NOT NULL);
SELECT zz.check('U ne modifie rien', zz.affected($$UPDATE public.cp_calendar_days SET label = 'Piraté'$$) = 0);
SELECT zz.check('U ne supprime rien', zz.affected($$DELETE FROM public.cp_calendar_days$$) = 0);
RESET ROLE;

-- 8. Isolation : l'entreprise B ne voit ni n'influence le calendrier de A
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B ne voit aucun jour de A', (SELECT count(*) FROM public.cp_calendar_days) = 0);
SELECT zz.check('B ne peut pas poser un jour dans l''entreprise de A', zz.raises(format('INSERT INTO public.cp_calendar_days (organization_id, day, label) VALUES (%L, %L, %L)', :'org_a', '2027-06-01', 'Intrus')) IS NOT NULL);
INSERT INTO public.cp_calendar_days (day, label) VALUES ('2027-03-02', 'Férié de B');
SELECT zz.check('B pose son propre jour', (SELECT count(*) FROM public.cp_calendar_days) = 1);
SELECT zz.check('chez B, le mardi 2 mars est non ouvré', NOT public.cp_is_working_day(:ORG2::uuid, '2027-03-02'));
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A ne voit pas le jour de B', (SELECT count(*) FROM public.cp_calendar_days WHERE label = 'Férié de B') = 0);
SELECT zz.check('le jour de B n''affecte pas A : le mardi 2 mars reste ouvré chez A', public.cp_is_working_day(:'org_a'::uuid, '2027-03-02'));
SELECT zz.check('A ne devine pas le calendrier de B par la fonction (isolation appliquée : le mardi est ouvré)', public.cp_is_working_day(:ORG2::uuid, '2027-03-02'));
RESET ROLE;

-- 9. Personne d'anonyme
GRANT USAGE ON SCHEMA zz TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO anon;
SET ROLE anon;
SELECT zz.check('anon ne lit pas le calendrier', zz.raises($$SELECT count(*) FROM public.cp_calendar_days$$) IS NOT NULL);
SELECT zz.check('anon n''exécute pas cp_is_working_day', zz.raises(format('SELECT public.cp_is_working_day(%L::uuid, %L::date)', :'org_a', '2027-03-01')) IS NOT NULL);
RESET ROLE;

SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.cp_items; DELETE FROM public.cp_calendar_days; DELETE FROM public.cp_projects WHERE name IN ('Projet H', 'Projet W', 'Projet K');
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
