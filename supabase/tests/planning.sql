-- Module 1.1 : planning de chantier (droits, contrôles, isolation). À lancer sur la base locale APRÈS isolation.sql.
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

-- Les nouvelles entreprises partent sans module : l'entreprise B reçoit le planning (la console le fait en vrai)
INSERT INTO public.organization_modules (organization_id, module_key) VALUES (:ORG2::uuid, 'chantiers_planning') ON CONFLICT DO NOTHING;

-- Droits par défaut des rôles système, dans chaque entreprise
SELECT zz.check('droits du module : administrateur et responsable écrivent, magasinier et collaborateur lisent seulement', (
  SELECT bool_and(CASE WHEN r.system_key IN ('admin', 'manager') THEN n = 4 ELSE n = 1 END)
  FROM (SELECT r.system_key, count(*) AS n FROM public.rbac_roles r JOIN public.rbac_role_permissions p ON p.role_id = r.id
        WHERE r.organization_id = :ORG1::uuid AND p.permission_key LIKE 'chantiers.planning:%' GROUP BY r.system_key) r));
SELECT zz.check('une nouvelle entreprise reçoit les droits du module', (SELECT count(*) FROM public.rbac_role_permissions p JOIN public.rbac_roles r ON r.id = p.role_id
  WHERE r.organization_id = :ORG2::uuid AND p.permission_key LIKE 'chantiers.planning:%') = 10);

-- Préparation par l'administrateur de l'entreprise 1
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A : connexion', public.whoami() IS NOT NULL);
INSERT INTO public.sites (name, start_on, end_on) VALUES ('Montage essai', '2026-12-01', '2026-12-10');
INSERT INTO public.sites (name, start_on, end_on, status) VALUES ('Chantier clos', '2026-12-01', '2026-12-10', 'closed');
INSERT INTO public.sites (name) VALUES ('Autre chantier');
INSERT INTO public.contractors (name) VALUES ('Scène & Son SA');
INSERT INTO public.site_zones (site_id, name) SELECT id, 'Scène principale' FROM public.sites WHERE name = 'Montage essai';
INSERT INTO public.site_zones (site_id, name) SELECT id, 'Parking' FROM public.sites WHERE name = 'Montage essai';
INSERT INTO public.site_zones (site_id, name) SELECT id, 'Zone étrangère' FROM public.sites WHERE name = 'Autre chantier';
INSERT INTO public.site_zones (site_id, name) SELECT id, 'Zone du clos' FROM public.sites WHERE name = 'Chantier clos';
INSERT INTO public.site_teams (site_id, name, contractor_id) SELECT s.id, 'Équipe son', c.id FROM public.sites s, public.contractors c WHERE s.name = 'Montage essai';
INSERT INTO public.site_teams (site_id, name) SELECT id, 'Équipe interne' FROM public.sites WHERE name = 'Montage essai';
INSERT INTO public.site_teams (site_id, name) SELECT id, 'Équipe du clos' FROM public.sites WHERE name = 'Chantier clos';
INSERT INTO public.site_phases (site_id, name, start_on, end_on) SELECT id, 'Montage', '2026-12-01', '2026-12-05' FROM public.sites WHERE name = 'Montage essai';
SELECT zz.check('A : prépare chantier, prestataire, zones, équipes, phase', (SELECT count(*) FROM public.site_zones) = 4 AND (SELECT count(*) FROM public.site_teams) = 3 AND (SELECT count(*) FROM public.contractors) = 1);
SELECT zz.check('équipe rattachée à son prestataire, équipe interne sans prestataire', (SELECT contractor_id IS NOT NULL FROM public.site_teams WHERE name = 'Équipe son') AND (SELECT contractor_id IS NULL FROM public.site_teams WHERE name = 'Équipe interne'));
SELECT zz.check('deux zones de même nom sur un chantier refusées', zz.raises($$INSERT INTO public.site_zones (site_id, name) SELECT id, 'parking ' FROM public.sites WHERE name = 'Montage essai'$$) IS NOT NULL);
SELECT zz.check('phase dont la fin précède le début refusée', zz.raises($$INSERT INTO public.site_phases (site_id, name, start_on, end_on) SELECT id, 'Inversée', '2026-12-05', '2026-12-01' FROM public.sites WHERE name = 'Montage essai'$$) IS NOT NULL);

