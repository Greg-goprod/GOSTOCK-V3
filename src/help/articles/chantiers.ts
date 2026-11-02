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
    id: 'planning-chantier',
    category: 'chantiers',
    title: 'Le planning de chantier',
    summary: 'Qui intervient où et quand : zones, équipes, prestataires, frise, séries et matériel. Module payant, activé par la plateforme.',
    route: '/pilote/planning',
    routes: ['/pilote/planning', '/planning-chantier'],
    where: 'PILOTE › Planification › Planning (ou « Planning » dans la fiche d\'un chantier).',
    tasks: [
      {
        id: 'preparer',
        title: 'Préparer le planning d\'un chantier',
        who: 'Administrateur et responsable (les autres lisent le planning).',
        steps: [
          { text: 'Ouvre « PILOTE », puis « Planning », et choisis le chantier en haut de la page.' },
          { text: 'Onglet « Réglages » : règle les heures de la journée (ou coche « Chantier en 24 h/24 »), le « Pas de planification » (15 minutes par défaut) et bloque les jours impossibles (dimanche, jour férié) avec « Bloquer ce jour ».' },
          { text: 'Onglet « Prestataires » : « Nouveau prestataire » pour chaque société externe (scène, son, lumière, traiteur…). Ils servent pour tous tes chantiers.' },
          { text: 'Onglet « Zones » : « Nouvelle zone » pour chaque lieu du chantier (scène, parking, accueil…).' },
          { text: 'Onglet « Équipes » : « Nouvelle équipe », rattachée à un prestataire ou laissée « Équipe interne ». Onglet « Phases » : montage, exploitation, démontage (facultatif).' },
        ],
        result: 'Le chantier a ses zones et ses équipes : tu peux planifier. La période du chantier reste celle de sa fiche (Chantiers › Modifier).',
      },
      {
        id: 'frise',
        title: 'Planifier avec la frise',
        who: 'Administrateur et responsable.',
        steps: [
          { text: 'Onglet « Frise ». Choisis « Par zone » ou « Par prestataire », puis « Jour » ou « Semaine ». Les flèches et « Aujourd\'hui » changent de jour ou de semaine.' },
          { text: 'Clique dans une zone vide d\'une ligne : la fenêtre « Nouvelle intervention » s\'ouvre avec la ligne et l\'heure déjà remplies.' },
          { text: 'Glisse une intervention pour la déplacer, même sur une autre ligne (autre zone ou autre équipe). Tire son bord gauche ou droit pour changer sa durée. Les heures se calent sur le pas du chantier.' },
          { text: 'Au clavier : place-toi sur une intervention, flèches gauche/droite pour la déplacer d\'un pas, Maj + flèche pour changer sa durée, flèches haut/bas pour changer de ligne, Entrée pour l\'ouvrir.' },
        ],
        result: 'Les jours bloqués et les jours hors période du chantier sont hachurés. Une intervention avec un cadre orange manque de matériel (voir plus bas).',
        problems: [
          { if: 'L\'intervention revient à sa place avec un message.', then: 'La base a refusé le déplacement (équipe déjà occupée, hors des heures, jour bloqué…). Lis le message, ou choisis un autre créneau.' },
          { if: 'Tu ne peux rien déplacer.', then: 'Tu as la lecture seule, ou le chantier est clôturé (« Clôturé : lecture seule »).' },
        ],
      },
      {
        id: 'creer',
        title: 'Créer ou modifier une intervention à la main',
        who: 'Administrateur et responsable.',
        steps: [
          { text: 'Onglet « Interventions » (liste ou cartes), puis « Nouvelle intervention ». Pour modifier : « Modifier » sur la ligne ou la carte.' },
          { text: 'Remplis « Intitulé », « Zone », « Équipe », « Phase » (facultatif), le jour et les heures « De » / « À ». Heures de Suisse.' },
          { text: 'Clique sur « Enregistrer ».' },
        ],
        problems: [
          { if: '« Cette équipe a déjà une intervention sur ce créneau ».', then: 'Une équipe ne peut pas être à deux endroits à la fois : change l\'heure ou l\'équipe.' },
          { if: '« Les heures doivent tomber sur un pas de 15 minutes ».', then: 'Choisis une heure ronde au quart d\'heure (ou change le pas dans « Réglages »).' },
          { if: '« Hors des heures du chantier ».', then: 'Reste dans la journée du chantier, ou élargis-la dans « Réglages » (ou coche 24 h/24).' },
          { if: '« Jour bloqué », « Avant le début du chantier » ou « Après la fin du chantier ».', then: 'Choisis un autre jour ; la période se modifie dans la fiche du chantier.' },
          { if: '« Ce chantier est clôturé ».', then: 'Rouvre le chantier dans Chantiers pour modifier son planning.' },
        ],
      },
      {
        id: 'repeter',
        title: 'Répéter une intervention sur plusieurs jours',
        who: 'Administrateur et responsable.',
        steps: [
          { text: 'Dans « Nouvelle intervention », coche « Répéter sur plusieurs jours ».' },
          { text: 'Indique « Jusqu\'au (inclus) » et coche les jours de la semaine voulus (lundi à vendredi par défaut), puis « Enregistrer ».' },
          { text: 'Pour retirer une série : ouvre une de ses interventions (« Modifier »), puis « Supprimer toute la série ».' },
        ],
        result: 'Les jours bloqués sont sautés. Si un jour est refusé, RIEN n\'est créé et le message nomme la date (par exemple « 15.12.2026 : Cette équipe a déjà une intervention sur ce créneau »).',
      },
      {
        id: 'copier',
        title: 'Copier un jour',
        who: 'Administrateur et responsable.',
        steps: [
          { text: 'Clique sur « Copier un jour » (dans la frise ou dans « Interventions »).' },
          { text: 'Choisis « Jour à copier », puis la période de destination (« Copier du » / « au ») et les jours de la semaine.' },
          { text: 'Clique sur « Copier ».' },
        ],
        result: 'Toutes les interventions du jour (avec leur matériel) sont recopiées aux mêmes heures. Là aussi, tout ou rien : un jour refusé annule la copie et le message nomme la date.',
      },
      {
        id: 'materiel',
        title: 'Prévoir le matériel nécessaire',
        who: 'Administrateur et responsable.',
        steps: [
          { text: 'Dans la fenêtre d\'une intervention, « Ajouter du matériel » : choisis l\'outil et la quantité.' },
          { text: 'Enregistre. Si le matériel manque à ce moment-là, un avertissement orange apparaît sur la frise, la liste, la carte et dans la fenêtre : « Échafaudage : 2 demandé(s), 0 disponible(s) à ce moment ».' },
        ],
        result: 'L\'avertissement tient compte du stock réel (maintenance, sorties en cours, demandes validées) et du matériel déjà prévu par d\'autres interventions qui se chevauchent. C\'est un avertissement, pas un blocage : le planning se prépare avant les réservations.',
      },
    ],
    tips: [
      'La sauvegarde (Paramètres) et la sauvegarde automatique incluent le planning.',
      'La vérification des formations des personnes arrivera quand les personnes seront rattachées aux interventions.',
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
