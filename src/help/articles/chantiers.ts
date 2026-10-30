import type { HelpArticle } from '../types';

export const CHANTIERS: HelpArticle[] = [
  {
    id: 'chantiers',
    category: 'chantiers',
    title: 'Les chantiers : créer, suivre, clôturer',
    summary: 'Budget, matériel encore sur place, rapport PDF pour le client.',
    route: '/chantiers',
    routes: ['/chantiers'],
    where: 'Chantiers › Chantiers.',
    tasks: [
      {
        id: 'creer',
        title: 'Créer un chantier',
        steps: [
          { text: 'Ouvre « Chantiers » et clique sur « Nouveau chantier ».', shot: 'chantiers-1' },
          { text: 'Tape le « Nom du chantier » : c\'est ce nom que tout le monde choisira dans « Chantier ou service ».' },
          { text: 'Remplis « Client », « Responsable », « Adresse » (pour la carte), « Début », « Fin prévue » et le budget matériel.' },
          { text: 'Clique sur « Enregistrer ».' },
        ],
        result: '« Chantier créé : les sorties déjà faites sous ce nom y sont rattachées ».',
        problems: [
          { if: '« Un chantier porte déjà ce nom ».', then: 'Ajoute une précision (ville, étape).' },
          { if: '« Adresse introuvable sur la carte : précise la localité ».', then: 'Ajoute le NPA et la localité.' },
        ],
      },
      {
        id: 'suivre',
        title: 'Suivre les dépenses et le matériel sur place',
        steps: [
          { text: 'Sur la carte du chantier, la barre « Part du budget dépensée » montre « Dépensé » par rapport au budget (« budget dépassé » en rouge).' },
          { text: 'Déplie la carte : consommables, jours d\'outils et locations, et la liste du matériel encore sur place.' },
        ],
      },
      {
        id: 'rapport',
        title: 'Sortir le rapport PDF pour le client',
        steps: [
          { text: 'Sur la carte du chantier, clique sur « Rapport PDF ».' },
          { text: 'Dans la fenêtre d\'impression, choisis « Enregistrer en PDF ».' },
        ],
      },
      {
        id: 'copier',
        title: 'Préparer un chantier semblable',
        steps: [
          { text: 'Sur un chantier modèle, clique sur « Préparer un chantier semblable ».' },
          { text: 'Change le nom et les dates, puis « Enregistrer ».' },
        ],
      },
      {
        id: 'cloturer',
        title: 'Clôturer (ou rouvrir) un chantier',
        steps: [
          { text: 'Sur la carte du chantier, clique sur « Clôturer ».' },
          { text: 'Pour revenir en arrière : filtre « Clôturés », puis « Rouvrir ».' },
        ],
        result: '« Chantier clôturé : plus aucune sortie possible ». Les retours restent possibles.',
      },
    ],
  },
  {
    id: 'carte',
    category: 'chantiers',
    title: 'La carte des chantiers',
    summary: 'Où est mon matériel : chaque chantier avec ce qui s\'y trouve encore.',
    route: '/carte',
    routes: ['/carte'],
    where: 'Chantiers › Carte.',
    tasks: [
      {
        id: 'lire',
        title: 'Lire la carte',
        steps: [
          { text: 'Ouvre « Carte ». Chaque pastille est un chantier ; le chiffre est le matériel encore sur place, en rouge s\'il y a un retard.', shot: 'carte-1' },
          { text: 'Touche une pastille pour voir le détail.' },
          { text: 'Coche « Chantiers clôturés aussi » pour les afficher.' },
        ],
        problems: [{ if: 'Un chantier est « Pas encore sur la carte ».', then: 'Ajoute son adresse dans sa fiche, ou place-le avec « Ma position » quand tu es sur place.' }],
      },
    ],
  },
  {
    id: 'planning',
    category: 'chantiers',
    title: 'Le planning du matériel',
    summary: 'Demandes à venir et sorties en cours, jour par jour.',
    route: '/planning',
    routes: ['/planning'],
    where: 'Chantiers › Planning.',
    tasks: [
      {
        id: 'lire',
        title: 'Voir qui a besoin de quoi, et quand',
        steps: [
          { text: 'Ouvre « Planning ». « Semaine précédente » / « Semaine suivante » / « Aujourd\'hui » pour te déplacer.', shot: 'planning-1' },
          { text: 'Choisis « Outils » ou « Véhicules », et filtre par chantier si besoin.' },
          { text: 'Une case rouge : plus de demandes que d\'exemplaires ce jour-là. Ouvre les demandes concernées pour décaler ou refuser.' },
        ],
      },
    ],
  },
];
