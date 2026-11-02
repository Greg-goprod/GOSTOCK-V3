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
];
