/*
  Avis personnels : un avis adressé à une personne ne se lit que par elle, pour TOUS les types d'avis (décision de Greg, 2026-11-05).

  Constat : la règle d'accès de la table des avis (notifications_open_access, antérieure à PILOTE) laisse les personnes qui ont
  l'un des droits view_all / scan / approve / manage_stock LIRE TOUTE la table de leur entreprise. L'écran Notifications passe par
  my_notifications(), qui filtre déjà sur le destinataire : à l'écran, personne ne voit l'avis d'un autre. Mais un accès direct
  à la table (API) montrait à ce personnel les demandes validées / prêtes / refusées, les prolongations, les rappels de retour
  et les retards ADRESSÉS À D'AUTRES PERSONNES. La migration 57 avait fermé ce trou pour les seuls avis PILOTE (type « cp_ »).

  Correction : trois règles RESTRICTIVES (lecture, modification, suppression) : un avis qui a un destinataire ne se lit, ne se
  modifie et ne se supprime que par ce destinataire. Les avis SANS destinataire (alertes du magasin : stock bas, incident,
  demande à valider, sauvegarde, rapport mensuel…) ne changent pas : ils restent visibles du personnel qui a l'un des quatre droits.
  La règle de la migration 57 reste en place (un avis PILOTE sans destinataire n'est lisible par personne).

  Ce qui n'est PAS touché : l'envoi des avis (fonctions de la base exécutées avec les droits du propriétaire de la table, qui
  n'est pas soumis à ces règles), la fonction d'e-mails / notifications (clé de service), les lignes « lu / non lu » par personne.
  Les mises à jour faites par decide_request / set_request_status ne visent que les avis « demande à valider » (sans destinataire).

  Effet de bord voulu : l'effacement en masse des avis personnels d'autrui par un administrateur n'est plus possible depuis l'API ;
  le nettoyage se fait depuis l'éditeur SQL (propriétaire) ou la fonction à clé de service.
*/
DROP POLICY IF EXISTS notifications_personal_private_read ON public.notifications;
CREATE POLICY notifications_personal_private_read ON public.notifications AS RESTRICTIVE FOR SELECT TO authenticated
  USING (recipient_user_id IS NULL OR recipient_user_id = (SELECT public.app_user_id()));

DROP POLICY IF EXISTS notifications_personal_private_update ON public.notifications;
CREATE POLICY notifications_personal_private_update ON public.notifications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (recipient_user_id IS NULL OR recipient_user_id = (SELECT public.app_user_id()))
  WITH CHECK (recipient_user_id IS NULL OR recipient_user_id = (SELECT public.app_user_id()));

DROP POLICY IF EXISTS notifications_personal_private_delete ON public.notifications;
CREATE POLICY notifications_personal_private_delete ON public.notifications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (recipient_user_id IS NULL OR recipient_user_id = (SELECT public.app_user_id()));
