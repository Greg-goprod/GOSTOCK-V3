-- Notifications PILOTE (migration 53) : avis produits, regroupement, choix par personne, rappels, droits. À lancer dans l'ordre de run.sh (après isolation.sql et rbac.sql).
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

CREATE FUNCTION pg_temp.mk(p_project text, p_name text, p_kind text, p_parent text, p_from date, p_to date) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.cp_items (project_id, parent_id, kind, name, starts_on, ends_on)
  VALUES ((SELECT id FROM public.cp_projects WHERE name = p_project), (SELECT id FROM public.cp_items WHERE name = p_parent), p_kind, p_name, p_from, p_to);
END $$;
CREATE FUNCTION pg_temp.asg(p_item text, p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.cp_item_members (item_id, user_id) VALUES ((SELECT id FROM public.cp_items WHERE name = p_item), p_user);
END $$;
CREATE FUNCTION pg_temp.nn(p_kind text, p_user uuid) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT count(*)::integer FROM public.notifications WHERE kind = p_kind AND recipient_user_id = p_user $$;
GRANT EXECUTE ON FUNCTION pg_temp.mk(text, text, text, text, date, date), pg_temp.asg(text, uuid), pg_temp.nn(text, uuid) TO authenticated;

-- 1. Équipe : on avertit la personne ajoutée, jamais celle qui agit
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_projects (name, type) VALUES ('N1', 'rd'), ('N2', 'admin');
INSERT INTO public.cp_project_members (project_id, user_id, role) SELECT id, :'ua'::uuid, 'lead' FROM public.cp_projects WHERE name IN ('N1', 'N2');
INSERT INTO public.cp_project_members (project_id, user_id, role) SELECT id, :'uu'::uuid, 'member' FROM public.cp_projects WHERE name = 'N1';
INSERT INTO public.cp_project_members (project_id, user_id, role) SELECT id, :'uu'::uuid, 'lead' FROM public.cp_projects WHERE name = 'N2';
RESET ROLE;
SELECT zz.check('ajouté à une équipe : un avis par projet pour la personne ajoutée', pg_temp.nn('cp_team_added', :'uu'::uuid) = 2);
SELECT zz.check('celui qui ajoute n''est pas averti de s''être ajouté lui-même', pg_temp.nn('cp_team_added', :'ua'::uuid) = 0);
SELECT zz.check('l''avis dit le projet et le rôle', EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'cp_team_added' AND message LIKE '%« N1 »%membre%') AND EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'cp_team_added' AND message LIKE '%« N2 »%responsable%'));
SELECT zz.check('l''avis pointe le projet', (SELECT count(*) FROM public.notifications n JOIN public.cp_projects p ON p.id = n.cp_project_id WHERE n.kind = 'cp_team_added' AND n.recipient_user_id = :'uu'::uuid) = 2);

-- 2. Assignation
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT pg_temp.mk('N1', 'Ph', 'phase', NULL, '2027-03-01', '2027-03-31');
SELECT pg_temp.mk('N1', 'T1', 'task', 'Ph', '2027-03-02', '2027-03-05');
SELECT pg_temp.mk('N1', 'T2', 'task', 'Ph', '2027-03-08', '2027-03-12');
SELECT pg_temp.mk('N1', 'T3', 'task', 'Ph', '2027-03-15', '2027-03-19');
SELECT pg_temp.asg('T1', :'uu'::uuid);
SELECT pg_temp.asg('T2', :'uu'::uuid);
SELECT pg_temp.asg('T1', :'ua'::uuid);
RESET ROLE;
SELECT zz.check('assignée à quelqu''un : un avis par assignation', pg_temp.nn('cp_assigned', :'uu'::uuid) = 2);
SELECT zz.check('s''assigner soi-même ne produit aucun avis', pg_temp.nn('cp_assigned', :'ua'::uuid) = 0);
SELECT zz.check('l''avis nomme la tâche, le projet et l''échéance, et pointe l''élément', EXISTS (
  SELECT 1 FROM public.notifications n JOIN public.cp_items i ON i.id = n.cp_item_id
  WHERE n.kind = 'cp_assigned' AND n.recipient_user_id = :'uu'::uuid AND i.name = 'T1' AND n.cp_project_id = i.project_id
    AND n.message LIKE '%la tâche « T1 »%' AND n.message LIKE '%projet « N1 »%' AND n.message LIKE '%à terminer le 05.03.2027%'));
