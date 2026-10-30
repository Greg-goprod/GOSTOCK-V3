# Audit visuel de conformité à la charte Mannyx (MX)

- **Date** : 30 octobre 2026, de 16:35 à 17:00 (heure de Zurich)
- **Version** : `765ae37` « Charte Mannyx de référence et consignes d'audit visuel » de `claude/loving-thompson-6zfo06`.
- **Consignes** : `docs/tests/consignes-audit-da.md`. Aucun fichier de l'application n'a été modifié.
- **Références ouvertes dans le navigateur** : `docs/charte-mx/handoff-mannyx-ds/reference/Mannyx Components V2.html` (valeurs calculées relevées sur le catalogue lui-même), avec `reference/mannyx-drawer.js`, `README.md`, `LISEZ-MOI-EN-PREMIER.md` et les doctrines.

## Méthode

- **Site audité** : le navigateur de test refuse les adresses externes ; go-stock.netlify.app (qui répond 200) n'a donc pas pu être ouvert directement. L'audit porte sur **le même code servi en local** (`GOMAT-essai`, détaché sur `765ae37` ; aucune différence dans `src`, `public` ni `index.html` avec `48b8165`, la version publiée). Le rendu de développement de Vite peut différer de la version compilée sur l'ordre des feuilles de style, pas sur les valeurs.
- **Mesures** : sondes JavaScript sur les styles calculés (`getComputedStyle`) de chaque page. Elles relèvent la police, le titre de page, les titres, les boutons, les champs, les cartes, les accordéons, les icônes, les couleurs hors tokens (comparées aux variables `--mx-*` résolues) et les textes saisis en majuscules. Elles relèvent aussi les contrastes WCAG (en sombre) et la géométrie des drawers.
- **Conditions** : bureau 1440 × 900 en clair puis en sombre (administrateur) ; drawers mesurés en Responsable (droits proches de l'administrateur, hors Paramètres) ; pages terrain en 390 × 844.
- **Écran à densité 1** : un filet de 1,5 px s'affiche à 1 px, sur le catalogue comme sur GO-Mat. Les épaisseurs sont donc comparées à valeur affichée égale, et ne sont pas relevées comme écart.
- **Décisions projet respectées** (LISEZ-MOI-EN-PREMIER) : l'échelle typographique du tronc prime **seulement** quand le handoff est plus grand ou plus gras. Le contour de focus à 1 px est conforme à la décision.
- **Limites** : la session administrateur ne pouvait pas afficher les drawers dans un onglet masqué ; ils ont été mesurés dans l'onglet affiché, en Responsable. Les captures sont petites (le panneau du navigateur est étroit) ; les valeurs font foi. Les survols et les états d'appui n'ont pas été mesurés, faute de pointeur réel.

## Ce qui est conforme

- **Police** : Geist partout (183 éléments sur Paramètres, aucune autre police), sauf les contrôles de la carte Leaflet (DA30).
- **Titre de page** : `mx-page-title` 52 px / 700 / −2,6 px (−0,05 em), interligne 0,95, sans majuscules, sur toutes les pages sauf Statistiques et l'écran TV (DA24). 30 px en 390 px, conforme au plancher.
- **Drawer** : titre 26 px / 700 / −0,52 px (−0,02 em) ; en-tête 24 / 24 / 16 px ; ombre `-28px 0 64px rgba(0,0,0,.45)`. Largeurs 680 px (fiche de demande, ajout d'outil, ajout de personne), 520 px (aide « ? ») et 420 px (confirmation), dans l'échelle 360 / 420 / 520 / 680. Pied collant sur les formulaires.
- **Cartes** (`mx-card`) : surface, filet, rayon 6 px, élévation 2 (`0 1px 2px …, 0 2px 10px …`), identiques au catalogue.
- **Toasts** : surface, filet, rayon 6 px, élévation 4.
- **Libellés de champ** : 12,5 px / 600, `--text2`.
- **Sélecteurs de date et d'heure** : composants MX partout. Aucun champ natif `date`, `time` ni `datetime-local` sur les 41 pages.
- **Sous-titres de section** (Aide, réception de location) : 11 px / 800 / 0,14 em, majuscules par le style, `--text3`, comme `subsection-title`.
- **Icônes** : Lucide, 18 et 20 px, trait de 2.
- **Pastilles d'étapes de l'Aide** : accent, 24,5 px, rondes.

## Synthèse par page

Les écarts **transversaux** DA1 (libellé des boutons), DA9 (gris intermédiaires) et DA15 (graisse des champs) touchent presque toutes les pages. Ils ne sont pas répétés dans ce tableau.

| Page | Résultat | Écarts propres à la page |
|---|---|---|
| **Paramètres** (`/settings`) | **majeurs** | DA6 (11 sections repliables), DA7, DA8, DA12, DA16 |
| **Aide** (`/aide`, article, drawer « ? », imprimable) | mineurs | DA13, DA16, DA25 |
| Accueil (admin, magasinier, collaborateur) | mineurs | DA3 (tuiles-boutons 14 px / 400), DA11 |
| Recherche | mineurs | DA3, DA4 |
| Notifications | mineurs | DA8 |
| Mon badge | conforme (hors transversal) | — |
| **Comptoir** | **majeurs** | DA5, DA8, DA18 |
| Scanner | mineurs | DA3, DA8, DA18 |
| **Demandes** (+ drawers) | **majeurs** | DA19, DA21, DA22, DA23 |
| **Sorties** | **majeurs** | DA5, DA10, DA27 |
| **Libre-service** | **majeurs** | DA5, DA8, DA18 |
| **Transferts** | **majeurs** | DA5 |
| Emplacements | conforme (hors transversal) | — |
| Inventaire | mineurs | DA8, DA16, DA18 |
| Écran TV | mineurs | DA3, DA16, DA24 (pas de titre : mode plein écran) |
| **Outils** (+ drawer d'ajout) | **majeurs** | DA6, DA8, DA17, DA20 |
| Kits | mineurs | DA12 |
| Entretien | conforme (hors transversal) | — |
| **Atelier** | **majeurs** | DA5 |
| Pertes et casse | conforme (hors transversal) | — |
| Étiquettes | conforme (hors transversal) | — |
| Consommables | conforme (hors transversal) | — |
| À commander | conforme (hors transversal) | — |
| Commandes | conforme (hors transversal) | — |
| **Véhicules** | **majeurs** | DA10, DA11 |
| **Chantiers** | **majeurs** | DA5 |
| Carte | mineurs | DA30 |
| **Planning** | **majeurs** | DA5, DA3 |
| **Locations** (+ drawer de réception) | **majeurs** | DA5, DA19, DA21 |
| Personnes (+ drawer) | mineurs | DA8, DA17, DA21 |
| Permis et formations | mineurs | DA9 (54 éléments) |
| EPI | conforme (hors transversal) | — |
| Pilotage | mineurs | DA9 |
| **Statistiques** | **majeurs** | DA24, DA4, DA10, DA8 |
| Coûts | mineurs | DA13 |
| Comptabilité | conforme (hors transversal) | — |
| Journal | mineurs | DA9 (100 éléments) |
| Santé des données | mineurs | DA6 (lignes repliables), DA12 |
| Démarrage | conforme (hors transversal) | — |
| Page de connexion | mineurs | DA16 |
| Confirmations (`confirmAction`) | mineurs | DA2, DA9 |
| Toasts | mineurs | DA29 |
| Thème sombre (toutes pages) | **majeurs** | DA10, DA11 |
| Téléphone 390 px (pages terrain) | mineurs | DA27, DA28 |

---

## Écarts, regroupés par composant à corriger

Gravité : **majeur** = visible au premier coup d'œil ; **mineur** = détail.

### A. Bouton — `src/components/common/Button.tsx`

**DA1 — MAJEUR — Libellé des boutons en 10,5 px sur grand écran** (toutes les pages)
- **Attendu** : libellé 12,5 px / 600, hauteur actuelle du tronc (LISEZ-MOI-EN-PREMIER, tableau « Libellé de bouton » ; catalogue `.btn` 13 px / 600, padding 7 × 14 px, soit 31 à 33 px de haut).
- **Constaté** : `mx-btn` en **10,5 px** / 600 (parfois 700), 27 à 31 px de haut : par exemple « Sauver » et « Importer Excel » (Paramètres), « Envoyer la demande », « Annuler », « Recevoir un code ». Le handoff étant **plus grand** que 10,5 px et le tronc à 12,5 px, c'est 12,5 px qui s'applique.
- **Cause** : `Button.tsx`, tailles `sm` et `md` : `text-sm lg:text-xs` ; avec `html { font-size: 14px }`, `text-xs` vaut 10,5 px. 378 utilisations, dont 181 en `size="sm"`.

**DA2 — MAJEUR — Boutons de pied de drawer : rayon 4 px, 27 px de haut**
- **Attendu** : `mannyx-drawer.js`, `.mx-dr-btn` : rayon **8 px**, padding 12 × 16 px, primaire en `flex-grow` ; pied `.mx-dr-foot` 16 / 24 / 22 px, filet de 1,5 px (README, « Rayons » : 8 px pour les boutons de drawer). Taille du texte selon le tronc (12,5 px / 600).
- **Constaté** : « Annuler » et « Envoyer la demande », « Suivant », « Enregistrer », « Enregistrer la réception », « Supprimer » (confirmation) : rayon 4 px, 27 px de haut, 10,5 px / 600, largeur selon le contenu.

**DA3 — MINEUR — Boutons écrits à la main, hors du composant**
- **Attendu** : variantes `mx-btn` (primaire, secondaire, fantôme, danger), rayon 4 px.
- **Constaté** : Recherche « Chercher » (44 px, rayon 6 px, 14 px / 400) ; Planning « Semaine précédente » et suivante (40 px, 14 px / 400) ; Écran TV « Plein écran » (37 px, 14 px / 400) ; « Scanner avec la caméra » (Comptoir, Scanner, Libre-service, Inventaire : 44 px, rayon 6 px, 12,25 px / 500) ; Aide imprimable « Imprimer ou enregistrer en PDF » (35 px, 14 px / 600) ; tuiles de l'Accueil (boutons de 92 px en 14 px / 400).

**DA4 — MINEUR — Puces et gros boutons ronds**
- **Attendu** : chips au rayon 4 px (README, « Rayons ») ; pas de bouton circulaire dans le catalogue.
- **Constaté** : suggestions de la Recherche (« qui a la meule 230 ? »…) en pilules de 23 px, rayon 9999 px, 10,5 px / 400 ; Statistiques : deux boutons ronds de 112 px « Sortie » (vert) et « Retour » (ambre), en couleurs non tokens (voir DA10). Capture `captures/da/da-03-statistiques-sans-titre.jpg`.

### B. Bascule et onglets segmentés — un composant `MxSegmented` / bascule liste-grille

**DA5 — MAJEUR — Onglets segmentés hors charte, et blanc sur accent en sombre**
- **Attendu** : catalogue `#s-viewtoggle`, `.vt` : conteneur `--surface2`, filet 1,5 px, rayon 6 px, padding 3 px ; boutons 12 px / 700, padding 6 × 11 px, rayon 4 px ; l'option active est une **vignette `--surface` avec texte `--accent`**, pas un aplat. LISEZ-MOI : sémantique `radiogroup` (flèches, tabindex itinérant).
- **Constaté** : « Auto / Sortie / Retour » (Comptoir), « Prendre / Rendre » (Libre-service), « En route / Historique » (Transferts), « Réparations / Garanties » (Atelier), « En cours / Clôturés » (Chantiers), « En cours / Historique » (Locations), « Véhicules / Outils » (Planning), « Grille / Liste / Équipements » (Sorties) : boutons de 40 à 44 px, **rayon 0**, 12,25 px / 600, option active en **aplat accent avec texte blanc**. En sombre, ce blanc sur `#8672F5` donne **3,66:1** (voir DA11).
- **Captures** : `captures/da/da-04-sorties-390-bascule-et-tableau.jpg` (GO-Mat), `captures/da/da-02-reference-accordeon-et-bascule.jpg` (référence).

### C. Accordéon — `src/components/common/Accordion.tsx` et `AccordionCard.tsx`

**DA6 — MAJEUR — Sections repliables de Paramètres et des formulaires : ancien composant, pas l'accordéon MX**
- **Attendu** : catalogue `#s-accordion` (valeurs mesurées sur la référence) :
  - conteneur filet 1,5 px `--border`, rayon 6 px, fond `--surface` ;
  - en-tête de 46 px, padding 14 × 16 px, titre 14 px / 700 / −0,01 em en casse normale, icône `--text3` ;
  - ouvert : filet `inset 3px 0 0 --accent`, icône et chevron en `--accent`, chevron tourné de 180° ;
  - mode séparé : 8 px entre éléments, élément ouvert bordé d'accent ;
  - focus `outline` 1 px vers l'intérieur (écart assumé).
- **Constaté** :
  - **Paramètres**, 11 sections (« PARAMÈTRES SYSTÈME », « NOTIFICATIONS PAR E-MAIL ET SMS », « OUTIL TROUVÉ (PAGE PUBLIQUE) », « SAUVEGARDE », « CATALOGUES FOURNISSEURS », « CATÉGORIES (0) », « FOURNISSEURS (1) »…) : en-tête de **41 px**, padding 10,5 px, titre **12,25 px / 700 saisi en MAJUSCULES**, fond **transparent**, aucun filet d'accent une fois ouvert, icône de section en couleurs variées (accent, vert `#0F9D6E`, ambre), chevron en gris non token (107,110,120), **21 px** entre les sections.
  - **Drawer d'ajout d'outil** : « INFORMATIONS DE BASE », « CONFIGURATION QR CODES » : en-tête de 39 px, rayon 0, titre 12,25 px / 700 en majuscules saisies.
  - **Santé des données** (lignes repliables de 39 et 53 px, rayon 0, 14 px / 400), **Coûts** et **Planning** (lignes dépliables) : même famille, hors charte.
- **Capture** : `captures/da/da-01-parametres-accordeons.jpg`, à comparer à `captures/da/da-02-reference-accordeon-et-bascule.jpg`.

**DA7 — MINEUR (accessibilité) — En-têtes repliables sans `aria-expanded`**
- **Attendu** : bouton d'en-tête qui annonce son état (catalogue : `.acc-head` + `.is-open` ; un lecteur d'écran doit entendre « développé / réduit »).
- **Constaté** : sur Paramètres, les boutons d'en-tête n'ont pas d'attribut `aria-expanded` (relevé : `null`).

### D. Majuscules saisies dans le texte

**DA8 — MINEUR — Textes écrits en MAJUSCULES au lieu d'un style**
- **Attendu** : casse normale dans le texte. Les majuscules sont un **style** réservé à certains rôles : titre de section (`section-title`), sous-titre (`subsection-title`), badge, en-tête de tableau, libellé de section de drawer (README, « Typographie »). Les boutons ne sont jamais en capitales (`gomat-mx.css`, `.mx-btn { text-transform: none }`).
- **Constaté** (texte saisi en majuscules, `text-transform: none`) :
  - sections de Paramètres (voir DA6) ;
  - **bouton « IMPRIMER LES BADGES »** (Personnes) ;
  - titre de drawer « AJOUTER DU MATÉRIEL » (26 px, l'en-tête de drawer est en casse normale) ;
  - onglets de Notifications « TOUTES (1) », « NON LUES (1) », « LUES (0) », « SORTIES (0) » ;
  - état du scanner « SCANNER QR - ACTIF » / « SCANNER QR - SUSPENDU » (Comptoir, Scanner, Inventaire, Libre-service, fiche de demande) ;
  - Statistiques « TABLEAU DE BORD », « EMPRUNTS RÉCENTS », « MATÉRIEL EN MAINTENANCE ».

### E. Couleurs — `tailwind.config.js` (échelles `gray`, `primary`, `success`, `warning`) et quelques classes en dur

**DA9 — MINEUR (très répandu) — Gris intermédiaires qui ne sont pas des tokens**
- **Attendu** : textes en `--text` (#101114), `--text2` (#4A4D57), `--text3` (#82858F) ; sombre `--text` #F5F6F8, `--text2` #B4B7C0, `--text3` #7D818C (README, « Couleurs »).
- **Constaté** : les nuances Tailwind `gray-500`, `gray-700` et `gray-800` (échelle `--g-*`) donnent (107,110,120), (51,54,63) et (30,32,38) en clair ; `gray-400` donne (157,160,170) en sombre. Comptages : Personnes 234 éléments en (51,54,63) ; Journal 100 ; Permis et formations 54 en (30,32,38) ; Sorties 44 en (107,110,120) ; texte des confirmations en (51,54,63).
- **Cause** : `tailwind.config.js`, `gray: { …: 'rgb(var(--g-…))' }` : seules certaines marches de `--g-*` valent un token.

**DA10 — MAJEUR — Couleurs de statut Tailwind brutes**
- **Attendu** : tons sémantiques (README, « Tons sémantiques » ; `tokens-mx.css`, `--mx-tone-fill-*` / `--mx-tone-on-*`) ; badge de liste `.vt-badge` : fond `color-mix(--green 15%)` + texte `--green`, ou `--band` + `--bandText`.
- **Constaté** : Sorties, badges « Retourné » sur **émeraude (16,185,129)** avec texte blanc (20 éléments, contraste **2,54:1**) et « Emprunté » sur **ambre (245,158,11)** avec texte blanc (**2,15:1**) ; Véhicules, barres de planning en (23,181,129) (`success-500`, 56 éléments) ; Statistiques, boutons ronds vert et ambre (DA4) et icônes en (23,181,129).

**DA11 — MAJEUR (accessibilité, sombre) — Texte blanc sur aplat accent ou bandeau**
- **Attendu** : en sombre, le texte sur l'aplat accent est `--mx-tone-on-accent` (= `--mx-tone-on`, quasi-noir `#14110a` en sombre) ; sur `--band`, le texte est `--bandText` (README, tableau des tons : warning → `--bandText`).
- **Constaté** :
  - blanc sur `#8672F5` (**3,66:1**) : boutons primaires (« Sauver » ×4 sur Paramètres), onglets actifs (DA5), puces du planning ;
  - blanc sur `--band` `#F0B429` (**1,86:1**) : puce « TEST Permis B · à valider » (planning des véhicules) et bouton « Retour » de Statistiques.
- **Remarque** : `--text3` sur `--surface2` en sombre mesure 4,27:1 (en-têtes de tableau « Véhicule », « Chantier »). C'est une valeur des tokens de la charte elle-même, signalée pour information, pas comme défaut de GO-Mat.

**DA12 — MINEUR — Icônes colorées en dur**
- **Attendu** : icône de section en `--text3` (accent à l'ouverture) ; teintes de statut par tons.
- **Constaté** : Paramètres, icônes de section en ambre (201,146,8), vert `#0F9D6E` et accent ; en sombre, ambre **clair** (245,197,24, valeur `--band` du thème clair) ; Santé des données et Kits : textes et icônes en ambre (154,111,6), (201,146,8) et (248,214,82).

**DA13 — MINEUR — Encadrés teintés hors tokens**
- **Attendu** : encart neutre `--mutedBox`, filet 1,5 px, rayon 8 px (`mannyx-drawer.js`, `.mx-dr-muted`) ; tons pour les alertes.
- **Constaté** : Aide, « Astuces » sur (230,245,250) filet (153,213,234) et « Attention » sur (254,248,225) filet (251,227,138), rayon 6 px ; Coûts, avertissement (254,248,225) texte (115,83,5). Accueil et Demandes : badge « Validée » sur (204,234,245).

### F. Champs et contrôles de formulaire

**DA14 — conforme à la décision projet — Taille du texte saisi**
- Le texte des champs mesure 12,25 px (racine à 14 px) contre 12,5 px pour le tronc : écart de 0,25 px, sans effet visible. Classé conforme (LISEZ-MOI, tableau « Texte saisi dans un champ »).

**DA15 — MINEUR — Graisse du texte saisi**
- **Attendu** : 12,5 px / **500** (tronc, LISEZ-MOI).
- **Constaté** : 12,25 px / **400** dans tous les champs (`input`, `select`, `textarea`) des pages et des drawers. Le tronc étant plus gras que GO-Mat, la conformité reprend ses droits : 500 est dû.

**DA16 — MINEUR — Hauteurs de champ hétérogènes**
- **Attendu** : 34 px (tronc, LISEZ-MOI).
- **Constaté** : 34 px pour la plupart des champs, mais : liste des langues **27 px** (Paramètres, connexion) ; tri **30 px** (Inventaire) ; **35 px** (Outils) ; **41 px** (Écran TV) ; recherche de l'Aide **40,5 px** (14 px) ; e-mail de connexion **44 px** (14 px / 400).

**DA17 — MINEUR — Cases à cocher et boutons radio natifs**
- **Attendu** : catalogue `.checkbox` 16 × 16 px, rayon 4 px, filet 1,5 px `--border`, coche SVG blanche sur accent ; `.radio` 18 px, filet 1,5 px `--inputBorder`, point accent de 8 px ; `.radio-card` padding 14 px, filet 1,5 px, rayon 6 px, sélection `--accent` sur `--accent-lt`.
- **Constaté** :
  - cases natives (`appearance: auto`) de 14 × 14 px (drawers d'ajout d'outil et de personne) ;
  - cartes radio de rôle (drawer Personnes) : radio natif de 13 px, padding 10,5 px, carte sélectionnée bordée de (106,86,222) (`primary-500`, pas `--accent`) ;
  - titre de carte radio en 12,25 px / 600 (catalogue 13,5 px / 700 ; LISEZ-MOI : « à trancher au cadrage de `MxRadio` »).

**DA18 — MINEUR — Champ de scan**
- **Constaté** : 46 px, filet de 2 px en (169,156,236) (teinte non token), 14 px / 400 (fiche de demande, Comptoir, Scanner, Libre-service, Inventaire). Le catalogue n'a pas de champ de scan : ramener filet et couleur aux tokens des champs (`--inputBorder`, focus `--accent`).

### G. Drawer — `src/components/mx` (MxDrawer et ses utilisations)

**DA19 — MAJEUR — Largeurs hors échelle**
- **Attendu** : 360 / 420 / 520 / 680 px (`mannyx-drawer.js`, `SIZES`) ; LISEZ-MOI C8 : « `size` en échelle fermée : pas de largeur en pixels libres ».
- **Constaté** : « Nouvelle demande » **960 px** ; « Réception · … » (location) **960 px**. Capture `captures/da/da-05-drawers-nouvelle-demande-960-et-fiche.jpg` (« Nouvelle demande » en arrière-plan, fiche de 680 px devant).

**DA20 — MINEUR — Padding du corps de drawer**
- **Attendu** : corps 20 / 24 / 8 px (`.mx-dr-body`).
- **Constaté** : 24 / 24 / 8 px dans tous les drawers mesurés.

**DA21 — MINEUR — Libellés de section de drawer**
- **Attendu** : `.mx-dr-label` 11 px / 700 / 0,08 em, majuscules, `--text3`.
- **Constaté** : drawer Personnes, « Rôle », « Droits », « Permis de conduire », « Statut » en 12,25 px / 500 en casse normale ; drawer de réception, « Relevés », « Photos », « Dégâts déjà présents » en 11 px / **800** / **0,14 em** (style de sous-titre de page, pas de drawer).

**DA22 — MINEUR — Fiche de demande sans pied**
- **Attendu** : DOCTRINE-DRAWER §« Deux familles de pied » : pied entité (`MxEntityActionFooter`) pour une fiche ; pas de menu « … » (§12).
- **Constaté** : « Liste de préparation », « Annuler la demande », « Marquer prête », « Sortir » sont dans le corps, en boutons de 29 px (aucun élément collant).

**DA23 — MINEUR — Liste d'articles du drawer « Nouvelle demande »**
- **Attendu** : `.mx-dr-list-item` : padding 10 × 12 px, fond `--surface2`, filet 1,5 px, rayon 6 px.
- **Constaté** : lignes-boutons de 44 px, rayon 0, 14 px / 400 ; code d'article en 10,5 px / 400 (107,110,120).

### H. En-tête de page

**DA24 — MAJEUR — Statistiques sans titre de page**
- **Attendu** : `mx-page-title` 52 px / 700 / −0,05 em, sous-titre, action principale à droite (consignes §3.1 ; README, « Titre de page »).
- **Constaté** : aucun `h1` ; un `h2` « TABLEAU DE BORD » en 17,5 px / 700, majuscules. L'écran TV n'a pas non plus de titre, ce qui se défend en mode plein écran (à confirmer).

**DA25 — MINEUR — Version imprimable de l'Aide**
- **Constaté** : `h1` « Mode d'emploi » en 31,5 px, sans `mx-page-title`. Page pensée pour l'impression : à valider plutôt qu'à corriger.

### I. États vides

**DA26 — MINEUR — États vides en simple phrase**
- **Attendu** : DOCTRINE-ETATS-VIDES §2a, `MxEmpty` : pastille ronde (`--surface`, filet 1 px `--border`) avec icône Lucide, titre, description et action facultatives, centrés, **sans pointillés** (les pointillés sont réservés au dépôt de fichiers, §1).
- **Constaté** : phrases simples, par exemple « Aucune demande pour l'instant. Créez la première avec « Nouvelle demande ». », « Aucun chantier. Créez-en un… », « Rien sur le chantier ».

### J. Téléphone (390 px)

**DA27 — MINEUR — Sorties : tableau de 1 024 px sur téléphone**
- **Constaté** : en 390 px, la liste des Sorties reste un tableau de 1 024 px à faire défiler latéralement ; la vue « Grille » existe mais n'est pas proposée par défaut. Les doctrines sont muettes sur le téléphone : à arbitrer (bascule automatique en cartes sous 768 px).
- **Capture** : `captures/da/da-04-sorties-390-bascule-et-tableau.jpg`.

**DA28 — REMARQUE — Petites cibles tactiles**
- Accueil : liens « Demandes », « Sorties », « Feuille de commande », « Flotte » de 20 px de haut ; Comptoir : lien « choisissez la personne » de 20 px. La charte ne fixe pas de taille de cible ; signalé pour l'usage au doigt.

### K. Toasts et carte

**DA29 — MINEUR — Toast neutre**
- **Attendu** : catalogue `.toast` : fond teinté selon le ton (`--tlt`), padding 12 × 14 px, rayon 6 px, icône Lucide.
- **Constaté** : fond blanc identique pour tous les tons, padding 8 × 10 px, icône de react-hot-toast (12 px).

**DA30 — MINEUR — Contrôles de la carte**
- **Constaté** : attribution et boutons de zoom Leaflet en Helvetica Neue / Lucida Console au lieu de Geist.

### Hors charte (relevé au passage)

- La rubrique Aide tutoie (« Scanne », « Choisis »), l'application vouvoie : voir A3 dans `rapport-lot16.md`.

---

## Composants communs à corriger en priorité

| Priorité | Composant | Fichier | Règle | Écarts réglés |
|---|---|---|---|---|
| 1 | Bouton | `src/components/common/Button.tsx` | 12,5 px / 600 sur grand écran (retirer `lg:text-xs`) ; variante de drawer au rayon 8 px, 12 × 16 px | DA1, DA2, une partie de DA3 — **toutes les pages** |
| 2 | Accordéon | `src/components/common/Accordion.tsx`, `AccordionCard.tsx` | recréer `#s-accordion` (46 px, titre 14 px / 700, filet d'accent, `aria-expanded`), titres en casse normale | DA6, DA7, une partie de DA8 — Paramètres, drawers d'outil, Santé des données, Coûts, Planning |
| 3 | Bascule segmentée | nouveau `MxSegmented` (ou reprise de la bascule du tronc) | `#s-viewtoggle` : vignette `--surface`, texte accent, `radiogroup` | DA5 et une partie de DA11 — 8 pages |
| 4 | Échelles de couleurs | `tailwind.config.js` (`gray`, `primary`, `success`, `warning`) | marches de gris = tokens `--text*` ; statuts = `--mx-tone-*` ; texte sur aplat = `--mx-tone-on-*` | DA9, DA10, DA11, DA12, DA13 |
| 5 | Drawer | `MxDrawer` et ses utilisations | tailles 360 / 420 / 520 / 680 seulement ; corps 20 px ; libellés `.mx-dr-label` ; pied entité pour les fiches | DA19 à DA23 |
| 6 | Contrôles de formulaire | règles globales des champs, cases, radios | 34 px partout, texte 500, case 16 px et radio 18 px dessinés | DA15 à DA18 |
| 7 | En-tête de page et état vide | page Statistiques ; `MxEmpty` | `mx-page-title` ; état vide à pastille | DA24, DA26 |
| 8 | Textes | libellés en dur | casse normale (« Imprimer les badges », onglets de Notifications, état du scanner…) | DA8 |

## Captures

| Fichier | Contenu |
|---|---|
| `captures/da/da-01-parametres-accordeons.jpg` | Paramètres, clair, 1440 px : sections repliables (DA6, DA8, DA1) |
| `captures/da/da-02-reference-accordeon-et-bascule.jpg` | Catalogue de référence : accordéons groupé et séparé, bascule liste/grille |
| `captures/da/da-03-statistiques-sans-titre.jpg` | Statistiques : pas de titre de page, boutons ronds vert et ambre (DA24, DA4, DA10) |
| `captures/da/da-04-sorties-390-bascule-et-tableau.jpg` | Sorties en 390 px : bascule en aplat accent et tableau à défilement latéral (DA5, DA27). La capture est répétée en mosaïque à cause de l'émulation de taille du panneau |
| `captures/da/da-05-drawers-nouvelle-demande-960-et-fiche.jpg` | Drawers empilés : « Nouvelle demande » (960 px, DA19) et fiche de demande (actions dans le corps, DA22) |
| `captures/da/da-06-outils-cartes.jpg` | Outils : cartes d'entité et boutons d'icône (référence visuelle pour DA1 et DA9) |
