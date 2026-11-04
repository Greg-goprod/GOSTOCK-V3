/*
  PILOTE : les avis PILOTE ne se lisent que par leur destinataire (décision de Greg, 2026-11-04).

  Constat : la règle d'accès de la table des avis (notifications_open_access, antérieure à PILOTE) laisse les personnes qui ont
  l'un des droits view_all / scan / approve / manage_stock LIRE TOUTE la table de leur entreprise, avis personnels compris. L'écran
  Notifications passe par my_notifications(), qui filtre déjà sur le destinataire, mais un accès direct à la table (API) montrait
  à ce personnel les avis PILOTE adressés à d'autres : qui est assigné à quoi, qui rejoint quel projet, quelles dates bougent.

  Correction : une règle RESTRICTIVE en lecture : un avis dont le type commence par « cp_ » (PILOTE) ne se lit que si on en est
  le destinataire. Les autres types d'avis ne changent pas. L'envoi des avis (fonctions de la base) et la fonction d'e-mails
  (clé de service) ne sont pas concernés : ils n'ont pas besoin de cette règle de lecture.

  Effet de bord voulu : une personne qui ne « voit » pas une ligne ne peut ni la modifier ni la supprimer (la lecture est
  nécessaire à toute modification ciblée) ; l'effacement de masse des avis PILOTE d'autrui par un administrateur n'est donc plus
  possible depuis l'API.
*/
DROP POLICY IF EXISTS cp_notifications_private ON public.notifications;
CREATE POLICY cp_notifications_private ON public.notifications AS RESTRICTIVE FOR SELECT TO authenticated
  USING (left(kind, 3) <> 'cp_' OR recipient_user_id = (SELECT public.app_user_id()));
