-- P9 : ligne de base d un projet (photo des dates), droits, isolation, cascade. À lancer APRÈS isolation.sql.
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
INSERT INTO public.cp_projects (name, type, starts_on, ends_on) VALUES ('Projet LB', 'rd', '2027-03-01', '2027-03-31'), ('Projet LB2', 'rd', NULL, NULL);
SELECT pg_temp.mk('Projet LB', 'LB-A', 'task', NULL, '2027-03-01', '2027-03-05');
SELECT pg_temp.mk('Projet LB', 'LB-B', 'task', NULL, '2027-03-08', '2027-03-12');
SELECT pg_temp.mk('Projet LB', 'LB-U', 'task', NULL, NULL, NULL);
SELECT pg_temp.mk('Projet LB', 'LB-M', 'milestone', NULL, '2027-03-31', '2027-03-31');
SELECT id AS lb FROM public.cp_projects WHERE name = 'Projet LB' \gset

-- 1. Figer
SELECT public.cp_set_baseline(:'lb'::uuid) AS n1 \gset
SELECT zz.check('figer : 1 ligne pour le projet + 3 éléments datés (pas l''élément sans date)', :n1 = 4 AND (SELECT count(*) FROM public.cp_baseline_dates WHERE project_id = :'lb'::uuid) = 4);
SELECT zz.check('la ligne du projet porte ses dates', (SELECT starts_on::text || ends_on::text FROM public.cp_baseline_dates WHERE project_id = :'lb'::uuid AND item_id IS NULL) = '2027-03-012027-03-31');
SELECT zz.check('une ligne par élément avec ses dates', (SELECT b.starts_on::text || b.ends_on::text FROM public.cp_baseline_dates b JOIN public.cp_items i ON i.id = b.item_id WHERE i.name = 'LB-B') = '2027-03-082027-03-12');
SELECT zz.check('même instant de prise pour toutes les lignes', (SELECT count(DISTINCT taken_at) FROM public.cp_baseline_dates WHERE project_id = :'lb'::uuid) = 1);

-- 2. La ligne de base ne bouge pas quand le plan change ; figer à nouveau la remplace
SELECT zz.affected($$UPDATE public.cp_items SET starts_on = '2027-03-15', ends_on = '2027-03-19' WHERE name = 'LB-B'$$) AS m \gset
SELECT zz.check('le plan change, la ligne de base garde les dates d''origine', (SELECT b.ends_on::text FROM public.cp_baseline_dates b JOIN public.cp_items i ON i.id = b.item_id WHERE i.name = 'LB-B') = '2027-03-12' AND :m = 1);
SELECT public.cp_set_baseline(:'lb'::uuid) AS n2 \gset
SELECT zz.check('figer de nouveau remplace : toujours 4 lignes, dates à jour', :n2 = 4 AND (SELECT count(*) FROM public.cp_baseline_dates WHERE project_id = :'lb'::uuid) = 4 AND (SELECT b.ends_on::text FROM public.cp_baseline_dates b JOIN public.cp_items i ON i.id = b.item_id WHERE i.name = 'LB-B') = '2027-03-19');
SELECT zz.check('un projet sans date : une ligne seulement (le projet, dates vides)', public.cp_set_baseline((SELECT id FROM public.cp_projects WHERE name = 'Projet LB2')) = 1);

-- 3. Cascade
SELECT zz.affected($$DELETE FROM public.cp_items WHERE name = 'LB-M'$$) AS d \gset
SELECT zz.check('supprimer un élément supprime sa ligne de base', :d = 1 AND (SELECT count(*) FROM public.cp_baseline_dates WHERE project_id = :'lb'::uuid) = 3);
SELECT zz.check('contraintes : un seul enregistrement de projet par ligne de base', zz.raises(format('INSERT INTO public.cp_baseline_dates (project_id, item_id, starts_on, ends_on) VALUES (%L, NULL, NULL, NULL)', :'lb')) IS NOT NULL);
SELECT id AS lb2 FROM public.cp_projects WHERE name = 'Projet LB2' \gset
SELECT id AS lba FROM public.cp_items WHERE name = 'LB-A' \gset
SELECT zz.check('élément d''un autre projet refusé', zz.raises(format('INSERT INTO public.cp_baseline_dates (project_id, item_id) VALUES (%L, %L)', :'lb2', :'lba')) LIKE '%introuvable dans ce projet%');
SELECT zz.check('fin avant début refusée', zz.raises(format('UPDATE public.cp_baseline_dates SET starts_on = %L, ends_on = %L WHERE project_id = %L AND item_id IS NULL', '2027-05-01', '2027-04-01', :'lb')) IS NOT NULL);

