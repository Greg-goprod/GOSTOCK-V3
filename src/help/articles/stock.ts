import type { HelpArticle } from '../types';

export const STOCK: HelpArticle[] = [
  {
    id: 'consommables',
    category: 'stock',
    title: 'Les consommables : stock, sorties, réceptions',
    summary: 'Stock par dépôt, seuils d\'alerte, sorties décomptées sur les chantiers.',
    route: '/consommables',
    routes: ['/consommables'],
    where: 'Consommables › Consommables.',
    tasks: [
      {
        id: 'creer',
        title: 'Créer un consommable',
        steps: [
          { text: 'Ouvre « Consommables » et clique sur « Nouveau consommable ».', shot: 'consommables-1' },
          { text: 'Remplis « Nom », « Unité » (pièce, boîte, mètre…), « Fournisseur » et « Référence fournisseur ».' },
          { text: 'Choisis le « Dépôt », tape le « Stock initial » et le seuil minimum (alerte et feuille de commande sous ce seuil).' },
          { text: 'Clique sur « Créer ».' },
        ],
      },
      {
        id: 'sortir',
        title: 'Sortir un consommable sans passer par le comptoir',
        steps: [
          { text: 'Choisis le dépôt dans « Dépôt affiché ».' },
          { text: 'Sur la ligne de l\'article, clique sur « Sortir ». Le volet « Sortie de consommable » rappelle le stock du dépôt et le seuil.', shot: 'consommables-2' },
          { text: 'Vérifie le « Dépôt » et tape la « Quantité ».' },
          { text: 'Remplis « Pour qui » et/ou « Chantier ou service » (au moins l\'un des deux), une « Note (facultatif) », puis « Enregistrer ».' },
        ],
        result: 'Le stock du dépôt diminue ; le coût va sur le chantier.',
      },
      {
        id: 'reception',
        title: 'Rentrer une livraison (réception de stock)',
        steps: [
          { text: 'Sur la ligne de l\'article, clique sur « Réception ».' },
          { text: 'Tape la quantité reçue (et le prix si demandé), puis « Enregistrer ».' },
        ],
        problems: [{ if: 'La livraison correspond à une commande fournisseur.', then: 'Réceptionne-la plutôt dans « Commandes fournisseurs » : la commande et le stock sont mis à jour ensemble.' }],
      },
      {
        id: 'corriger',
        title: 'Corriger le stock après un comptage',
        steps: [
          { text: 'Sur la ligne, clique sur « Inventaire ».' },
          { text: 'Tape la quantité réellement comptée, puis « Enregistrer ».' },
        ],
        result: '« Inventaire enregistré » ; l\'écart est gardé dans l\'historique.',
      },
      {
        id: 'transfert',
        title: 'Déplacer du stock vers un autre dépôt',
        steps: [
          { text: 'Sur la ligne, clique sur « Transfert ».' },
          { text: 'Choisis « Depuis le dépôt », « Vers le dépôt » et la quantité, puis « Enregistrer ».' },
        ],
        result: '« Transfert enregistré ».',
      },
      {
        id: 'seuil',
        title: 'Régler les seuils d\'alerte',
        steps: [
          { text: 'Un seul article : « Seuil minimum » sur sa ligne, tape la valeur, « Enregistrer ».' },
          { text: 'Tous d\'un coup : clique sur « Seuils proposés ». GO-Mat calcule un seuil d\'après la consommation réelle ; vérifie et clique sur « Appliquer ».' },
        ],
      },
      {
        id: 'depots',
        title: 'Créer ou renommer un dépôt',
        steps: [
          { text: 'Clique sur « Dépôts ».' },
          { text: 'Tape le nom dans « Nouveau dépôt » puis « Ajouter ». « Définir par défaut » choisit le dépôt proposé partout.' },
        ],
        problems: [{ if: '« Un dépôt porte déjà ce nom ».', then: 'Choisis un autre nom.' }],
      },
    ],
  },
  {
    id: 'commandes',
    category: 'stock',
    title: 'Commander chez les fournisseurs',
    summary: 'De la feuille de commande à la réception de la livraison.',
    route: '/commandes',
    routes: ['/commande', '/commandes', '/prevision'],
    where: 'Consommables › À commander, puis Commandes fournisseurs.',
    tasks: [
      {
        id: 'creer',
        title: 'Créer les commandes',
        steps: [
          { text: 'Ouvre « Feuille de commande » (« À commander »). Tu vois, par fournisseur, ce qui est sous le seuil et la quantité proposée.', shot: 'commande-1' },
          { text: 'Choisis le dépôt, ajuste les quantités « À commander » si besoin.' },
          { text: 'Clique sur « Créer les bons de commande ».' },
        ],
        result: 'Un bon par fournisseur est créé en « Brouillon » dans « Commandes fournisseurs ».',
      },
      {
        id: 'envoyer',
        title: 'Envoyer une commande',
        steps: [
          { text: 'Ouvre « Commandes fournisseurs », onglet « En cours », et déplie la commande.' },
          { text: '« Envoyer par e-mail » l\'envoie au fournisseur. Ou « Imprimer », puis « Marquer envoyée » si tu l\'as transmise autrement.' },
        ],
        result: 'La commande passe en « Envoyée ».',
      },
      {
        id: 'recevoir',
        title: 'Réceptionner la livraison',
        steps: [
          { text: 'Ouvre la commande « Envoyée ».' },
          { text: 'Tout est arrivé : « Tout réceptionner ». Sinon, tape la quantité dans la colonne « Reçu » de chaque ligne.' },
        ],
        result: 'Le stock augmente. La commande passe en « Reçue en partie » ou « Reçue ».',
      },
    ],
    tips: ['« Prévision d\'achat » estime ce qu\'il faudra commander le mois prochain (consommation, demandes à venir, commandes en cours).'],
  },
];
