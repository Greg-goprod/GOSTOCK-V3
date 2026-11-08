-- P7 : budget par projet (lignes prévu / engagé / réel) et taux horaires : contraintes, droit séparé cp.budget, isolation, restauration. À lancer APRÈS isolation.sql.
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

-- 0. Droits par défaut : administrateur et responsable (4 actions), ni magasinier ni collaborateur
SELECT public.seed_rbac_roles(:ORG1::uuid);
SELECT zz.check('administrateur : les 4 droits budget par défaut', (SELECT count(*) FROM public.rbac_role_permissions rp JOIN public.rbac_roles r ON r.id = rp.role_id WHERE r.organization_id = :ORG1::uuid AND r.system_key = 'admin' AND rp.permission_key LIKE 'cp.budget:%' AND rp.granted) = 4);
SELECT zz.check('responsable : les 4 droits budget par défaut', (SELECT count(*) FROM public.rbac_role_permissions rp JOIN public.rbac_roles r ON r.id = rp.role_id WHERE r.organization_id = :ORG1::uuid AND r.system_key = 'manager' AND rp.permission_key LIKE 'cp.budget:%' AND rp.granted) = 4);
SELECT zz.check('magasinier et collaborateur : aucun droit budget', (SELECT count(*) FROM public.rbac_role_permissions rp JOIN public.rbac_roles r ON r.id = rp.role_id WHERE r.organization_id = :ORG1::uuid AND r.system_key IN ('technician', 'user') AND rp.permission_key LIKE 'cp.budget:%') = 0);
SELECT zz.check('l''entreprise B reçoit aussi les droits par défaut', (SELECT count(*) FROM public.rbac_role_permissions rp JOIN public.rbac_roles r ON r.id = rp.role_id WHERE r.organization_id = :ORG2::uuid AND r.system_key = 'admin' AND rp.permission_key LIKE 'cp.budget:%') = 4);

