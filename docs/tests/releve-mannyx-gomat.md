# Relevé visuel : Mannyx (référence) comparé à GO-Mat

- **Date** : 31.10.2026.
- **Versions** :
  - Mannyx : serveur local `http://localhost:5173`.
  - GO-Mat : `claude/loving-thompson-6zfo06` à `ef200e3` (« Icône de la page devant chaque titre, comme dans Mannyx »), servie localement sur le port 5190 avec le compte administrateur.
- **Lecture seule** :
  - Mannyx a été parcouru et ses drawers seulement ouverts ; ils ont été refermés par Échap, sans rien enregistrer.
  - Aucun commit dans Mannyx, aucune donnée modifiée dans les deux applications.
  - Seuls deux réglages d'affichage locaux ont été changés le temps des mesures, puis remis comme avant : le thème (`localStorage.theme`) et le repli du menu.
- **Données personnelles** :
  - Avant chaque capture, les noms, e-mails, téléphones, montants et photos ont été floutés dans la page, sans rien enregistrer : textes à 9 px, photos à 22 px en niveaux de gris, valeurs des graphiques floutées.
  - Le menu utilisateur (photo, nom, e-mail) est masqué sur toutes les captures Mannyx.
  - Les 32 captures Mannyx ont ensuite été revérifiées une par une.
  - Le rapport ne contient que des valeurs de style et de mise en page.
- **Conditions** :
  - 1 440 × 900 en clair ;
  - en sombre : Tableau de bord, Offres, Contacts personnes, Bénévoles et Notifications (Mannyx), et leurs équivalents GO-Mat ;
  - en 390 × 844 : Accueil, Demandes et Outils (GO-Mat) ; Tableau de bord et Offres (Mannyx, pour comparer).
- **Mesures** : styles calculés (`getComputedStyle`), relevés par les sondes `.claude/audit-probes/probes.js` (fonctions `__shell`, `__pageHead`, `__tabs`, `__cmds`, `__content`).
- **Captures** : fenêtre visible, en JPEG. Le panneau du navigateur réduit l'image à 800 × 500 ; les valeurs mesurées font foi.

> **Densité.** Mannyx tourne en `data-density="compact"`, avec `--mx-scale: 0.9`. Toutes ses dimensions sont donc **90 % des valeurs de base de la charte** : titre 26 → 23,4 px, drawer 680 → 612 px, rayon 8 → 7,2 px, menu 11,7 px. GO-Mat est en densité normale (échelle 1). Beaucoup d'écarts de taille ci-dessous viennent de ce facteur, et non d'un dessin différent.

---

## 1. Coque

| Élément | Mannyx | GO-Mat | Écart |
|---|---|---|---|
| **Structure du menu** | Une colonne `aside` fixe de **180 px** : logo, 10 entrées, menu utilisateur en bas | **Deux colonnes** : rail d'espaces de **80 px** + liste des pages de **232 px** (312 px en tout), filet droit de 1,5 px | Le menu GO-Mat est 132 px plus large. Mannyx n'a pas de liste de pages : chaque module affiche ses pages en **onglets dans la page** |
| **Menu replié** | 58 px, icônes seules (bouton « Réduire le menu », 29 × 29, en haut à droite du menu). À 1 440 px, le tableau de bord passe alors de 4 à 5 colonnes | Bouton « Replier la liste » (35 × 35) en bas du rail : la liste de 232 px se ferme, le rail de 80 px reste | Emplacement du bouton différent (en haut chez Mannyx, en bas chez GO-Mat) |
| **Fond et ombre du menu** | Surface blanche, sans filet, ombre légère `0 1px 3px rgba(0,0,0,.06), 0 1px 8px rgba(0,0,0,.04)` | Surface blanche, filet droit de 1,5 px, sans ombre | Filet au lieu d'ombre |
| **Entrées : police et casse** | **11,7 px / 400, texte saisi en MAJUSCULES** (« DASHBOARD », « BOOKING »…, `text-transform: none`), couleur `--text3` (130,133,143), icône de 14 px, 28 px de haut, padding 6,3 × 9 px, rayon 3,6 px, espace icône-texte 7,2 px | Rail : icône de 22 px + libellé 10,5 px / 600 sous l'icône, 51 px de haut. Liste : **13,5 px / 500 en casse normale**, `--text2`, icône de 16 px, 34 px de haut, padding 7 × 10,5 px, rayon 6 px | Mannyx en majuscules et plus petit (11,7 px) ; GO-Mat en casse normale (13,5 px) |
| **Entrée active** | 600, texte accent, fond accent à **9 %** (rgba 90,70,214,.09) ; sombre : #8672F5 sur accent à 16 % | 600, texte accent sur `--accent-lt` (243,241,253), plus une **barre de 3 px à gauche** (`::before`) | La barre gauche n'existe pas chez Mannyx |
| **Survol** | Fond `--surface2` (246,246,248) et texte `--text` (mesuré par événement de survol) | `hover:bg-gray-100`, texte `--text`, plus un **décalage de 2 px** vers la droite | Mannyx ne décale pas |
| **Menu utilisateur** | **En bas du menu** : bouton de 165 × 49 px (avatar, nom, e-mail), `aria-haspopup="menu"` | **En haut à droite** de la barre : rond aux initiales | Position opposée |
| **Barre du haut** | 50 px, surface, filet bas de 1 px, ombre légère. Contenu : **sélecteur d'événement** à gauche ; cloche (29 × 29, pastille) et bascule de thème (29 × 29) à droite. Pas de recherche, pas de fil d'Ariane | 47 px, surface, filet bas, sans ombre. Contenu : **fil d'Ariane** 13 px (« Magasin › Demandes ») ; à droite, recherche « Rechercher… Ctrl K » (240 × 32, fond `--surface2`, rayon 6), aide « ? », thème, cloche, avatar | Contenu différent : sélecteur de contexte chez Mannyx, fil d'Ariane et recherche chez GO-Mat |
| **Sélecteur d'événement** | Bouton 279 × 31 px, fond `--surface2`, filet, rayon 7,2 px, 12,6 px : pastille, nom en gras, dates en gris, chevron. Menu ouvert : 177 px de large, rayon 5,4 px, ombre `0 4px 12px .08, 0 12px 32px .10`, sections « EN COURS / À VENIR » et « ÉDITIONS PRÉCÉDENTES » (petites majuscules), lignes de 30 px en 11,7 px, lien « Gérer les événements » en pied | Aucun équivalent (GO-Mat n'a qu'un contexte : l'entreprise ; pas de sélecteur de dépôt dans la barre) | — |
| **Fond de page (clair)** | **Dégradé** sur `body` : `radial-gradient(1200px 800px at 100% 0%, accent 5 %, transparent 50%)` + `linear-gradient(135deg, #F5F7FB 0%, #FFFFFF 100%)` (halo violet en haut à droite) | **Uni** rgb(218,219,224) (gris) | Le gris uni de GO-Mat est nettement plus sombre ; pas de dégradé |
| **Fond de page (sombre)** | `radial-gradient(1200px 800px at -10% -20%, accent 8 %, transparent 60%)` + `linear-gradient(135deg, #0B1020, bleu nuit)` | Uni rgb(25,27,33) | Même écart |
| **Police** | Geist partout | Geist partout | — |