-- Outil : une intervention (heure de Zurich en décembre = +01)
CREATE FUNCTION pg_temp.itv(p_site text, p_zone text, p_team text, p_title text, p_from text, p_to text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.site_interventions (site_id, zone_id, team_id, title, starts_at, ends_at)
  SELECT s.id, (SELECT z.id FROM public.site_zones z WHERE z.site_id = s.id AND z.name = p_zone), (SELECT t.id FROM public.site_teams t WHERE t.site_id = s.id AND t.name = p_team), p_title, p_from::timestamptz, p_to::timestamptz
  FROM public.sites s WHERE s.name = p_site;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN SQLERRM;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.itv(text, text, text, text, text, text) TO authenticated;

SELECT zz.check('intervention valide enregistrée', pg_temp.itv('Montage essai', 'Scène principale', 'Équipe son', 'Pose des structures', '2026-12-02 08:00+01', '2026-12-02 10:00+01') IS NULL);
SELECT zz.check('journal d''audit : l''intervention y figure', (SELECT count(*) FROM public.audit_log WHERE table_name = 'site_interventions' AND action = 'insert') = 1);
SELECT zz.check('même équipe qui se chevauche : refusée', pg_temp.itv('Montage essai', 'Parking', 'Équipe son', 'Chevauche', '2026-12-02 09:00+01', '2026-12-02 11:00+01') LIKE '%déjà une intervention%');
SELECT zz.check('créneau qui en englobe un autre : refusé', pg_temp.itv('Montage essai', 'Parking', 'Équipe son', 'Englobe', '2026-12-02 07:30+01', '2026-12-02 12:00+01') LIKE '%déjà une intervention%');
SELECT zz.check('créneau qui touche sans chevaucher : accepté', pg_temp.itv('Montage essai', 'Scène principale', 'Équipe son', 'Juste après', '2026-12-02 10:00+01', '2026-12-02 11:00+01') IS NULL);
SELECT zz.check('autre équipe, même zone, même heure : acceptée', pg_temp.itv('Montage essai', 'Scène principale', 'Équipe interne', 'Éclairage', '2026-12-02 08:00+01', '2026-12-02 10:00+01') IS NULL);
SELECT zz.check('fin avant début : refusée', pg_temp.itv('Montage essai', 'Parking', 'Équipe interne', 'Inversée', '2026-12-03 10:00+01', '2026-12-03 09:00+01') IS NOT NULL);
SELECT zz.check('heure hors pas de 15 min : refusée', pg_temp.itv('Montage essai', 'Parking', 'Équipe interne', 'Pas', '2026-12-03 08:10+01', '2026-12-03 09:00+01') LIKE '%pas de 15 minutes%');
SELECT zz.check('avant l''ouverture de la journée : refusée', pg_temp.itv('Montage essai', 'Parking', 'Équipe interne', 'Tôt', '2026-12-03 06:00+01', '2026-12-03 08:00+01') LIKE '%Hors des heures%');
SELECT zz.check('après la fermeture de la journée : refusée', pg_temp.itv('Montage essai', 'Parking', 'Équipe interne', 'Tard', '2026-12-03 18:00+01', '2026-12-03 20:00+01') LIKE '%Hors des heures%');
SELECT zz.check('sur deux jours : refusée (chantier pas en 24 h/24)', pg_temp.itv('Montage essai', 'Parking', 'Équipe interne', 'Deux jours', '2026-12-03 17:00+01', '2026-12-04 08:00+01') LIKE '%seule journée%');
SELECT zz.check('avant le début du chantier : refusée', pg_temp.itv('Montage essai', 'Parking', 'Équipe interne', 'Avant', '2026-11-30 08:00+01', '2026-11-30 10:00+01') LIKE '%Avant le début%');
SELECT zz.check('après la fin du chantier : refusée', pg_temp.itv('Montage essai', 'Parking', 'Équipe interne', 'Après', '2026-12-11 08:00+01', '2026-12-11 10:00+01') LIKE '%Après la fin%');
SELECT zz.check('dernier jour du chantier : accepté', pg_temp.itv('Montage essai', 'Parking', 'Équipe interne', 'Dernier jour', '2026-12-10 08:00+01', '2026-12-10 10:00+01') IS NULL);
SELECT zz.check('zone d''un autre chantier : refusée', pg_temp.itv('Montage essai', 'Zone étrangère', 'Équipe interne', 'Mauvaise zone', '2026-12-03 08:00+01', '2026-12-03 09:00+01') IS NOT NULL);
SELECT zz.check('équipe d''un autre chantier : refusée', pg_temp.itv('Montage essai', 'Parking', 'Équipe du clos', 'Mauvaise équipe', '2026-12-03 08:00+01', '2026-12-03 09:00+01') IS NOT NULL);
SELECT zz.check('chantier clôturé : intervention refusée', pg_temp.itv('Chantier clos', 'Zone du clos', 'Équipe du clos', 'Clos', '2026-12-03 08:00+01', '2026-12-03 09:00+01') LIKE '%clôturé%');
INSERT INTO public.site_blocked_days (site_id, day, reason) SELECT id, '2026-12-06', 'Dimanche' FROM public.sites WHERE name = 'Montage essai';
SELECT zz.check('jour bloqué : intervention refusée', pg_temp.itv('Montage essai', 'Parking', 'Équipe interne', 'Dimanche', '2026-12-06 08:00+01', '2026-12-06 09:00+01') LIKE '%Jour bloqué%');
SELECT zz.check('même jour bloqué deux fois refusé', zz.raises($$INSERT INTO public.site_blocked_days (site_id, day) SELECT id, '2026-12-06' FROM public.sites WHERE name = 'Montage essai'$$) IS NOT NULL);

-- Déplacer une intervention : mêmes contrôles
SELECT zz.check('déplacer dans le créneau d''une autre intervention de l''équipe : refusé', zz.raises($$UPDATE public.site_interventions SET starts_at = '2026-12-02 09:00+01', ends_at = '2026-12-02 11:00+01' WHERE title = 'Juste après'$$) LIKE '%déjà une intervention%');
SELECT zz.check('déplacer vers un créneau libre : accepté', zz.raises($$UPDATE public.site_interventions SET starts_at = '2026-12-02 14:00+01', ends_at = '2026-12-02 15:00+01' WHERE title = 'Juste après'$$) IS NULL);
SELECT zz.check('une zone ou une équipe utilisée ne se supprime pas', zz.raises($$DELETE FROM public.site_zones WHERE name = 'Scène principale'$$) IS NOT NULL AND zz.raises($$DELETE FROM public.site_teams WHERE name = 'Équipe son'$$) IS NOT NULL);

-- Configuration : 24 h/24 et pas de 30 min
INSERT INTO public.site_config (site_id, all_day, step_minutes) SELECT id, true, 30 FROM public.sites WHERE name = 'Montage essai';
SELECT zz.check('24 h/24 : intervention de nuit à cheval sur deux jours acceptée', pg_temp.itv('Montage essai', 'Parking', 'Équipe interne', 'Montage de nuit', '2026-12-04 22:00+01', '2026-12-05 06:00+01') IS NULL);
SELECT zz.check('pas de 30 min : 08:15 refusé', pg_temp.itv('Montage essai', 'Parking', 'Équipe interne', 'Quart', '2026-12-07 08:15+01', '2026-12-07 09:00+01') LIKE '%pas de 30 minutes%');
SELECT zz.check('pas de 30 min : 08:30 accepté', pg_temp.itv('Montage essai', 'Parking', 'Équipe interne', 'Demi', '2026-12-07 08:30+01', '2026-12-07 09:00+01') IS NULL);
SELECT zz.check('la nuit qui traverse le jour bloqué est refusée', pg_temp.itv('Montage essai', 'Parking', 'Équipe interne', 'Nuit bloquée', '2026-12-05 22:00+01', '2026-12-06 02:00+01') LIKE '%Jour bloqué%');
SELECT zz.check('config : heures incohérentes refusées', zz.raises($$UPDATE public.site_config SET all_day = false, day_start = '18:00', day_end = '08:00'$$) IS NOT NULL);
RESET ROLE;

-- Collaborateur (U, entreprise 1) : lit le planning, ne le modifie pas
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U : première connexion', public.whoami() IS NOT NULL);
SELECT zz.check('U lit interventions, zones, équipes et prestataires', (SELECT count(*) FROM public.site_interventions) >= 6 AND (SELECT count(*) FROM public.site_zones) = 4 AND (SELECT count(*) FROM public.contractors) = 1);
SELECT zz.check('U ne crée aucune intervention', pg_temp.itv('Montage essai', 'Parking', 'Équipe interne', 'Intrus', '2026-12-08 08:00+01', '2026-12-08 09:00+01') IS NOT NULL);
SELECT zz.check('U ne modifie ni ne supprime rien', zz.affected($$UPDATE public.site_interventions SET title = 'Piraté'$$) = 0 AND zz.affected($$DELETE FROM public.site_interventions$$) = 0 AND zz.affected($$DELETE FROM public.site_zones$$) = 0);
SELECT zz.check('U ne crée ni zone, ni équipe, ni prestataire', zz.raises($$INSERT INTO public.contractors (name) VALUES ('Intrus SA')$$) IS NOT NULL AND zz.raises($$INSERT INTO public.site_zones (site_id, name) SELECT id, 'Intrus' FROM public.sites LIMIT 1$$) IS NOT NULL);
RESET ROLE;

-- Entreprise B : ne voit rien, ne s'accroche à rien
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B : connexion', public.whoami() IS NOT NULL);
SELECT zz.check('B ne voit aucune donnée de planning de A', (SELECT count(*) FROM public.site_interventions) = 0 AND (SELECT count(*) FROM public.site_zones) = 0 AND (SELECT count(*) FROM public.site_teams) = 0
  AND (SELECT count(*) FROM public.contractors) = 0 AND (SELECT count(*) FROM public.site_config) = 0 AND (SELECT count(*) FROM public.site_blocked_days) = 0 AND (SELECT count(*) FROM public.site_phases) = 0);
RESET ROLE;
SELECT id AS site_a FROM public.sites WHERE name = 'Montage essai' \gset
SELECT id AS zone_a FROM public.site_zones WHERE name = 'Parking' \gset
SELECT id AS team_a FROM public.site_teams WHERE name = 'Équipe interne' \gset
SELECT id AS contractor_a FROM public.contractors WHERE name = 'Scène & Son SA' \gset
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B ne crée pas de zone sur un chantier de A', zz.raises(format('INSERT INTO public.site_zones (site_id, name) VALUES (%L, ''Zone volée'')', :'site_a')) IS NOT NULL);
SELECT zz.check('B ne crée pas de jour bloqué sur un chantier de A', zz.raises(format('INSERT INTO public.site_blocked_days (site_id, day) VALUES (%L, ''2026-12-08'')', :'site_a')) IS NOT NULL);
SELECT zz.check('B ne crée pas de configuration sur un chantier de A', zz.raises(format('INSERT INTO public.site_config (site_id) VALUES (%L)', :'site_a')) IS NOT NULL);
INSERT INTO public.sites (name) VALUES ('Chantier de B');
SELECT zz.check('B ne rattache pas une équipe à un prestataire de A', zz.raises(format('INSERT INTO public.site_teams (site_id, name, contractor_id) SELECT id, ''Équipe B'', %L FROM public.sites WHERE name = ''Chantier de B''', :'contractor_a')) IS NOT NULL);
INSERT INTO public.site_zones (site_id, name) SELECT id, 'Zone B' FROM public.sites WHERE name = 'Chantier de B';
INSERT INTO public.site_teams (site_id, name) SELECT id, 'Équipe B' FROM public.sites WHERE name = 'Chantier de B';
SELECT zz.check('B ne crée pas d''intervention avec la zone et l''équipe de A', zz.raises(format('INSERT INTO public.site_interventions (site_id, zone_id, team_id, title, starts_at, ends_at) SELECT s.id, %L, %L, ''Vol'', ''2026-12-08 08:00+01'', ''2026-12-08 09:00+01'' FROM public.sites s WHERE s.name = ''Chantier de B''', :'zone_a', :'team_a')) IS NOT NULL);
SELECT zz.check('B ne crée pas d''intervention sur un chantier de A', zz.raises(format('INSERT INTO public.site_interventions (site_id, zone_id, team_id, title, starts_at, ends_at) VALUES (%L, %L, %L, ''Vol'', ''2026-12-08 08:00+01'', ''2026-12-08 09:00+01'')', :'site_a', :'zone_a', :'team_a')) IS NOT NULL);
SELECT zz.check('B ne modifie ni ne supprime rien chez A', zz.affected($$UPDATE public.site_interventions SET title = 'Piraté'$$) = 0 AND zz.affected($$DELETE FROM public.site_zones WHERE name = 'Parking'$$) = 0);
SELECT zz.check('B crée son propre planning (zone, équipe, intervention)', pg_temp.itv('Chantier de B', 'Zone B', 'Équipe B', 'Travail de B', '2026-12-02 08:00+01', '2026-12-02 10:00+01') IS NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A ne voit pas le planning de B', (SELECT count(*) FROM public.site_interventions WHERE title = 'Travail de B') = 0 AND (SELECT count(*) FROM public.site_zones WHERE name = 'Zone B') = 0);
RESET ROLE;

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
