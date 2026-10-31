# Contre-test du lot 24 (shop) après corrections

- **Commit testé** : `dc5c7ef` (`dc5c7ef7d178ed18966ed59319ecc7b848b1263b`) « Corrections du rapport de tests lot 24 (shop) », branche `claude/loving-thompson-6zfo06` (pointe de la branche au moment du test). 16 fichiers modifiés, aucune migration nouvelle, `package.json` inchangé.
- **tsc** : `npx tsc --noEmit -p tsconfig.app.json` → code de sortie 0.
- **build** : `npm run build` → code de sortie 0 en 10,9 s. Seul avertissement : la taille des fichiers JS (`index` 1,71 MB, `exceljs` 939 kB), comme avant.
- **Date** : 31 octobre 2026, de 21:50 à 22:20 (heure de Zurich).
- **Montage** : dossier `GOMAT-essai` (`git fetch` puis `checkout` de `dc5c7ef`). Vite dev relancé sur 5190 (administrateur) et 5191 (comptes de rôle). Navigateur intégré piloté par script, en 1440 × 900 sauf mention contraire.
- **Base** : GO-MAT uniquement (`xxzcaxizqndvhnzchqkp`), partagée avec la version en ligne. Aucun autre projet Supabase n'a été lu.
- **Comptes** : administrateur, `test.collaborateur`, `test.magasinier` (`@example.com`). Aucun mot de passe changé ni écrit.
- **Règles** : données préfixées « TEST-SHOP » ; aucun commit sur `claude/…`. Terminal Vite : aucun message d'erreur.

Référence : [rapport-lot24-shop.md](rapport-lot24-shop.md) (S1 à S27).

---

## 1. Synthèse

| | CORRIGÉ | PARTIEL | NON CORRIGÉ |
|---|---:|---:|---:|
| Défauts S1 à S27 (sans S25) | **21** | **5** | **0** |

- **S25** ne se reproduit plus : en collaborateur, le menu « ⋮ » d'une carte Matériel affiche « Code QR » et « Historique ».
- **Points nouveaux** : les 6 fonctionnent. Pour les langues, il reste quelques textes en français (voir N6).
- **Non-régression** (Demandes, Matériel, Accueil) : OK.
- **Restent PARTIELS, tous de gravité Mineure** :
  - S7 : la date passée est refusée, mais le champ continue de l'afficher ;
  - S14 : « Tous les dépôts » n'affiche pas le stock total ;
  - S18 : sur téléphone, les champs de date font 34 px et l'heure est tronquée ;
  - S19 : dates du panier et deux textes du comptoir en français ;
  - S20 : les boutons de fermeture portent le titre du panneau au lieu de « Fermer ».
- **Hors lot, un défaut majeur** : dans Transferts, le champ « Vers » garde une valeur cachée. Un transfert depuis TEST Dépôt aide échoue alors avec une erreur SQL brute.

---

## 2. Défauts S1 à S27

