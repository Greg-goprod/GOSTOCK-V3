# Doctrine Vues Cartes/Liste (décision Greg, LOT VUES-CARTES-LISTE, 2026-10-16)

> **Portée.** Ce document fixe le modèle que doit suivre **toute page de liste d'entités**
> du tronc `src/components/mx` — bascule cartes/liste, carte d'entité, et la règle « une
> seule définition des actions, partagée par la ligne, la carte et le drawer ». Il
> complète `DOCTRINE-TABLEAUX.md` (vue liste) par le pendant « vue cartes » et la bascule
> entre les deux.
>
> **Statut.** Décision définitive de Greg, LOT VUES-CARTES-LISTE (2026-10-16). Vaut pour
> TOUTE page de liste d'entités future du tronc Mannyx.

---

## 1. Le principe, en une phrase

**Toute page de liste d'entités propose CARTES (par défaut) et LISTE, avec les MÊMES
données et les MÊMES actions dans les deux vues — `MxEntityCard` pour les cartes, `MxTable`
(voir `DOCTRINE-TABLEAUX.md`) pour la liste — et les actions d'une entité ont UNE SEULE
définition, partagée par la ligne, la carte et le pied du drawer.**

## 2. `MxEntityCard` — carte d'entité unique

`src/components/mx/MxEntityCard.tsx` — tiré de `ContractCardMx` (seul consommateur avant
ce lot). Composition verticale centrée, dans l'ordre : avatar, titre (nom, majuscules),
ligne d'informations séparée par « · » (chaque partie dans son propre `<span>`, séparateurs
en éléments `aria-hidden` SIBLINGS — jamais imbriqués dans le texte d'une partie, pour
rester adressable individuellement par `data-testid`), pastille de statut éventuelle, barre
d'étapes éventuelle (`role="img"`, un segment par étape, coloré jusqu'à l'étape courante),
et une échéance **TOUJOURS rendue** (même sans contenu, emplacement réservé — voir §14 :
hauteur constante entre cartes d'une même grille).

**Actions — §14 (C1.4, 2026-10-17) REMPLACE le `footer` décrit initialement ici** : plus
aucun bouton sur la carte, un menu « ··· » UNIQUE (`menuActions`) en haut à droite —
`MxEntityCard` ne connaît toujours rien des actions d'une entité en particulier, seuls leur
forme (menu) et leur tonalité (succès/danger, transmis tels quels) sont fixées par le tronc.

Racine en `<div role="button" tabIndex={0}>` (PAS un `<button>` natif) : le menu « ··· » rend
son déclencheur en `<button>` natif, et HTML interdit d'imbriquer un `<button>` dans un
`<button>`. `getByRole('button', ...)` matche les deux de façon identique (mapping ARIA),
donc aucune régression pour les tests existants qui ciblaient un ancien `<button>` natif
(ex. `ContractCardMx`).

Toujours affichée dans `MxCardGrid` (grille à paliers de largeur de conteneur, 8 colonnes
au-dessus du seuil — voir `internal/mxGridBreakpoints.ts`), jamais une grille CSS ad hoc
propre à une page.

## 3. Bascule cartes/liste — `MxEntityViewToggle` + `mxViewModeStorage`

**Composant unique** : `src/components/mx/MxEntityViewToggle.tsx` — enveloppe `MxSegmented`
avec deux valeurs FIXES (`'cards'`/`'list'`, jamais résolues par i18n : l'uniformité entre
pages est précisément l'exigence, laisser chaque page choisir ses propres clés i18n a été
identifié comme la source de la divergence que ce lot corrige), icônes `Grid3x3`/`List` et
libellés « Cartes »/« Liste » IDENTIQUES sur toute page qui l'utilise. Rendu en mode
`iconOnly` (libellé = `aria-label`/`title`, pas de texte visible), placé dans l'emplacement
`view` de `MxToolbar`.

**Persistance** : `src/components/mx/mxViewModeStorage.ts` — `readMxViewMode<T>(storageKey,
validValues, fallback)` / `writeMxViewMode<T>(storageKey, value)`, génériques, CHAQUE
fonction protégée par son propre `try/catch` (jamais de propagation d'erreur `localStorage`
— quota dépassé, navigation privée). Une page peut avoir PLUSIEURS axes de bascule
indépendants sous des clés DISTINCTES (ex. Offres : « Qui doit agir »/« Par jour »
ET « Cartes »/« Liste »).

**CARTES par défaut** (décision de Greg) : toute clé de stockage de ce lot utilise
`'cards'` comme `fallback` — Offres (`mx-offers-card-view-mode`), Contrats
(`mx-contrats-card-view-mode`), Artistes (`mx-artistes-card-view-mode`, valeurs internes
`'grid'`/`'list'` pour compatibilité avec le contrat partagé `ArtistesPageViewProps`,
mappées à la frontière du rendu — voir §6).

## 4. Actions : une seule définition par type d'entité

**Règle.** Toute action disponible sur une ligne de tableau ou une carte DOIT aussi être
disponible dans le pied du drawer de l'entité correspondante — aucune action ne doit
disparaître en changeant de vue, ni être absente du drawer. Une seule fonction/composant
définit les actions d'un type d'entité ; ligne, carte et pied de drawer le CONSOMMENT, ils
ne redéfinissent jamais leur propre liste.

**Tableau comparatif (état constaté avant ce lot — déjà conforme, aucune action à ajouter)** :

| Entité | Définition unique | Ligne (`MxTable`) | Carte (`MxEntityCard`) | Pied du drawer |
| --- | --- | --- | --- | --- |
| Offre | `OfferMxRowActionsBar` (matrice `getOfferMxRowActionFlags`) | `buildOffersMxListColumns` → colonne `actions` (`layout="pack"`) | `OfferCardMx` → `menuActions` (`buildOfferCardMenuActions`, §14) | `OfferDrawerMx` → rend `OfferMxRowActionsBar` directement, mêmes handlers |
| Contrat | *(aucune — le contrat n'a pas d'action de ligne/carte)* | `buildContratsMxListColumns` — pas de colonne actions | `ContractCardMx` — pas de `menuActions` | `ContractDrawerMx` → `MxEntityActionFooter` (`annotate`/`send-for-signature`/`send-to-artist`/`settle-cancellation`/`delete`, calculés par statut) |
| Artiste | `RowActionsMenu` (`ArtistesListMx.tsx`) : `edit`/`archive`/`unarchive`/`delete`, mêmes clés i18n | `artistesListMxColumns.tsx` → colonne `actions`, rend `RowActionsMenu` | `ArtistCard` (interne à `ArtistesListMx.tsx`) → rend `RowActionsMenu` — patron REPRIS tel quel par `MxEntityCard.menuActions` en §14 | `ArtistDetailDrawerMx` → `MxEntityActionFooter`, mêmes clés i18n/mêmes conditions (`canEdit`/`canArchive`/`canDelete`) |

Pour les Offres et les Artistes, la définition unique existait déjà avant ce lot (lots
TABLE-MODELE et ARTISTES-SUPPRESSION) — ce lot l'étend à la carte (`OfferCardMx`, nouvelle,
réutilise `OfferMxRowActionsBar` en `layout="spread"`) et verrouille la parité par un test
automatisé (`artistesActionsParity.test.tsx`, qui rend `RowActionsMenu` et le pied du
drawer pour un artiste ACTIF puis ARCHIVÉ et compare l'ensemble des libellés). Pour les
Contrats, l'ensemble vide de la ligne/carte est trivialement inclus dans tout ensemble
d'actions du drawer — aucune action supplémentaire requise côté drawer.

## 5. Vue par page (état après ce lot)

| Page | Cartes | Liste | Composant de carte | Builder de colonnes |
| --- | --- | --- | --- | --- |
| Offres (« Qui doit agir ») | `OfferCardMx` dans `MxCardGrid`, mêmes groupes/sous-sections que la liste | `buildOffersMxListColumns` | `OfferCardMx` | `buildOffersMxListColumns` |
| Offres (« Par jour ») | idem, mêmes sections par jour | idem | `OfferCardMx` | `buildOffersMxListColumns` |
| Contrats | `ContractCardMx` (inchangée), mêmes groupes (« À traiter », « En attente », « Terminés ») | `buildContratsMxListColumns`, mêmes groupes | `ContractCardMx` | `buildContratsMxListColumns` |
| Artistes | `ArtistCard` (interne, inchangée) | `buildArtistesListMxColumns` (inchangé, lot TABLE-MODELE) | `ArtistCard` | `buildArtistesListMxColumns` |

Dans les trois pages, le clic sur une ligne ou une carte ouvre le MÊME drawer — aucune
logique d'ouverture dupliquée entre les deux vues (chaque page transmet le même
`onOpenContract`/`onRowClick`/`onArtistClick` aux deux rendus).

