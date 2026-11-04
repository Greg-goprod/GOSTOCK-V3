-- Documents d'un projet ou d'un élément (migration 59) : droits (équipe et responsables déposent, les autres lisent), contrôles de ligne, règles du bucket cp-documents, corbeille des fichiers, cascade, isolation. À lancer dans l'ordre de run.sh (après isolation.sql et rbac.sql).
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

-- Le stockage de la base locale est une maquette : on y active la sécurité par ligne pour tester les règles du bucket comme sur Supabase
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated;

-- Préparation (administrateur A) : X1 (U hors équipe), X2 (U membre de l'équipe) avec un élément
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_projects (name, type) VALUES ('X1', 'admin'), ('X2', 'admin');
SELECT id AS x1 FROM public.cp_projects WHERE name = 'X1' \gset
SELECT id AS x2 FROM public.cp_projects WHERE name = 'X2' \gset
INSERT INTO public.cp_items (project_id, kind, name) VALUES (:'x2', 'task', 'X2-T'), (:'x1', 'task', 'X1-T');
SELECT id AS x2t FROM public.cp_items WHERE name = 'X2-T' \gset
SELECT id AS x1t FROM public.cp_items WHERE name = 'X1-T' \gset
INSERT INTO public.cp_project_members (project_id, user_id, role) VALUES (:'x2', :'ua', 'lead'), (:'x2', :'uu', 'member');
RESET ROLE;
SELECT zz.check('le bucket est privé, limité à 50 Mo', (SELECT NOT public AND file_size_limit = 52428800 FROM storage.buckets WHERE id = 'cp-documents'));
SELECT zz.check('le projet est lu dans le 2e dossier d''un chemin', public.cp_doc_path_project(:ORG1::text || '/' || :'x1' || '/f.pdf') = :'x1'::uuid
  AND public.cp_doc_path_project('abc/def/f.pdf') IS NULL AND public.cp_doc_path_project(NULL) IS NULL);

-- Lignes : droits, auteur imposé
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_documents (project_id, file_name, size_bytes, mime_type, storage_path, uploaded_by) VALUES (:'x1', 'plan.pdf', 1234, 'application/pdf', :ORG1::text || '/' || :'x1' || '/' || gen_random_uuid() || '-plan.pdf', :'uu');
SELECT zz.check('A (responsable) dépose sur un projet dont il n''est pas de l''équipe ; le déposant est imposé par la base', (SELECT count(*) FROM public.cp_documents WHERE project_id = :'x1'::uuid AND uploaded_by = :'ua'::uuid) = 1);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U (hors équipe, sans droit de modification) lit mais ne dépose pas', (SELECT count(*) FROM public.cp_documents WHERE project_id = :'x1'::uuid) = 1
  AND zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''piraté.pdf'', 1, %L)', :'x1', :ORG1::text || '/' || :'x1' || '/' || gen_random_uuid() || '-piraté.pdf')) IS NOT NULL);
INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (:'x2', 'projet.pdf', 10, :ORG1::text || '/' || :'x2' || '/' || gen_random_uuid() || '-projet.pdf');
INSERT INTO public.cp_documents (project_id, item_id, file_name, size_bytes, storage_path) VALUES (:'x2', :'x2t', 'tache.docx', 20, :ORG1::text || '/' || :'x2' || '/' || gen_random_uuid() || '-tache.docx');
SELECT zz.check('U (membre de l''équipe) dépose sur le projet et sur un élément', (SELECT count(*) FROM public.cp_documents WHERE uploaded_by = :'uu'::uuid AND project_id = :'x2'::uuid) = 2);
-- Contrôles de ligne
SELECT zz.check('un chemin dans le dossier d''une AUTRE entreprise est refusé', zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''a.pdf'', 1, %L)', :'x2', gen_random_uuid() || '/' || :'x2' || '/a.pdf')) LIKE '%dossier de ce projet%');
SELECT zz.check('un chemin dans le dossier d''un AUTRE projet est refusé', zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''a.pdf'', 1, %L)', :'x2', :ORG1::text || '/' || :'x1' || '/a.pdf')) LIKE '%dossier de ce projet%');
SELECT zz.check('un élément d''un autre projet est refusé', zz.raises(format('INSERT INTO public.cp_documents (project_id, item_id, file_name, size_bytes, storage_path) VALUES (%L, %L, ''a.pdf'', 1, %L)', :'x2', :'x1t', :ORG1::text || '/' || :'x2' || '/a.pdf')) LIKE '%pas dans ce projet%');
SELECT zz.check('exécutables, scripts et pages web refusés (majuscules comprises)', zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''setup.EXE'', 1, %L)', :'x2', :ORG1::text || '/' || :'x2' || '/s.exe')) LIKE '%pas accepté%'
  AND zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''page.html'', 1, %L)', :'x2', :ORG1::text || '/' || :'x2' || '/p.html')) LIKE '%pas accepté%'
  AND zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''dessin.svg'', 1, %L)', :'x2', :ORG1::text || '/' || :'x2' || '/d.svg')) LIKE '%pas accepté%'
  AND zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''run.ps1'', 1, %L)', :'x2', :ORG1::text || '/' || :'x2' || '/r.ps1')) LIKE '%pas accepté%');
SELECT zz.check('types courants acceptés (pdf, images, Office, zip, dwg, csv)', zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''photo.JPG'', 1, %L), (%L, ''budget.xlsx'', 1, %L), (%L, ''plans.zip'', 1, %L), (%L, ''coupe.dwg'', 1, %L), (%L, ''liste.csv'', 1, %L)',
  :'x2', :ORG1::text || '/' || :'x2' || '/1', :'x2', :ORG1::text || '/' || :'x2' || '/2', :'x2', :ORG1::text || '/' || :'x2' || '/3', :'x2', :ORG1::text || '/' || :'x2' || '/4', :'x2', :ORG1::text || '/' || :'x2' || '/5')) IS NULL);
SELECT zz.check('50 Mo acceptés, 50 Mo + 1 octet refusés', zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''gros.zip'', 52428800, %L)', :'x2', :ORG1::text || '/' || :'x2' || '/g1')) IS NULL
  AND zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''trop.zip'', 52428801, %L)', :'x2', :ORG1::text || '/' || :'x2' || '/g2')) IS NOT NULL);
SELECT zz.check('nom vide ou avec un séparateur de dossier refusé', zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''  '', 1, %L)', :'x2', :ORG1::text || '/' || :'x2' || '/e1')) IS NOT NULL
  AND zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''../a.pdf'', 1, %L)', :'x2', :ORG1::text || '/' || :'x2' || '/e2')) IS NOT NULL);
SELECT zz.check('un document ne se modifie pas', zz.affected($$UPDATE public.cp_documents SET file_name = 'autre.pdf'$$) = 0);
RESET ROLE;
-- Suppression des lignes : le sien ; modération avec le droit de suppression ; chaque suppression met le fichier à la corbeille
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('U supprime son document, pas celui d''un autre', zz.affected($$DELETE FROM public.cp_documents WHERE file_name = 'projet.pdf'$$) = 1 AND zz.affected($$DELETE FROM public.cp_documents WHERE file_name = 'plan.pdf'$$) = 0);
RESET ROLE;
SELECT zz.check('le fichier supprimé est mis à la corbeille (effacement physique par la fonction d''e-mails)', (SELECT count(*) FROM public.cp_document_trash WHERE storage_path LIKE :ORG1::text || '/' || :'x2' || '/%-projet.pdf') = 1);
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A (droit de suppression) supprime le document d''un autre', zz.affected($$DELETE FROM public.cp_documents WHERE file_name = 'tache.docx'$$) = 1);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('la corbeille est inaccessible aux utilisateurs', zz.raises($$SELECT count(*) FROM public.cp_document_trash$$) IS NOT NULL AND zz.raises($$INSERT INTO public.cp_document_trash (storage_path, organization_id) VALUES ('x', gen_random_uuid())$$) IS NOT NULL);
RESET ROLE;