-- 1. Administrateur A : lignes de budget
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_projects (name, type, starts_on, ends_on) VALUES ('Projet Budget', 'site', '2027-03-01', '2027-03-31'), ('Projet Budget 2', 'rd', '2027-04-01', '2027-04-30');
SELECT id AS p1 FROM public.cp_projects WHERE name = 'Projet Budget' \gset
SELECT id AS p2 FROM public.cp_projects WHERE name = 'Projet Budget 2' \gset
SELECT organization_id AS org_a FROM public.cp_projects WHERE id = :'p1'::uuid \gset
INSERT INTO public.cp_budget_lines (project_id, category, planned, committed, actual, note, position) VALUES (:'p1'::uuid, '  Matériel  ', 12000.50, 8000, 3500.25, 'Location scène', 1);
SELECT zz.check('A crée une ligne : l''entreprise est posée par la base', (SELECT organization_id = :'org_a'::uuid FROM public.cp_budget_lines WHERE note = 'Location scène'));
SELECT zz.check('la catégorie est nettoyée (espaces retirés)', (SELECT category = 'Matériel' FROM public.cp_budget_lines WHERE note = 'Location scène'));
SELECT zz.check('montants conservés au centime', (SELECT planned = 12000.50 AND committed = 8000 AND actual = 3500.25 FROM public.cp_budget_lines WHERE note = 'Location scène'));
INSERT INTO public.cp_budget_lines (project_id, category) VALUES (:'p1'::uuid, 'Prestataires');
SELECT zz.check('montants à 0 par défaut', (SELECT planned = 0 AND committed = 0 AND actual = 0 FROM public.cp_budget_lines WHERE category = 'Prestataires'));
SELECT zz.check('montant négatif refusé (prévu)', zz.raises(format('INSERT INTO public.cp_budget_lines (project_id, category, planned) VALUES (%L, ''X'', -1)', :'p1')) IS NOT NULL);
SELECT zz.check('montant négatif refusé (engagé)', zz.raises(format('INSERT INTO public.cp_budget_lines (project_id, category, committed) VALUES (%L, ''X'', -0.01)', :'p1')) IS NOT NULL);
SELECT zz.check('montant négatif refusé (réel)', zz.raises(format('INSERT INTO public.cp_budget_lines (project_id, category, actual) VALUES (%L, ''X'', -5)', :'p1')) IS NOT NULL);
SELECT zz.check('99 999 999,99 accepté (plafond)', zz.affected(format('INSERT INTO public.cp_budget_lines (project_id, category, planned) VALUES (%L, ''Plafond'', 99999999.99)', :'p1')) = 1);
SELECT zz.check('100 000 000 refusé (au-dessus du plafond)', zz.raises(format('INSERT INTO public.cp_budget_lines (project_id, category, planned) VALUES (%L, ''Trop'', 100000000)', :'p1')) IS NOT NULL);
SELECT zz.check('catégorie vide refusée', zz.raises(format('INSERT INTO public.cp_budget_lines (project_id, category) VALUES (%L, ''   '')', :'p1')) IS NOT NULL);
SELECT zz.check('catégorie de 80 caractères acceptée', zz.affected(format('INSERT INTO public.cp_budget_lines (project_id, category) VALUES (%L, %L)', :'p1', repeat('x', 80))) = 1);
SELECT zz.check('catégorie de 81 caractères refusée', zz.raises(format('INSERT INTO public.cp_budget_lines (project_id, category) VALUES (%L, %L)', :'p1', repeat('x', 81))) IS NOT NULL);
SELECT zz.check('note de 500 caractères acceptée', zz.affected(format('INSERT INTO public.cp_budget_lines (project_id, category, note) VALUES (%L, ''N500'', %L)', :'p1', repeat('n', 500))) = 1);
SELECT zz.check('note de 501 caractères refusée', zz.raises(format('INSERT INTO public.cp_budget_lines (project_id, category, note) VALUES (%L, ''N501'', %L)', :'p1', repeat('n', 501))) IS NOT NULL);
SELECT zz.check('projet inconnu refusé', zz.raises($$INSERT INTO public.cp_budget_lines (project_id, category) VALUES (gen_random_uuid(), 'X')$$) IS NOT NULL);
SELECT zz.affected(format('UPDATE public.cp_budget_lines SET actual = 4000 WHERE note = ''Location scène'' AND project_id = %L', :'p1')) AS n_upd \gset
SELECT zz.check('mise à jour du réel', :n_upd = 1 AND (SELECT actual FROM public.cp_budget_lines WHERE note = 'Location scène') = 4000);
SELECT zz.check('updated_at est tenu à jour par la base', (SELECT updated_at > created_at FROM public.cp_budget_lines WHERE note = 'Location scène'));
SELECT zz.check('une ligne ne change pas de projet', zz.raises(format('UPDATE public.cp_budget_lines SET project_id = %L WHERE note = ''Location scène''', :'p2')) IS NOT NULL);
SELECT zz.check('le journal d''audit ne reçoit AUCUN montant de budget', (SELECT count(*) FROM public.audit_log WHERE table_name IN ('cp_budget_lines', 'cp_user_rates')) = 0);

