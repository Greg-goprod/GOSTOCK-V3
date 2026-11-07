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
        ],
        result: 'Tu reçois un avis quand on t\'assigne une tâche, quand on t\'ajoute à une équipe, quand les dates d\'un de tes éléments changent (plusieurs changements rapprochés = un seul avis), la veille et le jour d\'une échéance, et les 3 jours qui suivent un retard. Tu ne reçois jamais d\'avis pour ce que tu fais toi-même, ni pour les éléments terminés ou annulés.',
        problems: [
          { if: 'Je ne reçois pas d\'e-mail.', then: 'Vérifie que « E-mail » est coché pour cet événement (« dates modifiées » n\'envoie pas d\'e-mail par défaut) et que ton adresse est renseignée dans ta fiche.' },
          { if: 'Je ne reçois pas de notification push.', then: 'Active d\'abord les notifications sur cet appareil avec le bouton en haut de la page Notifications, puis coche « Push ».' },
          { if: 'Je ne reçois plus aucun avis d\'un type.', then: 'Tu as décoché « Dans l\'application » pour cet événement : recoche-le.' },
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
          { text: 'Documents : « Ajouter des fichiers », ou glisse-les dans le cadre. 50 Mo au plus par fichier ; les exécutables, scripts et pages web sont refusés. Clique sur le nom d\'un fichier pour le télécharger.' },
          { text: 'Un clic sur le titre d\'une section la replie ou la déplie ; ton choix est retenu sur cet appareil.' },
        ],
        result: 'Les messages et les fichiers restent attachés à la tâche ou au projet. Un document supprimé devient aussitôt illisible ; le fichier est effacé du stockage dans les minutes qui suivent.',
        problems: [
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
          { text: 'Ouvre « PILOTE », « Projets », puis l\'onglet « Gantt ». La liste est à gauche, les barres à droite ; la ligne rouge verticale est aujourd\'hui et les week-ends sont grisés.' },
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
        id: 'filtrer',
        title: 'Chercher, filtrer et retrouver les retards',
        steps: [
          { text: 'Au-dessus du Gantt, le champ « Rechercher » cherche dans les noms et les descriptions (sans tenir compte des majuscules ni des accents). Si le nom d\'un projet correspond, tous ses éléments restent visibles.' },
          { text: 'Les menus « Personne », « État », « Priorité » et « Type » réduisent la liste. Ils se combinent : par exemple « Personne : Marie » et « État : En cours ». Une phase ou un projet reste affiché tant qu\'un de ses éléments correspond.' },
          { text: 'Une ligne est « en retard » quand sa date de fin est passée et qu\'elle n\'est ni terminée ni annulée : un triangle rouge apparaît dans la liste et la barre est cerclée de rouge. Le bouton « En retard (n) » affiche seulement ces lignes ; le nombre compte tous les projets et éléments, même ceux que tes filtres masquent.' },
          { text: 'Ouvre « Vues » puis « Enregistrer la vue actuelle… » pour garder une combinaison de filtres (et le regroupement) sous un nom, par exemple « Mes retards ». Elle se réapplique d\'un clic. Les vues sont enregistrées sur l\'appareil que tu utilises : elles ne suivent pas ton compte sur un autre ordinateur.' },
          { text: '« Tout afficher » efface la recherche et tous les filtres.' },
        ],
        problems: [
          { if: 'Le Gantt est vide alors qu\'il y a des projets.', then: 'Des filtres sont probablement actifs : clique sur « Tout afficher ».' },
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
