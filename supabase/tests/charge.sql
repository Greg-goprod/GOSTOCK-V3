-- P6 : charge par personne (estimation en heures, capacité hebdomadaire) : contraintes, droits, isolation, copie. À lancer APRÈS isolation.sql.
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
INSERT INTO public.cp_projects (name, type, starts_on, ends_on) VALUES ('Projet Charge', 'rd', '2027-03-01', '2027-03-31');
SELECT pg_temp.mk('Projet Charge', 'C-T1', 'task', NULL, '2027-03-01', '2027-03-05');
SELECT pg_temp.mk('Projet Charge', 'C-T2', 'task', NULL, '2027-03-08', '2027-03-12');
SELECT pg_temp.mk('Projet Charge', 'C-T3', 'task', NULL, '2027-03-15', '2027-03-19');
SELECT organization_id AS org_a FROM public.cp_projects WHERE name = 'Projet Charge' \gset

-- 1. Estimation en heures
SELECT zz.check('estimation vide par défaut (non estimé)', (SELECT estimate_hours IS NULL FROM public.cp_items WHERE name = 'C-T1'));
SELECT zz.affected($$UPDATE public.cp_items SET estimate_hours = 12.5 WHERE name = 'C-T1'$$) AS n_est \gset
SELECT zz.check('estimation de 12,5 h enregistrée', :n_est = 1 AND (SELECT estimate_hours FROM public.cp_items WHERE name = 'C-T1') = 12.5);
SELECT zz.check('0 h accepté', zz.affected($$UPDATE public.cp_items SET estimate_hours = 0 WHERE name = 'C-T3'$$) = 1);
SELECT zz.check('9 999 h accepté (plafond)', zz.affected($$UPDATE public.cp_items SET estimate_hours = 9999 WHERE name = 'C-T3'$$) = 1);
SELECT zz.check('9 999,1 h refusé (au-dessus du plafond)', zz.raises($$UPDATE public.cp_items SET estimate_hours = 9999.1 WHERE name = 'C-T3'$$) IS NOT NULL);
SELECT zz.check('négatif refusé', zz.raises($$UPDATE public.cp_items SET estimate_hours = -1 WHERE name = 'C-T1'$$) IS NOT NULL);
SELECT zz.check('10 000 h refusé', zz.raises($$UPDATE public.cp_items SET estimate_hours = 10000 WHERE name = 'C-T1'$$) IS NOT NULL);
SELECT zz.affected($$UPDATE public.cp_items SET estimate_hours = 8 WHERE name = 'C-T2'$$) AS n \gset
SELECT zz.affected($$UPDATE public.cp_items SET estimate_hours = 3 WHERE name = 'C-T3'$$) AS n3 \gset
SELECT zz.check('effacer l''estimation (NULL) accepté', zz.affected($$UPDATE public.cp_items SET estimate_hours = NULL WHERE name = 'C-T2'$$) = 1);
SELECT zz.affected($$UPDATE public.cp_items SET estimate_hours = 8 WHERE name = 'C-T2'$$) AS n4 \gset
SELECT zz.check('le changement d''estimation figure au journal d''audit', (SELECT count(*) FROM public.audit_log WHERE table_name = 'cp_items' AND action = 'update' AND changes ? 'estimate_hours') >= 1);

-- 2. L'estimation suit une copie, un modèle, un projet créé depuis un modèle
SELECT public.cp_duplicate_project((SELECT id FROM public.cp_projects WHERE name = 'Projet Charge'), 'Copie Charge', '2027-06-07', false, false) AS dup \gset
SELECT zz.check('dupliquer un projet garde les heures estimées (12,5 / 8 / 3)', (SELECT array_agg(estimate_hours ORDER BY name) FROM public.cp_items WHERE project_id = :'dup'::uuid) = ARRAY[12.5, 8, 3]::numeric[]);
SELECT public.cp_save_as_template((SELECT id FROM public.cp_projects WHERE name = 'Projet Charge'), 'Modèle Charge') AS tpl \gset
SELECT public.cp_create_from_template(:'tpl'::uuid, 'Issu du modèle Charge', '2027-09-06') AS fromtpl \gset
SELECT zz.check('modèle et projet issu du modèle gardent aussi les heures', (SELECT sum(estimate_hours) FROM public.cp_items WHERE project_id = :'tpl'::uuid) = 23.5 AND (SELECT sum(estimate_hours) FROM public.cp_items WHERE project_id = :'fromtpl'::uuid) = 23.5);
SELECT zz.check('une phase sans estimation reste sans estimation à la copie (NULL, pas 0)', (SELECT count(*) FROM public.cp_items WHERE project_id = :'dup'::uuid AND estimate_hours IS NULL) = 0
  AND zz.affected($$UPDATE public.cp_items SET estimate_hours = NULL WHERE name = 'C-T1' AND project_id = (SELECT id FROM public.cp_projects WHERE name = 'Copie Charge')$$) = 1);
SELECT public.cp_duplicate_project((SELECT id FROM public.cp_projects WHERE name = 'Copie Charge'), 'Copie de copie', '2027-07-05', false, false) AS dup2 \gset
SELECT zz.check('une estimation vide est copiée vide (NULL)', (SELECT estimate_hours IS NULL FROM public.cp_items WHERE project_id = :'dup2'::uuid AND name = 'C-T1'));

