// Contenu de la rubrique Aide (français, tutoiement). Les captures sont générées par
// scripts/help-screenshots.cjs avec des données fictives et rangées dans public/aide/<nom>.jpg.

export type HelpCategory =
  | 'demarrage' | 'magasin' | 'materiel' | 'stock' | 'vehicules' | 'chantiers' | 'personnes' | 'pilotage' | 'reglages';

export interface HelpStep {
  text: string;
  shot?: string;      // nom de la capture (sans extension)
  caption?: string;
}

export interface HelpArticle {
  id: string;
  category: HelpCategory;
  title: string;
  summary: string;
  route?: string;      // page ouverte par « Ouvrir la page »
  routes?: string[];   // pages où le « ? » de l'en-tête ouvre cet article
  steps: HelpStep[];
  tips?: string[];
  warnings?: string[];
}

export const CATEGORIES: { id: HelpCategory; label: string }[] = [
  { id: 'demarrage', label: 'Démarrage rapide' },
  { id: 'magasin', label: 'Magasin' },
  { id: 'materiel', label: 'Matériel' },
  { id: 'stock', label: 'Consommables et achats' },
  { id: 'vehicules', label: 'Véhicules et locations' },
  { id: 'chantiers', label: 'Chantiers' },
  { id: 'personnes', label: 'Personnes' },
  { id: 'pilotage', label: 'Pilotage' },
  { id: 'reglages', label: 'Réglages' },
];

