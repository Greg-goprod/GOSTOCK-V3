-- Notifications : lu / non lu propre à chaque personne. Base LOCALE reconstruite avec toutes les migrations.
\set ON_ERROR_STOP on
\set S1 '''51000000-0000-0000-0000-000000000001'''
\set S2 '''51000000-0000-0000-0000-000000000002'''
\set C '''51000000-0000-0000-0000-00000000000c'''
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
DROP SCHEMA IF EXISTS zz CASCADE;
CREATE SCHEMA zz;
CREATE TABLE zz.results (n serial, name text, ok boolean, detail text);
GRANT USAGE ON SCHEMA zz TO authenticated;
CREATE FUNCTION zz.check(p_name text, p_ok boolean, p_detail text DEFAULT NULL) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ INSERT INTO zz.results (name, ok, detail) VALUES (p_name, COALESCE(p_ok, false), p_detail) $$;
CREATE FUNCTION zz.count(p_sql text) RETURNS integer LANGUAGE plpgsql AS $$ DECLARE n integer; BEGIN EXECUTE 'SELECT count(*) FROM (' || p_sql || ') s' INTO n; RETURN n; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO authenticated;

-- Les notifications laissées par d'autres tests de la même base sont déclarées lues : on ne compte que les nôtres
UPDATE public.notifications SET read_at = now() WHERE read_at IS NULL;
INSERT INTO auth.users (id, email) VALUES (:S1, 's1@notif.test'), (:S2, 's2@notif.test'), (:C, 'c@notif.test');
INSERT INTO public.users (email, first_name, last_name, role) VALUES
  ('s1@notif.test', 'Stan', 'Un', 'technician'), ('s2@notif.test', 'Sara', 'Deux', 'technician'), ('c@notif.test', 'Colin', 'Collab', 'user');
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
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT zz.check('anonyme : aucune fonction de notification', (SELECT count(*) FROM pg_proc p WHERE proname IN ('my_notifications', 'unread_notification_count', 'mark_notifications_read', 'mark_all_notifications_read', 'mark_notification_unread') AND has_function_privilege('anon', p.oid, 'execute')) = 0);
SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
