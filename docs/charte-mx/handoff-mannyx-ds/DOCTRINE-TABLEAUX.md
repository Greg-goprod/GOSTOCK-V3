# Doctrine Tableaux — `MxTable` (décision Greg, LOT TABLE-MODELE, 2026-10-16)

> **Portée.** Ce document fixe le modèle que doit suivre **tout tableau** du tronc
> `src/components/mx` — largeur des colonnes, troncature de contenu, colonne d'actions.
> Il complète le commentaire de tête de `MxTable.tsx` (qui reste la source technique
> détaillée) par une doctrine de référence, même rôle que `DOCTRINE-BARRE-OUTILS.md` pour
> `MxToolbar`/`MxPagination`.
>
> **Statut.** Décision définitive de Greg, LOT TABLE-MODELE (2026-10-16). Vaut pour TOUT
> tableau futur du tronc `MxTable`.

---

## 1. Le constat : deux sections, deux largeurs

Retour de Greg, page Offres, vue « Qui doit agir » : la colonne « Échéance » n'était pas à
la même position d'une section à l'autre (chaque groupe/sous-section de la page est une
instance `MxTable` distincte), et le menu « ··· » flottait au milieu de la ligne, à une
position différente selon la section.

**Cause.** `table-layout: auto` (le défaut HTML) calcule la largeur de chaque colonne à
partir du **contenu de CETTE table précise**. Deux `<table>` différents (une section = une
instance `MxTable` séparée) recevant le **même** tableau `columns` (mêmes `id`, même ordre,
mêmes en-têtes) mais des **lignes différentes** (nom d'artiste plus ou moins long, nombre
de boutons d'action différent selon le statut de la ligne) aboutissent à des largeurs de
colonnes **différentes** — d'où le désalignement entre sections empilées sur une même
page, pourtant construites avec la même définition de colonnes.

## 2. Le modèle, en une phrase

**Largeurs de colonnes DÉCLARÉES, jamais déduites du contenu — `table-layout: fixed` + un
`<colgroup>` qui pose la largeur de chaque colonne (`col.width`) via un `<col>`. Au plus
UNE colonne par tableau peut omettre `width` (la colonne flexible). La colonne d'actions
est TOUJOURS la dernière, largeur fixe, alignée à droite, marquée `actionsColumn: true`.**

## 3. Tronc — `MxTable`

`src/components/mx/MxTable.tsx` (commentaire de tête : détail technique complet).
`MxTableColumn<T>` expose :

| Prop | Rôle |
| --- | --- |
| `width?: string` | Largeur CSS déclarée (ex. `'150px'`). Absente : colonne FLEXIBLE, qui absorbe l'espace restant. **Au plus une colonne par tableau** doit l'omettre — avec plusieurs colonnes flexibles, `table-layout:fixed` partagerait l'espace restant À ÉGALITÉ entre elles, jamais ce qu'on veut. |
| `truncate?: boolean` | Coupe le contenu de la cellule avec une ellipse CSS (`overflow:hidden` + `text-overflow:ellipsis` + `white-space:nowrap`) et pose un `title` (infobulle navigateur). |
| `getTitle?: (row: T) => string` | `title` explicite, prioritaire sur le texte de `render(row)`. Sans lui, `truncate` retombe sur le texte de `render(row)` **uniquement s'il s'agit d'une chaîne simple** — jamais de `title` deviné à partir d'un rendu riche (ex. `MxStatusPill`), qui serait potentiellement incohérent. |
| `actionsColumn?: boolean` | Marque la colonne d'actions — doit être la DERNIÈRE colonne, avec `width`, `align:'right'` et `interactive:true` (vérifié par `validateMxTableColumns`, §5). |

**`<colgroup>`** : `MxTable` rend un `<col style={{width: col.width}} />` par colonne (sans
`style` pour la colonne flexible) juste après l'ouverture du `<table>` — la largeur devient
un CONTRAT, identique pour toute instance de `MxTable` recevant le même tableau `columns`,
quel que soit le contenu des lignes.

## 4. La colonne d'actions : règle du pied des drawers, transposée à la ligne

Même principe que le pied des drawers (`MxEntityActionFooter`, `DOCTRINE-DRAWER.md`) : le
bouton « ··· » (menu de débordement) toujours à gauche DANS son groupe, l'action
principale toujours à droite en variante primaire. Transposé à la colonne d'actions d'un
tableau :

- **Toujours la DERNIÈRE colonne** du tableau — jamais une colonne de contenu intercalée
  entre deux colonnes d'actions, jamais le menu « ··· » posé dans une colonne de contenu.
- **Largeur FIXE** (jamais déduite du nombre de boutons visibles sur la ligne) — c'est ce
  qui garantit que le bouton « ··· » reste au MÊME endroit d'une ligne et d'une section à
  l'autre, même quand le nombre d'actions visibles varie selon le statut de la ligne (ex.
  Offres : 1 à 3 boutons principaux selon le statut, voir `offerMxRowActionsSplit.ts`).
- **Alignée à droite** (`align: 'right'`).
- **`interactive: true`** — arrête la propagation du clic/clavier vers `onRowClick` de la
  ligne (sans ce marqueur, cliquer sur une action ouvrirait aussi la ligne).
- **Marquée `actionsColumn: true`** — active la vérification automatique ci-dessus.

## 5. Garde-fous : `validateMxTableColumns` + avertissement dev

`src/components/mx/mxTableValidation.ts` exporte `validateMxTableColumns<T>(columns):
string[]` — vérifie les deux règles ci-dessus (au plus une colonne flexible ; colonne
`actionsColumn` dernière/largeur fixe/alignée à droite/interactive) et retourne la liste
des violations (vide = conforme). Fichier séparé de `MxTable.tsx` : exporter une fonction
non-composant depuis un fichier qui exporte aussi un composant React casserait le Fast
Refresh (`react-refresh/only-export-components`) — même raison qui a fait extraire
`buildArtistesListMxColumns` dans `artistesListMxColumns.tsx` (§7).

- **En développement**, `MxTable` appelle `validateMxTableColumns` à chaque rendu et
  avertit (`console.warn`) si une violation est détectée — garde-fou immédiat pour tout
  futur appelant, avant même d'écrire un test.
- **Tests de non-régression** (obligatoires pour tout jeu de colonnes réel, pas seulement
  pour la primitive) :
  - `MxTable.test.tsx` — comportement de la primitive (`table-layout:fixed`, `<colgroup>`,
    troncature + `title`, cas de violation synthétiques).
  - `offersMxListColumns.conformance.test.ts` — `buildOffersMxListColumns` (vues « Qui
    doit agir »/« Par jour ») et `buildOffersMxRejectedColumns` (section « Performances et
    offres rejetées »).
  - `ArtistesListMx.conformance.test.ts` — `buildArtistesListMxColumns`.

## 6. Plusieurs sections sur une même page : UNE définition de colonnes partagée

Quand une page empile plusieurs `MxTable` censés s'aligner (ex. Offres, vue « Qui doit
agir » : un groupe par échéance ; vue « Par jour » : une section par jour), la définition
de colonnes (`columns`) doit être construite **une seule fois** par le composant de page et
**réutilisée** telle quelle par chaque instance `MxTable` — jamais reconstruite séparément
par section, même avec un contenu visuellement identique.

