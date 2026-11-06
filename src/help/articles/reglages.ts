import type { HelpArticle } from '../types';

export const REGLAGES: HelpArticle[] = [
  {
    id: 'parametres',
    category: 'reglages',
    title: 'Les paramètres',
    summary: 'Entreprise, alertes, catalogues, listes de référence, sauvegarde, outil trouvé.',
    route: '/settings',
    routes: ['/settings'],
    where: 'Réglages › Paramètres (administrateur).',
    tasks: [
      {
        id: 'systeme',
        title: 'Régler l\'entreprise et les règles de validation',
        steps: [
          { text: 'Ouvre « Paramètres » et déplie « Paramètres système ».', shot: 'parametres-1' },
          { text: 'Remplis le nom de l\'« Entreprise », l\'« URL du logo de l\'entreprise » et la « Série de numérotation des articles » (ex. GCENT1). « Sauver » à chaque ligne.' },
          { text: '« Seuil de validation des demandes » : au-delà de cette quantité par article, une demande doit être validée par un responsable.' },
        ],
      },
      {
        id: 'alertes',
        title: 'Choisir qui reçoit les alertes par e-mail',
        steps: [
          { text: 'Déplie « Notifications par e-mail et SMS ».' },
          { text: 'Tape le « Nom » et l\'« E-mail », choisis le « Dépôt » (ou « Tous les dépôts »).' },
          { text: 'Coche les « Alertes reçues » : Stock bas, Demandes à valider, Échéances véhicules, Retards de plus de 3 jours, Rapport mensuel…' },
          { text: 'Clique sur « Ajouter le destinataire ».' },
          { text: 'Clique sur « Tester » sur sa ligne : un e-mail d\'essai part tout de suite.' },
        ],
        result: 'Les alertes partent par e-mail dans les 5 minutes.',
        problems: [
          { if: '« Choisis au moins un type d\'alerte ».', then: 'Coche au moins une alerte.' },
          { if: 'Le test n\'arrive pas.', then: 'Regarde les indésirables, puis vérifie l\'adresse. Si rien n\'arrive, préviens l\'administrateur technique.' },
        ],
      },
      {
        id: 'listes',
        title: 'Gérer catégories, fournisseurs, groupes, départements',
        steps: [
          { text: 'Déplie la section voulue (catégories, fournisseurs, « Groupes d\'équipements », départements, types de maintenance).' },
          { text: '« Ajouter » pour créer, crayon « Modifier » pour renommer, poubelle « Supprimer » pour effacer.' },
          { text: 'Sous-groupes : crée d\'abord le groupe, puis « Ajouter sous-groupe ».' },
        ],
      },
      {
        id: 'catalogue',
        title: 'Importer ou mettre à jour un catalogue fournisseur',
        steps: [
          { text: 'Déplie « Catalogues fournisseurs ».' },
          { text: 'Choisis le « Fournisseur » (ou « Nouveau fournisseur… »), puis le fichier du catalogue.' },
          { text: 'Lis la « Liste des changements » : prix modifiés, nouveaux, retirés, renommés.' },
          { text: 'Coche si besoin « Reporter les nouveaux prix sur le prix d\'achat… », puis « Importer le catalogue ».' },
        ],
        result: 'Le catalogue sert à remplir les fiches ; il ne crée pas de stock.',
      },
      {
        id: 'sauvegarde',
        title: 'Sauvegarder et restaurer',
        steps: [
          { text: 'Une sauvegarde complète est faite automatiquement chaque mois.' },
          { text: 'Pour en avoir une tout de suite : « Télécharger la sauvegarde complète ».' },
          { text: 'Pour récupérer des lignes effacées : « Restaurer… », choisis le fichier, puis « Remettre les lignes manquantes ». Rien d\'existant n\'est modifié.' },
        ],
      },
      {
        id: 'outil-trouve',
        title: 'Régler la page « outil trouvé »',
        steps: [
          { text: 'Dans « Outil trouvé », tape le « Téléphone » et le « Message affiché à qui trouve un outil ».' },
          { text: 'Clique sur « Enregistrer ».' },
        ],
        result: 'Qui scanne un outil oublié voit le nom de l\'entreprise, ce téléphone et ce message, rien d\'autre.',
      },
      {
        id: 'raz',
        title: 'Remise à zéro du système (dangereux)',
        steps: [
          { text: 'Télécharge d\'abord une sauvegarde complète.' },
          { text: 'Dans la « Zone d\'administration », clique sur « Remettre à zéro le système », lis la liste, « Continuer vers la confirmation ».' },
          { text: 'Tape exactement le texte demandé, puis confirme.' },
        ],
        problems: [{ if: 'Je me suis trompé.', then: 'C\'est irréversible : seule la sauvegarde permet de remettre les lignes supprimées.' }],
      },
    ],
  },
  {
    id: 'sante-donnees',
    category: 'reglages',
    title: 'Santé des données',
    summary: 'Ce qui manque ou se répète, avec un lien pour corriger.',
    route: '/donnees',
    routes: ['/donnees'],
    where: 'Réglages › Santé des données.',
    tasks: [
      {
        id: 'corriger',
        title: 'Corriger les données incomplètes',
        steps: [
          { text: 'Ouvre « Santé des données ».', shot: 'donnees-1' },
          { text: 'Chaque ligne dit ce qui manque (ex. « Articles sans prix d\'achat ») et pourquoi c\'est gênant.' },
          { text: 'Clique sur « Corriger → » : la bonne page s\'ouvre. Corrige, puis reviens : le compteur baisse.' },
        ],
      },
    ],
  },
];
