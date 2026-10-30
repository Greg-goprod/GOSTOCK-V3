# Doctrine Barre d'outils — `MxToolbar`/`MxPagination` (décision Greg, 2026-10-04)

> **RETRAIT DE `MxToolbar` — LOT PAGE-HEADER, Phase B (Greg, 2026-10-17).**
> `MxToolbar` (`src/components/mx/MxToolbar.tsx`) est SUPPRIMÉ du tronc : la zone de
> commande d'une page n'est plus un bloc posé en haut du contenu, elle est INTÉGRÉE À
> L'EN-TÊTE DE MODULE (`ModuleChrome`, qui ne défile jamais) — décision de Greg, B1.
> Remplacée par **`MxPageCommands`** (`src/components/mx/MxPageCommands.tsx`), qui
> reprend EXACTEMENT les mêmes six emplacements, le même ordre, la même mise en page
> (`search · filters · pagination · view · primary`, plus `band` en seconde ligne) —
> **tout le contenu de ce document reste donc valable pour `MxPageCommands`**, seul le
> nom du composant et son point de montage (déclaré par la page, rendu par portail dans
> `ModuleChrome`) changent. Voir le commentaire d'en-tête de `MxPageCommands.tsx` pour le
> mécanisme (portail, nettoyage automatique au changement de page) et
> `docs/REGISTRE_RETRAITS.md` pour la fiche de retrait.
>
> **Portée.** Ce document fixe le modèle que doit suivre **toute barre d'outils de liste**
> du tronc `src/components/mx` — recherche, filtres, pagination, bascule de vue, action
> principale. Il complète `README.md` (transversal) sans le remplacer : là où le handoff
> d'origine ne traitait pas ce besoin, cette doctrine introduit deux primitives neuves,
> `MxToolbar` (mise en page) et `MxPagination` (pagination compacte réutilisable).
>
> **Statut.** Décision définitive de Greg, LOT ARTISTES-LISTE C3 (2026-10-04), étendue par
> LOT BARRES-OUTILS A/B (2026-10-04). Vaut pour TOUTES les barres d'outils de liste futures
> du tronc.
>
> **Trois applications complètes à ce jour :** la page Artistes (`ArtistesListMx.tsx`,
> `search`/`filters`/`pagination`/`view`/`primary`), la page Contrats
> (`ContratsListMx.tsx`, `search`/`band`) et la page Notifications
> (`src/pages/app/notifications/index.tsx`, `search`/`filters`/`primary`) — toutes en
> branche Mannyx. Voir §6.

---

## 1. Le modèle, en une phrase

**Emplacements FIXES, ordre IMMUABLE — `search · filters · pagination · view · primary` —
chaque emplacement optionnel. `search` est le seul emplacement qui grandit ; `primary` est
toujours plaqué à droite ; la ligne passe proprement à la ligne (`flex-wrap`) en largeur
réduite, sans jamais déborder horizontalement.**

> **Pas de roue de configuration ici.** Décision de Greg, LOT BARRES-OUTILS, A
> (2026-10-04) : la roue dentée de configuration n'est **pas** un emplacement de
> `MxToolbar` — elle vit dans l'en-tête du **module** (zone actions de `ModuleChrome`/
> `MxPageHeader`), une roue par module, pas par page/liste. Voir
> `DOCTRINE-CONFIGURATION.md`. L'emplacement `config` qui existait dans une version
> antérieure de cette doctrine (LOT ARTISTES-LISTE C3) a été retiré ; il n'avait jamais été
> branché par aucune page (Artistes : prévu mais vide), aucune régression à ce retrait.

## 2. Tronc — `MxToolbar`

`src/components/mx/MxToolbar.tsx`. Composant de pure MISE EN PAGE : ne résout aucune i18n,
ne décide jamais si un emplacement doit exister — c'est à l'appelant de passer ou non
chaque prop. Six emplacements : cinq dans une rangée, ordre IMMUABLE, jamais réordonnés
par l'appelant ; `band`, le sixième, se pose à part (seconde ligne, §2bis) :