-- 4. Effacer, modèles, erreurs
SELECT public.cp_clear_baseline(:'lb'::uuid) AS c \gset
SELECT zz.check('effacer : toutes les lignes du projet partent', :c = 3 AND (SELECT count(*) FROM public.cp_baseline_dates WHERE project_id = :'lb'::uuid) = 0);
SELECT zz.check('effacer sans ligne de base : 0, sans erreur', public.cp_clear_baseline(:'lb'::uuid) = 0);
SELECT zz.check('projet inconnu refusé (figer et effacer)', zz.raises($$SELECT public.cp_set_baseline(gen_random_uuid())$$) LIKE '%introuvable%' AND zz.raises($$SELECT public.cp_clear_baseline(gen_random_uuid())$$) LIKE '%introuvable%');
SELECT public.cp_save_as_template(:'lb'::uuid, 'Modèle LB') AS tpl \gset
SELECT zz.check('un modèle n''a pas de ligne de base', zz.raises(format('SELECT public.cp_set_baseline(%L)', :'tpl')) LIKE '%modèle%');
SELECT public.cp_set_baseline(:'lb'::uuid) AS n3 \gset
SELECT zz.affected($$DELETE FROM public.cp_projects WHERE name = 'Projet LB2'$$) AS dp \gset
SELECT zz.check('supprimer un projet supprime sa ligne de base', :dp = 1 AND (SELECT count(*) FROM public.cp_baseline_dates WHERE project_id = :'lb'::uuid) = 3);
RESET ROLE;

-- 5. Collaborateur : lit, ne fige pas
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U lit la ligne de base', (SELECT count(*) FROM public.cp_baseline_dates) = 3);
SELECT zz.check('U ne fige pas de ligne de base (refusé par les droits)', zz.raises(format('SELECT public.cp_set_baseline(%L)', :'lb')) IS NOT NULL);
SELECT zz.check('… et la ligne de base existante est intacte', (SELECT count(*) FROM public.cp_baseline_dates) = 3);
SELECT zz.check('U n''efface rien', zz.affected($$DELETE FROM public.cp_baseline_dates$$) = 0);
SELECT zz.check('U ne modifie rien', zz.affected($$UPDATE public.cp_baseline_dates SET ends_on = ends_on + 1$$) = 0);
RESET ROLE;

-- 6. Isolation : l'entreprise B
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B ne voit aucune ligne de base de A', (SELECT count(*) FROM public.cp_baseline_dates) = 0);
SELECT zz.check('B ne fige pas la ligne de base d''un projet de A', zz.raises(format('SELECT public.cp_set_baseline(%L)', :'lb')) LIKE '%introuvable%');
SELECT zz.check('B n''efface pas celle de A', zz.raises(format('SELECT public.cp_clear_baseline(%L)', :'lb')) LIKE '%introuvable%');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('la ligne de base de A est intacte (3 lignes)', (SELECT count(*) FROM public.cp_baseline_dates WHERE project_id = :'lb'::uuid) = 3);
RESET ROLE;

GRANT USAGE ON SCHEMA zz TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO anon;
SET ROLE anon;
SELECT zz.check('anon ne lit pas et ne fige pas', zz.raises($$SELECT count(*) FROM public.cp_baseline_dates$$) IS NOT NULL AND zz.raises($$SELECT public.cp_set_baseline(gen_random_uuid())$$) IS NOT NULL);
RESET ROLE;

SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.cp_items; DELETE FROM public.cp_projects;
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
