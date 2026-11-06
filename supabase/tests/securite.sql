-- Correctifs de sécurité de la revue de la pull request (migration 63) : restauration, rôle de droits fins, fonctions d'échéances. À lancer APRÈS quota.sql et AVANT platform.sql (run.sh).
\set ON_ERROR_STOP on
\set A '''a0000000-0000-0000-0000-00000000000a'''
\set B '''b0000000-0000-0000-0000-00000000000b'''
\set U '''d0000000-0000-0000-0000-00000000000d'''
\set M '''52000000-0000-0000-0000-00000000000e'''
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

-- Une personne qui a le droit « gérer les personnes » sans être administrateur (M), dans l'entreprise 1
INSERT INTO auth.users (id, email) VALUES (:M, 'm@secu.test');
INSERT INTO public.users (email, first_name, last_name, role, permissions) VALUES ('m@secu.test', 'Max', 'Gestionnaire', 'user', ARRAY['manage_people']);
UPDATE public.users pu SET auth_user_id = (SELECT a.id FROM auth.users a WHERE a.email = pu.email) WHERE pu.email = 'm@secu.test';
SELECT id AS um FROM public.users WHERE email = 'm@secu.test' \gset
SELECT id AS uu FROM public.users WHERE email = 'u@iso.test' AND organization_id = :ORG1::uuid \gset
SELECT id AS role_admin FROM public.rbac_roles WHERE organization_id = :ORG1::uuid AND system_key = 'admin' \gset
SELECT id AS role_user FROM public.rbac_roles WHERE organization_id = :ORG1::uuid AND system_key = 'user' \gset
SELECT id AS role_tech FROM public.rbac_roles WHERE organization_id = :ORG1::uuid AND system_key = 'technician' \gset
SELECT count(*) AS n_owner_admins FROM public.owner_admins \gset
SELECT count(*) AS n_modules FROM public.organization_modules \gset

-- 1. Restauration : seules les tables de la sauvegarde ; jamais les tables de la plateforme ni la corbeille des fichiers
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('restauration : owner_admins (administrateurs de la plateforme) refusée à un administrateur d''entreprise', zz.raises(format($f$SELECT public.restore_missing_rows('owner_admins', jsonb_build_array(jsonb_build_object('user_id', %L)))$f$, :A)) LIKE '%Table inconnue%');
SELECT zz.check('restauration : organization_modules (modules payants), organizations, audit_log, corbeille des fichiers et journal de la plateforme refusés', zz.raises(format($f$SELECT public.restore_missing_rows('organization_modules', jsonb_build_array(jsonb_build_object('organization_id', %L, 'module_key', 'cp.projects', 'enabled', true)))$f$, :ORG2)) LIKE '%Table inconnue%'
  AND zz.raises($$SELECT public.restore_missing_rows('organizations', '[]'::jsonb)$$) LIKE '%Table inconnue%'
  AND zz.raises($$SELECT public.restore_missing_rows('audit_log', '[]'::jsonb)$$) LIKE '%Table inconnue%'
  AND zz.raises($$SELECT public.restore_missing_rows('cp_document_trash', '[]'::jsonb)$$) LIKE '%Table inconnue%'
  AND zz.raises($$SELECT public.restore_missing_rows('admin_audit_log', '[]'::jsonb)$$) LIKE '%Table inconnue%'
  AND zz.raises($$SELECT public.restore_missing_rows('platform_modules', '[]'::jsonb)$$) LIKE '%Table inconnue%');
RESET ROLE;
SELECT zz.check('restauration : aucune ligne n''a été ajoutée à owner_admins ni à organization_modules', (SELECT count(*) FROM public.owner_admins) = :n_owner_admins AND (SELECT count(*) FROM public.organization_modules) = :n_modules);