## 2. Modèle de page

| Élément | Mannyx | GO-Mat | Écart |
|---|---|---|---|
| **Position de l'en-tête** | Bloc **fixe, hors de la zone qui défile** : le titre, les onglets et la barre de commandes restent en place (titre à y = 65 avant et après 500 px de défilement, sur Offres, Artistes, Contacts, Staff, Notifications) | **Dans la zone qui défile** : le titre part avec le contenu (y = 68 → −274 sur Sorties, → −332 sur Personnes) | **Majeur** : l'en-tête GO-Mat n'est pas fixe |
| **Bloc d'en-tête** | padding 14,4 / 21,6 / 0 ; 52 px (titre seul), 96 px (titre + onglets), 158 px (avec commandes) | Pas de bloc dédié : titre, sous-titre et actions font environ 73 px dans le padding de `main` (21 px) | — |
| **Titre** | `h1` 23,4 px / 700 (26 × 0,9), **majuscules par le style**, espacement −0,936 px (−0,04 em), **trait de 3 px accent sous le titre**, padding bas 9 px, largeur du texte ; interligne 25,7 px | `h1` 26 px / 700, majuscules par le style, −1,04 px (−0,04 em), trait de 3 px accent, 42 px | Identiques au facteur de densité près (GO-Mat a repris ce titre au commit `c32c5aa`) |
| **Icône du titre** | 15 px, couleur `--text`, espacement 7,2 px | 20 px, `--text` | GO-Mat 33 % plus grand (15 × 1/0,9 ≈ 17 px attendus) |
| **Sous-titre** | **Aucun** sous le titre : l'événement est seulement dans la barre du haut | Phrase descriptive 14 px / 400, `--text2`, sous le titre (absente sur Outils et Personnes) | GO-Mat ajoute une phrase que Mannyx n'a pas |
| **Action de module** | Bouton d'icône « Configurer … » (29 × 29) à droite du titre | Bouton principal (« Nouvelle demande », 35 px) à droite du titre | — |
| **Onglets** | Rangée `nav` (« Navigation Booking », « Navigation Staff »…) : liens de **30 px**, **11,7 px / 400 en majuscules par le style**, `--text3`, icône de 13-14 px, padding 7,2 × 12,6 px, sans espace entre onglets. Actif : 600, accent, **trait bas de 2 px accent**. Ce sont les pages du module (Dashboard / Offres / Contrats / Artistes) | **Pas d'onglets de module** : les pages sont dans la liste latérale de 232 px. Les filtres sont des bascules `MxSegmented` (36 / 28 px, 12 px / 700, **casse normale**) ou des boutons pastilles (Demandes : « À préparer (1) », 28 px) | Navigation de module dans la page chez Mannyx, dans le menu chez GO-Mat |
| **2e barre latérale** (Production › Ground, Hospitality) | `nav` « Navigation secondaire » de 164 px à côté du menu (padding 7,2 px), entrées identiques au menu (28 px, 11,7 px majuscules, actif accent 9 %). Ce sont des **boutons**, pas des liens. Ground : Dashboard, Voyages, Missions, Chauffeurs, Véhicules, Shifts | Pas d'équivalent (la liste de 232 px joue ce rôle partout) | — |
| **Ground › Missions** (capture `mx-32`) | `/app/production/ground/missions`, ouverte depuis la 2e barre latérale. Actions de module en haut à droite, au niveau du titre : « Timeline Runs » et « Carte » (31 px, accent plein, 11,25 px / 600, rayon 7,2, icône de lien externe). Barre de commandes : filtres d'état avec compteur (« Toutes 0 », « À planifier 0 », « À dispatcher 0 », « Dispatchées 0 » ; boutons de 28 px, 11 px / 500, rayon 4,7, actif sur fond blanc) ; tri « Urgence / Heure » (25 px) ; « + Ajouter des runs » (accent) ; « Batch Dispatch ». Contenu : liste à gauche (puces de comptage colorées, en-têtes « Artiste / trajet », « Pax/Bag », « État ») et **panneau de carte** à droite (≈ 240 px de large, état vide avec icône). En-tête fixe au défilement. **Remarque** : l'adresse `/app/production/missions`, ouverte directement, affiche une **page blanche** (console : « Maximum update depth exceeded », boucle de rendu React) | Pas d'équivalent direct (le plus proche : Planning ou Transferts) | Défaut de Mannyx relevé au passage |
| **Barre de commandes** | Dans le bloc fixe, contrôles de **31 à 32 px**. Ordre (Artistes) : recherche (560 px) → filtre de statut (162 px) → pagination « ‹ 1 / 3 › » (29 × 29) → taille de page 18 / 36 / 72 (81 px) → bascule cartes / liste en icônes (2 × 28 × 24 px) → **bouton principal à l'extrême droite** (« Ajouter un artiste », 139 × 31). Offres : recherche (837 px) → tri (103 px) → bascule « Qui doit agir / Par jour » → bascule cartes / liste | Sous le titre, dans le contenu qui défile : recherche (34 px) → bascule Grille / Liste (36 px, avec libellés) → tri → « Filtres » (35 px). Le bouton principal est **en haut**, à hauteur du titre | Mannyx : une seule barre, bouton principal à droite. GO-Mat : bouton principal séparé, contrôles de 34-36 px |
| **Bascules** | `radiogroup` 29-32 px, 10,8 px / 700, **majuscules par le style** (« QUI DOIT AGIR », « TOUS (11) ») ; cartes / liste en **icônes seules** (28 × 24 px) | `radiogroup` 36 px, 12 px / 700, **casse normale** ; Grille / Liste avec icône **et** libellé | Casse et libellés différents |
| **Contenu** | `main` sans padding ; les marges viennent des blocs (21,6 px) | `main` padding 21 px | — |