-- 2. Taux horaires
INSERT INTO public.cp_user_rates (user_id, hourly_rate) VALUES (:'uu'::uuid, 85.50);
SELECT zz.check('A saisit un taux horaire (85,50) : entreprise posée par la base', (SELECT organization_id = :'org_a'::uuid AND hourly_rate = 85.50 FROM public.cp_user_rates WHERE user_id = :'uu'::uuid));
SELECT zz.check('une personne a un seul taux', zz.raises(format('INSERT INTO public.cp_user_rates (user_id, hourly_rate) VALUES (%L, 10)', :'uu')) IS NOT NULL);
INSERT INTO public.cp_user_rates (user_id, hourly_rate) VALUES (:'uu'::uuid, 90) ON CONFLICT (organization_id, user_id) DO UPDATE SET hourly_rate = EXCLUDED.hourly_rate;
SELECT zz.check('upsert de l''écran : met à jour sans doublon', (SELECT hourly_rate = 90 FROM public.cp_user_rates WHERE user_id = :'uu'::uuid) AND (SELECT count(*) FROM public.cp_user_rates WHERE user_id = :'uu'::uuid) = 1);
SELECT zz.check('taux négatif refusé', zz.raises(format('UPDATE public.cp_user_rates SET hourly_rate = -1 WHERE user_id = %L', :'uu')) IS NOT NULL);
SELECT zz.check('9 999,99 accepté (plafond)', zz.affected(format('UPDATE public.cp_user_rates SET hourly_rate = 9999.99 WHERE user_id = %L', :'uu')) = 1);
SELECT zz.check('10 000 refusé', zz.raises(format('UPDATE public.cp_user_rates SET hourly_rate = 10000 WHERE user_id = %L', :'uu')) IS NOT NULL);
SELECT zz.check('0 accepté (bénévole)', zz.affected(format('UPDATE public.cp_user_rates SET hourly_rate = 0 WHERE user_id = %L', :'uu')) = 1);
SELECT zz.check('personne inconnue refusée', zz.raises($$INSERT INTO public.cp_user_rates (user_id, hourly_rate) VALUES (gen_random_uuid(), 50)$$) IS NOT NULL);
SELECT zz.check('personne d''une autre entreprise refusée', zz.raises(format('INSERT INTO public.cp_user_rates (user_id, hourly_rate) VALUES (%L, 50)', :'ub')) IS NOT NULL);
UPDATE public.cp_user_rates SET hourly_rate = 70 WHERE user_id = :'uu'::uuid;
RESET ROLE;

-- 3. Collaborateur (rôle « user ») : aucun droit budget, même s'il lit les projets
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT count(public.whoami());   -- première connexion de U : son compte est relié à sa fiche (sinon la base ne lui voit aucune entreprise)
SELECT zz.check('U lit les projets (droit cp.projects:read)', (SELECT count(*) FROM public.cp_projects WHERE name = 'Projet Budget') = 1);
SELECT zz.check('U ne lit AUCUNE ligne de budget', (SELECT count(*) FROM public.cp_budget_lines) = 0);
SELECT zz.check('U ne lit AUCUN taux horaire', (SELECT count(*) FROM public.cp_user_rates) = 0);
SELECT zz.check('U ne crée pas de ligne', zz.raises(format('INSERT INTO public.cp_budget_lines (project_id, category) VALUES (%L, ''Pirate'')', :'p1')) IS NOT NULL);
SELECT zz.check('U ne modifie pas une ligne', zz.affected($$UPDATE public.cp_budget_lines SET actual = 1$$) = 0);
SELECT zz.check('U ne supprime pas une ligne', zz.affected($$DELETE FROM public.cp_budget_lines$$) = 0);
SELECT zz.check('U ne saisit pas de taux', zz.raises(format('INSERT INTO public.cp_user_rates (user_id, hourly_rate) VALUES (%L, 1)', :'uu')) IS NOT NULL);
SELECT zz.check('U ne modifie pas un taux', zz.affected($$UPDATE public.cp_user_rates SET hourly_rate = 1$$) = 0);
RESET ROLE;

