import type { HelpArticle } from '../types';

export const PILOTAGE: HelpArticle[] = [
  {
    id: 'pilotage',
    category: 'pilotage',
    title: 'Le pilotage',
    summary: 'Utilisation du matériel, retards et coûts, en un écran.',
    route: '/pilotage',
    routes: ['/pilotage', '/tableau-de-bord'],
    where: 'Pilotage › Pilotage.',
    tasks: [
      {
        id: 'lire',
        title: 'Lire le tableau de pilotage',
        steps: [
          { text: 'Ouvre « Pilotage ».', shot: 'pilotage-1' },
          { text: '« Retours en retard » : qui doit rendre quoi. Relance les personnes.' },
          { text: '« Jamais sortis depuis 90 jours » : outils à revendre ou à déplacer.' },
          { text: '« Valeur du stock » : ce que vaut le matériel.' },
          { text: '« Détail et export → » ouvre le détail et l\'export Excel de chaque carte.' },
        ],
      },
    ],
  },
  {
    id: 'recherche',
    category: 'pilotage',
    title: 'La recherche en langage courant',
    summary: 'Pose la question comme tu la dirais au magasin.',
    route: '/recherche',
    routes: ['/recherche'],
    where: 'Pilotage › Recherche.',
    tasks: [
      {
        id: 'chercher',
        title: 'Poser une question',
        steps: [
          { text: 'Ouvre « Recherche ».' },
          { text: 'Tape ta question dans « Question », ex. « qui a la perceuse ? » ou « matériel sur le chantier Gare ».' },
          { text: 'Clique sur « Chercher ».' },
        ],
      },
    ],
  },
  {
    id: 'couts',
    category: 'pilotage',
    title: 'Coûts et comptabilité',
    summary: 'Coûts par chantier, amortissements, export pour la fiduciaire.',
    route: '/comptabilite',
    routes: ['/couts', '/comptabilite'],
    where: 'Pilotage › Coûts, et Pilotage › Comptabilité.',
    tasks: [
      {
        id: 'couts',
        title: 'Voir les coûts du mois par chantier',
        steps: [
          { text: 'Ouvre « Coûts » et choisis le « Mois ».', shot: 'couts-1' },
          { text: 'Le tableau « Par chantier » donne Consommables, Outils, Locations et Total.' },
          { text: 'Clique sur un chantier pour le « Détail », ou « Exporter Excel ».' },
        ],
        problems: [{ if: '« Certains consommables n\'ont pas de prix d\'achat ».', then: 'Complète les prix (voir « Santé des données ») : sinon les coûts sont sous-estimés.' }],
      },
      {
        id: 'compta',
        title: 'Préparer l\'export comptable de l\'année',
        who: 'Administrateur.',
        steps: [
          { text: 'Ouvre « Comptabilité » et choisis l\'« Année ».', shot: 'comptabilite-1' },
          { text: 'Vérifie les « Comptes de l\'export » avec ta fiduciaire, puis « Enregistrer les comptes ».' },
          { text: 'Choisis : « Export Excel », « Fichier Abacus », ou « Envoyer dans bexio ».' },
        ],
        problems: [{ if: '« Aucun outil avec un prix d\'achat ».', then: 'Saisis prix et date d\'achat dans les fiches des outils.' }],
      },
    ],
  },
  {
    id: 'journal',
    category: 'pilotage',
    title: 'Le journal des modifications',
    summary: 'Qui a changé quoi, quand, avant et après.',
    route: '/journal',
    routes: ['/journal'],
    where: 'Pilotage › Journal.',
    tasks: [
      {
        id: 'chercher',
        title: 'Retrouver une modification',
        steps: [
          { text: 'Ouvre « Journal ».', shot: 'journal-1' },
          { text: 'Filtre par « Type » (Article, Demande, Personne…) et par personne (« Tout le monde » par défaut).' },
          { text: 'Chaque ligne montre Création, Modification ou Suppression, avec l\'avant → l\'après. « Plus ancien » charge la suite.' },
        ],
      },
    ],
  },
];
