# Plan des tests poussés (exécutés par `scripts/e2e-complet.cjs`)

Chaque point est tenté seul. Verdicts : OK, KO, PARTIEL, NON TESTÉ, INFO (observation à lire).
Tout ce qui est créé est préfixé **TEST-E2E** et nettoyé en fin de série.

| Groupe | Ce qui est poussé |
|---|---|
| **G1 Droits par rôle** | Pour le collaborateur, le magasinier et le responsable : chaque page protégée (matrice lue dans `src/lib/access.ts`) s'ouvre si le rôle a le droit, redirige sinon. |
| **G2 Sécurité de l'API** | Avec le compte collaborateur : ne lit que sa fiche, ses demandes, ses sorties ; ni journal ni secrets ; ne crée pas d'article, ne se donne pas le rôle admin, ne supprime rien, ne commande pas pour autrui, ne valide pas, n'envoie pas de fichier ; injection dans un filtre ; sans connexion rien n'est lisible. |
| **G3 Commandes (cas limites)** | Validation automatique, quantité au seuil et au-delà, article « validation requise », permis manquant, chevauchement de réservation, période suivante, fin avant début, quantité 0 / négative / décimale / 1 000 000, commande vide, article inconnu ou retiré, stock insuffisant, texte avec accents, emoji, guillemets et 3 000 caractères, date passée, changement d'heure d'octobre, véhicule (permis, un seul par commande). |
| **G4 Cycle de vie** | Qui peut valider, refuser, préparer, sortir, annuler ; la décision porte le vrai nom ; avis « validée », « prête », « refusée » ; sauts d'étape refusés ; sortie d'un consommable (stock −1) ; double sortie refusée ; annuler libère la période ; on ne peut pas annuler la commande d'autrui ni une commande « prête » ; le journal enregistre. |
| **G5 Stock** | Réception, inventaire, sortie (trop, sans motif), valeurs nulles ou négatives, transfert entre dépôts et vers le même dépôt, stock modifié par un collaborateur refusé, alerte de seuil. |
| **G6 Interface Shop** | Recherche (accents, majuscules, vide, caractères spéciaux), nom d'article piégé (`<img onerror>`) affiché comme texte, nom de 200 caractères sur bureau et téléphone, quantités du panier et rechargement, double clic sur « Commander », hors ligne, article retiré pendant qu'il est au panier, session supprimée, envoi d'image (PNG accepté, texte refusé). |
| **G7 Pages** | 29 pages × 3 formats (bureau, tablette, téléphone) : erreur JavaScript, défilement horizontal, boutons sans nom, champs sans libellé, id en double, cibles tactiles trop petites, lenteur ; ouverture d'une carte et fermeture avec Échap ; navigation au clavier du Shop. |
| **G8 Langues** | Shop, Mes commandes, Accueil, Consommables en allemand, italien, anglais : mots français restants. |

Hors script (à faire à la main si besoin) : comptoir par scan de QR, impression d'étiquettes, PDF, notifications push, e-mails.
