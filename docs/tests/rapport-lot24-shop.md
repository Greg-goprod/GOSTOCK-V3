# Rapport de tests — Lot 24 (étape A) : shop matériel

- **Commit testé** : `74e49ef` (`74e49ef7855376b0c35251d8750e1f73e86908b3`) « Lot 24 (étape A) : shop matériel », branche `claude/loving-thompson-6zfo06`. La pointe de la branche était toujours `74e49ef` à la fin de la campagne.
- **tsc** : `npx tsc --noEmit -p tsconfig.app.json` → code de sortie 0, aucune erreur.
- **build** : `npm run build` → code de sortie 0 en 13,29 s. Seul avertissement : des fichiers JS de plus de 500 kB (`index` 1,69 MB, `exceljs` 938 kB), déjà présent avant ce lot.
- **Date** : 31 octobre 2026, après-midi (heure de Zurich).
- **Montage** : dossier séparé `GOMAT-essai` (`git worktree`, détaché sur `74e49ef`). Vite dev sur le port 5190 (administrateur) et 5191 (comptes de rôle). Navigateur de prévisualisation intégré, piloté par script, en 1440 × 900 sauf mention contraire.
- **Base** : GO-MAT uniquement (`xxzcaxizqndvhnzchqkp`), la même que la version en ligne. Aucun autre projet Supabase n'a été lu. Migration `00031_photos_articles` déjà appliquée.
- **Comptes** : administrateur ; `test.collaborateur`, `test.magasinier` et `test.responsable` (`@example.com`). Aucun mot de passe n'a été changé ni recopié ici. Pas de compte intérimaire de connexion disponible : ce rôle n'a pas été testé.
- **Règles** : tout ce qui a été créé porte « TEST-SHOP » (voir l'inventaire, § 6). Aucune autre donnée n'a été modifiée. Le code de l'application n'a pas été touché et rien n'a été commité sur la branche `claude/…`.
- **Erreurs** : pour chaque erreur, j'indique le message de la console du navigateur. Le terminal Vite n'a rien affiché pendant toute la campagne : seulement les lignes de démarrage, `VITE v5.4.21 ready`.

---

## 1. Synthèse

| Section | Tests | OK | PARTIEL | KO | Non testé |
|---|---:|---:|---:|---:|---:|
| P. Préparation | 2 | 2 | 0 | 0 | 0 |
| A. Photo de l'article | 9 | 5 | 3 | 0 | 1 |
| B. Catalogue | 9 | 7 | 2 | 0 | 0 |
| C. Fiche produit | 6 | 5 | 1 | 0 | 0 |
| D. Panier | 6 | 4 | 2 | 0 | 0 |
| E. Commande (+ E15 ajouté) | 15 | 9 | 5 | 1 | 0 |
| F. Mes commandes | 6 | 5 | 1 | 0 | 0 |
| G. Téléphone, thème, langues, accessibilité | 4 | 1 | 3 | 0 | 0 |
| H. Non-régression | 4 | 0 | 4 | 0 | 0 |
| **Total** | **61** | **38** | **21** | **1** | **1** |

**En bref** : le parcours complet fonctionne. On peut créer les articles, les mettre en photo, passer commande, valider, préparer, sortir, rendre et suivre la commande. Le serveur protège bien les règles : disponibilité sur la période, permis, validation au-delà de 10.

Défauts relevés :
- **Un défaut bloquant (S1)** : si la page Shop est ouverte directement ou rechargée, « Commander » échoue avec un message technique.
- **Quatre défauts majeurs** :
  - le collaborateur ne peut pas lire ses notifications (S2) ;
  - le comptoir ne reprend pas les commandes du shop (S3) ;
  - les consommables ne peuvent pas avoir de photo (S4) ;
  - une image modifiée ne s'affiche qu'après rechargement (S5).

---

## 2. Résultats détaillés

Gravité : B = Bloquant, Ma = Majeur, Mi = Mineur, C = Cosmétique. Le renvoi « → Sn » pointe vers la fiche du défaut, au § 3.

### P. Préparation

| ID | Rôle | Étapes | Attendu | Obtenu | Verdict |
|---|---|---|---|---|---|
| P1 | Admin | Créer 4 articles TEST-SHOP | (a) image par lien et catalogue Makita, (b) validation requise, qté 2, (c) consommable, stock 5, seuil 2, (d) sans image, permis | (a) « Remplir depuis le catalogue » sur Makita DDF490Z : nom, image, galerie, 23 caractéristiques. (b), (c) et (d) créés comme demandé. | OK |
| P2 | Admin | Mettre les articles dans au moins 2 rayons | 2 rayons ou plus | 3 rayons : Outils (a), Sécurité (b), Électronique (d). Remarque : le formulaire Consommable n'a pas de champ rayon (groupe). | OK |

### A. Photo de l'article

| ID | Rôle | Étapes | Attendu | Obtenu | Verdict |
|---|---|---|---|---|---|
| A1 | Admin | Modifier › coller un lien valide › Enregistrer | Aperçu, puis image visible dans Matériel et dans le Shop | L'aperçu s'affiche et l'enregistrement réussit. Mais la carte Matériel, la fiche rouverte et le Shop gardent l'**ancienne** image jusqu'au rechargement de la page. → S5 | PARTIEL (Ma) |
| A2 | Admin | Coller un lien cassé, puis Enregistrer | Message « Image introuvable… » ; que se passe-t-il à l'enregistrement ? | Le message rouge s'affiche. L'enregistrement est quand même accepté sans avertissement (« Matériel modifié avec succès »), et le lien cassé est gardé en base. Le Shop affiche alors le placeholder. → S11 | PARTIEL (Mi) |
| A3 | Admin | Bouton ✕, puis Enregistrer | Placeholder dans le Shop | Champ vidé ; placeholder (icône + initiales) après rechargement (même retard d'affichage qu'en A1) | OK |
| A4 | Admin | Importer un JPG de 8,35 Mo | Compression, toast, URL publique, affichage | 1200 × 900 px, 315 Ko, ~1,5 s. Toast « Photo ajoutée ». URL `…/storage/v1/object/public/photos-articles/2026/<uuid>.jpg` lisible sans connexion. Remarque : une photo remplacée reste dans le stockage (fichier orphelin, voir l'inventaire, § 6). | OK |
| A5 | Admin | Importer un PNG transparent et un WebP | Fond blanc ; WebP accepté | Les deux deviennent des JPEG ; le coin transparent devient blanc `rgb(255,255,255)`. | OK |
| A6 | Admin | Importer un PDF et un .txt | Refus avec un message clair | « Choisis une image (JPG, PNG ou WebP) ». Hors plan : un HEIC donne le message anglais brut « mime type image/heic is not supported ». → S12 | OK |
| A7 | — | « Prendre une photo » sur téléphone | Appareil photo arrière | **Non testé** : pas de téléphone relié au serveur de dev. Le code a `accept="image/*" capture="environment"`. Sur PC, le bouton ouvre le sélecteur de fichiers. | Non testé |
| A8 | Collab., magasinier | Tenter un import | Refusé pour le collaborateur, autorisé pour le magasinier | Collaborateur : pas d'action « Modifier ». Le menu « ⋮ » des cartes ne s'ouvre pas (→ S25). Un envoi direct au stockage est refusé, avec le message anglais brut « new row violates row-level security policy ». Magasinier : envoi accepté. | OK |
| A9 | Admin | Image dans « Ajouter du matériel » et dans la fiche Consommable | Même champ partout | « Ajouter du matériel » : champ présent. **Consommable** : ni à la création ni à la modification (la liste n'a même pas d'action « Modifier »). Les consommables restent donc toujours sans photo dans le Shop, alors que la colonne `image_url` existe (ce sont des lignes `equipment`). → S4 | PARTIEL (Ma) |

### B. Catalogue

| ID | Rôle | Étapes | Attendu | Obtenu | Verdict |
|---|---|---|---|---|---|
| B1 | Tous | Accès et ordre des onglets | Shop visible pour tous | Collaborateur : SHOP · DEMANDES · LIBRE-SERVICE. Magasinier, responsable et admin : SHOP · COMPTOIR · SCANNER · DEMANDES · SORTIES · LIBRE-SERVICE · TRANSFERTS · EMPLACEMENTS · INVENTAIRE · ÉCRAN TV DU DÉPÔT. Barre du bas sur téléphone : collaborateur Accueil · Shop · Demandes · Mon badge · Plus ; magasinier Accueil · Scanner · Comptoir · Shop. | OK |
| B2 | Collab. | Compteur, articles retirés, locations finies | Exclus | 8 articles. « TEST Chariot aide » et « TEST Nacelle 3b » (retirés ou rendus au loueur) sont absents. | OK |
| B3 | Collab. | Recherche | Nom, référence, description, sans tenir compte de la casse ni des accents | Nom, n° GOMAT1-…, mot de la description (« zygomatique ») et casse : OK. **Accents** : « telescopique » et « perçeuse » ne trouvent rien. → S13 | PARTIEL (Mi) |
| B4 | Collab. | Type, rayons et combinaisons | Compteurs justes | Consommables 2 ; Outils 6 ; Outils + Sécurité 1 ; Consommables + Sécurité : « Aucun article ». « Disponible maintenant » et la recherche se combinent bien. Remarques : les compteurs des rayons ne suivent ni la recherche ni le type ; aucun filtre pour les articles sans rayon (8 au total, 3 rangés). | OK |
| B5 | Collab. | Tri | Disponibles, puis avec image, puis A→Z | Vérifié, y compris après un changement de dépôt | OK |
| B6 | Collab., admin | Changer de dépôt dans la barre du haut | Les chiffres suivent | Consommables : oui (TEST Gants aide 40 → 2). **Outils : non** (Nacelle « 2 disponibles » dans TEST Dépôt aide, alors qu'elles sont au Dépôt principal). « Tous les dépôts » affiche le stock du dépôt par défaut (40), pas le total (42). → S14 | PARTIEL (Mi) |
| B7 | Collab. | Badges | « Validation » (b), « Permis requis » (d) | Présents | OK |
| B8 | Collab. | Images | Carré, image entière, fond blanc ; lisible en sombre | `object-contain` sur fond blanc ; mode sombre lisible (voir G2 pour les placeholders) | OK |
| B9 | Collab. | Performance | Ressenti | 8 articles seulement en base. Affichage en ~70 ms (navigation interne) ; images en `loading="lazy"`. Remarque : les vignettes chargent les images fournisseur en taille réelle (954 × 1000) ; pas de pagination. À revoir avec un vrai catalogue. | OK |

### C. Fiche produit

| ID | Rôle | Étapes | Attendu | Obtenu | Verdict |
|---|---|---|---|---|---|
| C1 | Collab. | Fiche de (a) | Galerie, description, « Livré avec », caractéristiques | 8 miniatures cliquables, la miniature active est encadrée `rgb(106,86,222)`. Description et 23 caractéristiques présentes ; pas de « Livré avec » (le produit n'a pas d'accessoires). **Défaut** : la ligne de référence affiche « GOMAT1-000005 · 76b9f649-b3d2-… », c'est-à-dire l'identifiant du fournisseur au lieu de son nom. → S15 | PARTIEL (Mi) |
| C2 | Collab. | Fiche de (c) | Pas de section vide | « 5 paire », pas de section vide, pas d'erreur | OK |
| C3 | Collab. | Fiche de (d) | « Permis requis : … » | « Permis requis : Chariot élévateur télescopique » | OK |
| C4 | Collab. | Fiche de (b) | Mention de validation | « Un responsable valide la commande de cet article. » | OK |
| C5 | Collab. | −/+ puis « Ajouter au panier » | Minimum 1, toast, compteur, « Déjà N » | Le « − » s'arrête à 1. Toast « … ajouté au panier », « Panier (2) », puis « Déjà 2 dans ton panier. » | OK |
| C6 | Collab. | Fermer la fiche | Échap, croix, voile | Les trois ferment la fiche ; le focus revient sur la carte. | OK |

### D. Panier

| ID | Rôle | Étapes | Attendu | Obtenu | Verdict |
|---|---|---|---|---|---|
| D1 | Collab. | « Ajouter » depuis la carte, puis quantité 0 | Sélecteur de quantité ; 0 retire l'article | Conforme | OK |
| D2 | Collab., magasinier | Recharger ; deux onglets | Panier gardé ; noter le comportement | Rechargement : panier gardé. **Deux onglets** : pas de synchronisation, le dernier qui écrit gagne (un ajout fait dans l'autre onglet est effacé). **Comptes** : le panier n'est pas lié à la personne. Après déconnexion du collaborateur puis connexion du magasinier, le panier du collaborateur était toujours là. → S16 | PARTIEL (Mi) |
| D3 | Collab. | Vignettes, poubelle, « libre(s) », quantité 3 pour 2 nacelles | « Seulement N libre(s) » en rouge | « Seulement 2 libre(s) sur la période » en rouge `rgb(214,39,61)`. « Commander » reste actif, mais le serveur refuse : « Pas assez de « TEST-SHOP Nacelle validation » sur la période : 0 disponible(s), 1 demandé(s) ». | OK |
| D4 | Collab. | Changer les dates | Disponibilité recalculée | Nacelle du 05 au 06.11 (après validation de DEM2610-0013) : « Seulement 0 libre(s) » ; du 09 au 10.11 : « 2 libre(s) ». Remarque : une commande encore « À valider » ne réserve rien. Deux commandes de 2 nacelles sur la même période ont donc été acceptées ; la seconde n'est bloquée qu'au moment de la valider. | OK |
| D5 | Collab. | Vider le panier | État vide propre | « Ton panier est vide. Ajoute des articles depuis le catalogue. » | OK |
| D6 | Admin, collab. | Retirer du service un article qui est dans le panier ; puis article supprimé | Comportement clair | Article retiré : il disparaît du catalogue mais **reste dans le panier**, avec seulement « Seulement 0 libre(s) sur la période », sans explication. Article supprimé : le bouton affiche « Panier (3) » mais le tiroir « Panier (2) » (ligne fantôme comptée). → S17 | PARTIEL (Mi) |

### E. Commande

Commandes créées : DEM2610-0012 à 0016 (voir l'inventaire).

| ID | Rôle | Étapes | Attendu | Obtenu | Verdict |
|---|---|---|---|---|---|
| E1 | Collab., magasinier, responsable | « Pour qui » | Absent pour le collaborateur ; liste des personnes actives avec « (moi) » pour les autres | Collaborateur : absent. Magasinier et responsable : 14 personnes, « TEST Rôle Magasinier (moi) » ou « TEST Rôle Responsable (moi) » sélectionné. **Mais** une commande passée pour quelqu'un d'autre (DEM2610-0016) n'apparaît nulle part dans les « Mes commandes » de celui qui l'a passée : la vue affiche « Aucune commande en cours » juste après l'envoi. → S8 | PARTIEL (Mi) |
| E2 | Collab. | Retour avant retrait ; date passée ; week-end | Refus clair ; noter le reste | Retour avant retrait : « Le retour doit être après le retrait » (seulement au clic sur Commander). **Date passée acceptée** : DEM2610-0012 créée le 31.10 pour un retrait le 30.10 à 07:30, sans avertissement. **Week-end** : la date proposée par défaut est « demain 07:30 », soit le dimanche 01.11, sans avertissement. → S7 | PARTIEL (Mi) |
| E3 | Collab. | Chantier : suggestions et SiteNotice | Suggestions ; avertissement pour un nom inconnu | La liste propose « TEST Chantier aide » et « TEST Chantier carte ». « TEST-SHOP chantier inconnu » → avertissement « Aucune fiche chantier à ce nom… ». « test chantier  carte » est reconnu, mais enregistré tel quel (minuscules, double espace) et non sous le nom de la fiche. | OK |
| E4 | Collab. | Livraison sans chantier ni adresse | Refus avec message | « Indique le chantier ou l'adresse de livraison ». Avec un chantier : commande DEM2610-0013 envoyée. Le cas « adresse seule » a été vérifié en lisant le code, pas en passant une commande. | OK |
| E5 | Collab. | Bandeau de validation | Avec (b) : « Un responsable doit valider : … » ; sans (b) : « Pas de validation nécessaire… » | Conforme (voir E8 pour l'écart sur la quantité) | OK |
| E6 | Collab. | Commande sans validation | Toast « …le magasin la prépare » ; Demandes : Validée | DEM2610-0012 : toast conforme, statut « Validée » | OK |
| E7 | Collab. | Commande avec (b) | « en attente de validation » ; À valider avec le motif | DEM2610-0013 : « À valider », motif « Validation requise : « TEST-SHOP Nacelle validation » demande une validation » | OK |
| E8 | Collab. | TEST Gants aide × 11 (seuil 10) | Validation demandée ? Que dit l'interface ? | Le serveur demande bien la validation (DEM2610-0015, motif « quantité de « TEST Gants aide » au-delà de 10 »). Mais le **bandeau du panier affichait « Pas de validation nécessaire : ta commande part directement en préparation. »**, puis le toast a dit « en attente de validation ». → S6 | PARTIEL (Mi) |
| E9 | Collab. | Commander (d) sans le permis | Que se passe-t-il ? | La création est refusée avec un message clair : « « TEST-SHOP Chariot télescopique » exige le permis machine « Chariot élévateur télescopique » : TEST Rôle Collaborateur ne l'a pas (à saisir dans « Permis et formations ») ». Remarque : on ne l'apprend qu'à la fin, le panier ne prévient pas. | OK |
| E10 | Collab. | Outils + consommable | Les deux dans la demande | DEM2610-0013 : « 2 outils · 1 consommable » ; contenu Nacelle × 2, Perceuse × 1, Gants × 1 paire | OK |
| E11 | Collab. | Après la commande | Panier vidé, bascule sur « Mes commandes » | Conforme. Remarque : le formulaire n'est pas remis à zéro (chantier, mode de livraison et remarque de la commande précédente restent). → S24 | OK |
| E12 | Admin | Remarque visible côté magasin | Mode + remarque dans la demande | « Livraison sur chantier : test chantier carte · TEST-SHOP E10 commande mixte livrée » | OK |
| E13 | Collab. | Double clic sur Commander | Une seule demande | Double clic réel (80 ms d'écart) : 1 seule demande (DEM2610-0015), le bouton est désactivé. **Deux clics dans la même image** (avant le premier rendu) : 2 demandes identiques (DEM2610-0013 et 0014). → S9 | PARTIEL (Mi) |
| E14 | Collab. | Coupure réseau au moment de commander | Message d'erreur, panier gardé | Panier gardé, formulaire intact. Message affiché : **« TypeError: Failed to fetch »** (brut, en anglais). Coupure simulée en faisant échouer l'appel réseau du client Supabase (pas de mode hors ligne des DevTools dans cet environnement). → S10 | PARTIEL (Mi) |
| E15 *(ajouté)* | Collab., magasinier | Ouvrir `/shop` directement ou le recharger, ajouter un article, Commander | Commande envoyée | **Échec** : « invalid input syntax for type uuid: "" ». Le champ Dépôt affiche « Dépôt principal », mais la valeur interne est vide. Ça marche si on arrive au Shop depuis l'Accueil ou si on rechoisit le dépôt dans la liste. → S1 | **KO (B)** |

### F. Mes commandes

| ID | Rôle | Étapes | Attendu | Obtenu | Verdict |
|---|---|---|---|---|---|
| F1 | Collab. | Liste | Seulement les siennes | DEM2610-0009, 0012, 0013, 0016 (commandée pour lui par le magasinier). Pas de 0011 (TEST L1 Beta). | OK |
| F2 | Admin puis collab. | Valider, préparer, Marquer prête, Sortir, Retour, puis recharger à chaque étape | Envoyée → Validée → Prête → Retirée → Rendue | DEM2610-0013 : Validée, puis « Prête » (étape 3), « Retirée » (étape 4, bon DN2610-0017) et enfin 5 étapes cochées (statut `closed`, visible avec « terminées »). Sortie faite dans Demandes › « Sortir » (voir H3 pour le Comptoir). | OK |
| F3 | Admin, collab. | Refuser 0015 ; annuler 0014 | Texte rouge avec le motif, pas de frise | « Refusée : TEST-SHOP F3 refus : 11 paires, c'est trop » et « Annulée », en rouge `rgb(214,39,61)`, sans frise | OK |
| F4 | Collab. | « Afficher aussi les commandes terminées » | Fonctionne | 3 commandes en cours → 6 avec les terminées | OK |
| F5 | Collab. | Notifications | Notifié à la validation et quand c'est prêt | Notifications bien créées : « Demande validée : DEM2610-0013 », « Demande refusée : DEM2610-0015 », « Prête à retirer : DEM2610-0013 ». La cloche affiche « 4 ». **Mais le collaborateur ne peut pas les lire** : la cloche mène à `/notifications`, interdit à ce rôle, qui renvoie vers l'Accueil, où elles ne sont pas affichées non plus. → S2 | PARTIEL (Ma) |
| F6 | Collab. | Lien « Demandes » en bas | Ouvre Demandes | `/demandes` ; le collaborateur peut y annuler sa demande (« Annuler ma demande » avec confirmation) | OK |

### G. Téléphone, tablette, thème, langues, accessibilité

| ID | Rôle | Étapes | Attendu | Obtenu | Verdict |
|---|---|---|---|---|---|
| G1 | Collab. | 390, 768 et 1440 px | 2 cartes par ligne, rayons en puces, boutons ≥ 40 px, pas de défilement horizontal | 390 : 2 cartes par ligne, rayons en puces, onglet Shop dans la barre du bas, pas de défilement horizontal. 768 : 3 cartes par ligne. 1440 : 5 cartes par ligne, `--mx-scale` 0,9. **Boutons trop petits** sur téléphone : −/+ 26 px, poubelle 28 px, choix Tout/Outils/Consommables et Catalogue/Mes commandes 28 px, puces 32 px, boutons du panier 34 px. « Commander » n'est pas fixé en bas (y = 956 pour un écran de 844). L'heure est tronquée (« 07:… »). → S18 | PARTIEL (Mi) |
| G2 | Collab. | Mode sombre : catalogue, fiche, panier, Mes commandes | Lisible | Les 4 vues sont lisibles (cartes `rgb(20,22,29)`, texte `rgb(245,246,248)`). Remarque : les articles sans image gardent une grande case blanche (placeholder) très visible. → S26 | OK |
| G3 | Collab. | DE, IT, EN | Tout est traduit | Restent en français : « dépôt(s) » dans le sélecteur du haut ; « N article(s) » ; « 1 disponible / 2 disponibles » ; « N disponible(s) maintenant » ; « Déjà N dans ton panier » ; « Panier (N) » (titre du tiroir) ; « N libre(s) sur la période » ; « · validation » ; « Un responsable doit valider : … » (DE et EN) ; « Le détail de chaque commande est aussi dans » ; toast « … ajouté au panier » ; aria-label « Filtres du catalogue », « Voir … », « Voir cette photo », « Moins » ; dates « 01 nov. 2026 à 07:30 ». « Plus » est traduit en EN par « More » (contresens). Les préfixes « Retrait au dépôt · » et « Livraison sur chantier : » sont enregistrés en français dans la demande. → S19 | PARTIEL (Mi) |
| G4 | Collab. | Clavier et lecteur d'écran | Focus visible ; noms des boutons | Les cartes sont des boutons (« Voir <nom> »). Le focus entre dans la fiche et revient sur la carte. Contour de focus 1 px couleur d'accent (fin). « Retirer <nom> » : OK. Groupe « Quantité <nom> » : OK. **À corriger** : le bouton de fermeture du panier s'appelle « Panier (N) », celui de la fiche porte le nom de l'article ; les 8 miniatures s'appellent toutes « Voir cette photo », sans numéro ni état ; images sans `alt`. Navigation au clavier non simulable ici : vérifié dans le DOM. → S20 | PARTIEL (Mi) |

### H. Non-régression

| ID | Rôle | Étapes | Attendu | Obtenu | Verdict |
|---|---|---|---|---|---|
| H1 | Les 4 rôles | Accueil en cartes de modules | 3 chiffres par carte, justes ; vue collaborateur ; le clic ouvre le module | Cartes de 3 chiffres pour chaque rôle ; liens vers `/shop`, `/equipment`, `/consommables`, etc. Collaborateur : Magasin « Mon matériel 0 / Mes demandes en cours 3 / En retard 0 », chiffres justes. **Écart** : pour le personnel, la carte Magasin dit « Demandes à préparer 4 » mais l'action rapide du même nom dit « 3 » (après annulation : 2 contre 1). La carte compte toutes les demandes validées, l'action seulement celles d'aujourd'hui et de demain, sous le même libellé. Véhicules : « Locations en cours » 0 pour le collaborateur, 3 pour le personnel. → S21 | PARTIEL (Mi) |
| H2 | Admin | 9 pages : commandes dans l'en-tête (desktop) ou dans la page (téléphone), et fonctionnement | Placement et fonctionnement | Desktop : les commandes des 9 pages sont dans l'en-tête du module. Testé : Entretien (À faire / Tous les plans, « Nouveau plan »), Atelier (3 vues, « Envoyer en réparation »), Pertes et casse (filtres, « Déclarer »), Inventaire (dépôt), Emplacements (dépôt), Formations (« Nouveau permis ou formation »), Journal (Type « Demande » : 501 → 309 lignes), Coûts (mois 2026-09), Notifications (« Actualiser »). Téléphone : commandes dans la page, pas de défilement horizontal. **Écarts** : les commandes ne changent pas de place quand la fenêtre change de largeur (rotation de tablette) ; Emplacements ne suit le dépôt du haut qu'au chargement. Pas cliqués exprès : « Exporter Excel » et « Tout marquer comme lu » (aurait modifié de vraies notifications). → S22 | PARTIEL (Mi) |
| H3 | Admin | Commande du Shop de bout en bout dans Demandes (création, validation, préparation, sortie au comptoir) | De bout en bout | Par Demandes : OK (DEM2610-0013, de la validation au retour). **Par le Comptoir** : après le badge du collaborateur, aucune de ses commandes validées n'est proposée. Scanner l'article (GOMAT1-000008) fait une sortie indépendante. La commande DEM2610-0016 reste « Validée » et le stock baisse sans la clore. → S3 | PARTIEL (Ma) |
| H4 | Admin | Article d'aide « Le shop » | Existe (Magasin), étapes conformes | Présent dans Magasin (2e article). Trois phrases ne correspondent pas à l'écran (→ S23) : « Ouvre la fiche (Matériel › Outils, **ou Consommables**) et clique sur « Modifier » » ; « Tu reçois aussi une notification quand elle est prête » ; « Il faut avoir ce permis… pour que le magasin puisse te le sortir » (en réalité la commande est refusée dès l'envoi). « Pour qui » n'est pas mentionné. | PARTIEL (Mi) |

---

## 3. Défauts (KO et PARTIEL), triés par gravité

### Bloquant

**S1 — Commander échoue quand la page Shop est ouverte directement ou rechargée** (E15 ; découvert en E2/E3)
- Étapes :
  1. Collaborateur, dépôt du haut sur « Tous les dépôts ».
  2. Ouvrir `/shop` directement (lien, favori, F5, appli téléphone rouverte sur cette page).
  3. Ajouter un article, ouvrir Panier, cliquer « Commander ».
- Obtenu : toast « invalid input syntax for type uuid: "" ». Le champ Dépôt affiche « Dépôt principal » mais la valeur est vide.
- Contournement : choisir un autre dépôt puis revenir, ou arriver par l'Accueil.
- Cause probable : `useState(currentDepot || depots.find(d => d.isDefault)?.id || …)` est évalué au montage, quand les dépôts ne sont pas encore chargés.
- Console : `Failed to load resource: the server responded with a status of 400 ()` sur `POST …/rest/v1/rpc/create_request`. Terminal Vite : rien.
- Capture : [e1-depot-vide-uuid.jpg](captures-lot24/e1-depot-vide-uuid.jpg)

### Majeur

**S2 — Le collaborateur ne peut pas lire ses notifications** (F5)
- Étapes : valider, refuser ou marquer prête une demande du collaborateur ; côté collaborateur, cliquer la cloche (badge 4).
- Obtenu : redirection vers l'Accueil (`/notifications` est réservé au personnel). Rien n'affiche les 3 notifications « validée / refusée / prête » pourtant créées pour lui. L'aide promet « Tu reçois aussi une notification quand elle est prête ».
- Capture : [f5-cloche-collaborateur-vers-accueil.jpg](captures-lot24/f5-cloche-collaborateur-vers-accueil.jpg)

**S3 — Le Comptoir ne reprend pas les commandes du Shop** (H3)
- Étapes :
  1. Commande validée DEM2610-0016 (Gants × 1 pour le collaborateur).
  2. Comptoir › choisir TEST Rôle Collaborateur.
  3. Scanner GOMAT1-000008, puis Valider.
- Obtenu : aucune commande proposée pour cette personne. La sortie est enregistrée à part (« TEST Rôle Collaborateur : 1 consommable ») et DEM2610-0016 reste « Validée » dans « À préparer ».
- Seul « Demandes › Sortir » clôt la commande. À vérifier : ce comportement existait peut-être avant le lot 24, mais le Shop le rend plus visible.
- Capture : [h3-commande-reste-validee-apres-comptoir.jpg](captures-lot24/h3-commande-reste-validee-apres-comptoir.jpg)

**S4 — Pas de photo possible pour les consommables** (A9)
- Étapes : Consommables › TEST-SHOP Gants nitrile.
- Obtenu : actions Sortir, Réception, Inventaire, Transférer, Seuil, mais pas de « Modifier ». « Nouveau consommable » n'a pas de champ Image. `ImageField` n'est utilisé que dans `AddEquipmentModal` et `EditEquipmentModal`.
- Conséquence : tous les consommables du Shop gardent le placeholder, et l'aide (H4) dit le contraire.
- Capture : [a9-consommable-sans-image.jpg](captures-lot24/a9-consommable-sans-image.jpg)

**S5 — Une image modifiée ne s'affiche qu'après rechargement** (A1, A3)
- Étapes : Matériel › ⋮ › Modifier › changer le lien de l'image › Suivant › « Modifier le matériel ».
- Obtenu : « Matériel modifié avec succès », mais la carte, la fiche rouverte et le Shop gardent l'ancienne image. La base a bien la nouvelle valeur.
- Capture : [a1-a2-enregistre-mais-carte-pas-rafraichie.jpg](captures-lot24/a1-a2-enregistre-mais-carte-pas-rafraichie.jpg). Le lien a été rendu cassé, mais la carte montre toujours la perceuse.

### Mineur

**S6 — Bandeau « Pas de validation nécessaire » faux au-delà du seuil de quantité** (E8)
- Étapes : panier avec TEST Gants aide × 11.
- Obtenu : le bandeau dit « Pas de validation nécessaire… », puis la commande part « en attente de validation » (motif « au-delà de 10 »). Le bandeau ne regarde que `requiresApproval`.
- Capture : [e8-bandeau-sans-validation-qte11.jpg](captures-lot24/e8-bandeau-sans-validation-qte11.jpg)

**S7 — Dates passées acceptées ; défaut sur un dimanche** (E2)
- Étapes : Retrait le 30.10 à 07:30, retour le 31.10, le 31.10 à 17:30.
- Obtenu : commande DEM2610-0012 acceptée sans avertissement. Le calendrier laisse choisir les jours passés. La date par défaut (« demain 07:30 ») tombait un dimanche.
- Capture (dates du 30 au 31 oct. visibles) : [e1-depot-vide-uuid.jpg](captures-lot24/e1-depot-vide-uuid.jpg)

**S8 — Une commande passée pour quelqu'un d'autre disparaît pour celui qui l'a passée** (E1)
- Étapes : magasinier › Pour qui = TEST Rôle Collaborateur › Commander.
- Obtenu : toast « DEM2610-0016 envoyée », puis « Mes commandes » vide (« Aucune commande en cours »).
- Capture : [e1-commande-pour-autrui-invisible.jpg](captures-lot24/e1-commande-pour-autrui-invisible.jpg)

**S9 — Deux clics dans la même image créent deux commandes** (E13)
- Étapes : deux `click()` successifs, avant le rendu suivant.
- Obtenu : DEM2610-0013 et DEM2610-0014, identiques. Avec 80 ms d'écart : une seule (bouton désactivé). Risque faible ; un verrou synchrone (ref) suffirait.
- Capture (les deux commandes identiques dans « Mes commandes ») : [e13-f-mes-commandes-doublon.jpg](captures-lot24/e13-f-mes-commandes-doublon.jpg)

**S10 — Message réseau brut** (E14)
- Obtenu : « TypeError: Failed to fetch » au lieu d'un message du genre « Pas de connexion : ta commande n'est pas partie, réessaie ». Le panier est bien gardé.
- Capture : [e14-hors-ligne-message-brut.jpg](captures-lot24/e14-hors-ligne-message-brut.jpg)

**S11 — Lien d'image cassé enregistré sans avertissement** (A2)
- Obtenu : le message rouge est sous le champ, mais « Suivant / Modifier le matériel » enregistre sans rien demander.
- Capture : [a2-lien-casse-message.jpg](captures-lot24/a2-lien-casse-message.jpg)

**S12 — HEIC : message anglais brut** (A6, hors plan)
- Étapes : importer `IMG_0001.HEIC` (`image/heic`).
- Obtenu : « mime type image/heic is not supported ».
- Console : 400 sur l'envoi au stockage.
- Capture : [a6-heic-message-brut.jpg](captures-lot24/a6-heic-message-brut.jpg)

**S13 — La recherche tient compte des accents** (B3)
- Obtenu : « telescopique » et « perçeuse » → « Aucun article ».
- Capture : [b3-recherche-sans-accent.jpg](captures-lot24/b3-recherche-sans-accent.jpg)

**S14 — La disponibilité des outils ne suit pas le dépôt ; « Tous les dépôts » ≠ total** (B6)
- Étapes : dépôt du haut sur TEST Dépôt aide.
- Obtenu : Nacelle « 2 disponibles », Perceuse « 1 disponible » (outils du Dépôt principal) ; Gants nitrile « Indisponible ».
- Capture : [b6-outils-ne-suivent-pas-le-depot.jpg](captures-lot24/b6-outils-ne-suivent-pas-le-depot.jpg)

**S15 — Fiche produit : identifiant du fournisseur au lieu de son nom** (C1)
- Obtenu : « GOMAT1-000005 · 76b9f649-b3d2-4714-b727-608488c11683 ».
- Capture : [c1-fournisseur-uuid.jpg](captures-lot24/c1-fournisseur-uuid.jpg)

**S16 — Panier non synchronisé entre onglets et partagé entre comptes** (D2)
- Étapes :
  1. Onglet A et onglet B ouverts.
  2. Ajouter dans B, puis changer une quantité dans A : l'ajout de B est effacé.
  3. Se déconnecter et se connecter avec un autre compte : le panier du précédent est toujours là (clé `gomat-cart` non liée à l'utilisateur).
- Pas de capture : c'est un comportement entre onglets et sessions, reproduit par script (contenu de `localStorage` avant et après).

**S17 — Article retiré ou supprimé resté dans le panier** (D6)
- Retiré du service : reste dans le panier avec « Seulement 0 libre(s) », sans dire qu'il n'est plus proposé.
- Supprimé : bouton « Panier (3) » contre tiroir « Panier (2) ».
- Capture : [d6-article-retire-dans-panier.jpg](captures-lot24/d6-article-retire-dans-panier.jpg)

**S18 — Téléphone : cibles tactiles sous 40 px, « Commander » hors écran** (G1)
- Captures : [g1-telephone-390-panier.jpg](captures-lot24/g1-telephone-390-panier.jpg), [g1-telephone-390-catalogue.jpg](captures-lot24/g1-telephone-390-catalogue.jpg). Sur le catalogue, les filtres occupent tout le premier écran ; le premier article commence à ~600 px.

**S19 — Textes non traduits (DE, IT, EN)** (G3)
- Liste complète en G3.
- Capture : [g3-de-panier-non-traduit.jpg](captures-lot24/g3-de-panier-non-traduit.jpg)

**S20 — Noms accessibles** (G4)
- Fermeture du panier = « Panier (N) ».
- Fermeture de la fiche = nom de l'article.
- Miniatures toutes « Voir cette photo ».
- « Moins » / « Plus » génériques (EN : « More »).
- Images sans `alt`.
- Pas de capture (attributs du DOM).

**S21 — Accueil : deux chiffres « Demandes à préparer »** (H1)
- Obtenu : la carte Magasin affiche 2, le bloc « Aujourd'hui au magasin » affiche 1, avec le même libellé et des définitions différentes.
- Capture : [h1-accueil-deux-chiffres-a-preparer.jpg](captures-lot24/h1-accueil-deux-chiffres-a-preparer.jpg)

**S22 — Barre de commandes : ne suit pas la largeur ; Emplacements ne suit pas le dépôt** (H2)
- Étapes :
  1. Ouvrir une page en 390 px, puis passer en 1440 sans naviguer : les commandes restent dans la page et l'en-tête reste vide (`matchMedia` lu une seule fois au rendu).
  2. Sur Emplacements, changer le dépôt du haut : la liste reste sur l'ancien dépôt jusqu'à la navigation suivante.
- Capture : [h2-commandes-restent-dans-la-page-apres-redimensionnement.jpg](captures-lot24/h2-commandes-restent-dans-la-page-apres-redimensionnement.jpg)

**S23 — Aide « Le shop » inexacte sur 3 points** (H4)
- Voir H4.
- Capture : [h4-aide-le-shop.jpg](captures-lot24/h4-aide-le-shop.jpg)

**S24 — Le panier garde la saisie de la commande précédente** (E11)
- Obtenu : après une commande, « Chantier ou service », le mode de livraison et la « Remarque » restent remplis pour la suivante.
- Capture (chantier repris de la commande précédente) : [e8-bandeau-sans-validation-qte11.jpg](captures-lot24/e8-bandeau-sans-validation-qte11.jpg)

### Cosmétique

**S25 — Collaborateur : menu « ⋮ » des cartes Matériel sans effet** (A8)
- Obtenu : le bouton est affiché sur chaque carte, mais rien ne s'ouvre (aucune action permise).
- Capture : [a8-collaborateur-menu-actions-vide.jpg](captures-lot24/a8-collaborateur-menu-actions-vide.jpg)

**S26 — Mode sombre : cases blanches des articles sans image** (G2)
- Capture : [g2-sombre-catalogue.jpg](captures-lot24/g2-sombre-catalogue.jpg)

**S27 — « Mes commandes » ne nomme pas les articles ; étape « Rendue » pour un consommable seul** (F)
- Obtenu : « 1 consommable », « 2 outils · 1 consommable », sans noms ni vignettes. La frise d'une commande de gants propose « Retirée → Rendue ».
- Capture : [e13-f-mes-commandes-doublon.jpg](captures-lot24/e13-f-mes-commandes-doublon.jpg)

Hors lot, vu en passant :
- Journal : champs bruts (« decided_at », « requested → approved ») ;
- Sorties : « Bon #Bon-710977 » dans la liste contre « Bon DN2610-0017 » dans le détail ;
- console : avertissement React `fetchPriority` (MxAvatar).

---

## 4. Dix propositions d'amélioration (façon Galaxus / Zalando)

1. **Recherche tolérante et instantanée** : suggestions dès 2 lettres (articles, rayons, références), sans tenir compte des accents ni des fautes de frappe (« telescopique », « perçeuse », « visseuse makita »), avec mise en évidence des mots trouvés.
2. **Filtres en tiroir sur téléphone** : un bouton « Filtres (2) » et des puces actives effaçables en haut de la liste, pour que les articles apparaissent dès le premier écran. Compteurs de rayons recalculés selon la recherche.
3. **Disponibilité utile** : sur la carte et la fiche, « 2 au Dépôt principal · 0 au Dépôt aide » et « libre dès le 07.11 ». Dans la fiche, un mini-calendrier des disponibilités sur 2 semaines, comme le délai de livraison de Galaxus.
4. **Panier qui prévient avant l'envoi** : bouton « Commander » fixé en bas sur téléphone, avec un récapitulatif (articles, validation, livraison). Tous les contrôles visibles avant le clic : date passée, quantité au-delà du libre, permis manquant de la personne choisie, seuil de validation. Bouton désactivé avec la raison écrite.
5. **Suivi de commande type Zalando** : vignettes et noms des articles dans « Mes commandes », heure de chaque étape, et notifications lisibles par tous (centre personnel, push et e-mail « Prête à retirer » avec le QR du retrait).
6. **Recommander en un clic** : « Commander à nouveau », listes favorites et kits de chantier (« Kit carreleur »), modifiables avant l'envoi.
7. **Produits associés** : « Souvent pris avec » (forets, batteries, gants) sur la fiche et dans le panier, avec la section « Livré avec » bien visible.
8. **Photos de qualité** : photo pour les consommables, vignettes réduites générées à l'envoi (~300 px) pour la grille, recadrage carré guidé, nettoyage automatique des photos remplacées.
9. **Créneaux de retrait** : proposer des créneaux selon les jours et heures d'ouverture du dépôt (le prochain jour ouvré par défaut) au lieu d'une date et d'une heure libres.
10. **Panier et commandes liés au compte** : panier synchronisé entre appareils et onglets, vidé à la déconnexion (tablette partagée au dépôt), et rubrique « Commandes que j'ai passées pour d'autres » pour le personnel. Au Comptoir, après le badge : « 1 commande prête : DEM… — tout sortir ».

---

## 5. Points vérifiés côté serveur (rassurants)

- Disponibilité sur la période vérifiée à la création et à la validation : « Pas assez de … : 0 disponible(s), 2 demandé(s) » au moment de valider DEM2610-0014.
- Permis machine vérifié dès la création de la demande (E9).
- Seuil global `approval_max_quantity` = 10 appliqué (E8).
- Stockage `photos-articles` : envoi refusé au collaborateur, accepté pour le magasinier ; lecture publique.

---

## 6. Inventaire des données TEST-SHOP (base GO-MAT)

**Articles** (table `equipment`) :

| Nom | Id | N° | Détail | État final |
|---|---|---|---|---|
| TEST-SHOP Perceuse-visseuse LXT | `f0f78b3d-35bf-48b8-b1da-bdca2137edb1` | GOMAT1-000005 | Outil, rayon Outils, image lien Makita `DDF490Z_C2L0.jpg`, lié au catalogue Makita | Disponible. Passé un instant en « retiré » (D6) et avec un lien cassé (A2), les deux remis comme avant. |
| TEST-SHOP Nacelle validation | `f62fe51a-6112-47bb-bb9c-b467f8b86183` | GOMAT1-000006 | Outil × 2, validation requise, rayon Sécurité, description avec « zygomatique » | Disponible, sans image |
| TEST-SHOP Chariot télescopique | `17570930-9bc8-4370-9af1-76f0b8f14598` | GOMAT1-000007 | Outil, rayon Électronique, permis « Chariot élévateur télescopique » | Disponible, photo `photos-articles/2026/e59746e2-f5c1-4277-a8fe-50a6d93c5beb.jpg` |
| TEST-SHOP Gants nitrile | `3d14e254-b248-40c2-a3d6-868b84bd6dfb` | GOMAT1-000008 | Consommable, paire, prix 3, seuil 2 | Stock **3** au Dépôt principal : 5 au départ, −1 (DEM2610-0013), −1 (sortie au comptoir, H3) |

**Fichiers dans le compartiment `photos-articles`** :
- `2026/e59746e2-f5c1-4277-a8fe-50a6d93c5beb.jpg`, utilisé par le Chariot ;
- deux fichiers orphelins des essais A4/A5 (`2026/a8460e94…jpg`, `2026/0e4c8b87…jpg`) ;
- `2026/TEST-SHOP-A8-magasinier.jpg` (40 × 40 px, essai A8).

La suppression par l'API ne supprime rien (0 fichier), faute de droit de lecture sur les objets : ces fichiers sont à effacer depuis la console Supabase.

**Demandes** (toutes au nom de TEST Rôle Collaborateur, remarque commençant par « TEST-SHOP ») :

| N° | Contenu | Remarque | État final |
|---|---|---|---|
| DEM2610-0012 | Gants nitrile × 1, du 30 au 31.10 | « TEST-SHOP E3 dates passées » | Annulée |
| DEM2610-0013 | Nacelle × 2, Perceuse × 1, Gants × 1, du 05 au 06.11, livraison « test chantier carte » | « TEST-SHOP E10 commande mixte livrée » | Rendue (`closed`) ; bon DN2610-0017 (3 sorties retournées) |
| DEM2610-0014 | Doublon de 0013 (E13) | idem | Annulée par le collaborateur |
| DEM2610-0015 | TEST Gants aide × 11 | « TEST-SHOP E8 quantité 11 (double-clic 80 ms) » | Refusée (« TEST-SHOP F3 refus : 11 paires, c'est trop ») |
| DEM2610-0016 | Gants nitrile × 1, passée par TEST Rôle Magasinier | « TEST-SHOP E1 magasinier pour collaborateur » | Annulée |

**Autres traces** :
- Une sortie au comptoir : TEST-SHOP Gants nitrile × 1 pour TEST Rôle Collaborateur (H3).
- Trois notifications non lues pour TEST Rôle Collaborateur : 0013 validée, 0015 refusée, 0013 prête.
- Une alerte de stock « TEST-SHOP Gants nitrile : il reste 0 paire » (créée avec l'article).
- Les entrées automatiques du Journal.

**Rien d'autre** : aucun chantier, utilisateur ou dépôt créé ; aucun mot de passe changé. Remis comme avant : le dépôt du haut (admin), la langue et le thème du collaborateur, les paniers (vidés).
