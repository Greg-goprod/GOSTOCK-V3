import type { HelpArticle } from '../types';

export const PILOTE: HelpArticle[] = [
  {
    id: 'projets-pilote',
    category: 'pilote',
    title: 'Les projets',
    summary: 'Chantier, R&D, conception, recrutement, administratif, évènement : un projet, son état, ses dates et ses responsables. Module payant, activé par la plateforme.',
    route: '/pilote/projets',
    routes: ['/pilote/projets'],
    where: 'PILOTE › Projets.',
    tasks: [
      {
        id: 'creer',
        title: 'Créer un projet',
        who: 'Administrateur et responsable (les autres lisent).',
        steps: [
          { text: 'Ouvre « PILOTE », puis « Projets », et clique sur « Nouveau projet ».' },
          { text: 'Donne un « Nom du projet » et choisis son « Type » : Chantier, R&D, Conception, Recrutement, Administratif ou Évènement.' },
          { text: 'Choisis l\'« État » (« Pas commencé » par défaut), la « Priorité » et les dates « Début » et « Fin ».' },
          { text: 'Compose l\'« Équipe » : pour chaque personne, choisis « Responsable » ou « Membre » (« Pas dans l\'équipe » par défaut). Tu peux en choisir plusieurs.' },
          { text: 'Pour un projet de type Chantier, « Chantier de Logistique » le relie au chantier déjà suivi dans Logistique (un chantier n\'a qu\'un projet).' },
          { text: 'Clique sur « Enregistrer ».' },
        ],
        result: 'Le projet apparaît en carte et en liste (bouton d\'affichage à droite). Les boutons d\'état en haut comptent les projets de chaque famille et filtrent la liste.',
        problems: [
          { if: 'Tu ne vois pas « PILOTE » dans le menu.', then: 'Le module n\'est pas activé pour ton entreprise : il l\'active dans la console de la plateforme.' },
          { if: 'Tu ne vois pas « Nouveau projet ».', then: 'Tu as la lecture seule : seuls l\'administrateur et le responsable créent et modifient.' },
          { if: '« La fin doit être après le début ».', then: 'Corrige les dates.' },
        ],
      },
      {
        id: 'equipe',
        title: 'Composer l\'équipe et assigner des tâches',
        who: 'Administrateur et responsable (les autres lisent).',
        steps: [
          { text: 'Dans « Projets », clique sur « Modifier » sur la carte du projet.' },
          { text: 'Dans « Équipe », choisis pour chaque personne « Membre » ou « Responsable ». Les membres font le travail, les responsables sont ceux qui suivent le projet.' },
          { text: 'Clique sur « Enregistrer ».' },
          { text: 'Ouvre une tâche (dans « Gantt » ou « Mes tâches ») : la liste « Assignés » propose les personnes de l\'équipe, tu en coches une ou plusieurs.' },
        ],
        result: 'Une tâche ne s\'assigne qu\'à une personne de l\'équipe du projet. Retirer quelqu\'un de l\'équipe le désassigne aussi de toutes les tâches du projet. Chacun retrouve ses tâches dans l\'onglet « Mes tâches » : en retard, à faire, sans date, terminées.',
        problems: [
          { if: 'La liste « Assignés » est vide.', then: 'L\'équipe du projet est vide : ajoute d\'abord des personnes dans « Modifier le projet ».' },
          { if: '« Cette personne ne fait pas partie de l\'équipe du projet ».', then: 'Ajoute-la à l\'équipe du projet, puis assigne-la.' },
        ],
      },
      {
        id: 'avis',
        title: 'Être prévenu : les avis PILOTE',
        who: 'Tout le monde, dans une entreprise qui a PILOTE.',
        steps: [
          { text: 'Ouvre « Notifications » (la cloche en haut) : les avis PILOTE sont dans la famille « PILOTE ».' },
          { text: 'Clique sur un avis : il ouvre directement la fiche de la tâche (ou du projet) concernée et il est marqué comme lu. Un avis de nouveau message ouvre la fiche sur la discussion.' },
          { text: 'En haut de la page, « Mes avis PILOTE » : pour chaque événement, coche « Dans l\'application », « E-mail » et/ou « Push ».' },
          { text: 'Deux événements sont à toi de régler : « On me mentionne dans une discussion » (dans l\'application seulement au départ ; coche E-mail et/ou Push si tu veux être prévenu ailleurs) et « Mon récapitulatif du jour » (un seul avis chaque jour ouvré : ce que tu dois terminer aujourd\'hui, ce qui est en retard, tes avis non lus ; rien à signaler = rien reçu).' },
          { text: 'Administrateur : sous ces choix, « Heure du récapitulatif quotidien » règle l\'heure d\'envoi pour toute l\'entreprise (heure de Zurich, 7 h 00 par défaut). Le récapitulatif part dans l\'heure qui suit, du lundi au vendredi, sauf les jours de fermeture du calendrier de travail.' },
        ],
        result: 'Tu reçois un avis quand on t\'assigne une tâche, quand on t\'ajoute à une équipe, quand les dates d\'un de tes éléments changent (plusieurs changements rapprochés = un seul avis), la veille et le jour d\'une échéance, et les 3 jours qui suivent un retard. Tu ne reçois jamais d\'avis pour ce que tu fais toi-même, ni pour les éléments terminés ou annulés.',
        problems: [
          { if: 'Je ne reçois pas d\'e-mail.', then: 'Vérifie que « E-mail » est coché pour cet événement (« dates modifiées » n\'envoie pas d\'e-mail par défaut) et que ton adresse est renseignée dans ta fiche.' },
          { if: 'Je ne reçois pas de notification push.', then: 'Active d\'abord les notifications sur cet appareil avec le bouton en haut de la page Notifications, puis coche « Push ».' },
          { if: 'Je ne reçois plus aucun avis d\'un type.', then: 'Tu as décoché « Dans l\'application » pour cet événement : recoche-le.' },
          { if: 'Je ne reçois pas mon récapitulatif du jour.', then: 'Il n\'est envoyé que s\'il y a quelque chose à signaler, du lundi au vendredi (pas les jours de fermeture), dans l\'heure qui suit l\'heure réglée par l\'administrateur, et seulement si « Dans l\'application » est coché pour cet événement. Les éléments de modèle, terminés ou annulés ne comptent pas.' },
          { if: 'Un clic sur un avis m\'affiche « Cet élément n\'existe plus ».', then: 'L\'élément vient d\'être supprimé, ou tu n\'y as plus accès. Demande au responsable du projet.' },
        ],
      },
      {
        id: 'echanger',
        title: 'Discuter et joindre des fichiers',
        who: 'L\'équipe du projet et les responsables écrivent et ajoutent des fichiers ; les autres personnes lisent et téléchargent.',
        steps: [
          { text: 'Ouvre la fiche d\'un projet (« Modifier » sur sa carte) ou d\'une tâche (un clic sur son nom ou sa barre) : en bas, deux sections, « Documents » et « Discussion ».' },
          { text: 'Discussion : écris ton message puis « Envoyer » (Ctrl+Entrée marche aussi). Tu peux modifier ou supprimer tes messages ; les personnes de l\'équipe sont prévenues par un avis.' },
          { text: 'Mentionner quelqu\'un : tape @ puis le début de son nom (« @An »), choisis dans la liste à la souris ou avec les flèches et Entrée. Le message surligne le nom et la personne reçoit un avis qui ouvre la discussion. Seul le texte compte : GO-Mat repère lui-même les noms écrits « @Prénom Nom » (majuscules indifférentes). Une adresse e-mail (contact@…) n\'est pas une mention. Les personnes inactives ne sont pas mentionnables ; 20 mentions au plus par message. Modifier un message n\'avertit que les personnes ajoutées.' },
          { text: 'Documents : « Ajouter des fichiers », ou glisse-les dans le cadre. 50 Mo au plus par fichier ; les exécutables, scripts et pages web sont refusés. Clique sur le nom d\'un fichier pour le télécharger.' },
          { text: 'Un clic sur le titre d\'une section la replie ou la déplie ; ton choix est retenu sur cet appareil.' },
        ],
        result: 'Les écrans PILOTE se mettent à jour d\'eux-mêmes quand quelqu\'un d\'autre modifie un projet, une tâche, une équipe ou une discussion (si l\'administrateur de la base a activé le temps réel) ; pendant qu\'une fiche est ouverte, rien ne bouge sous tes doigts, la mise à jour se fait à sa fermeture. Les messages et les fichiers restent attachés à la tâche ou au projet. Un document supprimé devient aussitôt illisible ; le fichier est effacé du stockage dans les minutes qui suivent.',
        problems: [
          { if: 'Deux personnes ont le même nom : laquelle est mentionnée ?', then: 'Les deux, car GO-Mat ne distingue que le texte du nom. Les noms trop proches (« Anne Dupont » et « Anne Dupont-Martin ») sont bien distingués, mais deux personnes au nom identique sont toutes les deux averties.' },
          { if: 'Mon fichier est refusé.', then: 'Vérifie sa taille (50 Mo au plus) et son type : les exécutables, scripts et pages web ne sont pas acceptés.' },
          { if: 'Un message m\'indique « L\'espace de stockage de l\'entreprise est plein ».', then: 'Ton entreprise a atteint sa limite de documents (2 Go par défaut). Supprime des documents devenus inutiles : l\'espace se libère quelques minutes après. Pour une limite plus grande, demande à l\'administrateur de la plateforme.' },
          { if: 'Je ne peux ni écrire ni ajouter de fichier.', then: 'Seules les personnes de l\'équipe du projet et les responsables le peuvent : demande à un responsable de t\'ajouter à l\'équipe.' },
        ],
      },
      {
        id: 'etats',
        title: 'Ajouter un état d\'avancement',
        who: 'Administrateur et responsable.',
        steps: [
          { text: 'Onglet « États ». Les 4 états de base (Pas commencé, En cours, Terminé, Annulé) se renomment et se recolorent, mais ne se suppriment pas.' },
          { text: 'Clique sur « Nouvel état », donne un nom (« En validation ») et choisis sa « Famille » : elle décide des compteurs et des filtres. Elle ne change plus après la création.' },
        ],
        problems: [
          { if: '« Impossible : cet élément est encore utilisé ».', then: 'Un projet a encore cet état : change l\'état du projet avant de supprimer l\'état.' },
        ],
      },
    ],
  },
  {
    id: 'gantt-pilote',
    category: 'pilote',
    title: 'Le Gantt',
    summary: 'Tous tes projets, phases, tâches et jalons sur une même échelle de temps. Module payant, activé par la plateforme.',
    route: '/pilote/gantt',
    routes: ['/pilote/gantt'],
    where: 'PILOTE › Projets › Gantt.',
    tasks: [
      {
        id: 'lire',
        title: 'Lire le Gantt',
        steps: [
          { text: 'Ouvre « PILOTE », « Projets », puis choisis la vue « Gantt » dans le menu « Vue » (en haut à gauche). La liste est à gauche, les barres à droite ; la ligne rouge verticale est aujourd\'hui et les week-ends sont grisés.' },
          { text: 'Les projets sont rangés par « État » (par défaut) : ouvre « Grouper » pour choisir « Type ». Un groupe se plie et se déplie avec sa flèche.' },
          { text: 'Au départ, seuls les groupes et les projets sont visibles. Clique sur la flèche d\'un projet pour voir ses phases et tâches, ou ouvre le menu « … » : « Tout déplier » puis « Replier » (retour à l\'ouverture de départ).' },
          { text: 'Ouvre « Échelle » pour choisir la période affichée : 1 jour, 1 semaine, 2 semaines, 1 mois, 3 mois, 6 mois ou 1 année (le plan annuel), ou « Période libre… » avec le sélecteur de dates (1er clic = début, 2e clic = fin). Les flèches et « Aujourd\'hui » déplacent la fenêtre.' },
          { text: 'Un losange est un jalon. La partie pleine d\'une barre est l\'avancement : la part d\'éléments terminés en dessous (un élément annulé ne compte pas). Une phase ou un projet sans dates propres prend celles de ses éléments.' },
        ],
        problems: [
          { if: 'Je ne vois aucune barre.', then: 'Les barres sont peut-être hors de l\'écran : clique sur « Aujourd\'hui », ou fais défiler vers la date du projet. Un élément sans date se trouve dans le menu « Sans date (n) » en haut à droite.' },
        ],
      },
      {
        id: 'tableau-calendrier',
        title: 'Le Tableau par état et le Calendrier',
        steps: [
          { text: 'Sur la page « Projets », la vue « Tableau » (menu « Vue ») range tes tâches et jalons en colonnes, une par état (Pas commencé, En cours, Terminé…). Le bouton « Projets » en haut du tableau affiche à la place les projets eux-mêmes.' },
          { text: 'Pour changer l\'état d\'une carte, glisse-la dans une autre colonne (réservé à qui peut modifier), ou ouvre le menu « … » de la carte puis « Déplacer vers » : c\'est la méthode au clavier et au téléphone. Si quelqu\'un a modifié la carte entre-temps, elle n\'est pas écrasée : un message te le dit et le tableau se recharge.' },
          { text: 'Un clic sur le nom d\'une carte ouvre sa fiche. Les phases n\'ont pas de carte (elles regroupent des tâches qui ont la leur). Un triangle rouge et une date en rouge signalent un retard.' },
          { text: 'La vue « Calendrier » (menu « Vue ») montre les éléments datés sur un mois ou une semaine : chaque élément est une barre qui le suit d\'un bout à l\'autre, les week-ends sont grisés, les jours fériés et fermetures du calendrier de travail sont en ambre, et aujourd\'hui est entouré. S\'il y a trop d\'éléments un jour, « +n » ouvre la semaine.' },
          { text: 'Les mêmes recherche, filtres (personne, état, priorité, type, en retard) et vues enregistrées que le Gantt sont proposés dans le Tableau et le Calendrier.' },
        ],
        problems: [
          { if: 'Un élément n\'apparaît pas dans le Calendrier.', then: 'Il n\'a probablement pas de date : place-le depuis le Gantt (menu « Sans date »). Un filtre actif peut aussi le masquer : « Tout afficher ».' },
        ],
      },
      {
        id: 'exporter',
        title: 'Exporter et imprimer',
        steps: [
          { text: 'Le bouton « Exporter » (Gantt, Tableau et Calendrier) reprend exactement ce qui est affiché : si tu as filtré, seuls ces éléments sont exportés.' },
          { text: '« Excel » crée un classeur de deux feuilles (« Projets » et « Tâches et jalons ») avec état, priorité, dates, jours ouvrés, avancement, retard et assignés. Les « CSV » sont la même chose en texte, séparés par des points-virgules, lisibles par Excel (accents compris).' },
          { text: '« Calendrier (.ics) » crée un fichier d\'événements « journée entière » (une tâche, une sous-tâche ou un jalon daté = un événement) que tu ouvres dans Outlook, Google Agenda, Apple Calendrier… C\'est un instantané du jour : il ne se met pas à jour tout seul, il faut en exporter un nouveau pour mettre ton agenda à jour.' },
          { text: '« Imprimer / PDF » (Gantt et Calendrier) imprime seulement la vue, en paysage A4, avec un titre et la date. Dans la fenêtre d\'impression du navigateur, choisis « Enregistrer au format PDF » pour obtenir un fichier. Le Gantt s\'imprime sur la période affichée : règle l\'échelle avant d\'imprimer.' },
        ],
        problems: [
          { if: 'Mon agenda n\'est pas à jour après un changement dans PILOTE.', then: 'Le fichier .ics est un instantané : exporte-le de nouveau, et supprime l\'ancien calendrier importé pour éviter les doublons.' },
        ],
      },
      {
        id: 'charge',
        title: 'Estimer les heures et suivre la charge de chacun',
        who: 'Estimer : administrateur et responsable. Voir : toute personne qui voit les projets.',
        steps: [
          { text: 'Ouvre une tâche ou une sous-tâche et renseigne « Estimation (heures) ». Laisse vide si tu ne sais pas : la tâche n\'entre alors pas dans la charge. Estime les éléments les plus fins : une tâche qui a des sous-tâches n\'a pas besoin de la sienne (sinon ses heures s\'ajoutent à celles des sous-tâches).' },
          { text: 'Dans « Pilotage › Charge », chaque ligne est une personne et chaque colonne une semaine (8 semaines, les flèches avancent de 4 semaines). Les heures d\'une tâche sont réparties sur ses jours ouvrés (sans week-ends, jours fériés ni fermetures) et partagées à parts égales entre ses assignés.' },
          { text: 'Une case affiche « heures / capacité de la semaine » : vert jusqu\'à 80 %, orange jusqu\'à 100 %, rouge au-delà (surcharge). La capacité d\'une semaine avec un jour férié est réduite d\'autant (40 h → 32 h). Clique sur une case pour voir quelles tâches la composent et ouvrir leur fiche.' },
          { text: 'La colonne « h / semaine » est la capacité de la personne (40 h par défaut) : change-la pour un temps partiel (modification réservée à qui peut modifier les projets). « À estimer » en bas liste les tâches assignées sans estimation, qui ne comptent pas encore.' },
        ],
        problems: [
          { if: 'Une personne n\'apparaît pas dans la charge.', then: 'Seules les personnes qui sont dans l\'équipe d\'un projet, assignées à une tâche ou dont la capacité a été saisie apparaissent.' },
          { if: 'Mes estimations ne comptent pas.', then: 'Il faut que la tâche soit assignée à quelqu\'un, qu\'elle ait une date, et qu\'elle ne soit pas annulée. Une tâche terminée compte (c\'est la charge réalisée de la période).' },
        ],
      },
      {
        id: 'ressources',
        title: 'Matériel et véhicules d\'une tâche',
        who: 'Rattacher : administrateur et responsable (droit de modifier les projets). Voir : toute personne qui voit les projets.',
        steps: [
          { text: 'Ouvre une tâche (ou un jalon, une sous-tâche), section « Matériel et véhicules ». Choisis « Matériel » ou « Véhicule », tape le début du nom (2 lettres au moins pour un article, une plaque pour un véhicule) puis « Ajouter ». Règle ensuite la quantité d\'un article (un véhicule compte pour 1) ; la corbeille retire le rattachement.' },
          { text: 'GO-Mat compare avec Logistique sur les dates de la tâche (du premier au dernier jour) : stock libre après les demandes validées, les emprunts en cours et la maintenance, véhicule en maintenance, expertise ou service échus, véhicule déjà réservé. Il retire aussi ce que d\'AUTRES tâches PILOTE prévoient sur des jours qui se chevauchent : deux tâches qui veulent le même camion le même jour sont signalées toutes les deux.' },
          { text: 'Un rattachement à vérifier s\'affiche sur fond ambre avec la raison dans la fiche, et un petit colis barré apparaît à côté du nom de la tâche dans le Gantt (survole-le pour lire la raison). Les tâches terminées ou annulées, les modèles et les tâches sans date ne comptent pas.' },
          { text: 'C\'est UN AVERTISSEMENT : rien n\'est bloqué et RIEN n\'est réservé dans Logistique. Pour réserver vraiment, fais la demande de matériel ou de véhicule comme d\'habitude. Dupliquer un projet, l\'enregistrer comme modèle ou en créer un depuis un modèle garde le matériel et les véhicules (les avertissements se recalculent sur les nouvelles dates).' },
        ],
        problems: [
          { if: 'Rien n\'est signalé alors que je sais que le stock manque.', then: 'Vérifie que la tâche a une date. Les avertissements se calculent avec ce que ton rôle peut lire de Logistique : sans accès aux sorties de matériel, les emprunts en cours ne sont pas comptés. Les kits et les formations ne sont pas encore rattachables.' },
          { if: 'Un article que je cherche n\'apparaît pas.', then: 'Les articles retirés du service ne sont pas proposés ; il faut taper au moins 2 lettres de son nom.' },
        ],
      },
      {
        id: 'repetition',
        title: 'Répéter une tâche (chaque semaine, mois ou année)',
        who: 'Répéter : administrateur et responsable (droits de création et de modification). Supprimer les suivantes : droit de suppression.',
        steps: [
          { text: 'Ouvre la tâche (elle doit avoir au moins une date), section « Répétition », puis « Répéter… ». Choisis « Chaque semaine », « Chaque mois » ou « Chaque année » et le nombre de répétitions (1 à 52). Un aperçu montre les premières dates et la dernière.' },
          { text: 'Les occurrences sont créées d\'un coup. Chacune garde la même durée et copie le nom, la description, l\'estimation, la liste à cocher (décochée), les personnes assignées, le matériel, les véhicules et les intervenants externes. Elle repart à « pas commencé ». Si la tâche a des SOUS-TÂCHES, chaque occurrence reçoit sa propre copie, au même écart que dans l\'original (avec leur liste à cocher décochée, leurs personnes, leur matériel et leurs intervenants). Les dépendances ne sont pas copiées, et les personnes assignées ne reçoivent pas un avis par occurrence.' },
          { text: 'Chaque mois : le même quantième, recalé sur la fin du mois (le 31 janvier donne le 28 février, puis le 31 mars). Chaque année : le 29 février donne le 28 février les années non bissextiles. Par défaut les week-ends et les jours fériés ne sont pas évités ; coche « Éviter les week-ends et les jours non travaillés » dans la fenêtre pour qu\'une occurrence qui tombe un jour non ouvré (samedi, dimanche, jour du calendrier de travail) soit avancée au prochain jour ouvré. La durée est conservée, et l\'aperçu montre déjà les dates décalées.' },
          { text: 'L\'en-tête « Répétition (3 sur 12) » dit où tu en es dans la série. Pour la prolonger, ouvre sa DERNIÈRE occurrence puis « Prolonger la série… » (200 occurrences au plus). « Supprimer les suivantes » retire les occurrences après celle-ci, sauf celles qui sont déjà commencées ou qui ont du temps saisi, des messages ou des documents : elles sont gardées et comptées.' },
        ],
        problems: [
          { if: 'Le bouton « Répéter… » n\'apparaît pas.', then: 'Une phase ne se répète pas (répète ses tâches une à une) et un élément sans aucune date non plus. Il faut aussi les droits de création et de modification des projets.' },
          { if: 'Je modifie une occurrence : les autres changent-elles ?', then: 'Non. Chaque occurrence est ensuite indépendante ; seul le lien « série » les relie, pour pouvoir les prolonger ou les supprimer ensemble.' },
        ],
      },
      {
        id: 'externes',
        title: 'Intervenants externes (sans compte GO-Mat)',
        who: 'Gérer et assigner : droit de modifier les projets. Voir : toute personne qui voit les projets.',
        steps: [
          { text: 'Dans une tâche, section « Intervenants externes » : choisis un intervenant existant puis « Ajouter », ou tape un nom (et une société) puis « Créer et ajouter ».' },
          { text: 'La liste complète se gère dans l\'icône des réglages des projets › « Intervenants externes » : nom, société, note, actif ou non. Désactiver un intervenant le retire des choix sans l\'enlever des tâches où il est déjà ; le supprimer l\'enlève de toutes les tâches.' },
        ],
        result: 'Un intervenant externe est un NOM assigné à une tâche. Il ne se connecte pas, ne reçoit aucun avis et n\'apparaît pas dans la Charge (il n\'a ni capacité ni compte). Il figure dans les exports Excel, CSV et calendrier (colonne « Intervenants externes »). Répéter une tâche les copie ; dupliquer un projet les copie seulement si tu coches « Les assignations des tâches » (un modèle ne les copie jamais).',
        problems: [
          { if: 'Je ne peux pas créer un intervenant : « existe déjà ».', then: 'Même nom et même société qu\'un intervenant existant (majuscules et espaces indifférents). Ajoute une société pour distinguer deux personnes de même nom.' },
        ],
      },
      {
        id: 'temps',
        title: 'Temps passé : chronomètre et saisie',
        who: 'Saisir : l\'équipe du projet et les personnes qui peuvent modifier les projets, pour leur propre temps. Voir tout le temps du projet : droit de modifier les projets.',
        steps: [
          { text: 'Dans une tâche, section « Temps passé ». « Démarrer le chronomètre » lance le décompte ; « Arrêter » enregistre la durée, mesurée par la base. Un seul chronomètre à la fois : en démarrer un autre arrête le premier. Tant qu\'il tourne, un bandeau en haut des vues PILOTE le rappelle, avec un bouton « Arrêter ».' },
          { text: 'Ou saisis à la main : le jour (pas dans le futur), la durée et une note. La durée se tape comme tu veux : « 1 h 30 », « 1:30 », « 1,5 h », « 45 min » ou « 90 » (minutes). Un nombre décimal sans unité (« 1,5 ») est refusé : précise « 1,5 h » ou « 90 min ». De 1 minute à 24 heures par saisie.' },
          { text: 'Tu modifies (crayon) ou supprimes (corbeille) tes propres saisies. La somme est comparée à l\'estimation de la tâche. Une personne qui peut modifier les projets voit le temps de toute l\'équipe, avec les noms, mais ne modifie que le sien.' },
        ],
        result: 'Le temps est une donnée personnelle : il n\'apparaît pas dans le journal d\'audit. Un chronomètre oublié est plafonné à 24 heures ; corrige-le ensuite avec le crayon. Un chronomètre à cheval sur minuit est compté au jour où il a démarré.',
        problems: [
          { if: 'Je ne vois ni chronomètre ni formulaire.', then: 'Tu saisis ton temps sur les tâches des projets dont tu fais partie. Demande à un responsable de t\'ajouter à l\'équipe.' },
          { if: 'Le message « Un chronomètre est déjà en cours » apparaît.', then: 'Arrête d\'abord le chronomètre en cours (bandeau en haut), ou utilise « Démarrer ici (arrête l\'autre) ».' },
        ],
      },
      {
        id: 'budget',
        title: 'Budget d\'un projet et taux horaires',
        who: 'Réservé aux personnes qui ont le droit « budget » (administrateur et responsable par défaut). Les autres ne voient ni l\'onglet, ni les montants, ni les taux.',
        steps: [
          { text: 'Ouvre « Pilotage › Budget ». Le haut de la page totalise tous les projets : prévu, engagé, réel et écart (prévu − réel). Le tableau en dessous donne les mêmes chiffres par projet, avec un état : « Dans le budget », « Presque atteint » (90 % du prévu ou plus déjà engagé ou payé), « Dépassé » (l\'engagé ou le réel dépasse le prévu) ou « Pas de budget ».' },
          { text: 'Clique sur le nom d\'un projet pour voir son détail, puis « Nouvelle ligne » : une ligne par catégorie de dépense (matériel, prestataires, déplacements…). Saisis en francs suisses le prévu (ce que tu comptes dépenser), l\'engagé (commandé ou promis, pas encore payé) et le réel (déjà payé). Les montants vont de 0 à 99 999 999,99 ; la virgule, le point, les espaces et l\'apostrophe sont acceptés.' },
          { text: 'Les montants sont saisis à la main : rien n\'est repris automatiquement des commandes fournisseurs. Un remboursement ou une note de crédit se déduit à la main du réel (les montants négatifs sont refusés).' },
          { text: 'Main-d\'œuvre estimée : sous les lignes, GO-Mat multiplie les heures estimées des tâches (voir « Estimer les heures ») par le taux horaire des personnes assignées, à parts égales. Ce montant est indicatif et n\'est PAS ajouté aux lignes de budget. Les heures d\'un assigné sans taux, ou d\'une tâche sans assigné, sont comptées à part et jamais valorisées.' },
          { text: 'Temps réellement passé : sous la main-d\'œuvre estimée, GO-Mat additionne le temps saisi par chaque personne sur les tâches du projet (chronomètre ou saisie à la main) et le multiplie par son taux horaire. Une personne sans taux n\'est pas valorisée : son temps est annoncé à part. Ce montant, comme l\'estimation, n\'est PAS ajouté aux lignes de budget : c\'est un repère pour les comparer. Seules les personnes qui ont le droit « budget » le voient, le temps des autres restant personnel.' },
          { text: 'Taux horaires : en bas de la page, saisis le coût d\'une heure de chaque personne (0 pour du bénévolat). Vide = pas de taux. L\'enregistrement se fait en quittant le champ ou avec Entrée. Il faut pouvoir créer et modifier le budget.' },
          { text: '« Exporter (CSV) » télécharge toutes les lignes avec un total par projet, pour Excel.' },
        ],
        problems: [
          { if: 'Je ne vois pas l\'onglet « Budget ».', then: 'Ton rôle n\'a pas le droit « budget » : un administrateur peut te l\'accorder (c\'est un droit à part, différent de celui des projets).' },
          { if: 'Le total de la main-d\'œuvre me paraît trop haut.', then: 'Si une phase et ses tâches sont toutes deux estimées, leurs heures s\'additionnent : estime plutôt l\'un ou l\'autre.' },
          { if: 'Les modifications du budget n\'apparaissent pas dans le journal d\'audit.', then: 'C\'est voulu : le journal est lisible par des personnes qui n\'ont pas le droit « budget », il ferait fuiter les montants et les taux.' },
        ],
      },
      {
        id: 'critique-base',
        title: 'Chemin critique et ligne de base',
        steps: [
          { text: 'Dans le menu « … » du Gantt (« Repères »), coche « Chemin critique » : les tâches et jalons qui décident de la date de fin d\'un projet sont cerclés d\'orange, avec une icône dans la liste, et leurs dépendances sont tracées en orange épais. Un retard sur l\'un d\'eux décale la fin du projet.' },
          { text: 'Le chemin critique est calculé à partir des dépendances : on part des éléments qui finissent en dernier et on remonte tant que rien ne sépare les dates (sans compter week-ends, jours fériés et fermetures du calendrier de travail). Les éléments terminés ou annulés, les phases et les éléments sans date sont ignorés. Un élément seul, sans dépendance, n\'est jamais marqué : il faut des dépendances.' },
          { text: 'Pour figer le plan accepté : ouvre le projet (clic sur son nom dans le Gantt) puis « Figer la ligne de base… ». Il faut pouvoir créer, modifier et supprimer des projets (administrateur, responsable). Un projet n\'a qu\'une ligne de base : en figer une nouvelle remplace la précédente.' },
          { text: 'Coche ensuite « Ligne de base » dans « Repères » : sous chaque barre, un trait gris montre où elle était prévue, et un repère rouge (+5 j) ou vert (−2 j) donne l\'écart de fin avec ce plan. L\'infobulle d\'une barre rappelle la fin prévue. Les éléments ajoutés après avoir figé la ligne de base n\'ont pas de trait gris.' },
        ],
        problems: [
          { if: 'Rien n\'est marqué comme critique.', then: 'Il faut des dépendances entre les éléments (voir « Dépendances »), des dates, et des éléments pas encore terminés. Un jour ouvré libre entre deux éléments interrompt la chaîne.' },
        ],
      },
      {
        id: 'synthese',
        title: 'La Synthèse : l\'état de santé des projets',
        steps: [
          { text: '« Pilotage › Synthèse » (page « Projets ») donne la vue d\'ensemble : projets en cours, projets en retard, éléments en retard, échéances sous 14 jours, personnes en surcharge sur 4 semaines et tâches à estimer.' },
          { text: 'Le tableau « Santé des projets » les classe du plus risqué au moins risqué. « À risque » : le projet est en retard (sa fin est passée) ou un élément du chemin critique est en retard. « À surveiller » : au moins un élément est en retard, ou la fin a glissé par rapport à la ligne de base. « Dans les temps » : rien de tout cela. « Clos » : terminé ou annulé. La colonne « Pourquoi » donne les raisons.' },
          { text: 'Dessous, les échéances des 14 prochains jours (tâches, sous-tâches et jalons pas terminés) et les surcharges des 4 prochaines semaines (voir « Charge »). Un clic sur un projet ou une échéance ouvre sa fiche.' },
        ],
        problems: [
          { if: 'Un projet est « Dans les temps » alors que je le crois en retard.', then: 'La santé se calcule sur les dates et les états saisis : un élément dont l\'état n\'a pas été mis à jour reste « en cours » ; une tâche sans date n\'est jamais en retard.' },
        ],
      },
      {
        id: 'historique-groupe',
        title: 'Historique, modifications groupées, annuler et raccourcis',
        steps: [
          { text: 'Historique : ouvre une tâche ou un projet puis la section « Historique » (repliée au départ). Elle liste, du plus récent au plus ancien, qui a changé quoi et quand : nom, état, priorité, dates, estimation, parent… (la description indique seulement « modifiée »). Toute personne qui voit le projet peut la lire. Elle montre les 100 derniers changements.' },
          { text: 'Modifications groupées (vue « Tableau ») : coche la case de plusieurs cartes. Une barre apparaît : « État », « Priorité », « Assigner à » (une personne de l\'équipe du projet), « Décaler… » (de n jours, négatif pour avancer) et « Supprimer » (avec confirmation). Chaque action part en une seule requête ; si certaines cartes ne sont pas modifiables (droits), la notification indique « n sur m modifiés ».' },
          { text: 'Annuler : après un changement d\'état (une carte ou plusieurs), un décalage groupé, un déplacement ou un changement de dates dans le Gantt, une notification propose « Annuler » pendant quelques secondes ; Ctrl+Z défait la dernière action de la vue (jusqu\'à 20). Limites : annuler des dates remet celles de cet élément mais pas celles des éléments liés que la dépendance avait déjà décalés ; une suppression ne s\'annule pas ; la pile d\'annulation se vide quand tu quittes la vue.' },
          { text: 'Raccourcis (hors saisie et quand aucune fiche n\'est ouverte) : « / » cherche, « n » crée (projet dans le Gantt, tâche dans le Tableau), « t » revient à aujourd\'hui (Gantt et Calendrier), les flèches ← → changent de période (Calendrier), Ctrl+Z annule, « ? » affiche l\'aide. Le bouton clavier de la barre d\'outils ouvre la même aide.' },
        ],
        problems: [
          { if: 'Un raccourci ne marche pas.', then: 'Il ne marche pas quand le curseur est dans un champ de texte, quand une fiche ou une fenêtre est ouverte, ou avec les touches Alt/Ctrl enfoncées (sauf Ctrl+Z).' },
        ],
      },
      {
        id: 'filtrer',
        title: 'Chercher, filtrer et retrouver les retards',
        steps: [
          { text: 'Au-dessus du Gantt, le champ « Rechercher » cherche dans les noms et les descriptions (sans tenir compte des majuscules ni des accents). Si le nom d\'un projet correspond, tous ses éléments restent visibles.' },
          { text: 'Les menus « Personne », « État », « Priorité » et « Type » réduisent la liste. Ils se combinent : par exemple « Personne : Marie » et « État : En cours ». Une phase ou un projet reste affiché tant qu\'un de ses éléments correspond.' },
          { text: 'Une ligne est « en retard » quand sa date de fin est passée et qu\'elle n\'est ni terminée ni annulée : un triangle rouge apparaît dans la liste et la barre est cerclée de rouge. La case « En retard seulement (n) » du panneau « Filtres » n\'affiche que ces lignes ; le nombre compte tous les projets et éléments, même ceux que tes filtres masquent.' },
          { text: 'Ouvre « Filtres » : en bas du panneau, la section « Vues enregistrées » propose « Enregistrer la vue actuelle… » pour garder une combinaison de filtres (et le regroupement) sous un nom, par exemple « Mes retards ». Elle se réapplique d\'un clic. Les vues sont enregistrées sur l\'appareil que tu utilises : elles ne suivent pas ton compte sur un autre ordinateur.' },
          { text: '« Tout afficher » (à côté de « Filtres » dès qu\'un filtre est actif) efface la recherche et tous les filtres.' },
        ],
        problems: [
          { if: 'Le Gantt est vide alors qu\'il y a des projets.', then: 'Des filtres sont probablement actifs : clique sur « Tout afficher ».' },
        ],
      },
      {
        id: 'calendrier',
        title: 'Régler le calendrier de travail (jours fériés et fermetures)',
        who: 'Administrateur et responsable.',
        steps: [
          { text: 'Sur la page « Projets », ouvre l\'icône des réglages (engrenage) puis « Calendrier de travail ». Les samedis et dimanches sont toujours non travaillés ; ici tu ajoutes les jours fériés et les fermetures de ton entreprise.' },
          { text: 'Choisis l\'année, coche les jours fériés courants qui s\'appliquent chez toi (les 7 plus répandus en Suisse sont cochés d\'avance) puis clique sur « Ajouter ». Ce sont des propositions : les jours fériés changent selon le canton, vérifie la liste. Les fêtes mobiles (Pâques, Ascension, Pentecôte, Fête-Dieu, Jeûnes) sont calculées pour l\'année choisie.' },
          { text: 'Pour une fermeture annuelle ou un pont, utilise « Ajouter un jour » : date, nom, type (« Jour férié » ou « Fermeture »). La corbeille retire un jour.' },
          { text: 'Effets : ces jours sont teintés en ambre dans le Gantt ; une fiche indique son nombre de jours ouvrés (sans week-ends ni jours non travaillés) ; et le décalage automatique d\'une dépendance ne fait pas commencer un élément ces jours-là, si « Éviter les week-ends et les jours non travaillés » est coché dans le projet (case cochée par défaut).' },
        ],
        problems: [
          { if: 'Un élément décalé commence quand même un jour férié.', then: 'Vérifie que la case « Éviter les week-ends et les jours non travaillés » est cochée dans les réglages de dépendances du projet (« Modifier le projet » › « Afficher les détails »), et que ce jour figure bien dans le calendrier de l\'année.' },
        ],
      },
      {
        id: 'modeles',
        title: 'Utiliser et créer des modèles de projet',
        who: 'Créer : administrateur et responsable. Voir : toute personne qui voit les projets.',
        steps: [
          { text: 'Sur la page « Projets », choisis la vue « Modèles » dans le menu « Vue ». Un modèle est un projet type : ses phases, tâches, jalons, dépendances et listes à cocher, sans équipe ni assignation. Il n\'apparaît ni dans le Gantt, ni dans la liste des projets, et n\'envoie aucun avis.' },
          { text: 'Pour partir de zéro, clique sur « Ajouter les modèles de départ » : trois modèles sont créés (Montage d\'un événement, Recrutement, Conception / R&D). Rien n\'est créé sans ce clic, et ceux qui existent déjà ne sont pas recréés. Ce sont des bases à adapter à ton métier.' },
          { text: 'Clique sur « Utiliser ce modèle », donne un nom et le jour de début : un vrai projet est créé, avec toutes ses dates décalées pour commencer ce jour-là. Il s\'ouvre aussitôt ; ajoute ensuite l\'équipe et les assignations.' },
          { text: 'Pour faire un modèle de l\'un de tes projets, ouvre ce projet (« Modifier ») puis « Enregistrer comme modèle… » : le projet reste tel quel, et une copie sans équipe ni assignation rejoint « Modèles ».' },
          { text: 'Pour changer un modèle : crée un projet depuis ce modèle, modifie-le, enregistre-le comme nouveau modèle, puis supprime l\'ancien (« Renommer » et « Supprimer » sont dans la carte du modèle).' },
        ],
        problems: [
          { if: 'Je ne vois pas « Utiliser ce modèle ».', then: 'Il faut le droit de création sur les projets (administrateur ou responsable).' },
        ],
      },
      {
        id: 'gestes',
        title: 'Déplacer et ajuster à la souris ou au clavier',
        who: 'Administrateur et responsable.',
        steps: [
          { text: 'Glisse une barre vers la gauche ou la droite pour la déplacer, au jour près : l\'élément ET tout ce qu\'il contient (une phase avec ses tâches et sous-tâches, un projet avec tous ses éléments) se décalent du même nombre de jours. Les éléments sans date restent sans date.' },
          { text: 'Tire le bord gauche ou droit d\'une barre pour changer son début ou sa fin : seul cet élément change (pas les éléments en dessous). Un jalon, lui, ne se déplace que d\'un bloc ; une phase ou un projet dont les dates viennent de ses éléments se déplace mais ne se redimensionne pas.' },
          { text: 'Au clavier : place-toi sur une barre, flèche gauche ou droite = décaler d\'un jour (avec ce qu\'elle contient), Maj + flèche = avancer ou reculer la fin d\'un jour, Entrée = ouvrir la fiche.' },
          { text: 'Un clic sans bouger ouvre toujours la fiche. Si le décalage est refusé, un message l\'explique et la barre revient à sa place.' },
          { text: 'Dans la liste, « + Nouveau » (sous le dernier élément d\'un projet, d\'une phase ou d\'une tâche déplié) : tape un nom, choisis le type si on te le propose, puis Entrée. L\'élément est créé tout de suite avec une semaine de durée ; la saisie reste ouverte pour en ajouter d\'autres, Échap la ferme.' },
        ],
        problems: [
          { if: 'Je ne peux pas déplacer les barres.', then: 'Tu as la lecture seule : seuls l\'administrateur et le responsable modifient.' },
        ],
      },
      {
        id: 'dependances',
        title: 'Relier des éléments : « commence après »',
        who: 'Administrateur et responsable (les autres voient les flèches).',
        steps: [
          { text: 'Ouvre la fiche d\'un élément : dans « Dépendances », « Commence après » liste les éléments qu\'il doit attendre. Choisis un élément du même projet dans la liste, puis « Ajouter ». La corbeille retire la dépendance.' },
          { text: 'Sur le Gantt, une flèche va de la fin de l\'élément qui précède au début de celui qui suit. Une flèche rouge signale un conflit : le successeur commence avant la fin de son prédécesseur.' },
          { text: 'Le projet décide de ce qui se passe quand un élément change de dates (fiche du projet › « Dépendances entre éléments ») : « Seulement si les dates se chevauchent » (par défaut : le successeur est repoussé au lendemain de la fin de son prédécesseur), « Garder l\'intervalle entre les éléments » (il suit son prédécesseur, en avant comme en arrière) ou « Ne pas décaler automatiquement ».' },
          { text: '« Éviter les week-ends » (coché par défaut) : un élément décalé automatiquement ne commence jamais un samedi ou un dimanche.' },
          { text: 'Le décalage entraîne aussi tout ce que le successeur contient (ses tâches et sous-tâches), puis les successeurs de ces éléments, d\'une seule opération : tout ou rien.' },
        ],
        result: 'Quand tu déplaces ou redimensionnes un élément, ceux qui en dépendent se replacent d\'eux-mêmes.',
        problems: [
          { if: '« Cette dépendance créerait une boucle ».', then: 'A ne peut pas commencer après B si B commence déjà après A, même en passant par d\'autres éléments.' },
          { if: '« Un élément ne dépend pas de son parent ni de ce qu\'il contient ».', then: 'Relie plutôt deux éléments qui ne sont pas l\'un dans l\'autre (deux tâches, deux phases…).' },
          { if: 'Le successeur ne bouge pas.', then: 'Vérifie le réglage du projet (« Ne pas décaler automatiquement » ?), et que les deux éléments ont des dates.' },
        ],
      },
      {
        id: 'elements',
        title: 'Créer et modifier des phases, tâches, jalons et sous-tâches',
        who: 'Administrateur et responsable (les autres consultent les fiches).',
        steps: [
          { text: 'Ouvre « Nouveau » (en haut à droite) et choisis « Nouvelle tâche », « Nouvelle phase » ou « Nouveau jalon », ou clique sur le « + » qui apparaît quand tu survoles un projet, une phase ou une tâche : le nouvel élément se range alors directement dessous.' },
          { text: 'Choisis le « Type » : une phase se range sous le projet ; une tâche ou un jalon sous une phase ou directement sous le projet ; une sous-tâche sous une tâche.' },
          { text: 'Remplis le nom, l\'état, la priorité, les dates (un jalon n\'a qu\'une date), les personnes « Assignées » (plusieurs possibles, prises dans l\'équipe du projet) et la description.' },
          { text: 'Clique sur « Afficher les détails » : dans « Liste à cocher », ajoute des mini-étapes sans date ni responsable et coche-les au fur et à mesure.' },
          { text: 'Clique sur « Enregistrer ». Pour modifier, clique sur la ligne ou la barre. « Supprimer » indique combien d\'éléments en dessous disparaîtront avec lui.' },
        ],
        problems: [
          { if: 'Un élément n\'a pas de date.', then: 'Il se trouve dans le menu « Sans date (n) » : clique dessus pour le placer aujourd\'hui (une semaine, un jour pour un jalon), ou ouvre sa fiche pour choisir les dates.' },
          { if: 'Le type ou le projet d\'un élément ne se change pas.', then: 'C\'est voulu : supprime-le et recrée-le. Son parent, lui, peut changer.' },
        ],
      },
    ],
  },
];
