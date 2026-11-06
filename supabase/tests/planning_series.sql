-- Module 1.4 : séries, copie d'un jour, matériel nécessaire. À lancer APRÈS isolation.sql et planning.sql.
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


-- Préparation (administrateur de l'entreprise 1) : un chantier de décembre, une zone, deux équipes, un jour bloqué, deux articles
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A : connexion', public.whoami() IS NOT NULL);
INSERT INTO public.sites (name, start_on, end_on) VALUES ('Série essai', '2026-12-01', '2026-12-31');
INSERT INTO public.cp_site_zones (site_id, name) SELECT id, 'Zone S' FROM public.sites WHERE name = 'Série essai';
INSERT INTO public.cp_site_teams (site_id, name) SELECT id, 'Équipe S1' FROM public.sites WHERE name = 'Série essai';
INSERT INTO public.cp_site_teams (site_id, name) SELECT id, 'Équipe S2' FROM public.sites WHERE name = 'Série essai';
INSERT INTO public.cp_site_blocked_days (site_id, day, reason) SELECT id, '2026-12-13', 'Dimanche' FROM public.sites WHERE name = 'Série essai';
INSERT INTO public.equipment (organization_id, name, status, total_quantity, available_quantity) VALUES (:ORG1::uuid, 'Échafaudage série', 'available', 2, 2), (:ORG1::uuid, 'Perceuse série', 'available', 3, 3);
RESET ROLE;
SELECT id AS site FROM public.sites WHERE name = 'Série essai' \gset
SELECT id AS zone FROM public.cp_site_zones WHERE name = 'Zone S' \gset
SELECT id AS t1 FROM public.cp_site_teams WHERE name = 'Équipe S1' \gset
SELECT id AS t2 FROM public.cp_site_teams WHERE name = 'Équipe S2' \gset
SELECT id AS ech FROM public.equipment WHERE name = 'Échafaudage série' \gset
SELECT id AS per FROM public.equipment WHERE name = 'Perceuse série' \gset

SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT public.whoami() IS NOT NULL;

-- 1. Série du lundi au vendredi, avec du matériel
SELECT created AS c1, skipped_blocked AS s1, series_id AS sid1 FROM public.cp_create_intervention_series(:'site'::uuid, :'zone'::uuid, :'t1'::uuid, NULL, 'Montage série', 'note', '2026-12-07', '2026-12-11', ARRAY[1,2,3,4,5], '08:00', '10:00', 0,
  jsonb_build_array(jsonb_build_object('equipment_id', :'per', 'quantity', 1))) \gset
SELECT zz.check('série lundi-vendredi : 5 interventions créées, aucune sautée', :c1 = 5 AND :s1 = 0);
SELECT zz.check('elles partagent un même series_id et les mêmes heures de Zurich', (SELECT count(*) FROM public.cp_site_interventions WHERE series_id = :'sid1'::uuid) = 5
  AND (SELECT count(DISTINCT (starts_at AT TIME ZONE 'Europe/Zurich')::time) FROM public.cp_site_interventions WHERE series_id = :'sid1'::uuid) = 1
  AND (SELECT min((starts_at AT TIME ZONE 'Europe/Zurich')::time) FROM public.cp_site_interventions WHERE series_id = :'sid1'::uuid) = '08:00');
SELECT zz.check('le matériel est recopié sur chaque intervention de la série', (SELECT count(*) FROM public.cp_site_intervention_needs n JOIN public.cp_site_interventions i ON i.id = n.intervention_id WHERE i.series_id = :'sid1'::uuid AND n.equipment_id = :'per'::uuid) = 5);

-- 2. Jour bloqué sauté
SELECT created AS c2, skipped_blocked AS s2 FROM public.cp_create_intervention_series(:'site'::uuid, :'zone'::uuid, :'t2'::uuid, NULL, 'Week-end', NULL, '2026-12-12', '2026-12-14', ARRAY[1,2,3,4,5,6,7], '09:00', '11:00') \gset
SELECT zz.check('série sur 3 jours dont un jour bloqué : 2 créées, 1 sautée', :c2 = 2 AND :s2 = 1);
SELECT zz.check('rien n''a été créé le jour bloqué', (SELECT count(*) FROM public.cp_site_interventions WHERE site_id = :'site'::uuid AND (starts_at AT TIME ZONE 'Europe/Zurich')::date = '2026-12-13') = 0);

-- 3. Tout ou rien : un chevauchement le 15.12 annule toute la série
INSERT INTO public.cp_site_interventions (site_id, zone_id, team_id, title, starts_at, ends_at) VALUES (:'site'::uuid, :'zone'::uuid, :'t1'::uuid, 'Déjà là', '2026-12-15 09:00+01', '2026-12-15 10:00+01');
SELECT count(*) AS avant FROM public.cp_site_interventions WHERE site_id = :'site'::uuid \gset
SELECT coalesce(zz.raises(format($f$SELECT * FROM public.cp_create_intervention_series(%L, %L, %L, NULL, 'Conflit', NULL, '2026-12-14', '2026-12-16', ARRAY[1,2,3,4,5,6,7], '08:30', '09:30')$f$, :'site', :'zone', :'t1')), 'accepté') AS e3 \gset
SELECT zz.check('un chevauchement refuse toute la série et nomme la date', :'e3' LIKE '15.12.2026%déjà une intervention%', :'e3');
SELECT zz.check('rien n''est créé (ni le 14, ni le 16)', (SELECT count(*) FROM public.cp_site_interventions WHERE site_id = :'site'::uuid) = :avant);

-- 4. Hors période, entrées invalides
SELECT coalesce(zz.raises(format($f$SELECT * FROM public.cp_create_intervention_series(%L, %L, %L, NULL, 'Trop tard', NULL, '2026-12-29', '2027-01-02', ARRAY[1,2,3,4,5,6,7], '08:00', '09:00')$f$, :'site', :'zone', :'t2')), 'accepté') AS e4 \gset
SELECT zz.check('hors période : refusé avec la date', :'e4' LIKE '01.01.2027%Après la fin%' OR :'e4' LIKE '%Après la fin%', :'e4');
SELECT zz.check('aucun jour de la semaine : refusé', zz.raises(format($f$SELECT * FROM public.cp_create_intervention_series(%L, %L, %L, NULL, 'x', NULL, '2026-12-14', '2026-12-16', ARRAY[]::integer[], '08:00', '09:00')$f$, :'site', :'zone', :'t2')) LIKE '%au moins un jour%');
SELECT zz.check('plus de 120 jours : refusé', zz.raises(format($f$SELECT * FROM public.cp_create_intervention_series(%L, %L, %L, NULL, 'x', NULL, '2026-12-01', '2027-06-30', ARRAY[1], '08:00', '09:00')$f$, :'site', :'zone', :'t2')) LIKE '%120 jours%');
SELECT zz.check('dernier jour avant le premier : refusé', zz.raises(format($f$SELECT * FROM public.cp_create_intervention_series(%L, %L, %L, NULL, 'x', NULL, '2026-12-16', '2026-12-14', ARRAY[1], '08:00', '09:00')$f$, :'site', :'zone', :'t2')) LIKE '%avant le premier%');
SELECT zz.check('aucun jour qui convienne : refusé', zz.raises(format($f$SELECT * FROM public.cp_create_intervention_series(%L, %L, %L, NULL, 'x', NULL, '2026-12-14', '2026-12-18', ARRAY[7], '08:00', '09:00')$f$, :'site', :'zone', :'t2')) LIKE '%Aucun jour ne convient%');
SELECT zz.check('heure hors des heures du chantier : refusé (mêmes contrôles qu''à la main)', zz.raises(format($f$SELECT * FROM public.cp_create_intervention_series(%L, %L, %L, NULL, 'x', NULL, '2026-12-17', '2026-12-18', ARRAY[1,2,3,4,5,6,7], '05:00', '06:00')$f$, :'site', :'zone', :'t2')) LIKE '%Hors des heures%');

-- 5. Copie d'un jour : le 07.12 (1 intervention) vers le 21 et le 22, et le jour bloqué
SELECT created AS c5, skipped_blocked AS s5 FROM public.cp_copy_interventions_day(:'site'::uuid, '2026-12-07', ARRAY['2026-12-21'::date, '2026-12-22'::date, '2026-12-13'::date, '2026-12-07'::date]) \gset
SELECT zz.check('copie : 2 jours de destination, 1 jour bloqué sauté, le jour d''origine ignoré', :c5 = 2 AND :s5 = 1);
SELECT zz.check('copie : mêmes heures de Zurich, même équipe, besoin recopié', (SELECT count(*) FROM public.cp_site_interventions WHERE site_id = :'site'::uuid AND title = 'Montage série' AND (starts_at AT TIME ZONE 'Europe/Zurich')::date IN ('2026-12-21', '2026-12-22') AND (starts_at AT TIME ZONE 'Europe/Zurich')::time = '08:00' AND (ends_at AT TIME ZONE 'Europe/Zurich')::time = '10:00' AND team_id = :'t1'::uuid AND series_id IS NULL) = 2
  AND (SELECT count(*) FROM public.cp_site_intervention_needs n JOIN public.cp_site_interventions i ON i.id = n.intervention_id WHERE i.site_id = :'site'::uuid AND (i.starts_at AT TIME ZONE 'Europe/Zurich')::date IN ('2026-12-21', '2026-12-22')) = 2);
SELECT zz.check('copie : jour sans intervention refusé', zz.raises(format($f$SELECT * FROM public.cp_copy_interventions_day(%L, '2026-12-25', ARRAY['2026-12-28'::date])$f$, :'site')) LIKE '%Aucune intervention%');
SELECT zz.check('copie : recopier deux fois refuse (équipe déjà occupée) avec la date et le titre', zz.raises(format($f$SELECT * FROM public.cp_copy_interventions_day(%L, '2026-12-07', ARRAY['2026-12-21'::date])$f$, :'site')) LIKE '21.12.2026%Montage série%');
SELECT zz.check('copie : aucune destination refusée', zz.raises(format($f$SELECT * FROM public.cp_copy_interventions_day(%L, '2026-12-07', ARRAY[]::date[])$f$, :'site')) LIKE '%au moins un jour%');

-- 6. Besoins : doublon et quantité invalide refusés
SELECT id AS itv FROM public.cp_site_interventions WHERE site_id = :'site'::uuid AND title = 'Montage série' ORDER BY starts_at LIMIT 1 \gset
SELECT zz.check('un même article deux fois sur une intervention : refusé', zz.raises(format('INSERT INTO public.cp_site_intervention_needs (intervention_id, equipment_id, quantity) VALUES (%L, %L, 2)', :'itv', :'per')) IS NOT NULL);
SELECT zz.check('quantité nulle ou négative : refusée', zz.raises(format('INSERT INTO public.cp_site_intervention_needs (intervention_id, equipment_id, quantity) VALUES (%L, %L, 0)', :'itv', :'ech')) IS NOT NULL);

-- 7. Avertissements de matériel : échafaudage (2 en stock)
INSERT INTO public.cp_site_interventions (site_id, zone_id, team_id, title, starts_at, ends_at) VALUES
  (:'site'::uuid, :'zone'::uuid, :'t1'::uuid, 'Ech A', '2026-12-23 08:00+01', '2026-12-23 10:00+01'),
  (:'site'::uuid, :'zone'::uuid, :'t2'::uuid, 'Ech B', '2026-12-23 09:00+01', '2026-12-23 11:00+01'),
  (:'site'::uuid, :'zone'::uuid, :'t1'::uuid, 'Ech C', '2026-12-23 14:00+01', '2026-12-23 16:00+01'),
  (:'site'::uuid, :'zone'::uuid, :'t2'::uuid, 'Ech D', '2026-12-24 08:00+01', '2026-12-24 10:00+01');
INSERT INTO public.cp_site_intervention_needs (intervention_id, equipment_id, quantity)
  SELECT id, :'ech'::uuid, CASE title WHEN 'Ech D' THEN 3 ELSE 2 END FROM public.cp_site_interventions WHERE site_id = :'site'::uuid AND title IN ('Ech A', 'Ech B', 'Ech C', 'Ech D');
SELECT zz.check('deux interventions qui se chevauchent et réclament tout le stock : toutes deux averties',
  (SELECT count(*) FROM public.cp_site_material_issues(:'site'::uuid) m JOIN public.cp_site_interventions i ON i.id = m.intervention_id WHERE i.title IN ('Ech A', 'Ech B') AND m.shortage = 2 AND m.available = 0) = 2);
SELECT zz.check('une intervention seule qui tient dans le stock : aucun avertissement', NOT EXISTS (SELECT 1 FROM public.cp_site_material_issues(:'site'::uuid) m JOIN public.cp_site_interventions i ON i.id = m.intervention_id WHERE i.title = 'Ech C'));
SELECT zz.check('besoin supérieur au stock : manque de 1 (3 demandés, 2 en stock)', (SELECT m.shortage FROM public.cp_site_material_issues(:'site'::uuid) m JOIN public.cp_site_interventions i ON i.id = m.intervention_id WHERE i.title = 'Ech D') = 1
  AND (SELECT m.equipment_name FROM public.cp_site_material_issues(:'site'::uuid) m JOIN public.cp_site_interventions i ON i.id = m.intervention_id WHERE i.title = 'Ech D') = 'Échafaudage série');
SELECT zz.check('la perceuse (3 en stock, 1 par intervention) ne déclenche aucun avertissement', NOT EXISTS (SELECT 1 FROM public.cp_site_material_issues(:'site'::uuid) WHERE equipment_name = 'Perceuse série'));
-- Le stock de GO-Mat tombe à zéro (perte, retrait…) : toutes les interventions qui comptaient sur la perceuse sont averties
RESET ROLE;
UPDATE public.equipment SET total_quantity = 0, available_quantity = 0 WHERE id = :'per'::uuid;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT public.whoami() IS NOT NULL;
SELECT zz.check('stock de GO-Mat à zéro : les 7 interventions qui comptent sur la perceuse sont averties', (SELECT count(*) FROM public.cp_site_material_issues(:'site'::uuid) WHERE equipment_name = 'Perceuse série' AND shortage = 1) = 7);
RESET ROLE;

-- 7b. Restauration d'une sauvegarde : les interventions sont reprises telles quelles (migration 46)
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT public.whoami() IS NOT NULL;
INSERT INTO public.sites (name, start_on, end_on, status) VALUES ('Restauration essai', '2026-12-01', '2026-12-31', 'closed');
INSERT INTO public.cp_site_zones (site_id, name) SELECT id, 'ZR' FROM public.sites WHERE name = 'Restauration essai';
INSERT INTO public.cp_site_teams (site_id, name) SELECT id, 'ER' FROM public.sites WHERE name = 'Restauration essai';
SELECT s.id AS rsite, z.id AS rzone, t.id AS rteam FROM public.sites s JOIN public.cp_site_zones z ON z.site_id = s.id JOIN public.cp_site_teams t ON t.site_id = s.id WHERE s.name = 'Restauration essai' \gset
SELECT zz.check('hors restauration : intervention sur un chantier clôturé refusée', zz.raises(format($f$INSERT INTO public.cp_site_interventions (site_id, zone_id, team_id, title, starts_at, ends_at) VALUES (%L, %L, %L, 'Normale', '2026-12-03 02:00+01', '2026-12-03 03:00+01')$f$, :'rsite', :'rzone', :'rteam')) LIKE '%clôturé%');
SELECT public.restore_missing_rows('cp_site_interventions', jsonb_build_array(jsonb_build_object('id', 'aaaaaaaa-0000-0000-0000-00000000aa01', 'organization_id', :ORG1, 'site_id', :'rsite', 'zone_id', :'rzone', 'team_id', :'rteam',
  'title', 'Restaurée', 'starts_at', '2026-12-03T01:07:00Z', 'ends_at', '2026-12-03T02:00:00Z', 'created_at', '2026-11-01T10:00:00Z'))) AS restored \gset
SELECT zz.check('restauration : l''intervention (chantier clôturé, heures et minutes anciennes) est reprise telle quelle', :restored = 1
  AND (SELECT count(*) FROM public.cp_site_interventions WHERE title = 'Restaurée') = 1);
SELECT public.restore_missing_rows('cp_site_intervention_needs', jsonb_build_array(jsonb_build_object('id', 'bbbbbbbb-0000-0000-0000-00000000bb01', 'organization_id', :ORG1, 'intervention_id', 'aaaaaaaa-0000-0000-0000-00000000aa01', 'equipment_id', :'ech', 'quantity', 1, 'created_at', '2026-11-01T10:00:00Z'))) AS restored2 \gset
SELECT zz.check('restauration : le matériel nécessaire est repris', :restored2 = 1);
SELECT public.restore_missing_rows('cp_site_interventions', jsonb_build_array(jsonb_build_object('id', 'aaaaaaaa-0000-0000-0000-00000000aa01', 'organization_id', :ORG1, 'site_id', :'rsite', 'zone_id', :'rzone', 'team_id', :'rteam', 'title', 'Restaurée', 'starts_at', '2026-12-03T01:07:00Z', 'ends_at', '2026-12-03T02:00:00Z'))) AS restored3 \gset
SELECT zz.check('restauration rejouée : rien n''est dupliqué', :restored3 = 0 AND (SELECT count(*) FROM public.cp_site_interventions WHERE title = 'Restaurée') = 1);
SELECT zz.check('après la restauration, les contrôles s''appliquent de nouveau', zz.raises(format($f$INSERT INTO public.cp_site_interventions (site_id, zone_id, team_id, title, starts_at, ends_at) VALUES (%L, %L, %L, 'Après', '2026-12-04 02:00+01', '2026-12-04 03:00+01')$f$, :'rsite', :'rzone', :'rteam')) LIKE '%clôturé%');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT public.whoami() IS NOT NULL;
SELECT zz.check('un collaborateur ne restaure rien', zz.raises(format($f$SELECT public.restore_missing_rows('cp_site_interventions', jsonb_build_array(jsonb_build_object('id', 'aaaaaaaa-0000-0000-0000-00000000aa02', 'organization_id', %L, 'site_id', %L, 'zone_id', %L, 'team_id', %L, 'title', 'Pirate', 'starts_at', '2026-12-03T01:00:00Z', 'ends_at', '2026-12-03T02:00:00Z')))$f$, :ORG1, :'rsite', :'rzone', :'rteam')) LIKE '%Accès refusé%');
RESET ROLE;

-- 8. Collaborateur (lecture seule) et entreprise B
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U : première connexion', public.whoami() IS NOT NULL);
SELECT zz.check('U lit les besoins', (SELECT count(*) FROM public.cp_site_intervention_needs) >= 5);
SELECT zz.check('U ne crée pas de série', zz.raises(format($f$SELECT * FROM public.cp_create_intervention_series(%L, %L, %L, NULL, 'Intrus', NULL, '2026-12-28', '2026-12-29', ARRAY[1,2,3,4,5,6,7], '08:00', '09:00')$f$, :'site', :'zone', :'t2')) IS NOT NULL);
SELECT zz.check('U ne copie pas de jour', zz.raises(format($f$SELECT * FROM public.cp_copy_interventions_day(%L, '2026-12-23', ARRAY['2026-12-28'::date])$f$, :'site')) IS NOT NULL);
SELECT zz.check('U ne modifie ni ne supprime de besoin', zz.affected($$UPDATE public.cp_site_intervention_needs SET quantity = 9$$) = 0 AND zz.affected($$DELETE FROM public.cp_site_intervention_needs$$) = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B : connexion', public.whoami() IS NOT NULL);
SELECT zz.check('B ne voit aucun besoin de A et aucun avertissement sur son chantier', (SELECT count(*) FROM public.cp_site_intervention_needs) = 0 AND (SELECT count(*) FROM public.cp_site_material_issues(:'site'::uuid)) = 0);
SELECT zz.check('B ne crée pas de série sur un chantier de A', zz.raises(format($f$SELECT * FROM public.cp_create_intervention_series(%L, %L, %L, NULL, 'Vol', NULL, '2026-12-28', '2026-12-29', ARRAY[1,2,3,4,5,6,7], '08:00', '09:00')$f$, :'site', :'zone', :'t2')) IS NOT NULL);
SELECT zz.check('B ne copie pas un jour de A', zz.raises(format($f$SELECT * FROM public.cp_copy_interventions_day(%L, '2026-12-23', ARRAY['2026-12-28'::date])$f$, :'site')) LIKE '%Aucune intervention%');
SELECT zz.check('B ne rattache pas un besoin à une intervention ou un article de A', zz.raises(format('INSERT INTO public.cp_site_intervention_needs (intervention_id, equipment_id, quantity) VALUES (%L, %L, 1)', :'itv', :'ech')) IS NOT NULL);
RESET ROLE;

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
