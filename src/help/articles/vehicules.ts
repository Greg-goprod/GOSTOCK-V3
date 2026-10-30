import type { HelpArticle } from '../types';

export const VEHICULES: HelpArticle[] = [
  {
    id: 'vehicules',
    category: 'vehicules',
    title: 'Les véhicules : réserver, partir, rentrer',
    summary: 'Réservation par demande, état des lieux au départ et au retour, carnet de bord.',
    route: '/vehicules',
    routes: ['/vehicules'],
    where: 'Véhicules › Véhicules.',
    tasks: [
      {
        id: 'ajouter',
        title: 'Ajouter un véhicule à la flotte',
        who: 'Gestion de la flotte, administrateur.',
        steps: [
          { text: 'Ouvre « Véhicules » et clique sur « Ajouter un véhicule ».', shot: 'vehicules-1' },
          { text: 'Remplis « Nom », « Plaque » (ex. VD 123 456), « Dépôt », « Permis » (catégorie exigée), « Places », « Kilométrage actuel ».' },
          { text: 'Indique les échéances : « Prochain service », « Changement de pneus », « Prochaine expertise ».' },
          { text: 'Clique sur « Enregistrer ».' },
        ],
        result: 'Une alerte est créée 30 jours avant chaque échéance. Une réservation est refusée si l\'expertise ou le service sont dépassés.',
      },
      {
        id: 'reserver',
        title: 'Réserver un véhicule',
        steps: [
          { text: 'Ouvre « Demandes » › « Nouvelle demande ».' },
          { text: 'Remplis « Pour qui » (le conducteur), le chantier, « Du » et « Au ».' },
          { text: 'Onglet « Véhicule » : clique sur le « + » du véhicule voulu. Sa disponibilité sur la période s\'affiche.' },
          { text: 'Clique sur « Envoyer la demande ».' },
        ],
        result: 'La réservation apparaît dans « Cette semaine » sur la page Véhicules.',
        problems: [
          { if: 'Le véhicule est refusé à cause du permis.', then: 'Le permis de conduire du conducteur n\'est pas saisi dans « Personnes », a expiré, ou ne couvre pas la catégorie du véhicule.' },
          { if: 'Le véhicule est refusé à cause d\'une échéance.', then: 'L\'expertise ou le service est dépassé : la flotte doit le mettre à jour.' },
        ],
      },
      {
        id: 'depart',
        title: 'Faire partir le véhicule (état des lieux de départ)',
        who: 'Magasinier, gestion de la flotte.',
        steps: [
          { text: 'Ouvre la demande dans « Demandes » et clique sur « Sortir : état des lieux ».' },
          { text: 'Tape le kilométrage affiché au compteur et choisis le niveau de carburant.' },
          { text: 'Note chaque dégât visible et prends au moins une photo.' },
          { text: 'Le conducteur signe dans « Signature du conducteur ».' },
          { text: 'Clique sur « Valider la sortie ».' },
        ],
        result: 'Le véhicule est « Sortie » sur le planning, au nom du conducteur.',
      },
      {
        id: 'retour',
        title: 'Enregistrer le retour du véhicule',
        steps: [
          { text: 'Sur la page « Véhicules », clique sur « Retour » sur la ligne du véhicule.' },
          { text: 'Compare avec « Photos au départ : comparez avec l\'état actuel ».' },
          { text: 'Tape le « Kilométrage au retour », le carburant, et note les nouveaux dégâts avec photo.' },
          { text: 'Clique sur « Valider le retour ».' },
        ],
        result: 'Le trajet est enregistré dans le carnet ; le véhicule est de nouveau libre.',
      },
      {
        id: 'carnet',
        title: 'Tenir le carnet de bord (pleins)',
        steps: [
          { text: 'Clique sur « Carnet » sur la ligne du véhicule : le « Carnet de bord » s\'ouvre.', shot: 'vehicules-2' },
          { text: 'Tu vois les « Trajets », la « Consommation moyenne » et le « Carburant ce mois ».' },
          { text: 'Pour un plein : « Ajouter un plein », remplis « Date », « Kilométrage », « Litres », photo du « Ticket », puis « Enregistrer ».' },
        ],
      },
    ],
  },
  {
    id: 'locations',
    category: 'vehicules',
    title: 'Les locations : du contrat à la restitution',
    summary: 'Un véhicule ou un engin loué entre dans le stock après la réception chez le loueur.',
    route: '/locations',
    routes: ['/locations'],
    where: 'Véhicules › Locations.',
    tasks: [
      {
        id: 'creer',
        title: 'Enregistrer une location',
        steps: [
          { text: 'Ouvre « Locations » et clique sur « Nouvelle location ».', shot: 'locations-1' },
          { text: '« Type de location » : « Véhicule » (fourgon, voiture), « Outil ou engin » (chariot, nacelle, mini-pelle, outil), ou « Autre » (suivi du coût seulement : rien n\'entre dans le stock).' },
          { text: 'Remplis la description, le « Loueur », le « N° de contrat », la « Plaque » (véhicule) ou la « Quantité » (outil).' },
          { text: 'Véhicule : choisis le « Permis nécessaire ». Engin : choisis le « Permis machine exigé ».' },
          { text: 'Indique « Début », « À rendre le », le prix et le « Chantier ». Le « Coût prévu » se calcule.' },
          { text: 'Clique sur « Enregistrer ».' },
        ],
        result: 'La ligne affiche « Réception à faire chez le loueur » (sauf type « Autre »).',
        problems: [{ if: '« La date de retour précède le début de la location ».', then: 'Corrige « Début » ou « À rendre le ».' }],
      },
      {
        id: 'reception',
        title: 'Faire la réception chez le loueur',
        steps: [
          { text: 'Sur place, ouvre « Locations » sur ton téléphone et clique sur « Réception » sur la ligne.', shot: 'locations-2' },
          { text: '« Relevés » : kilométrage et carburant (véhicule) ou compteur d\'heures (engin).' },
          { text: '« Photos » : prends chaque vue demandée (Avant, Arrière, Côté gauche, Côté droit, Compteur pour un véhicule ; Vue d\'ensemble et Plaque signalétique pour un engin).' },
          { text: '« Dégâts déjà présents » : pour chaque dégât, « Ajouter un dégât », choisis la « Zone », décris-le et prends une photo.' },
          { text: '« Accessoires remis » : coche ce que le loueur te donne (clés, permis de circulation…).' },
          { text: '« Signatures » : tu signes ; le loueur signe s\'il est là (sinon laisse vide).' },
          { text: 'Clique sur « Enregistrer la réception ».' },
        ],
        result: 'L\'objet entre « Dans la flotte » (véhicule) ou « Dans le stock » (outil, engin) avec « Loué jusqu\'au … ». Il se réserve et se sort comme le reste.',
        problems: [{ if: '« Signature de notre collaborateur manquante ».', then: 'Signe dans le cadre de « Notre collaborateur ».' }],
      },
      {
        id: 'prolonger',
        title: 'Prolonger une location',
        steps: [
          { text: 'Sur la ligne, clique sur « + 7 jours » (autant de fois que nécessaire), ou ouvre la location avec le crayon et change « À rendre le ».' },
        ],
        result: 'La date limite suit sur le véhicule ou l\'outil.',
      },
      {
        id: 'restitution',
        title: 'Rendre au loueur (restitution)',
        steps: [
          { text: 'Vérifie que l\'objet est rentré au dépôt (retour enregistré au comptoir ou sur la page Véhicules).' },
          { text: 'Chez le loueur, clique sur « Restitution » sur la ligne.' },
          { text: 'Refais les mêmes relevés et les mêmes photos ; les dégâts notés à la réception sont rappelés. Ajoute seulement les « Nouveaux dégâts ».' },
          { text: 'Signatures, puis « Enregistrer la restitution ».' },
          { text: 'Clique sur « PV réception et restitution » pour imprimer ou enregistrer le PV en PDF.' },
        ],
        result: 'La location est « Rendu ». Le PV met les deux états des lieux côte à côte.',
        problems: [
          { if: '« L\'outil est encore sorti : enregistrez son retour au comptoir d\'abord ».', then: 'Fais le retour au comptoir, puis reviens.' },
          { if: '« Le véhicule est encore en route : clôturez le trajet d\'abord ».', then: 'Fais « Retour » sur la page Véhicules.' },
        ],
      },
    ],
  },
  {
    id: 'location-engin',
    category: 'vehicules',
    title: 'Exemple complet : louer un chariot télescopique',
    summary: 'Un Manitou loué chez Loxam, du contrat jusqu\'à la réservation par un collaborateur.',
    route: '/locations',
    where: 'Véhicules › Locations, puis Demandes.',
    tasks: [
      {
        id: 'exemple',
        title: 'Du contrat à la réservation',
        steps: [
          { text: '« Nouvelle location ». Type : « Outil ou engin » (un chariot n\'est pas un « Véhicule », et « Autre » ne mettrait rien dans le stock).', shot: 'location-engin-1' },
          { text: '« Permis machine exigé » : « Chariot élévateur télescopique ». Seules les personnes qui ont ce permis pourront le sortir.' },
          { text: 'Loueur « Loxam », contrat, dates, prix, chantier. « Enregistrer ».' },
          { text: 'La ligne affiche « Réception à faire chez le loueur » et le bouton « Réception ». Tant que ce n\'est pas fait, l\'engin n\'est réservable par personne.', shot: 'location-engin-2' },
          { text: 'Chez Loxam : « Réception », photos, compteur d\'heures, dégâts, accessoires, signature, « Enregistrer la réception ».' },
          { text: 'L\'engin est maintenant dans « Outils » avec « Loué jusqu\'au … ».' },
          { text: 'Pour le réserver : « Nouvelle demande », onglet « Outils » (pas « Véhicule »), cherche « Manitou », « + », « Envoyer la demande ».' },
        ],
        problems: [
          { if: 'La location affiche « Coût seulement ».', then: 'Elle est en type « Autre ». Ouvre-la avec le crayon et change le type (possible tant que la réception n\'est pas faite).' },
          { if: 'Le collaborateur est refusé.', then: 'Il n\'a pas le permis machine (ou il a expiré) : ajoute-le dans « Formations et permis ».' },
        ],
      },
    ],
  },
];
