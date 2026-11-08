-- P8 : matériel et véhicules rattachés aux tâches, avertissements de disponibilité (cp_resource_issues). À lancer APRÈS isolation.sql.
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

UPDATE public.users SET rbac_role_id = (SELECT id FROM public.rbac_roles WHERE system_key = 'user' AND organization_id = :ORG1::uuid) WHERE email = 'u@iso.test';
SELECT id AS ua FROM public.users WHERE email = 'a@iso.test' AND organization_id = :ORG1::uuid \gset
SELECT id AS ub FROM public.users WHERE email = 'b@iso.test' AND organization_id = :ORG2::uuid \gset
INSERT INTO public.organization_modules (organization_id, module_key) VALUES (:ORG1::uuid, 'cp.projects'), (:ORG2::uuid, 'cp.projects') ON CONFLICT DO NOTHING;

-- Logistique (en administrateur de la base) : 2 articles, 2 véhicules, une demande validée qui réserve 3 perceuses du 2 au 4 mars 2027
SELECT set_config('app.org_guard_off', 'on', false);
SELECT id AS depot1 FROM public.depots WHERE organization_id = :ORG1::uuid LIMIT 1 \gset
INSERT INTO public.equipment (organization_id, name, serial_number, status, total_quantity, available_quantity) VALUES (:ORG1::uuid, 'Perceuse P8', 'P8-1', 'available', 5, 5) RETURNING id AS eq1 \gset
INSERT INTO public.equipment (organization_id, name, serial_number, status, total_quantity, available_quantity) VALUES (:ORG1::uuid, 'Projecteur P8', 'P8-2', 'available', 2, 2) RETURNING id AS eq2 \gset
INSERT INTO public.equipment (organization_id, name, serial_number, status, total_quantity, available_quantity) VALUES (:ORG2::uuid, 'Article de B', 'P8-B', 'available', 1, 1) RETURNING id AS eqb \gset
INSERT INTO public.vehicles (organization_id, name, plate) VALUES (:ORG1::uuid, 'Camion P8', 'ZZ 8001') RETURNING id AS ve1 \gset
INSERT INTO public.vehicles (organization_id, name, plate, status) VALUES (:ORG1::uuid, 'Fourgon P8', 'ZZ 8002', 'maintenance') RETURNING id AS ve2 \gset
INSERT INTO public.vehicles (organization_id, name, plate) VALUES (:ORG2::uuid, 'Véhicule de B', 'ZZ 8003') RETURNING id AS veb \gset
INSERT INTO public.requests (organization_id, number, requester_id, depot_id, start_at, end_at, status) VALUES (:ORG1::uuid, 'R-P8-1', :'ua'::uuid, :'depot1'::uuid, '2027-03-02 10:00+01', '2027-03-04 10:00+01', 'approved') RETURNING id AS req1 \gset
INSERT INTO public.request_items (organization_id, request_id, item_kind, equipment_id, quantity) VALUES (:ORG1::uuid, :'req1'::uuid, 'tool', :'eq1'::uuid, 3);
-- Deux demandes d'un après-midi / d'une matinée qui réservent les 2 projecteurs : le 12 mars (dernier jour d'une tâche) et le 15 mars (tâche d'un seul jour)
INSERT INTO public.requests (organization_id, number, requester_id, depot_id, start_at, end_at, status) VALUES (:ORG1::uuid, 'R-P8-2', :'ua'::uuid, :'depot1'::uuid, '2027-03-12 14:00+01', '2027-03-12 18:00+01', 'approved') RETURNING id AS req2 \gset
INSERT INTO public.request_items (organization_id, request_id, item_kind, equipment_id, quantity) VALUES (:ORG1::uuid, :'req2'::uuid, 'tool', :'eq2'::uuid, 2);
INSERT INTO public.requests (organization_id, number, requester_id, depot_id, start_at, end_at, status) VALUES (:ORG1::uuid, 'R-P8-3', :'ua'::uuid, :'depot1'::uuid, '2027-03-15 09:00+01', '2027-03-15 12:00+01', 'approved') RETURNING id AS req3 \gset
INSERT INTO public.request_items (organization_id, request_id, item_kind, equipment_id, quantity) VALUES (:ORG1::uuid, :'req3'::uuid, 'tool', :'eq2'::uuid, 2);
SELECT set_config('app.org_guard_off', '', false);

