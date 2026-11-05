-- Quota de stockage des documents PILOTE (migration 62) : mesure réelle, barrière de dépôt, garde de la ligne, console, fichiers orphelins. À lancer APRÈS documents.sql et AVANT platform.sql (run.sh : platform.sql retire les états d'avancement de l'entreprise 1).
\set ON_ERROR_STOP on
\set A '''a0000000-0000-0000-0000-00000000000a'''
\set B '''b0000000-0000-0000-0000-00000000000b'''
\set U '''d0000000-0000-0000-0000-00000000000d'''
\set P '''f0000000-0000-0000-0000-00000000000f'''
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
GRANT USAGE ON SCHEMA zz TO authenticated, service_role;
CREATE FUNCTION zz.check(p_name text, p_ok boolean, p_detail text DEFAULT NULL) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ INSERT INTO zz.results (name, ok, detail) VALUES (p_name, COALESCE(p_ok, false), p_detail) $$;
CREATE FUNCTION zz.raises(p_sql text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN EXECUTE p_sql; RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM; END $$;
CREATE FUNCTION zz.count(p_sql text) RETURNS integer LANGUAGE plpgsql AS $$ DECLARE n integer; BEGIN EXECUTE 'SELECT count(*) FROM (' || p_sql || ') s' INTO n; RETURN n; END $$;
CREATE FUNCTION zz.affected(p_sql text) RETURNS integer LANGUAGE plpgsql AS $$ DECLARE n integer; BEGIN EXECUTE p_sql; GET DIAGNOSTICS n = ROW_COUNT; RETURN n; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zz TO authenticated, service_role;

INSERT INTO public.organization_modules (organization_id, module_key) VALUES (:ORG1::uuid, 'cp.projects'), (:ORG2::uuid, 'cp.projects') ON CONFLICT DO NOTHING;

-- Le stockage de la base locale est une maquette : sécurité par ligne activée comme sur Supabase
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated;
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT SELECT ON storage.objects TO service_role;

-- Départ propre : aucun fichier de documents ; un projet Q1 dans l'entreprise 1
DELETE FROM storage.objects WHERE bucket_id = 'cp-documents';
DELETE FROM public.cp_document_trash;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_projects (name, type) VALUES ('Q1', 'admin');
SELECT id AS q1 FROM public.cp_projects WHERE name = 'Q1' \gset
RESET ROLE;
SELECT :ORG1::text || '/' || :'q1' || '/' AS dir1 \gset

-- 1. Limite par défaut
SELECT zz.check('limite par défaut : 2 Go pour chaque entreprise', (SELECT bool_and(cp_storage_quota_bytes = 2147483648) FROM public.organizations));
SELECT zz.check('une limite négative est refusée par la base', zz.raises($$UPDATE public.organizations SET cp_storage_quota_bytes = -1 WHERE id = '00000000-0000-0000-0000-000000000001'$$) IS NOT NULL);

-- 2. Mesure : taille RÉELLE des fichiers de l'entreprise, ceux des autres ne comptent pas
INSERT INTO storage.objects (bucket_id, name, metadata) VALUES
  ('cp-documents', :'dir1' || 'u1.bin', '{"size": 300}'), ('cp-documents', :'dir1' || 'u2.bin', '{"size": 500}'),
  ('cp-documents', :ORG2::text || '/' || gen_random_uuid() || '/autre.bin', '{"size": 7000}'),
  ('cp-documents', :'dir1' || 'sans-taille.bin', NULL), ('autre-bucket', :'dir1' || 'ailleurs.bin', '{"size": 99999}');
SELECT zz.check('espace utilisé = somme des tailles réelles du dossier de l''entreprise (autres entreprises, autres buckets et tailles absentes ne comptent pas)', public.cp_storage_used_bytes(:ORG1::uuid) = 800 AND public.cp_storage_used_bytes(:ORG2::uuid) = 7000);
SELECT zz.check('la mesure n''est pas appelable par les utilisateurs ni les anonymes', NOT has_function_privilege('authenticated', 'public.cp_storage_used_bytes(uuid)', 'execute') AND NOT has_function_privilege('anon', 'public.cp_storage_used_bytes(uuid)', 'execute'));

-- 3. Pour l'écran : entreprise de l'appelant seulement
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A voit l''espace de SON entreprise : 800 octets sur 2 Go', (SELECT used_bytes = 800 AND quota_bytes = 2147483648 FROM public.cp_storage_status()));
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B voit l''espace de SON entreprise, pas celui de l''entreprise 1', (SELECT used_bytes = 7000 FROM public.cp_storage_status()));
RESET ROLE;
SELECT zz.check('anonyme : aucune fonction de quota', NOT has_function_privilege('anon', 'public.cp_storage_status()', 'execute') AND NOT has_function_privilege('anon', 'public.cp_storage_has_room()', 'execute') AND NOT has_function_privilege('anon', 'public.platform_set_storage_quota(uuid, bigint)', 'execute') AND NOT has_function_privilege('anon', 'public.platform_storage_quotas()', 'execute'));

SELECT count(*) AS nb_orgs FROM public.organizations \gset
-- 4. Console : seul l'administrateur de la plateforme règle la limite ; journalisé
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('un administrateur d''entreprise (pas de la plateforme) ne règle pas la limite et ne la liste pas', zz.raises(format('SELECT public.platform_set_storage_quota(%L, 5)', :ORG1)) LIKE '%plateforme%' AND zz.raises('SELECT * FROM public.platform_storage_quotas()') LIKE '%plateforme%');
SELECT zz.raises(format('UPDATE public.organizations SET cp_storage_quota_bytes = NULL WHERE id = %L', :ORG1)) AS tentative_directe \gset
RESET ROLE;
SELECT zz.check('la limite n''a pas bougé après les tentatives de A (appel refusé, modification directe sans effet)', (SELECT cp_storage_quota_bytes FROM public.organizations WHERE id = :ORG1::uuid) = 2147483648);
SELECT set_config('request.jwt.claim.sub', :P, false); SET ROLE authenticated;
SELECT zz.check('P (plateforme) liste les limites : une ligne par entreprise, avec l''espace utilisé', (SELECT count(*) FROM public.platform_storage_quotas()) = :nb_orgs AND (SELECT used_bytes FROM public.platform_storage_quotas() WHERE organization_id = :ORG1::uuid) = 800);
SELECT zz.check('limite négative et entreprise inconnue refusées', zz.raises(format('SELECT public.platform_set_storage_quota(%L, -5)', :ORG1)) LIKE '%négative%' AND zz.raises(format('SELECT public.platform_set_storage_quota(%L, 5)', gen_random_uuid())) LIKE '%introuvable%');
SELECT public.platform_set_storage_quota(:ORG1::uuid, 1000);
RESET ROLE;
SELECT zz.check('P règle la limite à 1000 octets, et c''est journalisé', (SELECT cp_storage_quota_bytes FROM public.organizations WHERE id = :ORG1::uuid) = 1000
  AND EXISTS (SELECT 1 FROM public.admin_audit_log WHERE action = 'set_storage_quota' AND target_id = :ORG1::uuid AND (metadata ->> 'quota_bytes')::bigint = 1000));

-- 5. Règle de dépôt : on dépose tant que l'espace utilisé est SOUS la limite (800 < 1000), plus ensuite
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('espace 800 / limite 1000 : un dépôt est accepté (la limite est franchie d''un fichier au plus)', zz.raises(format('INSERT INTO storage.objects (bucket_id, name, metadata) VALUES (''cp-documents'', %L, ''{"size": 800}'')', :'dir1' || 'u3.bin')) IS NULL);
SELECT zz.check('espace 1600 / limite 1000 : un nouveau dépôt est refusé', zz.raises(format('INSERT INTO storage.objects (bucket_id, name, metadata) VALUES (''cp-documents'', %L, ''{"size": 10}'')', :'dir1' || 'u4.bin')) IS NOT NULL);
SELECT zz.check('espace plein : le même dépôt reste refusé pour l''autre entreprise sans lien avec elle (isolation)', zz.raises(format('INSERT INTO storage.objects (bucket_id, name) VALUES (''cp-documents'', %L)', :ORG2::text || '/' || gen_random_uuid() || '/x.bin')) IS NOT NULL);
RESET ROLE;

-- 6. Garde de la ligne : l'espace RÉEL (fichier déposé compris) doit tenir dans la limite
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('espace 1600 > limite 1000 : la ligne du document est refusée avec un message clair', zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''a.bin'', 1, %L)', :'q1', :'dir1' || 'u3.bin')) LIKE '%espace de stockage de l''entreprise est plein%');
RESET ROLE;
UPDATE public.organizations SET cp_storage_quota_bytes = 1600 WHERE id = :ORG1::uuid;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('espace 1600 = limite 1600 : la ligne est acceptée (la limite est atteinte, pas dépassée)', zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''a.bin'', 1, %L)', :'q1', :'dir1' || 'u3.bin')) IS NULL);
RESET ROLE;
UPDATE public.organizations SET cp_storage_quota_bytes = 1599 WHERE id = :ORG1::uuid;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('espace 1600 > limite 1599 : refusée ; la taille « déclarée » (1 octet) ne trompe pas la mesure', zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''b.bin'', 1, %L)', :'q1', :'dir1' || 'u2.bin')) LIKE '%plein%');
RESET ROLE;

-- 7. Illimité (NULL) : plus aucune barrière
UPDATE public.organizations SET cp_storage_quota_bytes = NULL WHERE id = :ORG1::uuid;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('limite NULL (illimité) : dépôt et ligne acceptés quel que soit l''espace', zz.raises(format('INSERT INTO storage.objects (bucket_id, name, metadata) VALUES (''cp-documents'', %L, ''{"size": 99999}'')', :'dir1' || 'u5.bin')) IS NULL
  AND zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''c.bin'', 1, %L)', :'q1', :'dir1' || 'u5.bin')) IS NULL);
RESET ROLE;
UPDATE public.organizations SET cp_storage_quota_bytes = 2147483648 WHERE id = :ORG1::uuid;

-- 8. Fichiers orphelins : sans ligne, sans demande d'effacement, plus vieux que 24 h
DELETE FROM storage.objects WHERE bucket_id = 'cp-documents' AND name LIKE :ORG1::text || '/%';
DELETE FROM public.cp_documents WHERE project_id = :'q1'::uuid;
DELETE FROM public.cp_document_trash;
INSERT INTO storage.objects (bucket_id, name, metadata, created_at) VALUES
  ('cp-documents', :'dir1' || 'vieux-orphelin.bin', '{"size": 10}', now() - interval '30 hours'),
  ('cp-documents', :'dir1' || 'vieux-avec-ligne.bin', '{"size": 10}', now() - interval '30 hours'),
  ('cp-documents', :'dir1' || 'vieux-en-corbeille.bin', '{"size": 10}', now() - interval '30 hours'),
  ('cp-documents', :'dir1' || 'recent-orphelin.bin', '{"size": 10}', now() - interval '2 hours'),
  ('autre-bucket', :'dir1' || 'vieux-ailleurs.bin', '{"size": 10}', now() - interval '30 hours');
INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path, organization_id) VALUES (:'q1', 'ok.bin', 10, :'dir1' || 'vieux-avec-ligne.bin', :ORG1::uuid);
INSERT INTO public.cp_document_trash (storage_path, organization_id) VALUES (:'dir1' || 'vieux-en-corbeille.bin', :ORG1::uuid);
SELECT zz.check('orphelins : seul le fichier ancien, sans ligne et sans demande d''effacement est listé', (SELECT array_agg(storage_path) FROM public.cp_orphan_documents()) = ARRAY[:'dir1' || 'vieux-orphelin.bin']);
SELECT zz.check('orphelins : un délai plus court liste aussi le récent', (SELECT count(*) FROM public.cp_orphan_documents(interval '1 hour')) = 2);
SELECT zz.check('orphelins : la liste est réservée à la clé de service', has_function_privilege('service_role', 'public.cp_orphan_documents(interval, integer)', 'execute') AND NOT has_function_privilege('authenticated', 'public.cp_orphan_documents(interval, integer)', 'execute') AND NOT has_function_privilege('anon', 'public.cp_orphan_documents(interval, integer)', 'execute'));
SET ROLE service_role;
SELECT zz.check('orphelins : la clé de service peut la lire', (SELECT count(*) FROM public.cp_orphan_documents()) = 1);
RESET ROLE;

-- Ménage
SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.cp_document_trash;
DELETE FROM storage.objects WHERE bucket_id = 'cp-documents';
DELETE FROM public.cp_projects WHERE name = 'Q1';
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
