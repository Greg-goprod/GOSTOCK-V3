import type { HelpArticle } from '../types';

export const MATERIEL: HelpArticle[] = [
  {
    id: 'outils',
    category: 'materiel',
    title: 'Les outils : ajouter, modifier, retirer',
    summary: 'La fiche de chaque outil, ses exemplaires et son QR.',
    route: '/equipment',
    routes: ['/equipment'],
    where: 'Matériel › Outils.',
    tasks: [
      {
        id: 'trouver',
        title: 'Trouver un outil et voir s\'il est disponible',
        steps: [
          { text: 'Ouvre « Matériel » › « Outils ».', shot: 'outils-1' },
          { text: 'Tape le nom, le numéro de série ou le numéro d\'article dans « Rechercher par nom, numéro de série ou numéro d\'article... ».' },
          { text: '« Filtres » limite par catégorie, groupe ou statut. « Grille » / « Liste » changent l\'affichage.' },
          { text: 'Lis la colonne « Disponible » (sur « Stock total ») et le « Statut » : Disponible, Sorti, En maintenance, Retiré, Perdu.' },
        ],
      },
      {
        id: 'ajouter',
        title: 'Ajouter un outil',
        who: 'Responsable du stock, administrateur.',
        steps: [
          { text: 'Clique sur « Ajouter un équipement ».', shot: 'outils-2' },
          { text: 'Facultatif : dans « Depuis le catalogue : », tape la référence ou le code EAN du fournisseur pour tout remplir d\'un coup.' },
          { text: 'Remplis « Nom » (obligatoire), puis si tu les connais : « Numéro de série du fabricant », « Catégorie », « Groupe », « Sous-groupe », « Fournisseur ».' },
          { text: 'Coche « Validation requise » si toute demande de cet outil doit passer par un responsable, et « Signature à la remise » si la personne doit signer en le recevant.' },
          { text: 'Indique la valeur (pour le stock et les pertes) et le « Coût imputé au chantier par jour de sortie ».' },
          { text: 'Tape la « Quantité disponible » (combien de pièces tu as), puis « Suivant ».' },
          { text: 'Choisis le type de QR : « QR Code individuel par pièce » (chaque pièce a son numéro, idéal pour les machines) ou « QR Code unique pour le lot » (pièces identiques comptées en quantité, ex. serre-joints).' },
          { text: 'Clique sur « Créer le matériel ».' },
        ],
        result: 'L\'outil apparaît dans la liste avec ses QR. Imprime ses étiquettes (voir « Imprimer les étiquettes QR »).',
        problems: [
          { if: 'Le catalogue ne trouve pas la référence.', then: 'Remplis la fiche à la main ; l\'administrateur peut importer les catalogues dans « Paramètres » › « Catalogues fournisseurs ».' },
        ],
      },
      {
        id: 'permis',
        title: 'Exiger un permis machine pour un outil',
        steps: [
          { text: 'Sur la carte de l\'outil, clique sur le crayon (« Modifier »).' },
          { text: 'Dans « Permis machine ou formation obligatoire », choisis le permis (ex. « Nacelle PEMP (IPAF) »).' },
          { text: 'Clique sur « Enregistrer ».' },
        ],
        result: 'Une personne sans attestation valable ne peut plus sortir ni réserver cet outil ; le message lui dit pourquoi.',
      },
      {
        id: 'historique',
        title: 'Voir l\'historique d\'un outil',
        steps: [
          { text: 'Sur la carte de l\'outil, clique sur l\'icône d\'historique.' },
          { text: 'Tu vois, du plus récent au plus ancien : sorties, retours (avec leur état), entretiens, pertes, réparations.' },
        ],
      },
      {
        id: 'retirer',
        title: 'Retirer un outil du service (ou le supprimer)',
        steps: [
          { text: 'Ouvre la fiche (crayon) et passe le « Statut » à « Retiré du service », puis « Enregistrer ».' },
          { text: 'Supprimer n\'est possible que pour un outil jamais sorti : bouton poubelle « Supprimer l\'équipement ».' },
        ],
        result: 'Un outil retiré n\'est plus proposé ; son historique reste consultable.',
      },
      {
        id: 'importer',
        title: 'Importer une liste d\'outils depuis Excel',
        steps: [
          { text: 'Clique sur « Importer » en haut de « Outils ».' },
          { text: 'Clique sur « Télécharger le modèle Excel », remplis une ligne par outil (seul « Nom » est obligatoire ; catégories et fournisseurs inconnus sont créés automatiquement).' },
          { text: 'Glisse ton fichier dans le cadre « Glissez-déposez votre fichier Excel ici », ou clique pour le choisir.' },
          { text: 'À l\'étape « Validation », vérifie le tableau : « Validation réussie » si tout est bon.' },
          { text: 'Lance l\'import, attends « Import terminé », puis « Fermer ».' },
        ],
        problems: [{ if: 'Une ligne est refusée.', then: 'Le motif est affiché sur la ligne (nom manquant, quantité non numérique…). Corrige le fichier et réimporte : les lignes déjà créées ne sont pas doublées si tu les retires du fichier.' }],
      },
    ],
  },
  {
    id: 'kits',
    category: 'materiel',
    title: 'Les kits',
    summary: 'Plusieurs outils sous un seul QR, sortis et rendus en un scan.',
    route: '/kits',
    routes: ['/kits'],
    where: 'Matériel › Kits.',
    tasks: [
      {
        id: 'creer',
        title: 'Créer un kit',
        steps: [
          { text: 'Ouvre « Kits » et clique sur « Nouveau kit ».', shot: 'kits-1' },
          { text: 'Tape le « Nom » (ex. Kit carrelage), choisis le « Dépôt ».' },
          { text: 'Dans « Ajouter un outil : nom ou numéro… », cherche chaque outil et ajoute-le. Pour un outil à exemplaires, choisis l\'« Exemplaire » précis ou « N\'importe lequel ».' },
          { text: 'Clique sur « Enregistrer ».' },
          { text: 'Imprime le QR du kit et colle-le sur la caisse.' },
        ],
        result: '« Kit enregistré ». Au comptoir, scanner ce QR ajoute tout le contenu.',
        problems: [
          { if: '« Ajoutez au moins un outil au kit ».', then: 'Un kit vide ne s\'enregistre pas.' },
          { if: '« Un exemplaire est déjà dans un autre kit ».', then: 'Un même exemplaire ne peut être que dans un kit : choisis-en un autre ou « N\'importe lequel ».' },
        ],
      },
    ],
  },
  {
    id: 'etiquettes',
    category: 'materiel',
    title: 'Imprimer les étiquettes QR',
    summary: 'Sur planche autocollante ou imprimante à étiquettes.',
    route: '/etiquettes',
    routes: ['/etiquettes'],
    where: 'Matériel › Étiquettes.',
    tasks: [
      {
        id: 'imprimer',
        title: 'Imprimer des étiquettes',
        steps: [
          { text: 'Ouvre « Étiquettes ».', shot: 'etiquettes-1' },
          { text: 'Choisis le « Format » qui correspond à ta planche ou à ton imprimante (ex. Brother 62 mm).' },
          { text: 'Cherche les articles (« Rechercher un article… ») et indique pour chacun le nombre d\'étiquettes. « Tous » / « Aucun » cochent ou décochent tout.' },
          { text: 'Planche déjà entamée ? Indique « Commencer à la position » (la première case libre).' },
          { text: 'Clique sur « Imprimer ». Dans la fenêtre d\'impression, choisis l\'échelle 100 % (pas « Ajuster à la page »).' },
        ],
        problems: [{ if: 'Les étiquettes sont décalées.', then: 'Vérifie l\'échelle 100 %, les marges « Aucune » et le format de papier de l\'imprimante.' }],
      },
    ],
  },
  {
    id: 'entretien',
    category: 'materiel',
    title: 'Entretien et contrôles OIBT',
    summary: 'Révisions tous les X mois ou toutes les X sorties.',
    route: '/entretien',
    routes: ['/entretien'],
    where: 'Matériel › Entretien.',
    tasks: [
      {
        id: 'plan',
        title: 'Créer un plan d\'entretien',
        steps: [
          { text: 'Ouvre « Entretien » et clique sur « Nouveau plan ».', shot: 'entretien-1' },
          { text: 'Choisis le ou les outils (« Rechercher un outil »).' },
          { text: 'Choisis le type (« Révision », « Contrôle électrique OIBT »…) et tape l\'« Intitulé ».' },
          { text: 'Remplis « Tous les … mois » et/ou « Ou toutes les … sorties », et la « Dernière intervention ».' },
          { text: 'Pour un contrôle de sécurité, coche « Bloquer les sorties une fois échu ».' },
          { text: 'Clique sur « Créer ».' },
        ],
        result: 'Le plan apparaît avec son état : « À jour », « Bientôt » ou « Échu ».',
        problems: [
          { if: '« Choisissez au moins un outil ».', then: 'Ajoute un outil au plan.' },
          { if: '« Indiquez un intervalle en mois et/ou en sorties ».', then: 'Remplis au moins un des deux.' },
        ],
      },
      {
        id: 'fait',
        title: 'Enregistrer un entretien fait',
        steps: [
          { text: 'Sur la ligne du plan, clique sur « Fait ».' },
          { text: 'Indique la « Date », le « Technicien / entreprise » et le résultat (« Conforme » ou « Non conforme »), une « Remarque » si besoin.' },
          { text: 'Clique sur « Enregistrer ».' },
        ],
        result: 'La prochaine échéance est recalculée. « Historique » liste toutes les interventions.',
        problems: [{ if: 'Résultat « Non conforme ».', then: 'L\'outil passe en maintenance et ne peut plus sortir tant que ce n\'est pas réglé.' }],
      },
    ],
  },
  {
    id: 'atelier',
    category: 'materiel',
    title: 'Atelier : réparations, garanties, batteries',
    summary: 'Un outil en réparation ne peut pas sortir.',
    route: '/atelier',
    routes: ['/atelier'],
    where: 'Matériel › Atelier.',
    tasks: [
      {
        id: 'envoyer',
        title: 'Envoyer un outil en réparation',
        steps: [
          { text: 'Ouvre « Atelier », onglet « Réparations », puis « Envoyer en réparation ».', shot: 'atelier-1' },
          { text: 'Choisis l\'« Outil » (et l\'« Exemplaire »), le « Réparateur » (un fournisseur ou « Autre réparateur »).' },
          { text: 'Décris la « Panne », indique le « Retour prévu » et le « N° de dossier » (RMA, bon de réparation…).' },
          { text: 'Clique sur « Envoyer ».' },
        ],
        result: 'L\'outil est indisponible jusqu\'à son retour.',
      },
      {
        id: 'retour',
        title: 'Enregistrer le retour de réparation',
        steps: [
          { text: 'Sur la ligne, clique sur « Revenu ».' },
          { text: 'Indique la date « Revenu le », le coût et une « Remarque ».' },
          { text: 'Clique sur « Remettre en service ».' },
        ],
        problems: [{ if: 'Envoyé par erreur.', then: '« Annuler l\'envoi » : l\'outil redevient disponible.' }],
      },
      {
        id: 'garanties',
        title: 'Suivre les garanties et les batteries',
        steps: [
          { text: 'Onglet « Garanties » : les outils encore sous garantie et la date de fin.' },
          { text: 'Onglet « Batteries » : les batteries en fin de vie (âge ou nombre d\'utilisations).' },
        ],
      },
    ],
  },
  {
    id: 'pertes',
    category: 'materiel',
    title: 'Pertes et casse',
    summary: 'Déclarer, chiffrer, décider de la suite.',
    route: '/incidents',
    routes: ['/incidents'],
    where: 'Matériel › Pertes et casse.',
    tasks: [
      {
        id: 'declarer',
        title: 'Déclarer une perte, un vol ou une casse',
        steps: [
          { text: 'Ouvre « Pertes et casse » et clique sur « Déclarer ».', shot: 'pertes-1' },
          { text: 'Choisis l\'« Article », le « Type d\'incident » et, si tu le sais, l\'« Emprunt concerné » et la « Personne responsable ».' },
          { text: 'Décris les « Circonstances » (où, quand, comment) et ajoute des photos.' },
          { text: 'Clique sur « Enregistrer ».' },
        ],
        result: 'L\'incident est « À décider » ; le responsable est prévenu.',
      },
      {
        id: 'decider',
        title: 'Décider de la suite (responsable)',
        steps: [
          { text: 'Sur la ligne de l\'incident, clique sur « Décider ».' },
          { text: 'Choisis la « Suite à donner » : Remplacé par l\'entreprise, Retenue sur salaire, Pris en charge par l\'assurance, Passé en perte, ou Retrouvé.' },
          { text: 'Ajoute une « Remarque », puis « Enregistrer ».' },
        ],
        result: '« Décision enregistrée ». Avec « Retrouvé », l\'article revient en stock.',
      },
    ],
  },
];
