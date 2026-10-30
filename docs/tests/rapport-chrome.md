# Rapport de tests Chrome — GO-Mat

- Date : 2026-10-30
- Environnement : `npm run dev` (navigateur de prévisualisation, http://localhost:5175), compte Administrateur GO-Mat.
- Données de test : préfixe « TEST » uniquement. Rien d'autre n'a été supprimé ni modifié.
- Statut : **en cours** — étapes 1 à 3 (comptoir) partiellement couvertes. Les autres étapes ne sont pas encore testées.

## Données de test créées

| Type | Nom | Identifiant |
|---|---|---|
| Personne | TEST Badge Comptoir (test.badge@example.com, Collaborateur) | `6ae6abc8-037f-45cb-a281-bfaf2b200e64` |
| Badge (code) | — | `f58aec773e89dafc02` (contenu QR attendu : `GOMAT-USER:f58aec773e89dafc02`) |
| Outil | TEST Perceuse comptoir (emplacement TEST Atelier) | `c670bc06-ede3-4cf6-a3e0-f78e36702202` |

## Problèmes

### P1 — Le QR « Personnes » ne fonctionne pas au comptoir
- **Page** : Personnes (`/users`), bouton « QR CODE » d'une carte.
- **Ce que j'ai fait** : ouvert le QR de TEST Badge Comptoir, puis tenté de le lire au comptoir (saisie de la valeur encodée).
- **Attendu** : le QR permet d'identifier la personne au comptoir, comme le QR de « Mon badge » ou d'une carte imprimée.
- **Constaté** : le modal affiche l'identifiant brut `6ae6abc8-037f-45cb-a281-bfaf2b200e64`, et le QR encode cette valeur. Le comptoir ne l'accepte pas : `Erreur de scan`, console `❌ Erreur scan: Error: Badge inconnu ou accès suspendu`.
- **Cause probable** : `src/pages/Users.tsx` (vers la ligne 497) passe `selectedUser` (l'id de la personne) comme `value` du `QRCodeGenerator`. Les autres écrans utilisent `badgeValue(code)` (`src/lib/badges.ts`), soit `GOMAT-USER:<code>`. Le comptoir attend ce second format.
- **Capture** : `captures/01-personnes-qr-contient-uuid.jpg`

### P2 — Badge d'une personne créée dans la session non reconnu jusqu'au rechargement
- **Page** : Comptoir (`/comptoir`), après création de TEST Badge Comptoir dans Personnes.
- **Ce que j'ai fait** : scan/saisie de `GOMAT-USER:f58aec773e89dafc02` avant rechargement.
- **Attendu** : badge reconnu immédiatement après création.
- **Constaté** : `Erreur de scan`, console `❌ Erreur scan: Error: Badge inconnu ou accès suspendu`. Après rechargement complet de la page (F5), le même scan donne « Scan réussi ! » et affiche « TEST Badge Comptoir ».
- **Vérification** : la fonction `find_user_by_badge` renvoie bien l'id de TEST pour ce code (appel direct, lecture seule). Le problème vient donc de l'état de l'interface (listes ou badges chargés avant la création), pas de la base. La cause exacte n'est pas confirmée.
- **Capture** : aucune capture de l'erreur elle-même ; voir `captures/02-comptoir-saisie-badge-avec-prefixe.jpg` pour la saisie.

### P3 — Erreurs « 401 » répétées dans la console
- **Page** : toutes (observé sur Comptoir et Équipements).
- **Constaté** : `Failed to load resource: the server responded with a status of 401 ()`, et une requête `GET /rest/v1/status_configs?select=id&limit=1` en 401 (`net::ERR_ABORTED`).
- **Attendu** : aucune erreur 401 pour une session connectée.
- **Statut** : non diagnostiqué. Peut être sans effet, à vérifier.

### P4 — Création d'outil : la liste ne montre pas l'outil juste après la création
- **Page** : Outils (`/equipment`).
- **Ce que j'ai fait** : « Ajouter un équipement », nom `TEST Perceuse comptoir`, emplacement `TEST Atelier`, puis « Suivant ».
- **Attendu** : passer à l'étape suivante, puis créer l'outil et le voir dans la liste.
- **Constaté** : le bouton « Enregistrer » n'existe pas dans ce formulaire : il est en plusieurs étapes (« Suivant », puis « Créer le matériel »). Après une première tentative, la liste n'affiche toujours que la scie existante. Après un rechargement, `TEST Perceuse comptoir` est bien présent (une seule occurrence, `created_at` 09:22:37 UTC).
- **Statut** : l'outil est bien créé. Le retard d'affichage et le libellé « Enregistrer » sont à vérifier.
- **Captures** : `captures/03-outil-formulaire-etape1.jpg`, `captures/04-outil-liste-apres-premiere-tentative.jpg`

## Étapes non encore testées
- Comptoir : scan de l'outil TEST, sortie puis retour, kit.
- Demande bout en bout.
- Chantier avec adresse, puis page Carte.
- Intérimaire avec caution, puis bouton Départ.
- Passage en allemand puis retour en français.
- Téléchargement de la sauvegarde, puis restauration d'un article TEST supprimé.