export const ARTICLES: HelpArticle[] = [
  // ---------------------------------------------------------------- Démarrage rapide
  {
    id: 'connexion',
    category: 'demarrage',
    title: 'Te connecter et installer GO-Mat sur ton téléphone',
    summary: 'Code reçu par e-mail ou mot de passe, puis GO-Mat sur l\'écran d\'accueil.',
    steps: [
      { text: 'Saisis ton adresse e-mail et clique sur « Recevoir un code ». Tu reçois un e-mail de Mannyx avec un code (8 chiffres) et un lien.', shot: 'connexion-1' },
      { text: 'Tape le code reçu, ou clique sur le lien « Se connecter » de l\'e-mail depuis le même appareil.', shot: 'connexion-2' },
      { text: 'Tu préfères un mot de passe ? Une fois connecté, va dans « Mon badge » → « Mot de passe » et choisis-en un. Ensuite, sur la page de connexion, clique sur « J\'ai un mot de passe ».' },
      { text: 'Sur ton téléphone, ouvre GO-Mat dans le navigateur puis « Ajouter à l\'écran d\'accueil » (iPhone : bouton Partager ; Android : menu ⋮). GO-Mat s\'ouvre alors comme une application.' },
    ],
    tips: [
      'La langue (français, allemand, italien, anglais) se choisit en haut de la page de connexion ou dans ton profil.',
      'Le code n\'est valable que quelques minutes et une seule fois. Si tu en redemandes un, seul le dernier compte.',
    ],
    warnings: ['Si ton adresse n\'est pas enregistrée dans « Personnes », tu verras « Accès non autorisé » : demande à ton responsable de t\'ajouter.'],
  },
  {
    id: 'demarrage-magasinier',
    category: 'demarrage',
    title: 'Ta journée de magasinier',
    summary: 'Préparer les demandes, servir au comptoir, recevoir les retours.',
    routes: ['/'],
    steps: [
      { text: 'L\'accueil te montre tes raccourcis (Comptoir, Scanner, Demandes…) et le tableau du jour : à préparer, retours attendus, retards.', shot: 'accueil-magasinier' },
      { text: 'Le matin, ouvre « Demandes » : prépare celles du jour en scannant les articles, puis « Marquer prête ».' },
      { text: 'Au guichet, ouvre le « Comptoir » : badge de la personne, puis les articles. Sortie ou retour, tout se fait au scan.' },
      { text: 'Laisse l\'« Écran TV du dépôt » affiché sur une TV : à préparer, retours du jour, retards et livraisons.' },
    ],
  },
  {
    id: 'demarrage-collaborateur',
    category: 'demarrage',
    title: 'Ta journée de collaborateur',
    summary: 'Ton badge, tes demandes, ton matériel.',
    steps: [
      { text: 'Sur l\'accueil, tu vois le matériel que tu as en ta possession et tes demandes en cours.', shot: 'accueil-collaborateur' },
      { text: '« Mon badge » affiche ton QR : présente-le au magasin pour sortir ou rendre du matériel.', shot: 'badge-1' },
      { text: 'Besoin de matériel ou d\'un véhicule pour demain ? Fais une « Nouvelle demande » : le magasin la prépare.' },
      { text: 'Pour les consommables en libre-service ou pour déposer un outil dans la boîte de retour, utilise « Libre-service » sur ton téléphone.' },
    ],
  },
  {
    id: 'demarrage-responsable',
    category: 'demarrage',
    title: 'Ton rôle de responsable',
    summary: 'Valider, suivre les chantiers, décider sur les pertes.',
    steps: [
      { text: 'Les demandes « À valider » (outils sensibles, véhicules) t\'attendent dans « Demandes » : valide ou refuse avec un motif.' },
      { text: '« Pilotage » résume ce qui demande ton attention : retards, pertes, entretiens, budgets des chantiers.', shot: 'pilotage-1' },
      { text: 'Sur la fiche d\'un chantier, tu suis le matériel sur place et les coûts (consommables, jours d\'outils, locations).' },
    ],
  },
  {
    id: 'demarrage-admin',
    category: 'demarrage',
    title: 'Mettre GO-Mat en service (administrateur)',
    summary: 'Le parcours « Démarrage » te guide étape par étape.',
    route: '/demarrage',
    routes: ['/demarrage'],
    steps: [
      { text: 'Ouvre « Réglages » → « Démarrage » : dépôts, personnes, matériel, badges et étiquettes, dans l\'ordre.', shot: 'demarrage-1' },
      { text: 'Ajoute les personnes (une par une ou par import Excel) : chacune reçoit un badge.' },
      { text: 'Ajoute le matériel (catalogue fournisseur, import Excel ou à la main), imprime les étiquettes QR et colle-les.' },
      { text: 'Choisis qui reçoit les alertes par e-mail dans « Paramètres ».' },
    ],
  },

  // ---------------------------------------------------------------- Magasin
  {
    id: 'comptoir',
    category: 'magasin',
    title: 'Le comptoir : sortir et rendre du matériel',
    summary: 'Badge de la personne, articles au scan, validation. Fonctionne aussi sans réseau.',
    route: '/comptoir',
    routes: ['/comptoir'],
    steps: [
      { text: 'Scanne le badge de la personne (carte ou téléphone), ou clique sur « choisissez la personne ».', shot: 'comptoir-1' },
      { text: 'Scanne les articles. En mode « Auto », GO-Mat sait si c\'est une sortie ou un retour : un article que la personne a déjà est mis en retour.', shot: 'comptoir-2' },
      { text: 'Pour une sortie, choisis la date de retour (Ce soir, Demain, Vendredi, + 1 semaine) et le chantier.' },
      { text: 'Pour un retour, indique l\'état : OK, Sale, Incomplet, À réparer ou Cassé (avec une remarque ou une photo si ce n\'est pas OK).' },
      { text: 'Clique sur « Valider ». Un bon de sortie est créé ; s\'il faut une signature, la personne signe sur l\'écran.' },
    ],
    tips: [
      'Scanner le QR d\'un kit ajoute d\'un coup tous les outils du kit.',
      'Sans réseau, le comptoir continue : les opérations sont gardées sur l\'appareil et partent toutes seules au retour du réseau.',
      'Un collègue vient chercher pour quelqu\'un d\'autre ? Scanne d\'abord son badge, puis choisis le bénéficiaire.',
    ],
    warnings: [
      'Une sortie est refusée dès le scan si l\'outil est retiré, rendu au loueur, en réparation, ou si la personne n\'a pas le permis machine demandé.',
    ],
  },
  {
    id: 'demandes',
    category: 'magasin',
    title: 'Les demandes : réserver, valider, préparer, sortir',
    summary: 'Une demande réserve du matériel ou un véhicule pour une période.',
    route: '/demandes',
    routes: ['/demandes'],
    steps: [
      { text: 'Clique sur « Nouvelle demande ».', shot: 'demandes-1' },
      { text: 'Choisis pour qui, le chantier, le dépôt et la période, puis ajoute les outils, consommables ou le véhicule. La disponibilité sur la période s\'affiche sous chaque ligne.', shot: 'demandes-2' },
      { text: 'Clique sur « Envoyer la demande ». Elle est validée automatiquement, sauf si un article ou le véhicule exige l\'accord d\'un responsable (« À valider »).' },
      { text: 'Le magasin ouvre la demande et la prépare : il scanne chaque article (ou coche la ligne), puis « Marquer prête ».' },
      { text: 'Au départ, « Valider la sortie » crée le bon : le matériel passe au nom de la personne.' },
    ],
    tips: [
      'Tu demandes souvent la même chose ? « Enregistrer comme panier » et réutilise-le la prochaine fois.',
      'Le demandeur peut annuler sa demande tant qu\'elle n\'est pas préparée ; le magasin et les responsables peuvent l\'annuler aussi.',
    ],
  },
  {
    id: 'sorties',
    category: 'magasin',
    title: 'Les sorties en cours et les retards',
    summary: 'Qui a quoi, jusqu\'à quand.',
    route: '/checkouts',
    routes: ['/checkouts'],
    steps: [
      { text: '« Sorties » liste tout le matériel dehors, avec la personne, le chantier et la date de retour. Les retards sont en rouge.', shot: 'sorties-1' },
      { text: 'Recherche par outil ou par personne. Les retours se font au comptoir.' },
    ],
    tips: ['Les rappels de retour partent tout seuls (la veille, puis chaque jour de retard) si les e-mails sont configurés.'],
  },
  {
    id: 'scanner',
    category: 'magasin',
    title: 'Le scanner : retrouver un outil en un geste',
    summary: 'Scanne un QR pour voir la fiche, l\'historique et qui l\'a.',
    route: '/scan',
    routes: ['/scan'],
    steps: [
      { text: 'Autorise la caméra, puis vise l\'étiquette QR. Tu peux aussi taper le code.', shot: 'scanner-1' },
      { text: 'La fiche s\'ouvre : état, emplacement, personne qui l\'a, historique.' },
    ],
    warnings: ['Si le scan échoue, le motif s\'affiche sous la caméra (code inconnu, étiquette abîmée…).'],
  },
  {
    id: 'libre-service',
    category: 'magasin',
    title: 'Libre-service et boîte de retour (téléphone)',
    summary: 'Prendre des consommables de l\'armoire ou déposer un outil hors des heures.',
    route: '/libre-service',
    routes: ['/libre-service'],
    steps: [
      { text: 'Ouvre « Libre-service » sur ton téléphone.', shot: 'libre-service-1' },
      { text: 'Prends des consommables : scanne l\'article, indique la quantité et le chantier.' },
      { text: 'Dépose un outil dans la boîte de retour : scanne-le. Le magasin contrôlera son état à la levée de la boîte.' },
    ],
    warnings: ['Seuls les consommables cochés « libre-service » peuvent être pris ainsi. Le reste passe par le comptoir.'],
  },
  {
    id: 'transferts',
    category: 'magasin',
    title: 'Transférer du matériel entre dépôts',
    summary: 'Un outil en route ne peut pas sortir ; il arrive au dépôt à la réception.',
    route: '/transferts',
    routes: ['/transferts'],
    steps: [
      { text: 'Clique sur « Nouveau transfert », choisis le dépôt de départ et d\'arrivée, puis les articles.', shot: 'transferts-1' },
      { text: 'Au dépôt d\'arrivée, ouvre le transfert et scanne ce qui arrive. « Clôturer la réception » termine le transfert.' },
    ],
  },
  {
    id: 'inventaire',
    category: 'magasin',
    title: 'L\'inventaire tournant',
    summary: 'Quelques articles à chaque passage, comptés à l\'aveugle.',
    route: '/inventaire',
    routes: ['/inventaire'],
    steps: [
      { text: 'Lance un comptage : GO-Mat propose les articles comptés le moins récemment.', shot: 'inventaire-1' },
      { text: 'Compte sans voir la quantité attendue, puis clôture : chaque écart demande une explication.' },
    ],
  },
  {
    id: 'emplacements',
    category: 'magasin',
    title: 'Les emplacements dans le dépôt',
    summary: 'Étagères et bacs : chaque article sait où il se range.',
    route: '/emplacements',
    routes: ['/emplacements'],
    steps: [
      { text: 'Crée les emplacements (A-01, A-02…) et range-y les consommables.', shot: 'emplacements-1' },
      { text: 'La liste de préparation d\'une demande est triée par emplacement : un seul passage dans les rayons.' },
    ],
  },
  {
    id: 'ecran-tv',
    category: 'magasin',
    title: 'L\'écran TV du dépôt',
    summary: 'À préparer, retours du jour, retards et livraisons, mis à jour chaque minute.',
    route: '/ecran',
    steps: [
      { text: 'Dans le menu Magasin, clique sur « Écran TV du dépôt » : il s\'ouvre dans un nouvel onglet.' },
      { text: 'Choisis le dépôt en haut, puis clique sur « Plein écran ».', shot: 'ecran-tv-1' },
    ],
    tips: ['Ajoute la page en favori sur la TV : l\'adresse retient le dépôt choisi.'],
  },

  // ---------------------------------------------------------------- Matériel
  {
    id: 'outils',
    category: 'materiel',
    title: 'Ajouter et gérer les outils',
    summary: 'Fiche, QR, exemplaires numérotés, permis machine exigé.',
    route: '/equipment',
    routes: ['/equipment'],
    steps: [
      { text: '« Outils » montre tout le matériel avec sa disponibilité. Filtre par catégorie, groupe, statut.', shot: 'outils-1' },
      { text: 'Clique sur « Ajouter un équipement ». Tu peux remplir depuis le catalogue fournisseur (référence ou code EAN).', shot: 'outils-2' },
      { text: 'Étape 2 : choisis un QR par exemplaire (chaque perceuse a son numéro) ou un QR pour le lot (même article en plusieurs pièces).' },
      { text: 'Sur la carte d\'un outil : QR, historique, modifier, entretien.' },
    ],
    tips: [
      'Un outil qui a un historique ne se supprime pas : GO-Mat propose de le retirer du service, son historique reste.',
      '« Permis machine ou formation obligatoire » : la sortie est refusée à qui n\'a pas l\'attestation valable.',
    ],
  },
  {
    id: 'kits',
    category: 'materiel',
    title: 'Les kits',
    summary: 'Plusieurs outils sous un seul QR.',
    route: '/kits',
    routes: ['/kits'],
    steps: [
      { text: 'Crée un kit (ex. « Kit carrelage ») et ajoute ses outils.', shot: 'kits-1' },
      { text: 'Imprime son QR : au comptoir, un scan sort ou rend tout le kit. Retire du panier ce qui manque : cela reste au nom de la personne.' },
    ],
  },
  {
    id: 'etiquettes',
    category: 'materiel',
    title: 'Imprimer les étiquettes QR',
    summary: 'Par lot, sur planche autocollante.',
    route: '/etiquettes',
    routes: ['/etiquettes'],
    steps: [
      { text: 'Choisis les articles et le nombre d\'étiquettes, puis imprime.', shot: 'etiquettes-1' },
    ],
    warnings: ['Imprime à 100 % (sans « ajuster à la page »), sinon les étiquettes ne tombent pas sur la planche.'],
  },
  {
    id: 'entretien',
    category: 'materiel',
    title: 'Entretien et contrôles OIBT',
    summary: 'Révisions tous les X mois ou toutes les X sorties.',
    route: '/entretien',
    routes: ['/entretien'],
    steps: [
      { text: 'Crée un plan d\'entretien sur un outil : périodicité en mois ou en nombre de sorties.', shot: 'entretien-1' },
      { text: 'À l\'échéance, une alerte apparaît. Enregistre l\'entretien quand il est fait.' },
    ],
    warnings: ['Un contrôle OIBT « bloquant » empêche la sortie de l\'outil dès l\'échéance.'],
  },
  {
    id: 'atelier',
    category: 'materiel',
    title: 'Atelier : réparations, garanties, batteries',
    summary: 'Un outil en réparation ne peut pas sortir.',
    route: '/atelier',
    routes: ['/atelier'],
    steps: [
      { text: 'Envoie un outil en réparation (réparateur, motif, garantie), puis enregistre son retour et le coût.', shot: 'atelier-1' },
      { text: 'Les batteries en fin de vie (âge ou nombre d\'utilisations) sont signalées.' },
    ],
  },
  {
    id: 'pertes',
    category: 'materiel',
    title: 'Pertes et casse',
    summary: 'Déclarer, chiffrer, décider.',
    route: '/incidents',
    routes: ['/incidents'],
    steps: [
      { text: 'Déclare une perte ou une casse avec photos. Un retour « Cassé » au comptoir en crée une automatiquement.', shot: 'pertes-1' },
      { text: 'Le responsable décide de la suite : réparation, mise au rebut, refacturation.' },
    ],
  },

  // ---------------------------------------------------------------- Consommables et achats
  {
    id: 'consommables',
    category: 'stock',
    title: 'Les consommables',
    summary: 'Stock par dépôt, seuils, sorties décomptées.',
    route: '/consommables',
    routes: ['/consommables'],
    steps: [
      { text: '« Consommables » montre le stock par dépôt. Sous le seuil, l\'article passe en alerte.', shot: 'consommables-1' },
      { text: 'Utilise les actions de la ligne pour recevoir, sortir vers un chantier ou corriger le stock.' },
      { text: '« Seuils proposés » calcule des seuils d\'après la consommation réelle.' },
    ],
  },
  {
    id: 'commandes',
    category: 'stock',
    title: 'Commander chez les fournisseurs',
    summary: 'De la feuille « À commander » à la réception.',
    route: '/commandes',
    routes: ['/commande', '/commandes'],
    steps: [
      { text: '« À commander » regroupe par fournisseur ce qui est sous le seuil.', shot: 'commande-1' },
      { text: 'Crée la commande, envoie-la par e-mail, puis réceptionne ligne à ligne quand elle arrive.' },
    ],
  },

  // ---------------------------------------------------------------- Véhicules et locations
  {
    id: 'vehicules',
    category: 'vehicules',
    title: 'Les véhicules : réserver et tenir le carnet',
    summary: 'Réservation par demande, départ et retour avec km, carburant et dégâts.',
    route: '/vehicules',
    routes: ['/vehicules'],
    steps: [
      { text: '« Véhicules » montre la flotte, les réservations de la semaine et les échéances (service, pneus, expertise).', shot: 'vehicules-1' },
      { text: 'Pour réserver, fais une demande avec l\'onglet « Véhicule ». Le permis du conducteur est vérifié dès le choix.' },
      { text: 'Au départ et au retour : kilométrage, carburant, photos des dégâts, signature. « Valider le retour » clôt le trajet.' },
    ],
    warnings: ['Une réservation est refusée si le permis de la personne n\'est pas saisi dans « Personnes » ou ne couvre pas la catégorie du véhicule.'],
  },
  {
    id: 'locations',
    category: 'vehicules',
    title: 'Les locations et l\'état des lieux avec le loueur',
    summary: 'Un véhicule ou un engin loué entre dans le stock jusqu\'à la fin du contrat.',
    route: '/locations',
    routes: ['/locations'],
    steps: [
      { text: '« Nouvelle location » : choisis le type (Véhicule, Outil ou engin, Autre = coût seulement), le loueur, les dates et le prix.', shot: 'locations-1' },
      { text: 'Chez le loueur, clique sur « Réception » : photos guidées (avant, arrière, côtés, compteur…), relevés, dégâts déjà présents, accessoires, signatures.', shot: 'locations-2' },
      { text: 'L\'objet entre alors dans la flotte ou le matériel avec « Loué jusqu\'au … » : il se réserve et se sort jusqu\'à cette date.' },
      { text: 'Au retour chez le loueur, « Restitution » : mêmes vues, comparées à la réception. Puis le PV (réception et restitution côte à côte) s\'imprime en PDF.' },
    ],
    tips: ['« + 7 jours » prolonge la location : la date limite suit sur le véhicule ou l\'outil.'],
    warnings: ['La restitution est refusée tant que l\'objet est sorti, en route ou prévu dans une demande ouverte.'],
  },

  // ---------------------------------------------------------------- Chantiers
  {
    id: 'chantiers',
    category: 'chantiers',
    title: 'Les chantiers',
    summary: 'Matériel sur place, coûts, rapport pour le client.',
    route: '/chantiers',
    routes: ['/chantiers'],
    steps: [
      { text: '« Chantiers » liste les chantiers ouverts avec le matériel sur place et les dépenses par rapport au budget.', shot: 'chantiers-1' },
      { text: 'Sur la carte d\'un chantier : détail des consommables, jours d\'outils et locations, et « Rapport PDF » à joindre à la facture.' },
      { text: 'À la fin, « Clôturer » : plus aucune sortie vers ce chantier, les retours restent possibles.' },
    ],
    tips: [
      'Choisis toujours le chantier dans la liste proposée : un nom sans fiche n\'est rattaché à aucun chantier (un avertissement le signale).',
      '« Préparer un chantier semblable » reprend un chantier existant comme modèle.',
    ],
  },
  {
    id: 'carte',
    category: 'chantiers',
    title: 'La carte des chantiers',
    summary: 'Où sont les chantiers et combien de matériel y est encore.',
    route: '/carte',
    routes: ['/carte'],
    steps: [
      { text: 'Chaque pastille est un chantier, placé depuis son adresse. Le chiffre indique le matériel encore sur place.', shot: 'carte-1' },
    ],
  },
  {
    id: 'planning',
    category: 'chantiers',
    title: 'Le planning du matériel',
    summary: 'Demandes et sorties jour par jour.',
    route: '/planning',
    routes: ['/planning'],
    steps: [
      { text: 'En rouge : plus de demandes que d\'exemplaires disponibles ce jour-là.', shot: 'planning-1' },
    ],
  },

  // ---------------------------------------------------------------- Personnes
  {
    id: 'personnes',
    category: 'personnes',
    title: 'Les personnes : fiche, badge, intérimaires, départ',
    summary: 'Rôle, permis de conduire, caution, accès limité dans le temps.',
    route: '/users',
    routes: ['/users'],
    steps: [
      { text: '« Personnes » liste les collaborateurs et intérimaires.', shot: 'personnes-1' },
      { text: '« Ajouter une personne » : nom, e-mail (pour se connecter), rôle, permis de conduire, et pour un intérimaire l\'agence et la date « accès jusqu\'au ».', shot: 'personnes-2' },
      { text: 'Le bouton QR affiche le badge de la personne, à imprimer ou à envoyer.' },
      { text: 'Au départ : le bouton « Départ » de la fiche récapitule ce qu\'il reste à rendre (matériel, EPI, caution), puis désactive l\'accès et le badge.' },
    ],
    tips: ['Coche seulement la catégorie de permis la plus haute : B inclut F, G et M ; CE inclut BE et C1E.'],
  },
  {
    id: 'badge',
    category: 'personnes',
    title: 'Mon badge',
    summary: 'Ton QR personnel sur ton téléphone.',
    route: '/badge',
    routes: ['/badge'],
    steps: [
      { text: 'Présente ce code au magasin pour sortir ou rendre du matériel. Monte la luminosité de l\'écran.', shot: 'badge-1' },
      { text: 'Tu peux aussi y choisir un mot de passe de connexion et activer les notifications.' },
    ],
  },
  {
    id: 'permis',
    category: 'personnes',
    title: 'Permis machines et formations',
    summary: 'Cariste, nacelle IPAF, grutier, machiniste… avec échéances.',
    route: '/formations',
    routes: ['/formations'],
    steps: [
      { text: 'La liste sépare les permis machines (catalogue suisse prêt) et les formations.', shot: 'permis-1' },
      { text: 'Choisis un permis puis « Ajouter une personne » : date d\'obtention, échéance, attestation (photo ou PDF).' },
      { text: 'Sur un outil (ou un engin loué), choisis le permis exigé : sans attestation valable, ni sortie ni réservation.' },
    ],
    tips: ['Les attestations qui arrivent à échéance sont signalées 30 jours avant.'],
  },
  {
    id: 'epi',
    category: 'personnes',
    title: 'Les EPI',
    summary: 'Tailles, remises, renouvellements.',
    route: '/epi',
    routes: ['/epi'],
    steps: [
      { text: 'Enregistre les tailles de chacun et les EPI remis. GO-Mat rappelle les renouvellements.', shot: 'epi-1' },
    ],
  },

  // ---------------------------------------------------------------- Pilotage
  {
    id: 'pilotage',
    category: 'pilotage',
    title: 'Le pilotage',
    summary: 'Ce qui demande ton attention, en un écran.',
    route: '/pilotage',
    routes: ['/pilotage', '/tableau-de-bord'],
    steps: [
      { text: 'Retards, pertes, entretiens, stock bas, budgets de chantier : chaque carte mène à la page concernée.', shot: 'pilotage-1' },
    ],
  },
  {
    id: 'couts',
    category: 'pilotage',
    title: 'Coûts et comptabilité',
    summary: 'Coûts par chantier, amortissements, export pour la fiduciaire.',
    route: '/comptabilite',
    routes: ['/couts', '/comptabilite'],
    steps: [
      { text: '« Coûts » : consommables (quantité × prix) et outils (jours × tarif interne) par chantier.', shot: 'couts-1' },
      { text: '« Comptabilité » : amortissements de l\'année, export Excel, fichier Abacus ou envoi direct dans bexio.', shot: 'comptabilite-1' },
    ],
    warnings: ['Les comptes proposés suivent le plan comptable PME suisse : fais-les confirmer par ta fiduciaire.'],
  },
  {
    id: 'journal',
    category: 'pilotage',
    title: 'Le journal des modifications',
    summary: 'Qui a changé quoi, quand.',
    route: '/journal',
    routes: ['/journal'],
    steps: [
      { text: 'Chaque modification avec l\'avant et l\'après. Filtre par table ou par personne.', shot: 'journal-1' },
    ],
  },

  // ---------------------------------------------------------------- Réglages
  {
    id: 'parametres',
    category: 'reglages',
    title: 'Paramètres : alertes, sauvegarde, outil trouvé',
    summary: 'Qui reçoit quoi, sauvegarde mensuelle, page publique.',
    route: '/settings',
    routes: ['/settings'],
    steps: [
      { text: '« Notifications par e-mail et SMS » : ajoute les destinataires, coche les alertes, clique sur « Tester ».', shot: 'parametres-1' },
      { text: '« Sauvegarde » : télécharge une sauvegarde ou restaure-en une (seules les lignes absentes sont remises).' },
      { text: '« Outil trouvé » : le message et le téléphone affichés à qui scanne un outil oublié.' },
    ],
  },
  {
    id: 'sante-donnees',
    category: 'reglages',
    title: 'Santé des données',
    summary: 'Doublons, prix manquants, incohérences.',
    route: '/donnees',
    routes: ['/donnees'],
    steps: [
      { text: 'Chaque ligne indique ce qui manque ou se répète, avec un lien pour corriger.', shot: 'donnees-1' },
    ],
  },
];