En pratique : une fonction exportée `buildXxxColumns(handlers)` (voir §7), appelée une
fois par la page, dont le résultat (`columns`) est passé à chaque `<MxTable
columns={columns} .../>`. Combinée à `table-layout:fixed` (§2), c'est ce qui garantit un
alignement au pixel près entre sections, quel que soit leur contenu respectif.

**Schémas différents = pas de colonnes partagées entre eux.** La section « Performances et
offres rejetées » (page Offres, vue « Par jour ») a un schéma différent (Artiste / Montant
/ Raison / Date de rejet / Actions) de celui des groupes « Qui doit agir » (Heure / Statut
/ Artiste-Scène / Échéance / Actions) : ils ne partagent pas de définition de colonnes
entre eux (données différentes), mais chacun suit indépendamment les règles de largeur/
troncature/colonne d'actions des §2-4.

## 7. Inventaire des usages `MxTable` (Mannyx)

Trois jeux de colonnes réels à ce jour, tous conformes depuis ce lot :

| Builder de colonnes | Fichier | Consommateurs (`<MxTable columns={...} />`) |
| --- | --- | --- |
| `buildOffersMxListColumns(handlers)` | `src/features/booking/offersMxListColumns.tsx` | `OffersActionViewMx.tsx` (vue « Qui doit agir », groupes/sous-sections), `OffersListViewMx.tsx` (vue « Par jour », sections par jour) |
| `buildOffersMxRejectedColumns(onViewHistory)` | `src/features/booking/offersMxListColumns.tsx` | `OffersPageViewMx.tsx` (section « Performances et offres rejetées », vue « Par jour ») |
| `buildArtistesListMxColumns(opts)` | `src/pages/app/artistes/artistesListMxColumns.tsx` | `ArtistesListMx.tsx` (page Artistes, vue tableau) |

