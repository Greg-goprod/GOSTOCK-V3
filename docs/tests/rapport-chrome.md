# Rapport de tests Chrome — GO-Mat

- Date : 2026-10-30
- Environnement : `npm run dev` (navigateur de prévisualisation, http://localhost:5175), compte Administrateur GO-Mat, connexion par code e-mail.
- Données de test : préfixe « TEST » uniquement. Rien d'autre n'a été supprimé ni modifié.
- Code de l'application : non modifié. Les investigations dans le code étaient en lecture seule.

## Données de test

| Type | Nom | Identifiant / code | État |
|---|---|---|---|
| Personne | TEST Badge Comptoir (test.badge@example.com, Collaborateur) | `6ae6abc8-037f-45cb-a281-bfaf2b200e64` · badge `f58aec773e89dafc02` | active |
| Outil | TEST Perceuse comptoir (TEST Atelier) | `c670bc06-ede3-4cf6-a3e0-f78e36702202` · exemplaire `GOMAT1-000001-001` | sortie active (`dc7e0923…`) pour la demande DEM2610-0001 |
| Kit | TEST Kit perçage (contient la perceuse) | `aac07825-d81b-4b9b-b4f0-afd0ca2e1ba8` · code `A9C9CCB2` | sortie rendue |
| Demande | DEM2610-0001 (TEST Badge Comptoir, TEST Chantier demande) | — | sortie faite |
| Article | TEST Article suppression | `315cde03-b256-4e52-85f6-cf3df776fe84` | supprimé (par API, sans historique) ; **non restauré** (voir P9) |

## Résultats par étape

| Étape | Résultat |
|---|---|
| Comptoir : scan du badge | OK après rechargement de la page (voir P2) |
| Comptoir : sortie d'un outil | OK — « Sortie : TEST Perceuse comptoir » ; l'exemplaire passe à sorti |
| Comptoir : retour d'un outil | OK — l'exemplaire repasse à `available` |
| Comptoir : sortie d'un kit | OK — « Sortie : kit « TEST Kit perçage » » |
| Comptoir : retour d'un kit | **Partiel** — le retour par scan du QR du kit ne s'enregistre pas (P7). Le retour par case à cocher « EN SA POSSESSION » fonctionne : les deux sorties passent à `returned` |
| Demande : création | OK — DEM2610-0001 créée, statut « Validée » (pas de validation requise sur cet outil) |
| Demande : validation | Automatique (pas d'approbation requise). La validation manuelle n'a pas été testée. |
| Demande : envoi refusé si indisponible | OK — « 0 disponible(s), 1 demandé(s) » : l'envoi est bloqué tant que l'outil est sorti |
| Demande : préparation | Partielle — « Marquer prête » fait perdre la préparation (P8) |
| Demande : sortie | OK — une sortie `active` est créée, rattachée à la demande (onglet « Sorties ») |
| Chantier avec adresse | Non testé de bout en bout (voir P5) |
| Page Carte | Non testée |
| Intérimaire avec caution, bouton Départ | Non testé |
| Allemand, puis retour en français | OK — l'interface passe en allemand (« EINSTELLUNGEN », nav « Theke ») puis revient en français |
| Téléchargement de la sauvegarde | OK — `GO-Mat_sauvegarde_2026-10-30.json`, 8,8 Mo, 52 tables, aucune erreur `_erreur_`, les articles TEST y figurent |
| Restauration d'un article TEST supprimé | **Échec** — voir P9 |

## Problèmes

### P1 — Le QR « Personnes » ne fonctionne pas au comptoir
- **Page** : Personnes (`/users`), bouton « QR CODE » d'une carte.
- **Ce que j'ai fait** : ouvert le QR de TEST Badge Comptoir, puis tenté de le lire au comptoir.
- **Attendu** : le QR identifie la personne au comptoir, comme le QR de « Mon badge » ou d'une carte imprimée (`GOMAT-USER:<code>`).
- **Constaté** : le modal affiche l'identifiant brut `6ae6abc8-037f-45cb-a281-bfaf2b200e64`, et le QR encode cette valeur. Le comptoir refuse : « Erreur de scan », console `❌ Erreur scan: Error: Badge inconnu ou accès suspendu`. Avec le préfixe `GOMAT-USER:` ajouté à la main, même erreur.
- **Cause probable** : `src/pages/Users.tsx` (vers la ligne 497) passe `selectedUser` (l'id) comme `value` de `QRCodeGenerator`. Les autres écrans utilisent `badgeValue(code)` (`src/lib/badges.ts`).
- **Capture** : `captures/01-personnes-qr-contient-uuid.jpg`

### P2 — Badge créé pendant la session non reconnu jusqu'au rechargement
- **Page** : Comptoir (`/comptoir`), après création de TEST Badge Comptoir dans Personnes.
- **Ce que j'ai fait** : scan de `GOMAT-USER:f58aec773e89dafc02` sans recharger la page.
- **Attendu** : badge reconnu immédiatement après création.
- **Constaté** : « Erreur de scan », console `❌ Erreur scan: Error: Badge inconnu ou accès suspendu`. Après rechargement complet, le même scan donne « Scan réussi ! ».
- **Vérification** : la fonction `find_user_by_badge` renvoie bien l'id de TEST pour ce code (appel direct, lecture seule). Le problème vient donc de l'état de l'interface. Cause non confirmée.
- **Capture** : `captures/02-comptoir-saisie-badge-avec-prefixe.jpg` (saisie ; l'erreur n'a pas été capturée).

### P3 — Erreurs « 401 » et « 400 » répétées dans la console
- **Page** : toutes.
- **Constaté** : `Failed to load resource: the server responded with a status of 401 ()`, et parfois `400` et `409`. Requête relevée : `GET /rest/v1/status_configs?select=id&limit=1` → 401 (`net::ERR_ABORTED`). Les corps de réponse des 400 et 409 n'ont pas pu être lus.
- **Attendu** : aucune erreur pour une session connectée et des actions réussies.
- **Statut** : non diagnostiqué.

### P4 — Création d'outil : formulaire en plusieurs étapes, liste en retard
- **Page** : Outils (`/equipment`).
- **Constaté** : le formulaire n'a pas de bouton « Enregistrer » : « Suivant », puis « Créer le matériel ». Après une première tentative, la liste n'affiche pas l'outil créé. Après rechargement, `TEST Perceuse comptoir` est présent, une seule fois.
- **Captures** : `captures/03-outil-formulaire-etape1.jpg`, `captures/04-outil-liste-apres-premiere-tentative.jpg`

### P5 — Fenêtres qui se ferment seules et écran « Chargement… » (intermittent)
- **Pages** : Demandes, Chantiers, Outils, Paramètres (restauration).
- **Constaté pendant la première partie des tests** :
  - Un formulaire (« Nouvelle demande », « Nouveau chantier », « Ajouter un équipement ») se fermait en 2 à 3 secondes sans action. Dans « Nouvelle demande », choisir une personne le fermait aussi (reproduit deux fois).
  - Des captures montraient un écran plein « Chargement… » alors que le DOM contenait la page.
- **Constaté plus tard** : le même choix de personne ne ferme plus le formulaire, et aucun « Chargement… » n'apparaît pendant plus de 30 secondes. Le problème est donc intermittent.
- **Cause probable (non confirmée)** : `src/contexts/AuthContext.tsx` (vers la ligne 62) repasse `loading` à `true` sur les événements `SIGNED_IN`, `SIGNED_OUT` ou `USER_UPDATED`. `src/components/auth/AuthGate.tsx` (ligne 22) affiche alors « Chargement… » et démonte la page. Je n'ai pas pu observer ces événements.
- **Capture** : `captures/05-chargement-plein-ecran-formulaire-ferme.jpg`. Attention : les captures d'écran de l'outil étaient parfois en retard sur le DOM.

### P6 — Suppression refusée pour un outil avec historique (base)
- **Page** : Outils, bouton « Supprimer ».
- **Ce que j'ai fait** : tenté de supprimer TEST Perceuse comptoir, qui a un historique de sorties. Via l'API, la suppression est refusée.
- **Constaté** : `409` — `{"code":"23503","message":"update or delete on table \"equipment\" violates foreign key constraint \"checkouts_equipment_id_fkey\" on table \"checkouts\""}`.
- **Attendu** : l'interface doit expliquer le refus (ou archiver l'outil). Le dialogue dit « Cette action est irréversible » sans mention de l'historique. Le message affiché dans l'interface n'a pas été vérifié (la confirmation a été fermée, voir P5).

### P7 — Retour d'un kit par scan du QR : rien n'est enregistré
- **Page** : Comptoir, mode « Retour ».
- **Ce que j'ai fait** : badge TEST scanné, puis QR du kit `GOMAT-KIT:A9C9CCB2` scanné (mode Retour), puis « Valider ».
- **Attendu** : la sortie du kit passe à `returned`.
- **Constaté** : le panier affiche « Retour · TEST Perceuse comptoir · TEST Kit perçage », puis « Valider » vide le panier et affiche l'écran de réinitialisation (pas d'erreur visible). En base, la sortie du kit (`982fe21d-…`) reste `active`. Console : `409` et `400` juste après.
- **Contournement vérifié** : cocher « TEST Perceuse comptoir » dans la liste « EN SA POSSESSION » puis « Valider » : les deux sorties passent à `returned`.
- **Cause probable** : `src/lib/offlineCounter.ts` (`submitOperation`) envoie `return_with_check` avec `p_checkout_id` de la ligne du panier. Le retour via le kit ne transmet pas le même identifiant que la liste. Non confirmé.

### P8 — « Marquer prête » fait perdre la préparation
- **Page** : Demandes, fiche DEM2610-0001.
- **Ce que j'ai fait** : scanné `GOMAT1-000001-001` (compteur « 1 / 1 préparé(s) »), puis « Marquer prête ».
- **Attendu** : la demande passe à « Prête » avec l'article préparé, et « Sortir » reste disponible.
- **Constaté** : la liste affiche « Prête ». En rouvrant la fiche : « 0 / 1 préparé(s) » et « Sortir » désactivé. Il a fallu rescanner l'article (« 1 / 1 ») pour pouvoir sortir.
- **Capture** : `captures/07-demande-fiche-avant-scan.jpg` (fiche avant scan), `captures/08-demande-prete-liste.jpg` (liste « Prête »).

### P9 — Restauration d'un article supprimé : rien n'est remis
- **Page** : Paramètres, section « Restaurer depuis une sauvegarde ».
- **Ce que j'ai fait** :
  1. créé TEST Article suppression, sans historique ;
  2. téléchargé une sauvegarde qui le contient (vérifié : présent dans le fichier) ;
  3. supprimé l'article par l'API (`DELETE` avec `id` et `name`, `200`) ; il ne reste que TEST Perceuse comptoir en base ;
  4. chargé le fichier dans le champ « Fichier de sauvegarde », puis « Remettre les lignes manquantes », puis « Confirmer ».
- **Attendu** : l'article revient en base, et un journal indique le nombre de lignes remises.
- **Constaté** : après le clic, la section revient à son état initial : ni fichier affiché, ni bouton, ni journal. L'article n'est pas revenu en base. Trois fois de suite : même résultat. Des `400` et `409` apparaissent dans la console pendant l'opération, sans corps lisible.
- **Cause** : non déterminée. Le code de restauration (`src/components/settings/BackupPanel.tsx`, fonction `restore`) affiche pourtant un journal par table, y compris en cas d'erreur. Le journal absent suggère que le composant a été démonté (lien possible avec P5), ou une erreur avant l'affichage.
- **Pour reproduire** : relancer la restauration avec l'onglet Réseau ouvert, et relever les appels `restore_missing_rows` et leurs corps de réponse.

## Ce qui n'a pas été testé
- Retour d'un kit par scan (P7 : contournement vérifié seulement).
- Validation manuelle d'une demande (l'outil ne demandait pas d'approbation).
- Chantier avec adresse et page Carte.
- Intérimaire avec caution, et bouton Départ.
- Restauration complète (P9).

## Annexe : vérifications en lecture seule
- Requêtes `equipment_instances`, `user_badges`, `checkouts`, `kits`, `equipment`, avec le jeton de la session, pour contrôler les résultats affichés. Aucune écriture hors des actions de l'interface, sauf la suppression par API de TEST Article suppression (étape 3 de P9).