-- Règles du bucket : déposer / lire / supprimer un orphelin
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('A (responsable) dépose un fichier dans le dossier du projet', zz.raises(format('INSERT INTO storage.objects (bucket_id, name) VALUES (''cp-documents'', %L)', :ORG1::text || '/' || :'x1' || '/doc-a.pdf')) IS NULL);
SELECT zz.check('un dépôt dans le dossier d''une autre entreprise ou d''un projet inconnu est refusé', zz.raises(format('INSERT INTO storage.objects (bucket_id, name) VALUES (''cp-documents'', %L)', gen_random_uuid() || '/' || :'x1' || '/a.pdf')) IS NOT NULL
  AND zz.raises(format('INSERT INTO storage.objects (bucket_id, name) VALUES (''cp-documents'', %L)', :ORG1::text || '/' || gen_random_uuid() || '/a.pdf')) IS NOT NULL
  AND zz.raises(format('INSERT INTO storage.objects (bucket_id, name) VALUES (''cp-documents'', %L)', :ORG1::text || '/a.pdf')) IS NOT NULL);
SELECT zz.check('sans ligne dans cp_documents, le fichier est visible de celui qui écrit dans le projet (dépôt en cours)', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'cp-documents') = 1);
INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (:'x1', 'doc-a.pdf', 5, :ORG1::text || '/' || :'x1' || '/doc-a.pdf');
SELECT zz.check('avec sa ligne, le fichier reste lisible', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'cp-documents' AND name = :ORG1::text || '/' || :'x1' || '/doc-a.pdf') = 1);
RESET ROLE;
-- Avant que la ligne existe, U (lecteur, hors équipe) ne voyait pas le fichier : on le vérifie sur un second fichier sans ligne
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO storage.objects (bucket_id, name) VALUES ('cp-documents', :ORG1::text || '/' || :'x1' || '/sans-ligne.pdf');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('un lecteur ne voit PAS un fichier sans ligne', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'cp-documents' AND name = :ORG1::text || '/' || :'x1' || '/sans-ligne.pdf') = 0);
SELECT zz.check('U (lecteur) lit le fichier mais ne dépose pas dans X1', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'cp-documents' AND name = :ORG1::text || '/' || :'x1' || '/doc-a.pdf') = 1
  AND zz.raises(format('INSERT INTO storage.objects (bucket_id, name) VALUES (''cp-documents'', %L)', :ORG1::text || '/' || :'x1' || '/doc-u.pdf')) IS NOT NULL);
SELECT zz.check('U (membre de l''équipe de X2) dépose dans X2', zz.raises(format('INSERT INTO storage.objects (bucket_id, name) VALUES (''cp-documents'', %L)', :ORG1::text || '/' || :'x2' || '/doc-u.pdf')) IS NULL);
SELECT zz.check('un fichier sans ligne se supprime par ceux qui écrivent dans le projet (dépôt interrompu), pas un fichier qui a sa ligne', zz.affected(format('DELETE FROM storage.objects WHERE bucket_id = ''cp-documents'' AND name = %L', :ORG1::text || '/' || :'x2' || '/doc-u.pdf')) = 1
  AND zz.affected(format('DELETE FROM storage.objects WHERE bucket_id = ''cp-documents'' AND name = %L', :ORG1::text || '/' || :'x1' || '/doc-a.pdf')) = 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :B, false); SET ROLE authenticated;
SELECT zz.check('B (autre entreprise) ne lit aucun fichier de A et ne dépose pas dans son dossier', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'cp-documents') = 0
  AND zz.raises(format('INSERT INTO storage.objects (bucket_id, name) VALUES (''cp-documents'', %L)', :ORG1::text || '/' || :'x1' || '/volé.pdf')) IS NOT NULL
  AND (SELECT count(*) FROM public.cp_documents) = 0 AND zz.raises(format('INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (%L, ''v.pdf'', 1, %L)', :'x1', :ORG1::text || '/' || :'x1' || '/v.pdf')) IS NOT NULL);
