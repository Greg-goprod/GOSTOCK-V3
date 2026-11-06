/*
  PILOTE UI-7c : un avis PILOTE doit pouvoir ouvrir le projet ou l'élément concerné (décision de Greg, 2026-11-05).

  Constat : la table des avis connaît déjà le projet (cp_project_id) et l'élément (cp_item_id), mais la fonction my_notifications(),
  par laquelle l'écran lit ses avis, ne les renvoyait pas : un clic ne pouvait mener qu'à la page « Mes tâches ».

  Correction : my_notifications() renvoie en plus cp_project_id et cp_item_id (NULL pour les avis qui ne sont pas PILOTE, ou quand
  l'avis ne vise pas d'élément précis). Les colonnes de sortie changent : la fonction est donc recréée (DROP puis CREATE), avec exactement
  les mêmes règles de visibilité et les mêmes droits qu'avant (authentifié seulement ; ni anonyme, ni PUBLIC). Aucune autre
  fonction ni vue ne dépend de celle-ci.

  Les liens vers le projet et l'élément sont supprimés avec eux (ON DELETE CASCADE) : un avis ne pointe donc jamais vers un élément
  supprimé. Le lien reste lisible par son seul destinataire (migrations 57 et 60).
*/
DROP FUNCTION IF EXISTS public.my_notifications(integer);

CREATE FUNCTION public.my_notifications(p_limit integer DEFAULT 200)
RETURNS TABLE(id uuid, kind text, title text, message text, equipment_id uuid, depot_id uuid, request_id uuid,
              vehicle_id uuid, recipient_user_id uuid, created_at timestamp with time zone, is_read boolean,
              cp_project_id uuid, cp_item_id uuid)
LANGUAGE sql STABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT n.id, n.kind, n.title, n.message, n.equipment_id, n.depot_id, n.request_id, n.vehicle_id,
         n.recipient_user_id, n.created_at, COALESCE(r.is_read, n.read_at IS NOT NULL),
         n.cp_project_id, n.cp_item_id
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

REVOKE EXECUTE ON FUNCTION public.my_notifications(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_notifications(integer) TO authenticated;
