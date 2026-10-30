# Rapport de tests Chrome — GO-Mat

- Date : 2026-10-30
- Environnement : `npm run dev` (navigateur de prévisualisation, http://localhost:5175), compte Administrateur GO-Mat, connexion par code e-mail.
- Données de test : préfixe « TEST » uniquement. Rien d'autre n'a été supprimé ni modifié.
- Statut : **batterie incomplète**. Voir « Ce qui n'a pas été testé ».

## Données de test créées

| Type | Nom | Identifiant / code |
|---|---|---|
| Personne | TEST Badge Comptoir (test.badge@example.com, Collaborateur) | `6ae6abc8-037f-45cb-a281-bfaf2b200e64` · badge `f58aec773e89dafc02` |
| Outil | TEST Perceuse comptoir (emplacement TEST Atelier) | `c670bc06-ede3-4cf6-a3e0-f78e36702202` · exemplaire `GOMAT1-000001-001` |
| Kit | TEST Kit perçage (contient TEST Perceuse comptoir) | `aac07825-d81b-4b9b-b4f0-afd0ca2e1ba8` · code `A9C9CCB2` |

## Résultats par étape

| Étape | Résultat |
|---|---|
| Comptoir : scan du badge | OK après rechargement (voir P2) |
| Comptoir : sortie d'un outil | OK — « Sortie : TEST Perceuse comptoir » ; l'exemplaire passe à sorti |
| Comptoir : retour d'un outil | OK — le panier se vide ; l'exemplaire repasse à `available` |
| Comptoir : sortie d'un kit | OK — « Sortie : kit « TEST Kit perçage » » ; la perceuse est dans le panier |
| Comptoir : retour du kit | Non testé |
| Demande bout en bout (création, validation, préparation, sortie) | **Bloquée** — voir P5 |
| Chantier avec adresse | **Bloqué** — voir P5 |
| Page Carte | Non testée |
| Intérimaire avec caution, bouton Départ | Non testé |
| Passage en allemand, puis retour en français | OK — l'interface passe en allemand (« EINSTELLUNGEN », nav « Theke ») puis revient en français |
| Téléchargement de la sauvegarde | OK — `GO-Mat_sauvegarde_2026-10-30.json`, 8,8 Mo, 52 tables, aucune erreur `_erreur_`, l'outil TEST y figure |
| Restauration d'un article TEST supprimé | **Non réalisée** — voir P6 |

## Problèmes

### P1 — Le QR « Personnes » ne fonctionne pas au comptoir
- **Page** : Personnes (`/users`), bouton « QR CODE » d'une carte.
- **Ce que j'ai fait** : ouvert le QR de TEST Badge Comptoir, puis tenté de le lire au comptoir.
- **Attendu** : le QR identifie la personne au comptoir, comme le QR de « Mon badge » ou d'une carte imprimée (`GOMAT-USER:<code>`).
- **Constaté** : le modal affiche l'identifiant brut `6ae6abc8-037f-45cb-a281-bfaf2b200e64`, et le QR encode cette valeur. Le comptoir refuse : « Erreur de scan », console `❌ Erreur scan: Error: Badge inconnu ou accès suspendu` (avec le préfixe `GOMAT-USER:` ajouté à la main, même erreur).
- **Cause probable** : `src/pages/Users.tsx` (vers la ligne 497) passe `selectedUser` (l'id) comme `value` de `QRCodeGenerator`. Les autres écrans utilisent `badgeValue(code)` (`src/lib/badges.ts`).
- **Capture** : `captures/01-personnes-qr-contient-uuid.jpg`

### P2 — Badge créé pendant la session non reconnu jusqu'au rechargement
- **Page** : Comptoir (`/comptoir`), après création de TEST Badge Comptoir dans Personnes.
- **Ce que j'ai fait** : scan de `GOMAT-USER:f58aec773e89dafc02` sans recharger la page.
- **Attendu** : badge reconnu immédiatement après création.
- **Constaté** : « Erreur de scan », console `❌ Erreur scan: Error: Badge inconnu ou accès suspendu`. Après rechargement complet (F5), le même scan donne « Scan réussi ! ».
- **Vérification** : la fonction `find_user_by_badge` renvoie bien l'id de TEST pour ce code (appel direct, lecture seule). Le problème vient donc de l'état de l'interface, pas de la base. Cause exacte non confirmée.
- **Capture** : `captures/02-comptoir-saisie-badge-avec-prefixe.jpg` (saisie ; l'erreur elle-même n'a pas été capturée).

### P3 — Erreurs « 401 » répétées dans la console
- **Page** : toutes (Comptoir, Équipements, Demandes).
- **Constaté** : `Failed to load resource: the server responded with a status of 401 ()` et parfois `400`. Requête relevée : `GET /rest/v1/status_configs?select=id&limit=1` → 401.
- **Attendu** : aucune erreur 401 pour une session connectée.
- **Statut** : non diagnostiqué ; à vérifier.

### P4 — Création d'outil : affichage et libellé
- **Page** : Outils (`/equipment`).
- **Constaté** : le formulaire est en plusieurs étapes (« Suivant », puis « Créer le matériel ») ; il n'y a pas de bouton « Enregistrer ». Après une première tentative, la liste n'affiche toujours que la scie existante. Après rechargement, `TEST Perceuse comptoir` est présent, une seule fois (`created_at` 09:22:37 UTC).
- **Statut** : l'outil est bien créé ; le retard d'affichage est à vérifier.
- **Captures** : `captures/03-outil-formulaire-etape1.jpg`, `captures/04-outil-liste-apres-premiere-tentative.jpg`

### P5 — Les fenêtres ouvertes se ferment toutes seules ; écran « Chargement… »
- **Pages** : Demandes (« Nouvelle demande »), Chantiers (« Nouveau chantier »), Outils (« Ajouter un équipement »), Personnes.
- **Ce que j'ai fait** : ouvert le formulaire, puis attendu sans rien faire, ou choisi une personne dans « Nouvelle demande ».
- **Attendu** : le formulaire reste ouvert jusqu'à action de l'utilisateur.
- **Constaté** :
  - Le formulaire se ferme en 2 à 3 secondes sans interaction (reproduit sur les trois pages).
  - Dans « Nouvelle demande », choisir une personne ferme le formulaire et renvoie à la liste (reproduit deux fois).
  - Des captures d'écran montrent alors un écran plein « Chargement… », alors que le DOM contient bien la page (l'arbre d'accessibilité la montre). La capture est donc possiblement figée ; à confirmer.
- **Cause probable (non confirmée)** : `src/contexts/AuthContext.tsx` (vers la ligne 62) repasse `loading` à `true` sur les événements `SIGNED_IN`, `SIGNED_OUT` ou `USER_UPDATED`. `src/components/auth/AuthGate.tsx` (ligne 22) affiche alors « Chargement… » et démonte toute la page, donc les fenêtres ouvertes. Les erreurs 401 de P3 pourraient déclencher ces événements. Il faudrait vérifier quel événement `onAuthStateChange` émet.
- **Capture** : `captures/05-chargement-plein-ecran-formulaire-ferme.jpg`

### P6 — Restauration impossible à tester : la suppression d'un outil avec historique est refusée
- **Page** : Outils, puis Sauvegarde (Paramètres).
- **Ce que j'ai fait** : tenté de supprimer TEST Perceuse comptoir (bouton « Supprimer », confirmation « Cette action est irréversible »). La confirmation s'est fermée avant que je puisse la valider (P5). Via l'API, sur ce seul outil TEST, la suppression est refusée.
- **Attendu** : suppression (ou message clair de refus), puis restauration depuis la sauvegarde.
- **Constaté** : `409` — `{"code":"23503","message":"update or delete on table \"equipment\" violates foreign key constraint \"checkouts_equipment_id_fkey\" on table \"checkouts\""}`. L'outil a un historique de sorties, donc la base refuse. L'interface, elle, propose une suppression « irréversible » sans l'indiquer : à vérifier (quel message s'affiche à l'utilisateur ?).
- **Statut** : la restauration n'a pas été faite. Pour la tester, il faut un article TEST sans historique, puis une sauvegarde, puis la suppression, puis « Remettre les lignes manquantes ».

## Ce qui n'a pas été testé
- Comptoir : retour du kit.
- Demande bout en bout (bloquée par P5).
- Chantier avec adresse, et page Carte (bloqués par P5 pour la création).
- Intérimaire avec caution, et bouton Départ.
- Restauration d'un article supprimé (P6).

## Tests non destructifs en lecture
- Les interrogations de la base (`equipment_instances`, `user_badges`, `checkouts`, `kits`) ont été faites avec le jeton de la session, en lecture seule, pour vérifier les résultats.