RESET ROLE;
-- Une ligne supprimée rend le fichier illisible tout de suite (avant l'effacement physique)
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
DELETE FROM public.cp_documents WHERE file_name = 'doc-a.pdf';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :U, false); SET ROLE authenticated;
SELECT zz.check('ligne supprimée : les lecteurs ne lisent plus le fichier (il existe encore, en attente d''effacement par la fonction d''e-mails)', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'cp-documents' AND name = :ORG1::text || '/' || :'x1' || '/doc-a.pdf') = 0);
RESET ROLE;
SELECT zz.check('…et il est bien à la corbeille', (SELECT count(*) FROM public.cp_document_trash WHERE storage_path = :ORG1::text || '/' || :'x1' || '/doc-a.pdf') = 1 AND (SELECT count(*) FROM storage.objects WHERE bucket_id = 'cp-documents' AND name = :ORG1::text || '/' || :'x1' || '/doc-a.pdf') = 1);

-- Cascade : élément et projet supprimés → lignes supprimées → fichiers à la corbeille
DELETE FROM public.cp_document_trash;
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
INSERT INTO public.cp_documents (project_id, item_id, file_name, size_bytes, storage_path) VALUES (:'x2', :'x2t', 'sur-tache.pdf', 1, :ORG1::text || '/' || :'x2' || '/casc-1.pdf');
INSERT INTO public.cp_documents (project_id, file_name, size_bytes, storage_path) VALUES (:'x2', 'sur-projet.pdf', 1, :ORG1::text || '/' || :'x2' || '/casc-2.pdf');
DELETE FROM public.cp_items WHERE id = :'x2t'::uuid;
SELECT zz.check('supprimer un élément supprime ses documents', (SELECT count(*) FROM public.cp_documents WHERE file_name = 'sur-tache.pdf') = 0 AND (SELECT count(*) FROM public.cp_documents WHERE file_name = 'sur-projet.pdf') = 1);
DELETE FROM public.cp_projects WHERE id = :'x2'::uuid;
RESET ROLE;
SELECT zz.check('supprimer un projet supprime ses documents ; TOUS les fichiers (élément et projet) vont à la corbeille', (SELECT count(*) FROM public.cp_documents WHERE project_id = :'x2'::uuid) = 0
  AND (SELECT count(*) FROM public.cp_document_trash WHERE storage_path IN (:ORG1::text || '/' || :'x2' || '/casc-1.pdf', :ORG1::text || '/' || :'x2' || '/casc-2.pdf')) = 2);

-- Module désactivé, journal d'audit, droits d'exécution
SELECT zz.check('le journal d''audit garde la trace des documents', (SELECT count(*) FROM public.audit_log WHERE table_name = 'cp_documents') >= 5);
DELETE FROM public.organization_modules WHERE organization_id = :ORG1::uuid AND module_key = 'cp.projects';
SELECT set_config('request.jwt.claim.sub', :A, false); SET ROLE authenticated;
SELECT zz.check('module désactivé : même l''administrateur ne lit ni ne dépose', (SELECT count(*) FROM public.cp_documents) = 0
  AND zz.raises(format('INSERT INTO storage.objects (bucket_id, name) VALUES (''cp-documents'', %L)', :ORG1::text || '/' || :'x1' || '/m.pdf')) IS NOT NULL);
RESET ROLE;
SELECT zz.check('le droit d''exécution de cp_doc_path_project n''est pas ouvert au public anonyme', NOT has_function_privilege('anon', 'public.cp_doc_path_project(text)', 'EXECUTE'));

-- Ménage
SELECT set_config('app.org_guard_off', 'on', false);
DELETE FROM public.cp_document_trash;
DELETE FROM storage.objects WHERE bucket_id = 'cp-documents';
DELETE FROM public.cp_projects WHERE name IN ('X1', 'X2');
SELECT set_config('app.org_guard_off', '', false);
DELETE FROM public.organization_modules WHERE module_key = 'cp.projects';

SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name AS resultat FROM zz.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