## 6. Contraintes de compatibilité rencontrées

- **`ArtistesPageViewProps` partagé entre la branche Legacy et la branche Mx** (même état
  `viewMode: 'grid' | 'list'`, même `setViewMode`, consommés par les DEUX branches dans
  `index.tsx`) : retouche ciblée — `ArtistesListMx.tsx` mappe `'grid' ↔ 'cards'` à la
  frontière du rendu (prop `MxEntityViewToggle.value`/`onChange`), le contrat partagé avec
  la branche Legacy reste `'grid' | 'list'`, inchangé.
- **Accessible name calculée** : un descendant `role="img"` (avatar de repli, barre
  d'étapes) contribue son propre `aria-label` au nom accessible calculé de l'ancêtre
  `role="button"` — les tests qui ciblent une carte par son nom accessible utilisent une
  correspondance partielle (regex), jamais une égalité stricte.

## 7. Garde-fous et tests

- **Parité table/cartes, aucune entité perdue** : `offersMxCardsListParity.test.tsx`,
  `contratsCardsListParity.test.tsx` — comparent l'ensemble des entités affichées dans les
  deux modes pour le MÊME jeu de données.
- **Cartes par défaut** : assertions dans `OffersPageViewSmoke.test.tsx`,
  `ContratsPageViewMx.smoke.test.tsx`, `ArtistesListMx.test.tsx` — `localStorage` vidé
  avant chaque test, la bascule affiche « Cartes » coché.
- **Persistance** : `mxViewModeStorage.test.ts` (fonctions génériques), `index.test.tsx`
  (Artistes — survit à un remontage).
- **Actions identiques ligne/carte/drawer** : `artistesActionsParity.test.tsx` (V4, voir
  §4) ; pour les Offres, `OfferCardMx.test.tsx` vérifie que le menu « ··· » de la carte
  expose les mêmes actions (mêmes libellés, mêmes tons) que la ligne pour un statut donné
  (depuis C1.4, §14 : plus aucun bouton visible sur la carte elle-même).

## 8. Inventaire des autres pages de liste d'entités (V5 — hors périmètre de ce lot)

Pages qui listent des entités (une ligne/carte = un enregistrement métier) sans passer par
`MxEntityCard`/`MxTable`/`MxEntityViewToggle` à ce jour — à aligner au fil de leurs propres
lots, même logique que l'inventaire des tableaux AURA restants de `DOCTRINE-TABLEAUX.md`
§8 :

| Domaine | Pages |
| --- | --- |
| CRM / Contacts | `contacts/personnes.tsx`, `contacts/entreprises.tsx` |
| Presse | `presse/contacts.tsx`, `presse/accreditations.tsx`, `presse/fichiers.tsx`, `presse/agenda.tsx` |
| Staff | `staff/contractors.tsx`, `staff/benevoles.tsx`, `staff/campaigns.tsx` |
| Production — Ground | `production/ground/vehicules.tsx`, `chauffeurs.tsx`, `missions.tsx`, `runs.tsx` |
| Production — Hospitality | `production/hospitality/catering.tsx`, `economat.tsx`, `economatMovements.tsx`, `hotels.tsx`, `loges/*.tsx` (5 vues) |
| Production — autres | `production/guestlist.tsx`, `production/technique.tsx`, `production/timetable.tsx`, `production/travel.tsx`, `production/touring-party.tsx`, `production/partycrew.tsx`, `production/admin-artist.tsx` |

## 9. Référence d'implémentation

- **`MxEntityCard.tsx`** — carte d'entité générique, voir §2.
- **`mxViewModeStorage.ts`** / **`MxEntityViewToggle.tsx`** — bascule + persistance, §3.
- **`OfferCardMx.tsx`**, **`ContractCardMx.tsx`**, **`ArtistCard`** (interne à
  `ArtistesListMx.tsx`) — cartes par entité.
- **`contratsMxListColumns.tsx`** — builder de colonnes Contrats (nouveau, ce lot).
- **`DOCTRINE-TABLEAUX.md`** — pendant « vue liste » de cette doctrine.
- **`artistPhoto.ts`**, **`MxGroup.tsx`** — voir §10 (LOT C2).

S'y reporter pour toute nouvelle page de liste d'entités, et pour l'alignement des pages de
l'inventaire §8.

## 10. C2 — photo d'artiste partagée et hiérarchie des groupes (Greg, 2026-10-17)

Recette sur **données réelles** (VENOGE FESTIVAL 2027) : deux régressions relevées, toutes
deux invisibles sur données fictives construites à la main (le champ lu y était rempli par
la vérification elle-même).

### 10.1 Photo d'artiste — une seule fonction, `src/lib/artistPhoto.ts`

**Constat.** La carte Offre affichait des initiales pour des artistes qui ONT une photo
(Kim Wilde, Black Eyed Peas, Jain, Pierre de Maere, Yann Muller, Supremnova…), alors que la
carte de Contrat du MÊME artiste affichait bien la sienne.

**Cause.** `spotify_data` n'est PAS une colonne JSONB de `artists` : c'est une TABLE séparée
(`spotify_data.artist_id -> artists.id`), embarquée côté PostgREST par la syntaxe
`spotify_data(image_url)`. `useArtistAvatarMap` et `OfferDrawerMx` sélectionnaient
`'spotify_data'` NU (sans les parenthèses d'embed) — une requête PostgREST invalide (400),
dont l'erreur était avalée silencieusement (`try/catch` reset à vide ; `error` jamais
vérifié) : tout artiste retombait sur les initiales, photo réelle ou non. `contrats.tsx`, de
son côté, a toujours utilisé le bon embed (`artists!inner(id, name, spotify_data(image_url))`)
— d'où l'écart.

**Règle, à compter de ce lot.** `src/lib/artistPhoto.ts` est la SEULE source de vérité pour
la photo d'un artiste, utilisée PARTOUT (cartes, drawers, listes) :
- `ARTIST_PHOTO_SELECT_FRAGMENT` (`'spotify_data(image_url)'`) — fragment de `select()`
  PostgREST, littéral unique, jamais récrit à la main dans un appelant.
- `extractArtistPhotoUrl(row)` — extraction pure depuis une ligne embarquant ce fragment,
  tolérante à la forme objet (un-vers-un) et tableau (défensif).

Consommateurs : `useArtistAvatarMap` (corrigé), `OfferDrawerMx` (corrigé, `error` désormais
vérifié), `contrats.tsx` (ses 3 extractions inline `X.artists?.spotify_data?.image_url ||
null` remplacées par des appels à `extractArtistPhotoUrl`, alors même que sa requête était
déjà correcte — un seul point d'extraction, pas une syntaxe dupliquée qui se trouve juste
être correcte à 3 endroits).

**Vérification (lecture seule, données réelles).** Pour les artistes de l'édition VENOGE
FESTIVAL 2027 (`event.id = 9a128b3a-d873-4e59-9b84-6da3c88ab7be`), jointure directe
`offers → artists → spotify_data` : tous les artistes réels de la programmation (Kim Wilde,
Black Eyed Peas, Jain, Pierre de Maere, Yann Muller, Supremnova, Bello&Dallas, Eva, Georgio,
HOSHI, Lionel Richie, MERYL, Ninho, NISKA, Orelsan, RNBOI, Sam Sauvage, SDM, Sting, Tiakola,
TRIANGLE DES BERMUDES…) ont un `image_url` non nul ; seuls les artistes de test/placeholder
(« AARTISTE TEST », « La Rvfleuze », « NON DEFINI ») n'en ont pas — c'est cette table qui
fait foi, et c'est elle que `extractArtistPhotoUrl` restitue désormais, identique pour la
carte Offre et la carte Contrat (voir `artistPhotoCardParity.test.tsx`).

### 10.2 Hiérarchie des groupes — `MxGroup`, `src/components/mx/MxGroup.tsx`

**Constat.** Les intitulés d'ÉTAPE (« Offres à établir », « Prêtes à envoyer », « Expirées »
côté Offres ; « Des agences · À recevoir » côté Contrats) étaient à peine visibles : rendus
en `MxSectionLabel`/`MX_TEXT.segmentedLabel`, un gris tertiaire (`--mx-text3`) à 11-12px,
SOUS la taille du corps de texte (`--mx-fs-body`, 13.5px) — alors qu'ils portent la
compréhension du parcours.

