-- P12 : historique d une fiche (journal d audit lisible par qui voit le projet) : droits, isolation, ordre. À lancer APRÈS isolation.sql.
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
INSERT INTO public.cp_projects (name, type) VALUES ('Projet Histo', 'rd');
SELECT pg_temp.mk('Projet Histo', 'H-1', 'task', NULL, '2027-03-01', '2027-03-05');
SELECT id AS hp FROM public.cp_projects WHERE name = 'Projet Histo' \gset
SELECT id AS hi FROM public.cp_items WHERE name = 'H-1' \gset
SELECT zz.affected($$UPDATE public.cp_items SET name = 'H-1 renommé' WHERE name = 'H-1'$$) AS n1 \gset
SELECT zz.affected($$UPDATE public.cp_items SET starts_on = '2027-03-02', ends_on = '2027-03-06' WHERE name = 'H-1 renommé'$$) AS n2 \gset
SELECT zz.affected($$UPDATE public.cp_projects SET description = 'Une description' WHERE name = 'Projet Histo'$$) AS n3 \gset

-- 1. Contenu
SELECT zz.check('élément : création + 2 modifications, la plus récente d''abord', (SELECT count(*) FROM public.cp_history('item', :'hi'::uuid)) = 3
  AND (SELECT action FROM public.cp_history('item', :'hi'::uuid) LIMIT 1) = 'update' AND (SELECT action FROM (SELECT * FROM public.cp_history('item', :'hi'::uuid)) h OFFSET 2) = 'insert');
SELECT zz.check('la dernière modification montre ancien et nouvel état des dates', (SELECT changes -> 'ends_on' FROM public.cp_history('item', :'hi'::uuid) LIMIT 1) = '["2027-03-05", "2027-03-06"]'::jsonb);
SELECT zz.check('le nom change dans l''avant-dernière ligne', (SELECT changes -> 'name' FROM (SELECT * FROM public.cp_history('item', :'hi'::uuid)) h OFFSET 1 LIMIT 1) = '["H-1", "H-1 renommé"]'::jsonb);
SELECT zz.check('l''auteur est nommé (pas vide)', (SELECT who FROM public.cp_history('item', :'hi'::uuid) LIMIT 1) <> '' AND (SELECT who FROM public.cp_history('item', :'hi'::uuid) LIMIT 1) <> '—');
SELECT zz.check('projet : création + modification de la description', (SELECT count(*) FROM public.cp_history('project', :'hp'::uuid)) = 2 AND (SELECT changes -> 'description' ->> 1 FROM public.cp_history('project', :'hp'::uuid) LIMIT 1) = 'Une description');
SELECT zz.check('un identifiant inconnu : aucune ligne, sans erreur', (SELECT count(*) FROM public.cp_history('item', gen_random_uuid())) = 0);
SELECT zz.check('type inconnu refusé', zz.raises($$SELECT * FROM public.cp_history('equipment', gen_random_uuid())$$) LIKE '%Type inconnu%');
RESET ROLE;

-- 2. Collaborateur : lit l'historique (il voit le projet) sans droit sur le journal
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U ne lit pas le journal d''audit directement', (SELECT count(*) FROM public.audit_log) = 0);
SELECT zz.check('U lit pourtant l''historique de la fiche', (SELECT count(*) FROM public.cp_history('item', :'hi'::uuid)) = 3);
SELECT zz.check('U ne lit que cette fiche : l''historique d''un autre élément est vide', (SELECT count(*) FROM public.cp_history('item', :'hp'::uuid)) = 0);
RESET ROLE;

-- 3. Isolation : l'entreprise B
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B ne lit pas l''historique d''une fiche de A (aucune ligne)', (SELECT count(*) FROM public.cp_history('item', :'hi'::uuid)) = 0 AND (SELECT count(*) FROM public.cp_history('project', :'hp'::uuid)) = 0);
RESET ROLE;

-- 4. Module désactivé, anonyme
SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects' AND organization_id = :ORG1::uuid;
SELECT set_config('app.org_guard_off', '', false);
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('module PILOTE désactivé : historique refusé', zz.raises(format('SELECT * FROM public.cp_history(%L, %L)', 'item', :'hi')) LIKE '%Accès refusé%');
RESET ROLE;
GRANT USAGE ON SCHEMA zz TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO anon;
SET ROLE anon;
SELECT zz.check('anon n''exécute pas cp_history', zz.raises(format('SELECT * FROM public.cp_history(%L, %L)', 'item', :'hi')) IS NOT NULL);
RESET ROLE;

SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.cp_items; DELETE FROM public.cp_projects;
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
