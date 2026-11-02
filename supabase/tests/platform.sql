-- Console de la plateforme (C1) : niveaux, journal, plan/note, modules, usage, équipe. À lancer APRÈS isolation.sql.
\set ON_ERROR_STOP on
\set A '''a0000000-0000-0000-0000-00000000000a'''
\set B '''b0000000-0000-0000-0000-00000000000b'''
\set U '''d0000000-0000-0000-0000-00000000000d'''
\set P '''f0000000-0000-0000-0000-00000000000f'''
\set S '''e0000000-0000-0000-0000-00000000000e'''
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

-- Une personne du support : compte + fiche dans l'entreprise 1 (pas encore dans l'équipe)
INSERT INTO auth.users (id, email) VALUES (:S, 's@iso.test') ON CONFLICT DO NOTHING;
INSERT INTO public.users (email, first_name, last_name, role) VALUES ('s@iso.test', 'Sam', 'Support', 'user');
UPDATE auth.users SET last_sign_in_at = now() - interval '2 days' WHERE id = :A;

-- Propriétaire ---------------------------------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', :P, false); SET ROLE authenticated;
SELECT zz.check('P : connexion et niveau propriétaire', public.whoami() IS NOT NULL AND public.platform_level() = 'owner' AND public.is_platform_owner() AND (public.whoami() ->> 'platform_level') = 'owner');
SELECT coalesce(zz.raises($$SELECT public.platform_add_team_member('S@ISO.test', 'support')$$), 'ok') AS r \gset
SELECT zz.check('P ajoute Sam au support', :'r' = 'ok' AND (SELECT count(*) FROM public.platform_team() WHERE level = 'support') = 1, :'r');
SELECT zz.check('adresse inconnue : refusée avec un message clair', zz.raises($$SELECT public.platform_add_team_member('inconnu@iso.test', 'support')$$) LIKE '%d''abord se connecter%');
SELECT zz.check('déjà dans l''équipe : refusé', zz.raises($$SELECT public.platform_add_team_member('s@iso.test', 'support')$$) LIKE '%déjà%');
SELECT zz.check('niveau inconnu : refusé', zz.raises($$SELECT public.platform_add_team_member('a@iso.test', 'chef')$$) LIKE '%Niveau inconnu%');
SELECT zz.check('liste des entreprises : identifiant, plan, personnes, modules', (SELECT count(*) FROM public.platform_organizations()) >= 2
  AND (SELECT bool_and(slug ~ '^[a-z0-9-]+$' AND plan IN ('essai', 'standard', 'premium')) FROM public.platform_organizations())
  AND (SELECT 'chantiers_planning' = ANY (modules) FROM public.platform_organizations() WHERE id = :ORG1::uuid));
SELECT zz.check('usage : une ligne par entreprise, chiffres cohérents', (SELECT count(*) FROM public.platform_organization_usage()) = (SELECT count(*) FROM public.organizations)
  AND (SELECT people_active FROM public.platform_organization_usage() WHERE organization_id = :ORG1::uuid) = (SELECT count(*) FROM public.users WHERE organization_id = :ORG1::uuid AND active)
  AND (SELECT last_sign_in IS NOT NULL FROM public.platform_organization_usage() WHERE organization_id = :ORG1::uuid));
SELECT coalesce(zz.raises($$SELECT public.platform_create_organization('Société Été & Co', 'dir@ete.test', 'Dora', 'Direction')$$), 'ok') AS r \gset
SELECT zz.check('création d''une entreprise : identifiant lisible sans accent, journalisée', :'r' = 'ok'
  AND (SELECT slug FROM public.platform_organizations() WHERE name = 'Société Été & Co') = 'societe-ete-co'
  AND (SELECT count(*) FROM public.platform_audit(50) WHERE action = 'create_organization') >= 1, :'r');
SELECT zz.check('une nouvelle entreprise part sans module', (SELECT cardinality(modules) FROM public.platform_organizations() WHERE name = 'Société Été & Co') = 0);
SELECT zz.check('nom déjà pris : refusé', zz.raises($$SELECT public.platform_create_organization('société été & co', 'x@ete.test', 'X', 'Y')$$) LIKE '%déjà ce nom%');
SELECT id AS org3 FROM public.platform_organizations() WHERE name = 'Société Été & Co' \gset
SELECT coalesce(zz.raises(format('SELECT public.platform_update_organization(%L, ''premium'', ''Client pilote'')', :'org3')), 'ok') AS r \gset
SELECT zz.check('P change le plan, c''est journalisé avec avant et après', :'r' = 'ok'
  AND (SELECT plan FROM public.platform_organizations() WHERE id = :'org3'::uuid) = 'premium'
  AND (SELECT details ->> 'plan_before' FROM public.platform_audit(50) WHERE action = 'change_plan' ORDER BY id DESC LIMIT 1) = 'standard');
