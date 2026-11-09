-- Page publique « outil trouvé » : plafond d'avis par entreprise et par heure (migration 76). À lancer APRÈS isolation.sql.
\set ON_ERROR_STOP on
\set ORG1 '''00000000-0000-0000-0000-000000000001'''
SELECT id AS org2 FROM public.organizations WHERE name = 'Entreprise B' \gset
\set ORG2 '''':org2''''
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.headers', '', false);
SELECT set_config('request.jwt.claims', '{}', false);
DROP SCHEMA IF EXISTS zf CASCADE;
CREATE SCHEMA zf;
CREATE TABLE zf.results (n serial, name text, ok boolean, detail text);
CREATE FUNCTION zf.check(p_name text, p_ok boolean, p_detail text DEFAULT NULL) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ INSERT INTO zf.results (name, ok, detail) VALUES (p_name, COALESCE(p_ok, false), p_detail) $$;
GRANT USAGE ON SCHEMA zf TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zf TO anon;

-- 12 matériels chez l'entreprise 1, 2 chez l'entreprise 2 (numéros d'article prévisibles, comme en vrai)
DELETE FROM public.notifications WHERE kind = 'tool_found';
INSERT INTO public.equipment (organization_id, name, status, total_quantity, available_quantity, article_number)
SELECT :ORG1::uuid, 'FT Outil ' || lpad(n::text, 2, '0'), 'available', 1, 1, 'FT-TEST-' || lpad(n::text, 2, '0') FROM generate_series(1, 12) n;
INSERT INTO public.equipment (organization_id, name, status, total_quantity, available_quantity, article_number)
SELECT :ORG2::uuid, 'FT Outil B ' || n, 'available', 1, 1, 'FT-TEST-B' || n FROM generate_series(1, 2) n;

-- En visiteur sans connexion (rôle anonyme), comme la page publique
SET ROLE anon;
SELECT zf.check('code inconnu : faux, rien enregistré', NOT public.report_found_tool('FT-INCONNU-999', 'x', 'y'));
SELECT bool_and(public.report_found_tool('FT-TEST-' || lpad(n::text, 2, '0'), 'a@b.test', 'ici')) AS tous_vrais FROM generate_series(1, 12) n \gset
RESET ROLE;
SELECT zf.check('12 matériels signalés : la fonction répond « vrai » pour chacun, plafond atteint compris', :'tous_vrais'::boolean);
SELECT zf.check('plafond : 10 avis enregistrés pour l''entreprise 1 (pas 12)',
  (SELECT count(*) FROM public.notifications WHERE kind = 'tool_found' AND organization_id = :ORG1::uuid) = 10);
SELECT zf.check('les 10 premiers matériels ont un avis, pas les 2 derniers',
  (SELECT count(*) FROM public.notifications n JOIN public.equipment e ON e.id = n.equipment_id WHERE n.kind = 'tool_found' AND e.article_number <= 'FT-TEST-10') = 10
  AND (SELECT count(*) FROM public.notifications n JOIN public.equipment e ON e.id = n.equipment_id WHERE n.kind = 'tool_found' AND e.article_number IN ('FT-TEST-11', 'FT-TEST-12')) = 0);

-- L'autre entreprise n'est pas gênée par le plafond de la première
SET ROLE anon;
SELECT public.report_found_tool('FT-TEST-B1', 'a@b.test', 'ici') AS b1 \gset
RESET ROLE;
SELECT zf.check('autre entreprise : son avis est posé malgré le plafond de la première',
  :'b1'::boolean AND (SELECT count(*) FROM public.notifications WHERE kind = 'tool_found' AND organization_id = :ORG2::uuid) = 1);

-- Le même outil dans la même heure : un seul avis (comme avant)
SET ROLE anon;
SELECT public.report_found_tool('FT-TEST-B1', 'c@d.test', 'ailleurs');
RESET ROLE;
SELECT zf.check('même outil, même heure : toujours un seul avis',
  (SELECT count(*) FROM public.notifications WHERE kind = 'tool_found' AND organization_id = :ORG2::uuid) = 1);

-- Une heure plus tard le plafond est levé : on vieillit les avis de l'entreprise 1
UPDATE public.notifications SET created_at = now() - interval '2 hours' WHERE kind = 'tool_found' AND organization_id = :ORG1::uuid;
SET ROLE anon;
SELECT public.report_found_tool('FT-TEST-11', 'a@b.test', 'ici');
RESET ROLE;
SELECT zf.check('après une heure : de nouveaux avis sont de nouveau acceptés',
  (SELECT count(*) FROM public.notifications n JOIN public.equipment e ON e.id = n.equipment_id WHERE n.kind = 'tool_found' AND e.article_number = 'FT-TEST-11') = 1);

-- Le code QR d'un exemplaire et les étiquettes existantes (numéro d'article) restent reconnus
SET ROLE anon;
SELECT zf.check('page publique : le numéro d''article est toujours reconnu (étiquettes déjà imprimées)', (public.found_tool_info('FT-TEST-01') ->> 'known')::boolean);
RESET ROLE;
SELECT zf.check('page publique : un visiteur sans connexion peut toujours appeler les deux fonctions',
  has_function_privilege('anon', 'public.report_found_tool(text,text,text)', 'execute') AND has_function_privilege('anon', 'public.found_tool_info(text)', 'execute'));
SELECT zf.check('droits : la recherche interne reste fermée au public',
  NOT has_function_privilege('anon', 'public.found_tool_lookup(text)', 'execute'));

-- Nettoyage
SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.notifications WHERE kind = 'tool_found';
DELETE FROM public.equipment WHERE article_number LIKE 'FT-TEST-%';
SELECT set_config('app.org_guard_off', '', false);

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name || COALESCE(' — ' || detail, '') AS resultat FROM zf.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zf.results;
