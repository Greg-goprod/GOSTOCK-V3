-- Batterie d'isolation multi-entreprise (module 0).
-- À lancer sur une base LOCALE reconstruite avec toutes les migrations : jamais sur GO-MAT.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/isolation.sql
-- Le script termine par la liste des échecs ; une ligne « ECHEC » = un défaut d'isolation ou de droits.

\set ON_ERROR_STOP on
\set A '''a0000000-0000-0000-0000-00000000000a'''
\set B '''b0000000-0000-0000-0000-00000000000b'''
\set C '''c0000000-0000-0000-0000-00000000000c'''
\set P '''f0000000-0000-0000-0000-00000000000f'''
\set U '''d0000000-0000-0000-0000-00000000000d'''

RESET ROLE;
DROP SCHEMA IF EXISTS zz CASCADE;
CREATE SCHEMA zz;
CREATE TABLE zz.results (n serial, name text, ok boolean, detail text);
GRANT USAGE ON SCHEMA zz TO authenticated;
CREATE FUNCTION zz.check(p_name text, p_ok boolean, p_detail text DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$ INSERT INTO zz.results (name, ok, detail) VALUES (p_name, COALESCE(p_ok, false), p_detail) $$;
CREATE FUNCTION zz.raises(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE p_sql; RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM; END $$;
CREATE FUNCTION zz.count(p_sql text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer; BEGIN EXECUTE 'SELECT count(*) FROM (' || p_sql || ') s' INTO n; RETURN n; END $$;
CREATE FUNCTION zz.affected(p_sql text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer; BEGIN EXECUTE p_sql; GET DIAGNOSTICS n = ROW_COUNT; RETURN n; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO authenticated;

-- Jeu d'essai --------------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  (:A, 'a@iso.test'), (:B, 'b@iso.test'), (:C, 'c@iso.test'), (:P, 'p@iso.test'), (:U, 'u@iso.test');
INSERT INTO public.platform_admins (auth_user_id) VALUES (:P);
-- Entreprise 1 (historique) : A admin, C technicien, U simple utilisateur
INSERT INTO public.users (email, first_name, last_name, role) VALUES
  ('a@iso.test', 'Alice', 'Un', 'admin'),
  ('c@iso.test', 'Carole', 'Deux', 'technician'),
  ('u@iso.test', 'Ugo', 'Simple', 'user'),
  ('p@iso.test', 'Paul', 'Plateforme', 'user');
-- Entreprise 2 : créée par l'administrateur de plateforme
SELECT set_config('request.jwt.claim.sub', :P, false);
SET ROLE authenticated;
SELECT zz.check('plateforme : connexion', public.whoami() IS NOT NULL);
SELECT zz.check('plateforme : crée une entreprise', public.platform_create_organization('Entreprise B', 'b@iso.test', 'Bob', 'Deux') IS NOT NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
INSERT INTO public.users (organization_id, email, first_name, last_name, role)
SELECT o.id, 'c@iso.test', 'Carole', 'Deux', 'manager' FROM public.organizations o WHERE o.name = 'Entreprise B';
SELECT o.id AS org2 FROM public.organizations o WHERE o.name = 'Entreprise B' \gset
\set ORG1 '''00000000-0000-0000-0000-000000000001'''
\set ORG2 '''':org2''''

INSERT INTO public.equipment (organization_id, name, status, total_quantity, available_quantity) VALUES
  (:ORG1, 'ISO Perceuse A', 'available', 1, 1), (:ORG2, 'ISO Perceuse B', 'available', 1, 1);
INSERT INTO public.depots (organization_id, name) VALUES (:ORG2, 'Dépôt B2');

-- 1. Connexion et entreprise active ----------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A : whoami (liaison par e-mail)', (public.whoami() ->> 'role') = 'admin');
SELECT zz.check('A : entreprise active = historique', public.app_org_id() = :ORG1::uuid);
SELECT zz.check('A : une seule entreprise', jsonb_array_length(public.whoami() -> 'organizations') = 1);
SELECT zz.check('A : ne passe pas dans l''entreprise 2', zz.raises(format('SELECT public.switch_organization(%L)', :ORG2)) IS NOT NULL);
SELECT zz.check('A : pas administrateur de plateforme', NOT public.is_platform_admin());
SELECT zz.check('A : ne crée pas d''entreprise', zz.raises($$SELECT public.platform_create_organization('Pirate','x@y.test','X','Y')$$) IS NOT NULL);
SELECT zz.check('A : ne liste pas les entreprises de la plateforme', zz.raises('SELECT * FROM public.platform_list_organizations()') IS NOT NULL);

-- 2. Lecture isolée --------------------------------------------------------------------------
SELECT zz.check('A voit son matériel', zz.count($$SELECT 1 FROM public.equipment WHERE name = 'ISO Perceuse A'$$) = 1);
SELECT zz.check('A ne voit pas le matériel de B', zz.count($$SELECT 1 FROM public.equipment WHERE name = 'ISO Perceuse B'$$) = 0);
SELECT zz.check('A ne voit que son dépôt', zz.count($$SELECT 1 FROM public.depots WHERE name = 'Dépôt B2'$$) = 0);
SELECT zz.check('A ne voit pas les personnes de B', zz.count($$SELECT 1 FROM public.users WHERE email = 'b@iso.test'$$) = 0);
SELECT zz.check('A ne voit que son entreprise', zz.count('SELECT 1 FROM public.organizations') = 1);
SELECT zz.check('A : annuaire sans personnes de B', zz.count($$SELECT 1 FROM public.people_directory() WHERE last_name = 'Deux' AND first_name = 'Bob'$$) = 0);
SELECT zz.check('A : réglages = ceux de son entreprise', (SELECT count(DISTINCT organization_id) FROM public.system_settings) = 1);
SELECT zz.check('A : les vues respectent l''isolation', zz.count($$SELECT 1 FROM public.equipment_status_view WHERE name = 'ISO Perceuse B'$$) = 0);

-- 3. Écriture isolée -------------------------------------------------------------------------
SELECT zz.check('A ne modifie pas le matériel de B', zz.affected($$UPDATE public.equipment SET name = 'piraté' WHERE name = 'ISO Perceuse B'$$) = 0);
SELECT zz.check('A ne supprime pas le matériel de B', zz.affected($$DELETE FROM public.equipment WHERE name = 'ISO Perceuse B'$$) = 0);
SELECT zz.check('A ne crée pas de ligne dans l''entreprise 2', zz.raises(format($f$INSERT INTO public.equipment (organization_id, name, status, total_quantity, available_quantity) VALUES (%L, 'ISO injecté', 'available', 1, 1)$f$, :ORG2)) IS NOT NULL);
SELECT zz.check('A ne déplace pas sa ligne vers l''entreprise 2', zz.raises(format($f$UPDATE public.equipment SET organization_id = %L WHERE name = 'ISO Perceuse A'$f$, :ORG2)) IS NOT NULL);
INSERT INTO public.equipment (name, status, total_quantity, available_quantity) VALUES ('ISO Défaut A', 'available', 1, 1);
SELECT zz.check('A : ligne créée sans entreprise = la sienne', (SELECT organization_id FROM public.equipment WHERE name = 'ISO Défaut A') = :ORG1::uuid);
SELECT zz.check('A : numéro d''article de sa série', (SELECT article_number FROM public.equipment WHERE name = 'ISO Défaut A') LIKE 'GOMAT1-%');
SELECT zz.check('A ne renomme pas l''entreprise 2', zz.affected(format('UPDATE public.organizations SET name = ''x'' WHERE id = %L', :ORG2)) = 0);
SELECT zz.check('A renomme la sienne', zz.affected(format('UPDATE public.organizations SET name = name WHERE id = %L', :ORG1)) = 1);
UPDATE public.organizations SET article_series = 'PIRATE', active = false WHERE id = :ORG1;
SELECT zz.check('A ne change ni la série d''articles ni l''état de son entreprise', (SELECT article_series = 'GOMAT1' AND active FROM public.organizations WHERE id = :ORG1));
RESET ROLE;

-- 4. Entreprise 2 : même exigences, vue miroir -------------------------------------------------
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B : whoami', (public.whoami() ->> 'role') = 'admin');
SELECT zz.check('B : entreprise active = la sienne', public.app_org_id() = :ORG2::uuid);
SELECT zz.check('B voit son matériel et pas celui de A', zz.count($$SELECT 1 FROM public.equipment WHERE name = 'ISO Perceuse B'$$) = 1 AND zz.count($$SELECT 1 FROM public.equipment WHERE name LIKE 'ISO % A'$$) = 0);
SELECT zz.check('B : numéro d''article de sa série', (public.next_article_number()) LIKE 'GM0002-%');
SELECT zz.check('B ne modifie pas le matériel de A', zz.affected($$UPDATE public.equipment SET name = 'piraté' WHERE name = 'ISO Perceuse A'$$) = 0);
RESET ROLE;

-- 5. Un compte dans deux entreprises ---------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', :C, false); SET ROLE authenticated;
SELECT zz.check('C : whoami liste deux entreprises', jsonb_array_length(public.whoami() -> 'organizations') = 2);
SELECT zz.check('C : entreprise active par défaut = la plus ancienne', public.app_org_id() = :ORG1::uuid);
SELECT zz.check('C : technicien dans l''entreprise 1', public.app_has('manage_stock') AND NOT public.app_has('approve'));
SELECT zz.check('C voit le matériel de A, pas celui de B', zz.count($$SELECT 1 FROM public.equipment WHERE name = 'ISO Perceuse A'$$) = 1 AND zz.count($$SELECT 1 FROM public.equipment WHERE name = 'ISO Perceuse B'$$) = 0);
SELECT public.switch_organization(:ORG2::uuid);
SELECT zz.check('C : après changement, entreprise 2 active', public.app_org_id() = :ORG2::uuid);
SELECT zz.check('C : responsable dans l''entreprise 2 (droits propres)', public.app_has('approve'));
SELECT zz.check('C voit le matériel de B, plus celui de A', zz.count($$SELECT 1 FROM public.equipment WHERE name = 'ISO Perceuse B'$$) = 1 AND zz.count($$SELECT 1 FROM public.equipment WHERE name = 'ISO Perceuse A'$$) = 0);
SELECT zz.check('C : ligne créée = entreprise 2', (SELECT organization_id FROM (SELECT public.new_row_org_id() AS organization_id) q) = :ORG2::uuid);
SELECT public.switch_organization(:ORG1::uuid);
SELECT zz.check('C : retour à l''entreprise 1', public.app_org_id() = :ORG1::uuid);
RESET ROLE;

-- 6. Entreprise désactivée ---------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', :P, false); SET ROLE authenticated;
SELECT zz.check('plateforme : liste les entreprises', zz.count('SELECT * FROM public.platform_list_organizations()') >= 2);
SELECT public.platform_set_organization_active(:ORG2::uuid, false);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B : entreprise désactivée = plus d''accès', public.app_org_id() IS NULL AND public.whoami() IS NULL);
SELECT zz.check('B : ne voit plus rien', zz.count('SELECT 1 FROM public.equipment') = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :C, false); SET ROLE authenticated;
SELECT zz.check('C : retombe sur l''entreprise 1 si la 2 est désactivée', public.app_org_id() = :ORG1::uuid);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :P, false); SET ROLE authenticated;
SELECT public.platform_set_organization_active(:ORG2::uuid, true);
RESET ROLE;

-- 7. Personnes : e-mail par entreprise, dernier administrateur par entreprise -------------------
SELECT zz.check('même e-mail dans deux entreprises : possible (C)', (SELECT count(*) FROM public.users WHERE email = 'c@iso.test') = 2);
SELECT zz.check('même e-mail deux fois dans une entreprise : refusé', zz.raises(format($f$INSERT INTO public.users (organization_id, email, first_name, last_name, role) VALUES (%L, 'C@ISO.TEST', 'x', 'y', 'user')$f$, :ORG1)) IS NOT NULL);
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B : le dernier administrateur de l''entreprise 2 est protégé', zz.raises($$UPDATE public.users SET active = false WHERE email = 'b@iso.test'$$) IS NOT NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A : l''administrateur de B n''est pas modifiable', zz.affected($$UPDATE public.users SET active = false WHERE email = 'b@iso.test'$$) = 0);
RESET ROLE;
SELECT zz.check('le dernier administrateur de B ne dépend pas de A', (SELECT count(*) FROM public.users WHERE role = 'admin' AND active AND organization_id = :ORG2::uuid) = 1);

-- 8. Collaborateur simple : pas d'élévation de droits ---------------------------------------------
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U : simple utilisateur sans droit de personnel', NOT public.app_has('scan') AND NOT public.app_has('manage_people'));
SELECT zz.check('U ne voit que son entreprise', zz.count($$SELECT 1 FROM public.equipment WHERE name = 'ISO Perceuse B'$$) = 0);
SELECT zz.check('U ne fait pas de lui un administrateur de plateforme', zz.raises($$INSERT INTO public.platform_admins (auth_user_id) VALUES (auth.uid())$$) IS NOT NULL);
SELECT zz.check('U ne lit pas platform_admins', zz.raises('SELECT * FROM public.platform_admins') IS NOT NULL);
SELECT zz.check('U ne touche pas account_context', zz.raises($$INSERT INTO public.account_context (auth_user_id, organization_id) VALUES (auth.uid(), '00000000-0000-0000-0000-000000000001')$$) IS NOT NULL);
RESET ROLE;

-- 9. Fonctions SECURITY DEFINER (étape 0.4) ---------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', '', false);
-- Données de l'entreprise 2 : un chantier, un badge, un emprunt en retard
INSERT INTO public.sites (organization_id, name) VALUES (:ORG1, 'ISO Chantier X'), (:ORG2, 'ISO Chantier X');
INSERT INTO public.equipment (organization_id, name, status, total_quantity, available_quantity, article_number) VALUES (:ORG2, 'ISO Marteau B', 'available', 1, 1, 'ISO-MARTEAU-B');
INSERT INTO public.checkouts (organization_id, equipment_id, user_id, due_date, status)
SELECT :ORG2, e.id, u.id, now() - interval '5 days', 'active'
FROM public.equipment e, public.users u WHERE e.name = 'ISO Marteau B' AND u.email = 'b@iso.test' AND u.organization_id = :ORG2::uuid;
SELECT code AS badge_b FROM public.user_badges WHERE user_id = (SELECT id FROM public.users WHERE email = 'b@iso.test') \gset
SELECT id AS checkout_b FROM public.checkouts WHERE organization_id = :ORG2 AND status = 'active' LIMIT 1 \gset
SELECT id AS depot_b FROM public.depots WHERE organization_id = :ORG2 LIMIT 1 \gset
SELECT public.check_due_reminders(), public.check_monthly_report(), public.check_backup_reminder();
SELECT zz.check('tâches planifiées : rappel de retard posé dans l''entreprise de la personne',
  (SELECT count(*) FROM public.notifications WHERE kind IN ('return_overdue', 'return_escalation') AND organization_id = :ORG2::uuid) >= 1
  AND (SELECT count(*) FROM public.notifications WHERE kind IN ('return_overdue', 'return_escalation') AND organization_id = :ORG1::uuid AND message LIKE '%Marteau B%') = 0);
SELECT zz.check('rapport mensuel et rappel de sauvegarde : un par entreprise',
  (SELECT count(DISTINCT organization_id) FROM public.notifications WHERE kind = 'monthly_report') = 2
  AND (SELECT count(DISTINCT organization_id) FROM public.notifications WHERE kind = 'backup_due') = 2);
SELECT zz.check('page « outil trouvé » : entreprise de l''outil', (public.found_tool_info('ISO-MARTEAU-B') ->> 'company') = 'Entreprise B' AND (public.found_tool_info('ISO-MARTEAU-B') ->> 'known')::boolean);
SELECT zz.check('page « outil trouvé » : code inconnu = rien d''une entreprise', (public.found_tool_info('inconnu-xyz') ->> 'company') IS NULL AND NOT (public.found_tool_info('inconnu-xyz') ->> 'known')::boolean);
SELECT public.report_found_tool('ISO-MARTEAU-B', 'x@y.test', 'ici');
SELECT zz.check('outil trouvé : avis posé chez le propriétaire', (SELECT organization_id FROM public.notifications WHERE kind = 'tool_found' ORDER BY created_at DESC LIMIT 1) = :ORG2::uuid);
SELECT zz.check('chantier du même nom : celui de l''entreprise demandée', public.site_id_for('ISO Chantier X', :ORG1::uuid) = (SELECT id FROM public.sites WHERE name = 'ISO Chantier X' AND organization_id = :ORG1::uuid)
  AND public.site_id_for('ISO Chantier X', :ORG2::uuid) = (SELECT id FROM public.sites WHERE name = 'ISO Chantier X' AND organization_id = :ORG2::uuid));

SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A : annuaire sans personnes de B', zz.count($$SELECT 1 FROM public.people_directory() WHERE first_name = 'Bob'$$) = 0);
SELECT zz.check('A : « qui a quoi » sans emprunts de B', zz.count('SELECT 1 FROM public.who_has()') = 0);
SELECT zz.check('A : badge de B inconnu', public.find_user_by_badge(:'badge_b') IS NULL AND public.badge_problem(:'badge_b') = 'Badge inconnu');
SELECT zz.check('A : inventaire dans un dépôt de B refusé', zz.raises(format('SELECT public.start_inventory_count(%L)', :'depot_b')) IS NOT NULL);
SELECT zz.check('A : commande automatique pour un dépôt de B refusée', zz.raises(format('SELECT public.create_orders_from_low_stock(%L)', :'depot_b')) IS NOT NULL);
SELECT zz.check('A : retour d''un emprunt de B refusé (garde d''écriture)', zz.raises(format($f$SELECT public.return_with_check(%L, 'ok', NULL, NULL)$f$, :'checkout_b')) IS NOT NULL);
SELECT zz.check('A : recalcul global sans erreur', zz.raises('SELECT public.update_overdue_checkouts()') IS NULL AND zz.raises('SELECT public.update_equipment_availability()') IS NULL);
SELECT zz.check('A : ne voit pas les avis de B', zz.count($$SELECT 1 FROM public.notifications WHERE message LIKE '%Marteau B%'$$) = 0);
SELECT zz.check('A : journal d''audit sans les actions de B', zz.count($$SELECT 1 FROM public.audit_log WHERE changes::text LIKE '%Marteau B%'$$) = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B : voit l''emprunt en retard de son entreprise', zz.count('SELECT 1 FROM public.who_has()') = 1);
SELECT zz.check('B : badge reconnu', public.find_user_by_badge(:'badge_b') IS NOT NULL);
SELECT zz.check('B : ses avis, pas ceux de A', zz.count($$SELECT 1 FROM public.notifications WHERE message LIKE '%Marteau B%'$$) >= 1 AND zz.count($$SELECT 1 FROM public.notifications WHERE organization_id <> public.app_org_id()$$) = 0);
SELECT zz.check('B : retour de son propre emprunt accepté', zz.raises(format($f$SELECT public.return_with_check(%L, 'ok', NULL, NULL)$f$, :'checkout_b')) IS NULL);
RESET ROLE;

-- Bilan -----------------------------------------------------------------------------------------
SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name || COALESCE(' — ' || detail, '') AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