**Hiérarchie à deux niveaux**, désormais explicite :
- **Niveau 1, la SECTION** (« À traiter par vous », « En attente de l'agent »…) —
  INCHANGÉ, reste porté par le `GroupHeader` propre à chaque page (`MX_TEXT.blockTitle`,
  16px/700, MAJUSCULES + tracking).
- **Niveau 2, l'ÉTAPE** — `MxGroup` (nouveau, tronc `--mx-*`). Un bloc LÉGER qui enveloppe
  la grille de cartes ou le tableau de l'étape : fond à peine différencié (`--mx-surface2`),
  bord fin (`--mx-border`), coin arrondi (`--mx-radius-8`) — sans alourdir les cartes
  qu'il contient (pas de fond saturé, pas d'ombre). En tête : titre en texte PRINCIPAL
  (`--mx-text`, jamais `--mx-text3`), `MX_TEXT.blockTitle` (16px/700 — le seul palier ACTIF
  de l'échelle au-dessus du corps de texte, aucun palier intermédiaire n'existe) en CASSE
  PHRASE (pas de majuscules/tracking — seule différence volontaire avec le niveau 1, qui
  reste en capitales : à taille typographique égale, l'absence de capitales suffit à lire
  « un cran en dessous » sans inventer un token de taille hors échelle) ; une pastille de
  ton (`mxToneDot`) précède le titre, MÊME couleur que le liseré des cartes de l'étape ;
  un compte (`MxBadge`) le suit, en élément SÉPARÉ (jamais concaténé dans le texte du
  titre).