-- 4. Le même collaborateur devenu responsable : droits par défaut du rôle
SELECT set_config('request.jwt.claim.sub', '', false);
UPDATE public.users SET role = 'manager' WHERE email = 'u@iso.test';
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('responsable : lit les lignes de budget', (SELECT count(*) FROM public.cp_budget_lines) >= 5);
SELECT zz.check('responsable : lit les taux', (SELECT count(*) FROM public.cp_user_rates) = 1);
SELECT zz.check('responsable : crée une ligne', zz.raises(format('INSERT INTO public.cp_budget_lines (project_id, category, planned) VALUES (%L, ''Par le responsable'', 100)', :'p2')) IS NULL);
SELECT zz.check('responsable : modifie une ligne', zz.affected($$UPDATE public.cp_budget_lines SET planned = 150 WHERE category = 'Par le responsable'$$) = 1);
SELECT zz.check('responsable : supprime une ligne', zz.affected($$DELETE FROM public.cp_budget_lines WHERE category = 'Par le responsable'$$) = 1);
RESET ROLE;

-- 5. Magasinier : aucun droit budget
SELECT set_config('request.jwt.claim.sub', '', false);
UPDATE public.users SET role = 'technician' WHERE email = 'u@iso.test';
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('magasinier : ne lit aucune ligne de budget', (SELECT count(*) FROM public.cp_budget_lines) = 0);
RESET ROLE;

