-- Discussion d'un projet ou d'un élément (migration 58) : droits (équipe et responsables écrivent, les autres lisent), auteur imposé, modification et suppression, avis regroupés, préférences, cascade, isolation. À lancer dans l'ordre de run.sh (après isolation.sql et rbac.sql).
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

-- Préparation (administrateur A : droit de modification des projets) : deux projets, un élément chacun ; U est dans l'équipe de D2 seulement
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_projects (name, type) VALUES ('D1', 'admin'), ('D2', 'admin');
SELECT id AS d1 FROM public.cp_projects WHERE name = 'D1' \gset
SELECT id AS d2 FROM public.cp_projects WHERE name = 'D2' \gset
INSERT INTO public.cp_items (project_id, kind, name) VALUES (:'d1', 'task', 'D1-T'), (:'d2', 'task', 'D2-T');
SELECT id AS d1t FROM public.cp_items WHERE name = 'D1-T' \gset
SELECT id AS d2t FROM public.cp_items WHERE name = 'D2-T' \gset
INSERT INTO public.cp_project_members (project_id, user_id, role) VALUES (:'d2', :'ua', 'lead'), (:'d2', :'uu', 'member');
INSERT INTO public.cp_item_members (item_id, user_id) VALUES (:'d2t', :'uu');

-- Écrire : un responsable (droit de modification) écrit même hors équipe ; l'auteur est TOUJOURS la personne connectée
INSERT INTO public.cp_comments (project_id, body) VALUES (:'d1', 'Bonjour D1');
SELECT zz.check('A (responsable) écrit sur un projet dont il n''est pas de l''équipe', (SELECT count(*) FROM public.cp_comments WHERE project_id = :'d1'::uuid) = 1);
INSERT INTO public.cp_comments (project_id, author_id, body) VALUES (:'d1', :'ub', 'Je prétends être B');
SELECT zz.check('l''auteur est imposé par la base (le client ne choisit pas)', (SELECT author_id FROM public.cp_comments WHERE body = 'Je prétends être B') = :'ua'::uuid);
SELECT zz.check('message vide refusé', zz.raises(format('INSERT INTO public.cp_comments (project_id, body) VALUES (%L, ''   '')', :'d1')) IS NOT NULL);
SELECT zz.check('4 001 caractères refusés, 4 000 acceptés', zz.raises(format('INSERT INTO public.cp_comments (project_id, body) VALUES (%L, repeat(''x'', 4001))', :'d1')) IS NOT NULL
  AND zz.raises(format('INSERT INTO public.cp_comments (project_id, body) VALUES (%L, repeat(''x'', 4000))', :'d1')) IS NULL);
SELECT zz.check('un élément d''un AUTRE projet est refusé avec un message clair', zz.raises(format('INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (%L, %L, ''x'')', :'d1', :'d2t')) LIKE '%pas dans ce projet%');
SELECT zz.check('un élément inconnu est refusé', zz.raises(format('INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (%L, gen_random_uuid(), ''x'')', :'d1')) IS NOT NULL);
RESET ROLE;

-- Lecteur hors équipe (U sur D1) : lit, n'écrit pas
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U (hors équipe) lit la discussion', (SELECT count(*) FROM public.cp_comments WHERE project_id = :'d1'::uuid) >= 2);
SELECT zz.check('U (hors équipe, sans droit de modification) n''écrit pas', zz.raises(format('INSERT INTO public.cp_comments (project_id, body) VALUES (%L, ''Piraté'')', :'d1')) IS NOT NULL
  AND (SELECT count(*) FROM public.cp_comments WHERE body = 'Piraté') = 0);
SELECT zz.check('U ne modifie ni ne supprime les messages des autres', zz.affected($$UPDATE public.cp_comments SET body = 'Piraté'$$) = 0 AND zz.affected($$DELETE FROM public.cp_comments$$) = 0);
RESET ROLE;

-- Membre de l'équipe (U sur D2) : écrit sur le projet et sur un élément, modifie et supprime les siens
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
INSERT INTO public.cp_comments (project_id, author_id, body) VALUES (:'d2', :'ua', 'Message de U sur le projet');
INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (:'d2', :'d2t', 'Message de U sur la tâche');
SELECT zz.check('U (membre de l''équipe) écrit sur le projet et sur un élément, sous SON nom même s''il prétend autre chose',
  (SELECT count(*) FROM public.cp_comments WHERE author_id = :'uu'::uuid AND project_id = :'d2'::uuid) = 2);
