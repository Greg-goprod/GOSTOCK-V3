-- P11 : mentions @ dans la discussion, récapitulatif quotidien, publication temps réel. À lancer APRÈS isolation.sql.
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
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO authenticated;

UPDATE public.users SET rbac_role_id = (SELECT id FROM public.rbac_roles WHERE system_key = 'user' AND organization_id = :ORG1::uuid) WHERE email = 'u@iso.test';
INSERT INTO public.organization_modules (organization_id, module_key) VALUES (:ORG1::uuid, 'cp.projects'), (:ORG2::uuid, 'cp.projects') ON CONFLICT DO NOTHING;
SELECT id AS ua FROM public.users WHERE email = 'a@iso.test' AND organization_id = :ORG1::uuid \gset
SELECT id AS ub FROM public.users WHERE email = 'b@iso.test' AND organization_id = :ORG2::uuid \gset

-- Personnes (en administrateur de la base) : Anne Dupont et Anne Dupont-Martin (préfixe), Bruno Meier (assigné), Dora (inactive), Eve (autre entreprise), 22 « Mass nn »
SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.users (organization_id, email, first_name, last_name, role) VALUES (:ORG1::uuid, 'anne@p11.test', 'Anne', 'Dupont', 'user') RETURNING id AS anne \gset
INSERT INTO public.users (organization_id, email, first_name, last_name, role) VALUES (:ORG1::uuid, 'martin@p11.test', 'Anne', 'Dupont-Martin', 'user') RETURNING id AS martin \gset
INSERT INTO public.users (organization_id, email, first_name, last_name, role) VALUES (:ORG1::uuid, 'bruno@p11.test', 'Bruno', 'Meier', 'user') RETURNING id AS bruno \gset
INSERT INTO public.users (organization_id, email, first_name, last_name, role, active) VALUES (:ORG1::uuid, 'dora@p11.test', 'Dora', 'Inactive', 'user', false) RETURNING id AS dora \gset
INSERT INTO public.users (organization_id, email, first_name, last_name, role) VALUES (:ORG2::uuid, 'eve@p11.test', 'Eve', 'Etrangere', 'user') RETURNING id AS eve \gset
INSERT INTO public.users (organization_id, email, first_name, last_name, role) SELECT :ORG1::uuid, 'mass' || lpad(n::text, 2, '0') || '@p11.test', 'Mass', lpad(n::text, 2, '0'), 'user' FROM generate_series(1, 22) n;
SELECT first_name || ' ' || last_name AS a_name FROM public.users WHERE id = :'ua'::uuid \gset
CREATE FUNCTION pg_temp.nc(p_user uuid, p_kind text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT count(*)::integer FROM public.notifications WHERE recipient_user_id = p_user AND kind = p_kind $$;
GRANT EXECUTE ON FUNCTION pg_temp.nc(uuid, text) TO authenticated;
SELECT set_config('app.org_guard_off', '', false);

SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_projects (name, type) VALUES ('Projet P11', 'site');
SELECT id AS p1, organization_id AS org_a FROM public.cp_projects WHERE name = 'Projet P11' \gset
INSERT INTO public.cp_items (project_id, kind, name, starts_on, ends_on) VALUES (:'p1'::uuid, 'task', 'T11', '2027-03-01', '2027-03-05');
SELECT id AS t1 FROM public.cp_items WHERE name = 'T11' \gset
RESET ROLE;
SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.cp_project_members (project_id, user_id, role) VALUES (:'p1'::uuid, :'anne'::uuid, 'member'), (:'p1'::uuid, :'bruno'::uuid, 'member');
INSERT INTO public.cp_item_members (item_id, user_id) VALUES (:'t1'::uuid, :'bruno'::uuid);
DELETE FROM public.notifications WHERE kind = 'cp_assigned' OR kind = 'cp_team_added';
SELECT set_config('app.org_guard_off', '', false);

-- 1. Mentions
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (:'p1'::uuid, :'t1'::uuid, 'Salut @Anne Dupont, peux-tu regarder ?');
SELECT zz.check('1 « @Anne Dupont » : la base déduit la mention', (SELECT mentions = ARRAY[:'anne'::uuid] FROM public.cp_comments WHERE body LIKE 'Salut @Anne%'));
RESET ROLE;
SELECT zz.check('2 Anne reçoit UN avis de mention, avec le projet et la tâche pour ouvrir la discussion', pg_temp.nc(:'anne'::uuid, 'cp_mention') = 1
  AND (SELECT cp_project_id = :'p1'::uuid AND cp_item_id = :'t1'::uuid AND recipient_user_id = :'anne'::uuid FROM public.notifications WHERE kind = 'cp_mention' AND recipient_user_id = :'anne'::uuid));
SELECT zz.check('3 le texte de l''avis nomme l''auteur et la tâche', (SELECT message LIKE :'a_name' || ' t''a mentionné dans « T11 » : « Salut @Anne Dupont, peux-tu regarder ? ».' FROM public.notifications WHERE kind = 'cp_mention' AND recipient_user_id = :'anne'::uuid), (SELECT message FROM public.notifications WHERE kind = 'cp_mention' AND recipient_user_id = :'anne'::uuid));
SELECT zz.check('4 l''auteur ne reçoit rien', pg_temp.nc(:'ua'::uuid, 'cp_mention') = 0);
SELECT zz.check('5 Bruno (assigné à la tâche, non mentionné) reçoit l''avis de message normal, pas de mention', pg_temp.nc(:'bruno'::uuid, 'cp_comment') = 1 AND pg_temp.nc(:'bruno'::uuid, 'cp_mention') = 0);
SELECT zz.check('6 par défaut l''e-mail et le push d''une mention sont DÉSACTIVÉS (avis créé déjà marqué envoyé)', (SELECT emailed_at IS NOT NULL AND pushed_at IS NOT NULL FROM public.notifications WHERE kind = 'cp_mention' AND recipient_user_id = :'anne'::uuid));

SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (:'p1'::uuid, :'t1'::uuid, '@Bruno Meier regarde aussi');
RESET ROLE;
SELECT zz.check('7 mentionné ET assigné : un avis de mention, et PAS un second avis de message (toujours 1)', pg_temp.nc(:'bruno'::uuid, 'cp_mention') = 1 AND pg_temp.nc(:'bruno'::uuid, 'cp_comment') = 1);
SELECT zz.check('8 l''avis de message de Bruno n''a pas été transformé en « Nouveaux messages »', (SELECT title = 'Nouveau message' FROM public.notifications WHERE kind = 'cp_comment' AND recipient_user_id = :'bruno'::uuid));

SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (:'p1'::uuid, NULL, format('Note pour moi : @%s', :'a_name'));
SELECT zz.check('9 se mentionner soi-même : aucune mention', (SELECT mentions = '{}' FROM public.cp_comments WHERE body LIKE 'Note pour moi%'));
INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (:'p1'::uuid, NULL, 'Majuscules : @anne DUPONT !');
SELECT zz.check('10 majuscules et minuscules indifférentes', (SELECT mentions = ARRAY[:'anne'::uuid] FROM public.cp_comments WHERE body LIKE 'Majuscules%'));
INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (:'p1'::uuid, NULL, 'Pour @Anne Dupont-Martin seulement');
SELECT zz.check('11 « @Anne Dupont-Martin » mentionne Martin et PAS « Anne Dupont » (préfixe)', (SELECT mentions = ARRAY[:'martin'::uuid] FROM public.cp_comments WHERE body LIKE 'Pour @Anne Dupont-Martin%'));
INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (:'p1'::uuid, NULL, 'Ping @Anne Dupont. Et @Bruno Meier, merci ; (@Anne Dupont)');
SELECT zz.check('12 ponctuation après (. , ; ) ) et parenthèse avant acceptées', (SELECT mentions = ARRAY[:'anne'::uuid, :'bruno'::uuid] FROM public.cp_comments WHERE body LIKE 'Ping @Anne%') OR (SELECT mentions @> ARRAY[:'anne'::uuid, :'bruno'::uuid] AND cardinality(mentions) = 2 FROM public.cp_comments WHERE body LIKE 'Ping @Anne%'));
INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (:'p1'::uuid, NULL, 'Écrire à contact@Anne Dupont ou à @Anne Dupontx');
SELECT zz.check('13 collé à une lettre (adresse e-mail) ou suivi d''une lettre : aucune mention', (SELECT mentions = '{}' FROM public.cp_comments WHERE body LIKE 'Écrire à contact%'));
INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (:'p1'::uuid, NULL, format('Inconnue @Zorro Nobody, autre entreprise @%s %s, inactive @Dora Inactive', 'Eve', 'Etrangere'));
SELECT zz.check('14 inconnu, autre entreprise, personne inactive : ignorés', (SELECT mentions = '{}' FROM public.cp_comments WHERE body LIKE 'Inconnue%'));
INSERT INTO public.cp_comments (project_id, item_id, body, mentions) VALUES (:'p1'::uuid, NULL, 'Aucun nom ici', ARRAY[:'anne'::uuid, :'bruno'::uuid]);
SELECT zz.check('15 le client ne peut pas forger la liste : sans nom dans le texte, elle est vidée', (SELECT mentions = '{}' FROM public.cp_comments WHERE body = 'Aucun nom ici'));
INSERT INTO public.cp_comments (project_id, item_id, body) SELECT :'p1'::uuid, NULL, string_agg('@Mass ' || lpad(n::text, 2, '0'), ' ' ORDER BY n) FROM generate_series(1, 22) n;
SELECT zz.check('16 22 personnes citées : 20 mentionnées au plus', (SELECT cardinality(mentions) = 20 FROM public.cp_comments WHERE body LIKE '@Mass 01%'));
RESET ROLE;
SELECT zz.check('17 ni l''inconnu, ni l''autre entreprise, ni l''inactive n''ont reçu d''avis', pg_temp.nc(:'eve'::uuid, 'cp_mention') = 0 AND pg_temp.nc(:'dora'::uuid, 'cp_mention') = 0);

-- Choix de la personne : e-mail et push activés, ou rien dans l'application
SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.cp_notification_prefs (user_id, kind, organization_id, in_app, email, push) VALUES (:'martin'::uuid, 'cp_mention', :ORG1::uuid, true, true, true);
INSERT INTO public.cp_notification_prefs (user_id, kind, organization_id, in_app, email, push) VALUES (:'bruno'::uuid, 'cp_mention', :ORG1::uuid, false, true, true);
SELECT set_config('app.org_guard_off', '', false);
SELECT pg_temp.nc(:'martin'::uuid, 'cp_mention') AS martin_before \gset
SELECT pg_temp.nc(:'bruno'::uuid, 'cp_mention') AS bruno_before \gset
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (:'p1'::uuid, NULL, 'Choix : @Anne Dupont-Martin et @Bruno Meier');
RESET ROLE;
SELECT zz.check('18 e-mail et push activés par Martin : l''avis attend l''envoi (non marqué envoyé)', pg_temp.nc(:'martin'::uuid, 'cp_mention') = :martin_before + 1
  AND (SELECT emailed_at IS NULL AND pushed_at IS NULL FROM public.notifications WHERE kind = 'cp_mention' AND recipient_user_id = :'martin'::uuid ORDER BY created_at DESC LIMIT 1));
SELECT zz.check('19 « Dans l''application » désactivé par Bruno : aucun avis du tout', pg_temp.nc(:'bruno'::uuid, 'cp_mention') = :bruno_before);

-- Modification d'un message : seules les personnes NOUVELLEMENT mentionnées sont averties
SELECT pg_temp.nc(:'anne'::uuid, 'cp_mention') AS anne_before \gset
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_comments (project_id, item_id, body) VALUES (:'p1'::uuid, :'t1'::uuid, 'À modifier : @Anne Dupont');
SELECT id AS cid FROM public.cp_comments WHERE body LIKE 'À modifier%' \gset
UPDATE public.cp_comments SET body = 'À modifier : @Anne Dupont et @Anne Dupont-Martin' WHERE id = :'cid'::uuid;
RESET ROLE;
SELECT zz.check('20 modifier pour ajouter Martin : Martin averti, Anne PAS une seconde fois', pg_temp.nc(:'anne'::uuid, 'cp_mention') = :anne_before + 1 AND pg_temp.nc(:'martin'::uuid, 'cp_mention') = :martin_before + 2);
SELECT pg_temp.nc(:'martin'::uuid, 'cp_mention') AS martin_mid \gset
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
UPDATE public.cp_comments SET body = 'À modifier : @Anne Dupont seulement' WHERE id = :'cid'::uuid;
UPDATE public.cp_comments SET body = 'À modifier : @Anne Dupont et @Anne Dupont-Martin encore' WHERE id = :'cid'::uuid;
RESET ROLE;
SELECT zz.check('21 retirer puis remettre Martin : pas de second avis (anti-doublon par message)', pg_temp.nc(:'martin'::uuid, 'cp_mention') = :martin_mid);
SELECT zz.check('22 le message garde ses personnes mentionnées à jour', (SELECT mentions @> ARRAY[:'anne'::uuid, :'martin'::uuid] AND cardinality(mentions) = 2 FROM public.cp_comments WHERE id = :'cid'::uuid));

-- Restauration d'une sauvegarde : aucun avis
SELECT set_config('app.org_guard_off', 'on', false);
SELECT set_config('gomat.restoring', 'on', false);
SELECT pg_temp.nc(:'anne'::uuid, 'cp_mention') AS anne_pre_restore \gset
INSERT INTO public.cp_comments (organization_id, project_id, item_id, author_id, body, mentions) VALUES (:ORG1::uuid, :'p1'::uuid, NULL, :'ua'::uuid, 'Restauré @Anne Dupont', ARRAY[:'anne'::uuid]);
SELECT set_config('gomat.restoring', 'off', false);
SELECT set_config('app.org_guard_off', '', false);
SELECT zz.check('23 pendant une restauration : aucun avis, et la liste restaurée est gardée telle quelle', pg_temp.nc(:'anne'::uuid, 'cp_mention') = :anne_pre_restore AND (SELECT mentions = ARRAY[:'anne'::uuid] FROM public.cp_comments WHERE body = 'Restauré @Anne Dupont'));

-- 2. Récapitulatif quotidien (lundi 1er mars 2027 = jour ouvré ; l'heure d'hiver s'applique : +01)
SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.notifications WHERE kind = 'cp_digest';
INSERT INTO public.cp_items (project_id, kind, name, starts_on, ends_on) VALUES (:'p1'::uuid, 'task', 'D1', '2027-02-26', '2027-03-01');
INSERT INTO public.cp_items (project_id, kind, name, starts_on, ends_on) VALUES (:'p1'::uuid, 'task', 'D2', '2027-02-20', '2027-02-26');
INSERT INTO public.cp_items (project_id, kind, name, starts_on, ends_on, status_id) VALUES (:'p1'::uuid, 'task', 'D3', '2027-02-26', '2027-03-01', (SELECT id FROM public.cp_statuses WHERE family = 'done' AND is_system AND organization_id = :ORG1::uuid LIMIT 1));
INSERT INTO public.cp_items (project_id, kind, name, starts_on, ends_on) VALUES (:'p1'::uuid, 'task', 'D4', '2027-02-26', '2027-03-01');
INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, :'anne'::uuid FROM public.cp_items WHERE name IN ('D1', 'D2', 'D3');
INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, :'bruno'::uuid FROM public.cp_items WHERE name = 'D4';
SELECT set_config('app.org_guard_off', '', false);
-- Un modèle (créé comme le fait l'application) dont une tâche « D1 » est assignée à Anne : elle ne doit pas compter
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT public.cp_save_as_template(:'p1'::uuid, 'Modèle P11') AS tplp \gset
RESET ROLE;
SELECT set_config('app.org_guard_off', 'on', false);
-- La base refuse équipe et assignations dans un modèle : on lève sa garde (drapeau de restauration) le temps de fabriquer une donnée incohérente, pour vérifier que le récapitulatif l'ignore
SELECT set_config('gomat.restoring', 'on', false);
INSERT INTO public.cp_project_members (project_id, user_id, role) VALUES (:'tplp'::uuid, :'anne'::uuid, 'member');
INSERT INTO public.cp_item_members (item_id, user_id) SELECT id, :'anne'::uuid FROM public.cp_items WHERE project_id = :'tplp'::uuid AND name = 'D1';
SELECT set_config('gomat.restoring', 'off', false);
DELETE FROM public.notifications WHERE kind IN ('cp_assigned', 'cp_team_added');
SELECT set_config('app.org_guard_off', '', false);

-- La tâche planifiée n'a aucune identité de personne : on vide celle de l'essai
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public.cp_send_digests('2027-03-01 06:59+01'::timestamptz) AS d_before \gset
SELECT zz.check('24 avant l''heure (6 h 59) : rien', :d_before = 0);
SELECT public.cp_send_digests('2027-03-01 07:10+01'::timestamptz) AS d1 \gset
SELECT zz.check('25 à 7 h 10 un lundi : des récapitulatifs sont créés', :d1 >= 2, :d1::text);
SELECT zz.check('26 Anne : 1 à terminer (D1) et 1 en retard (D2) ; la tâche terminée D3 et la tâche D1 du MODÈLE ne comptent pas', pg_temp.nc(:'anne'::uuid, 'cp_digest') = 1
  AND (SELECT message LIKE '1 à terminer aujourd''hui (« D1 »)%' AND message LIKE '%1 en retard (« D2 »)%' AND message NOT LIKE '%D3%' FROM public.notifications WHERE kind = 'cp_digest' AND recipient_user_id = :'anne'::uuid), (SELECT message FROM public.notifications WHERE kind = 'cp_digest' AND recipient_user_id = :'anne'::uuid));
SELECT zz.check('27 Anne : ses avis non lus de PILOTE sont comptés (mentions, messages)', (SELECT message ~ '[1-9][0-9]* avis PILOTE non lu\(s\)' FROM public.notifications WHERE kind = 'cp_digest' AND recipient_user_id = :'anne'::uuid));
SELECT zz.check('28 Bruno : D4 est son seul élément du jour et il a des avis non lus', (SELECT message LIKE '1 à terminer aujourd''hui (« D4 »)%' FROM public.notifications WHERE kind = 'cp_digest' AND recipient_user_id = :'bruno'::uuid));
SELECT zz.check('29 par défaut le récapitulatif n''est ni envoyé par e-mail ni en push', (SELECT bool_and(emailed_at IS NOT NULL AND pushed_at IS NOT NULL) FROM public.notifications WHERE kind = 'cp_digest'));
SELECT zz.check('30 une personne sans rien à signaler n''en reçoit pas (Dora inactive, Eve autre entreprise)', pg_temp.nc(:'dora'::uuid, 'cp_digest') = 0 AND pg_temp.nc(:'eve'::uuid, 'cp_digest') = 0);
SELECT public.cp_send_digests('2027-03-01 07:50+01'::timestamptz) AS d_again \gset
SELECT zz.check('31 rappelé dans l''heure (la tâche planifiée passe toutes les 5 minutes) : aucun doublon', :d_again = 0 AND pg_temp.nc(:'anne'::uuid, 'cp_digest') = 1);
SELECT public.cp_send_digests('2027-03-01 08:00+01'::timestamptz) AS d_late \gset
SELECT zz.check('32 à 8 h 00 (l''heure est passée) : rien', :d_late = 0);

SELECT zz.check('33 samedi : rien', public.cp_send_digests('2027-03-06 07:10+01'::timestamptz) = 0);
SELECT zz.check('34 dimanche : rien', public.cp_send_digests('2027-03-07 07:10+01'::timestamptz) = 0);
SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.cp_calendar_days (organization_id, day, label, kind) VALUES (:ORG1::uuid, '2027-03-03', 'Fermeture P11', 'closure');
SELECT set_config('app.org_guard_off', '', false);
SELECT public.cp_send_digests('2027-03-03 07:10+01'::timestamptz) AS d_closed \gset
SELECT zz.check('35 jour du calendrier de travail (fermeture, mercredi 3 mars) : aucun récapitulatif pour l''entreprise A', NOT EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'cp_digest' AND dedupe_key LIKE '%:20270303' AND organization_id = :ORG1::uuid));
SELECT public.cp_send_digests('2027-03-02 07:59+01'::timestamptz) AS d_tue \gset
SELECT zz.check('36 mardi 2 mars à 7 h 59 : un nouveau récapitulatif par personne (nouveau jour)', :d_tue >= 2 AND pg_temp.nc(:'anne'::uuid, 'cp_digest') = 2);
SELECT zz.check('37 le récapitulatif de la veille n''est pas compté comme avis non lu', (SELECT message !~ '[0-9]+ avis PILOTE non lu\(s\)' OR (regexp_match(message, '([0-9]+) avis PILOTE non lu'))[1]::int = (SELECT count(*) FROM public.notifications n WHERE n.recipient_user_id = :'anne'::uuid AND n.kind LIKE 'cp\_%' AND n.kind <> 'cp_digest' AND n.read_at IS NULL) FROM public.notifications WHERE kind = 'cp_digest' AND recipient_user_id = :'anne'::uuid ORDER BY created_at DESC LIMIT 1));

-- Heure réglée par l'administrateur
SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.system_settings (organization_id, id, value, description) VALUES (:ORG1::uuid, 'pilote_digest_hour', '9', 'test') ON CONFLICT (organization_id, id) DO UPDATE SET value = '9';
SELECT set_config('app.org_guard_off', '', false);
SELECT zz.check('38 heure réglée sur 9 : rien à 7 h 10 (jeudi 4 mars)', public.cp_send_digests('2027-03-04 07:10+01'::timestamptz) = 0);
SELECT zz.check('39 heure réglée sur 9 : des récapitulatifs à 9 h 30', public.cp_send_digests('2027-03-04 09:30+01'::timestamptz) >= 2);
UPDATE public.system_settings SET value = 'abc' WHERE organization_id = :ORG1::uuid AND id = 'pilote_digest_hour';
SELECT zz.check('40 valeur illisible : retour à 7 h', public.cp_send_digests('2027-03-08 07:10+01'::timestamptz) >= 2);
UPDATE public.system_settings SET value = '24' WHERE organization_id = :ORG1::uuid AND id = 'pilote_digest_hour';
SELECT zz.check('41 valeur hors limites (24) : retour à 7 h', public.cp_send_digests('2027-03-09 07:10+01'::timestamptz) >= 2);
UPDATE public.system_settings SET value = '0' WHERE organization_id = :ORG1::uuid AND id = 'pilote_digest_hour';
SELECT zz.check('42 minuit (0) accepté : récapitulatif à 0 h 10', public.cp_send_digests('2027-03-10 00:10+01'::timestamptz) >= 2);
DELETE FROM public.system_settings WHERE organization_id = :ORG1::uuid AND id = 'pilote_digest_hour';

-- Choix de la personne et modules
SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.cp_notification_prefs (user_id, kind, organization_id, in_app, email, push) VALUES (:'anne'::uuid, 'cp_digest', :ORG1::uuid, false, false, false);
INSERT INTO public.cp_notification_prefs (user_id, kind, organization_id, in_app, email, push) VALUES (:'bruno'::uuid, 'cp_digest', :ORG1::uuid, true, true, false);
SELECT set_config('app.org_guard_off', '', false);
SELECT pg_temp.nc(:'anne'::uuid, 'cp_digest') AS anne_d_before \gset
SELECT public.cp_send_digests('2027-03-11 07:10+01'::timestamptz) AS d_pref \gset
SELECT zz.check('43 Anne a désactivé « dans l''application » : aucun récapitulatif', pg_temp.nc(:'anne'::uuid, 'cp_digest') = :anne_d_before);
SELECT zz.check('44 Bruno a activé l''e-mail : son récapitulatif attend l''envoi', (SELECT emailed_at IS NULL AND pushed_at IS NOT NULL FROM public.notifications WHERE kind = 'cp_digest' AND recipient_user_id = :'bruno'::uuid ORDER BY created_at DESC LIMIT 1));
SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.organization_modules WHERE organization_id = :ORG1::uuid AND module_key = 'cp.projects';
SELECT set_config('app.org_guard_off', '', false);
SELECT pg_temp.nc(:'bruno'::uuid, 'cp_digest') AS b_mod_before \gset
SELECT public.cp_send_digests('2027-03-12 07:10+01'::timestamptz) AS d_mod \gset
SELECT zz.check('45 module PILOTE désactivé pour l''entreprise : aucun récapitulatif', pg_temp.nc(:'bruno'::uuid, 'cp_digest') = :b_mod_before);
INSERT INTO public.organization_modules (organization_id, module_key) VALUES (:ORG1::uuid, 'cp.projects') ON CONFLICT DO NOTHING;

-- Isolation : l'entreprise B reçoit le sien, sans rien de A
SELECT set_config('app.org_guard_off', 'on', false);
INSERT INTO public.cp_projects (organization_id, name, type) VALUES (:ORG2::uuid, 'Projet B P11', 'rd') RETURNING id AS pb \gset
INSERT INTO public.cp_project_members (organization_id, project_id, user_id, role) VALUES (:ORG2::uuid, :'pb'::uuid, :'ub'::uuid, 'lead');
INSERT INTO public.cp_items (organization_id, project_id, kind, name, starts_on, ends_on) VALUES (:ORG2::uuid, :'pb'::uuid, 'task', 'Tâche de B', '2027-03-15', '2027-03-15') RETURNING id AS ib \gset
INSERT INTO public.cp_item_members (organization_id, item_id, user_id) VALUES (:ORG2::uuid, :'ib'::uuid, :'ub'::uuid);
DELETE FROM public.notifications WHERE kind IN ('cp_assigned', 'cp_team_added') AND recipient_user_id = :'ub'::uuid;
SELECT set_config('app.org_guard_off', '', false);
SELECT public.cp_send_digests('2027-03-15 07:10+01'::timestamptz) AS d_iso \gset
SELECT zz.check('46 entreprise B : son récapitulatif ne parle que de ses éléments', (SELECT message LIKE '1 à terminer aujourd''hui (« Tâche de B »)%' AND message NOT LIKE '%D1%' AND message NOT LIKE '%T11%' FROM public.notifications WHERE kind = 'cp_digest' AND recipient_user_id = :'ub'::uuid AND organization_id = :ORG2::uuid), (SELECT message FROM public.notifications WHERE kind = 'cp_digest' AND recipient_user_id = :'ub'::uuid));
-- Fenêtre horaire sur un jour NEUF (sinon la clé anti-doublon masque l'essai) : elle s'ouvre à 7 h 00 pile et se ferme à 8 h 00 pile
SELECT public.cp_send_digests('2027-03-16 08:30+01'::timestamptz) AS w1 \gset
SELECT public.cp_send_digests('2027-03-16 14:00+01'::timestamptz) AS w2 \gset
SELECT public.cp_send_digests('2027-03-16 06:59:59+01'::timestamptz) AS w3 \gset
SELECT zz.check('55 mardi 16 mars à 8 h 30, 14 h 00 et 6 h 59 min 59 s : aucun récapitulatif (la fenêtre n''est pas « toute la journée »)', :w1 = 0 AND :w2 = 0 AND :w3 = 0, :w1 || ',' || :w2 || ',' || :w3);
SELECT public.cp_send_digests('2027-03-16 07:00:00+01'::timestamptz) AS w4 \gset
SELECT zz.check('56 à 7 h 00 pile : la fenêtre est ouverte', :w4 >= 2, :w4::text);
SELECT public.cp_send_digests('2027-03-17 08:00:00+01'::timestamptz) AS w5 \gset
SELECT zz.check('57 mercredi 17 mars à 8 h 00 pile : fermée', :w5 = 0, :w5::text);
SELECT zz.check('47 la tâche planifiée (check_cp_deadlines) continue de fonctionner', public.check_cp_deadlines() >= 0);

-- Droits d'exécution : seules les tâches planifiées appellent ces fonctions
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('48 un utilisateur ne déclenche pas le récapitulatif', zz.raises($$SELECT public.cp_send_digests()$$) IS NOT NULL);
SELECT zz.check('49 un utilisateur n''active pas le temps réel', zz.raises($$SELECT public.cp_enable_realtime()$$) IS NOT NULL);
SELECT zz.check('50 un utilisateur ne fabrique pas d''avis de mention', zz.raises($$SELECT public.cp_notify_mentions()$$) IS NOT NULL);
RESET ROLE;

-- 3. Temps réel : sans publication, rien ; avec, les 6 tables, une seule fois
SELECT zz.check('51 sans publication « supabase_realtime » : aucun effet, aucune erreur', public.cp_enable_realtime() = CASE WHEN EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN public.cp_enable_realtime() ELSE 0 END);
SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AS had_pub \gset
\if :had_pub
\else
CREATE PUBLICATION supabase_realtime;
\endif
SELECT public.cp_enable_realtime() AS rt1 \gset
SELECT zz.check('52 avec la publication : les tables PILOTE y sont (cp_comments, cp_items, cp_projects, cp_item_members, cp_project_members, cp_item_resources)', (SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename IN ('cp_comments', 'cp_items', 'cp_projects', 'cp_item_members', 'cp_project_members', 'cp_item_resources')) = 6);
SELECT zz.check('53 rappelée : rien de plus (idempotente)', public.cp_enable_realtime() = 0);
SELECT zz.check('54 aucune table sensible dans la publication (budget, taux, notifications)', NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('cp_budget_lines', 'cp_user_rates', 'notifications', 'users')));
\if :had_pub
\else
DROP PUBLICATION supabase_realtime;
\endif

-- Nettoyage
SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.notifications; DELETE FROM public.cp_comments; DELETE FROM public.cp_item_members; DELETE FROM public.cp_items; DELETE FROM public.cp_project_members; DELETE FROM public.cp_projects;
DELETE FROM public.cp_notification_prefs; DELETE FROM public.cp_calendar_days WHERE label = 'Fermeture P11';
DELETE FROM public.users WHERE email LIKE '%@p11.test';
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name || COALESCE(' — ' || detail, '') AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
