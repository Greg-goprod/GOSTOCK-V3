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
          { text: 'Choisis l\'« État » (« Pas commencé » par défaut), le « Programme » si le projet en fait partie, la « Priorité » et les dates « Début » et « Fin ».' },
          { text: 'Coche les « Responsables » : tu peux en choisir plusieurs.' },
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
        id: 'programmes',
        title: 'Regrouper des projets dans un programme',
        who: 'Administrateur et responsable.',
        steps: [
          { text: 'Onglet « Programmes », puis « Nouveau programme » : un nom (« Festivals 2027 »), une description, une période et une couleur.' },
          { text: 'Dans un projet, choisis ce programme dans « Programme ». Le filtre « Programme » de la liste regroupe ensuite ses projets.' },
        ],
        result: 'Supprimer un programme garde ses projets : ils passent simplement « Sans programme ».',
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
          { text: 'Les projets sont rangés par « Programme » (par défaut) ; choisis « État » ou « Type » pour regrouper autrement. Un groupe se plie et se déplie avec sa flèche.' },
          { text: 'Au départ, seuls les groupes et les projets sont visibles. Clique sur la flèche d\'un projet pour voir ses phases et tâches, ou sur « Tout déplier ». « Replier » revient à l\'ouverture de départ.' },
          { text: 'Choisis la période affichée : « 1 jour », « 1 semaine », « 2 semaines », « 1 mois », « 3 mois », « 6 mois » ou « 1 année » (le plan annuel), ou une période libre avec le sélecteur de dates (1er clic = début, 2e clic = fin). Les flèches et « Aujourd\'hui » déplacent la fenêtre.' },
          { text: 'Un losange est un jalon. La partie pleine d\'une barre est l\'avancement : la part d\'éléments terminés en dessous (un élément annulé ne compte pas). Une phase ou un projet sans dates propres prend celles de ses éléments.' },
        ],
        problems: [
          { if: 'Je ne vois aucune barre.', then: 'Les barres sont peut-être hors de l\'écran : clique sur « Aujourd\'hui », ou fais défiler vers la date du projet. Un élément sans date apparaît dans « Sans date » sous le Gantt.' },
        ],
      },
      {
        id: 'elements',
        title: 'Créer et modifier des phases, tâches, jalons et sous-tâches',
        who: 'Administrateur et responsable (les autres consultent les fiches).',
        steps: [
          { text: 'Clique sur « Nouvel élément », ou sur le « + » qui apparaît quand tu survoles un projet, une phase ou une tâche : le nouvel élément se range alors directement dessous.' },
          { text: 'Choisis le « Type » : une phase se range sous le projet ; une tâche ou un jalon sous une phase ou directement sous le projet ; une sous-tâche sous une tâche.' },
          { text: 'Remplis le nom, l\'état, la priorité, les dates (un jalon n\'a qu\'une date), les responsables (plusieurs possibles) et la description.' },
          { text: 'Dans « Liste à cocher », ajoute des mini-étapes sans date ni responsable et coche-les au fur et à mesure.' },
          { text: 'Clique sur « Enregistrer ». Pour modifier, clique sur la ligne ou la barre. « Supprimer » indique combien d\'éléments en dessous disparaîtront avec lui.' },
        ],
        problems: [
          { if: 'Un élément n\'a pas de date.', then: 'Il apparaît dans « Sans date » : « Placer aujourd\'hui » lui donne une semaine à partir d\'aujourd\'hui (un jour pour un jalon), ou ouvre sa fiche pour choisir les dates.' },
          { if: 'Le type ou le projet d\'un élément ne se change pas.', then: 'C\'est voulu : supprime-le et recrée-le. Son parent, lui, peut changer.' },
        ],
      },
    ],
  },
];