---

## 3. Paires de pages

### 3.1 Tableau de bord (`/app`) ↔ Accueil (`/`)

| Élément | Mannyx | GO-Mat | Écart |
|---|---|---|---|
| En-tête | « TABLEAU DE BORD », icône 15 px, bloc de 52 px, sans sous-titre | Sur-titre « ADMINISTRATEUR » (11 px / 800, `--text3`), titre « BONJOUR, ADMINISTRATEUR », date 14 px en dessous | GO-Mat ajoute un sur-titre de rôle et une date |
| Grille | **8 cartes de module**, **4 colonnes de 295 px**, espacement 14,4 px (5 colonnes, menu replié) | Tuiles d'actions rapides : 4 colonnes de 260 px, espacement 10,5 px, plus une tuile « héros » de 530 px en aplat accent ; dessous, 5 compteurs puis 4 blocs de liste | Mannyx : une grille homogène de modules. GO-Mat : tuiles, compteurs et listes mélangés |
| Carte | `a` 295 × 134, padding 16,2 px, **rayon 9 px**, filet `--border`, élévation 2 (`0 1px 2px .05, 0 2px 10px .05`) | `button` 260 × 92, padding 14 px, **rayon 6 px**, filet, élévation 2 | Rayon 9 contre 6 |
| En-tête de carte | Icône dans un carré teinté accent + titre de module 11,25 px / 700 | Icône dans un carré teinté + titre 16 px / 700 + phrase 12,5 px | GO-Mat plus grand, avec une phrase descriptive |
| Lignes de chiffres | 3 lignes par carte : libellé 11,25 px / 500 `--text3` à gauche, valeur 11,25 px / 600 `--text` alignée à droite | Pas de lignes dans les tuiles ; compteurs séparés (gros chiffre et libellé) | Format différent |
| Sombre | Cartes `--surface` (20,22,29), filet (40,44,55), ombre `.4 / .35` | Mêmes valeurs ; la tuile « héros » est en aplat accent #8672F5 avec texte quasi noir | Identique (hors tuile héros) |
| 390 px | **Non adapté** : le menu de 180 px reste ouvert, la page fait **592 px** de large (défilement horizontal) | Adapté : barre du haut de 61 px, titre sur deux lignes, cartes pleine largeur, barre du bas « Accueil · Scanner · Comptoir · Demandes · Plus » | GO-Mat en avance sur le téléphone |