**Consommateurs** : Offres « Qui doit agir » (4 sous-sections : établir/brouillons/
prêtes/expirées, ton dérivé de `OFFER_GROUP_TONE` via `offersActionGrouping.ts`), Offres
« Par jour » (un groupe par jour, `tone` omis — un jour n'a pas de ton d'étape), Contrats
(les 6 étapes de `STEP_ORDER`, ton `STATUS_TONE[step]`) — EN CARTES ET EN LISTE, le même
`MxGroup` enveloppe indifféremment `MxCardGrid` ou `MxTable` ; seul le RENDU interne change,
jamais l'en-tête ni l'habillage du bloc. Le gap ENTRE instances de `MxGroup` reste porté par
le conteneur de chaque page (déjà uniforme à `var(--mx-space-24)` sur les 3 vues avant ce
lot, inchangé ici).

**Tests.** `MxGroup.test.tsx` (contrat du composant : titre/ton/compte/bloc léger, avec et
sans ton, grille ou tableau en enfant) ; `offersMxCardsListParity.test.tsx` (§ C2.2 —
« Offres à établir » rendue par `MxGroup` à l'identique en `table` et en `cards`) ;
`ContratsListMx.test.tsx` (titre d'étape en texte principal + pastille + compte, remplace
l'ancien test C2.1 qui verrouillait l'ancienne typographie, devenue caduque).

## 11. C3 — recette données réelles : avatars, pastille (Greg, 2026-10-17)

Recette Greg, seconde passe sur **données réelles**. Deux correctifs, tous dans le tronc
`src/components/mx` — aucune page appelante à modifier pour en bénéficier. (Un troisième
correctif de cette passe, la barre d'outils collante, a été RETIRÉ au lot C5 — voir §13.)

### 11.1 Avatars — jamais de cercle vide, `MxAvatar`

**Constat.** Cercle VIDE (ni initiales, ni photo) sur des artistes dont la photo existe
réellement en base (Yann Muller, Supremnova, Pierre de Maere sur les Offres ; Ninho, Naza,
Pink Martini, Pierre de Maere sur la page 2 des Artistes).

**Cause.** `MxAvatar` décidait `showImage = !!src && !imageError` : dès que `src` était
renseigné, l'`<img>` était rendue IMMÉDIATEMENT, avant même que le navigateur ait fini de la
récupérer — pendant cette fenêtre réseau, le cercle restait vide (ni le repli initiales, ni
la photo). Le repli initiales n'intervenait QUE sur `onError`, jamais pendant le
chargement.

**Correctif.** Un second état, `imageLoaded` (posé par `onLoad`) : les initiales restent
affichées tant que l'image n'est PAS chargée, ET si elle échoue (`onError`) — la photo ne
remplace les initiales qu'une fois `onLoad` effectivement déclenché. L'`<img>` reste
néanmoins toujours MONTÉE dès que `src` existe et n'a pas encore échoué (`display:none` le
temps du chargement, sans empêcher la récupération réseau en arrière-plan). `loading="lazy"`
ajouté. Un changement de `src` sans démontage (nœud recyclé par une liste, drawer qui change
d'artiste) réinitialise `imageError`/`imageLoaded` — sinon l'état de l'URL précédente
resterait collé à la nouvelle.

`MxAvatar` étant la SEULE primitive d'avatar du tronc (cartes, drawers, listes — voir son
en-tête), ce correctif s'applique PARTOUT sans modification des pages appelantes.

**Vérification (lecture seule, données réelles).** Jointure `artists ⟕ spotify_data` pour
les artistes cités par Greg :

| Artiste | `image_url` | Dernière synchro |
| --- | --- | --- |
| Yann Muller | `https://i.scdn.co/image/…0848dd` | 2026-10-17 |
| Supremnova | `https://i.scdn.co/image/…e71419` | 2026-10-17 |
| Pierre de Maere | `https://i.scdn.co/image/…02cd` | 2026-10-17 |
| Ninho | `https://i.scdn.co/image/…6662` | 2026-10-17 |
| Naza | `https://i.scdn.co/image/…80c17` | 2026-10-17 |
| Pink Martini | `https://i.scdn.co/image/…db720` | 2026-10-17 |

Les 6 ont une URL `image_url` non nulle, hébergée sur le CDN Spotify (`i.scdn.co`),
resynchronisée le jour même de la recette — AUCUN lien mort ni donnée manquante en base :
le cercle vide constaté par Greg est intégralement expliqué par le défaut de chargement
ci-dessus, pas par une adresse cassée ou lente. La disponibilité réseau RÉELLE de ces URLs
(code HTTP, latence) n'a PAS pu être vérifiée depuis cet environnement d'agent, qui n'a
aucun accès réseau sortant vers des domaines externes (constaté lot C2 : `fetch()` vers
`i.scdn.co` échoue avec `TypeError: Failed to fetch`) — à vérifier depuis un poste avec
accès réseau si un doute subsiste sur la disponibilité de ce CDN.

**Tests.** `MxAvatar.test.tsx` — repli initiales pendant le chargement (`<img>` montée mais
masquée), bascule vers la photo sur `onLoad`, repli définitif sur `onError`, réinitialisation
sur changement de `src`. `artistPhotoCardParity.test.tsx` mis à jour (déclenche `onLoad`
avant de lire la photo affichée, cohérent avec le nouveau contrat).

### 11.2 Pastille de compte — même traitement pour tous les tons, `MxGroup`

**Constat.** « Expirées 4 » sans pastille visible : le chiffre restait lisible mais sans
contour de badge perceptible — alors que d'autres étapes (tons saturés) gardaient une
pastille nettement visible.

**Cause.** `MX_TONE_FILL.neutral.bg` vaut `var(--mx-surface2)` (« pas d'aplat saturé »,
`tokens-mx.css`) — EXACTEMENT le fond du bloc `MxGroup` lui-même (choisi en C2.2, §10.2). Un
badge de compte au ton `neutral` (étape « fermée », ex. Expirées/Clôturées) devenait donc un
fond sur fond IDENTIQUE : la forme de pastille disparaissait visuellement, même si le texte
du nombre restait lisible (`--mx-text2` sur `--mx-surface2`).

**Correctif.** Un bord fin (`var(--mx-border-w-thin) solid var(--mx-border)`) sur le badge
de compte rendu par `MxGroup`, posé pour TOUS les tons — pas une exception pour `neutral`
seul : « même pastille pour toutes les étapes » (consigne de Greg). Un contour discret, qui
ne dégrade pas les tons déjà saturés (fond déjà visible) et rend le ton neutre tout aussi
délimité que les autres.

**Tests.** `MxGroup.test.tsx` — le compte au ton `neutral` (ex. « Expirées ») garde un bord
visible malgré un fond identique à celui du bloc ; le bord est le MÊME quel que soit le ton
(`accent` vs `neutral` comparés directement).

## 12. C4 — recette données réelles : régression photo (Greg, 2026-10-17)

Troisième passe de recette Greg, sur **données réelles**. Un correctif, qui annule une
régression introduite par le C3.2 ci-dessus. (Cette passe comportait aussi un correctif du
bandeau de commande collant, RETIRÉ au lot C5 avec la barre elle-même — voir §13.)

### 12.1 Photos — régression C3.2 : `display:none` + `loading="lazy"` ne chargent JAMAIS

**Constat.** Après C3, TOUTES les cartes (Contrats compris, qui affichaient les photos
correctement AVANT C3) ne montraient plus que des initiales — les photos ne se chargeaient
plus nulle part.

**Cause.** Le correctif C3.2 masquait l'`<img>` par `display:none` tant qu'elle n'était pas
chargée, combiné à `loading="lazy"`. Un élément en `display:none` n'a JAMAIS de boîte de
mise en page : il n'entre donc jamais dans la zone visible, condition que `loading="lazy"`
exige pour déclencher la récupération réseau — l'image ne se chargeait donc tout simplement
JAMAIS, quelle que soit la validité de son URL. C'est un fait de plateforme web, pas une
particularité de ce projet.

**Correctif, `MxAvatar`.** L'`<img>` n'est plus JAMAIS en `display:none` : elle reste
TOUJOURS montée en boîte normale (donc visible pour la détection de `loading="lazy"`),
superposée en position absolue par-dessus les initiales (`position:relative` sur la racine),
opacité `0` jusqu'à `onLoad`, puis `1` — les initiales restent dessous en permanence, rendues
visibles tant que l'opacité de la photo est nulle, sans jamais être démontées.
`aria-hidden="true"` sur l'`<img>` tant qu'elle n'est pas affichée (opacité 0) : elle ne doit
pas s'exposer comme une seconde image dans l'arbre d'accessibilité pendant le chargement ;
retiré une fois `onLoad` déclenché. Repli initiales définitif sur `onError`, inchangé.
`MxAvatar` étant la seule primitive d'avatar du tronc, ce correctif s'applique PARTOUT —
Offres, Contrats, Artistes — sans modification des pages appelantes.

**Tests.** `MxAvatar.test.tsx` — l'`<img>` est présente et jamais `display:none` avant
`onLoad` (opacité 0, `aria-hidden`) ; bascule à l'opacité 1 (et `aria-hidden` retiré) une fois
`onLoad` déclenché, initiales toujours montées en dessous. `artistPhotoCardParity.test.tsx`
mis à jour (commentaire seulement — le test ciblait déjà l'`<img>` par sélecteur CSS,
inchangé par le passage de `display:none` à l'opacité).

## 13. C5 — retrait de la barre collante (Greg, 2026-10-17)

**Décision de Greg.** La barre collante posée sur `MxToolbar` en C3.1 (sticky, `top: 0`) puis
corrigée en C4.2 (débordement sur le padding de l'ancêtre défilant, `top: -bleed.top`, ombre
au défilement) est **ABANDONNÉE** au profit d'une zone de commande intégrée à l'en-tête de
page — sujet d'un lot dédié, hors périmètre de cette doctrine. Les anciennes sections §11.1
et §12.2 (décrivant cette mécanique) sont retirées du présent document ; leur contenu reste
consultable dans l'historique Git si besoin de contexte.

**Retrait, `MxToolbar`.** Retour à la mise en page STATIQUE d'avant C3.1 (HEAD `84c399d`) :
plus aucune `position`, `z-index`, fond, ombre, marge négative ni `padding` compensateur sur
la racine — ni écouteur `scroll`/`resize`, ni `ResizeObserver`. Structure du composant
(emplacements `search`/`filters`/`pagination`/`view`/`primary`/`band`) INCHANGÉE : seule la
mise en page de la racine perd ses propriétés de positionnement. Aucune page appelante
(Offres, Contrats, Artistes) à modifier — le retrait, comme l'ajout en son temps, vit
entièrement dans le tronc.

**Conservé de C2/C3/C4** (hors barre collante) : `MxEntityCard`/`MxEntityViewToggle`/
`mxViewModeStorage` (§2-3), `MxGroup` et sa hiérarchie de groupes (§10.2), le correctif
photo partagé `artistPhoto.ts` (§10.1), le correctif `MxAvatar` anti-cercle-vide puis sa
réécriture C4.1 sans `display:none` (§11.1, §12.1), le bord de pastille uniforme (§11.2).

**Tests.** `MxToolbar.test.tsx` — les blocs de tests dédiés à la position (sticky, débordement,
ombre) sont retirés ; deux tests les remplacent, verrouillant l'ABSENCE de toute propriété de
position/fond/marge sur la racine, y compris à l'intérieur d'un ancêtre défilant avec padding
(pour empêcher toute réintroduction involontaire du débordement C4.2).

## 14. C1.4 — LOT OFFRES-CYCLE : carte = menu « ··· » seul (Greg, recette du 17/10/2026)

**Décision de Greg, REMPLACE le modèle « pied d'actions » décrit en §2/§4 ci-dessus** : une
carte d'entité n'affiche plus AUCUN bouton. Toutes ses actions — qu'elles aient été
« principales » (visibles) ou « de débordement » dans l'ancien modèle de pied — rejoignent
UN SEUL menu « ··· », en HAUT À DROITE de la carte : même emplacement et même patron que le
menu `RowActionsMenu`/`ArtistCard` des cartes d'artiste (§4), désormais généralisé à
`MxEntityCard` lui-même plutôt que réimplémenté par chaque carte qui en a besoin.

**`MxEntityCard` — contrat mis à jour.** La prop `footer?: ReactNode` est SUPPRIMÉE ;
remplacée par `menuActions?: MxEntityCardMenuAction[]` (`{ id, label, icon?, onSelect,
disabled?, tone? }`) et `menuLabel?: string` (aria-label du menu ET de son déclencheur, ex.
« Actions pour {nom} »). Absent/vide : aucun menu rendu (pas de régression pour un
consommateur sans action, ex. `ContractCardMx`, qui n'a jamais eu de `footer`). Le
déclencheur reprend tel quel `ROW_MENU_TRIGGER_STYLE`/`MoreVertical` d'`ArtistCard`.

**Tons — définition UNIQUE par action, appliquée partout.** `tone?: 'success' | 'danger'`
sur `MxEntityCardMenuAction` ET sur `MxMenuAction` (menu de débordement de
`MxEntityActionFooter`, pied de carte/liste des autres entités) : un succès (« Accepter »,
« Valider sans renvoi ») est TOUJOURS vert, un danger (« Refuser », « Rejeter »,
« Supprimer ») TOUJOURS rouge — dans le menu de carte, dans le menu de débordement d'une
ligne/d'un pied de drawer, ET sur un bouton visible (`MxButton`, nouveau variant `success` à
côté de `danger`, déjà existant). Posé UNE SEULE fois dans la définition d'action de
l'entité (ex. `OfferMxRowActionsBar.buildActionSpecs` pour les Offres), jamais redéfini par
un consommateur. Correctif associé : `MxEntityActionFooter.resolveVisibleVariant()`
promouvait auparavant la DERNIÈRE action visible en bleu (`primary`) quelle que soit sa
variante déclarée — un ton explicite (`success`/`danger`) est désormais TOUJOURS respecté,
y compris en dernière position.

**Échéance toujours réservée.** La ligne d'échéance (`due`) est désormais rendue
INCONDITIONNELLEMENT (conteneur à hauteur minimale fixe même sans contenu) : deux cartes
d'une même grille, l'une avec échéance affichée et l'autre sans, gardent la MÊME hauteur —
avant ce correctif, le conteneur lui-même n'existait pas quand `due` était absent, d'où
l'écart de hauteur constaté en recette.

**Consommateurs à ce jour.** `OfferCardMx` (toutes les actions de `OfferMxRowActionsBar`,
combinées via `buildOfferCardMenuActions` — primaires puis débordement, même ordre que la
ligne). `ContractCardMx` : aucune action à ce jour, `menuActions` non fourni — aucun
changement visible, bénéficie seulement de l'échéance toujours réservée (qui n'a ici jamais
de contenu).

**Tests.** `MxEntityCard.test.tsx` — le menu rend les actions fournies (aucun bouton visible
hors menu), une action désactivée est retirée (jamais affichée grisée), l'échéance réserve
sa hauteur même absente. `OfferCardMx.test.tsx` / `offersMxCardsListParity.test.tsx` — plus
aucun bouton visible sur la carte, le menu « ··· » contient la totalité des actions
attendues pour chaque statut.

## 15. LOT SECTIONS-REPLIABLES — `MxCollapsibleSection`, uniformité des sections « sorties du circuit » (Greg, 18/10/2026)

**Constat de Greg.** Les éléments sortis du circuit normal n'étaient pas présentés pareil
d'une page à l'autre : Contrats « Contrats annulés (4) » — accordéon replié, bouton
composé à la main ; Offres « Qui doit agir » → « Refusées 12 » — accordéon d'un autre
style (`CollapsibleGroup`, local à `OffersActionViewMx.tsx`) ; Offres « Par jour » →
« Performances et offres rejetées 13 » — bloc TOUJOURS ouvert, liseré et compteur rouges,
rendu en tableau même en vue cartes. Les deux vues Offres affichaient en plus des COMPTES
différents pour la même notion (« Refusées ») — voir ci-dessous.

**Décision de Greg.** Un seul composant, `MxCollapsibleSection`
(`src/components/mx/MxCollapsibleSection.tsx`) : replié par défaut, en-tête identique
partout (chevron, icône, titre, compteur neutre — **aucune couleur d'alerte**), état
ouvert/fermé mémorisé par page (`localStorage`, même fonction générique que §3 —
`readMxViewMode`/`writeMxViewMode`, réutilisée telle quelle). Une fois ouvert, le CONTENU
suit la vue choisie par la page (`MxEntityCard`/`MxCardGrid` en cartes, `MxTable` en
liste) — le composant ne décide que du repli, jamais du rendu interne (`children`).

**Deux modes.** Non contrôlé (défaut) : état possédé par le composant, clé `storageKey`.
Contrôlé (`open`+`onToggle`) : l'état reste possédé par l'appelant — nécessaire pour
Contrats, dont l'ouverture par défaut obéit à une règle métier existante (LOT
CONTRATS-GRILLE ET ANNULATION, G3, 2026-10-09 : ouvert tant qu'une annulation SIGNÉE n'est
pas réglée) partagée avec la branche Legacy (`contrats.tsx` reste la source de vérité,
`MxCollapsibleSection` n'en est que l'habillage visuel commun — la persistance
`localStorage` a été ajoutée À LA SOURCE, dans `userToggledCancelled`, bénéficiant aux deux
branches).

**Appliqué à ce lot.**

| Section | Avant | Après |
| --- | --- | --- |
| Contrats « Contrats annulés » | Bouton composé à la main (`ContratsPageViewMx.tsx`), toujours cartes | `MxCollapsibleSection` (mode contrôlé, G3 inchangée), cartes/liste selon `cardViewMode` (nouvelle `buildCancelledContractsMxColumns`, pas de colonne « Étape » — `STEP_ORDER` ne connaît pas `'cancelled'`) |
| Offres « Qui doit agir » → Refusées | `CollapsibleGroup` local, bucket `rejected` reclassé ligne à ligne par `groupOffersByAction` à partir de `unifiedOffers` | `OffersRejectedSectionMx` (composant partagé avec « Par jour »), alimenté DIRECTEMENT par la liste canonique `rejectedOffers` |
| Offres « Par jour » → Performances et offres rejetées | `MxSection accent="danger"`, toujours ouvert, tableau même en vue cartes | `OffersRejectedSectionMx` — MÊME composant, MÊME titre (« Refusées »), cartes/liste selon `cardViewMode` |

**Libellé unique.** « Refusées » dans les deux vues Offres (remplace « Performances et
offres rejetées » côté « Par jour »).

**Actions préservées.** Réactiver/Voir — définition UNIQUE (`handlers` complet transmis à
`OfferCardMx` en cartes, `buildOffersMxRejectedColumns(handlers.onViewRejectedHistory,
handlers.onReactivateOffer)` en liste). Correctif associé : le menu « ··· » de la carte
(`buildOfferCardMenuActions`) n'exposait PAS « Voir » pour une offre refusée (présent
seulement en bouton visible sur la ligne) — ajouté à la même définition.