| Emplacement | Quand l'utiliser |
| --- | --- |
| `search` | Un champ de recherche texte filtrant la liste. Seul emplacement en `flex: 1` — grandit pour occuper l'espace disponible, retrécit jusqu'à sa largeur minimale avant que la ligne ne passe au retour à la ligne. |
| `filters` | Un ou plusieurs filtres COMPACTS (ex. un `MxSegmented` à 2-3 options, un `MxSelectField hideLabel` de statut). Plusieurs filtres se posent côte à côte dans ce même emplacement (l'appelant compose son propre groupe). Un bandeau LARGE (plus de 4-5 options, type parcours d'étapes) ne va pas ici — voir `band` (§2bis). |
| `pagination` | La pagination de la liste — voir `MxPagination` (§3). Absent si la liste ne pagine pas, ou si une seule page est à afficher (c'est à l'appelant d'omettre la prop, le composant ne le devine pas). Absent aussi pour une pagination par ACCUMULATION (« Charger plus ») — hors périmètre de cet emplacement, voir §3. |
| `view` | Une bascule de vue (ex. `MxSegmented iconOnly` cartes/tableau). |
| `primary` | L'action de la page, toujours plaquée à droite (`margin-left: auto`), avec ou sans `search` présent. **Une seule action → un bouton** (`MxButton`, ex. « Ajouter un artiste »). **Plusieurs actions de même rang → un menu** (`MxMenu`, déclencheur `MxButton` libellé — ex. « Actions » regroupant « Tout marquer comme lu »/« Archiver les lues » sur Notifications) : `primary` reste un emplacement UNIQUE, jamais deux boutons posés côte à côte au même rang. |

Comportement de mise en page :

- `flex-wrap: wrap` sur la rangée : en largeur réduite, les emplacements passent à la ligne
  plutôt que déborder horizontalement.
- `search` reçoit `flex: 1 1 calc(220px * var(--mx-scale, 1))` et une largeur minimale
  identique : il grandit, mais ne descend jamais sous ce seuil avant le retour à la ligne.
- Les autres emplacements reçoivent `flex-shrink: 0` : ce sont des contrôles compacts,
  ils ne doivent jamais se faire écraser.
- `primary` reçoit `margin-left: auto` : si `search` est présent, son `flex: 1` a déjà
  consommé l'espace libre et `primary` se retrouve naturellement en bout de ligne ; si
  `search` est absent, rien d'autre n'absorbe l'espace libre et c'est alors
  `margin-left: auto` qui plaque `primary` à droite. Les deux mécanismes coexistent sans
  conflit : ils ne font jamais que confirmer le même résultat visuel.
- Tokens uniquement (`var(--mx-space-12)` pour l'écart entre emplacements, `--mx-scale`
  pour la largeur minimale de `search`) — même convention que le reste du tronc.

## 2bis. L'emplacement `band` : bandeau large en seconde ligne

Décision de Greg, LOT BARRES-OUTILS B1 (2026-10-04). Un bandeau de navigation/filtre LARGE
(ex. le parcours des 6 étapes de Contrats, `MxSegmented` à 7 options avec compteurs) ne
tient pas dans la rangée compacte du §2 — `filters` suppose des contrôles qui ne
s'écrasent jamais (`flex-shrink: 0`), un bandeau large y déborderait ou forcerait un
retour à la ligne qui casse sa lisibilité de parcours linéaire.

- **Toujours composé via `MxToolbar`, jamais à la main.** Un appelant qui a besoin d'un
  bandeau large passe `band`, il ne recrée pas lui-même un `<div style={{overflowX:
  'auto'}}>` à côté de `MxToolbar` — c'est au tronc de poser cette mise en page, pas à
  chaque page de la deviner (même principe que les 5 autres emplacements).
- **Seconde ligne, PLEINE LARGEUR**, sous la rangée des 5 autres emplacements.
- **Défilement horizontal PROPRE à cette ligne** (`overflow-x: auto`) — **jamais de retour
  à la ligne** : un bandeau de parcours qui se replie sur plusieurs lignes perd son rôle de
  séquence lisible d'un seul regard.
- **Absent → structure IDENTIQUE à avant l'introduction de `band`** : aucune ligne ni
  wrapper supplémentaire pour un appelant qui ne le fournit pas (Artistes, Notifications).
- Référence : `ContratsListMx.tsx` (`band` = bandeau des 7 étapes, `search` = recherche,
  rien d'autre).

## 3. Tronc — `MxPagination`

`src/components/mx/MxPagination.tsx`. Pagination compacte : deux `MxIconButton`
(précédent/suivant, `ChevronLeft`/`ChevronRight`), l'indicateur `« {page} / {total} »`,
un texte de total optionnel (ex. « 163 artistes »), un `MxSelectField hideLabel` de nombre
par page.

- **Aucun libellé en dur.** `previousLabel`/`nextLabel` (aria-label des 2 boutons) et
  `pageSizeLabel` (nom accessible du select) sont des props **déjà traduites** par
  l'appelant — même convention que `aria-label` de `MxSegmented`. Le composant ne résout
  jamais lui-même de clé i18n.
- **`totalLabel` est un texte déjà composé** par l'appelant (ex. « 163 artistes »,
  singulier/pluriel résolu côté appelant via `_one`/`_many`, même convention que
  `notification_panel.group_count_one`/`_many`) : le mot qui varie par entité (artistes,
  contrats…) n'est jamais connu du tronc. Prop optionnelle — absente, rien n'est affiché à
  cet endroit.
- **`« {page} / {total} »` sans mot** : décision explicite de Greg pour ce composant
  précis — un simple « / » n'a besoin d'aucune traduction. La clé `of` (« sur »/« of »/
  « von »), déjà posée ailleurs dans le projet, reste utilisée par d'autres call sites,
  non touchés par cette doctrine.
- **`onPageChange` reçoit toujours une valeur déjà bornée** à `[1, totalPages]` — le
  composant fait lui-même le `Math.max`/`Math.min`, l'appelant n'a jamais besoin de
  re-clamper.
- **Boutons désactivés aux extrémités** (`currentPage <= 1` / `currentPage >= totalPages`).
- Décider s'il faut même afficher la pagination (ex. la masquer tant qu'une seule page
  existe) reste à l'appelant, exactement comme pour les autres emplacements de
  `MxToolbar` — le composant lui-même se contente de rendre ce qu'on lui donne.

