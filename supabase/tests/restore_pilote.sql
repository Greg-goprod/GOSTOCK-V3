-- P14 : sauvegarde et restauration des nouvelles tables PILOTE (calendrier, capacités, lignes de base). À lancer APRÈS isolation.sql.
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
INSERT INTO public.cp_projects (name, type, starts_on, ends_on) VALUES ('Projet Sauvegarde', 'rd', '2027-03-01', '2027-03-31');
SELECT pg_temp.mk('Projet Sauvegarde', 'SV-A', 'task', NULL, '2027-03-01', '2027-03-05');
SELECT id AS sp FROM public.cp_projects WHERE name = 'Projet Sauvegarde' \gset
SELECT id AS sa FROM public.cp_items WHERE name = 'SV-A' \gset

-- 1. Calendrier de travail
SELECT public.restore_missing_rows('cp_calendar_days', jsonb_build_array(
  jsonb_build_object('id', '00000000-aaaa-0000-0000-000000000001', 'organization_id', :ORG1, 'day', '2027-05-01', 'label', 'Fête du travail', 'kind', 'holiday', 'created_at', '2027-01-01T00:00:00Z'),
  jsonb_build_object('id', '00000000-aaaa-0000-0000-000000000002', 'organization_id', :ORG2, 'day', '2027-05-02', 'label', 'Intrus', 'kind', 'holiday', 'created_at', '2027-01-01T00:00:00Z'))) AS r1 \gset
SELECT zz.check('calendrier : la ligne de SON entreprise est remise, celle d''une autre entreprise est ignorée', :r1 = 1 AND (SELECT count(*) FROM public.cp_calendar_days WHERE day = '2027-05-01') = 1);
SELECT public.restore_missing_rows('cp_calendar_days', jsonb_build_array(jsonb_build_object('id', '00000000-aaaa-0000-0000-000000000001', 'organization_id', :ORG1, 'day', '2027-05-01', 'label', 'Fête du travail', 'kind', 'holiday', 'created_at', '2027-01-01T00:00:00Z'))) AS r2 \gset
SELECT zz.check('calendrier : rejouer ne remet rien (aucun écrasement ni doublon)', :r2 = 0 AND (SELECT count(*) FROM public.cp_calendar_days) = 1);
SELECT zz.affected($$UPDATE public.cp_calendar_days SET label = 'Modifié depuis' WHERE day = '2027-05-01'$$) AS m \gset
SELECT public.restore_missing_rows('cp_calendar_days', jsonb_build_array(jsonb_build_object('id', '00000000-aaaa-0000-0000-000000000001', 'organization_id', :ORG1, 'day', '2027-05-01', 'label', 'Ancien libellé', 'kind', 'holiday', 'created_at', '2027-01-01T00:00:00Z'))) AS r3 \gset
SELECT zz.check('calendrier : une ligne modifiée depuis la sauvegarde n''est pas écrasée', :r3 = 0 AND (SELECT label FROM public.cp_calendar_days WHERE day = '2027-05-01') = 'Modifié depuis');

-- 2. Capacités (clé primaire composée : pas de colonne « id »)
SELECT public.restore_missing_rows('cp_user_capacity', jsonb_build_array(jsonb_build_object('organization_id', :ORG1, 'user_id', :'ua', 'hours_per_week', 30, 'updated_at', '2027-01-01T00:00:00Z'))) AS c1 \gset
SELECT zz.check('capacité : remise (clé primaire composée), valeur gardée', :c1 = 1 AND (SELECT hours_per_week FROM public.cp_user_capacity WHERE user_id = :'ua'::uuid) = 30);
SELECT public.restore_missing_rows('cp_user_capacity', jsonb_build_array(jsonb_build_object('organization_id', :ORG1, 'user_id', :'ua', 'hours_per_week', 10, 'updated_at', '2027-01-01T00:00:00Z'))) AS c2 \gset
SELECT zz.check('capacité : rejouer avec une autre valeur n''écrase pas', :c2 = 0 AND (SELECT hours_per_week FROM public.cp_user_capacity WHERE user_id = :'ua'::uuid) = 30);
SELECT public.restore_missing_rows('cp_user_capacity', jsonb_build_array(jsonb_build_object('organization_id', :ORG2, 'user_id', :'ub', 'hours_per_week', 20, 'updated_at', '2027-01-01T00:00:00Z'))) AS c3 \gset
SELECT zz.check('capacité : une ligne portant l''entreprise d''une autre est ignorée', :c3 = 0);