SELECT zz.check('l''avis est destiné à la personne seule (pas à tout le magasin)', (SELECT bool_and(recipient_user_id IS NOT NULL) FROM public.notifications WHERE kind LIKE 'cp\_%'));

-- 3. Dates modifiées : regroupées
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'Ph'), 7) AS n1 \gset
RESET ROLE;
SELECT zz.check('décaler une phase de 3 tâches (2 assignées à U) : UN seul avis pour U', pg_temp.nn('cp_dates_changed', :'uu'::uuid) = 1
  AND (SELECT message FROM public.notifications WHERE kind = 'cp_dates_changed' AND recipient_user_id = :'uu'::uuid) LIKE '%pour 2 de tes éléments%');
SELECT zz.check('celui qui décale n''est pas averti de ses propres changements', pg_temp.nn('cp_dates_changed', :'ua'::uuid) = 0);
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT public.cp_shift_item((SELECT id FROM public.cp_items WHERE name = 'Ph'), 1) AS n2 \gset
RESET ROLE;
SELECT zz.check('un 2e décalage dans les 10 minutes est regroupé dans le même avis', pg_temp.nn('cp_dates_changed', :'uu'::uuid) = 1
  AND (SELECT message FROM public.notifications WHERE kind = 'cp_dates_changed' AND recipient_user_id = :'uu'::uuid) LIKE '%plusieurs de tes éléments%');
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
UPDATE public.cp_items SET name = 'T1 renommée' WHERE name = 'T1';
UPDATE public.cp_items SET description = 'x' WHERE name = 'T2';
UPDATE public.cp_items SET starts_on = '2027-04-01', ends_on = '2027-04-02' WHERE name = 'T3';
RESET ROLE;
SELECT zz.check('renommer / décrire ne produit rien ; changer les dates d''un élément NON assigné non plus', pg_temp.nn('cp_dates_changed', :'uu'::uuid) = 1);
UPDATE public.cp_items SET name = 'T1' WHERE name = 'T1 renommée';

-- Un seul élément concerné : message précis
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT pg_temp.mk('N2', 'T4', 'task', NULL, '2027-03-01', '2027-03-05');
SELECT pg_temp.asg('T4', :'uu'::uuid);
UPDATE public.cp_items SET starts_on = '2027-03-08', ends_on = '2027-03-12' WHERE name = 'T4';
RESET ROLE;
SELECT zz.check('un seul élément qui change : l''avis donne les nouvelles dates', EXISTS (
  SELECT 1 FROM public.notifications n JOIN public.cp_items i ON i.id = n.cp_item_id
  WHERE n.kind = 'cp_dates_changed' AND n.recipient_user_id = :'uu'::uuid AND i.name = 'T4' AND n.message LIKE '%a changé les dates de « T4 »%du 08.03.2027 au 12.03.2027%'));
SELECT zz.check('N1 et N2 ont chacun leur avis de dates (un par projet)', pg_temp.nn('cp_dates_changed', :'uu'::uuid) = 2);

-- 4. Choix par personne : « dans l'application » désactivé = aucun avis ; e-mail / push désactivés = avis déjà marqués envoyés
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
INSERT INTO public.cp_notification_prefs (kind, in_app, email, push) VALUES ('cp_assigned', false, true, true);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT pg_temp.mk('N1', 'T5', 'task', 'Ph', NULL, NULL);
SELECT pg_temp.asg('T5', :'uu'::uuid);
RESET ROLE;
SELECT zz.check('« dans l''application » désactivé : aucun avis créé', pg_temp.nn('cp_assigned', :'uu'::uuid) = 3);
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
UPDATE public.cp_notification_prefs SET in_app = true, email = false, push = false WHERE kind = 'cp_assigned';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT pg_temp.mk('N1', 'T6', 'task', 'Ph', NULL, NULL);
SELECT pg_temp.asg('T6', :'uu'::uuid);
RESET ROLE;
SELECT zz.check('e-mail et push désactivés : l''avis existe mais est déjà marqué envoyé', EXISTS (
  SELECT 1 FROM public.notifications n JOIN public.cp_items i ON i.id = n.cp_item_id
  WHERE n.kind = 'cp_assigned' AND i.name = 'T6' AND n.emailed_at IS NOT NULL AND n.pushed_at IS NOT NULL));