**L'écart de comptage 12/13, expliqué et éliminé.** Les deux vues reclassaient
INDÉPENDAMMENT ce qui compte comme « refusé » : « Par jour » lisait directement la liste
canonique `rejectedOffers` (`booking.tsx`, dédupliquée par chaîne de versions PUIS par
`artist_id` — priorité à l'offre sur la performance) ; « Qui doit agir » reclassait
CHAQUE LIGNE de `unifiedOffers` via `classifyGroup()` (`raw === 'rejected' ||
raw === 'offre_rejetee'`). Un mécanisme CONFIRMÉ de divergence, reproduit en base (lecture
seule, `user-supabase`, événement `9ab30f88-9e41-4a3b-bd34-6863cb843454`) : une performance
refusée SANS offre liée (`booking_status = 'offre_rejetee'`, ex. performances
`367e9549-387f-46d7-b5d6-fe8bd89da15e` / `86ed6864-4a0e-449b-958d-4b988ae5a33b`) traversait
le filtre de `offersListRows` — qui n'excluait QUE le statut anglais `'rejected'`, jamais
son équivalent français — et restait donc visible dans les blocs-jour SOUS SON PROPRE ID
(`perf_<uuid>`), EN PLUS de son entrée canonique dans `rejectedOffers` (id `<uuid>`, SANS
préfixe, via `rejectedPerfItems`) : deux IDs différents pour la MÊME performance, invisibles
l'un à l'autre pour le dédoublonnage par id de `mergeOffersMxDisplayRows`. Corrigé en deux
temps : (1) le filtre exclut désormais aussi `'offre_rejetee'` (prédicat extrait et testé,
`offersListRowsFilter.ts`) ; (2) architecturalement, « Qui doit agir » ne reclasse plus AUCUNE
ligne en « refusée » (`groupOffersByAction` les exclut de tous ses groupes) — les deux vues
consomment désormais la MÊME liste `rejectedOffers`, sans aucun recalcul indépendant : le
compte et les éléments sont identiques PAR CONSTRUCTION, plus par coïncidence de données.

**Tests.** `MxCollapsibleSection.test.tsx` — replié par défaut, mémorisation localStorage
(try/catch si indisponible), mode contrôlé, compteur neutre. `offersActionGrouping.test.ts` —
aucune ligne refusée dans un groupe de `groupOffersByAction`. `offersMxViewsBijection.test.ts`
— bijection étendue à Refusées (même liste des deux côtés). `offersListRowsFilter.test.ts` —
régression du filtre (`offre_rejetee` exclu). `ContratsPageViewMx.smoke.test.tsx` — section
repliée/ouverte selon `showCancelled`, clic délègue à `setShowCancelled` (mode contrôlé).

## 16. S4 — Inventaire des autres sections « sorties du circuit » (2026-10-18, état après C1)

Sections qui retirent des éléments du flux normal d'une page (archivage, annulation, statut
terminal...) — mises à jour après le LOT SECTIONS-REPLIABLES — C1 (§17) :