-- 3. Capacité hebdomadaire
SELECT id AS ua FROM public.users WHERE email = 'a@iso.test' AND organization_id = :ORG1::uuid \gset
SELECT id AS uu FROM public.users WHERE email = 'u@iso.test' AND organization_id = :ORG1::uuid \gset
INSERT INTO public.cp_user_capacity (user_id, hours_per_week) VALUES (:'uu'::uuid, 32);
SELECT zz.check('A saisit la capacité d''une personne (32 h/semaine) : l''entreprise est posée par la base', (SELECT organization_id = :'org_a'::uuid AND hours_per_week = 32 FROM public.cp_user_capacity WHERE user_id = :'uu'::uuid));
SELECT zz.check('une personne a une seule ligne de capacité', zz.raises(format('INSERT INTO public.cp_user_capacity (user_id, hours_per_week) VALUES (%L, 20)', :'uu')) IS NOT NULL);
SELECT zz.affected(format('UPDATE public.cp_user_capacity SET hours_per_week = 24 WHERE user_id = %L', :'uu')) AS n_cap \gset
SELECT zz.check('mise à jour : 24 h/semaine', :n_cap = 1 AND (SELECT hours_per_week FROM public.cp_user_capacity WHERE user_id = :'uu'::uuid) = 24);
-- L'écran enregistre par « upsert » (INSERT ... ON CONFLICT) : même règle que PostgREST
INSERT INTO public.cp_user_capacity (user_id, hours_per_week) VALUES (:'uu'::uuid, 16) ON CONFLICT (organization_id, user_id) DO UPDATE SET hours_per_week = EXCLUDED.hours_per_week;
SELECT zz.check('upsert de l''écran : met à jour la ligne existante (16 h), sans doublon', (SELECT hours_per_week FROM public.cp_user_capacity WHERE user_id = :'uu'::uuid) = 16 AND (SELECT count(*) FROM public.cp_user_capacity WHERE user_id = :'uu'::uuid) = 1);
SELECT zz.check('capacité négative refusée', zz.raises(format('UPDATE public.cp_user_capacity SET hours_per_week = -1 WHERE user_id = %L', :'uu')) IS NOT NULL);
SELECT zz.check('capacité de plus de 80 h refusée', zz.raises(format('UPDATE public.cp_user_capacity SET hours_per_week = 81 WHERE user_id = %L', :'uu')) IS NOT NULL);
SELECT zz.check('0 h accepté (personne absente)', zz.affected(format('UPDATE public.cp_user_capacity SET hours_per_week = 0 WHERE user_id = %L', :'uu')) = 1);
SELECT zz.check('personne inconnue refusée', zz.raises($$INSERT INTO public.cp_user_capacity (user_id, hours_per_week) VALUES (gen_random_uuid(), 40)$$) IS NOT NULL);
SELECT zz.check('journal d''audit : la capacité y figure', (SELECT count(*) FROM public.audit_log WHERE table_name = 'cp_user_capacity') >= 2);
RESET ROLE;

-- 4. Collaborateur : lit, n'écrit pas
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U lit la capacité', (SELECT count(*) FROM public.cp_user_capacity) = 1);
SELECT zz.check('U ne modifie pas la capacité', zz.affected($$UPDATE public.cp_user_capacity SET hours_per_week = 80$$) = 0);
SELECT zz.check('U ne saisit pas de capacité', zz.raises(format('INSERT INTO public.cp_user_capacity (user_id, hours_per_week) VALUES (%L, 40)', :'ua')) IS NOT NULL);
SELECT zz.check('U ne supprime rien', zz.affected($$DELETE FROM public.cp_user_capacity$$) = 0);
SELECT zz.check('U ne modifie pas une estimation', zz.affected($$UPDATE public.cp_items SET estimate_hours = 1 WHERE name = 'C-T1'$$) = 0);
RESET ROLE;

-- 5. Isolation : l'entreprise B
SELECT id AS ub FROM public.users WHERE email = 'b@iso.test' AND organization_id = :ORG2::uuid \gset
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B ne voit aucune capacité de A', (SELECT count(*) FROM public.cp_user_capacity) = 0);
SELECT zz.check('B ne saisit pas la capacité d''une personne de A', zz.raises(format('INSERT INTO public.cp_user_capacity (user_id, hours_per_week) VALUES (%L, 10)', :'uu')) IS NOT NULL);
SELECT zz.check('B ne pose pas de ligne dans l''entreprise de A', zz.raises(format('INSERT INTO public.cp_user_capacity (organization_id, user_id, hours_per_week) VALUES (%L, %L, 10)', :'org_a', :'uu')) IS NOT NULL);
INSERT INTO public.cp_user_capacity (user_id, hours_per_week) VALUES (:'ub'::uuid, 36);
SELECT zz.check('B saisit la capacité de sa propre personne', (SELECT count(*) FROM public.cp_user_capacity) = 1);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A ne voit pas la capacité de B', (SELECT count(*) FROM public.cp_user_capacity WHERE user_id = :'ub'::uuid) = 0);
RESET ROLE;

-- 6. anonyme et suppression d'une personne
GRANT USAGE ON SCHEMA zz TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO anon;
SET ROLE anon;
SELECT zz.check('anon ne lit pas la capacité', zz.raises($$SELECT count(*) FROM public.cp_user_capacity$$) IS NOT NULL);
RESET ROLE;
SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.users (organization_id, email, first_name, last_name, role) VALUES (:ORG1::uuid, 'temp-charge@iso.test', 'Temp', 'Charge', 'user') RETURNING id AS utemp \gset
INSERT INTO public.cp_user_capacity (organization_id, user_id, hours_per_week) VALUES (:ORG1::uuid, :'utemp'::uuid, 40);
DELETE FROM public.users WHERE id = :'utemp'::uuid;
SELECT zz.check('supprimer une personne supprime sa capacité', (SELECT count(*) FROM public.cp_user_capacity WHERE user_id = :'utemp'::uuid) = 0);
DELETE FROM public.cp_items; DELETE FROM public.cp_projects; DELETE FROM public.cp_user_capacity;
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