SELECT zz.check('canaux par défaut : en attente d''envoi (e-mail et push)', EXISTS (
  SELECT 1 FROM public.notifications n JOIN public.cp_items i ON i.id = n.cp_item_id
  WHERE n.kind = 'cp_assigned' AND i.name = 'T1' AND n.emailed_at IS NULL AND n.pushed_at IS NULL));
SELECT zz.check('« dates modifiées » : pas d''e-mail par défaut, push oui', EXISTS (
  SELECT 1 FROM public.notifications WHERE kind = 'cp_dates_changed' AND recipient_user_id = :'uu'::uuid AND emailed_at IS NOT NULL AND pushed_at IS NULL));
-- La file d'e-mails existante ne prend pas l'avis sans e-mail
SELECT id AS id_sans_mail FROM public.notifications n WHERE kind = 'cp_assigned' AND emailed_at IS NOT NULL AND recipient_user_id = :'uu'::uuid LIMIT 1 \gset
SELECT id AS id_avec_mail FROM public.notifications n WHERE kind = 'cp_assigned' AND emailed_at IS NULL AND recipient_user_id = :'uu'::uuid LIMIT 1 \gset
SELECT set_config('request.jwt.claim.sub', '', false);
CREATE TEMP TABLE claimed AS SELECT * FROM public.claim_notification_emails(500);
SELECT zz.check('la file d''e-mails existante ne réserve pas l''avis dont l''e-mail est désactivé, et réserve les autres', NOT EXISTS (SELECT 1 FROM claimed WHERE id = :'id_sans_mail'::uuid) AND EXISTS (SELECT 1 FROM claimed WHERE id = :'id_avec_mail'::uuid));
SELECT zz.check('l''avis par e-mail a bien pour destinataire l''adresse de la personne', (SELECT recipients FROM claimed WHERE id = :'id_avec_mail'::uuid) = ARRAY['u@iso.test']);