| Section | Page | Constat |
| --- | --- | --- |
| Offres « Idées » | `OffersActionViewMx.tsx` (vue « Qui doit agir ») | **RÉSOLU (C1.1, 18/10/2026)** — migré vers `MxCollapsibleSection` (`CollapsibleGroup` local supprimé). |
| Contrats « Finalisés » (terminés) | `ContratsListMx.tsx` (groupe de fin de liste, statut `finalized`) | **RÉSOLU (C1.1, 18/10/2026)** — migré vers `MxCollapsibleSection` ; l'ancien en-tête (avatars empilés + résumé de noms + lien « Afficher/Masquer ») a disparu au profit du même en-tête que toutes les autres sections repliables. |
| Artistes « archivés » | `ArtistesListMx.tsx` | **HORS PÉRIMÈTRE (C1.4, confirmé)** — pattern DIFFÉRENT (filtre de statut + pastille `MxStatusPill`), pas une section séparée retirée du flux : ne sera pas migré vers `MxCollapsibleSection`. |

Un balayage exhaustif de toutes les pages Mannyx (CRM, Presse, Staff, Production — cf. §8)
n'a pas été mené dans ce lot (hors périmètre, « aucun commit ») ; les trois entrées
ci-dessus sont celles identifiées avec certitude lors de l'implémentation de S1-S3/C1. Un
balayage complet reste à faire avant de clore la doctrine sur ce point. Le garde-fou
statique de C1.3 (§17) couvre néanmoins tout le dépôt de façon continue : toute NOUVELLE
page Mannyx qui réimplémenterait un accordéon local serait détectée sans balayage manuel.