export interface FaqItem {
  q: string;
  a: string;
  article?: string;
}

export const FAQ: { group: string; items: FaqItem[] }[] = [
  {
    group: 'Connexion',
    items: [
      { q: 'Je ne reçois pas le code de connexion.', a: 'Regarde dans les indésirables (expéditeur Mannyx). Attends une minute entre deux demandes : un nouvel envoi n\'est possible qu\'après 60 secondes. Vérifie que ton adresse est bien celle enregistrée dans « Personnes ».', article: 'connexion' },
      { q: 'Le code a 8 chiffres, c\'est normal ?', a: 'Oui. Tape les 8 chiffres tels quels.' },
      { q: 'Je préfère un mot de passe.', a: 'Connecte-toi une fois avec le code, puis « Mon badge » → « Mot de passe ».', article: 'connexion' },
      { q: '« Accès non autorisé » après la connexion.', a: 'Ton adresse n\'est pas dans « Personnes », ou ton accès est suspendu (intérimaire après la date « accès jusqu\'au », départ enregistré). Demande à ton responsable.' },
      { q: 'Comment installer GO-Mat sur mon téléphone ?', a: 'Ouvre GO-Mat dans le navigateur, puis « Ajouter à l\'écran d\'accueil ».', article: 'connexion' },
    ],
  },
  {
    group: 'Comptoir et sorties',
    items: [
      { q: 'Le badge n\'est pas reconnu.', a: 'Vérifie que la personne est active et que son accès n\'a pas expiré. Le motif exact s\'affiche sous la caméra. En dépannage, clique sur « choisissez la personne ».', article: 'comptoir' },
      { q: 'La sortie est refusée : pourquoi ?', a: 'Le message donne le motif : plus de stock disponible, outil en réparation ou retiré, permis machine manquant, fin de location avant la date de retour, chantier clôturé.', article: 'comptoir' },
      { q: 'Il n\'y a pas de réseau au dépôt.', a: 'Le comptoir continue hors ligne : les opérations sont gardées sur l\'appareil et partent au retour du réseau. Pas de photo ni de recherche par code EAN hors ligne.', article: 'comptoir' },
      { q: 'Comment rendre un kit ?', a: 'Scanne le QR du kit au comptoir : tous ses outils passent en retour. Retire du panier ce qui manque.', article: 'kits' },
      { q: 'Quelqu\'un vient chercher du matériel pour un collègue.', a: 'Scanne le badge de celui qui vient, puis choisis le bénéficiaire : le matériel est au nom du bénéficiaire, avec « retiré par ».', article: 'comptoir' },
      { q: 'Un outil est rendu abîmé.', a: 'Au retour, choisis « À réparer » ou « Cassé » avec une photo : l\'outil passe en maintenance et le responsable est prévenu.', article: 'comptoir' },
    ],
  },
  {
    group: 'Demandes et véhicules',
    items: [
      { q: 'Ma demande est « À valider ».', a: 'Un article ou le véhicule exige l\'accord d\'un responsable. Il reçoit une alerte ; tu es prévenu de sa décision.', article: 'demandes' },
      { q: 'Je ne peux pas réserver de véhicule.', a: 'Ton permis n\'est pas saisi dans « Personnes », a expiré, ou ne couvre pas la catégorie du véhicule. Le message l\'indique dès le choix du véhicule.', article: 'vehicules' },
      { q: 'Comment annuler une demande ?', a: 'Ouvre-la puis « Annuler ma demande », tant qu\'elle n\'est pas préparée. Le magasin peut aussi l\'annuler.', article: 'demandes' },
      { q: '« Libre sur la période » puis refus ?', a: 'Un objet loué n\'est disponible que jusqu\'à la fin de la location : choisis un retour avant, ou fais prolonger la location.', article: 'locations' },
    ],
  },
  {
    group: 'Matériel et stock',
    items: [
      { q: 'Je ne peux pas supprimer un outil.', a: 'Il a un historique de sorties : retire-le du service à la place. Il n\'apparaît plus comme disponible et son historique reste.', article: 'outils' },
      { q: 'Les étiquettes ne tombent pas sur la planche.', a: 'Imprime à 100 %, sans « ajuster à la page ».', article: 'etiquettes' },
      { q: 'Un consommable est en alerte.', a: 'Son stock est sous le seuil. Il apparaît dans « À commander ».', article: 'commandes' },
    ],
  },
  {
    group: 'Écran TV et affichage',
    items: [
      { q: 'Comment afficher l\'écran TV en plein écran ?', a: 'Ouvre « Écran TV du dépôt », choisis le dépôt, puis le bouton « Plein écran » en haut à droite. Échap pour sortir.', article: 'ecran-tv' },
      { q: 'Comment changer de langue ?', a: 'Dans le menu de ton profil (en haut à droite), sur la page de connexion ou dans « Paramètres ».' },
      { q: 'Mode clair ou sombre ?', a: 'Le bouton soleil / lune en haut de l\'écran.' },
      { q: 'Retrouver une page rapidement ?', a: 'Ctrl+K (ou ⌘K sur Mac) puis tape le nom de la page ou d\'un outil.' },
    ],
  },
  {
    group: 'Alertes et données',
    items: [
      { q: 'Je ne reçois pas les alertes par e-mail.', a: 'Un administrateur doit t\'ajouter comme destinataire dans « Paramètres » → « Notifications par e-mail » et cocher les alertes voulues.', article: 'parametres' },
      { q: 'Quelqu\'un a trouvé un de nos outils.', a: 'En scannant l\'étiquette, il arrive sur une page publique avec le nom de l\'entreprise, le téléphone et le message choisis dans « Paramètres ».', article: 'parametres' },
      { q: 'Et si on perd des données ?', a: 'Une sauvegarde automatique est faite chaque mois (12 gardées). « Paramètres » → « Sauvegarde » permet de restaurer ce qui manque, sans rien écraser.', article: 'parametres' },
    ],
  },
];