### 3.2 Offres (`/app/booking/offres`) ↔ Demandes (`/demandes`)

| Élément | Mannyx | GO-Mat | Écart |
|---|---|---|---|
| Navigation | Onglets de module : Dashboard · Lineup / Timeline · **Offres** · Contrats · Artistes | Liste latérale : Comptoir · Scanner · **Demandes** · Sorties… | — |
| Commandes | recherche « Recherche (artiste, scène) » 837 px · tri « Plus récent » · bascule « Qui doit agir / Par jour » · bascule cartes / liste | bascule de filtres en boutons pastilles (« À préparer (1) », « À valider (0) », « Sorties (0) », « Toutes (10) », 28 px) · recherche 705 px | Les filtres GO-Mat sont des boutons, pas un `radiogroup` |
| Organisation | **Groupes repliables et étapes** : « IDÉES 3 » (accordéon pleine largeur), section « À TRAITER PAR VOUS » avec sous-groupes par étape (« Prêtes à envoyer 2 ») dans des encadrés `--surface2` | Liste plate de lignes-cartes, sans groupe | Mannyx regroupe par étape et par responsable de l'action |
| Carte | 192 × 169 px, **6 colonnes**, espacement 10,8 px ; fond `--surface2`, filet 1 px, **bord haut de 3 px à la couleur de l'étape**, rayon 7,2 px, padding 10,8 px ; avatar rond, nom 11,25 px / 700 majuscules, pastille d'état, **barre de progression en 4 segments**, menu « ⋮ » (29 × 29) | Ligne-carte pleine largeur (1 086 × 90) : numéro, badge d'état, demandeur et chantier, dates alignées à droite | Formes très différentes |
| État vide | « Rien à traiter pour l'instant » 12,15 px / 700, icône dans une pastille, raccourcis en puces | Phrase simple | — |
| Sombre | Cartes (27,30,39), bord haut coloré conservé, bascules sur `--surface2` sombre | Lignes `--surface` sombre, filtres accent | — |
| 390 px | Non adapté : 794 px de large, menu ouvert | Adapté : titre, bouton plein, filtres sur deux lignes, cartes pleine largeur | — |

### 3.3 Contacts personnes (`/app/contacts/personnes`) ↔ Personnes (`/users`)

| Élément | Mannyx | GO-Mat | Écart |
|---|---|---|---|
| Onglets | « PERSONNES » · « ENTREPRISES » (onglets de module) | Aucun ; Permis et EPI sont dans la liste latérale | — |
| Commandes | recherche 252 px · « Filtres » (70 × 32) · compteur « N contacts » sous la barre · bouton principal « Ajouter un contact » · bascule liste / grille en icônes 22 × 29 | bascule Grille / Liste (36 px) · « Filtres » · « Imprimer les badges » · bouton principal « Ajouter une personne » ; pas de compteur | GO-Mat n'affiche pas le nombre |
| Vue par défaut | **Tableau** : Photo · Nom ▼ · Type ▼ · Département ▼ · Fonction · Email ▼ · Téléphone ▼ · Entreprises ▼ · Actions | **Grille de cartes** 4 colonnes (252 × 276, espacement 21 px) : avatar à initiales, nom 15,75 px / 900, rôle 12,25 px / 700 en majuscules, état, coordonnées, 4 boutons (QR code, Modifier, Départ, Supprimer) | Tableau contre cartes |
| Tableau | Lignes de **51 px** ; en-têtes **9,45 px / 500 en majuscules**, espacement 0,47 px, gris (107,114,128), **sans fond**, 31 px, tri par en-tête (▲ ▼) ; cellules 12,6 px, padding 9,45 × 12,6 px ; actions : crayon et poubelle (31 × 32, rayon 4,7 px). Pas de pagination (défilement). **Le tableau fait 1 525 px et déborde de la zone de 1 260 px** (défilement horizontal) | Vue **Liste** (capture `gm-25`) : colonnes Nom · Email · Téléphone · Département · Rôle · Actions ; en-têtes **11 px / 700 majuscules**, 0,66 px, `--text3`, **fond `--surface2`**, 36 px, sans tri ; cellules 13 px, padding 14 × 21 px ; avatar à initiales devant le nom ; rôle 12,25 px / 700 en majuscules avec l'état dessous. **Défaut** : le tableau fait 1 115 px pour un conteneur de 1 041 px ; la colonne Actions est écrasée et coupée à droite. Ses 4 boutons (« QR code » 91 × 28, Modifier, Départ, Supprimer 36 × 28) s'empilent verticalement, et chaque ligne monte à **141 px** au lieu d'environ 50 | Mannyx : lignes de 51 px, actions en 2 icônes. GO-Mat : lignes de 141 px, actions coupées |
| Sombre | En-têtes (151,161,190), cellules (231,236,248), fond de page en dégradé | Cartes `--surface` sombre, filet (40,44,55) | — |