**« Charger plus » (pagination par ACCUMULATION) est HORS PÉRIMÈTRE de `MxPagination`** —
décision confirmée LOT BARRES-OUTILS, phase A (2026-10-04). `MxPagination` modélise une
pagination PAR PAGE (page courante/total, précédent/suivant, taille de page qui REMPLACE
le contenu affiché) ; un bouton « Charger plus » AJOUTE des éléments à la liste existante
(défilement infini par paliers) — un modèle fondamentalement différent, faire entrer l'un
dans l'autre serait un contre-sens d'API. Référence : Notifications
(`src/pages/app/notifications/index.tsx`) garde son bouton « Charger plus » en bas de
liste, INCHANGÉ, hors `MxToolbar`/`MxPagination`.

## 4. Pagination : remonter en haut de la zone défilante

Changer de page doit toujours ramener la zone défilante du module en haut — l'utilisateur
ne doit jamais atterrir au milieu d'une liste qui vient de changer de contenu.

Le patron retenu (voir `ArtistesListMx.tsx`) : un **repère** (`ref` sur un `<div>` vide,
sans dimension), posé en tout premier enfant du composant de liste, juste avant
`MxToolbar`. Au changement de page (dans le `onPageChange` passé à `MxPagination`), après
avoir appelé le `onPageChange` reçu en prop :

```ts
listTopRef.current?.scrollIntoView({
  block: 'start',
  behavior: reducedMotion ? 'auto' : 'smooth',
});
```

**`scrollIntoView` plutôt qu'un `closest('.overflow-y-auto')` + `scrollTo`** : la méthode
native trouve elle-même le bon ancêtre défilant, quel que soit le layout qui englobe la
page — aucune dépendance à une classe CSS précise posée sur cet ancêtre (contrairement à
une première version de ce patron, qui supposait la classe `.overflow-y-auto` du correctif
LOT ARTISTES-LISTE C2.3). Comportement **instantané si l'utilisateur a demandé une motion
réduite** (`useMxReducedMotion`, même hook que `MxSegmented`/`AppLayout`), fluide sinon.