export const GLOSSARY: { term: string; def: string }[] = [
  { term: 'Badge', def: 'QR personnel (carte ou téléphone) qui identifie une personne au comptoir.' },
  { term: 'Bon (de sortie)', def: 'Document créé à chaque sortie : qui, quoi, jusqu\'à quand, pour quel chantier.' },
  { term: 'Consommable', def: 'Article qui ne revient pas (vis, gants…) : il est décompté du stock à la sortie.' },
  { term: 'Demande', def: 'Réservation de matériel ou d\'un véhicule pour une période, préparée par le magasin.' },
  { term: 'Dépôt', def: 'Lieu de stockage (magasin principal, dépôt secondaire…).' },
  { term: 'État des lieux', def: 'Constat avec photos à la réception et à la restitution d\'une location, pour te protéger des dégâts déjà présents.' },
  { term: 'Exemplaire', def: 'Un outil précis, avec son propre QR (ex. perceuse n° 3).' },
  { term: 'Kit', def: 'Groupe d\'outils sous un seul QR, sorti et rendu en un scan.' },
  { term: 'Lot (QR de lot)', def: 'Un seul QR pour plusieurs pièces identiques, comptées en quantité.' },
  { term: 'OIBT', def: 'Contrôle des installations électriques (outils électriques) exigé en Suisse.' },
  { term: 'Permis machine', def: 'Attestation exigée pour utiliser un engin (cariste, nacelle IPAF, grutier, machiniste…).' },
  { term: 'Retrait du service', def: 'Un outil qui ne sert plus : il n\'est plus disponible, mais son historique est conservé.' },
  { term: 'Sortie', def: 'Matériel remis à une personne jusqu\'à une date de retour.' },
  { term: 'Transfert', def: 'Déplacement de matériel d\'un dépôt à un autre.' },
];

// Article lié à une page (le chemin le plus précis gagne) ; pour le « ? » de l'en-tête
export function articleForPath(path: string): HelpArticle | undefined {
  let best: { article: HelpArticle; length: number } | undefined;
  for (const article of ARTICLES) {
    for (const route of article.routes ?? []) {
      const hit = route === '/' ? path === '/' : path === route || path.startsWith(`${route}/`);
      if (hit && (!best || route.length > best.length)) best = { article, length: route.length };
    }
  }
  return best?.article;
}

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Recherche dans les titres, résumés, étapes et la FAQ
export function searchHelp(query: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const hit = (text: string) => words.every(w => normalize(text).includes(w));
  if (!words.length) return { articles: [] as HelpArticle[], faq: [] as FaqItem[] };
  return {
    articles: ARTICLES.filter(a => hit([a.title, a.summary, ...a.steps.map(s => s.text), ...(a.tips ?? []), ...(a.warnings ?? [])].join(' '))),
    faq: FAQ.flatMap(g => g.items).filter(i => hit(`${i.q} ${i.a}`)),
  };
}