### 3.4 Artistes (`/app/artistes`) ↔ Outils (`/equipment`)

| Élément | Mannyx | GO-Mat | Écart |
|---|---|---|---|
| Commandes | recherche 560 · statut 162 · **pagination** « ‹ 1 / 3 › » (10,35 px / 500) · taille de page (18 / 36 / 72) · cartes / liste en icônes · « + Ajouter un artiste » à droite | Importer · Exporter · « Ajouter un équipement » (en haut) ; dessous : recherche 661 · Grille / Liste · tri « Nom » · A→Z · Filtres | Pas de pagination ni de taille de page dans GO-Mat |
| Grille | **6 colonnes** de 192 px, espacement 10,8 px ; 72 cartes par page | **4 colonnes** de 256 px, espacement 21 px | GO-Mat 2 fois moins dense |
| Carte | 192 × 132, padding 14,4 px, **rayon 9 px**, filet, **sans ombre** ; **photo ronde de 79 px** centrée, nom 11,25 px / 700 en majuscules, menu « ⋮ » 29 × 29 en haut à droite | 256 × 262, padding 17,5 px, **rayon 6 px**, filet transparent, élévation 2 ; vignette carrée de 64 px à gauche, nom 16 px / 700, badges « STOCK » / « DISPONIBLE » 10,5 px / 700 en majuscules, **5 boutons d'icône (34 × 28) sur deux rangées** | Mannyx regroupe les actions dans un menu « ⋮ » ; GO-Mat les affiche toutes |
| 390 px | Non adapté | 1 colonne pleine largeur, boutons de 44 px, barre du bas | — |

### 3.5 Bénévoles (`/app/staff/benevoles`) ↔ Sorties (`/checkouts`)

| Élément | Mannyx | GO-Mat | Écart |
|---|---|---|---|
| Onglets | Dashboard · **Staff** · Shift/Planning · Campagnes · Prestataires · Communications · Exports | Aucun | — |
| Commandes | recherche 252 · « Filtres » · « + Nouveau staff » (107 × 32) · liste / grille en icônes (22 × 29) | recherche 224 · « Mettre à jour les statuts » · « Nouvelle sortie » · bascule Grille / Liste / Équipements (36 px) | — |
| Tableau | Lignes de **63-64 px** (avatar), en-têtes **9,45 px / 500 majuscules**, gris, **sans fond**, 31 px, tri (▲) ; cellules 12,6 px, padding 9,45 × 12,6 px ; actions crayon / poubelle en icônes | Lignes de **65 px** ; en-têtes **11 px / 700 majuscules**, espacement 0,66 px, `--text3`, **fond `--surface2`**, 36 px, tri (⇅) ; cellules 13 px, padding 14 × 21 px ; action : bouton texte « Détails / retour » | En-têtes GO-Mat plus gros et sur fond gris ; action en bouton texte au lieu d'icônes |
| Conteneur | Carte blanche, filet, rayon 9 px | Carte blanche, filet, rayon 6 px | — |
| Sombre | En-têtes (151,161,190) sans fond | En-têtes `--text3` sur (27,30,39) | — |

### 3.6 Notifications (`/app/notifications`) ↔ Notifications (`/notifications`)

| Élément | Mannyx | GO-Mat | Écart |
|---|---|---|---|
| En-tête | Titre + **compteur « N notifications » à droite**, pas de bouton | Titre, sous-titre, ligne d'état « Notifications sur le téléphone : … » ; boutons « Tout marquer comme lu » et « Actualiser » (35 px) | — |
| Commandes | recherche 575 · bascule **TOUTES / NON LUES / ARCHIVÉES** (`radiogroup` 29 px, majuscules) · « Toutes les catégories » · « Toutes les sévérités » · menu « Actions » (31 px) | Bloc « Alertes (8) » avec liens, puis boutons pastilles « Toutes (1) », « Non lues (1) », « Lues (0) », « Sorties (0) »… (mx-btn 12,5 px) | Mannyx : un `radiogroup` et des listes déroulantes ; GO-Mat : 6 boutons |
| Liste | Une carte contenant des **lignes de 72 px** ; ligne non lue sur **fond accent à 9 %** ; icône de sévérité en couleur, titre 11,25 px / 700, texte 10,35 px / 500 `--text3`, actions **en icônes** (« Marquer comme lu », « Archiver », 29 × 29) | Deux blocs : « Alertes » (lignes de texte + bouton texte « Marquer comme lu », 28 px) et notifications système en cartes séparées, **bord gauche accent**, titre en majuscules saisies (« SYSTÈME DE NOTIFICATIONS ACTIF »), boutons texte « Marquer comme lue » et « Supprimer » | Actions en icônes chez Mannyx, en texte chez GO-Mat ; deux modèles de liste chez GO-Mat |
| Sombre | Lignes non lues sur accent sombre, fond en dégradé | Cartes `--surface` sombre, bord gauche accent | — |

