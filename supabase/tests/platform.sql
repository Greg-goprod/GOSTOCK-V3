-- Console de la plateforme (C1 allégée) : owner_admins, journal, modules, usage. À lancer APRÈS isolation.sql et planning.sql.
\set ON_ERROR_STOP on
\set A '''a0000000-0000-0000-0000-00000000000a'''
\set B '''b0000000-0000-0000-0000-00000000000b'''
\set U '''d0000000-0000-0000-0000-00000000000d'''
\set P '''f0000000-0000-0000-0000-00000000000f'''
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


-- L'administrateur de plateforme du jeu d'essai (P) est dans owner_admins ; A est administrateur d'une entreprise, pas de la plateforme
UPDATE auth.users SET last_sign_in_at = now() - interval '2 days' WHERE id = :A;
SELECT zz.check('owner_admins : la table renommée garde son contenu (user_id)', (SELECT count(*) FROM public.owner_admins WHERE user_id = :P::uuid) = 1 AND to_regclass('public.platform_admins') IS NULL);

SELECT count(*) AS nb_orgs FROM public.organizations \gset
SELECT count(*) AS n_org1 FROM public.users WHERE organization_id = :ORG1::uuid AND active \gset
SELECT set_config('request.jwt.claim.sub', :P, false); SET ROLE authenticated;
SELECT zz.check('P : connexion, is_owner_admin et is_platform_admin concordent', public.whoami() IS NOT NULL AND public.is_owner_admin() AND public.is_platform_admin() AND (public.whoami() ->> 'platform_admin') = 'true');
SELECT zz.check('liste des entreprises avec leurs modules', (SELECT count(*) FROM public.platform_organizations()) >= 2
  AND (SELECT 'cp.planning' = ANY (modules) FROM public.platform_organizations() WHERE id = :ORG1::uuid));
SELECT zz.check('usage : une ligne par entreprise, chiffres cohérents', (SELECT count(*) FROM public.platform_organization_usage()) = :nb_orgs
  AND (SELECT people_active FROM public.platform_organization_usage() WHERE organization_id = :ORG1::uuid) = :n_org1
  AND (SELECT last_sign_in IS NOT NULL FROM public.platform_organization_usage() WHERE organization_id = :ORG1::uuid));
SELECT coalesce(zz.raises($$SELECT public.platform_create_organization('Société Été & Co', 'dir@ete.test', 'Dora', 'Direction')$$), 'ok') AS r \gset
SELECT zz.check('création d''une entreprise, journalisée sous le nom de P', :'r' = 'ok'
  AND (SELECT count(*) FROM public.platform_organizations() WHERE name = 'Société Été & Co') = 1
  AND (SELECT actor_email FROM public.platform_audit(5) WHERE action = 'create_company' ORDER BY at DESC LIMIT 1) = 'p@iso.test', :'r');
SELECT zz.check('nom déjà pris : refusé', zz.raises($$SELECT public.platform_create_organization('société été & co', 'x@ete.test', 'X', 'Y')$$) LIKE '%déjà ce nom%');
SELECT zz.check('adresse invalide : refusée', zz.raises($$SELECT public.platform_create_organization('Autre', 'pasunmail', 'X', 'Y')$$) LIKE '%invalide%');
SELECT zz.check('une nouvelle entreprise part sans module', (SELECT cardinality(modules) FROM public.platform_organizations() WHERE name = 'Société Été & Co') = 0);
SELECT id AS org3 FROM public.platform_organizations() WHERE name = 'Société Été & Co' \gset
SELECT coalesce(zz.raises(format('SELECT public.platform_set_module(%L, ''cp.planning'', true)', :'org3')), 'ok') AS r \gset
SELECT zz.check('P active un module, journalisé', :'r' = 'ok'
  AND (SELECT 'cp.planning' = ANY (modules) FROM public.platform_organizations() WHERE id = :'org3'::uuid)
  AND (SELECT count(*) FROM public.platform_audit(50) WHERE action = 'enable_module' AND metadata ->> 'module' = 'cp.planning') = 1, :'r');
SELECT zz.check('module inconnu : refusé', zz.raises(format('SELECT public.platform_set_module(%L, ''nimportequoi'', true)', :'org3')) LIKE '%Module inconnu%');
SELECT coalesce(zz.raises(format('SELECT public.platform_set_module(%L, ''cp.planning'', false)', :'org3')), 'ok') AS r \gset
SELECT zz.check('P retire le module, journalisé', :'r' = 'ok' AND (SELECT cardinality(modules) FROM public.platform_organizations() WHERE id = :'org3'::uuid) = 0
  AND (SELECT count(*) FROM public.platform_audit(50) WHERE action = 'disable_module') = 1, :'r');