Ce mécanisme vit dans la PAGE (le composant de liste), pas dans `MxPagination` lui-même :
`MxPagination` reste un composant de pure présentation, il ne connaît ni le DOM de la
liste qui l'entoure ni la préférence de motion de l'appelant — c'est au composant de liste
de composer son `onPageChange` (appeler le `onPageChange` reçu, puis `scrollIntoView` sur
son propre repère) avant de le passer à `MxPagination`. Tout futur consommateur de
`MxToolbar`/`MxPagination` (Contrats, Notifications…) reproduit ce même patron.

## 5. Grilles de cartes : pagination en multiples du nombre de colonnes

Décision de Greg, LOT ARTISTES-LISTE C4 (2026-10-04). Dans une grille de cartes, le nombre
d'éléments par page doit être un **multiple du nombre de colonnes réellement affichées**
(pages pleines, sauf la dernière) — une page qui s'arrête au milieu d'une rangée est à
éviter.

- **Tronc — `MxCardGrid`** (`src/components/mx/MxCardGrid.tsx`, §5bis ci-dessous), qui
  reporte le nombre de colonnes mesuré via sa prop `onColumnsChange`. Nombre de colonnes
  dérivé de la largeur RÉELLE du conteneur (`useContainerWidth`,
  `src/components/mx/internal/useContainerWidth.ts` — `getBoundingClientRect().width`,
  `ResizeObserver`, valeur stable, jamais réécrite à l'identique donc aucune boucle de
  rendu), passée à `columnsForWidth` (§5bis — paliers fixes). `useContainerWidth` retourne
  `[width, ref]` — `ref` est un **callback ref** (pas un `RefObject` classique) : la grille
  mesurée est typiquement CONDITIONNELLE (démontée en vue tableau), et seul un callback ref
  redéclenche l'effet de mesure quand React remonte un NOUVEL élément sur la même grille
  (bascule tableau -> cartes -> tableau).
- **La valeur reste gelée** tant que la grille n'est pas (re)montée — c'est ce qui permet
  d'avoir les **mêmes valeurs de pagination en vue tableau qu'en vue cartes** (même nombre
  de colonnes « mémorisé », pas de recalcul à 1 colonne pour une vue qui n'a pas de notion
  de colonnes).
- **`MxPagination` reste inchangé** : `pageSizeOptions` est un prop déjà générique
  (`MxSelectOption[]`), peu importe que ses valeurs soient des constantes fixes ou
  calculées (`columns x rangées`) — aucune API spécifique à ajouter côté `MxPagination`.
- **Le choix mémorisé par l'utilisateur est le nombre de RANGÉES**, pas le nombre
  d'éléments par page : c'est ce qui permet de le conserver identique à un
  redimensionnement (le nombre de colonnes change, les rangées non) — voir
  `src/components/mx/internal/mxGridPagination.ts` (`buildMxGridPageSizeOptions`,
  `rowsFromPageSize`, `computeMxGridPageSize`, `recalageMxGridPage`), fonctions PURES
  extraites pour rester testables sans monter la page complète.
- **Recalage de la page courante** au changement de `pageSize` induit par un
  redimensionnement (nombre de colonnes différent, mêmes rangées) : garder le PREMIER
  artiste de la page courante visible — retrouver son index absolu avec l'ancien
  `pageSize`, puis la page qui le contient avec le nouveau (`recalageMxGridPage`).
- Référence : `ArtistesListMx.tsx` (3/6/12 rangées, libellées en nombre d'artistes — ex.
  24/48/96 à 8 colonnes) et `src/pages/app/artistes/index.tsx` (mémorisation des rangées,
  effet de resynchronisation `pageSize = rangées x colonnes`, recalage de page).

## 5bis. Toute page en cartes utilise `MxCardGrid` — 8 colonnes au-dessus du seuil, paliers en dessous, définis dans `MxCardGrid`