### 3.7 Paramètres (`/app/settings/general`) ↔ Paramètres (`/settings`)

| Élément | Mannyx | GO-Mat | Écart |
|---|---|---|---|
| Navigation | **12 onglets de module** (Général, Événements, Artistes, Booking, Administration, Production, Presse, Contacts, Staff, Mail, Notifications, Compte). **Ils débordent à 1 440 px** : la page défile horizontalement et la cloche de la barre du haut est coupée | Une seule page, **11 sections repliables** (accordéon MX : en-tête de 49 px, titre 14 px / 700, filet accent à l'ouverture), plus Santé des données et Démarrage dans la liste latérale | Mannyx : une page par domaine en onglets. GO-Mat : tout dans une page à accordéons |
| Contenu | Titre de section « PARAMETRES GENERAUX » 14,2 px / 600 en majuscules ; **cartes de rayon 12 px** (filet slate 226,232,240) : « Langue » (FR / EN), « Thème » (Clair / Sombre, bouton actif violet plein), « Logo » | Cartes internes au rayon 6 px ; champs 34 px ; boutons « Sauver » à droite de chaque champ | Les cartes de Paramètres Mannyx sont d'une génération antérieure (rayon 12, violet #7C3AED) |

### 3.8 Drawers

| Élément | Mannyx : fiche (offre) | Mannyx : formulaire (« Ajouter un artiste ») | GO-Mat : fiche (demande) | GO-Mat : formulaire (« Ajouter du matériel ») | Écart |
|---|---|---|---|---|---|
| Largeur | **612 px** (680 × 0,9) | 612 px | **680 px** | 680 px | Même taille de base ; densité seulement |
| Ombre | `-28px 0 64px rgba(0,0,0,.45)` | idem | idem | idem | — |
| En-tête | 90 px, padding 21,6 / 21,6 / 14,4 ; titre 23,4 px / 700 / −0,47 px, casse normale ; **sous-titre** (jour · scène · heure) ; bouton « » » (29 × 29) en haut à droite, sans croix | 65 px, titre seul | 72 px, padding 24 / 24 / 16 ; titre 26 px / 700 / −0,52 px ; bouton « » » (32 × 32) | 72 px | GO-Mat sans sous-titre dans l'en-tête de fiche |
| Corps | `[data-mx-scroll]`, padding 21,6 / 21,6 / 7,2 ; sections avec icône + titre ; bascules `radiogroup` (durée 60 / 75 / 90…) | idem ; champs de 31 px, 11,25 px / 500, rayon 5,4 px | `[data-mx-scroll]`, padding 20 / 24 / 8 | champs de 34 px, 12,5 px / 500, rayon 6 px ; accordéons | Proportionnel à la densité |
| Pied | **Bloc séparé, toujours ancré en bas** (enfant flex du drawer), filet haut de 1 px, padding 14,4 / 21,6 / 19,8. Fiche : **104 px sur deux rangées** : actions (« Annuler », « Passer en Offre à faire », « Établir l'offre »), danger (« Clore », « Supprimer », rouge plein), puis « Enregistrer » seul à droite | 66 px : « Annuler » et « Enregistrer » **alignés à droite**, largeur selon le texte | Pied **collant dans la zone qui défile**. Fiche : 99 px ; **quand le contenu est court, le pied flotte au milieu** (y = 648 sur 900) au lieu d'être en bas. « Annuler la demande » en texte rouge à gauche, « Liste de préparation », « Marquer prête », « Sortir » (primaire) à droite | 78 px, ancré en bas : « Annuler » (80 px) + « Suivant » **étiré** (497 px) | Pied de fiche GO-Mat non ancré ; bouton principal étiré dans GO-Mat, pas dans Mannyx |
| Boutons de pied | **31 px**, rayon 7,2 px (8 × 0,9), 11,25 px / 600, padding 0 × 10,8 px, **sans `flex-grow`** | idem | **45 px**, rayon 8 px, 12,5 px / 600, padding 12 × 16 px | idem, primaire en `flex-grow` | Boutons GO-Mat 45 px contre 31 px (le gabarit `.mx-dr-btn` de la charte donne environ 41-45 px : Mannyx s'en écarte) |
| Formulaires « nouveau » en modale | « Nouveau contact » et « Nouveau staff » s'ouvrent en **modale centrée de 800 px** (rayon 16 px, ombre `0 24px 40px`, titre 15,75 px / 700 en majuscules, champs de 32 px au rayon 8, boutons violet #7C3AED) : composant d'une génération antérieure | — | Toujours en drawer | — | Mannyx est hétérogène sur ce point |

---

## 4. Composants Mannyx observés

Mannyx pose ses styles en ligne : presque aucune classe CSS. Les composants se reconnaissent à leurs attributs.

| Repère dans le DOM | Composant (nom probable) | Rôle |
|---|---|---|
| `aside` fixe + `nav[aria-label="Navigation principale"]` | Menu principal (MxSidebar) | 10 modules, repliable à 58 px (`localStorage['sidebar-collapsed']`) |
| `button[aria-label="Reduire le menu"]` / `"Ouvrir le menu"` | Bouton de repli | Bascule 180 ↔ 58 px |
| `button[aria-controls="user-menu-switcher"][aria-haspopup="menu"]` | Menu utilisateur | Bas du menu : profil et déconnexion |
| `button[aria-controls="event-switcher-menu"]` + `[role=menu][aria-label="Sélection de l'événement"]` | Sélecteur d'événement | Contexte global (édition du festival), dans la barre du haut |
| `header` (50 px) | Barre du haut | Événement, notifications (`aria-label="Notifications, N non lues"`), thème |
| `nav[aria-label="Navigation Booking"]`, `"Navigation Staff"`… | Onglets de module (MxModuleTabs) | Pages du module, trait bas accent de 2 px |
| `nav[aria-label="Navigation secondaire"]` (164 px) | 2e barre latérale | Sous-pages de Ground et Hospitality |
| `h1` majuscules + trait de 3 px + icône de 15 px | En-tête de module (MxModuleHeader) | Fixe, hors de la zone qui défile |
| `[role=radiogroup]` + `[role=radio][aria-checked]` | Bascule segmentée (MxSegmented, `.vt`) | Cartes / liste, filtres d'étape, durée ; libellés en majuscules |
| `[role=button][data-mx-focus]` (carte avec bord haut coloré) | Carte d'entité (MxEntityCard) | Offres, contrats ; bord haut à la couleur de l'étape, barre de progression segmentée |
| `button[aria-label^="Actions pour …"]` (29 × 29) | Menu d'actions « ⋮ » | Actions de la carte |
| `[role=dialog][aria-modal=true]` + `header` + `[data-mx-scroll]` + pied | Drawer (MxDrawer) | Fiche et formulaire, 680 × 0,9 px |
| `[aria-expanded]` pleine largeur (« IDÉES 3 ») | Groupe repliable | Regroupement par étape |
| `table` à en-têtes 9,45 px avec ▲ / ▼ | Tableau triable | Contacts, staff, chauffeurs |
| `.mx-kv` | Ligne clé / valeur | Lignes de chiffres du tableau de bord |
| `[data-mx-focus]` (769 éléments) | Marqueur d'anneau de focus | Sur tous les éléments activables |
| `[data-mx-scroll]` | Zone défilante de drawer | Corps des drawers |
| `html[data-theme][data-density="compact"]` | Thème et densité | `--mx-scale: 0.9` |
| Modale centrée de 800 px (« NOUVEAU CONTACT ») | Ancienne modale | Formulaires de Contacts et Staff, génération antérieure |

## 5. Synthèse des écarts à traiter

1. **Coque.**
   - Menu d'une colonne de 180 px (avec onglets de module dans la page), au lieu de 80 + 232 px.
   - Entrées en majuscules 11,7 px ; actif sur accent à 9 %, sans barre gauche.
   - Menu utilisateur en bas du menu.
2. **Fond de page.** Dégradé clair (halo violet en haut à droite sur #F5F7FB → #FFF) au lieu du gris uni rgb(218,219,224).
3. **En-tête de module fixe.** Titre, onglets et commandes hors de la zone qui défile. Chez GO-Mat, tout défile.
4. **Barre de commandes unique.** Contrôles de 31-32 px, bouton principal à l'extrême droite de la même ligne, bascule cartes / liste en icônes seules, pagination et taille de page.
5. **Densité.** Mannyx est en `compact` (×0,9) : titre 23,4 px, drawer 612 px, boutons de pied de 31 px. À trancher : reproduire la densité compacte, ou garder l'échelle 1 et ne comparer qu'à valeur de base égale.
6. **Cartes.** Rayon 9 px (contre 6), 6 colonnes à 1 440 px pour les entités à photo, actions dans un menu « ⋮ ».
7. **Tableaux.** En-têtes 9,45 px / 500 sans fond, lignes de 51 px, actions en icônes. Dans GO-Mat, la vue Liste de Personnes déborde : colonne Actions coupée, lignes de 141 px.
8. **Drawers.** Pied toujours ancré en bas (GO-Mat : pied de fiche qui flotte si le contenu est court), boutons de pied non étirés, sous-titre sous le titre de la fiche.
9. **À ne pas copier.**
   - Mannyx **n'est pas adapté au téléphone** : en 390 px, la page fait 592 à 794 px et le menu reste ouvert. GO-Mat l'est.
   - Paramètres et Contacts de Mannyx contiennent des composants d'une génération antérieure (violet #7C3AED, rayons de 12-16 px, modales centrées).
   - Les 12 onglets de Paramètres débordent à 1 440 px.

## 6. Captures

### Mannyx (`captures/mannyx/`)

| Fichier | Contenu |
|---|---|
| `mx-01-tableau-de-bord.jpg` | Tableau de bord, clair, 1 440 px |
| `mx-02-selecteur-evenement.jpg` | Sélecteur d'événement ouvert |
| `mx-03-menu-replie.jpg` | Menu replié (58 px), tableau de bord en 5 colonnes |
| `mx-04-offres.jpg` | Booking › Offres (groupes, étapes, cartes) |
| `mx-05-contrats.jpg` | Booking › Contrats |
| `mx-06-artistes.jpg` | Artistes (cartes à photo, 6 colonnes, pagination) |
| `mx-07-budget-artistique.jpg` | Finances › Budget artistique |
| `mx-08-finances.jpg` | Finances › Finances |
| `mx-09-billetterie.jpg` | Billetterie (ancien en-tête) |
| `mx-10-production.jpg` | Production › Dashboard |
| `mx-11-ground-chauffeurs.jpg` | Ground › Chauffeurs (2e barre latérale) |
| `mx-12-hospitality-catering.jpg` | Hospitality › Catering (2e barre latérale) |
| `mx-13-accreditation.jpg` | Accréditation (ancien en-tête) |
| `mx-14-presse.jpg` | Presse |
| `mx-15-contacts-personnes.jpg` | Contacts › Personnes (tableau) |
| `mx-16-contacts-entreprises.jpg` | Contacts › Entreprises |
| `mx-17-staff-benevoles.jpg` | Staff › Staff (bénévoles) |
| `mx-18-staff-planning.jpg` | Staff › Shift / Planning (état vide) |
| `mx-19-staff-campagnes.jpg` | Staff › Campagnes |
| `mx-20-parametres.jpg` | Paramètres › Général (onglets qui débordent) |
| `mx-21-notifications.jpg` | Notifications |
| `mx-22-drawer-fiche-offre.jpg` | Drawer de fiche (offre) |
| `mx-23-modale-nouveau-contact.jpg` | « Nouveau contact » (modale centrée) |
| `mx-24-drawer-ajouter-artiste.jpg` | Drawer de formulaire « Ajouter un artiste » |
| `mx-25-sombre-tableau-de-bord.jpg` | Tableau de bord, sombre |
| `mx-26-sombre-offres.jpg` | Offres, sombre |
| `mx-27-sombre-contacts-personnes.jpg` | Contacts personnes, sombre |
| `mx-28-sombre-staff-benevoles.jpg` | Bénévoles, sombre |
| `mx-29-sombre-notifications.jpg` | Notifications, sombre |
| `mx-30-390-tableau-de-bord.jpg` | Tableau de bord en 390 px (débordement) |
| `mx-31-390-offres.jpg` | Offres en 390 px (débordement) |
| `mx-32-ground-missions.jpg` | Ground › Missions (filtres d'état, liste, panneau de carte) |

### GO-Mat (`captures/gomat/`)

| Fichier | Contenu |
|---|---|
| `gm-01-accueil.jpg` | Accueil, clair, 1 440 px |
| `gm-02-comptoir.jpg` | Magasin › Comptoir |
| `gm-03-demandes.jpg` | Magasin › Demandes |
| `gm-04-sorties.jpg` | Magasin › Sorties (tableau) |
| `gm-05-outils.jpg` | Matériel › Outils (cartes) |
| `gm-06-kits.jpg` | Matériel › Kits |
| `gm-07-consommables.jpg` | Consommables |
| `gm-08-vehicules.jpg` | Véhicules |
| `gm-09-locations.jpg` | Locations (montants floutés) |
| `gm-10-chantiers.jpg` | Chantiers |
| `gm-11-personnes.jpg` | Personnes (cartes, e-mails floutés) |
| `gm-12-pilotage.jpg` | Pilotage |
| `gm-13-parametres.jpg` | Paramètres (accordéons) |
| `gm-14-notifications.jpg` | Notifications |
| `gm-15-drawer-fiche-demande.jpg` | Drawer de fiche (demande) : le pied flotte au-dessus du bas |
| `gm-16-drawer-ajouter-equipement.jpg` | Drawer de formulaire « Ajouter du matériel » |
| `gm-17-sombre-accueil.jpg` | Accueil, sombre |
| `gm-18-sombre-demandes.jpg` | Demandes, sombre |
| `gm-19-sombre-personnes.jpg` | Personnes, sombre |
| `gm-20-sombre-sorties.jpg` | Sorties, sombre |
| `gm-21-sombre-notifications.jpg` | Notifications, sombre |
| `gm-22-390-accueil.jpg` | Accueil en 390 px |
| `gm-23-390-demandes.jpg` | Demandes en 390 px |
| `gm-24-390-outils.jpg` | Outils en 390 px |
| `gm-25-personnes-liste.jpg` | Personnes en vue Liste : colonne Actions coupée, lignes de 141 px (e-mails floutés) |