-- 2. Restauration : seulement des lignes de SON entreprise
SELECT to_jsonb(d) || jsonb_build_object('id', gen_random_uuid(), 'is_default', false, 'name', 'Dépôt restauré (entreprise 1)') AS ligne1 FROM public.depots d WHERE d.organization_id = :ORG1::uuid LIMIT 1 \gset
SELECT to_jsonb(d) || jsonb_build_object('id', gen_random_uuid(), 'is_default', false, 'name', 'Dépôt intrus (entreprise 2)', 'organization_id', :ORG2::text) AS ligne2 FROM public.depots d WHERE d.organization_id = :ORG1::uuid LIMIT 1 \gset
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT public.restore_missing_rows('depots', jsonb_build_array(:'ligne1'::jsonb)) AS r1 \gset
SELECT public.restore_missing_rows('depots', jsonb_build_array(:'ligne2'::jsonb)) AS r2 \gset
SELECT zz.check('restauration : une ligne de son entreprise est reprise', :r1 = 1);
SELECT zz.check('restauration : une ligne qui désigne une AUTRE entreprise est ignorée (0 ligne)', :r2 = 0);
RESET ROLE;
SELECT zz.check('restauration : rien n''a été écrit dans l''entreprise 2', (SELECT count(*) FROM public.depots WHERE name = 'Dépôt intrus (entreprise 2)') = 0 AND (SELECT count(*) FROM public.depots WHERE name = 'Dépôt restauré (entreprise 1)' AND organization_id = :ORG1::uuid) = 1);

-- 3. Restauration d'une fiche « users » : le lien avec un compte de connexion (ici celui d'une personne d'une autre entreprise) n'est pas repris
SELECT to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'email', 'restaure@secu.test', 'auth_user_id', :B::text, 'role', 'user') AS ligne_u FROM public.users x WHERE x.email = 'u@iso.test' AND x.organization_id = :ORG1::uuid \gset
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT public.restore_missing_rows('users', jsonb_build_array(:'ligne_u'::jsonb)) AS r3 \gset
RESET ROLE;
SELECT zz.check('restauration d''une fiche « users » : reprise, mais SANS lien avec le compte de connexion indiqué dans le fichier', :r3 = 1 AND (SELECT auth_user_id IS NULL FROM public.users WHERE email = 'restaure@secu.test'));

-- 4. Restauration : les autres garde-fous restent
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('restauration : un collaborateur (sans droit « réglages ») n''a toujours pas accès', zz.raises($$SELECT public.restore_missing_rows('depots', '[]'::jsonb)$$) LIKE '%Accès refusé%');
RESET ROLE;
SELECT zz.check('restauration : appelée sans personne connectée (propriétaire de la base), elle reste utilisable (maintenance)', (SELECT public.restore_missing_rows('depots', jsonb_build_array((SELECT to_jsonb(d) || jsonb_build_object('id', gen_random_uuid(), 'is_default', false, 'name', 'Dépôt maintenance') FROM public.depots d WHERE d.organization_id = :ORG1::uuid LIMIT 1)))) = 1);

-- 5. Rôle de droits fins : seul un administrateur le change directement
SELECT set_config('request.jwt.claim.sub', :M, false); SET ROLE authenticated;
SELECT zz.check('préalable : M (« gérer les personnes », pas administrateur) modifie bien une fiche', zz.affected(format('UPDATE public.users SET first_name = ''Modifié'' WHERE id = %L', :'uu')) = 1);
SELECT zz.check('M ne peut pas s''attribuer le rôle de droits Administrateur', zz.raises(format('UPDATE public.users SET rbac_role_id = %L WHERE id = %L', :'role_admin', :'um')) LIKE '%Seul un administrateur peut changer le rôle de droits%');
SELECT zz.check('M ne peut pas non plus le donner à une autre personne', zz.raises(format('UPDATE public.users SET rbac_role_id = %L WHERE id = %L', :'role_admin', :'uu')) LIKE '%Seul un administrateur peut changer le rôle de droits%');
SELECT zz.check('M modifie encore le reste d''une fiche en renvoyant le même rôle de droits (aucune régression)', zz.affected(format('UPDATE public.users SET last_name = ''Nom'', rbac_role_id = rbac_role_id WHERE id = %L', :'uu')) = 1);
RESET ROLE;
SELECT zz.check('le rôle de droits de M et de U n''a pas changé', (SELECT rbac_role_id FROM public.users WHERE id = :'um') = :'role_user'::uuid AND (SELECT rbac_role_id FROM public.users WHERE id = :'uu') = :'role_user'::uuid);
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('un administrateur change bien le rôle de droits d''une personne (réglage voulu)', zz.affected(format('UPDATE public.users SET rbac_role_id = %L WHERE id = %L', :'role_tech', :'uu')) = 1);
RESET ROLE;
SELECT id AS role_manager FROM public.rbac_roles WHERE organization_id = :ORG1::uuid AND system_key = 'manager' \gset
SELECT set_config('request.jwt.claim.sub', :M, false); SET ROLE authenticated;
SELECT zz.check('M change le « role » d''une personne (non administrateur) : le rôle de droits suit par le déclencheur de synchronisation', zz.affected(format('UPDATE public.users SET role = ''manager'' WHERE id = %L', :'uu')) = 1);
RESET ROLE;
SELECT zz.check('... et il vaut bien le rôle « manager » de l''entreprise', (SELECT rbac_role_id FROM public.users WHERE id = :'uu') = :'role_manager'::uuid);