## 17. C1 — un standard, pas deux accordéons (Greg, 18/10/2026)

**Constat de Greg.** `MxCollapsibleSection` (§15) était bien dans le tronc, mais l'ancien
`CollapsibleGroup` local de `OffersActionViewMx.tsx` servait encore au groupe « Idées » —
DEUX accordéons différents sur la MÊME page Offres. Les « Finalisés » de Contrats avaient
leur propre en-tête (§16). Aucun garde-fou n'empêchait une page future de refaire son
accordéon.

**C1.1 — Offres « Idées » et Contrats « Finalisés » migrés.**
- `OffersActionViewMx.tsx` : la branche `if (group.defaultCollapsed)` (seul `ideas` porte ce
  drapeau, `offersActionGrouping.ts`) rend désormais `MxCollapsibleSection` (`storageKey`
  `mx-offers-action-group-ideas-open`) au lieu de l'ancien `CollapsibleGroup`. Le compteur
  passe au ton neutre de `MxCollapsibleSection` (l'ancien `GroupHeader` lui donnait le même
  ton que les autres groupes, sans alerte — aucun changement visible de couleur).
- `ContratsListMx.tsx` : le Groupe C (« Terminés ») perd son double en-tête (`GroupHeader`
  + bouton-pile-d'avatars `FinalizedGroup`) au profit d'un `MxCollapsibleSection` UNIQUE
  (`storageKey` `mx-contrats-finalized-section-open`), contenu inchangé (`ItemsRenderer`,
  suit `cardViewMode`). Aucune règle d'ouverture par défaut n'existait pour ce groupe
  (contrairement aux annulations, G3, §15) : repli par défaut conservé, mode NON contrôlé.
  Fonctions devenues orphelines supprimées : `FinalizedGroup`, `summarizeNames`,
  `STACK_AVATAR_COUNT` (imports `useState`/`MxAvatar`/`ChevronDown`/`ChevronRight` retirés
  avec elles — plus utilisés dans ce fichier). **FIN (2026-10-18)** : les 5 clés i18n
  devenues orphelines (`contracts.mx.group.done.{description,show,hide,summary_one,
  summary_two,summary_many}`, fr/en/de) sont supprimées de `i18n.tsx` dans ce même lot
  (règle de Greg : le code mort est supprimé dans le lot qui le rend mort — l'entrée 23 du
  registre des retraits, provisoire, est retirée en conséquence). `contracts.mx.group.
  done.title` reste seule, et change de texte (voir ci-dessous).

**C1.2 — plus aucun accordéon local.** `CollapsibleGroup` (fonction) est supprimé de
`OffersActionViewMx.tsx` — recherche `grep -rn "CollapsibleGroup" src` : plus aucun usage
fonctionnel après ce lot (seules des mentions en prose dans les commentaires d'historique,
même convention que `docs/REGISTRE_RETRAITS.md`). `FinalizedGroup` (fonction, Contrats)
supprimée de la même façon. Pas d'entrée ajoutée à `docs/REGISTRE_RETRAITS.md` : ces
fonctions étaient internes à leur fichier (jamais exportées, jamais objet de base de
données) — leur suppression immédiate, sans délai de dépréciation, suit la même logique
que tout refactor de fonction privée.

**C1.3 — garde-fou statique.** Nouveau test
`src/components/mx/mxCollapsibleSectionConformance.test.ts` : balaie récursivement tout
`src/`, retient les fichiers `.tsx`/`.ts` dont le NOM contient `Mx` (convention de nommage
Mannyx en vigueur dans tout le dépôt) hors `src/components/mx/` lui-même (où vivent les
implémentations canoniques — `MxCollapsibleSection`, mais aussi `MxMenu`/`MxPickerField`,
légitimement propriétaires de leur `aria-expanded`) et hors fichiers de test (qui EXERCENT
le composant via `toHaveAttribute('aria-expanded', ...)`, ne le réimplémentent pas). Échoue
si un seul de ces fichiers contient À LA FOIS un bouton `aria-expanded={...}` ET une icône
`Chevron{Up,Down,Left,Right}` — signature d'un accordéon réimplémenté localement. Vérifié
à zéro occurrence après C1.1/C1.2 (l'unique occurrence hors périmètre restante,
`FinanceDashboard.tsx`, est exclue par construction : design "finance-v2" distinct,
jetons `--color-*` et non `--mx-*`, aucun "Mx" dans son nom — non-Mannyx, voir C1.4).
**Doctrine : toute section repliable Mannyx = `MxCollapsibleSection`, sans exception.**

**C1.4 — Artistes « archivés », confirmé hors périmètre.** Toujours un filtre de statut
(`ArtistesListMx.tsx`) + pastille `MxStatusPill`, jamais une section séparée retirée du
flux — ne rejoint pas le périmètre de `MxCollapsibleSection` (§16, tableau mis à jour).

**FinanceDashboard.tsx — accordéon local existant, explicitement HORS PÉRIMÈTRE.** Ce
fichier (`pages/app/administration/finance-v2/`) implémente lui aussi un bouton
`aria-expanded` + chevron (`ChevronUp`/`ChevronDown`) pour replier tout le dashboard —
MAIS ce n'est pas une page/un composant Mannyx : jetons de design `--color-*`/`--muted`
(pas `--mx-*`), aucune convention de nommage `Mx`, scope CSS dédié
(`finance-console.css`/`FinanceConsoleScope.tsx`), c'est un système "finance-v2" distinct
du socle Mannyx/AURA. Le garde-fou C1.3 l'exclut donc délibérément (filtre par nom de
fichier) ; sa migration éventuelle, si elle a lieu un jour, relève d'un lot "finance-v2"
dédié, hors de ce lot et de son périmètre Mannyx.