Tous deux extraits en fonctions pures exportées (pattern commun, §6) — testables sans
monter la page complète (`*.conformance.test.ts`).

## 8. Tableaux AURA restants (pour mémoire, hors périmètre de ce lot)

`src/components/aura/Table.tsx` est l'ancienne primitive de tableau AURA (pré-Mannyx) —
non touchée par ce lot. Un grand nombre de pages legacy rendent encore un `<table>` HTML
brut, sans passer par aucune primitive partagée (ancienne ou `MxTable`) ; `rg "<table[\s>]"
src` en dénombre une cinquantaine, parmi lesquelles (liste non exhaustive, pour mémoire) :
`ArtistDiscography.tsx`, `TicketingGeographyTab.tsx`, `TicketingCampaignsTab.tsx`,
`TicketingChannelsTab.tsx`, `TicketingPriceCategoriesTab.tsx`, `TicketingDemographicsTab.tsx`,
`TicketingComparisonTab.tsx`, `TicketingTariffsTab.tsx`, `economat.tsx`,
`economatMovements.tsx`, `catering.tsx`, `hotels.tsx`, `TravelList.tsx`, `travel.tsx`,
`timetable.tsx`, `technique.tsx`, `PrestationsSection.tsx`, `personnes.tsx`,
`entreprises.tsx`, `accreditations.tsx`, `agenda.tsx`, `contacts.tsx` (Presse),
`fichiers.tsx`, `InvoicesByDueDate.tsx`, `InvoicesByArtist.tsx`, `OfferComposer.tsx`,
`OfferHistoryModal.tsx`, `OffersPageViewLegacy.tsx`, `riders.tsx`, `detail.tsx` (Artistes).

Ces pages ne sont **pas** migrées par ce lot (hors périmètre explicite : « application à
tous les usages **Mannyx** », T4) — à migrer au fil de leurs propres lots, même logique que
l'inventaire des grilles de cartes en `grid-cols-N` fixe de `DOCTRINE-BARRE-OUTILS.md`
(§5bis).

## 9. Référence d'implémentation

- **`MxTable.tsx`** / **`mxTableValidation.ts`** — primitive + garde-fou, voir le
  commentaire de tête de `MxTable.tsx` pour le détail technique complet.
- **`offersMxListColumns.tsx`** — deux builders de colonnes (Offres « Qui doit agir »/
  « Par jour » partagées, et « Performances et offres rejetées »), première application
  réelle de §6.
- **`artistesListMxColumns.tsx`** — builder de colonnes Artistes.

S'y reporter pour tout nouveau tableau du tronc `MxTable`, et pour toute page qui empile
plusieurs sections censées s'aligner.