-- 6. Rôle personnalisé AVEC les droits de lecture des projets mais SANS cp.budget : le droit est bien séparé
SELECT set_config('request.jwt.claim.sub', '', false);
INSERT INTO public.rbac_roles (organization_id, name, is_system) VALUES (:ORG1::uuid, 'Chef de projet sans budget', false);
SELECT set_config('request.jwt.claim.sub', '', false);
INSERT INTO public.rbac_role_permissions (role_id, permission_key, organization_id) SELECT id, k, :ORG1::uuid FROM public.rbac_roles, unnest(ARRAY['cp.projects:read', 'cp.projects:create', 'cp.projects:update', 'cp.projects:delete']) k WHERE name = 'Chef de projet sans budget';
SELECT set_config('request.jwt.claim.sub', '', false);
UPDATE public.users SET rbac_role_id = (SELECT id FROM public.rbac_roles WHERE name = 'Chef de projet sans budget') WHERE email = 'u@iso.test';
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('droit séparé : peut modifier les projets', zz.affected($$UPDATE public.cp_projects SET description = 'ok' WHERE name = 'Projet Budget'$$) = 1);
SELECT zz.check('droit séparé : ne lit pourtant aucun budget', (SELECT count(*) FROM public.cp_budget_lines) = 0 AND (SELECT count(*) FROM public.cp_user_rates) = 0);
RESET ROLE;
-- Lecture seule accordée : lit, n'écrit pas
SELECT set_config('request.jwt.claim.sub', '', false);
INSERT INTO public.rbac_role_permissions (role_id, permission_key, organization_id) SELECT id, 'cp.budget:read', :ORG1::uuid FROM public.rbac_roles WHERE name = 'Chef de projet sans budget';
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('cp.budget:read seul : lit les lignes', (SELECT count(*) FROM public.cp_budget_lines) >= 5);
SELECT zz.check('cp.budget:read seul : n''écrit pas', zz.raises(format('INSERT INTO public.cp_budget_lines (project_id, category) VALUES (%L, ''Non'')', :'p1')) IS NOT NULL AND zz.affected($$UPDATE public.cp_budget_lines SET actual = 1$$) = 0 AND zz.affected($$DELETE FROM public.cp_budget_lines$$) = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
UPDATE public.users SET role = 'user', rbac_role_id = (SELECT id FROM public.rbac_roles WHERE system_key = 'user' AND organization_id = :ORG1::uuid) WHERE email = 'u@iso.test';
SELECT set_config('request.jwt.claim.sub', '', false);
DELETE FROM public.rbac_role_permissions WHERE role_id IN (SELECT id FROM public.rbac_roles WHERE name = 'Chef de projet sans budget');
SELECT set_config('request.jwt.claim.sub', '', false);
DELETE FROM public.rbac_roles WHERE name = 'Chef de projet sans budget';

-- 7. Module désactivé : même l'administrateur ne lit plus rien
SELECT set_config('request.jwt.claim.sub', '', false);
DELETE FROM public.organization_modules WHERE organization_id = :ORG1::uuid AND module_key = 'cp.projects';
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('module cp.projects désactivé : A ne lit aucune ligne de budget', (SELECT count(*) FROM public.cp_budget_lines) = 0);
SELECT zz.check('module désactivé : A ne crée pas de ligne', zz.raises(format('INSERT INTO public.cp_budget_lines (project_id, category) VALUES (%L, ''Non'')', :'p1')) IS NOT NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
INSERT INTO public.organization_modules (organization_id, module_key) VALUES (:ORG1::uuid, 'cp.projects') ON CONFLICT DO NOTHING;

-- 8. Isolation : l'entreprise B
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B ne voit aucune ligne de budget de A', (SELECT count(*) FROM public.cp_budget_lines) = 0);
SELECT zz.check('B ne voit aucun taux de A', (SELECT count(*) FROM public.cp_user_rates) = 0);
SELECT zz.check('B ne pose pas de ligne sur un projet de A', zz.raises(format('INSERT INTO public.cp_budget_lines (project_id, category) VALUES (%L, ''Intrus'')', :'p1')) IS NOT NULL);
SELECT zz.check('B ne pose pas de ligne dans l''entreprise de A', zz.raises(format('INSERT INTO public.cp_budget_lines (organization_id, project_id, category) VALUES (%L, %L, ''Intrus'')', :'org_a', :'p1')) IS NOT NULL);
SELECT zz.check('B ne fixe pas le taux d''une personne de A', zz.raises(format('INSERT INTO public.cp_user_rates (user_id, hourly_rate) VALUES (%L, 10)', :'uu')) IS NOT NULL);
SELECT zz.check('B ne modifie ni ne supprime rien chez A', zz.affected($$UPDATE public.cp_budget_lines SET actual = 0$$) = 0 AND zz.affected($$DELETE FROM public.cp_budget_lines$$) = 0);
INSERT INTO public.cp_projects (name, type) VALUES ('Projet B', 'rd');
INSERT INTO public.cp_budget_lines (project_id, category, planned) VALUES ((SELECT id FROM public.cp_projects WHERE name = 'Projet B'), 'Côté B', 500);
INSERT INTO public.cp_user_rates (user_id, hourly_rate) VALUES (:'ub'::uuid, 60);
SELECT zz.check('B gère son propre budget', (SELECT count(*) FROM public.cp_budget_lines) = 1 AND (SELECT count(*) FROM public.cp_user_rates) = 1);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A ne voit pas le budget de B', (SELECT count(*) FROM public.cp_budget_lines WHERE category = 'Côté B') = 0 AND (SELECT count(*) FROM public.cp_user_rates WHERE user_id = :'ub'::uuid) = 0);
RESET ROLE;

-- 9. Sauvegarde / restauration : les deux tables sont dans la liste fermée
SELECT zz.check('restore_missing_rows connaît cp_budget_lines et cp_user_rates', pg_get_functiondef('public.restore_missing_rows(text, jsonb)'::regprocedure) LIKE '%''cp_budget_lines'', ''cp_user_rates''%');
SELECT set_config('request.jwt.claim.sub', '', false);
CREATE TEMP TABLE keep AS SELECT * FROM public.cp_budget_lines WHERE organization_id = :ORG1::uuid;
SELECT set_config('request.jwt.claim.sub', '', false);
CREATE TEMP TABLE keep_rates AS SELECT * FROM public.cp_user_rates WHERE organization_id = :ORG1::uuid;
SELECT count(*) AS n_lines FROM keep \gset
SELECT jsonb_agg(to_jsonb(k)) AS rows_lines FROM keep k \gset
SELECT jsonb_agg(to_jsonb(k)) AS rows_rates FROM keep_rates k \gset
-- une ligne de B glissée dans la sauvegarde de A doit être ignorée
SELECT (:'rows_lines'::jsonb || jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'organization_id', :ORG2::uuid, 'project_id', (SELECT id FROM public.cp_projects WHERE name = 'Projet B'), 'category', 'Fuite', 'planned', 1, 'committed', 0, 'actual', 0, 'position', 0, 'created_at', now(), 'updated_at', now()))) AS rows_lines_x \gset
SELECT set_config('request.jwt.claim.sub', '', false);
SET session_replication_role = replica;
SELECT set_config('request.jwt.claim.sub', '', false);
DELETE FROM public.cp_budget_lines WHERE organization_id = :ORG1::uuid;
SELECT set_config('request.jwt.claim.sub', '', false);
DELETE FROM public.cp_user_rates WHERE organization_id = :ORG1::uuid;
SELECT set_config('request.jwt.claim.sub', '', false);
SET session_replication_role = origin;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT public.restore_missing_rows('cp_budget_lines', :'rows_lines_x'::jsonb) AS restored_lines \gset
SELECT public.restore_missing_rows('cp_user_rates', :'rows_rates'::jsonb) AS restored_rates \gset
SELECT zz.check('restauration : toutes les lignes de A remises, la ligne de B ignorée', :restored_lines = :n_lines AND (SELECT count(*) FROM public.cp_budget_lines) = :n_lines AND (SELECT count(*) FROM public.cp_budget_lines WHERE category = 'Fuite') = 0);
SELECT zz.check('restauration : le taux horaire est remis', :restored_rates = 1 AND (SELECT hourly_rate FROM public.cp_user_rates WHERE user_id = :'uu'::uuid) = 70);
SELECT public.restore_missing_rows('cp_budget_lines', :'rows_lines'::jsonb) AS replay_lines \gset
SELECT zz.check('rejouer la restauration n''ajoute rien et n''écrase rien', :replay_lines = 0 AND (SELECT count(*) FROM public.cp_budget_lines) = :n_lines);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('un collaborateur ne restaure pas', zz.raises(format('SELECT public.restore_missing_rows(''cp_budget_lines'', %L::jsonb)', :'rows_lines')) IS NOT NULL);
RESET ROLE;