| ID | Défaut (rapport précédent) | Rejoué | Verdict |
|---|---|---|---|
| S1 | Commander échoue si `/shop` est ouvert directement | Collaborateur : URL `/shop` chargée directement, Gants × 1, Commander → « Commande DEM2610-0017 envoyée : le magasin la prépare ». Le dépôt est maintenant calculé, plus figé au chargement. | **CORRIGÉ** |
| S2 | Le collaborateur ne lit pas ses notifications | La cloche (« Notifications : 4 alerte(s) ») mène à `/shop?vue=commandes`. Les avis « Prête à retirer », « Demande refusée », « Demande validée », « À rendre demain » s'affichent en haut, chacun avec un bouton « OK ». Capture [n5](captures-lot24-ct/n5-cloche-collaborateur-mes-commandes.jpg) | **CORRIGÉ** |
| S3 | Le Comptoir ignore les commandes du Shop | Voir N1 : bandeau « 4 commandes à sortir pour cette personne » → « Sortir la commande » → la demande s'ouvre → sortie → `closed`. | **CORRIGÉ** |
| S4 | Pas de photo pour les consommables | Voir N2 : bouton crayon « Modifier », et champ Image dans « Nouveau consommable » | **CORRIGÉ** |
| S5 | Image modifiée visible seulement après rechargement | Matériel › Perceuse › Modifier › nouvelle image › « Matériel modifié avec succès » : la carte change tout de suite. Consommable : la nouvelle image est dans le Shop sans recharger. | **CORRIGÉ** |
| S6 | Bandeau faux au-delà de 10 pièces | TEST Gants aide × 11 → « Un responsable doit valider : TEST Gants aide (plus de 10). » | **CORRIGÉ** |
| S7 | Dates passées acceptées, défaut un dimanche | Date par défaut : **lundi 02.11** à 07:30 (prochain jour ouvré). Le calendrier laisse cliquer sur le 30.10, mais refuse avec le toast « Choisis une date à partir du 31.10.2026 ». **Reste** : le champ et le résumé affichent toujours « 30 oct. 2026 » / « 30 oct. 2026 à 07:30 », alors que la valeur réelle reste le 02.11. DEM2610-0017 est partie pour le 02.11 alors que l'écran montrait le 30.10. Les jours passés ne sont pas grisés. Capture [s7](captures-lot24-ct/s7-date-passee-refusee-mais-affichee.jpg) | **PARTIEL** (Mineur) |
| S8 | Commande passée pour autrui invisible | Voir N4 : « Mes commandes › Passées pour d'autres » liste DEM2610-0019 · TEST Rôle Collaborateur. Remarque : juste après l'envoi, la vue s'ouvre sur « Pour moi » (vide) ; il faut changer d'onglet. | **CORRIGÉ** |
| S9 | Deux clics créent deux commandes | Trois `click()` dans la même image → une seule commande (DEM2610-0018) | **CORRIGÉ** |
| S10 | Message réseau brut | Appel réseau en échec → « Pas de connexion : ta commande n'est pas partie. Ton panier est gardé, réessaie dans un instant. » Le panier est gardé. | **CORRIGÉ** |
| S11 | Lien cassé enregistré sans avertissement | « Suivant » › « Modifier le matériel » → confirmation « Le lien de l'image ne s'affiche pas : elle n'apparaîtra pas dans le shop. Enregistrer quand même ? » | **CORRIGÉ** |
| S12 | HEIC : message anglais | « Photo iPhone (HEIC) non lisible ici : prends la photo directement avec « Prendre une photo », ou exporte-la en JPG. » Le sélecteur accepte `.heic`. | **CORRIGÉ** |
| S13 | Recherche avec accents | « telescopique » → Chariot télescopique ; « perçeuse » et « PERCEUSE » → les 2 perceuses ; « gomat1-000006 » et « zygomatique » → Nacelle | **CORRIGÉ** |
| S14 | Outils sans dépôt ; « Tous les dépôts » ≠ total | Le dépôt n'est indiqué que pour un outil rattaché à un dépôt, or **aucun outil existant ne l'était** (`depot_id` vide). Après un transfert de la Perceuse vers TEST Dépôt aide : « 1 disponible · TEST Dépôt aide » quand le dépôt du haut est le Dépôt principal, mais **seulement après rechargement**. « Tous les dépôts » affiche toujours le stock du dépôt par défaut (TEST Gants aide 40, total 42). Capture [s14](captures-lot24-ct/s14-depot-outil-indique-apres-rechargement.jpg) | **PARTIEL** (Mineur) |
| S15 | UUID du fournisseur dans la fiche | « GOMAT1-000005 · Makita · ddf490z » | **CORRIGÉ** |
| S16 | Panier non synchronisé et partagé entre comptes | Voir N3 : clé `gomat-cart:<id du compte>`, synchronisée entre onglets, panier différent pour chaque compte | **CORRIGÉ** |
| S17 | Article retiré ou supprimé resté dans le panier | Perceuse passée en « retiré » et ligne d'un article inexistant ajoutée → au chargement : « 2 articles ne sont plus proposés et ont été retirés de ton panier. » ; le panier est vide et le compteur juste. | **CORRIGÉ** |
| S18 | Téléphone : cibles < 40 px, Commander hors écran | 390 px : −/+ et poubelle 40 × 40 ; « Continuer mes achats » et « Commander » 44 px, fixés en bas (y = 780 sur 844) ; filtres repliés derrière « Filtres » (premier article à 357 px au lieu de ~600). **Reste** : champs date et heure 34 px, heure tronquée « 07:… », « Catalogue / Mes commandes » 28 px, recherche 38 px, fermeture 32 px. Capture [s18](captures-lot24-ct/s18-telephone-panier.jpg) | **PARTIEL** (Mineur) |
| S19 | Textes non traduits | Shop, fiche, panier et Mes commandes traduits en DE, IT et EN (titres, frise, bandeau, toast « In den Warenkorb gelegt: … », noms accessibles). **Reste** : voir N6. Captures [s19](captures-lot24-ct/s19-en-panier-dates-en-francais.jpg) et [n6](captures-lot24-ct/n6-de-comptoir.jpg) | **PARTIEL** (Mineur) |
| S20 | Noms accessibles | Miniatures « Photo 1 sur 8 » avec `aria-pressed` ; « Un de moins : <nom> », « Un de plus : <nom> », « Retirer du panier : <nom> », « Voir le détail : <nom> » ; images avec `alt` (« …, photo 2 »). **Reste** : les boutons de fermeture portent le titre du panneau : « Ton panier » (DE « Dein Warenkorb »), le nom de l'article sur la fiche, « Modifier TEST-SHOP Gants nitrile » sur la fiche consommable. Ce devrait être « Fermer ». Pas de capture : c'est un attribut invisible à l'écran (vérifié dans le DOM). | **PARTIEL** (Mineur) |
| S21 | Deux chiffres « Demandes à préparer » | La carte Magasin dit maintenant « Validées, à préparer 4 » ; « Aujourd'hui au magasin » garde « Demandes à préparer 1 ». Les libellés sont distincts. | **CORRIGÉ** |
| S22 | Barre de commandes et dépôt | `/journal` ouvert en 390 px puis passé à 1440 sans navigation : « Type » et « Personne » remontent dans l'en-tête. Emplacements et Inventaire : changer le dépôt du haut met à jour le dépôt de la page sans quitter la page. | **CORRIGÉ** |
| S23 | Aide « Le shop » inexacte | L'article parle maintenant de « Pour qui », du refus dès l'envoi pour le permis, des avis en haut de « Mes commandes », de « Passées pour d'autres », du comptoir (« Sortir la commande ») et du crayon des consommables. Petit écart : l'aide cite le message « Le retrait est dans le passé », alors que le calendrier affiche « Choisis une date à partir du … ». | **CORRIGÉ** |
| S24 | Formulaire non vidé après commande | Après DEM2610-0017 : chantier et remarque vides | **CORRIGÉ** |
| S25 | Menu « ⋮ » sans effet (collaborateur) | Ne se reproduit plus. Collaborateur, Matériel, « ⋮ » de TEST-SHOP Nacelle validation : menu « Code QR / Historique ». Capture [s25](captures-lot24-ct/s25-collaborateur-menu-actions.jpg) | (non rejoué en détail) |
| S26 | Cases blanches en mode sombre | Placeholder `rgba(40,44,55,0.6)` en sombre | **CORRIGÉ** |
| S27 | Mes commandes sans articles ; « Rendue » pour un consommable | Lignes « TEST-SHOP Gants nitrile × 1 » avec vignette. Frise d'une commande de consommables : Envoyée · Validée · Prête · Retirée (sans « Rendue ») ; commande mixte DEM2610-0013 : 5 étapes. | **CORRIGÉ** |