Décision de Greg, LOT CONTRATS-GRILLE ET ANNULATION, G4 (2026-10-09), **correctif de
recette (2026-10-10)**. **Toute page en cartes utilise `MxCardGrid`
(`src/components/mx/MxCardGrid.tsx`)** — un seul composant de grille pour toute grille de
cartes paginée OU non : `MxCardGrid` expose `items`/`getItemKey`/`renderItem`/
`onColumnsChange?` — reporte le nombre de colonnes mesuré à l'appelant (utile pour la
pagination en multiples de colonnes, §5, quand la page en a une ; une grille sans
pagination, comme la section « Contrats annulés », l'utilise aussi, simplement sans rien
faire de ce nombre).

**Correctif de recette (2026-10-10) — retrait de `minCardWidth`.** La première version de
`MxCardGrid` (G1, 2026-10-09) acceptait un prop `minCardWidth` par appelant et rendait
`gridTemplateColumns: repeat(auto-fill, minmax(minCardWidth, 1fr))` — le nombre de colonnes
était un résultat ÉMERGENT du calcul `auto-fill`, dépendant de cette largeur minimale
choisie PAR LA PAGE. À la recette, Artistes (220px) et Contrats (160px, personnalisé) ont
affiché des comptes de colonnes DIFFÉRENTS (7 contre 9) sur le MÊME écran : deux largeurs
de carte différentes produisent nécessairement des comptes de colonnes différents à largeur
de conteneur égale. **Cette personnalisation par page est désormais interdite** :
`MxCardGrid` n'accepte plus de prop `minCardWidth`.

**Mécanisme retenu — paliers FIXES de largeur de CONTENEUR, définis UNE SEULE fois dans
`MxCardGrid`** (`src/components/mx/internal/mxGridBreakpoints.ts`, fonction pure
`columnsForWidth`) :

```
columns(largeur du conteneur) = clamp(floor(largeur / 200px), 1, 8)
```

- **8 colonnes FIXES au-dessus du seuil** (1600px = 8 × 200px) — jamais plus, quelle que
  soit la largeur au-delà.
- **Paliers dégressifs en dessous** : une colonne de moins toutes les 200px (7 à partir de
  1400px, 6 à partir de 1200px, … 1 colonne en dessous de 400px) — jamais moins d'une
  colonne.
- **La largeur des cartes s'ADAPTE, pas le nombre de colonnes** :
  `gridTemplateColumns: repeat(N, 1fr)`, `N` fixé par le palier ci-dessus ; à l'intérieur
  d'un même palier, c'est la largeur de carte (`1fr`) qui grandit/rétrécit avec le
  conteneur, jamais le nombre de colonnes.
- **Mesure du conteneur** : largeur RÉELLE (`useContainerWidth`, §5 ci-dessus), pas une
  résolution `auto-fill` à relire après coup — élimine la sensibilité au pixel près de
  l'ancien mécanisme.
- **IDENTIQUE sur toute page du tronc** : Artistes et Contrats affichent désormais
  TOUJOURS le même nombre de colonnes à largeur de conteneur égale, par construction (plus
  de paramètre par page pouvant diverger).