**FIN, F0(b) (Greg, 18/10/2026) — critère de détection ÉLARGI.** Le filtre « nom de
fichier contenant `Mx` » de C1.3 ratait les pages Mannyx sans ce suffixe dans leur nom —
`contrats.tsx` (hôte de `ContratsPageViewMx`/`ContratsListMx`) importe pourtant
`@/components/mx` directement, confirmé par grep au moment de cet élargissement. Le
critère devient : un fichier est « Mannyx » s'il **importe un composant de
`src/components/mx`** (`from '@/components/mx...'` ou chemin relatif équivalent) **OU**
s'il **utilise un jeton `--mx-*`** (namespace CSS exclusif au design Mannyx/AURA) — quel
que soit son nom. Plus de 80 fichiers correspondent à ce critère élargi (vérifié par grep),
contre le sous-ensemble plus étroit des fichiers `*Mx*.tsx` de la version C1.3.
`FinanceDashboard.tsx` reste exclu — mais désormais de façon **explicite** (liste
`EXPLICITLY_EXCLUDED_FILES` dans le test, documentée, pas seulement une absence de
correspondance implicite) : un test dédié vérifie que cette exclusion est bien
**surabondante** (le fichier est de toute façon hors du jeu de candidats PAR
CONSTRUCTION — aucun import `components/mx`, aucun jeton `--mx-*`), pour qu'un futur
refactor qui y introduirait un tel import ne fasse pas échouer silencieusement le
garde-fou sans qu'une décision explicite de migration ait été prise.

**Tests.** `mxCollapsibleSectionConformance.test.ts` (3 — garde-fou C1.3 élargi par
F0(b) : balayage non vide, exclusion `FinanceDashboard.tsx` vérifiée surabondante, zéro
accordéon local). `ContratsListMx.test.tsx` — le test du groupe « Finalisés » vérifie
`MxCollapsibleSection` (bouton nommé « Finalisés », pas le résumé de noms de l'ancien
en-tête). `offersMxCardsListParity.test.tsx`/`offersListViewParity.test.tsx` — re-passés
sans modification (comportement de repli identique, seul l'en-tête change).

**FIN, F0(c) (Greg, 18/10/2026) — libellé unifié.** Le groupe des contrats terminés
s'appelle désormais **« Finalisés »** (fr), **« Finalized »** (en), **« Abgeschlossen »**
(de, déjà identique) — le MÊME mot que le filtre d'étape correspondant
(`contracts.mx.section.finalized`, bandeau de parcours), au lieu de « Terminés »/« Done »
qui employaient un vocabulaire différent pour la même notion.
