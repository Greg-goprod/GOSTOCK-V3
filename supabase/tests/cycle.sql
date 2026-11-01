-- Régression : un cycle complet (commande → sortie → retour partiel → prolongation → retour) dans CHAQUE entreprise.
-- À lancer APRÈS isolation.sql sur la même base locale. Contrôle aussi que toute ligne créée porte la bonne entreprise.
\set ON_ERROR_STOP on
\set A '''a0000000-0000-0000-0000-00000000000a'''
\set B '''b0000000-0000-0000-0000-00000000000b'''
\set ORG1 '''00000000-0000-0000-0000-000000000001'''
SELECT id AS org2 FROM public.organizations WHERE name = 'Entreprise B' \gset
\set ORG2 '''':org2''''
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
DROP TABLE IF EXISTS zz.cyc;
CREATE TABLE zz.cyc (org uuid, tool uuid, collab uuid, depot uuid);
GRANT ALL ON zz.cyc TO authenticated;
INSERT INTO public.users (organization_id, email, first_name, last_name, role) VALUES
  (:ORG1, 'collab1@iso.test', 'Col', 'Un', 'user'), (:ORG2, 'collab2@iso.test', 'Col', 'Deux', 'user');
INSERT INTO public.equipment (organization_id, name, status, total_quantity, available_quantity) VALUES
  (:ORG1, 'CYC outil 1', 'available', 3, 3), (:ORG2, 'CYC outil 2', 'available', 3, 3);
INSERT INTO zz.cyc SELECT o.id, (SELECT id FROM public.equipment WHERE organization_id = o.id AND name LIKE 'CYC outil%'),
  (SELECT id FROM public.users WHERE organization_id = o.id AND email LIKE 'collab%'), (SELECT id FROM public.depots WHERE organization_id = o.id AND is_default LIMIT 1)
FROM public.organizations o WHERE o.id IN (:ORG1::uuid, :ORG2::uuid);

DO $$
DECLARE
  r record; v_uid uuid; v_note jsonb; v_req jsonb; v_ids uuid[]; v_n integer; v_bad text;
BEGIN
  FOR r IN SELECT * FROM zz.cyc ORDER BY org LOOP
    v_uid := CASE WHEN r.org = '00000000-0000-0000-0000-000000000001' THEN 'a0000000-0000-0000-0000-00000000000a' ELSE 'b0000000-0000-0000-0000-00000000000b' END;
    PERFORM set_config('request.jwt.claim.sub', v_uid::text, false);
    PERFORM set_config('role', 'authenticated', false);
    PERFORM public.whoami();
    -- commande du collaborateur (créée par le magasin pour lui)
    v_req := to_jsonb(public.create_request(r.collab, r.depot, now() + interval '1 hour', now() + interval '3 days',
             jsonb_build_array(jsonb_build_object('kind', 'tool', 'id', r.tool, 'quantity', 2)), 'CYC', 'CYC'));
    PERFORM zz.check('cycle ' || r.org::text || ' : commande créée', v_req ->> 'id' IS NOT NULL);
    -- sortie directe de 3 exemplaires
    v_note := to_jsonb(public.create_checkout(r.collab, now() + interval '2 days', jsonb_build_array(jsonb_build_object('equipment_id', r.tool, 'quantity', 1)), 'CYC'));
    PERFORM zz.check('cycle ' || r.org::text || ' : sortie créée', v_note ->> 'id' IS NOT NULL);
    SELECT array_agg(id) INTO v_ids FROM public.checkouts WHERE delivery_note_id = (v_note ->> 'id')::uuid;
    PERFORM zz.check('cycle ' || r.org::text || ' : sortie enregistrée', coalesce(cardinality(v_ids), 0) = 1);
    PERFORM public.extend_checkouts(v_ids, now() + interval '5 days', 'CYC');
    PERFORM zz.check('cycle ' || r.org::text || ' : prolongation', (SELECT due_date FROM public.checkouts WHERE id = v_ids[1]) > now() + interval '4 days');
    PERFORM public.return_with_check(v_ids[1], 'ok', 'CYC', NULL);
    PERFORM zz.check('cycle ' || r.org::text || ' : retour', (SELECT status FROM public.checkouts WHERE id = v_ids[1]) = 'returned');
    PERFORM set_config('role', 'postgres', false);
  END LOOP;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
-- Toute ligne créée par ces cycles porte l'entreprise de la personne concernée
SELECT zz.check('entreprise cohérente : emprunts', NOT EXISTS (SELECT 1 FROM public.checkouts c JOIN public.equipment e ON e.id = c.equipment_id WHERE c.organization_id <> e.organization_id));
SELECT zz.check('entreprise cohérente : bons de sortie', NOT EXISTS (SELECT 1 FROM public.delivery_notes d JOIN public.users u ON u.id = d.user_id WHERE d.organization_id <> u.organization_id));
SELECT zz.check('entreprise cohérente : demandes', NOT EXISTS (SELECT 1 FROM public.requests r JOIN public.users u ON u.id = r.requester_id WHERE r.organization_id <> u.organization_id));
SELECT zz.check('entreprise cohérente : lignes de demande', NOT EXISTS (SELECT 1 FROM public.request_items i JOIN public.requests r ON r.id = i.request_id WHERE i.organization_id <> r.organization_id));
SELECT zz.check('entreprise cohérente : notifications', NOT EXISTS (SELECT 1 FROM public.notifications n JOIN public.users u ON u.id = n.recipient_user_id WHERE n.organization_id <> u.organization_id));
SELECT zz.check('entreprise cohérente : audit', NOT EXISTS (SELECT 1 FROM public.audit_log a JOIN public.users u ON u.id = a.user_id WHERE a.organization_id <> u.organization_id AND NOT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.auth_user_id = u.auth_user_id)
  -- exceptions voulues : l'administrateur de plateforme crée une entreprise ; la liaison du compte (whoami) met à jour la fiche de l'autre entreprise
  AND NOT (a.table_name = 'users' AND a.action = 'update')));
SELECT zz.check('entreprise cohérente : mouvements de stock', NOT EXISTS (SELECT 1 FROM public.stock_movements m JOIN public.equipment e ON e.id = m.equipment_id WHERE m.organization_id <> e.organization_id));
SELECT zz.check('numéros de demande distincts entre entreprises', (SELECT count(DISTINCT number) FROM public.requests) = (SELECT count(*) FROM public.requests));
SELECT (CASE WHEN ok THEN 'OK     ' ELSE 'ECHEC  ' END) || name || COALESCE(' — ' || detail, '') AS resultat FROM zz.results WHERE name LIKE 'cycle %' OR name LIKE 'entreprise cohérente%' OR name LIKE 'numéros%' ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM zz.results;
