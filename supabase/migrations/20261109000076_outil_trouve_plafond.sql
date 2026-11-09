-- Page publique « outil trouvé » : plafond d'avis par entreprise et par heure.
--
-- Contexte (remarque de revue de sécurité, vérifiée sur GO-MAT) : `report_found_tool` est appelable sans connexion et reconnaît, en plus du code QR
-- d'un exemplaire, le numéro d'article (prévisible : GOMAT-…-0001, VENOGE-000215…) et l'identifiant du matériel. Quelqu'un pouvait donc parcourir la
-- série des numéros et poser autant d'avis « Outil trouvé » (donc autant d'e-mails aux destinataires) qu'il y a de matériel.
--
-- Choix : on garde les numéros d'article (les étiquettes déjà imprimées des matériels sans QR par exemplaire portent ce numéro dans leur lien /t/…),
-- et on PLAFONNE le nombre d'avis « outil trouvé » par entreprise : 10 par heure glissante. Au-delà, la fonction répond comme avant (« vrai » :
-- l'outil existe) sans rien enregistrer, pour ne pas indiquer à un abuseur qu'il a atteint la limite. Un oubli réel (quelques outils) n'est pas gêné ;
-- le doublon d'un même outil dans la même heure reste ignoré, comme avant.
--
-- Ce que cette migration NE règle PAS : un tiers peut toujours savoir, en essayant des numéros, à quelle entreprise appartient un numéro d'article et
-- lire le téléphone et le message que l'entreprise destine à qui trouve un outil. Le supprimer demande un code secret par matériel dans le lien public
-- (étiquettes à réimprimer) : à traiter avec l'intégration dans Mannyx.
--
-- Droits, propriétaire et search_path de la fonction : inchangés (CREATE OR REPLACE conserve les droits déjà accordés).

CREATE OR REPLACE FUNCTION public.report_found_tool(p_code text, p_contact text, p_place text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid := public.found_tool_lookup(left(p_code, 100));
  v_name text;
  v_org uuid;
BEGIN
  IF v_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT name, organization_id INTO v_name, v_org FROM public.equipment WHERE id = v_id;
  -- Plafond : 10 avis « outil trouvé » par entreprise et par heure glissante ; au-delà, même réponse, rien d'enregistré
  IF (SELECT count(*) FROM public.notifications n
      WHERE n.organization_id = v_org AND n.kind = 'tool_found' AND n.created_at > now() - interval '1 hour') >= 10 THEN
    RETURN true;
  END IF;
  INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id, dedupe_key)
  VALUES (v_org, 'tool_found', 'Outil trouvé : ' || v_name,
          format('Quelqu''un a trouvé « %s » (%s). Lieu : %s. Contact : %s.', v_name, left(btrim(p_code), 60),
                 COALESCE(NULLIF(left(btrim(p_place), 200), ''), 'non précisé'), COALESCE(NULLIF(left(btrim(p_contact), 200), ''), 'non précisé')),
          v_id, 'tool_found:' || v_id || ':' || to_char(now(), 'YYYYMMDDHH24'))
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN true;
END;
$$;