-- Les copies (modèle, projet issu du modèle) portent les mêmes noms : on cherche toujours dans le projet d'origine
CREATE FUNCTION pg_temp.it(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT i.id FROM public.cp_items i JOIN public.cp_projects p ON p.id = i.project_id WHERE i.name = p_name AND p.name = 'Projet Ressources' $$;
CREATE FUNCTION pg_temp.mk(p_project text, p_name text, p_from date, p_to date) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.cp_items (project_id, kind, name, starts_on, ends_on) VALUES ((SELECT id FROM public.cp_projects WHERE name = p_project), 'task', p_name, p_from, p_to);
END $$;
-- Rattache un article / un véhicule à un élément (renvoie NULL ou le message d'erreur)
CREATE FUNCTION pg_temp.eq(p_item text, p_equipment uuid, p_qty int) RETURNS text LANGUAGE plpgsql AS $$
BEGIN INSERT INTO public.cp_item_resources (item_id, kind, equipment_id, quantity) VALUES (pg_temp.it(p_item), 'equipment', p_equipment, p_qty); RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM; END $$;
CREATE FUNCTION pg_temp.ve(p_item text, p_vehicle uuid) RETURNS text LANGUAGE plpgsql AS $$
BEGIN INSERT INTO public.cp_item_resources (item_id, kind, vehicle_id) VALUES (pg_temp.it(p_item), 'vehicle', p_vehicle); RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM; END $$;
-- Problèmes d'un élément, lisibles : « Perceuse P8 3/2 » (demandé/libre) ou « Camion P8 : raison »
CREATE FUNCTION pg_temp.iss(p_item text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(CASE WHEN kind = 'equipment' THEN name || ' ' || needed || '/' || available ELSE name || ' : ' || reason END, ' | ' ORDER BY name), '-')
  FROM public.cp_resource_issues(pg_temp.it(p_item)) $$;
CREATE FUNCTION pg_temp.setstatus(p_item text, p_family text) RETURNS void LANGUAGE sql AS $$
  UPDATE public.cp_items SET status_id = (SELECT id FROM public.cp_statuses WHERE family = p_family AND is_system LIMIT 1) WHERE id = pg_temp.it(p_item) $$;
GRANT EXECUTE ON FUNCTION pg_temp.it(text), pg_temp.mk(text, text, date, date), pg_temp.eq(text, uuid, int), pg_temp.ve(text, uuid), pg_temp.iss(text), pg_temp.setstatus(text, text) TO authenticated;

SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_projects (name, type, starts_on, ends_on) VALUES ('Projet Ressources', 'site', '2027-03-01', '2027-03-31');
SELECT pg_temp.mk('Projet Ressources', 'RT1', '2027-03-01', '2027-03-05');   -- chevauche la demande (2 → 4 mars)
SELECT pg_temp.mk('Projet Ressources', 'RT2', '2027-03-08', '2027-03-09');   -- après la demande
SELECT pg_temp.mk('Projet Ressources', 'RT3', NULL, NULL);                  -- sans date
SELECT pg_temp.mk('Projet Ressources', 'RT4', '2027-03-03', '2027-03-04');   -- chevauche RT1
SELECT pg_temp.mk('Projet Ressources', 'RT5', '2027-03-05', '2027-03-06');   -- commence le dernier jour de RT1
SELECT pg_temp.mk('Projet Ressources', 'RT6', '2027-03-06', '2027-03-07');   -- commence le lendemain de la fin de RT1
SELECT pg_temp.mk('Projet Ressources', 'RT7', '2027-03-10', '2027-03-12');   -- sa dernière journée contient une demande (12 mars, 14 h → 18 h)
SELECT pg_temp.mk('Projet Ressources', 'RT8', '2027-03-15', '2027-03-15');   -- une seule journée, qui contient une demande (15 mars, 9 h → 12 h)
SELECT pg_temp.mk('Projet Ressources', 'RT9', '2027-03-16', '2027-03-16');   -- la journée suivante : libre
SELECT organization_id AS org_a FROM public.cp_projects WHERE name = 'Projet Ressources' \gset

-- 1. Contraintes
SELECT zz.check('rattacher 2 perceuses à RT1 : accepté', pg_temp.eq('RT1', :'eq1'::uuid, 2) IS NULL);
SELECT zz.check('l''entreprise est posée par la base', (SELECT organization_id = :'org_a'::uuid FROM public.cp_item_resources LIMIT 1));
SELECT zz.check('le même article deux fois sur la même tâche refusé', pg_temp.eq('RT1', :'eq1'::uuid, 1) IS NOT NULL);
SELECT zz.check('le même véhicule deux fois sur la même tâche refusé', pg_temp.ve('RT6', :'ve1'::uuid) IS NULL AND pg_temp.ve('RT6', :'ve1'::uuid) IS NOT NULL);
DELETE FROM public.cp_item_resources WHERE item_id = pg_temp.it('RT6');
SELECT zz.check('quantité 0 refusée', pg_temp.eq('RT2', :'eq1'::uuid, 0) IS NOT NULL);
SELECT zz.check('quantité 10 000 refusée', pg_temp.eq('RT2', :'eq1'::uuid, 10000) IS NOT NULL);
SELECT zz.check('quantité 9 999 acceptée (plafond)', pg_temp.eq('RT3', :'eq1'::uuid, 9999) IS NULL);
DELETE FROM public.cp_item_resources WHERE item_id = pg_temp.it('RT3');
SELECT zz.check('véhicule en quantité 2 refusé', zz.raises(format('INSERT INTO public.cp_item_resources (item_id, kind, vehicle_id, quantity) VALUES (pg_temp.it(''RT2''), ''vehicle'', %L, 2)', :'ve1')) IS NOT NULL);
SELECT zz.check('« matériel » avec un véhicule refusé', zz.raises(format('INSERT INTO public.cp_item_resources (item_id, kind, vehicle_id) VALUES (pg_temp.it(''RT2''), ''equipment'', %L)', :'ve1')) IS NOT NULL);
SELECT zz.check('article ET véhicule ensemble refusé', zz.raises(format('INSERT INTO public.cp_item_resources (item_id, kind, equipment_id, vehicle_id) VALUES (pg_temp.it(''RT2''), ''equipment'', %L, %L)', :'eq1', :'ve1')) IS NOT NULL);
SELECT zz.check('ni article ni véhicule refusé', zz.raises($$INSERT INTO public.cp_item_resources (item_id, kind) VALUES (pg_temp.it('RT2'), 'equipment')$$) IS NOT NULL);
SELECT zz.check('genre inconnu refusé', zz.raises(format('INSERT INTO public.cp_item_resources (item_id, kind, equipment_id) VALUES (pg_temp.it(''RT2''), ''salle'', %L)', :'eq1')) IS NOT NULL);
SELECT zz.check('note de 300 caractères acceptée, 301 refusée', zz.raises(format('INSERT INTO public.cp_item_resources (item_id, kind, equipment_id, note) VALUES (pg_temp.it(''RT2''), ''equipment'', %L, %L)', :'eq2', repeat('n', 300))) IS NULL
  AND zz.raises(format('INSERT INTO public.cp_item_resources (item_id, kind, equipment_id, note) VALUES (pg_temp.it(''RT4''), ''equipment'', %L, %L)', :'eq2', repeat('n', 301))) IS NOT NULL);
DELETE FROM public.cp_item_resources WHERE item_id = pg_temp.it('RT2');
SELECT zz.check('article d''une autre entreprise refusé', pg_temp.eq('RT2', :'eqb'::uuid, 1) IS NOT NULL);
SELECT zz.check('véhicule d''une autre entreprise refusé', pg_temp.ve('RT2', :'veb'::uuid) IS NOT NULL);
SELECT zz.check('article inconnu refusé', pg_temp.eq('RT2', gen_random_uuid(), 1) IS NOT NULL);
SELECT zz.check('on ne change que la quantité et la note : changer d''élément refusé', zz.raises($$UPDATE public.cp_item_resources SET item_id = pg_temp.it('RT2') WHERE item_id = pg_temp.it('RT1')$$) IS NOT NULL);
SELECT zz.check('changer d''article refusé', zz.raises(format('UPDATE public.cp_item_resources SET equipment_id = %L WHERE item_id = pg_temp.it(''RT1'')', :'eq2')) IS NOT NULL);
SELECT zz.check('changer la quantité accepté', zz.affected($$UPDATE public.cp_item_resources SET quantity = 3 WHERE item_id = pg_temp.it('RT1')$$) = 1);
SELECT zz.check('le rattachement figure au journal d''audit', (SELECT count(*) FROM public.audit_log WHERE table_name = 'cp_item_resources') >= 1);

-- 2. Disponibilité du matériel : 5 perceuses − 3 réservées par la demande R-P8-1 (2 → 4 mars) = 2 libres pendant RT1
SELECT zz.check('RT1 demande 3 perceuses, 2 libres : manque signalé (3/2)', pg_temp.iss('RT1') = 'Perceuse P8 3/2', pg_temp.iss('RT1'));
UPDATE public.cp_item_resources SET quantity = 2 WHERE item_id = pg_temp.it('RT1');
SELECT zz.check('RT1 demande 2, 2 libres : aucun problème', pg_temp.iss('RT1') = '-');
-- Une autre tâche PILOTE sur les mêmes jours : concurrence entre tâches
SELECT zz.check('RT4 (3-4 mars) demande 1 perceuse', pg_temp.eq('RT4', :'eq1'::uuid, 1) IS NULL);
SELECT zz.check('concurrence : RT1 voit 2 − 1 (RT4) = 1 libre, demande 2', pg_temp.iss('RT1') = 'Perceuse P8 2/1', pg_temp.iss('RT1'));
SELECT zz.check('concurrence symétrique : RT4 voit 2 − 2 (RT1) = 0 libre, demande 1', pg_temp.iss('RT4') = 'Perceuse P8 1/0', pg_temp.iss('RT4'));
-- Jours adjacents : RT5 commence le dernier jour de RT1 (5 mars) → chevauchement ; RT6 le lendemain → aucun
SELECT COALESCE(pg_temp.eq('RT5', :'eq1'::uuid, 4), 'ok') AS e5 \gset
SELECT COALESCE(pg_temp.eq('RT6', :'eq1'::uuid, 4), 'ok') AS e6 \gset
SELECT zz.check('RT5 (5-6 mars) et RT6 (6-7 mars) demandent 4 perceuses : rattachements acceptés', :'e5' = 'ok' AND :'e6' = 'ok');
SELECT zz.check('même jour de fin / début : RT5 chevauche RT1 (5 mars) mais pas la demande (finie le 4) : 5 − 2 (RT1) − 4 (RT6, 6 mars) = 0 libre', pg_temp.iss('RT5') = 'Perceuse P8 4/0', pg_temp.iss('RT5'));
SELECT zz.check('RT6 (6-7 mars) ne touche pas RT1 (finie le 5) mais chevauche RT5 (6 mars) : 5 − 4 = 1 libre, demande 4', pg_temp.iss('RT6') = 'Perceuse P8 4/1', pg_temp.iss('RT6'));
SELECT zz.check('RT1 (1-5 mars) voit RT5 (5-6 mars) : 5 − 3 (demande) − 1 (RT4) − 4 (RT5) → 0 libre', pg_temp.iss('RT1') = 'Perceuse P8 2/0', pg_temp.iss('RT1'));
DELETE FROM public.cp_item_resources WHERE item_id IN (pg_temp.it('RT5'), pg_temp.it('RT6'));
-- Après la demande : RT2 (8-9 mars) n'est touchée par rien
SELECT COALESCE(pg_temp.eq('RT2', :'eq1'::uuid, 5), 'ok') AS e2 \gset
SELECT zz.check('RT2 (8-9 mars, après la demande et loin des autres) demande les 5 perceuses : toutes libres, aucun problème', :'e2' = 'ok' AND (SELECT count(*) FROM public.cp_item_resources WHERE item_id = pg_temp.it('RT2')) = 1 AND pg_temp.iss('RT2') = '-');
DELETE FROM public.cp_item_resources WHERE item_id = pg_temp.it('RT2');
-- Sans date : jamais vérifié
SELECT COALESCE(pg_temp.eq('RT3', :'eq2'::uuid, 99), 'ok') AS e3 \gset
SELECT zz.check('élément sans date : 99 projecteurs (2 en stock) demandés, rien n''est vérifié', :'e3' = 'ok' AND (SELECT count(*) FROM public.cp_item_resources WHERE item_id = pg_temp.it('RT3')) = 1 AND pg_temp.iss('RT3') = '-');
DELETE FROM public.cp_item_resources WHERE item_id = pg_temp.it('RT3');
-- Sans paramètre : tous les éléments
SELECT zz.check('sans paramètre : les problèmes de tous les éléments (RT1 et RT4)', (SELECT array_agg(i.name ORDER BY i.name) FROM public.cp_resource_issues() r JOIN public.cp_items i ON i.id = r.item_id) = ARRAY['RT1', 'RT4']);
SELECT pg_temp.eq('RT7', :'eq2'::uuid, 1) AS e7 \gset
SELECT pg_temp.eq('RT8', :'eq2'::uuid, 1) AS e8 \gset
SELECT pg_temp.eq('RT9', :'eq2'::uuid, 1) AS e9 \gset
SELECT zz.check('dernier jour d''une tâche : une demande du 12 mars après-midi réserve les 2 projecteurs → manque signalé pour RT7 (10-12 mars)', pg_temp.iss('RT7') = 'Projecteur P8 1/0', pg_temp.iss('RT7'));
SELECT zz.check('tâche d''un seul jour (15 mars) : la demande de la matinée est vue → manque signalé pour RT8', pg_temp.iss('RT8') = 'Projecteur P8 1/0', pg_temp.iss('RT8'));
SELECT zz.check('le lendemain (16 mars) : rien à signaler pour RT9', pg_temp.iss('RT9') = '-');
DELETE FROM public.cp_item_resources WHERE item_id IN (pg_temp.it('RT7'), pg_temp.it('RT8'), pg_temp.it('RT9'));
SELECT zz.check('avec un élément : seulement ses lignes', (SELECT count(*) FROM public.cp_resource_issues(pg_temp.it('RT4'))) = 1);

-- 3. Véhicules
SELECT COALESCE(pg_temp.ve('RT1', :'ve1'::uuid), 'ok') AS v1 \gset
SELECT zz.check('RT1 prend le camion libre : aucun problème de véhicule', :'v1' = 'ok' AND pg_temp.iss('RT1') NOT LIKE '%Camion%' AND (SELECT count(*) FROM public.cp_item_resources WHERE vehicle_id = :'ve1'::uuid) = 1);
SELECT COALESCE(pg_temp.ve('RT4', :'ve2'::uuid), 'ok') AS v2 \gset
SELECT zz.check('le fourgon en maintenance (sur RT4) est signalé', :'v2' = 'ok' AND pg_temp.iss('RT4') LIKE '%Fourgon P8 : Fourgon P8 est en maintenance%', pg_temp.iss('RT4'));
SELECT COALESCE(pg_temp.ve('RT4', :'ve1'::uuid), 'ok') AS v3 \gset
SELECT zz.check('le même camion sur deux tâches qui se chevauchent : chacune est signalée', :'v3' = 'ok'
  AND pg_temp.iss('RT1') LIKE '%Camion P8 : Camion P8 est déjà prévu pour « RT4 (03.03 → 04.03) »%' AND pg_temp.iss('RT4') LIKE '%Camion P8 : Camion P8 est déjà prévu pour « RT1 (01.03 → 05.03) »%', pg_temp.iss('RT1') || ' // ' || pg_temp.iss('RT4'));
SELECT COALESCE(pg_temp.ve('RT2', :'ve1'::uuid), 'ok') AS v4 \gset
SELECT zz.check('camion sur deux tâches qui ne se chevauchent pas (RT2 : 8-9 mars) : pas de conflit', :'v4' = 'ok' AND pg_temp.iss('RT2') = '-' AND (SELECT count(*) FROM public.cp_item_resources WHERE vehicle_id = :'ve1'::uuid) = 3);
DELETE FROM public.cp_item_resources WHERE item_id = pg_temp.it('RT2');
-- Terminé / annulé : ne compte plus
SELECT pg_temp.setstatus('RT4', 'done');
SELECT zz.check('RT4 terminée : plus de conflit de camion pour RT1', pg_temp.iss('RT1') NOT LIKE '%Camion%' AND pg_temp.iss('RT1') = '-', pg_temp.iss('RT1'));
SELECT zz.check('RT4 terminée : ses propres rattachements ne sont plus vérifiés', pg_temp.iss('RT4') = '-');
SELECT zz.check('RT4 terminée : sa perceuse ne concurrence plus RT1 (2 demandées, 2 libres)', pg_temp.iss('RT1') = '-');
SELECT pg_temp.setstatus('RT4', 'cancelled');
SELECT zz.check('RT4 annulée : pareil', pg_temp.iss('RT1') = '-' AND pg_temp.iss('RT4') = '-');
SELECT pg_temp.setstatus('RT4', 'in_progress');
SELECT zz.check('RT4 de nouveau en cours : le conflit revient', pg_temp.iss('RT1') LIKE '%Camion%');

-- 4. Modèles : les éléments d'un modèle ne comptent pas, et la copie garde les ressources
SELECT public.cp_save_as_template((SELECT id FROM public.cp_projects WHERE name = 'Projet Ressources'), 'Modèle Ressources') AS tpl \gset
SELECT zz.check('enregistrer comme modèle copie les ressources', (SELECT count(*) FROM public.cp_item_resources r JOIN public.cp_items i ON i.id = r.item_id WHERE i.project_id = :'tpl'::uuid) = (SELECT count(*) FROM public.cp_item_resources r JOIN public.cp_items i ON i.id = r.item_id WHERE i.project_id = (SELECT id FROM public.cp_projects WHERE name = 'Projet Ressources')));
SELECT zz.check('les éléments du modèle (mêmes dates, même camion) ne créent aucun conflit supplémentaire', (SELECT count(*) FROM public.cp_resource_issues() r JOIN public.cp_items i ON i.id = r.item_id WHERE i.project_id = :'tpl'::uuid) = 0);
SELECT zz.check('et ne faussent pas les vrais projets (mêmes problèmes qu''avant)', pg_temp.iss('RT1') LIKE '%Camion P8 : Camion P8 est déjà prévu pour « RT4 (03.03 → 04.03) »%');
SELECT public.cp_create_from_template(:'tpl'::uuid, 'Projet issu du modèle', '2027-09-06') AS fromtpl \gset
SELECT zz.check('créer depuis le modèle garde les ressources', (SELECT count(*) FROM public.cp_item_resources r JOIN public.cp_items i ON i.id = r.item_id WHERE i.project_id = :'fromtpl'::uuid) > 0);
SELECT zz.check('les dates sont décalées : en septembre, plus de conflit avec la demande ni avec mars', (SELECT count(*) FROM public.cp_resource_issues() r JOIN public.cp_items i ON i.id = r.item_id WHERE i.project_id = :'fromtpl'::uuid AND r.kind = 'equipment' AND i.name = 'RT1') = 0);
SELECT public.cp_duplicate_project((SELECT id FROM public.cp_projects WHERE name = 'Projet Ressources'), 'Copie Ressources', NULL, false, false) AS dup \gset
SELECT zz.check('dupliquer un projet garde les ressources (mêmes quantités, nouveaux éléments)', (SELECT array_agg(r.quantity ORDER BY r.quantity, r.kind) FROM public.cp_item_resources r JOIN public.cp_items i ON i.id = r.item_id WHERE i.project_id = :'dup'::uuid)
  = (SELECT array_agg(r.quantity ORDER BY r.quantity, r.kind) FROM public.cp_item_resources r JOIN public.cp_items i ON i.id = r.item_id WHERE i.project_id = (SELECT id FROM public.cp_projects WHERE name = 'Projet Ressources')));
SELECT zz.check('la copie (mêmes dates) concurrence l''original : les conflits apparaissent des deux côtés', pg_temp.iss('RT1') LIKE '%Perceuse P8%');
RESET ROLE;

-- 5. Collaborateur : lit, n'écrit pas ; responsable : écrit
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT count(public.whoami());
SELECT zz.check('U lit les rattachements', (SELECT count(*) FROM public.cp_item_resources) > 0);
SELECT zz.check('U lit les problèmes de disponibilité', (SELECT count(*) FROM public.cp_resource_issues()) > 0);
SELECT zz.check('U ne rattache rien', zz.raises(format('INSERT INTO public.cp_item_resources (item_id, kind, equipment_id) VALUES (pg_temp.it(''RT3''), ''equipment'', %L)', :'eq1')) IS NOT NULL);
SELECT zz.check('U ne modifie rien', zz.affected($$UPDATE public.cp_item_resources SET quantity = 1$$) = 0);
SELECT zz.check('U ne retire rien', zz.affected($$DELETE FROM public.cp_item_resources$$) = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
UPDATE public.users SET role = 'manager' WHERE email = 'u@iso.test';
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('responsable : rattache du matériel', zz.raises(format('INSERT INTO public.cp_item_resources (item_id, kind, equipment_id) VALUES (pg_temp.it(''RT3''), ''equipment'', %L)', :'eq2')) IS NULL);
SELECT zz.check('responsable : modifie et retire', zz.affected($$UPDATE public.cp_item_resources SET quantity = 2 WHERE item_id = pg_temp.it('RT3')$$) = 1 AND zz.affected($$DELETE FROM public.cp_item_resources WHERE item_id = pg_temp.it('RT3')$$) = 1);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
UPDATE public.users SET role = 'user' WHERE email = 'u@iso.test';

-- 6. Module désactivé, isolation, anonyme
DELETE FROM public.organization_modules WHERE organization_id = :ORG1::uuid AND module_key = 'cp.projects';
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('module cp.projects désactivé : A ne lit plus rien', (SELECT count(*) FROM public.cp_item_resources) = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
INSERT INTO public.organization_modules (organization_id, module_key) VALUES (:ORG1::uuid, 'cp.projects') ON CONFLICT DO NOTHING;
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B ne voit aucun rattachement de A', (SELECT count(*) FROM public.cp_item_resources) = 0);
SELECT zz.check('B ne reçoit aucun problème de A', (SELECT count(*) FROM public.cp_resource_issues()) = 0);
SELECT zz.check('B ne rattache rien à un élément de A', zz.raises(format('INSERT INTO public.cp_item_resources (item_id, kind, equipment_id) VALUES (pg_temp.it(''RT3''), ''equipment'', %L)', :'eqb')) IS NOT NULL);
RESET ROLE;
GRANT USAGE ON SCHEMA zz TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO anon;
SET ROLE anon;
SELECT zz.check('anon ne lit pas les rattachements', zz.raises($$SELECT count(*) FROM public.cp_item_resources$$) IS NOT NULL);
SELECT zz.check('anon n''appelle pas la fonction de disponibilité', zz.raises($$SELECT * FROM public.cp_resource_issues()$$) IS NOT NULL);
RESET ROLE;

-- 7. Sauvegarde / restauration
SELECT zz.check('restore_missing_rows connaît cp_item_resources', pg_get_functiondef('public.restore_missing_rows(text, jsonb)'::regprocedure) LIKE '%''cp_item_resources''%');
CREATE TEMP TABLE keep AS SELECT * FROM public.cp_item_resources WHERE organization_id = :ORG1::uuid;
SELECT count(*) AS n_res FROM keep \gset
SELECT jsonb_agg(to_jsonb(k)) AS rows_res FROM keep k \gset
SELECT set_config('app.org_guard_off', 'on', false);
SET session_replication_role = replica;
DELETE FROM public.cp_item_resources WHERE organization_id = :ORG1::uuid;
SET session_replication_role = origin;
SELECT set_config('app.org_guard_off', '', false);
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT public.restore_missing_rows('cp_item_resources', :'rows_res'::jsonb) AS restored \gset
SELECT zz.check('restauration : tous les rattachements remis', :restored = :n_res AND (SELECT count(*) FROM public.cp_item_resources) = :n_res);
SELECT public.restore_missing_rows('cp_item_resources', :'rows_res'::jsonb) AS replay \gset
SELECT zz.check('rejouer ne duplique rien', :replay = 0 AND (SELECT count(*) FROM public.cp_item_resources) = :n_res);
RESET ROLE;

-- 8. Cascades
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('app.org_guard_off', 'on', false);
SELECT count(*) AS before_item FROM public.cp_item_resources WHERE item_id = (SELECT id FROM public.cp_items WHERE name = 'RT1' AND project_id = (SELECT id FROM public.cp_projects WHERE name = 'Projet Ressources')) \gset
DELETE FROM public.cp_items WHERE name = 'RT1' AND project_id = (SELECT id FROM public.cp_projects WHERE name = 'Projet Ressources');
SELECT zz.check('supprimer une tâche supprime ses rattachements', :before_item > 0 AND (SELECT count(*) FROM public.cp_item_resources WHERE item_id NOT IN (SELECT id FROM public.cp_items)) = 0);
SELECT count(*) AS before_eq FROM public.cp_item_resources WHERE equipment_id = :'eq1'::uuid \gset
DELETE FROM public.request_items WHERE equipment_id = :'eq1'::uuid;
DELETE FROM public.equipment WHERE id = :'eq1'::uuid;
SELECT zz.check('supprimer un article supprime ses rattachements', :before_eq > 0 AND (SELECT count(*) FROM public.cp_item_resources WHERE equipment_id = :'eq1'::uuid) = 0);
DELETE FROM public.vehicles WHERE id = :'ve1'::uuid;
SELECT zz.check('supprimer un véhicule supprime ses rattachements', (SELECT count(*) FROM public.cp_item_resources WHERE vehicle_id = :'ve1'::uuid) = 0);
DELETE FROM public.cp_item_resources; DELETE FROM public.cp_items; DELETE FROM public.cp_projects;
DELETE FROM public.request_items WHERE request_id IN (:'req1'::uuid, :'req2'::uuid, :'req3'::uuid); DELETE FROM public.requests WHERE id IN (:'req1'::uuid, :'req2'::uuid, :'req3'::uuid);
DELETE FROM public.equipment WHERE name LIKE '%P8' OR name = 'Article de B'; DELETE FROM public.vehicles WHERE plate LIKE 'ZZ 800%';
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name || COALESCE(' — ' || detail, '') AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