-- 3. Lignes de base
SELECT public.restore_missing_rows('cp_baseline_dates', jsonb_build_array(
  jsonb_build_object('id', '00000000-bbbb-0000-0000-000000000001', 'organization_id', :ORG1, 'project_id', :'sp', 'item_id', NULL, 'starts_on', '2027-03-01', 'ends_on', '2027-03-31', 'taken_at', '2027-02-20T10:00:00Z'),
  jsonb_build_object('id', '00000000-bbbb-0000-0000-000000000002', 'organization_id', :ORG1, 'project_id', :'sp', 'item_id', :'sa', 'starts_on', '2027-03-01', 'ends_on', '2027-03-05', 'taken_at', '2027-02-20T10:00:00Z'))) AS b1 \gset
SELECT zz.check('ligne de base : projet et élément remis, dates et date de prise conservées', :b1 = 2 AND (SELECT count(*) FROM public.cp_baseline_dates WHERE project_id = :'sp'::uuid) = 2 AND (SELECT taken_at::date::text FROM public.cp_baseline_dates WHERE item_id IS NULL AND project_id = :'sp'::uuid) = '2027-02-20');
SELECT public.restore_missing_rows('cp_baseline_dates', jsonb_build_array(jsonb_build_object('id', '00000000-bbbb-0000-0000-000000000003', 'organization_id', :ORG1, 'project_id', :'sp', 'item_id', NULL, 'starts_on', '2027-06-01', 'ends_on', '2027-06-30', 'taken_at', '2027-02-21T10:00:00Z'))) AS b2 \gset
SELECT zz.check('ligne de base : une seconde ligne « projet » (autre identifiant) ne double pas (une seule par projet)', :b2 = 0 AND (SELECT count(*) FROM public.cp_baseline_dates WHERE project_id = :'sp'::uuid AND item_id IS NULL) = 1);
RESET ROLE;

-- 4. Droits
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('un collaborateur ne restaure rien (3 tables)', zz.raises($$SELECT public.restore_missing_rows('cp_calendar_days', '[]'::jsonb)$$) LIKE '%Accès refusé%' AND zz.raises($$SELECT public.restore_missing_rows('cp_user_capacity', '[]'::jsonb)$$) LIKE '%Accès refusé%' AND zz.raises($$SELECT public.restore_missing_rows('cp_baseline_dates', '[]'::jsonb)$$) LIKE '%Accès refusé%');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('la liste reste fermée : une table voisine non listée est toujours refusée', zz.raises($$SELECT public.restore_missing_rows('cp_document_trash', '[]'::jsonb)$$) LIKE '%Table inconnue%' AND zz.raises($$SELECT public.restore_missing_rows('owner_admins', '[]'::jsonb)$$) LIKE '%Table inconnue%');
RESET ROLE;

-- 5. Isolation après restauration : B ne voit rien de ce qui a été remis chez A
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B ne voit ni calendrier, ni capacité, ni ligne de base de A', (SELECT count(*) FROM public.cp_calendar_days) = 0 AND (SELECT count(*) FROM public.cp_user_capacity) = 0 AND (SELECT count(*) FROM public.cp_baseline_dates) = 0);
RESET ROLE;

SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.cp_items; DELETE FROM public.cp_projects; DELETE FROM public.cp_calendar_days; DELETE FROM public.cp_user_capacity;
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
