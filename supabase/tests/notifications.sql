-- Notifications : lu / non lu propre à chaque personne. Base LOCALE reconstruite avec toutes les migrations.
\set ON_ERROR_STOP on
\set S1 '''51000000-0000-0000-0000-000000000001'''
\set S2 '''51000000-0000-0000-0000-000000000002'''
\set C '''51000000-0000-0000-0000-00000000000c'''
\set AD '''51000000-0000-0000-0000-0000000000ad'''
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
DROP SCHEMA IF EXISTS zz CASCADE;
CREATE SCHEMA zz;
CREATE TABLE zz.results (n serial, name text, ok boolean, detail text);
GRANT USAGE ON SCHEMA zz TO authenticated;
CREATE FUNCTION zz.check(p_name text, p_ok boolean, p_detail text DEFAULT NULL) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ INSERT INTO zz.results (name, ok, detail) VALUES (p_name, COALESCE(p_ok, false), p_detail) $$;
CREATE FUNCTION zz.affected(p_sql text) RETURNS integer LANGUAGE plpgsql AS $$ DECLARE n integer; BEGIN EXECUTE p_sql; GET DIAGNOSTICS n = ROW_COUNT; RETURN n; END $$;
CREATE FUNCTION zz.count(p_sql text) RETURNS integer LANGUAGE plpgsql AS $$ DECLARE n integer; BEGIN EXECUTE 'SELECT count(*) FROM (' || p_sql || ') s' INTO n; RETURN n; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO authenticated;

-- Les notifications laissées par d'autres tests de la même base sont déclarées lues : on ne compte que les nôtres
UPDATE public.notifications SET read_at = now() WHERE read_at IS NULL;
INSERT INTO auth.users (id, email) VALUES (:S1, 's1@notif.test'), (:S2, 's2@notif.test'), (:C, 'c@notif.test'), (:AD, 'ad@notif.test');
INSERT INTO public.users (email, first_name, last_name, role) VALUES
  ('s1@notif.test', 'Stan', 'Un', 'technician'), ('s2@notif.test', 'Sara', 'Deux', 'technician'), ('c@notif.test', 'Colin', 'Collab', 'user'), ('ad@notif.test', 'Ada', 'Admin', 'admin');
UPDATE public.users pu SET auth_user_id = (SELECT a.id FROM auth.users a WHERE a.email = pu.email) WHERE pu.email LIKE '%@notif.test';
INSERT INTO public.notifications (kind, title, message) VALUES ('low_stock', 'Stock bas', 'N1 alerte du magasin');
INSERT INTO public.notifications (kind, title, message, read_at) VALUES ('incident', 'Ancienne', 'N2 déjà lue avant la migration', now());
INSERT INTO public.notifications (kind, title, message, recipient_user_id)
  SELECT 'request_ready', 'Prête', 'PC avis du collaborateur', id FROM public.users WHERE email = 'c@notif.test';
INSERT INTO public.notifications (kind, title, message, recipient_user_id)
  SELECT 'return_reminder', 'Rappel', 'PS1 avis personnel du magasinier 1', id FROM public.users WHERE email = 's1@notif.test';
SELECT id AS n1 FROM public.notifications WHERE message LIKE 'N1%' \gset
SELECT id AS n2 FROM public.notifications WHERE message LIKE 'N2%' \gset
SELECT id AS pc FROM public.notifications WHERE message LIKE 'PC%' \gset
SELECT id AS ps1 FROM public.notifications WHERE message LIKE 'PS1%' \gset

