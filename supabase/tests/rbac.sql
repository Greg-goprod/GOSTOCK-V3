-- Droits compatibles Mannyx (étape 1) : mêmes réponses qu'avant, rôles par entreprise, rbac_has_any_permission.
-- À lancer sur la base locale APRÈS isolation.sql (réutilise ses entreprises et ses comptes).
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
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO authenticated;

-- Rôles : 4 par entreprise, droits = droits actuels
SELECT zz.check('4 rôles système dans chaque entreprise', (SELECT count(*) FROM public.rbac_roles WHERE is_system GROUP BY organization_id ORDER BY 1 LIMIT 1) = 4
  AND (SELECT count(DISTINCT organization_id) FROM public.rbac_roles) = (SELECT count(*) FROM public.organizations));
SELECT zz.check('droits des rôles = droits actuels (administrateur, responsable, magasinier, collaborateur)', NOT EXISTS (
  SELECT 1 FROM public.rbac_roles r
  WHERE r.is_system AND (
    SELECT COALESCE(array_agg(m.legacy ORDER BY m.legacy), '{}') FROM public.rbac_role_permissions rp JOIN public.rbac_legacy_permission_map m ON m.permission_key = rp.permission_key WHERE rp.role_id = r.id
  ) IS DISTINCT FROM (SELECT COALESCE(array_agg(x ORDER BY x), '{}') FROM unnest(public.role_permissions(r.system_key)) x)));
SELECT zz.check('chaque personne a son rôle système', NOT EXISTS (SELECT 1 FROM public.users u LEFT JOIN public.rbac_roles r ON r.id = u.rbac_role_id WHERE r.id IS NULL OR r.system_key IS DISTINCT FROM u.role OR r.organization_id <> u.organization_id));
UPDATE public.users SET role = 'technician' WHERE email = 'u@iso.test';
SELECT zz.check('le rôle suit le changement de rôle', (SELECT r.system_key FROM public.users u JOIN public.rbac_roles r ON r.id = u.rbac_role_id WHERE u.email = 'u@iso.test') = 'technician');
UPDATE public.users SET role = 'user' WHERE email = 'u@iso.test';
SELECT zz.check('une nouvelle entreprise reçoit ses rôles', (SELECT count(*) FROM public.rbac_roles WHERE organization_id = :ORG2::uuid AND is_system) = 4);

-- Vérification des droits
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('administrateur : droit réglages (clé Mannyx) et comptoir', public.rbac_has_any_permission(ARRAY['reglages.parametres:update']) AND public.rbac_has_any_permission(ARRAY['magasin.comptoir:update']));
SELECT zz.check('une clé inconnue est refusée', NOT public.rbac_has_any_permission(ARRAY['chantiers.planning:update']) AND NOT public.rbac_has_any_permission(ARRAY[]::text[]));
SELECT zz.check('app_has répond comme avant', public.app_has('settings') AND public.app_has('scan') AND NOT public.app_has('inconnu'));
SELECT zz.check('A voit les rôles de son entreprise seulement', zz.count('SELECT 1 FROM public.rbac_roles') = 4 AND zz.count(format('SELECT 1 FROM public.rbac_roles WHERE organization_id = %L', :ORG2)) = 0);
SELECT zz.check('rôle système : ni modifiable ni supprimable', zz.raises($$UPDATE public.rbac_roles SET name = 'Autre' WHERE system_key = 'user'$$) IS NULL AND (SELECT name FROM public.rbac_roles WHERE system_key = 'user') = 'Collaborateur'
  AND zz.raises($$DELETE FROM public.rbac_roles WHERE system_key = 'admin'$$) IS NULL AND (SELECT count(*) FROM public.rbac_roles WHERE system_key = 'admin') = 1);
-- Un nouveau module crée ses droits : rôle personnalisé + clé + personne rattachée
INSERT INTO public.rbac_roles (name) VALUES ('Chef d''équipe prestataire');
INSERT INTO public.rbac_role_permissions (role_id, permission_key) SELECT id, 'chantiers.planning:update' FROM public.rbac_roles WHERE name = 'Chef d''équipe prestataire';
INSERT INTO public.rbac_role_permissions (role_id, permission_key) SELECT id, 'chantiers.planning:read' FROM public.rbac_roles WHERE name = 'Chef d''équipe prestataire';
SELECT zz.check('rôle personnalisé créé dans son entreprise', (SELECT organization_id FROM public.rbac_roles WHERE name = 'Chef d''équipe prestataire') = :ORG1::uuid AND (SELECT NOT is_system FROM public.rbac_roles WHERE name = 'Chef d''équipe prestataire'));
SELECT zz.check('une clé mal formée est refusée', zz.raises($$INSERT INTO public.rbac_role_permissions (role_id, permission_key) SELECT id, 'nimportequoi' FROM public.rbac_roles WHERE name = 'Chef d''équipe prestataire'$$) IS NOT NULL);
RESET ROLE;
UPDATE public.users SET rbac_role_id = (SELECT id FROM public.rbac_roles WHERE name = 'Chef d''équipe prestataire') WHERE email = 'u@iso.test';
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('première connexion du collaborateur (liaison de son compte)', public.whoami() IS NOT NULL);
SELECT zz.check('collaborateur avec le rôle personnalisé : la nouvelle clé fonctionne, sans droit supplémentaire ailleurs', public.rbac_has_any_permission(ARRAY['chantiers.planning:update'])
  AND NOT public.rbac_has_any_permission(ARRAY['reglages.parametres:update']) AND NOT public.app_has('scan'));
SELECT zz.check('un simple utilisateur ne crée ni ne modifie de rôle', zz.raises($$INSERT INTO public.rbac_roles (name) VALUES ('Pirate')$$) IS NOT NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B ne voit pas le rôle personnalisé de A et ne l''utilise pas', zz.count($$SELECT 1 FROM public.rbac_roles WHERE name LIKE 'Chef%'$$) = 0 AND NOT public.rbac_has_any_permission(ARRAY['chantiers.planning:update']));
RESET ROLE;
SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
