# Consignes — audit visuel de conformité à la charte Mannyx (MX), page par page

Objectif : relever, **dans le navigateur**, chaque écart entre les écrans de GO-Mat et la charte Mannyx, pour que
la session de développement les corrige. **Ne modifie aucun fichier de l'application.**

Version à auditer : `claude/loving-thompson-6zfo06` (publiée sur https://go-stock.netlify.app), base GO-MAT.
Rapport : `docs/tests/audit-da.md` sur la branche `tests/rapport-chrome`, avec les captures dans
`docs/tests/captures/da/`. Ne pousse pas sur `claude/loving-thompson-6zfo06`.

## 1. Lire la charte d'abord (dossier `docs/charte-mx/` de la branche)

`git fetch origin claude/loving-thompson-6zfo06` puis lis, dans cet ordre, les fichiers listés dans
`docs/charte-mx/README.md`. Ouvre `Mannyx Components V2.html` et `01-catalogue-autonome.html` dans le navigateur :
ce sont les références visuelles. Retiens surtout :
- **qui fait foi** : drawer → `mannyx-drawer.js` ; page → `Mannyx Components V2.html` ; transversal → `README.md` ;
- **l'écart typographique assumé** (LISEZ-MOI-EN-PREMIER) : ne le signale pas comme une erreur, mais respecte son *sens*
  (le tronc ne gagne que quand le handoff est plus grand ou plus gras) ;
- les doctrines (tableaux, barres d'outils, états vides, vues cartes/liste, configuration, pickers, graphiques).

## 2. Pages à auditer (bureau 1440 px, clair puis sombre ; pages terrain aussi en 390 px)

Toutes les pages du menu, en particulier celles qui semblent hors charte :
**Paramètres** (`/settings`) et ses sections repliables, **Aide** (`/aide`, un article, le drawer « ? », la version
imprimable), puis : Accueil (rôles admin, magasinier, collaborateur), Recherche, Notifications, Mon badge, Comptoir,
Scanner, Demandes (+ drawer « Nouvelle demande », fiche d'une demande), Sorties, Libre-service, Transferts,
Emplacements, Inventaire, Écran TV, Outils (+ drawer d'ajout en 2 étapes), Kits, Entretien, Atelier, Pertes et casse,
Étiquettes, Consommables, À commander, Commandes, Véhicules, Chantiers, Carte, Planning, Locations (+ drawer de
réception), Personnes (+ drawer), Permis et formations, EPI, Pilotage, Statistiques, Coûts, Comptabilité, Journal,
Santé des données, Démarrage, page de connexion, confirmations (`confirmAction`), toasts.

## 3. Ce qu'il faut contrôler sur chaque page

Compare à la référence (mesure les valeurs calculées avec les outils du navigateur, ne te fie pas à l'œil seul) :
1. **En-tête de page** : titre (`mx-page-title`), sous-titre, emplacement de l'action principale, barre d'outils
   (DOCTRINE-BARRE-OUTILS).
2. **Typographie** : police Geist partout, tailles, graisses, interlignage, tracking, majuscules (pas de titres de
   section en MAJUSCULES saisies dans le texte, ex. « PARAMÈTRES SYSTÈME » : vérifier ce que dit la charte), chiffres
   tabulaires sur les valeurs.
3. **Couleurs** : uniquement les tokens `--mx-*` (pas de bleu/vert/rouge Tailwind « bruts »), tons sémantiques des
   statuts, contraste en sombre.
4. **Surfaces** : cartes (`mx-card`), bordures 1.5 px, rayons, ombres/élévations, fonds de page.
5. **Boutons** : variantes (primaire, secondaire, fantôme, danger), hauteur, rayon, libellé, icônes, états survol /
   appui / désactivé.
6. **Champs et sélecteurs** : hauteur, bordure, focus, libellés, sélecteurs de date et d'heure MX (pas de champ natif),
   listes déroulantes, cases et interrupteurs.
7. **Tableaux et listes** : DOCTRINE-TABLEAUX et DOCTRINE-VUES-CARTES-LISTE (en-têtes, densité, alignements, actions).
8. **Drawers** : en-tête, pied collant, largeurs, empilement (DOCTRINE-DRAWER, `mannyx-drawer.js`).
9. **Accordéons / sections repliables** (Paramètres !) : sont-ils conformes à un composant de la charte, ou un reste
   de l'ancienne interface ?
10. **États vides, chargement, erreurs** (DOCTRINE-ETATS-VIDES).
11. **Icônes** : Lucide, tailles et épaisseurs cohérentes, pas d'emoji.
12. **Espacements** : grille et marges des pages comparées à la référence.

## 4. Format du rapport

- Un tableau de synthèse : page → conforme / écarts mineurs / écarts majeurs.
- Puis, pour chaque écart, numéroté **DA1, DA2…** :
  page · élément · **attendu** (avec la source précise : fichier et section de la charte) · **constaté** (valeurs
  calculées : taille, graisse, couleur, rayon…) · capture · gravité (majeur = visible au premier coup d'œil,
  mineur = détail).
- Regroupe les écarts qui ont la même cause (ex. « tous les accordéons de Paramètres ») pour que la correction soit
  faite une seule fois, dans le composant commun.
- Termine par la liste des **composants communs** à corriger en priorité (ceux qui règlent le plus d'écarts).