**Calibrage du seuil des 8 colonnes (1600px)** — mesure RÉELLE de l'écran de Greg
(2026-10-10, console navigateur, page Artistes, plein écran, **zoom 100 %** — corrige une
note antérieure erronée de « zoom 80 % », qui ne figurait nulle part ailleurs dans ce
dépôt) : `innerWidth` = 1920px, `devicePixelRatio` = 1 (écran Full HD, pas de mise à
l'échelle Windows). Largeur du conteneur de cartes à ces conditions, densité Compacte
(`--mx-scale: 0.9`), sidebar DÉPLOYÉE (hypothèse la plus défavorable), barre de défilement
verticale Windows présente (17px) :

```
1920                                   (fenêtre, innerWidth)
- 180   (--mx-sidebar-w = 200px * 0.9)
- 17    (barre de défilement verticale, cas défavorable)
- 37.8  (p-6 des deux côtés = 2 * 1.5rem * 0.9 * 14px, AppLayout.tsx)
= 1685.2px disponibles
```

Seuil retenu : **1600px** (8 × 200px) — marge de 85.2px sous la valeur mesurée. Cette
valeur de 1685.2px est identique au calcul historique de référence (`ArtistesListMx.tsx`,
LOT ARTISTES-LISTE C2.4, 2026-10-03) : le budget de largeur n'a jamais été en cause, seul
l'ancien mécanisme de calcul des colonnes (`auto-fill`/`minmax`, par page) l'était.
Recalibrer uniquement `MX_GRID_COLUMN_STEP_PX`
(`src/components/mx/internal/mxGridBreakpoints.ts`) si la résolution/mise à l'échelle de
référence change un jour — aucun autre fichier à toucher, c'est la SEULE source de vérité
du nombre de colonnes.

- Première application : `ArtistesListMx.tsx` (grille principale, pagination §5) et
  `ContratsListMx.tsx` (`CardsGrid`, grilles « À traiter », « En attente / À recevoir »,
  signatures, « Terminés ») — **aucun changement visuel** lors de ce passage pour Artistes
  (8 colonnes, DOM identique, vérifié par les suites de tests existantes) ; correction
  visuelle attendue et voulue pour Contrats (9 → 8 colonnes).
- Deuxième application, nouvelle grille : la section « Contrats annulés »
  (`ContratsPageViewMx.tsx`), avec une carte dédiée (`CancelledContractCardMx.tsx`,
  `ContractCardMx` restant inadapté — son indicateur à 6 segments suppose un statut de
  `STEP_ORDER`, que `cancelled` n'est pas).
- **Inventaire, en lecture, des autres pages à cartes en colonnes FIXES (Tailwind
  `grid-cols-N`, pas `MxCardGrid`)** — à migrer au fil de leurs lots, pas dans celui-ci :
  - Avec bascule tableau/cartes : `src/pages/app/staff/benevoles.tsx`,
    `src/pages/app/production/ground/chauffeurs.tsx`,
    `src/pages/app/production/ground/vehicules.tsx` (vue `grid` par défaut),
    `src/pages/app/contacts/personnes.tsx`, `src/pages/app/presse/contacts.tsx`.
  - Cartes fixes sans bascule : `src/pages/app/production/hospitality/loges/LogesHub.tsx`
    (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4`), `src/pages/app/staff/contractors.tsx`
    (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).
  - Hors périmètre (pas des listes d'entités paginables) : les grilles de cartes KPI/modules
    des tableaux de bord (`src/pages/app/dashboard/index.tsx`,
    `src/pages/app/booking/index.tsx`) et la grille de sélection d'artiste d'une modale
    (`src/components/missions/StandaloneRunsModal.tsx`).

## 6. Référence d'implémentation

- **`ArtistesListMx.tsx`** (`src/pages/app/artistes/`) — première application complète :
  `search`/`filters`/`pagination`/`view`/`primary` branchés, `MxPagination` dans
  l'emplacement `pagination`, repère + `scrollIntoView` au changement de page (§4),
  options de pagination calculées depuis le nombre de colonnes mesuré (§5).
- **`ContratsListMx.tsx`** (`src/pages/app/administration/contrats/`) — `search` (largeur
  flexible) + `band` (bandeau des 7 étapes, §2bis) ; rien d'autre (pas de pagination par
  page, pas de bascule de vue). Sa grille « À traiter » (`CardsGrid`) passe par
  `MxCardGrid` (§5bis), comme la section « Contrats annulés » de `ContratsPageViewMx.tsx`.
- **`src/pages/app/notifications/index.tsx`** — `search` (recherche TOUJOURS visible,
  sortie de son ancien panneau repliable), `filters` (segmenté de statut + sélecteurs
  compacts catégorie/sévérité + « Réinitialiser » conditionnel), `primary` (menu
  « Actions », §2 — regroupe deux actions de même rang) ; « Charger plus » INCHANGÉ, hors
  `MxToolbar` (§3).

S'y reporter pour toute nouvelle barre d'outils de liste. La roue de configuration du
module (le cas échéant) ne fait PAS partie de cette barre — voir
`DOCTRINE-CONFIGURATION.md`.
