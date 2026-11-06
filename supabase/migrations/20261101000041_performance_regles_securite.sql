/*
  Performance : les règles de sécurité ne recalculent plus « qui es-tu ? » pour chaque ligne lue.

  Constat (GO-MAT, compte collaborateur, 161 notifications) : compter les notifications non lues = 1 405 ms.
  Cause : 144 règles sur 227 appellent app_has('…'), app_user_id(), app_is_member() ou app_org_id()
  directement, donc une fois PAR LIGNE ; depuis le module 0, chacun de ces appels cherche l'entreprise active.
  Correctif : envelopper chaque appel dans (SELECT …). PostgreSQL le calcule alors UNE fois par requête.
  Aucun droit ne change : seul le moment du calcul change (les fonctions sont STABLE, leur réponse est
  identique pour toute la requête).

  Idempotente : un appel déjà enveloppé n'est pas touché ; rejouable sans effet.
  Ne touche ni aux données ni aux rôles. Les appels qui reçoivent une valeur de la ligne
  (app_depot_ok(depot_id), storage_path_org(name)) restent par ligne : ils en ont besoin.
*/

DO $$
DECLARE
  r record; q text; w text; n int := 0; n_storage_ignorees int := 0;
  motif_has   constant text := '(?<!SELECT )((?:public\.)?app_has\(''[a-z_]+''::text\))';
  motif_zero  constant text := '(?<!SELECT )((?:public\.)?app_(?:user_id|is_member|org_id)\(\))';
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'app_(has|user_id|is_member|org_id)\('
  LOOP
    q := r.qual; w := r.with_check;
    IF q IS NOT NULL THEN
      q := regexp_replace(regexp_replace(q, motif_has, '(SELECT \1)', 'g'), motif_zero, '(SELECT \1)', 'g');
    END IF;
    IF w IS NOT NULL THEN
      w := regexp_replace(regexp_replace(w, motif_has, '(SELECT \1)', 'g'), motif_zero, '(SELECT \1)', 'g');
    END IF;
    CONTINUE WHEN q IS NOT DISTINCT FROM r.qual AND w IS NOT DISTINCT FROM r.with_check;
    BEGIN
      EXECUTE format('ALTER POLICY %I ON %I.%I %s %s', r.policyname, r.schemaname, r.tablename,
        CASE WHEN q IS NOT NULL THEN 'USING (' || q || ')' ELSE '' END,
        CASE WHEN w IS NOT NULL THEN 'WITH CHECK (' || w || ')' ELSE '' END);
      n := n + 1;
    EXCEPTION WHEN insufficient_privilege THEN
      -- Le propriétaire des règles du stockage peut être un autre rôle : on le signale, sans bloquer le reste.
      n_storage_ignorees := n_storage_ignorees + 1;
      RAISE NOTICE 'règle non modifiée (droits insuffisants) : %.% / %', r.schemaname, r.tablename, r.policyname;
    END;
  END LOOP;
  RAISE NOTICE 'règles réécrites : % ; ignorées faute de droits : %', n, n_storage_ignorees;
END $$;

-- Les deux fonctions de notifications appelaient notification_is_mine() pour chaque ligne.
-- Même résultat, mais « qui suis-je » et « suis-je du magasin » sont calculés une seule fois.
CREATE OR REPLACE FUNCTION public.unread_notification_count()
RETURNS integer
LANGUAGE sql STABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT count(*)::integer
  FROM public.notifications n
  LEFT JOIN public.notification_reads r
    ON r.notification_id = n.id AND r.user_id = (SELECT public.app_user_id())
  WHERE (SELECT public.app_user_id()) IS NOT NULL
    AND (n.recipient_user_id = (SELECT public.app_user_id())
         OR (n.recipient_user_id IS NULL
             AND (SELECT public.app_has('view_all') OR public.app_has('scan')
                         OR public.app_has('approve') OR public.app_has('manage_stock'))))
    AND NOT COALESCE(r.is_read, n.read_at IS NOT NULL)
$$;

CREATE OR REPLACE FUNCTION public.my_notifications(p_limit integer DEFAULT 200)
RETURNS TABLE(id uuid, kind text, title text, message text, equipment_id uuid, depot_id uuid, request_id uuid,
              vehicle_id uuid, recipient_user_id uuid, created_at timestamp with time zone, is_read boolean)
LANGUAGE sql STABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT n.id, n.kind, n.title, n.message, n.equipment_id, n.depot_id, n.request_id, n.vehicle_id,
         n.recipient_user_id, n.created_at, COALESCE(r.is_read, n.read_at IS NOT NULL)
  FROM public.notifications n
  LEFT JOIN public.notification_reads r
    ON r.notification_id = n.id AND r.user_id = (SELECT public.app_user_id())
  WHERE (SELECT public.app_user_id()) IS NOT NULL
    AND (n.recipient_user_id = (SELECT public.app_user_id())
         OR (n.recipient_user_id IS NULL
             AND (SELECT public.app_has('view_all') OR public.app_has('scan')
                         OR public.app_has('approve') OR public.app_has('manage_stock'))))
  ORDER BY n.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 500))
$$;
