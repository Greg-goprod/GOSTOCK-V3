import type { HelpArticle } from '../types';

export const DEMARRAGE: HelpArticle[] = [
  {
    id: 'connexion',
    category: 'demarrage',
    title: 'Se connecter à GO-Mat',
    summary: 'Avec un code reçu par e-mail, ou avec un mot de passe.',
    where: 'Page d\'accueil de GO-Mat, avant d\'être connecté.',
    tasks: [
      {
        id: 'code',
        title: 'Me connecter avec un code reçu par e-mail',
        who: 'Tout le monde.',
        steps: [
          { text: 'Ouvre GO-Mat dans ton navigateur (sur ordinateur ou téléphone).' },
          { text: 'Dans « Adresse e-mail », tape ton adresse professionnelle, celle que ton responsable a enregistrée dans GO-Mat.', shot: 'connexion-1' },
          { text: 'Clique sur le bouton violet « Recevoir un code ».' },
          { text: 'Ouvre ta boîte e-mail. Tu reçois un e-mail de « Mannyx » avec un code de 8 chiffres.' },
          { text: 'Reviens sur GO-Mat. Dans « Code reçu », tape les 8 chiffres (sans espace).', shot: 'connexion-2' },
          { text: 'Clique sur « Se connecter ».' },
        ],
        result: 'Tu arrives sur l\'accueil de GO-Mat, avec ton prénom en haut.',
        problems: [
          { if: 'Je ne reçois pas l\'e-mail.', then: 'Regarde dans les courriers indésirables (spam). Attends une minute, puis clique sur « Renvoyer le code ».' },
          { if: '« Trop de demandes de code ».', then: 'Attends une minute avant de redemander un code.' },
          { if: '« Code incorrect ou expiré ».', then: 'Le code n\'est valable que quelques minutes et une seule fois. Utilise le code du dernier e-mail reçu, ou redemande-en un.' },
          { if: '« Accès non autorisé » après la connexion.', then: 'Ton adresse n\'est pas dans GO-Mat, ou ton accès est terminé. Demande à ton responsable de vérifier ta fiche dans « Personnes ».' },
        ],
      },
      {
        id: 'lien',
        title: 'Me connecter avec le lien de l\'e-mail',
        steps: [
          { text: 'Demande un code comme ci-dessus.' },
          { text: 'Dans l\'e-mail reçu, clique sur le lien « Se connecter ». Fais-le depuis le même appareil que celui où tu veux utiliser GO-Mat.' },
        ],
        result: 'GO-Mat s\'ouvre, tu es connecté.',
      },
      {
        id: 'mot-de-passe',
        title: 'Choisir un mot de passe (pour ne plus attendre de code)',
        steps: [
          { text: 'Connecte-toi une première fois avec un code.' },
          { text: 'Ouvre « Mon badge » (menu Accueil, ou l\'icône en bas sur téléphone).' },
          { text: 'En bas, dans « Mon mot de passe (facultatif) », tape un mot de passe d\'au moins 8 caractères dans « Nouveau mot de passe », puis une deuxième fois dans « Répéter le mot de passe ».' },
          { text: 'Clique sur « Enregistrer le mot de passe ».' },
          { text: 'La prochaine fois, sur la page de connexion, clique sur « J\'ai un mot de passe », tape ton e-mail et ton mot de passe, puis « Se connecter ».' },
        ],
        result: 'Le message « Mot de passe enregistré » s\'affiche. Le code par e-mail reste toujours possible.',
      },
      {
        id: 'installer',
        title: 'Installer GO-Mat sur mon téléphone',
        steps: [
          { text: 'Ouvre GO-Mat dans le navigateur du téléphone (Safari sur iPhone, Chrome sur Android) et connecte-toi.' },
          { text: 'Sur iPhone : touche le bouton « Partager » (carré avec une flèche vers le haut), puis « Sur l\'écran d\'accueil », puis « Ajouter ».' },
          { text: 'Sur Android : touche le menu ⋮ en haut à droite, puis « Ajouter à l\'écran d\'accueil » ou « Installer l\'application ».' },
        ],
        result: 'L\'icône GO-Mat apparaît sur l\'écran d\'accueil du téléphone. Elle s\'ouvre comme une application, sans barre de navigateur.',
      },
      {
        id: 'langue',
        title: 'Changer la langue ou passer en mode sombre',
        steps: [
          { text: 'Langue : sur ordinateur, clique sur ton nom en bas du menu (sur téléphone, sur ton rond en haut à droite), puis choisis la langue dans la liste (Français, Deutsch, Italiano, English). Sur la page de connexion, la liste est sous le logo.' },
          { text: 'Mode sombre : clique sur l\'icône lune (ou soleil) en haut de l\'écran.' },
        ],
        result: 'L\'écran change tout de suite. Ton choix est gardé sur cet appareil.',
      },
    ],
  },
  {
    id: 'navigation',
    category: 'demarrage',
    title: 'Se repérer dans GO-Mat',
    summary: 'Le menu par métier, la recherche rapide, l\'aide de chaque page.',
    tasks: [
      {
        id: 'menu',
        title: 'Utiliser le menu (ordinateur)',
        steps: [
          { text: 'À gauche, le menu liste les modules : Accueil, Magasin, Matériel, Consommables, Véhicules, Chantiers, Personnes, Pilotage ; en bas Réglages et Aide, puis ton compte.', shot: 'accueil-magasinier' },
          { text: 'Clique sur un module : il s\'ouvre sur la dernière page que tu y as consultée.' },
          { text: 'En haut de la page, le nom du module est suivi de ses onglets (ex. MAGASIN : Comptoir, Scanner, Demandes…). Clique sur un onglet pour changer de page. Le titre et les onglets restent en place quand tu fais défiler.' },
          { text: 'Le bouton en haut du menu (à droite de GO-MAT) le réduit aux icônes pour gagner de la place ; reclique pour le rouvrir.' },
          { text: 'En haut de l\'écran, choisis le dépôt sur lequel tu travailles (ou « Tous les dépôts ») : les pages de stock, l\'inventaire et le comptoir le reprennent.' },
        ],
        result: 'Tu ne vois que les pages auxquelles ton rôle donne accès.',
      },
      {
        id: 'telephone',
        title: 'Utiliser le menu (téléphone)',
        steps: [
          { text: 'En bas de l\'écran, la barre donne les 4 pages les plus utiles pour ton rôle.', shot: 'accueil-collaborateur' },
          { text: 'Touche « Plus » (à droite) pour voir toutes les pages, rangées par métier.' },
        ],
      },
      {
        id: 'recherche-rapide',
        title: 'Aller directement à une page (Ctrl+K)',
        steps: [
          { text: 'Appuie sur Ctrl+K (⌘K sur Mac), ou clique sur « Rechercher… » en haut.' },
          { text: 'Tape quelques lettres : le nom d\'une page (« comptoir »), d\'un outil ou d\'une personne.' },
          { text: 'Choisis une ligne avec les flèches ↑ ↓ puis Entrée, ou clique dessus.' },
        ],
      },
      {
        id: 'aide-page',
        title: 'Ouvrir l\'aide de la page où je suis',
        steps: [
          { text: 'Clique sur le « ? » en haut de l\'écran.' },
          { text: 'Le mode d\'emploi de la page s\'ouvre sur la droite, sans quitter ce que tu fais. Ferme-le avec la croix ou Échap.' },
        ],
      },
    ],
  },
  {
    id: 'demarrage-magasinier',
    category: 'demarrage',
    title: 'Ta journée de magasinier',
    summary: 'L\'ordre conseillé des tâches, du matin au soir.',
    routes: ['/'],
    tasks: [
      {
        id: 'matin',
        title: 'Le matin',
        steps: [
          { text: 'Ouvre l\'Accueil. En haut, une carte par module avec ses chiffres clés (clique dessus pour l\'ouvrir) ; dessous, tes actions rapides, puis « Aujourd\'hui au magasin ».', shot: 'accueil-magasinier' },
          { text: 'Clique sur « Demandes à préparer » et prépare chaque demande du jour (voir « Préparer une demande »).' },
          { text: 'Clique sur « Boîte de retour » s\'il y a un chiffre : contrôle les outils déposés la veille au soir.' },
        ],
      },
      {
        id: 'journee',
        title: 'Pendant la journée',
        steps: [
          { text: 'Au guichet, travaille dans « Comptoir » : badge de la personne, puis les articles (voir « Le comptoir »).' },
          { text: 'Laisse l\'« Écran TV du dépôt » affiché sur une TV : toute l\'équipe voit ce qu\'il reste à faire.' },
        ],
      },
      {
        id: 'semaine',
        title: 'Chaque semaine',
        steps: [
          { text: '« Inventaire » : compte les quelques articles proposés.' },
          { text: '« À commander » : vérifie les consommables sous le seuil et crée les commandes.' },
          { text: '« Retours en retard » sur l\'accueil : relance les personnes concernées.' },
        ],
      },
    ],
  },
  {
    id: 'demarrage-collaborateur',
    category: 'demarrage',
    title: 'Ta journée de collaborateur',
    summary: 'Ton badge, tes demandes, ton matériel.',
    tasks: [
      {
        id: 'base',
        title: 'Ce que je fais le plus souvent',
        steps: [
          { text: 'Sur l\'accueil, « Mon matériel » montre ce que tu as emprunté et quand le rendre.', shot: 'accueil-collaborateur' },
          { text: 'Au magasin, ouvre « Mon badge » et présente le QR au magasinier.' },
          { text: 'Pour demain ou plus tard, fais une « Nouvelle demande » : le magasin la prépare.' },
          { text: 'Pour des consommables de l\'armoire, ou pour rendre un outil hors des heures, utilise « Libre-service ».' },
        ],
      },
    ],
  },
  {
    id: 'demarrage-responsable',
    category: 'demarrage',
    title: 'Ton rôle de responsable',
    summary: 'Valider, suivre les chantiers, décider sur les pertes.',
    tasks: [
      {
        id: 'base',
        title: 'Ce que je fais le plus souvent',
        steps: [
          { text: 'Sur l\'accueil, « Demandes à valider » : ouvre chaque demande, puis « Valider » ou « Refuser » (avec un motif).' },
          { text: '« Pilotage » : retards, outils jamais sortis, valeur du stock.', shot: 'pilotage-1' },
          { text: '« Chantiers » : dépenses par rapport au budget et matériel encore sur place.' },
          { text: '« Pertes et casse » : décide de la suite de chaque incident.' },
        ],
      },
    ],
  },
  {
    id: 'demarrage-admin',
    category: 'demarrage',
    title: 'Mettre GO-Mat en service (administrateur)',
    summary: 'Le parcours « Démarrage » te guide étape par étape.',
    route: '/demarrage',
    routes: ['/demarrage'],
    where: 'Réglages › Démarrage.',
    tasks: [
      {
        id: 'parcours',
        title: 'Suivre le parcours de démarrage',
        who: 'Administrateur.',
        steps: [
          { text: 'Ouvre « Réglages » › « Démarrage ». La page liste les étapes, dans l\'ordre, avec un compteur « x / y faites ».', shot: 'demarrage-1' },
          { text: '« Ton entreprise » : tape le nom de l\'entreprise, puis « Enregistrer ». Il apparaît sur les rapports, les bons et la page « outil trouvé ».' },
          { text: '« Les dépôts » : vérifie le dépôt par défaut, ajoute les autres.' },
          { text: '« Les personnes » : télécharge le « Modèle Excel », remplis une ligne par personne (prénom, nom, e-mail, rôle, permis), puis importe-le. Ou ajoute-les une par une dans « Personnes ».' },
          { text: '« Le matériel » : « Outils : importer ou ajouter ». Puis crée les emplacements et imprime les étiquettes.' },
          { text: '« Les badges » : imprime les cartes, ou demande à chacun d\'ouvrir « Mon badge » sur son téléphone.' },
          { text: '« Connexion et e-mails » : choisis les destinataires des alertes.' },
          { text: '« Contrôle final » : ouvre « Santé des données » et corrige ce qui manque avant d\'ouvrir GO-Mat aux équipes.' },
          { text: 'Coche chaque étape terminée (« Fait »).' },
        ],
        result: 'Le compteur arrive au total : GO-Mat est prêt.',
      },
    ],
  },
];
