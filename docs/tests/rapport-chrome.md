# Rapport de tests — GO-Mat (batterie complète)

- **Date** : 30 octobre 2026, de 10:16 à 11:25 (heure de Zurich)
- **Testeur** : Claude (Claude Code), navigateur de prévisualisation intégré, piloté par script
- **Compte** : Administrateur GO-Mat (connexion par code e-mail, faite par l'utilisateur)
- **Base** : Supabase `xxzcaxizqndvhnzchqkp`
- **Règles suivies** : uniquement des données préfixées « TEST » ; rien d'autre supprimé ni modifié ; code de l'application non modifié (lectures seules pour le diagnostic).

---

## 1. Synthèse

### Verdict : **NO-GO pour une mise en production en l'état**

Le parcours principal fonctionne : badge, sortie et retour au comptoir, demandes, validation, carte des chantiers, langues, téléchargement de la sauvegarde. Mais quatre défauts touchent l'intégrité des données, l'argent ou la reprise après incident. Ils doivent être corrigés avant l'usage réel.

| # | Défaut critique | Pourquoi c'est bloquant |
|---|---|---|
| **P10** | Une sortie par **demande** (et par **kit**) n'attache pas l'exemplaire scanné : l'exemplaire reste « disponible » alors que l'outil est sorti | Stock et traçabilité faux. Le comptoir propose de ressortir un outil déjà dehors, et l'outil ne peut pas être rendu par scan. |
| **P9** | La restauration d'une sauvegarde échoue sur la table des sorties dès qu'un outil de la sauvegarde est actuellement sorti | La sauvegarde est la dernière protection : en cas de perte, l'historique des sorties ne revient pas. |
| **P12** | Le départ d'un intérimaire se clôture avec la caution **non remboursée**, et l'écran affiche « Rien à rendre » | Risque financier direct, et litige avec l'intérimaire. |
| **P1** | Le QR affiché dans **Personnes** n'est pas lu par le comptoir | Les badges imprimés depuis cet écran sont inutilisables. |

### Chiffres

- **Scénarios demandés** : 6, tous exécutés. 2 sont conformes (chantier et carte, langues) ; 4 le sont avec réserves : comptoir (retour de kit par scan), demande (préparation, exemplaire), intérimaire (caution), sauvegarde (restauration des sorties).
- **Anomalies** : 18 au total, dont 4 critiques, 6 majeures, 7 mineures, et 1 point d'environnement (non reproduit).
- **Captures** : 17, dans `captures/`.

---

## 2. Environnement et versions testées

Le code a changé **pendant** la session : deux mises à jour du dossier de travail ont été faites hors de mes actions, et Vite a rechargé l'application à chaud.

| Période (heure de Zurich) | Version du code | Tests concernés |
|---|---|---|
| 10:16 → 10:57 | `6a8e96f` « Connexion par mot de passe en plus du code par e-mail » | comptoir (badge, outil, kit), P1, P2, P4, P5, langues, 1re sauvegarde |
| à partir de 10:57 | `d1c26f8`, fusion de `claude/loving-thompson-6zfo06` (dont `83484b0` « Charte Mannyx (MX) et nouvelle navigation ») | demande de bout en bout, validation, chantier, carte, intérimaire, restauration |

La fusion `d1c26f8` a été faite à 10:57 dans ce dossier, sur la branche `tests/rapport-chrome` ; elle n'est pas de mon fait. Elle se retrouve donc dans cette branche avec le rapport. Les sélecteurs de date ont changé entre les deux versions (passage aux sélecteurs « MX »).

---

## 3. Résultats par scénario

| Scénario | Étape | Résultat | Réf. |
|---|---|---|---|
| **Comptoir** | Scan du badge | ✅ après rechargement de la page | P2 |
| | Scan de l'outil, sortie | ✅ « Sortie : TEST Perceuse comptoir », bon de sortie créé | — |
| | Retour de l'outil | ✅ l'exemplaire repasse « available » | — |
| | Sortie d'un kit | ✅ « Sortie : kit « TEST Kit perçage » » | P10 (exemplaire non attaché) |
| | Retour d'un kit par scan du QR du kit | ❌ rien d'enregistré (1 essai) | P7 |
| | Retour d'un kit par case à cocher | ✅ | — |
| **Demande** | Création | ✅ DEM2610-0001 | — |
| | Envoi refusé si l'outil est indisponible | ✅ « 0 disponible(s), 1 demandé(s) » | — |
| | Validation automatique (outil sans validation requise) | ✅ « Validée par Validation automatique » | — |
| | Validation manuelle (outil avec « Validation requise ») | ✅ DEM2610-0002 en « À valider », puis « Demande DEM2610-0002 validée » | — |
| | Refus sans motif | ✅ bloqué : « Indiquez la raison du refus » | — |
| | Préparation | ⚠️ « Marquer prête » fait perdre la préparation | P8 |
| | Sortie | ✅ sortie créée | P10 (exemplaire non attaché) |
| **Chantier et carte** | Création avec adresse et géocodage | ✅ « Sur la carte : 46.45939, 6.84600 » (Vevey) | — |
| | Carte : chantier vide | ✅ pastille grise, « Rien sur le chantier » | — |
| | Carte : matériel sur place | ✅ pastille orange `#ea580c`, « 1 élément(s) sur le chantier » | P15 (bulle coupée) |
| **Intérimaire** | Création avec caution | ✅ « Intérimaire · caution 200 CHF · jusqu'au 27.11.2026 » | P11 (date obligatoire invisible) |
| | Bouton Départ | ❌ « Rien à rendre » avec la caution due, puis clôture sans alerte | **P12** |
| | Badge après départ | ✅ refusé (« Badge inconnu ou accès suspendu », visible seulement en console) | P16 |
| | Personne partie encore proposée dans les demandes | ❌ | P13 |
| **Langues** | Allemand, puis retour en français | ✅ « EINSTELLUNGEN », nav « Theke », puis « PARAMÈTRES » | — |
| **Sauvegarde** | Téléchargement | ✅ `GO-Mat_sauvegarde_2026-10-30.json`, 8,8 Mo, 52 tables, 0 erreur | — |
| | Restauration d'un article TEST supprimé | ✅ « equipment : 1 ligne(s) remise(s) », « equipment_instances : 1 ligne(s) remise(s) » | — |
| | Restauration de la table des sorties | ❌ « checkouts : erreur, Plus de stock disponible… » | **P9** |

---

## 4. Anomalies détaillées

Échelle : **Critique** (bloque la mise en production), **Majeur** (fonction faussée ou contournement obligatoire), **Mineur** (gêne, confusion, finition).

### P10 — CRITIQUE — Sortie par demande ou par kit : l'exemplaire n'est pas attaché
- **Pages** : Demandes (« Sortir »), Comptoir (sortie d'un kit), puis Comptoir (scan).
- **Ce que j'ai fait** : sorti DEM2610-0001 après avoir scanné l'exemplaire `GOMAT1-000001-001` pendant la préparation. Puis, au comptoir, scanné le badge de TEST Badge Comptoir et le même exemplaire.
- **Attendu** : la sortie porte l'exemplaire ; il passe « checked-out » ; au comptoir, le scan le propose en **Retour** (mode Auto).
- **Constaté** :
  - En base, la sortie de la demande `dc7e0923-…` a `instance_id = null`. L'exemplaire reste `available`, alors que `available_quantity = 0`.
  - Au comptoir, la perceuse figure dans « EN SA POSSESSION », mais son scan l'ajoute en **« Sortie »**.
  - « Valider » échoue avec `Arrêt : Plus de stock disponible pour « TEST Perceuse comptoir »`. Console : `Failed to load resource: the server responded with a status of 400 ()`.
  - Même défaut pour le kit : la sortie `982fe21d-…` a `instance_id = null`.
  - Pour comparaison, une sortie directe au comptoir attache bien l'exemplaire (`checked-out`).
- **Cause** : dans `supabase/migrations/20261029000003_demandes_vehicules.sql`, `issue_request` construit `{equipment_id, quantity}` et jamais `instance_id`. L'exemplaire scanné pendant la préparation n'est pas conservé (voir P8). Pour le kit, la ligne du kit ne contient pas d'exemplaire.
- **Correction proposée** : enregistrer l'exemplaire scanné à la préparation (par exemple `request_items.instance_id`) et le passer à `create_checkout`. À défaut, refuser la sortie d'un outil à QR individuel sans exemplaire. Corriger les données existantes avec un script.
- **Capture** : `captures/09-comptoir-article-possede-propose-en-sortie.jpg`

### P9 — CRITIQUE — La restauration échoue sur les sorties dès qu'un outil est sorti
- **Page** : Paramètres → Sauvegarde → « Restaurer depuis une sauvegarde ».
- **Ce que j'ai fait** : sauvegarde téléchargée (contenant « TEST Article suppression »), article supprimé, fichier chargé, puis « Remettre les lignes manquantes » et « Confirmer ».
- **Attendu** : les lignes absentes reviennent, les lignes présentes sont ignorées, sans erreur.
- **Constaté** : journal affiché :
  ```
  equipment : 1 ligne(s) remise(s)
  equipment_instances : 1 ligne(s) remise(s)
  checkouts : erreur, Plus de stock disponible pour « TEST Perceuse comptoir »
  ```
  Aucune sortie ne manquait (3 dans la sauvegarde, toutes présentes en base). L'erreur vient d'une sortie `active` de la sauvegarde, pour un outil actuellement sorti.
- **Cause** : `restore_missing_rows` (`supabase/migrations/20261030000022_caution_sauvegarde_sms_carte.sql`, vers la ligne 89) fait `INSERT … ON CONFLICT DO NOTHING`. Le déclencheur `checkouts_check_availability_trigger` (`BEFORE INSERT`, `20261029000001_stock_calcule_en_base.sql`, ligne 158) s'exécute **avant** la détection du conflit et lève l'exception. Tout le lot de 500 lignes est annulé, y compris les sorties réellement manquantes. Le déclencheur n'a pas d'effet de bord sur le stock (le recalcul est `AFTER INSERT`).
- **Correction proposée** : dans `restore_missing_rows`, ne garder que les lignes dont la clé est absente (`WHERE NOT EXISTS …`) avant l'`INSERT`. Ou neutraliser le contrôle de disponibilité pendant une restauration (par exemple une variable de session lue par le déclencheur). Ajouter un test de restauration complète sur une base de recette.
- **Note** : un premier essai avait semblé ne rien restaurer. C'était un artefact du test : j'avais cliqué un bouton « Confirmer » caché qui reste dans le DOM. Rejoué proprement, avec le dialogue visible, la restauration fonctionne, sauf pour les sorties.
- **Capture** : `captures/16-restauration-journal-erreur-checkouts.jpg`

### P12 — CRITIQUE — Départ clôturé avec une caution non remboursée, sans alerte
- **Page** : Personnes → bouton « Départ » de TEST Intérimaire Caution.
- **Ce que j'ai fait** : ouvert le départ (caution 200 CHF versée le 30.10.2026, non rendue), puis « Clôturer le départ » sans cliquer « Caution rendue ».
- **Attendu** : la caution compte comme un élément à régler ; le message ne dit pas « Rien à rendre » ; la clôture demande une confirmation.
- **Constaté** :
  - En vert : « Rien à rendre : le départ peut être clôturé. », juste au-dessus de « Caution de 200.00 CHF versée le 30.10.2026 · à rembourser au départ ».
  - La clôture passe sans confirmation : « TEST Intérimaire Caution : départ enregistré, accès et badge désactivés ».
  - En base : `active=false`, `left_on=2026-10-30`, `deposit_amount=200.00`, `deposit_returned_on=null`.
- **Cause** : `src/components/users/DepartureModal.tsx` calcule `remaining = held.length + ppe.length + rentals.length` sans `depositDue`. `close()` ne confirme que si `remaining > 0`.
- **Correction proposée** : ajouter la caution due au compteur et au message, et exiger une confirmation explicite (« Caution non remboursée : clôturer quand même ? »). Ajouter une liste des cautions non remboursées pour les personnes parties.
- **Capture** : `captures/11-depart-caution-rien-a-rendre.jpg`

### P1 — CRITIQUE — Le QR de la page Personnes n'est pas lu par le comptoir
- **Page** : Personnes → bouton « QR CODE ».
- **Ce que j'ai fait** : affiché le QR de TEST Badge Comptoir et saisi sa valeur au comptoir.
- **Attendu** : la personne est identifiée (format `GOMAT-USER:<code>`, comme « Mon badge » ou les cartes imprimées).
- **Constaté** : le QR encode l'identifiant brut `6ae6abc8-037f-45cb-a281-bfaf2b200e64`. Comptoir : « Erreur de scan ». Console : `❌ Erreur scan: Error: Aucune personne` ; avec le préfixe ajouté, `❌ Erreur scan: Error: Badge inconnu ou accès suspendu`.
- **Cause** : `src/pages/Users.tsx` (vers la ligne 497) passe `selectedUser` (l'id) à `QRCodeGenerator`, au lieu de `badgeValue(code)` (`src/lib/badges.ts`).
- **Correction proposée** : utiliser le code de `user_badges` avec `badgeValue()`, ou réutiliser `BadgeCard`.
- **Capture** : `captures/01-personnes-qr-contient-uuid.jpg`

### P8 — MAJEUR — « Marquer prête » fait perdre la préparation
- **Page** : Demandes → fiche DEM2610-0001.
- **Ce que j'ai fait** : scanné l'exemplaire (« 1 / 1 préparé(s) »), cliqué « Marquer prête », puis rouvert la fiche.
- **Attendu** : préparation conservée ; « Sortir » actif.
- **Constaté** : la liste affiche « Prête », mais la fiche indique « 0 / 1 préparé(s) » et « Sortir » est désactivé (« Tous les articles doivent être préparés avant la sortie. »). Il faut rescanner.
- **Cause** : `src/pages/Requests.tsx`, ligne 598 : `const [prepared, setPrepared] = useState(...)`. L'état n'existe que dans la fiche ouverte et n'est jamais enregistré en base.
- **Correction proposée** : enregistrer la préparation par ligne (et l'exemplaire, voir P10). Un magasinier doit pouvoir préparer le soir et sortir le matin.
- **Captures** : `captures/07-demande-fiche-avant-scan.jpg`, `captures/08-demande-prete-liste.jpg`

### P7 — MAJEUR (à reconfirmer) — Retour d'un kit par scan du QR du kit non enregistré
- **Page** : Comptoir, mode « Retour ».
- **Ce que j'ai fait** : badge TEST, puis `GOMAT-KIT:A9C9CCB2`, puis « Valider ».
- **Attendu** : la sortie du kit passe à `returned`.
- **Constaté** : le panier montrait « Retour · TEST Perceuse comptoir · TEST Kit perçage » ; après « Valider », le panier s'est vidé. En base, la sortie `982fe21d-…` est restée `active`. Console juste après : `status of 409 ()` et `status of 400 ()`. Le retour par case à cocher a ensuite fonctionné.
- **Analyse** : le code (`scanKit`, `src/pages/Counter.tsx`, ligne 242) ajoute bien les sorties du kit aux retours ; la cause n'est pas trouvée. Ce test a eu lieu sur la version `6a8e96f`, et n'a pas pu être rejoué (outil sorti par ailleurs). **À retester** sur la version actuelle.

### P2 — MAJEUR — Badge d'une personne créée dans la session non reconnu avant rechargement
- **Page** : Comptoir, juste après la création de TEST Badge Comptoir.
- **Constaté** : « Erreur de scan » ; console `❌ Erreur scan: Error: Badge inconnu ou accès suspendu`. Après rechargement : « Scan réussi ! ». La fonction `find_user_by_badge` renvoie bien la personne (appel direct).
- **Cause probable** : la liste des personnes et des badges du comptoir est chargée une fois et pas rafraîchie après une création.
- **Correction proposée** : recharger personnes et badges quand un badge est inconnu, avant d'afficher l'erreur.
- **Capture** : `captures/02-comptoir-saisie-badge-avec-prefixe.jpg`

### P13 — MAJEUR — Une personne partie reste sélectionnable dans « Nouvelle demande »
- **Page** : Demandes → « Nouvelle demande » → « Pour qui ».
- **Constaté** : « TEST Intérimaire Caution » est proposé alors que son départ est clôturé (`active=false`).
- **Correction proposée** : ne proposer que les personnes actives (et dont l'accès n'est pas échu).

### P6 — MAJEUR — Suppression d'un outil avec historique : refus non expliqué
- **Page** : Outils → « Supprimer » (dialogue « Cette action est irréversible »).
- **Constaté** : la base refuse la suppression (appel direct) : `409 {"code":"23503","message":"update or delete on table \"equipment\" violates foreign key constraint \"checkouts_equipment_id_fkey\" on table \"checkouts\""}`. Le dialogue ne prévient pas. Le message affiché dans l'interface n'a pas pu être observé.
- **Correction proposée** : proposer « Retirer du service » ou un archivage pour un outil avec historique ; si la suppression est refusée, afficher un message clair.

### P14 — MAJEUR (UX) — « Modifier le matériel » : boutons invisibles à l'étape 2
- **Page** : Outils → « Modifier » → « Suivant ».
- **Constaté** : l'étape « Configuration des quantités » n'affiche aucun bouton tant que « Configuration QR codes » est repliée. « Retour », « Annuler » et « Modifier le matériel » n'apparaissent qu'après dépliage. On croit ne pas pouvoir enregistrer. Le même schéma s'applique à la création (« Créer le matériel »).
- **Correction proposée** : boutons d'action toujours visibles en pied de fenêtre ; section dépliée par défaut.
- **Captures** : `captures/12-modifier-materiel-boutons-invisibles.jpg`, `captures/13-modifier-materiel-boutons-apres-depliage.jpg`

### P11 — MINEUR — Date obligatoire de l'intérimaire : erreur invisible
- **Page** : Personnes → « Ajouter une personne », type « Intérimaire ».
- **Constaté** : « Enregistrer » ne fait rien. La seule erreur est portée par un champ caché (`sr-only`) : `INPUT#user-until Veuillez renseigner ce champ.` Aucun message ni champ en rouge visible.
- **Cause** : `src/components/common/DateInput.tsx` met `required` sur l'ancre cachée (`Anchor`), pas sur le sélecteur visible.
- **Correction proposée** : message visible sous le sélecteur, et sélecteur mis en évidence.

### P16 — MINEUR — Motif des erreurs de scan absent de l'écran
- **Page** : Comptoir.
- **Constaté** : pour un badge inconnu ou suspendu, l'écran affiche seulement « Erreur de scan ». Le motif (`Badge inconnu ou accès suspendu`) n'est que dans la console.
- **Correction proposée** : afficher le motif (« Badge inconnu », « Accès suspendu depuis le … », « Personne partie »).

### P4 — MINEUR — Création d'outil : liste non rafraîchie
- **Page** : Outils.
- **Constaté** : après la création, l'outil n'apparaît dans la liste qu'après rechargement (une seule occurrence en base, pas de doublon).
- **Captures** : `captures/03-outil-formulaire-etape1.jpg`, `captures/04-outil-liste-apres-premiere-tentative.jpg`

### P15 — MINEUR — Carte : bulle de la pastille coupée
- **Page** : Carte.
- **Constaté** : la bulle d'un chantier en haut à gauche est coupée (« e du Simplon… ») et passe sous les boutons de zoom.
- **Correction proposée** : `autoPanPadding` sur la bulle, ou décaler les boutons de zoom.
- **Capture** : `captures/10-carte-materiel-sur-place-bulle-coupee.jpg`

### P3 — MINEUR — Erreurs 401 et 400 répétées en console
- **Constaté** : de nombreux `Failed to load resource: the server responded with a status of 401 ()`, notamment `HEAD /rest/v1/status_configs?select=id&limit=1` → 401 (`net::ERR_ABORTED`), et des `400` sans action visible.
- **Correction proposée** : identifier l'appel (probablement un test de connexion fait avant l'authentification) et le supprimer ou le reporter.

### P17 — MINEUR — Sélecteur de date : jours des mois voisins identiques aux jours du mois
- **Constaté** : dans le sélecteur MX, les jours du mois précédent et du suivant sont affichés et cliquables comme ceux du mois courant. En novembre, cliquer « 27 » dans la première ligne choisit le **27 octobre** (date passée). C'est l'erreur que j'ai faite pendant le test.
- **Correction proposée** : griser ces jours, ou les rendre non cliquables.

### P18 — MINEUR — Rattachement chantier par nom libre
- **Constaté** : la demande DEM2610-0001 vers « TEST Chantier demande » n'est rattachée à aucun chantier (aucun chantier de ce nom) : le matériel n'apparaît ni sur la fiche chantier, ni sur la carte. Le rattachement repose sur la saisie exacte du nom.
- **Correction proposée** : un sélecteur de chantier (avec saisie libre en option) dans les demandes et au comptoir.

### P5 — ENVIRONNEMENT (non reproduit) — Fenêtres fermées seules, écran « Chargement… »
- **Constaté entre 10:35 et 10:50** : des formulaires (demande, chantier, outil) se fermaient en 2 à 3 secondes, et des captures montraient « Chargement… » en plein écran.
- **Constaté ensuite** : plus reproduit (formulaire ouvert plus de 30 s, aucun « Chargement… »).
- **Analyse** : coïncide avec les mises à jour du code pendant la session (rechargements à chaud de Vite). La piste `AuthContext.tsx` (passage à `loading=true` sur `SIGNED_IN`) reste possible mais non démontrée. À surveiller.
- **Capture** : `captures/05-chargement-plein-ecran-formulaire-ferme.jpg`

---

## 5. Liste no-go

À corriger et retester avant toute mise en production :

1. **P10** : l'exemplaire n'est pas attaché aux sorties par demande et par kit (stock et traçabilité faux).
2. **P9** : restauration des sorties impossible dès qu'un outil est dehors.
3. **P12** : clôture d'un départ avec une caution non remboursée, sans alerte.
4. **P1** : QR de la page Personnes illisible au comptoir.

Fortement recommandé avant le lancement : **P8** (préparation perdue), **P2** (badge non reconnu), **P13** (personne partie sélectionnable), **P7** (à retester).

---

## 6. Propositions d'amélioration

### Fiabilité des données
- **Exemplaire obligatoire** pour tout outil à QR individuel : refus en base d'une sortie sans `instance_id` (contrainte ou déclencheur), pour rendre P10 impossible.
- **Contrôle de cohérence** dans « Santé des données » : exemplaires `available` d'un outil à 0 disponible ; sorties actives sans exemplaire ; personnes parties avec matériel ou caution.
- **Restauration testée** : un test automatique « sauvegarde → suppression → restauration » sur une base de recette, à chaque migration.

### Comptoir
- Afficher le **motif** de chaque refus de scan (P16), et proposer « Rendre » quand l'article scanné est déjà chez la personne.
- **Recharger** personnes, badges et kits quand un code est inconnu, avant l'erreur (P2).
- Indiquer à l'écran **qui a l'article** quand on scanne un article sorti au nom de quelqu'un d'autre.

### Demandes
- Enregistrer la préparation ligne par ligne (P8), avec l'exemplaire scanné (P10).
- Choisir le chantier dans une liste (P18).
- Filtrer « Pour qui » sur les personnes actives (P13).

### Personnes et départs
- Caution intégrée au solde de départ (P12) ; liste des cautions encaissées et non rendues.
- Erreurs de formulaire visibles sur les sélecteurs de date (P11).

### Interface
- Boutons d'action toujours visibles dans les fenêtres en plusieurs étapes (P14).
- Jours hors du mois grisés dans le sélecteur (P17).
- Bulles de la carte entièrement visibles (P15).
- Suppression d'un outil avec historique : proposer « Retirer du service » (P6).

### Technique
- Supprimer les appels en 401 et 400 au démarrage (P3).
- Remplacer les dialogues de confirmation montés en permanence dans le DOM par des dialogues créés à l'ouverture. Cela simplifie aussi les tests automatisés.
- Ajouter des identifiants de test (`data-testid`) sur le comptoir, les demandes et la sauvegarde pour automatiser cette batterie (Playwright).

---

## 7. Données de test laissées en base

| Type | Nom | Identifiant | État final |
|---|---|---|---|
| Personne | TEST Badge Comptoir | `6ae6abc8-037f-45cb-a281-bfaf2b200e64` | active, a la perceuse en sortie |
| Personne | TEST Intérimaire Caution | `test.interim@example.com` | partie, caution 200 CHF **non rendue** (scénario P12) |
| Outil | TEST Perceuse comptoir | `c670bc06-ede3-4cf6-a3e0-f78e36702202` | sortie active, bon DN2610-0004, chantier « TEST Chantier carte » ; « Validation requise » activée |
| Outil | TEST Article suppression | `315cde03-b256-4e52-85f6-cf3df776fe84` | supprimé deux fois (par API), puis restauré par l'interface |
| Kit | TEST Kit perçage | `aac07825-d81b-4b9b-b4f0-afd0ca2e1ba8` | rendu |
| Demande | DEM2610-0001 | — | sortie puis rendue |
| Demande | DEM2610-0002 (3.11 → 4.11) | — | validée, à préparer |
| Chantier | TEST Chantier carte (Rue du Simplon 1, 1800 Vevey) | — | en cours |
| Paramètre | `last_backup_at` | — | mis à jour par les deux téléchargements de sauvegarde |

Aucun nettoyage n'a été fait. À supprimer ou archiver sur demande.

---

## 8. Limites du test

- Tests pilotés par script dans le navigateur intégré, pas à la main dans Chrome : la saisie au clavier, la caméra et les vrais lecteurs de QR n'ont pas été testés.
- Un seul compte (administrateur) : les rôles Collaborateur, Magasinier et Responsable, et leurs droits, ne sont pas couverts.
- Pas de test hors ligne (file d'attente du comptoir), ni de signature à la remise, ni d'impression (badges, bons, PDF).
- Suppressions faites par l'API pour P9 : le bouton « Supprimer » de l'interface n'a pas pu être validé jusqu'au bout.
- Code modifié pendant la session (section 2) : P5 et P7 doivent être rejoués sur la version actuelle.
- Les corps des réponses 400 et 409 n'ont pas pu être lus depuis l'outil de test.

---

## Annexe — Vérifications en base

Lectures avec le jeton de la session (`equipment`, `equipment_instances`, `checkouts`, `user_badges`, `users`, `kits`), pour contrôler chaque résultat affiché. Écritures hors interface, toutes sur des données TEST :
1. deux suppressions de « TEST Article suppression » ;
2. un appel direct `restore_missing_rows('equipment', [ligne TEST])` pour isoler P9 (réponse `1`).