UPDATE public.cp_comments SET body = 'Message corrigé' WHERE body = 'Message de U sur le projet';
SELECT zz.check('U modifie son message : la date de modification est posée', (SELECT edited_at IS NOT NULL AND body = 'Message corrigé' FROM public.cp_comments WHERE body = 'Message corrigé')
  AND (SELECT edited_at IS NULL FROM public.cp_comments WHERE body = 'Message de U sur la tâche'));
SELECT zz.check('un message ne change ni de projet, ni d''élément, ni d''auteur', zz.raises(format('UPDATE public.cp_comments SET project_id = %L WHERE body = ''Message corrigé''', :'d1')) IS NOT NULL
  AND zz.raises(format('UPDATE public.cp_comments SET author_id = %L WHERE body = ''Message corrigé''', :'ua')) IS NOT NULL
  AND zz.raises(format('UPDATE public.cp_comments SET item_id = %L WHERE body = ''Message corrigé''', :'d2t')) IS NOT NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A (droit de suppression) supprime le message d''un autre', zz.affected($$DELETE FROM public.cp_comments WHERE body = 'Message de U sur la tâche'$$) = 1);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U supprime son propre message', zz.affected($$DELETE FROM public.cp_comments WHERE body = 'Message corrigé'$$) = 1);
RESET ROLE;

-- Quitter l'équipe : on ne peut plus écrire ni corriger, mais on garde la main sur ses propres messages (suppression)
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_comments (project_id, body) VALUES (:'d2', 'Ancien message de A');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
INSERT INTO public.cp_comments (project_id, body) VALUES (:'d2', 'Dernier message de U');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
DELETE FROM public.cp_project_members WHERE project_id = :'d2'::uuid AND user_id = :'uu'::uuid;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('sorti de l''équipe : U n''écrit plus et ne corrige plus ses messages', zz.raises(format('INSERT INTO public.cp_comments (project_id, body) VALUES (%L, ''Encore'')', :'d2')) IS NOT NULL
  AND zz.affected($$UPDATE public.cp_comments SET body = 'Réécrit' WHERE body = 'Dernier message de U'$$) = 0);
SELECT zz.check('…mais il peut supprimer ses propres messages', zz.affected($$DELETE FROM public.cp_comments WHERE body = 'Dernier message de U'$$) = 1);
RESET ROLE;