SELECT set_config('request.jwt.claim.sub', :S1, false); SET ROLE authenticated;
SELECT zz.check('S1 voit l''alerte du magasin et son avis, pas celui du collaborateur', zz.count($$SELECT 1 FROM public.my_notifications() WHERE message ~ '^(N1|N2|PS1)'$$) = 3 AND zz.count($$SELECT 1 FROM public.my_notifications() WHERE message LIKE 'PC%'$$) = 0);
SELECT zz.check('S1 : 2 non lues (l''ancienne est lue)', public.unread_notification_count() = 2);
SELECT public.mark_notifications_read(ARRAY[:'n1'::uuid]) AS r \gset
SELECT zz.check('S1 : lire l''alerte du magasin', :r = 1 AND public.unread_notification_count() = 1);
SELECT zz.check('S1 : ne lit pas l''avis d''un autre', public.mark_notifications_read(ARRAY[:'pc'::uuid]) = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :S2, false); SET ROLE authenticated;
SELECT zz.check('S2 : l''alerte lue par S1 reste non lue pour S2', public.unread_notification_count() = 1 AND (SELECT NOT is_read FROM public.my_notifications() WHERE id = :'n1'::uuid));
SELECT zz.check('S2 ne voit pas l''avis personnel de S1', zz.count($$SELECT 1 FROM public.my_notifications() WHERE message LIKE 'PS1%'$$) = 0);
SELECT public.mark_notification_unread(:'n2'::uuid) AS r \gset
SELECT zz.check('S2 : remettre en non lue une ancienne alerte lue', :r = 1 AND public.unread_notification_count() = 2);
SELECT zz.check('S2 ne lit pas les lignes de lecture de S1', zz.count('SELECT 1 FROM public.notification_reads') = 1);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :S1, false); SET ROLE authenticated;
SELECT zz.check('S1 : l''ancienne alerte reste lue pour S1', (SELECT is_read FROM public.my_notifications() WHERE id = :'n2'::uuid));
SELECT public.mark_all_notifications_read() AS r \gset
SELECT zz.check('S1 : tout marquer comme lu', :r = 1 AND public.unread_notification_count() = 0);
SELECT public.mark_notification_unread(:'ps1'::uuid) AS r \gset
SELECT zz.check('S1 : remettre en non lue', :r = 1 AND public.unread_notification_count() = 1);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :S2, false); SET ROLE authenticated;
SELECT zz.check('S2 : non touché par le « tout lu » de S1', public.unread_notification_count() = 2);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :C, false); SET ROLE authenticated;
SELECT zz.check('collaborateur : voit uniquement son avis', zz.count('SELECT 1 FROM public.my_notifications()') = 1 AND public.unread_notification_count() = 1);
SELECT zz.check('collaborateur : ne lit pas une alerte du magasin', public.mark_notifications_read(ARRAY[:'n1'::uuid]) = 0 AND public.mark_notification_unread(:'n1'::uuid) = 0);
SELECT public.mark_notifications_read(ARRAY[:'pc'::uuid]) AS r \gset
SELECT zz.check('collaborateur : lire son avis', :r = 1 AND public.unread_notification_count() = 0);
SELECT public.mark_notification_unread(:'pc'::uuid) AS r \gset
SELECT zz.check('collaborateur : remettre son avis en non lu', :r = 1 AND public.unread_notification_count() = 1);
SELECT public.mark_all_notifications_read() AS r \gset
SELECT zz.check('collaborateur : tout marquer comme lu', :r = 1 AND public.unread_notification_count() = 0);
-- Accès DIRECT à la table (API) : un avis adressé à une personne ne se lit, ne se modifie et ne se supprime que par elle
SELECT set_config('request.jwt.claim.sub', :S2, false); SET ROLE authenticated;
SELECT zz.check('table : S2 (magasin) ne lit pas l''avis personnel de S1', zz.count($$SELECT 1 FROM public.notifications WHERE message LIKE 'PS1%'$$) = 0);
SELECT zz.check('table : S2 (magasin) ne lit pas l''avis du collaborateur', zz.count($$SELECT 1 FROM public.notifications WHERE message LIKE 'PC%'$$) = 0);
SELECT zz.check('table : S2 (magasin) lit toujours l''alerte du magasin (sans destinataire)', zz.count($$SELECT 1 FROM public.notifications WHERE message LIKE 'N1%'$$) = 1);
SELECT zz.check('table : S2 ne modifie pas l''avis d''un autre', zz.affected($$UPDATE public.notifications SET title = 'piraté' WHERE message LIKE 'PC%'$$) = 0);
SELECT zz.check('table : S2 modifie encore une alerte du magasin', zz.affected($$UPDATE public.notifications SET title = 'Stock bas' WHERE message LIKE 'N1%'$$) = 1);
SELECT zz.check('table : S2 ne supprime pas l''avis d''un autre', zz.affected($$DELETE FROM public.notifications WHERE message LIKE 'PS1%'$$) = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :S1, false); SET ROLE authenticated;
SELECT zz.check('table : S1 lit son propre avis', zz.count($$SELECT 1 FROM public.notifications WHERE message LIKE 'PS1%'$$) = 1);
SELECT zz.check('table : S1 ne lit pas l''avis du collaborateur', zz.count($$SELECT 1 FROM public.notifications WHERE message LIKE 'PC%'$$) = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :C, false); SET ROLE authenticated;
SELECT zz.check('table : le collaborateur lit son avis, pas les autres', zz.count($$SELECT 1 FROM public.notifications WHERE message LIKE 'PC%'$$) = 1 AND zz.count($$SELECT 1 FROM public.notifications WHERE message LIKE 'PS1%' OR message LIKE 'N1%'$$) = 0);
RESET ROLE;
-- Un administrateur (droit « settings ») pouvait supprimer n'importe quel avis de l'entreprise : plus ceux des autres personnes
SELECT set_config('request.jwt.claim.sub', :AD, false); SET ROLE authenticated;
SELECT zz.check('table : l''administrateur ne lit pas l''avis personnel d''un autre', zz.count($$SELECT 1 FROM public.notifications WHERE message LIKE 'PC%' OR message LIKE 'PS1%'$$) = 0);
SELECT zz.check('table : l''administrateur ne supprime pas l''avis personnel d''un autre', zz.affected($$DELETE FROM public.notifications WHERE message LIKE 'PC%' OR message LIKE 'PS1%'$$) = 0);
RESET ROLE;
SELECT zz.check('table : les avis personnels existent toujours (aucune suppression)', (SELECT count(*) FROM public.notifications WHERE message LIKE 'PC%' OR message LIKE 'PS1%') = 2);
-- L'envoi d'un avis personnel par une fonction de la base (propriétaire) reste possible
CREATE FUNCTION public.zz_envoi_avis(p_to uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ INSERT INTO public.notifications (kind, title, message, recipient_user_id) VALUES ('return_reminder', 'Rappel', 'PE avis créé par une fonction', p_to) $$;
GRANT EXECUTE ON FUNCTION public.zz_envoi_avis(uuid) TO authenticated;
SELECT id AS uc FROM public.users WHERE email = 'c@notif.test' \gset
SELECT set_config('request.jwt.claim.sub', :S2, false); SET ROLE authenticated;
SELECT public.zz_envoi_avis(:'uc'::uuid);
RESET ROLE;
SELECT zz.check('envoi : une fonction du propriétaire crée toujours l''avis personnel d''une autre personne', (SELECT count(*) FROM public.notifications WHERE message LIKE 'PE%') = 1);
SELECT set_config('request.jwt.claim.sub', :S2, false); SET ROLE authenticated;
SELECT zz.check('envoi : ... et l''expéditeur (S2) ne peut pas le lire pour autant', zz.count($$SELECT 1 FROM public.notifications WHERE message LIKE 'PE%'$$) = 0);
RESET ROLE;
DROP FUNCTION public.zz_envoi_avis(uuid);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT zz.check('anonyme : aucune fonction de notification', (SELECT count(*) FROM pg_proc p WHERE proname IN ('my_notifications', 'unread_notification_count', 'mark_notifications_read', 'mark_all_notifications_read', 'mark_notification_unread') AND has_function_privilege('anon', p.oid, 'execute')) = 0);
SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