SELECT zz.check('plan inconnu : refusé', zz.raises(format('SELECT public.platform_update_organization(%L, ''gratuit'', '''')', :'org3')) LIKE '%Plan inconnu%');
SELECT coalesce(zz.raises(format('SELECT public.platform_set_module(%L, ''chantiers_planning'', true)', :'org3')), 'ok') AS r \gset
SELECT zz.check('P active un module, journalisé', :'r' = 'ok'
  AND (SELECT 'chantiers_planning' = ANY (modules) FROM public.platform_organizations() WHERE id = :'org3'::uuid)
  AND (SELECT count(*) FROM public.platform_audit(50) WHERE action = 'enable_module') = 1);
SELECT zz.check('module inconnu : refusé', zz.raises(format('SELECT public.platform_set_module(%L, ''nimportequoi'', true)', :'org3')) LIKE '%Module inconnu%');
SELECT coalesce(zz.raises(format('SELECT public.platform_set_organization_active(%L, false)', :'org3')), 'ok') AS r \gset
SELECT zz.check('P suspend une entreprise, journalisé', :'r' = 'ok' AND NOT (SELECT active FROM public.platform_organizations() WHERE id = :'org3'::uuid), :'r');
SELECT coalesce(zz.raises(format('SELECT public.platform_set_organization_active(%L, true)', :'org3')), 'ok') AS r \gset
SELECT zz.check('P réactive l''entreprise, journalisé', :'r' = 'ok' AND (SELECT active FROM public.platform_organizations() WHERE id = :'org3'::uuid)
  AND (SELECT count(*) FROM public.platform_audit(50) WHERE action IN ('suspend_organization', 'reactivate_organization')) = 2, :'r');
SELECT zz.check('le dernier propriétaire ne se retire ni ne se rétrograde', zz.raises(format('SELECT public.platform_remove_team_member(%L)', :P)) LIKE '%au moins un propriétaire%'
  AND zz.raises(format('SELECT public.platform_set_team_level(%L, ''support'')', :P)) LIKE '%au moins un propriétaire%');
RESET ROLE;

-- Support ----------------------------------------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', :S, false); SET ROLE authenticated;
SELECT zz.check('S : connexion, niveau support', public.whoami() IS NOT NULL AND public.platform_level() = 'support' AND NOT public.is_platform_owner() AND (public.whoami() ->> 'platform_level') = 'support');
SELECT zz.check('S voit entreprises, usage, journal et équipe', (SELECT count(*) FROM public.platform_organizations()) >= 3 AND (SELECT count(*) FROM public.platform_organization_usage()) >= 3
  AND (SELECT count(*) FROM public.platform_audit(10)) > 0 AND (SELECT count(*) FROM public.platform_team()) = 2);
SELECT coalesce(zz.raises($$SELECT public.platform_create_organization('Cliente du support', 'adm@support.test', 'Adèle', 'Admin')$$), 'ok') AS r \gset
SELECT zz.check('S crée une entreprise (journalisée sous son nom)', :'r' = 'ok'
  AND (SELECT actor_email FROM public.platform_audit(5) WHERE action = 'create_organization' ORDER BY id DESC LIMIT 1) = 's@iso.test');
SELECT coalesce(zz.raises(format('SELECT public.platform_update_organization(%L, ''premium'', ''Note du support'')', :'org3')), 'ok') AS r \gset
SELECT zz.check('S modifie la note interne, pas le plan', :'r' = 'ok'
  AND (SELECT note FROM public.platform_organizations() WHERE id = :'org3'::uuid) = 'Note du support'
  AND (SELECT plan FROM public.platform_organizations() WHERE id = :'org3'::uuid) = 'premium');
SELECT zz.check('S ne change pas le plan', zz.raises(format('SELECT public.platform_update_organization(%L, ''essai'', ''Note du support'')', :'org3')) LIKE '%propriétaire%'
  AND (SELECT plan FROM public.platform_organizations() WHERE id = :'org3'::uuid) = 'premium');
SELECT zz.check('S ne suspend pas, n''active pas de module', zz.raises(format('SELECT public.platform_set_organization_active(%L, false)', :'org3')) LIKE '%propriétaire%'
  AND zz.raises(format('SELECT public.platform_set_module(%L, ''repas'', true)', :'org3')) LIKE '%propriétaire%');
SELECT zz.check('S ne gère pas l''équipe', zz.raises($$SELECT public.platform_add_team_member('a@iso.test', 'support')$$) LIKE '%propriétaire%'
  AND zz.raises(format('SELECT public.platform_set_team_level(%L, ''owner'')', :S)) LIKE '%propriétaire%'
  AND zz.raises(format('SELECT public.platform_remove_team_member(%L)', :P)) LIKE '%propriétaire%');
RESET ROLE;

-- Un administrateur d'entreprise cliente n'est PAS de la plateforme ------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A (administrateur d''une entreprise) : aucun niveau de plateforme', public.whoami() IS NOT NULL AND public.platform_level() IS NULL AND NOT public.is_platform_admin() AND (public.whoami() ->> 'platform_level') IS NULL);
SELECT zz.check('A : toutes les fonctions de la console refusées', zz.raises($$SELECT * FROM public.platform_organizations()$$) LIKE '%équipe de la plateforme%'
  AND zz.raises($$SELECT * FROM public.platform_organization_usage()$$) LIKE '%équipe de la plateforme%'
  AND zz.raises($$SELECT * FROM public.platform_audit(10)$$) LIKE '%équipe de la plateforme%'
  AND zz.raises($$SELECT * FROM public.platform_team()$$) LIKE '%équipe de la plateforme%'
  AND zz.raises($$SELECT public.platform_create_organization('Pirate', 'p@p.test', 'P', 'P')$$) LIKE '%équipe de la plateforme%'
  AND zz.raises(format('SELECT public.platform_update_organization(%L, ''premium'', ''x'')', :ORG1)) LIKE '%équipe de la plateforme%'
  AND zz.raises(format('SELECT public.platform_set_module(%L, ''repas'', true)', :ORG1)) LIKE '%équipe de la plateforme%'
  AND zz.raises(format('SELECT public.platform_set_organization_active(%L, false)', :ORG2)) LIKE '%équipe de la plateforme%'
  AND zz.raises($$SELECT public.platform_add_team_member('a@iso.test', 'owner')$$) LIKE '%équipe de la plateforme%');
SELECT zz.check('A ne lit ni le journal, ni les notes, ni l''équipe directement', zz.raises($$SELECT * FROM public.platform_audit_log$$) LIKE '%permission denied%'
  AND zz.raises($$SELECT * FROM public.platform_organization_notes$$) LIKE '%permission denied%' AND zz.raises($$SELECT * FROM public.platform_admins$$) IS NOT NULL);
SELECT zz.check('A ne peut pas se donner un niveau ni modifier le plan de son entreprise', zz.raises($$INSERT INTO public.platform_admins (auth_user_id) VALUES ('a0000000-0000-0000-0000-00000000000a')$$) IS NOT NULL
  AND zz.affected($$UPDATE public.organizations SET plan = 'premium', slug = 'pirate'$$) = 1 AND (SELECT plan FROM public.organizations WHERE id = :ORG1::uuid) <> 'premium' AND (SELECT slug FROM public.organizations WHERE id = :ORG1::uuid) <> 'pirate');
SELECT zz.check('A ne s''active aucun module', zz.raises($$INSERT INTO public.organization_modules (module_key) VALUES ('repas')$$) IS NOT NULL
  AND zz.affected($$UPDATE public.organization_modules SET enabled = true$$) = 0);
SELECT zz.check('A voit ses modules seulement (my_modules)', public.my_modules() = ARRAY['chantiers_planning'] AND (SELECT count(*) FROM public.organization_modules) = 1);
RESET ROLE;

-- Journal en ajout seul ----------------------------------------------------------------------------------------------------
SELECT zz.check('journal : modification refusée (même pour la base)', zz.raises($$UPDATE public.platform_audit_log SET action = 'x'$$) LIKE '%ajout seul%');
SELECT zz.check('journal : suppression refusée (même pour la base)', zz.raises($$DELETE FROM public.platform_audit_log$$) LIKE '%ajout seul%');
SELECT zz.check('journal : chaque action de la console y est (création, plan, module, suspension, équipe)', (SELECT count(DISTINCT action) FROM public.platform_audit_log WHERE action IN ('create_organization', 'change_plan', 'enable_module', 'suspend_organization', 'reactivate_organization', 'add_team_member', 'update_note')) = 7);

-- Modules : le planning exige d'être activé ---------------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B (module planning activé par les tests de planning) : lit son planning', zz.raises($$SELECT count(*) FROM public.site_zones$$) IS NULL);
RESET ROLE;
DELETE FROM public.organization_modules WHERE organization_id = :ORG2::uuid AND module_key = 'chantiers_planning';
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('module retiré : B ne voit plus son planning et n''y écrit plus', (SELECT count(*) FROM public.site_zones) = 0 AND (SELECT count(*) FROM public.contractors) = 0
  AND zz.raises($$INSERT INTO public.contractors (name) VALUES ('Refusé SA')$$) IS NOT NULL AND public.my_modules() = ARRAY[]::text[]);
RESET ROLE;

-- Suppression du dernier propriétaire impossible même en retirant Sam d'abord -----------------------------------------------
SELECT set_config('request.jwt.claim.sub', :P, false); SET ROLE authenticated;
SELECT coalesce(zz.raises(format('SELECT public.platform_set_team_level(%L, ''owner'')', :S)), 'ok') AS r1 \gset
SELECT coalesce(zz.raises(format('SELECT public.platform_set_team_level(%L, ''support'')', :P)), 'ok') AS r2 \gset
SELECT zz.check('P promeut Sam propriétaire, puis peut se rétrograder (il reste un propriétaire)', :'r1' = 'ok' AND :'r2' = 'ok', :'r1' || ' / ' || :'r2');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :S, false); SET ROLE authenticated;
SELECT coalesce(zz.raises(format('SELECT public.platform_remove_team_member(%L)', :P)), 'ok') AS r \gset
SELECT zz.check('Sam, devenu propriétaire, retire P de l''équipe', :'r' = 'ok' AND (SELECT count(*) FROM public.platform_team()) = 1, :'r');
RESET ROLE;

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
