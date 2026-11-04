-- R2b : projets, états, responsables (droits, contrôles, isolation). À lancer sur la base locale APRÈS isolation.sql.
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

-- Droits par défaut et états de base
SELECT zz.check('droits cp.projects : administrateur et responsable écrivent, magasinier et collaborateur lisent seulement', (
  SELECT bool_and(CASE WHEN r.system_key IN ('admin', 'manager') THEN n = 4 ELSE n = 1 END)
  FROM (SELECT r.system_key, count(*) AS n FROM public.rbac_roles r JOIN public.rbac_role_permissions p ON p.role_id = r.id
        WHERE r.organization_id = :ORG1::uuid AND p.permission_key LIKE 'cp.projects:%' GROUP BY r.system_key) r));
SELECT zz.check('une nouvelle entreprise reçoit les droits cp.projects', (SELECT count(*) FROM public.rbac_role_permissions p JOIN public.rbac_roles r ON r.id = p.role_id
  WHERE r.organization_id = :ORG2::uuid AND p.permission_key LIKE 'cp.projects:%') = 10);
SELECT zz.check('chaque entreprise a ses 4 états de base, une fois par famille', (
  SELECT bool_and(n = 4 AND f = 4) FROM (SELECT organization_id, count(*) AS n, count(DISTINCT family) AS f FROM public.cp_statuses WHERE is_system GROUP BY organization_id) x)
  AND (SELECT count(DISTINCT organization_id) FROM public.cp_statuses) = (SELECT count(*) FROM public.organizations));

-- Sans le module cp.projects : rien n'est lisible ni écrivable, même pour l'administrateur
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('module non activé : A ne lit aucun état', (SELECT count(*) FROM public.cp_statuses) = 0);
SELECT zz.check('module non activé : A ne crée pas de projet', zz.raises($$INSERT INTO public.cp_projects (name, type) VALUES ('Sans module', 'admin')$$) IS NOT NULL);
RESET ROLE;
INSERT INTO public.organization_modules (organization_id, module_key) VALUES (:ORG1::uuid, 'cp.projects'), (:ORG2::uuid, 'cp.projects') ON CONFLICT DO NOTHING;

