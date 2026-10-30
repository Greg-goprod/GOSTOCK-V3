// Contenu de la rubrique Aide (français, tutoiement). Chaque article est découpé en tâches
// (« Je veux… ») décrites pas à pas avec les libellés exacts des écrans. Les captures sont générées
// par scripts/help-screenshots.cjs avec des données fictives et rangées dans public/aide/<nom>.jpg.
import type { FaqItem, HelpArticle, HelpCategory, HelpTask } from './types';
import { DEMARRAGE } from './articles/demarrage';
import { MAGASIN } from './articles/magasin';
import { MATERIEL } from './articles/materiel';
import { STOCK } from './articles/stock';
import { VEHICULES } from './articles/vehicules';
import { CHANTIERS } from './articles/chantiers';
import { PERSONNES } from './articles/personnes';
import { PILOTAGE } from './articles/pilotage';
import { REGLAGES } from './articles/reglages';

export type { FaqItem, HelpArticle, HelpCategory, HelpProblem, HelpStep, HelpTask } from './types';

export const CATEGORIES: { id: HelpCategory; label: string; summary: string }[] = [
  { id: 'demarrage', label: 'Démarrage rapide', summary: 'Se connecter, se repérer, ta journée type.' },
  { id: 'magasin', label: 'Magasin', summary: 'Comptoir, demandes, sorties, transferts, inventaire.' },
  { id: 'materiel', label: 'Matériel', summary: 'Outils, kits, étiquettes, entretien, réparations, pertes.' },
  { id: 'stock', label: 'Consommables et achats', summary: 'Stock par dépôt, seuils, commandes fournisseurs.' },
  { id: 'vehicules', label: 'Véhicules et locations', summary: 'Réserver, partir, rentrer, louer chez un loueur.' },
  { id: 'chantiers', label: 'Chantiers', summary: 'Budget, matériel sur place, carte, planning.' },
  { id: 'personnes', label: 'Personnes', summary: 'Fiches, badges, permis machines, EPI, départs.' },
  { id: 'pilotage', label: 'Pilotage', summary: 'Retards, coûts, comptabilité, journal.' },
  { id: 'reglages', label: 'Réglages', summary: 'Paramètres, alertes, sauvegarde, santé des données.' },
];

export const ARTICLES: HelpArticle[] = [
  ...DEMARRAGE, ...MAGASIN, ...MATERIEL, ...STOCK, ...VEHICULES, ...CHANTIERS, ...PERSONNES, ...PILOTAGE, ...REGLAGES,
];

// Raccourcis « Je veux… » de la page d'accueil de l'aide
export const QUICK: { label: string; article: string; task: string }[] = [
  { label: 'Me connecter', article: 'connexion', task: 'code' },
  { label: 'Sortir un outil au comptoir', article: 'comptoir', task: 'sortir' },
  { label: 'Reprendre du matériel rendu', article: 'comptoir', task: 'rendre' },
  { label: 'Faire une demande', article: 'demandes', task: 'creer' },
  { label: 'Préparer une demande', article: 'demandes', task: 'preparer' },
  { label: 'Réserver un véhicule', article: 'vehicules', task: 'reserver' },
  { label: 'Enregistrer une location', article: 'locations', task: 'creer' },
  { label: 'Ajouter un outil', article: 'outils', task: 'ajouter' },
  { label: 'Ajouter une personne', article: 'personnes', task: 'ajouter' },
  { label: 'Commander des consommables', article: 'commandes', task: 'creer' },
  { label: 'Créer un chantier', article: 'chantiers', task: 'creer' },
  { label: 'Recevoir les alertes par e-mail', article: 'parametres', task: 'alertes' },
];

export const articleById = (id: string) => ARTICLES.find(a => a.id === id);

export const FAQ: { group: string; items: FaqItem[] }[] = [
  {
    group: 'Connexion',
    items: [
      { q: 'Je ne reçois pas le code de connexion.', a: 'Regarde dans les indésirables (expéditeur Mannyx). Attends une minute entre deux demandes : un nouvel envoi n\'est possible qu\'après 60 secondes. Vérifie que ton adresse est bien celle enregistrée dans « Personnes ».', article: 'connexion' },
      { q: 'Le code a 8 chiffres, c\'est normal ?', a: 'Oui. Tape les 8 chiffres tels quels.' },
      { q: 'Je préfère un mot de passe.', a: 'Connecte-toi une fois avec le code, puis « Mon badge » › « Mon mot de passe (facultatif) ».', article: 'connexion' },
      { q: '« Accès non autorisé » après la connexion.', a: 'Ton adresse n\'est pas dans « Personnes », ou ton accès est suspendu (intérimaire après la date « accès jusqu\'au », départ enregistré). Demande à ton responsable.' },
      { q: 'Comment installer GO-Mat sur mon téléphone ?', a: 'Ouvre GO-Mat dans le navigateur, puis « Ajouter à l\'écran d\'accueil ».', article: 'connexion' },
    ],
  },
  {
    group: 'Comptoir et sorties',
    items: [
      { q: 'Le badge n\'est pas reconnu.', a: 'Vérifie que la personne est active et que son accès n\'a pas expiré. Le motif exact s\'affiche sous la caméra. En dépannage, clique sur « choisis la personne ».', article: 'comptoir' },
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
      { q: 'Une location n\'apparaît pas quand je veux la réserver.', a: 'Deux causes possibles : la location est de type « Autre (coût seulement) » (pastille « Coût seulement »), ou la réception chez le loueur n\'a pas encore été faite (« Réception à faire »). Un engin (chariot, nacelle) se trouve dans l\'onglet « Outils » de la demande, pas « Véhicule ».', article: 'location-engin' },
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

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const taskText = (t: HelpTask) =>
  [t.title, t.who ?? '', t.result ?? '', ...t.steps.map(s => s.text), ...(t.problems ?? []).flatMap(p => [p.if, p.then])].join(' ');

// Recherche dans les tâches (titre, étapes, problèmes), les articles et la FAQ
export function searchHelp(query: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const hit = (text: string) => words.every(w => normalize(text).includes(w));
  if (!words.length) return { tasks: [] as { article: HelpArticle; task: HelpTask }[], faq: [] as FaqItem[] };
  const tasks = ARTICLES.flatMap(article => article.tasks
    .filter(task => hit(`${article.title} ${taskText(task)}`))
    .map(task => ({ article, task })));
  // Les tâches dont le titre contient la recherche passent devant
  tasks.sort((a, b) => Number(hit(b.task.title)) - Number(hit(a.task.title)));
  return { tasks, faq: FAQ.flatMap(g => g.items).filter(i => hit(`${i.q} ${i.a}`)) };
}
