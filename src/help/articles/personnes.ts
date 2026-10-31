import type { HelpArticle } from '../types';

export const PERSONNES: HelpArticle[] = [
  {
    id: 'personnes',
    category: 'personnes',
    title: 'Les personnes : ajouter, badge, intérimaire, départ',
    summary: 'Qui peut se connecter, emprunter, et avec quels droits.',
    route: '/users',
    routes: ['/users', '/badges'],
    where: 'Personnes › Personnes.',
    tasks: [
      {
        id: 'ajouter',
        title: 'Ajouter une personne',
        who: 'Responsable, administrateur.',
        steps: [
          { text: 'Ouvre « Personnes » et clique sur « Ajouter une personne ».', shot: 'personnes-1' },
          { text: 'Remplis « Prénom », « Nom », l\'e-mail (c\'est avec lui qu\'elle se connectera), « Téléphone », « Service ».', shot: 'personnes-2' },
          { text: 'Choisis le « Rôle » : Collaborateur (fait ses demandes), Magasinier (scanne et sort), Responsable (valide, gère), Administrateur (tout).' },
          { text: 'Coche les « Dépôts » qu\'elle gère (aucun coché = tous).' },
          { text: '« Permis de conduire » : coche seulement la catégorie la plus haute : elle inclut les autres (B inclut F, G et M ; CE inclut C, C1, C1E, BE et B ; DE inclut D, D1, D1E, BE et B).' },
          { text: 'Clique sur « Enregistrer ».' },
        ],
        result: 'La personne peut se connecter avec son e-mail. Elle apparaît « Jamais connecté » jusqu\'à sa première connexion.',
        problems: [{ if: '« Cette adresse e-mail est déjà utilisée ».', then: 'La personne existe déjà : cherche-la dans la liste.' }],
      },
      {
        id: 'interimaire',
        title: 'Ajouter un intérimaire ou un sous-traitant',
        steps: [
          { text: 'Comme ci-dessus, mais choisis le « Type » « Intérimaire » ou « Sous-traitant » et indique l\'« Entreprise » (agence).' },
          { text: 'Remplis la date de fin d\'accès : après cette date, plus de connexion ni de badge, et rien ne peut être emprunté au-delà.' },
          { text: 'Si une caution est demandée, indique le montant et « Versée le ».' },
        ],
        problems: [{ if: 'GO-Mat demande confirmation pour une date passée.', then: 'L\'accès serait coupé tout de suite. Confirme seulement si c\'est voulu.' }],
      },
      {
        id: 'badge',
        title: 'Donner son badge à quelqu\'un',
        steps: [
          { text: 'Sur la carte de la personne, clique sur « ⋮ » puis « QR code » (en liste : l\'icône QR) : son badge s\'affiche, à imprimer.' },
          { text: 'Pour plusieurs personnes : « Imprimer les badges », coche les personnes (« Tout cocher »), puis imprime.' },
          { text: 'Ou demande à la personne d\'ouvrir « Mon badge » sur son téléphone.' },
        ],
      },
      {
        id: 'bloquer',
        title: 'Bloquer l\'accès sans supprimer',
        steps: [
          { text: 'Ouvre la fiche (clic sur la carte, ou « ⋮ » puis « Modifier »), décoche « Accès actif », puis « Enregistrer ».' },
        ],
        result: 'La personne ne peut plus se connecter ni emprunter ; son historique est gardé.',
      },
      {
        id: 'depart',
        title: 'Gérer un départ',
        steps: [
          { text: 'Sur la carte de la personne, clique sur « ⋮ » puis « Départ ».' },
          { text: 'La liste montre ce qu\'elle doit encore rendre (matériel, EPI) et sa caution. Coche « Rendu » au fur et à mesure (« Imprimer la liste » si besoin).' },
          { text: 'Indique la « Date de départ » et, si besoin, « Caution rendue ».' },
          { text: 'Quand « Tout est réglé : le départ peut être clôturé », clique sur « Clôturer le départ ».' },
        ],
        result: 'L\'accès et le badge sont désactivés ; l\'historique reste.',
      },
    ],
  },
  {
    id: 'badge',
    category: 'personnes',
    title: 'Mon badge',
    summary: 'Ton QR personnel pour le comptoir.',
    route: '/badge',
    routes: ['/badge'],
    where: 'Accueil › Mon badge (tout le monde).',
    tasks: [
      {
        id: 'presenter',
        title: 'Présenter mon badge au magasin',
        steps: [
          { text: 'Ouvre « Mon badge ».', shot: 'badge-1' },
          { text: 'Monte la luminosité de ton téléphone et tends l\'écran vers la douchette ou la tablette du magasinier.' },
        ],
      },
      {
        id: 'perdu',
        title: 'J\'ai perdu ma carte badge',
        steps: [
          { text: 'Dans « Mon badge », clique sur « Badge perdu : nouveau code ».' },
          { text: '« Imprimer ma carte » si tu veux une nouvelle carte.' },
        ],
        result: '« Nouveau badge créé ». L\'ancienne carte ne marche plus.',
      },
      {
        id: 'notifications',
        title: 'Recevoir les notifications sur mon téléphone',
        steps: [
          { text: 'Installe d\'abord GO-Mat sur ton téléphone (« Installer GO-Mat sur ce téléphone »).' },
          { text: 'Dans « Mon badge », active les notifications et accepte quand le téléphone demande l\'autorisation.' },
        ],
      },
    ],
  },
  {
    id: 'permis',
    category: 'personnes',
    title: 'Permis machines et formations',
    summary: 'Cariste, nacelle IPAF, grutier… avec échéances et attestations.',
    route: '/formations',
    routes: ['/formations'],
    where: 'Personnes › Formations et permis.',
    tasks: [
      {
        id: 'ajouter-personne',
        title: 'Enregistrer le permis d\'une personne',
        steps: [
          { text: 'Ouvre « Formations et permis machines ».', shot: 'permis-1' },
          { text: 'Sur le permis voulu (ex. « Chariot élévateur télescopique »), clique sur « Ajouter une personne ».' },
          { text: 'Choisis la « Personne », remplis « Obtenue le » et « Valable jusqu\'au » (laisse vide si sans échéance).' },
          { text: 'Ajoute l\'« Attestation » (photo ou PDF), puis « Enregistrer ».' },
        ],
        result: 'La personne peut sortir et réserver les outils qui exigent ce permis. Une alerte part 30 jours avant l\'échéance.',
        problems: [{ if: '« Cette personne a déjà cette formation : modifie la ligne existante ».', then: 'Clique sur « Modifier » sur sa ligne pour mettre à jour la date.' }],
      },
      {
        id: 'nouveau',
        title: 'Créer un nouveau permis ou une formation',
        steps: [
          { text: 'Clique sur « Nouveau permis ou formation ».' },
          { text: 'Choisis le « Type » (Permis machine ou Formation), tape le « Nom », puis « Enregistrer ».' },
        ],
      },
    ],
  },
  {
    id: 'epi',
    category: 'personnes',
    title: 'Les EPI (équipements de protection)',
    summary: 'Tailles, remises signées, rappels de renouvellement.',
    route: '/epi',
    routes: ['/epi'],
    where: 'Personnes › EPI.',
    tasks: [
      {
        id: 'remettre',
        title: 'Remettre un EPI à quelqu\'un',
        steps: [
          { text: 'Ouvre « EPI » et clique sur « Remettre un EPI ».', shot: 'epi-1' },
          { text: 'Choisis la « Personne », le type d\'EPI, la « Taille » et la « Quantité ».' },
          { text: '« Pris dans le stock de » : le dépôt d\'où il sort.' },
          { text: 'La personne signe, puis clique sur « Remettre ».' },
        ],
        problems: [{ if: '« Choisis la taille ».', then: 'La taille est obligatoire pour ce type d\'EPI.' }],
      },
      {
        id: 'renouveler',
        title: 'Renouveler un EPI arrivé à échéance',
        steps: [
          { text: 'La liste du haut montre ce qui est à renouveler. Clique sur « Renouveler » sur la ligne.' },
        ],
      },
      {
        id: 'types',
        title: 'Ajouter un type d\'EPI',
        steps: [
          { text: 'Dans « Types d\'EPI », clique sur « Ajouter ».' },
          { text: 'Nom, durée de vie, à rendre au départ ou non, puis « Enregistrer ».' },
        ],
      },
    ],
  },
];