---

## 3. Points nouveaux

| ID | Rôle | Étapes | Obtenu | Verdict |
|---|---|---|---|---|
| N1 Comptoir | Magasinier | Comptoir › « choisis la personne » › TEST Rôle Collaborateur | Bandeau « 4 commandes à sortir pour cette personne » : DEM2610-0019, 0017, 0018, 0009, chacune avec « Sortir la commande », et le rappel « Sors-la depuis la commande : elle sera clôturée. Un scan ici ferait une sortie à part. ». « Sortir la commande » sur 0017 ouvre la demande dans Demandes ; « Marquer … comme préparé », puis « Sortir » → « Demande DEM2610-0017 sortie », statut `closed`. Chez le collaborateur, la frise finit sur « Retirée ». Remarque : on ne revient pas au comptoir après la sortie. Capture [n1](captures-lot24-ct/n1-comptoir-commandes-a-sortir.jpg) | OK |
| N2 Consommables | Magasinier | Consommables › crayon « Modifier TEST-SHOP Gants nitrile » ; « Nouveau consommable » | La fiche Modifier contient : Nom, Image, Description (affichée dans le shop), Validation requise. Image par **lien** (catalogue Makita) : aperçu et « … enregistré » ; visible dans le Shop sans recharger. **Import** d'un JPG : « Photo ajoutée », `photos-articles/2026/1e43f8f1-….jpg`. **Nouveau consommable** « TEST-SHOP Consommable avec image », import d'un PNG → JPEG `2026/6108bdfa-….jpg`, « … ajouté ». « Prendre une photo » est présent ; l'appareil photo n'a pas pu être testé sur PC. Capture [n2](captures-lot24-ct/n2-consommables-avec-image.jpg) | OK |
| N3 Panier par compte | Collab., magasinier | (1) Déconnexion par le menu « Se déconnecter », puis connexion du magasinier ; (2) deuxième onglet | (1) Magasinier : « Panier » vide ; le collaborateur retrouve ensuite son panier (11 + 2) à sa reconnexion. Clés `gomat-cart:<id>` séparées. (2) Écriture dans le panier depuis un « autre onglet » (simulée par un `StorageEvent`) → compteur « Panier (13) » et carte « Au panier » mis à jour aussitôt. | OK |
| N4 Passées pour d'autres | Magasinier | Panier › Pour qui = TEST Rôle Collaborateur › Commander | DEM2610-0019 envoyée ; « Mes commandes › Passées pour d'autres » : « DEM2610-0019 · TEST Rôle Collaborateur », avec article et frise. Le collaborateur la voit aussi dans ses commandes. Remarque S8 (vue « Pour moi » après l'envoi). Capture [n4](captures-lot24-ct/n4-passees-pour-d-autres.jpg) | OK |
| N5 Cloche collaborateur | Collab. | Clic sur la cloche | Voir S2 | OK |
| N6 Langues | Collab., admin | DE / IT / EN dans le Shop, le panier et le comptoir | Restent en français (voir la liste ci-dessous) | PARTIEL (Mineur) |

**N6, ce qui reste en français :**
- **Panier, dans les trois langues** : les dates « 02 nov. 2026 » et le résumé « 02 nov. 2026 à 07:30 » (champ date et heure).
- **Comptoir, dans les trois langues** : le lien « choisis la personne » (dans « Scannen Sie den Badge … oder choisis la personne ») et « 0 article en sa possession ».
- **Données enregistrées en français** (pas des textes de l'interface) :
  - unités (« paire », d'où « 2 paire am Lager ») ;
  - préfixe des remarques de commande « Retrait au dépôt · … » ;
  - caractéristiques du catalogue fournisseur (« Porte-outils »).
- **Allemand** : le comptoir mélange vouvoiement et tutoiement (« Scannen Sie … » et « Gib sie über die Bestellung aus »).
- **Tout le reste est traduit** : catalogue, fiche, panier, bandeaux, Mes commandes, avis, frise et toasts.

---

## 4. Non-régression rapide

| Point | Rôle | Obtenu | Verdict |
|---|---|---|---|
| Demandes | Admin | « Nouvelle demande » pour TEST Rôle Collaborateur, Nacelle × 1 (« 2 disponibles sur la période ») → « Demande DEM2610-0020 envoyée en validation ». « À valider » › Valider → « validée ». « À préparer » › préparé › Sortir → statut `out`. Retour au bon DN2610-0019 → `closed`. Remarque : la date par défaut de cet écran est toujours « demain » (dimanche 01.11), contrairement au Shop. | OK |
| Matériel | Admin | Modifier un outil (image, en 2 étapes « Suivant » puis « Modifier le matériel ») → « Matériel modifié avec succès », carte mise à jour | OK |
| Accueil | Admin, collab. | Cartes de modules à 3 chiffres. Collaborateur : « Mon matériel 0 / Mes demandes en cours 4 / En retard 0 », liens `/shop`, `/equipment`, `/vehicules`. Admin : « Validées, à préparer » (S21). | OK |

---

## 5. Constats hors lot

1. **Transferts : « Vers » garde une valeur cachée (Majeur).**
   - Étapes : Nouveau transfert › Depuis = « TEST Dépôt aide ». Le champ « Vers » affiche « Dépôt principal » (seul choix), mais sa valeur interne reste « TEST Dépôt aide ». Envoyer.
   - Obtenu : « new row for relation "transfers" violates check constraint "transfers_check" ». Avec deux dépôts, un transfert depuis le dépôt non choisi par défaut est impossible.
   - C'est le même mécanisme que l'ancien S1.
   - Pour remettre la perceuse au Dépôt principal, j'ai dû forcer la valeur par script.
   - Capture : [hors-lot](captures-lot24-ct/hors-lot-transfert-vers-identique.jpg)
2. **Fiche Matériel ouverte sur des données périmées (Mineur).**
   - Mon test S17 a changé le statut de la perceuse depuis un autre onglet. Le formulaire Modifier de l'admin, chargé avant ce changement, a réécrit l'ancien statut « retiré » à l'enregistrement. Je l'ai remis ensuite.
   - Avec plusieurs personnes connectées, une modification faite par une autre peut donc être écrasée.
3. **Liste Matériel non rafraîchie après un transfert (Mineur).** L'indication « · TEST Dépôt aide » dans le Shop n'apparaît qu'après rechargement (S14).
4. **Observation.** Le préfixe des numéros d'article a changé entre les deux campagnes : le nouveau consommable a reçu `VENOGE-000009` (les précédents : `GOMAT1-…`). Ce n'est pas lié à mes tests : c'est un réglage modifié entre-temps.

---

## 6. Inventaire des données créées ou modifiées (TEST-SHOP)

**Demandes** (au nom de TEST Rôle Collaborateur, remarque « TEST-SHOP CT … ») :

| N° | Contenu | État final |
|---|---|---|
| DEM2610-0017 | Gants nitrile × 1, 02.11 (« TEST-SHOP CT S1 S7 S9 ») | Clôturée : sortie depuis le comptoir (N1), bon de sortie |
| DEM2610-0018 | Gants nitrile × 1 (« TEST-SHOP CT S9 double clic ») | Annulée |
| DEM2610-0019 | Gants nitrile × 1, passée par TEST Rôle Magasinier (« TEST-SHOP CT magasinier pour collaborateur ») | Annulée |
| DEM2610-0020 | Nacelle × 1, ancien écran Demandes (« TEST-SHOP CT non-régression Demandes ») | Clôturée : sortie puis retour, bon DN2610-0019 |

**Articles** :
- **Nouveau** : « TEST-SHOP Consommable avec image », `2103df02-9be7-4f80-894b-eb0ac77330a0`, n° `VENOGE-000009`, 3 pièces au Dépôt principal, image `photos-articles/2026/6108bdfa-53b9-4605-8799-e2e6e4d39955.jpg`.
- **TEST-SHOP Gants nitrile** : image ajoutée (`photos-articles/2026/1e43f8f1-314a-489c-bb51-62b887ec1997.jpg`), stock 3 → **2** (DEM2610-0017).
- **TEST-SHOP Perceuse-visseuse LXT** :
  - deux transferts : TRF2610-0002 vers TEST Dépôt aide, puis TRF2610-0003 retour vers le Dépôt principal ;
  - elle est maintenant rattachée au Dépôt principal (avant : aucun dépôt) ;
  - statut « disponible » et image Makita d'origine, tous deux remis après les essais S17 et S5.

**Autres traces** :
- Les éventuelles notifications envoyées au collaborateur pour les demandes 0017 à 0020 (non vérifiées une à une).
- Entrées automatiques du Journal.

**Remis comme avant** :
- paniers vidés (collaborateur, magasinier) ;
- langue (FR) et thème (clair) du collaborateur et de l'admin ;
- dépôt du haut sur « Tous les dépôts ».

**Rien d'autre créé** : aucun utilisateur, chantier ou dépôt ; aucun mot de passe touché.