SELECT coalesce(zz.raises(format('SELECT public.platform_set_organization_active(%L, false)', :'org3')), 'ok') AS r \gset
SELECT zz.check('P suspend une entreprise, journalisé', :'r' = 'ok' AND NOT (SELECT active FROM public.platform_organizations() WHERE id = :'org3'::uuid), :'r');
SELECT coalesce(zz.raises(format('SELECT public.platform_set_organization_active(%L, true)', :'org3')), 'ok') AS r \gset
SELECT zz.check('P réactive l''entreprise', :'r' = 'ok' AND (SELECT active FROM public.platform_organizations() WHERE id = :'org3'::uuid), :'r');
SELECT zz.check('suspension et réactivation sont au journal', (SELECT count(*) FROM public.platform_audit(50) WHERE action IN ('suspend_company', 'reactivate_company') AND target_name = 'Société Été & Co') = 2);
SELECT zz.check('entreprise inconnue : refusée', zz.raises($$SELECT public.platform_set_organization_active('99999999-9999-9999-9999-999999999999', false)$$) LIKE '%introuvable%');
RESET ROLE;

-- Un administrateur d'entreprise cliente n'est PAS de la plateforme ------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A (administrateur d''une entreprise) : pas administrateur de plateforme', public.whoami() IS NOT NULL AND NOT public.is_owner_admin() AND NOT public.is_platform_admin() AND (public.whoami() ->> 'platform_admin') = 'false');
SELECT zz.check('A : toutes les fonctions de la console refusées', zz.raises($$SELECT * FROM public.platform_organizations()$$) LIKE '%plateforme%'
  AND zz.raises($$SELECT * FROM public.platform_organization_usage()$$) LIKE '%plateforme%'
  AND zz.raises($$SELECT * FROM public.platform_audit(10)$$) LIKE '%plateforme%'
  AND zz.raises($$SELECT public.platform_create_organization('Pirate', 'p@p.test', 'P', 'P')$$) LIKE '%plateforme%'
  AND zz.raises(format('SELECT public.platform_set_module(%L, ''repas'', true)', :ORG1)) LIKE '%plateforme%'
  AND zz.raises(format('SELECT public.platform_set_organization_active(%L, false)', :ORG2)) LIKE '%plateforme%');
SELECT zz.check('A ne lit ni le journal ni owner_admins, et ne s''y inscrit pas', zz.raises($$SELECT * FROM public.admin_audit_log$$) LIKE '%permission denied%'
  AND zz.raises($$SELECT * FROM public.owner_admins$$) IS NOT NULL
  AND zz.raises($$INSERT INTO public.owner_admins (user_id) VALUES ('a0000000-0000-0000-0000-00000000000a')$$) IS NOT NULL);
SELECT zz.check('A ne s''active aucun module', zz.raises($$INSERT INTO public.organization_modules (module_key) VALUES ('repas')$$) IS NOT NULL
  AND zz.affected($$UPDATE public.organization_modules SET enabled = true$$) = 0 AND zz.affected($$DELETE FROM public.organization_modules$$) = 0);
SELECT zz.check('A voit ses modules seulement (my_modules)', public.my_modules() = ARRAY['cp.planning'] AND (SELECT count(*) FROM public.organization_modules) = 1);
RESET ROLE;

-- Journal en ajout seul ----------------------------------------------------------------------------------------------------
SELECT zz.check('journal : modification refusée (même pour la base)', zz.raises($$UPDATE public.admin_audit_log SET action = 'x'$$) LIKE '%ajout seul%');
SELECT zz.check('journal : suppression refusée (même pour la base)', zz.raises($$DELETE FROM public.admin_audit_log$$) LIKE '%ajout seul%');
SELECT zz.check('journal : chaque action de la console y est', (SELECT count(DISTINCT action) FROM public.admin_audit_log WHERE action IN ('create_company', 'enable_module', 'disable_module', 'suspend_company', 'reactivate_company')) = 5);

-- Modules : le planning exige d'être activé ---------------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B (module planning activé pour les tests de planning) : lit son planning', zz.raises($$SELECT count(*) FROM public.cp_site_zones$$) IS NULL AND (SELECT count(*) FROM public.cp_site_interventions) >= 1);
RESET ROLE;
DELETE FROM public.organization_modules WHERE organization_id = :ORG2::uuid AND module_key = 'cp.planning';
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('module retiré : B ne voit plus son planning et n''y écrit plus', (SELECT count(*) FROM public.cp_site_interventions) = 0 AND (SELECT count(*) FROM public.cp_site_zones) = 0 AND (SELECT count(*) FROM public.cp_contractors) = 0
  AND zz.raises($$INSERT INTO public.cp_contractors (name) VALUES ('Refusé SA')$$) IS NOT NULL AND public.my_modules() = ARRAY[]::text[]);
RESET ROLE;

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