-- Préparation par l'administrateur de l'entreprise 1
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('module activé : A lit ses 4 états', (SELECT count(*) FROM public.cp_statuses) = 4);
INSERT INTO public.sites (name) VALUES ('Chantier lié'), ('Chantier lié bis');
-- Le « programme » a été supprimé (migration 55) : ni table, ni colonne
SELECT zz.check('la notion de programme n''existe plus (table et colonne supprimées)', to_regclass('public.cp_programs') IS NULL AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cp_projects' AND column_name = 'program_id'));

INSERT INTO public.cp_projects (name, type, site_id, starts_on, ends_on, priority)
SELECT 'Festival Léman', 'site', (SELECT id FROM public.sites WHERE name = 'Chantier lié'), '2027-06-01', '2027-06-30', 'high';
INSERT INTO public.cp_projects (name, type, starts_on, ends_on) VALUES ('Prototype X', 'rd', '2027-02-01', '2027-09-30');
SELECT zz.check('A crée un projet chantier relié à un chantier', (SELECT count(*) FROM public.cp_projects WHERE site_id IS NOT NULL) = 1);
SELECT zz.check('sans état précisé, le projet est « Pas commencé »', (SELECT bool_and(s.family = 'not_started' AND s.is_system) FROM public.cp_projects p JOIN public.cp_statuses s ON s.id = p.status_id));
SELECT zz.check('journal d''audit : le projet y figure', (SELECT count(*) FROM public.audit_log WHERE table_name = 'cp_projects' AND action = 'insert') = 2);
SELECT zz.check('projet de type R&D relié à un chantier : refusé', zz.raises($$INSERT INTO public.cp_projects (name, type, site_id) SELECT 'R&D lié', 'rd', id FROM public.sites WHERE name = 'Chantier lié bis'$$) IS NOT NULL);
SELECT zz.check('deux projets sur le même chantier : refusé', zz.raises($$INSERT INTO public.cp_projects (name, type, site_id) SELECT 'Doublon', 'site', id FROM public.sites WHERE name = 'Chantier lié'$$) IS NOT NULL);
SELECT zz.check('projet dont la fin précède le début : refusé', zz.raises($$INSERT INTO public.cp_projects (name, type, starts_on, ends_on) VALUES ('Inversé', 'admin', '2027-05-01', '2027-04-01')$$) IS NOT NULL);
SELECT zz.check('type inconnu refusé', zz.raises($$INSERT INTO public.cp_projects (name, type) VALUES ('Bizarre', 'autre')$$) IS NOT NULL);
SELECT zz.check('priorité inconnue refusée', zz.raises($$INSERT INTO public.cp_projects (name, type, priority) VALUES ('Urgent', 'admin', 'critique')$$) IS NOT NULL);
SELECT zz.check('projet sans nom refusé', zz.raises($$INSERT INTO public.cp_projects (name, type) VALUES (' ', 'admin')$$) IS NOT NULL);
SELECT zz.check('tous types acceptés', zz.raises($$INSERT INTO public.cp_projects (name, type) VALUES ('T1', 'design'), ('T2', 'recruitment'), ('T3', 'admin'), ('T4', 'event')$$) IS NULL);

-- Plusieurs responsables
INSERT INTO public.cp_project_members (project_id, user_id) SELECT p.id, :'ua'::uuid FROM public.cp_projects p WHERE p.name = 'Festival Léman';
INSERT INTO public.cp_project_members (project_id, user_id) SELECT p.id, :'uu'::uuid FROM public.cp_projects p WHERE p.name = 'Festival Léman';
SELECT zz.check('un projet a plusieurs responsables', (SELECT count(*) FROM public.cp_project_members) = 2);
SELECT zz.check('le même responsable deux fois : refusé', zz.raises(format('INSERT INTO public.cp_project_members (project_id, user_id) SELECT p.id, %L FROM public.cp_projects p WHERE p.name = ''Festival Léman''', :'ua')) IS NOT NULL);

-- États : ajout, protection des états de base
INSERT INTO public.cp_statuses (name, family, color, position) VALUES ('En validation', 'in_progress', '#f59e0b', 10);
SELECT zz.check('A ajoute un état personnalisé dans une famille', (SELECT count(*) FROM public.cp_statuses WHERE NOT is_system AND family = 'in_progress') = 1);
SELECT zz.check('état en double refusé', zz.raises($$INSERT INTO public.cp_statuses (name, family) VALUES (' en validation', 'done')$$) IS NOT NULL);
SELECT zz.check('famille inconnue refusée', zz.raises($$INSERT INTO public.cp_statuses (name, family) VALUES ('Bizarre', 'suspendu')$$) IS NOT NULL);
SELECT zz.check('un état ajouté ne peut pas se déclarer « de base »', zz.raises($$UPDATE public.cp_statuses SET is_system = true WHERE name = 'En validation'$$) IS NOT NULL);
SELECT zz.check('un état de base ne se supprime pas', zz.raises($$DELETE FROM public.cp_statuses WHERE is_system AND family = 'done'$$) IS NOT NULL);
SELECT zz.check('un état de base ne change pas de famille', zz.raises($$UPDATE public.cp_statuses SET family = 'done' WHERE is_system AND family = 'cancelled'$$) IS NOT NULL);
SELECT zz.check('un état de base peut être renommé et recoloré', zz.affected($$UPDATE public.cp_statuses SET name = 'À lancer', color = '#9ca3af' WHERE is_system AND family = 'not_started'$$) = 1);
UPDATE public.cp_projects SET status_id = (SELECT id FROM public.cp_statuses WHERE name = 'En validation') WHERE name = 'Prototype X';
SELECT zz.check('un état utilisé par un projet ne se supprime pas', zz.raises($$DELETE FROM public.cp_statuses WHERE name = 'En validation'$$) IS NOT NULL);
SELECT pg_sleep(0.02);
UPDATE public.cp_projects SET description = 'Mis à jour' WHERE name = 'Prototype X';
SELECT zz.check('la date de modification suit', (SELECT updated_at > created_at FROM public.cp_projects WHERE name = 'Prototype X'));
UPDATE public.cp_projects SET status_id = (SELECT id FROM public.cp_statuses WHERE is_system AND family = 'in_progress') WHERE name = 'Prototype X';
SELECT zz.check('un état inutilisé se supprime', zz.affected($$DELETE FROM public.cp_statuses WHERE name = 'En validation'$$) = 1);

-- Collaborateur (rôle système « user ») : lit, n'écrit pas
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U lit projets, états et responsables', (SELECT count(*) FROM public.cp_projects) = 6 AND (SELECT count(*) FROM public.cp_statuses) = 4 AND (SELECT count(*) FROM public.cp_project_members) = 2);
SELECT zz.check('U ne crée pas de projet', zz.raises($$INSERT INTO public.cp_projects (name, type) VALUES ('Piraté', 'admin')$$) IS NOT NULL);
SELECT zz.check('U ne crée pas d''état', zz.raises($$INSERT INTO public.cp_statuses (name, family) VALUES ('Piraté', 'done')$$) IS NOT NULL);
SELECT zz.check('U ne modifie ni ne supprime rien', zz.affected($$UPDATE public.cp_projects SET name = 'Piraté'$$) = 0 AND zz.affected($$DELETE FROM public.cp_projects$$) = 0
  AND zz.affected($$DELETE FROM public.cp_project_members$$) = 0);
RESET ROLE;

-- Isolation : l'entreprise B
SELECT id AS site_a FROM public.sites WHERE name = 'Chantier lié bis' \gset
SELECT id AS proj_a FROM public.cp_projects WHERE name = 'Festival Léman' \gset
SELECT id AS status_a FROM public.cp_statuses WHERE is_system AND family = 'done' AND organization_id = :ORG1::uuid \gset
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B ne voit rien des projets de A', (SELECT count(*) FROM public.cp_projects) = 0 AND (SELECT count(*) FROM public.cp_project_members) = 0 AND (SELECT count(*) FROM public.cp_statuses WHERE organization_id = :ORG1::uuid) = 0);
SELECT zz.check('B voit ses 4 états', (SELECT count(*) FROM public.cp_statuses) = 4);
SELECT zz.check('B ne rattache pas un projet au chantier de A', zz.raises(format('INSERT INTO public.cp_projects (name, type, site_id) VALUES (''Volé'', ''site'', %L)', :'site_a')) IS NOT NULL);
SELECT zz.check('B n''utilise pas un état de A', zz.raises(format('INSERT INTO public.cp_projects (name, type, status_id) VALUES (''Volé'', ''admin'', %L)', :'status_a')) IS NOT NULL);
SELECT zz.check('B ne modifie ni ne supprime rien chez A', zz.affected($$UPDATE public.cp_projects SET name = 'Piraté'$$) = 0);
INSERT INTO public.cp_projects (name, type) VALUES ('Projet de B', 'admin');
SELECT zz.check('B crée son projet, état par défaut de B', (SELECT count(*) FROM public.cp_projects) = 1 AND (SELECT s.organization_id = :ORG2::uuid AND s.family = 'not_started' FROM public.cp_projects p JOIN public.cp_statuses s ON s.id = p.status_id));
SELECT zz.check('B ne désigne pas un responsable de A', zz.raises(format('INSERT INTO public.cp_project_members (project_id, user_id) SELECT p.id, %L FROM public.cp_projects p', :'uu')) IS NOT NULL);
SELECT zz.check('B n''ajoute pas de responsable à un projet de A', zz.raises(format('INSERT INTO public.cp_project_members (project_id, user_id) VALUES (%L, %L)', :'proj_a', :'ub')) IS NOT NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A ne voit pas le projet de B', (SELECT count(*) FROM public.cp_projects WHERE name = 'Projet de B') = 0);

-- Suppression d'un projet (les responsables partent avec lui)
DELETE FROM public.cp_projects WHERE name = 'Festival Léman';
SELECT zz.check('supprimer un projet supprime ses responsables', (SELECT count(*) FROM public.cp_project_members) = 0);
RESET ROLE;
-- On remet les modules comme avant (les batteries suivantes comptent les modules)
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