-- 6. Fonctions d'échéances et de rappels : plus appelables par une personne connectée, toujours par la clé de service et le propriétaire
SELECT zz.check('check_* : aucun accès pour les utilisateurs connectés ni les anonymes', (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('check_vehicle_deadlines', 'check_maintenance_due', 'check_due_reminders', 'check_monthly_report', 'check_training_rental_deadlines', 'check_people_deadlines', 'check_equipment_deadlines', 'check_backup_reminder')
  AND (has_function_privilege('authenticated', p.oid, 'execute') OR has_function_privilege('anon', p.oid, 'execute'))) = 0);
SELECT zz.check('check_* : la clé de service les appelle toujours (les 8 fonctions)', (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('check_vehicle_deadlines', 'check_maintenance_due', 'check_due_reminders', 'check_monthly_report', 'check_training_rental_deadlines', 'check_people_deadlines', 'check_equipment_deadlines', 'check_backup_reminder')
  AND has_function_privilege('service_role', p.oid, 'execute')) = 8);
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('check_* : un collaborateur qui les appelle est refusé', zz.raises('SELECT public.check_due_reminders()') LIKE '%permission denied%' AND zz.raises('SELECT public.check_monthly_report()') LIKE '%permission denied%');
RESET ROLE;
SELECT zz.check('check_* : le propriétaire (tâche planifiée) les appelle toujours', zz.raises('SELECT public.check_due_reminders(), public.check_monthly_report(), public.check_backup_reminder()') IS NULL);
SELECT zz.check('check_cp_deadlines et les fonctions de réservation ne sont pas touchées', NOT has_function_privilege('authenticated', 'public.check_cp_deadlines()'::regprocedure, 'execute') AND has_function_privilege('authenticated', 'public.check_request_availability(uuid)'::regprocedure, 'execute'));

-- 7. Secret de la tâche planifiée (migration 64) : généré par la base, vérifié par la base, invisible des utilisateurs
SELECT secret AS le_secret FROM public.cron_secret \gset
SELECT zz.check('secret du cron : généré par la base (64 caractères, une seule ligne)', length(:'le_secret') = 64 AND (SELECT count(*) FROM public.cron_secret) = 1);
SELECT zz.check('verify_cron_secret : vrai pour le bon secret, faux pour un autre, un secret court, vide ou absent', public.verify_cron_secret(:'le_secret') AND NOT public.verify_cron_secret(repeat('a', 64)) AND NOT public.verify_cron_secret('court') AND NOT public.verify_cron_secret('') AND NOT public.verify_cron_secret(NULL));
SELECT zz.check('verify_cron_secret : réservée à la clé de service (ni utilisateurs connectés, ni anonymes)', has_function_privilege('service_role', 'public.verify_cron_secret(text)', 'execute') AND NOT has_function_privilege('authenticated', 'public.verify_cron_secret(text)', 'execute') AND NOT has_function_privilege('anon', 'public.verify_cron_secret(text)', 'execute'));
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('le secret est illisible pour un administrateur d''entreprise (table et fonction)', zz.raises('SELECT secret FROM public.cron_secret') LIKE '%permission denied%' AND zz.raises($$SELECT public.verify_cron_secret('x')$$) LIKE '%permission denied%');
RESET ROLE;
SELECT zz.check('migration rejouable : relancer la création ne change pas le secret', (SELECT count(*) FROM public.cron_secret WHERE secret = :'le_secret') = 1);

-- Ménage
SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.depots WHERE name IN ('Dépôt restauré (entreprise 1)', 'Dépôt maintenance');
DELETE FROM public.users WHERE email IN ('restaure@secu.test', 'm@secu.test');
SELECT set_config('app.org_guard_off', '', false);
UPDATE public.users SET first_name = 'U', last_name = 'Iso', role = 'user' WHERE id = :'uu';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