-- 10. Suppression en cascade, anonyme
GRANT USAGE ON SCHEMA zz TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO anon;
SET ROLE anon;
SELECT zz.check('anon ne lit pas les lignes de budget', zz.raises($$SELECT count(*) FROM public.cp_budget_lines$$) IS NOT NULL);
SELECT zz.check('anon ne lit pas les taux', zz.raises($$SELECT count(*) FROM public.cp_user_rates$$) IS NOT NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('app.org_guard_off', 'on', false);
SELECT count(*) AS before_del FROM public.cp_budget_lines WHERE project_id = :'p1'::uuid \gset
DELETE FROM public.cp_projects WHERE id = :'p1'::uuid;
SELECT zz.check('supprimer un projet supprime ses lignes de budget', :before_del > 0 AND (SELECT count(*) FROM public.cp_budget_lines WHERE project_id = :'p1'::uuid) = 0);
INSERT INTO public.users (organization_id, email, first_name, last_name, role) VALUES (:ORG1::uuid, 'temp-budget@iso.test', 'Temp', 'Budget', 'user') RETURNING id AS utemp \gset
INSERT INTO public.cp_user_rates (organization_id, user_id, hourly_rate) VALUES (:ORG1::uuid, :'utemp'::uuid, 40);
DELETE FROM public.users WHERE id = :'utemp'::uuid;
SELECT zz.check('supprimer une personne supprime son taux', (SELECT count(*) FROM public.cp_user_rates WHERE user_id = :'utemp'::uuid) = 0);
DELETE FROM public.cp_budget_lines; DELETE FROM public.cp_user_rates; DELETE FROM public.cp_projects;
SELECT set_config('app.org_guard_off', '', false);
SELECT set_config('request.jwt.claim.sub', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