-- 5. Rappels quotidiens
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT pg_temp.mk('N1', 'D-aujourdhui', 'task', NULL, (now() AT TIME ZONE 'Europe/Zurich')::date - 2, (now() AT TIME ZONE 'Europe/Zurich')::date);
SELECT pg_temp.mk('N1', 'D-demain', 'task', NULL, (now() AT TIME ZONE 'Europe/Zurich')::date, (now() AT TIME ZONE 'Europe/Zurich')::date + 1);
SELECT pg_temp.mk('N1', 'D-hier', 'task', NULL, (now() AT TIME ZONE 'Europe/Zurich')::date - 5, (now() AT TIME ZONE 'Europe/Zurich')::date - 1);
SELECT pg_temp.mk('N1', 'D-trop-ancien', 'task', NULL, (now() AT TIME ZONE 'Europe/Zurich')::date - 20, (now() AT TIME ZONE 'Europe/Zurich')::date - 10);
SELECT pg_temp.mk('N1', 'D-loin', 'task', NULL, (now() AT TIME ZONE 'Europe/Zurich')::date, (now() AT TIME ZONE 'Europe/Zurich')::date + 10);
SELECT pg_temp.mk('N1', 'D-fini', 'task', NULL, (now() AT TIME ZONE 'Europe/Zurich')::date - 2, (now() AT TIME ZONE 'Europe/Zurich')::date);
SELECT pg_temp.mk('N1', 'D-annule', 'task', NULL, (now() AT TIME ZONE 'Europe/Zurich')::date - 2, (now() AT TIME ZONE 'Europe/Zurich')::date + 1);
SELECT pg_temp.mk('N1', 'D-sans-date', 'task', NULL, NULL, NULL);
UPDATE public.cp_items SET status_id = (SELECT id FROM public.cp_statuses WHERE is_system AND family = 'done' AND organization_id = :ORG1::uuid) WHERE name = 'D-fini';
UPDATE public.cp_items SET status_id = (SELECT id FROM public.cp_statuses WHERE is_system AND family = 'cancelled' AND organization_id = :ORG1::uuid) WHERE name = 'D-annule';
SELECT pg_temp.asg(x, :'uu'::uuid) FROM unnest(ARRAY['D-aujourdhui', 'D-demain', 'D-hier', 'D-trop-ancien', 'D-loin', 'D-fini', 'D-annule', 'D-sans-date']) x;
SELECT zz.check('un utilisateur ne peut pas lancer le contrôle des échéances', zz.raises($$SELECT public.check_cp_deadlines()$$) IS NOT NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public.check_cp_deadlines() AS n_dl \gset
SELECT zz.check('le contrôle crée un avis « échéance proche » et un avis « en retard » pour U', :n_dl::int = 2 AND pg_temp.nn('cp_due_soon', :'uu'::uuid) = 1 AND pg_temp.nn('cp_overdue', :'uu'::uuid) = 1);
SELECT zz.check('échéance proche : aujourd''hui et demain, ni les éléments finis / annulés, ni lointains, ni sans date', (
  SELECT message FROM public.notifications WHERE kind = 'cp_due_soon' AND recipient_user_id = :'uu'::uuid) LIKE '%« D-aujourdhui » (aujourd''hui)%'
  AND (SELECT message FROM public.notifications WHERE kind = 'cp_due_soon' AND recipient_user_id = :'uu'::uuid) LIKE '%« D-demain » (demain)%'
  AND (SELECT message FROM public.notifications WHERE kind = 'cp_due_soon' AND recipient_user_id = :'uu'::uuid) NOT SIMILAR TO '%(D-fini|D-annule|D-loin|D-sans-date|D-hier)%');
SELECT zz.check('en retard : hier oui, il y a plus de 3 jours non, ni terminés', (
  SELECT message FROM public.notifications WHERE kind = 'cp_overdue' AND recipient_user_id = :'uu'::uuid) LIKE '%« D-hier » (prévu le %'
  AND (SELECT message FROM public.notifications WHERE kind = 'cp_overdue' AND recipient_user_id = :'uu'::uuid) NOT SIMILAR TO '%(D-trop-ancien|D-fini|D-annule|D-aujourdhui)%');
SELECT public.check_cp_deadlines() AS n_dl2 \gset
SELECT zz.check('rappeler le contrôle le même jour ne double rien', :n_dl2::int = 0 AND pg_temp.nn('cp_due_soon', :'uu'::uuid) = 1 AND pg_temp.nn('cp_overdue', :'uu'::uuid) = 1);
UPDATE public.users SET active = false WHERE id = :'uu'::uuid;
DELETE FROM public.notifications WHERE kind IN ('cp_due_soon', 'cp_overdue');
SELECT public.check_cp_deadlines() AS n_dl3 \gset
SELECT zz.check('une personne désactivée n''est pas avertie', :n_dl3::int = 0);
UPDATE public.users SET active = true WHERE id = :'uu'::uuid;

-- 6. Visibilité : chacun voit ses avis, pas ceux des autres ; la pastille compte
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U voit ses avis PILOTE dans la liste', (SELECT count(*) FROM public.my_notifications(500) WHERE kind LIKE 'cp\_%') >= 6);
SELECT count(*) AS unread_u FROM public.my_notifications(500) WHERE kind LIKE 'cp\_%' AND NOT is_read \gset
SELECT zz.check('la pastille compte ces avis non lus', public.unread_notification_count() >= :unread_u::int);
SELECT public.mark_all_notifications_read() AS marked \gset
SELECT zz.check('« tout marquer comme lu » vaut pour U', (SELECT count(*) FROM public.my_notifications(500) WHERE kind LIKE 'cp\_%' AND NOT is_read) = 0);
SELECT zz.check('U ne lit, dans la table des avis, que ceux qui le concernent', (SELECT count(*) FROM public.notifications WHERE recipient_user_id IS NOT NULL AND recipient_user_id <> :'uu'::uuid) = 0 AND (SELECT count(*) FROM public.notifications WHERE recipient_user_id = :'uu'::uuid) > 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
-- NB : la règle d'accès existante de la table (notifications_open_access, antérieure à PILOTE) laisse le personnel (view_all / scan / approve / manage_stock)
-- LIRE directement toute la table de son entreprise, avis personnels compris ; l'application, elle, passe par my_notifications() qui filtre. On vérifie ce que l'application voit.
SELECT zz.check('A (responsable de ces projets) ne voit, dans l''application (my_notifications), aucun des avis PILOTE adressés à U', (SELECT count(*) FROM public.my_notifications(500) WHERE kind LIKE 'cp\_%') = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B (autre entreprise) ne voit aucun avis PILOTE', (SELECT count(*) FROM public.my_notifications(500) WHERE kind LIKE 'cp\_%') = 0);
SELECT zz.check('B ne lit pas les avis de A dans la table', (SELECT count(*) FROM public.notifications WHERE kind LIKE 'cp\_%') = 0);
RESET ROLE;

-- 7. Droits de fonctions
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('personne ne crée un avis à la main', zz.raises(format('SELECT public.cp_notify(%L, ''cp_assigned'', ''x'', ''y'', NULL, NULL)', :'uu')) IS NOT NULL);
SELECT zz.check('les fonctions de déclenchement ne sont pas appelables', zz.raises('SELECT public.cp_notify_dates_changed()') IS NOT NULL AND zz.raises('SELECT public.cp_notify_assigned()') IS NOT NULL);
RESET ROLE;

-- 8. Choix : chacun les siens, types connus seulement
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U relit ses choix avec les valeurs par défaut pour le reste (5 types, dont le sien)', (SELECT count(*) FROM public.my_cp_notification_prefs()) = 5
  AND (SELECT NOT email AND NOT push AND in_app FROM public.my_cp_notification_prefs() WHERE kind = 'cp_assigned')
  AND (SELECT in_app AND email AND push FROM public.my_cp_notification_prefs() WHERE kind = 'cp_due_soon')
  AND (SELECT in_app AND NOT email AND push FROM public.my_cp_notification_prefs() WHERE kind = 'cp_dates_changed'));
SELECT zz.check('type d''avis inconnu refusé', zz.raises($$INSERT INTO public.cp_notification_prefs (kind) VALUES ('cp_autre')$$) IS NOT NULL);
SELECT zz.check('U ne choisit pas pour quelqu''un d''autre', zz.raises(format('INSERT INTO public.cp_notification_prefs (user_id, kind, in_app) VALUES (%L, ''cp_overdue'', false)', :'ua')) IS NOT NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A ne voit pas les choix de U', (SELECT count(*) FROM public.cp_notification_prefs) = 0 AND zz.affected($$DELETE FROM public.cp_notification_prefs$$) = 0);
RESET ROLE;

-- 9. Restauration : aucun avis ; suppression d'un projet : ses avis disparaissent
SELECT set_config('request.jwt.claim.sub', '', false);
INSERT INTO public.cp_projects (name, type) VALUES ('N3', 'admin');
SELECT count(*) AS avant_restau FROM public.notifications \gset
SELECT set_config('gomat.restoring', 'on', false);
INSERT INTO public.cp_item_members (item_id, user_id, organization_id) SELECT id, :'uu'::uuid, organization_id FROM public.cp_items WHERE name = 'T3';
INSERT INTO public.cp_project_members (project_id, user_id, role, organization_id) SELECT id, :'uu'::uuid, 'member', organization_id FROM public.cp_projects WHERE name = 'N3';
UPDATE public.cp_items SET starts_on = starts_on + 1, ends_on = ends_on + 1 WHERE name IN ('T1', 'T2');
SELECT set_config('gomat.restoring', '', false);
SELECT zz.check('pendant une restauration : aucun avis créé', (SELECT count(*) FROM public.notifications) = :avant_restau::int);
SELECT count(*) AS n_n2 FROM public.notifications WHERE cp_project_id = (SELECT id FROM public.cp_projects WHERE name = 'N2') \gset
SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.cp_projects WHERE name = 'N2';
SELECT set_config('app.org_guard_off', '', false);
SELECT zz.check('supprimer le projet supprime ses avis (il y en avait ' || :n_n2 || ')', :n_n2::int > 0 AND (SELECT count(*) FROM public.notifications WHERE cp_project_id IS NOT NULL AND cp_project_id NOT IN (SELECT id FROM public.cp_projects)) = 0);

SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.cp_projects WHERE name LIKE 'N%';
DELETE FROM public.notifications WHERE kind LIKE 'cp\_%';
DELETE FROM public.cp_notification_prefs;
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