-- Avis : l'équipe du projet (ou les assignés de l'élément), jamais l'auteur ; regroupés ; tus si la personne le demande
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_project_members (project_id, user_id, role) VALUES (:'d2', :'uu', 'member');
-- (quitter l'équipe avait désassigné U de la tâche : on le réassigne)
INSERT INTO public.cp_item_members (item_id, user_id) VALUES (:'d2t', :'uu');
RESET ROLE;
DELETE FROM public.notifications WHERE kind = 'cp_comment';
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_comments (project_id, body) VALUES (:'d2', 'Premier message d''équipe');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('un message sur le projet prévient l''équipe (U), avec l''auteur, la fiche et un extrait', (SELECT count(*) FROM public.my_notifications(500) WHERE kind = 'cp_comment') = 1
  AND (SELECT message LIKE '%a écrit dans « D2 » : « Premier message d''équipe »%' FROM public.my_notifications(500) WHERE kind = 'cp_comment'));
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('l''auteur ne reçoit pas d''avis pour son propre message', (SELECT count(*) FROM public.my_notifications(500) WHERE kind = 'cp_comment') = 0);
INSERT INTO public.cp_comments (project_id, body) VALUES (:'d2', 'Deuxième message d''équipe');
RESET ROLE;
SELECT zz.check('un 2e message rapproché sur la même fiche : toujours UN seul avis, mis à jour', (SELECT count(*) FROM public.notifications WHERE kind = 'cp_comment' AND recipient_user_id = :'uu'::uuid) = 1
  AND (SELECT message FROM public.notifications WHERE kind = 'cp_comment' AND recipient_user_id = :'uu'::uuid) LIKE 'Plusieurs nouveaux messages dans « D2 »%');
UPDATE public.notifications SET read_at = now() WHERE kind = 'cp_comment' AND recipient_user_id = :'uu'::uuid;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_comments (project_id, body) VALUES (:'d2', 'Troisième message après lecture');
RESET ROLE;
SELECT zz.check('après lecture de l''avis, un nouveau message crée un nouvel avis', (SELECT count(*) FROM public.notifications WHERE kind = 'cp_comment' AND recipient_user_id = :'uu'::uuid) = 2);
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (:'d2', :'d2t', 'Message sur la tâche');
INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (:'d1', :'d1t', 'Message sur une tâche sans assigné');
RESET ROLE;
SELECT zz.check('sur un élément : seule la personne assignée est prévenue, sur CETTE fiche ; sans assigné, personne', (SELECT count(*) FROM public.notifications WHERE kind = 'cp_comment' AND cp_item_id = :'d2t'::uuid AND recipient_user_id = :'uu'::uuid) = 1
  AND (SELECT count(*) FROM public.notifications WHERE kind = 'cp_comment' AND cp_item_id = :'d1t'::uuid) = 0
  AND (SELECT count(*) FROM public.notifications WHERE kind = 'cp_comment' AND recipient_user_id = :'ua'::uuid) = 0);
-- Préférences : valeurs par défaut (dans l'application et push oui, e-mail non), puis « non » dans l'application
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('par défaut : « nouveau message » dans l''application et en push, pas par e-mail', (SELECT in_app AND push AND NOT email FROM public.my_cp_notification_prefs() WHERE kind = 'cp_comment'));
INSERT INTO public.cp_notification_prefs (kind, in_app, email, push) VALUES ('cp_comment', false, false, false);
RESET ROLE;
SELECT count(*) AS avant FROM public.notifications WHERE kind = 'cp_comment' \gset
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (:'d2', :'d2t', 'Message que U ne veut pas');
RESET ROLE;
SELECT zz.check('si U refuse « dans l''application », aucun avis n''est créé pour lui', (SELECT count(*) FROM public.notifications WHERE kind = 'cp_comment') = :avant);
UPDATE public.notifications SET read_at = now() WHERE kind = 'cp_comment' AND recipient_user_id = :'uu'::uuid;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
UPDATE public.cp_notification_prefs SET in_app = true, email = false, push = true WHERE kind = 'cp_comment';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (:'d2', :'d2t', 'Message que U veut bien');
RESET ROLE;
SELECT zz.check('e-mail désactivé : l''avis est marqué « déjà traité » pour l''e-mail (pas d''envoi), le push reste à faire', (SELECT emailed_at IS NOT NULL AND pushed_at IS NULL FROM public.notifications WHERE kind = 'cp_comment' AND recipient_user_id = :'uu'::uuid ORDER BY created_at DESC LIMIT 1));

-- Journal d'audit, cascade, module désactivé, isolation, droits d'exécution
SELECT zz.check('le journal d''audit garde la trace des messages', (SELECT count(*) FROM public.audit_log WHERE table_name = 'cp_comments') >= 5);
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B (autre entreprise) ne lit aucun message de A', (SELECT count(*) FROM public.cp_comments) = 0);
SELECT zz.check('B n''écrit pas dans un projet de A', zz.raises(format('INSERT INTO public.cp_comments (project_id, body) VALUES (%L, ''Volé'')', :'d2')) IS NOT NULL);
SELECT zz.check('B ne modifie ni ne supprime rien chez A', zz.affected($$UPDATE public.cp_comments SET body = 'Piraté'$$) = 0 AND zz.affected($$DELETE FROM public.cp_comments$$) = 0);
RESET ROLE;
SELECT zz.check('le droit d''exécution de cp_can_discuss est refusé au public anonyme', NOT has_function_privilege('anon', 'public.cp_can_discuss(uuid)', 'EXECUTE'));
SELECT count(*) AS nb FROM public.cp_comments WHERE item_id = :'d2t'::uuid \gset
DELETE FROM public.organization_modules WHERE organization_id = :ORG1::uuid AND module_key = 'cp.projects';
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('module désactivé : même l''administrateur ne lit ni n''écrit', (SELECT count(*) FROM public.cp_comments) = 0
  AND zz.raises(format('INSERT INTO public.cp_comments (project_id, body) VALUES (%L, ''Sans module'')', :'d2')) IS NOT NULL);
RESET ROLE;
INSERT INTO public.organization_modules (organization_id, module_key) VALUES (:ORG1::uuid, 'cp.projects') ON CONFLICT DO NOTHING;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
DELETE FROM public.cp_items WHERE id = :'d2t'::uuid;
SELECT zz.check('supprimer un élément supprime sa discussion (il y avait ' || :nb || ' messages)', :nb::int >= 3 AND (SELECT count(*) FROM public.cp_comments WHERE item_id = :'d2t'::uuid) = 0);
DELETE FROM public.cp_projects WHERE name = 'D1';
SELECT zz.check('supprimer un projet supprime sa discussion', (SELECT count(*) FROM public.cp_comments WHERE project_id = :'d1'::uuid) = 0);
RESET ROLE;

-- Ménage
SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.notifications WHERE kind = 'cp_comment';
DELETE FROM public.cp_notification_prefs;
DELETE FROM public.cp_projects WHERE name IN ('D1', 'D2');
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
