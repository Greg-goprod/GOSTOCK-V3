# Doctrine Drawer — modèle à onglets (décision Greg, 2026-10-02)

> **Portée.** Ce document fixe le modèle que doit suivre **tout nouveau drawer** du tronc
> `src/components/mx`. Il complète `README.md` (transversal) et `reference/mannyx-drawer.js`
> (API/blocs d'origine) sans les remplacer : là où le handoff d'origine décrit un corps de
> drawer **scrollable** (padding 20–24px, blocs empilés), ce document décrit le modèle qui
> s'applique désormais **quand un drawer a besoin de plusieurs facettes** — onglets plutôt
> que corps condensé. Les drawers à un seul écran, sans onglet, restent sur le modèle
> scrollable d'origine (`MxDrawer` sans `bodyMode="fill"`).
>
> **Statut.** Décision définitive de Greg, LOT CONTRATS B2 C4 (2026-10-02). Vaut pour TOUS
> les drawers futurs du tronc. Premier drawer construit sur ce modèle : `ContractDrawerMx`
> (`src/pages/app/administration/contrats/ContractDrawerMx.tsx`).
>
> **`SettlementDrawerMx` n'est PAS encore aligné sur ce modèle** — il reste sur l'ancien
> corps scrollable (`MxDrawer` par défaut) jusqu'à un lot ultérieur dédié à sa migration.
> Ne pas le modifier au prétexte de cette doctrine sans instruction explicite.

---

## 1. Le modèle, en une phrase

**En-tête fixe. Onglets sous l'en-tête. Le corps ne défile JAMAIS — le contenu est découpé
en onglets plutôt que condensé. Aperçu PDF en pleine hauteur de son onglet, avec la barre
d'outils native du navigateur et son propre défilement interne. Pied fixe.**

Seule exception au « corps qui ne défile jamais » : une **liste de longueur variable** peut
défiler dans son propre onglet, comme l'aperçu PDF défile dans le sien.

## 2. Structure de référence (C4.1)

Le modèle reprend la **mécanique** (pas l'habillage) du drawer de facture de
`/app/booking/finances` — `src/pages/app/administration/finance-v2/InvoiceDrawer.tsx` :

| Mécanique | Fichier : ligne |
| --- | --- |
| Onglets (`role="tablist"`/`role="tab"`, `aria-selected`, `aria-controls`, soulignement actif) | `InvoiceDrawer.tsx:346-383` |
| Calcul de la hauteur du corps : wrapper `flex flex-col h-full min-h-0` (en-tête + onglets en `shrink-0`, SEULE la zone d'onglet actif défile) | `InvoiceDrawer.tsx:477-479` et `:638` |
| Conteneur de l'aperçu (bandeau titre + Télécharger/Ouvrir, puis `<iframe>`) | `tabs/TabFichiers.tsx:84-134` — écart assumé : hauteur FIXE (340px) dans cette référence, remplacée par une hauteur PLEINE dans la doctrine (§5) |
| Pied fixe (actions contextuelles à l'onglet actif + suppression) | `InvoiceDrawer.tsx:390-414`, rendu fixe par `aura/Drawer.tsx:101-108` |

Écart assumé par rapport à cette référence : son corps global porte encore un
`overflow-y-auto` au niveau du chrome AURA (`aura/Drawer.tsx:94-99`), neutralisé en pratique
par une structure interne qui remplit exactement la hauteur disponible. Le tronc `Mx*`
rend ce choix EXPLICITE : `MxDrawer` n'a plus un `overflow-y:auto` ambigu à ce niveau, il a
un **mode de corps nommé** (§3).

## 3. Tronc — `MxDrawer`, mode de corps `fill`

`MxDrawer` (`src/components/mx/MxDrawer.tsx`) expose `bodyMode?: 'scroll' | 'fill'`.

- **`scroll`** (défaut, inchangé) : `flex:1; minHeight:0; overflowY:'auto'`, padding
  24/24/8, `gap` entre enfants empilés. C'est le mode de **tous les drawers déjà livrés**
  (`SettlementDrawerMx` compris) — aucun n'est affecté par l'ajout de `fill`.
- **`fill`** : colonne flex, `overflow:'hidden'`, **aucun padding ni gap posés ici** — le
  corps ne défile jamais lui-même. C'est au contenu (`MxTabPanels`, §4) de découper
  l'espace en zone d'onglets fixe (`flexShrink:0`) et panneau actif `flex:1; minHeight:0`,
  qui porte lui-même son padding et son défilement interne éventuel (liste, aperçu PDF).

Le pied (`footer`) de `MxDrawer` est **déjà fixe** dans les deux modes (`flexShrink:0`,
inchangé par ce lot) : aucune modification n'était nécessaire sur ce point.

## 4. Tronc — `MxTabPanels` : onglets de panneaux (ARIA complet)

Nouvelle primitive, `src/components/mx/MxTabPanels.tsx`, **distincte de `MxTabs`**
(liste de LIENS de navigation, sans sémantique `tablist`/`tab`/`tabpanel` — décision
antérieure documentée en tête de `MxTabs.tsx`, non remise en cause).

**Motif ARIA complet** :
- conteneur `role="tablist"` ;
- chaque onglet `role="tab"`, `aria-selected`, `aria-controls` vers son panneau,
  `id` référencé par le panneau via `aria-labelledby` ;
- **tabindex itinérant** : seul l'onglet actif porte `tabIndex=0`, les autres `-1` ;
- **flèches gauche/droite** déplacent le focus ET activent le panneau (activation
  automatique) ; **Début/Fin** vont au premier/dernier onglet NON désactivé ;
- les onglets `disabled` sont exclus de la navigation clavier (`<span aria-disabled>`,
  non focalisables), même traitement que `MxTabs`.

**Apparence IDENTIQUE à `MxTabs`** (majuscules, soulignement 2px de l'actif, icônes,
compteurs optionnels) : le style est **extrait** dans
`src/components/mx/internal/mxTabStyle.ts`, consommé par les deux primitives — aucune
valeur dupliquée, une évolution visuelle future passe par ce seul module. Le compteur
optionnel réutilise `MxCountBadge` (primitive déjà existante), pas un badge dédié.

**Montage des panneaux — décision retenue** : seul le panneau **actif** est monté (les
autres ne sont ni rendus ni dans le DOM), comme le fait déjà `InvoiceDrawer.tsx` (switch sur
`activeTab`, cf. §2). Deux raisons : (1) un onglet « Document » qui charge un PDF plein
cadre ne doit pas le charger si l'utilisateur ne visite jamais cet onglet ; (2) c'est le
seul précédent du projet. Inconvénient accepté : un onglet qui aurait un état local (scroll,
saisie en cours) le perd en changeant d'onglet puis en y revenant — aucun onglet des
drawers livrés à ce jour n'a cet état. **À revoir si un futur consommateur en a besoin.**

**Décision de Greg (2026-10-03), confirmée au GO de fin de lot — règle à suivre à partir
d'ici** : un onglet qui contient un **formulaire en cours de saisie** ne doit JAMAIS perdre
cette saisie au changement d'onglet. Deux façons de la respecter, au choix de l'implémenteur
selon le cas :
- garder cet onglet **monté** en permanence (ne pas le démonter au changement d'onglet —
  l'écarter de la règle « mount-on-demand » ci-dessus pour ce seul onglet) ; ou
- **remonter l'état du formulaire dans le composant parent** (le drawer lui-même, ou un
  état partagé au-dessus de `MxTabPanels`), pour qu'il survive au démontage/remontage du
  panneau.
Par défaut, en l'absence de formulaire en cours de saisie, **seul l'onglet actif reste
monté** (règle générale ci-dessus, inchangée). Aucun drawer livré à ce jour (`ContractDrawerMx`)
n'a de formulaire en cours de saisie dans un onglet non actif — cette règle s'applique au
premier consommateur futur concerné.

## 5. Tronc — `MxDocPreview`, mode pleine hauteur

`src/components/mx/MxDocPreview.tsx` porte déjà un mode `fill` (étire le conteneur sur
l'axe flex du parent). Ce lot le complète pour l'usage « onglet dédié » :

- **Barre d'outils NATIVE du navigateur** : aucun paramètre `#toolbar=0`/équivalent n'est
  jamais ajouté à l'URL — le lecteur PDF intégré au navigateur (télécharger, imprimer,
  zoomer…) reste visible, cette primitive ne le reproduit pas elle-même.
- **`iframe` à 100% de la zone** : inchangé depuis `fill` (C3.2), confirmé pour l'usage
  pleine hauteur.
- **Ligne d'en-tête compacte, généralisée** : `onDownload`/`onOpenExternal` (figés à deux
  boutons) sont remplacés par `actions?: ReactNode` — l'appelant compose lui-même ses
  boutons (autant qu'il en a besoin). `headerContent?: ReactNode` permet de substituer un
  contenu interactif (ex. un sélecteur de version) au simple texte `label`, qui reste
  toujours consommé comme nom accessible de l'`iframe`.

## 6. Largeurs

Crans existants de `MxDrawer` (`size`, voir `tokens-mx.css`) — **inchangés par ce lot** :

| Cran | Largeur | Usage typique |
| --- | --- | --- |
| `sm` | 360px | confirmation, panneau court |
| `md` | 420px | défaut, fiche simple |
| `lg` | 520px | — |
| `xl` | 680px | drawer de facture, Final Settlement |
| `xxl` | 800px | drawer à onglets avec aperçu PDF (`ContractDrawerMx`), fiche artiste (`ArtistDetailDrawerMx`), drawer offre Mannyx (`OfferDrawerMx`, LOT OFFRES-B5 C2, 2026-10-11) |
| `full` | — | cas exceptionnel |

Un drawer à onglets avec aperçu PDF en pleine hauteur a besoin de plus d'espace horizontal
qu'un drawer à un seul écran : `xxl` est le cran retenu pour `ContractDrawerMx` (mesure
comparée aux drawers Finance/Final Settlement, rapport LOT CONTRATS B2 C3). Aucune largeur
hors échelle ne doit être introduite — un besoin différent devient un cran, ou n'existe pas.

**LOT OFFRES-B5 C2 (2026-10-11, Greg)** : le drawer offre Mannyx (`OfferDrawerMx`,
`src/features/booking/OfferDrawerMx.tsx`) passe en **`size="xxl"`**, au même cran que la
fiche artiste (`ArtistDetailDrawerMx`), et non en `xl` (680px). Motifs : **six onglets**
avec libellés complets (Aperçu, Conditions, Documents, Envois, Revues, Historique) sans
troncature en uppercase ; **aperçu PDF** en pleine largeur dans l'onglet Documents ; pied
d'actions sur une seule rangée. Sur viewport plus étroit, `MxTabPanels` conserve le
défilement horizontal des onglets plutôt que de raccourcir les libellés.

## 7. Drawer ou modale : quand choisir quoi

**Décision Greg, LOT BOOKING-DRAWERS L1 (2026-10-11).** Module Booking (Mannyx) : toute
fenêtre modale devient un **`MxDrawer`**, **sauf** les confirmations courtes.

- **Fenêtre centrée — confirmations courtes uniquement** — `MxConfirmDialog` : une
  question, éventuellement **un champ obligatoire** (ex. motif de refus), **deux boutons**
  (Annuler / Confirmer). Pas de navigation interne, pas d'onglets. Les anciens
  `ConfirmDialog` (AURA) disparaissent des écrans Mannyx au profit de `MxConfirmDialog`.
- **Drawer — tout le reste** — formulaires (envoi d'offre, prolongation, performance…),
  consultation multi-facettes (fiche offre, contrat…), aperçu PDF **dans un onglet ou un
  panneau du drawer**, pas dans une modale empilée. Empilement standard
  (`useMxLayeredDialog`) : Échap ferme la couche du dessus.
- **Outil plein écran** — atelier lourd (ex. annotation PDF contrat) : **page dédiée** ou
  fenêtre navigateur, pas `MxModal` / `aura/Modal`. (Migration annotateur : lot ultérieur.)

Rappel technique : un aperçu de document **à l'intérieur** d'un drawer (onglet « Document »,
etc.) utilise `MxDocPreview` en mode `fill` (§5), pas de modale PDF séparée. Les actions
**Télécharger** et **Ouvrir dans un nouvel onglet** du bandeau d'aperçu passent par
`MxDocumentFileActions` (`src/components/mx/MxDocumentFileActions.tsx`) — même rendu que
`finance-v2/tabs/TabFichiers.tsx` (InvoiceDrawer).

Historique (lots antérieurs) : le drawer convient quand l'entité a plusieurs facettes sans
perdre le contexte de la liste ; la modale AURA restait réservée aux actions courtes — la
règle ci-dessus **resserre** ce principe au tronc Mannyx Booking.

## 8. Référence d'implémentation

**Norme visuelle (decision Greg, LOT DRAWER-MODELE, 2026-10-11) : `OfferDrawerMx.tsx`.**
Grand titre, ligne d'informations (`meta`), navigation prev/next (`headerActions`), bande
pleine largeur (`band`), onglets `MxTabPanels`, pied famille entite (`footerVariant="entity"`
+ `MxEntityActionFooter` via `OfferMxRowActionsBar`), fermeture Mannyx (ChevronsRight),
`linkedArtist` obligatoire pour l'artiste.

`ContractDrawerMx.tsx` reste la reference technique des onglets Document / historique PDF,
a aligner sur le meme chrome entete/pied que l'offre au fil des lots.

Detail complet du modele : §10.

## 9. Drawers d'entité globaux (décision Greg, LOT ARTISTES-FICHE C1, 2026-10-04)

> **Statut.** Décision définitive de Greg. Première application : la fiche artiste
> (`src/features/artists/ArtistDetailDrawerMx.tsx` + `ArtistDrawerProvider.tsx`).

**Un composant par entité, ouvert de partout.** Quand une entité (artiste, contact,
contractant…) a besoin d'une fiche consultable depuis plusieurs pages — pas seulement
depuis sa liste d'origine — cette fiche sort du dossier de la page qui l'a fait naître
(`src/pages/...`) et devient un module de `src/features/<entite>/`, monté **une seule
fois** au niveau du shell applicatif (ex. `/app` dans `App.tsx`), via :

- un **fournisseur** React (`<XxxDrawerProvider>`) qui porte l'état d'ouverture (id
  ouvert, onglet initial, contexte) et rend la fiche + ses dépendances empilées
  (drawer d'édition, confirmation de suppression) ;
- un **hook impératif** (`useXxxDrawer().open(id, { context?, initialTab? })`,
  `.close()`, `.requestEdit(entity)`, `.requestDelete(entity)`) consommable depuis
  N'IMPORTE QUEL composant du sous-arbre, qu'il soit ou non sur la page d'origine ;
- une **URL comme source de vérité unique** pour l'état ouvert : un paramètre de requête
  (ex. `?artiste=<id>`) lu et écrit **par le fournisseur lui-même** (pas par chaque page
  consommatrice), afin que l'ouverture soit identique entre un appel impératif
  (`.open()`) et une navigation directe vers une URL porteuse du paramètre, sur
  n'importe quelle route sous le shell.

**Autonomie complète.** La fiche globale ne dépend plus de la page qui l'a fait naître
pour « Modifier » / « Supprimer » : ces actions ouvrent le drawer d'édition et la
confirmation de suppression **empilés par le fournisseur lui-même**, avec la même
fonction de suppression et la même invalidation de cache (`react-query`) que l'ancienne
page-liste — extraites de cette page si elles n'y vivaient encore que localement. Toute
page affichant la même donnée se rafraîchit après une modification faite depuis la
fiche ouverte ailleurs.

**Droits affichés, jamais désactivés.** Onglets et actions (« Modifier », « Supprimer »)
sont **absents** du DOM — pas rendus-et-désactivés — quand les permissions existantes
les refusent (cf. convention déjà en vigueur dans les listes Mx). Un contexte
d'ouverture (ex. `context: 'presse'`) peut filtrer le contenu de la fiche (ex. ses
contacts) **sans brancher** le futur appelant : la plomberie peut précéder son premier
usage réel.

**Périmètre : fiche d'entité ≠ drawer métier.** La fiche globale d'une entité est son
**profil** (identité, informations descriptives, statistiques, historique, contacts) —
**jamais** de donnée métier liée (offres, contrats, factures, paiements, décomptes,
budgets). Une donnée métier reste portée par le drawer de l'objet métier concerné
(ex. un contrat reste dans `ContractDrawerMx`, pas dans la fiche artiste). Les deux
restent **distincts et reliés uniquement par ouverture empilée** : depuis la fiche
d'entité, un lien peut ouvrir un drawer métier par-dessus (empilement standard,
`useMxLayeredDialog`), jamais l'inverse (le drawer métier ne doit pas fusionner le
profil de l'entité dans son propre corps). Échap ne ferme que la couche du dessus.

## 10. Modèle drawer Mannyx (LOT DRAWER-MODELE, 2026-10-11)

**Le drawer de l'offre est la norme.** Tout drawer Mx migré reprend : `linkedArtist` si
entité artiste (initiales si pas de photo), titre, `meta`, `band` optionnelle,
`headerActions` (navigation), `MxTabPanels` + `bodyMode="fill"` pour les fiches à onglets,
fermeture Mannyx.

**Deux familles de pied seulement :**

| Famille | API | Usage |
| --- | --- | --- |
| (a) Entité | `footerVariant="entity"` + `entityFooter` (`MxEntityActionFooter` ou wrapper métier) | Offre, contrat, artiste, facture… |
| (b) Formulaire / envoi | `footerVariant="form"` + `formFooter` (`MxFormActionFooter`) | Prolongation, envoi, CRUD artiste |

Formulaire ou envoi **lié à un artiste** : titre = nom artiste (CAPS) + avatar ; l'action
dans `meta` (ex. « Envoyer l'offre · VENOGE FESTIVAL 2027 »), via `mxDrawerMetaLine`
(segments séparés par « · », **aucune icône** dans la ligne).

**Pied — ordre unique (familles entité et formulaire) :**

- Menu « ··· » (**overflow**) : **tout à gauche** (`MxEntityActionFooter`).
- Actions secondaires visibles : à gauche de l'action principale, variante ghost / secondaire.
- Action principale : **tout à droite**, variante **primary** (violet plein). Une seule action
  visible (ex. « Modifier » sur la fiche artiste) reste en primary.
- Famille formulaire : Annuler (+ suppression icône si présente) puis primary à droite
  (`MxFormActionFooter`).

**Abonnement (cloche)** : retiré du pied ; `SubscribeButton` compact dans `headerExtras`
du drawer (à côté de `headerActions` prev/next), pour les entités qui le proposent (offre).

**Objet e-mail offre** : à l'envoi uniquement, sujet entièrement en majuscules
(`formatOfferEmailSubjectForSend`) ; le corps et le champ de saisie restent inchangés.

**Largeurs — échelle unique (`size` sur `MxDrawer`, tokens `--mx-drawer-w-*`) :**

| Cran | Token (base) | Règle de choix |
| --- | --- | --- |
| `sm` | 360px | Outil compact (notifications — exception documentée) |
| `md` | 420px | Formulaire court |
| `lg` | 520px | Formulaire moyen, consultation |
| `xl` | 680px | Formulaire riche, envoi avec aperçu, décompte |
| `xxl` | 800px | Fiche d'entité à onglets et documents |
| `full` | 960px | Import / revue très large |

Aucune largeur libre en pixels sur un drawer Mx. Les drawers AURA historiques passent sur
`MxDrawer` + cran ci-dessous (actuel px → cible) :

| Drawer | Actuel | Cible `size` |
| --- | --- | --- |
| OfferDrawerMx | xxl | **xxl** (norme) |
| ContractDrawerMx | xxl | xxl |
| SendForSignature / SendToArtist | xl | xl |
| ExtendOfferDrawerMx | md | md |
| SendOfferEmailCore (drawer) | xl | xl |
| ArtistDetailDrawerMx | xxl | xxl |
| ArtistDrawerMx | xl | xl |
| SettlementDrawerMx | xl | xxl |
| SettlementDrawer (AURA) | 620 | xl |
| EditionConfigDrawer | 860 | full |
| Attestation21560Drawer | 860 | full |
| Recap21542 (aperçu / PDF) | 720 / 900 | xl / full |
| InvoiceDrawer | 680 | xxl |
| Guestlist invité | 560 | md |
| GuestImportReviewDrawer | 940 | full |
| Travel nouveau / runs | 760 | xl |
| Travel modifier run | 720 | xl |
| TravelViewModal | 520 | lg |
| TravelEditModal | 720 | xl |
| Ground missions planning | 800 | xl |
| StandaloneRunsModal | 820 | xl |
| Economat produit | 460 | md |
| UserDrawer | 520 | lg |
| NotificationPanel | md | sm (exception outil) |

Garde-fous : `mxDrawerLegacyAllowlist.ts`, tests `mxDrawerModel.*.test`, règle
`.cursor/rules/drawer-modele.mdc`, vitrine `MxPreview` (drawer entité + formulaire).

## 11. Empilement — un drawer ou un dialogue ouvert depuis un drawer (LOT DRAWER-EMPILEMENT, 27/10/2026)

**Règle (Greg, valable partout dans le site).** Tout drawer ou dialogue ouvert depuis un
drawer déjà ouvert s'affiche **par-dessus** : le drawer parent reste ouvert **derrière**.
Échap et le clic extérieur ne ferment **que celui du dessus**. À l'enregistrement, retour
au parent avec ses données à jour ; fermeture sans enregistrer = parent intact.

**Mécanisme — aucun geste particulier à poser dans un nouveau drawer.** `MxDrawer` (et tout
dialogue Mx bâti sur `internal/useMxLayeredDialog.ts`) résout déjà cette règle pour toute
paire conforme (`role="dialog"`/`aria-modal`) :
- `isTopLayer()` compare le **z-index effectif** de chaque couche ouverte, Échap et le clic
  sur le voile ne ferment que la couche du dessus ;
- **deux `MxDrawer` empilés** (même jeton `--mx-z-drawer`) sont départagés par leur **ordre
  d'OUVERTURE** (`stackFamily: 'drawer'`), pas par l'ordre de montage dans le DOM — correctif
  nécessaire : un drawer qui se démonte/remonte à chaque fermeture (`if (!open) return null`)
  et un autre qui reste monté en permanence (`open` seul bascule) ne se classaient plus dans
  l'ordre réel d'ouverture sans cette file. Transparent pour tout drawer : un seul écran
  ouvert garde exactement son jeton d'origine (`--mx-z-drawer`/`-drawer-scrim`, aucun calcul).
- **drawer face à une modale AURA non conforme** (`aura/Modal`, sans `role="dialog"`) : le
  drawer sous-jacent doit déclarer `suspended` tant que la modale est ouverte (prop
  `MxDrawer.suspended` — le recouvrement visuel est déjà garanti par l'échelle `--mx-z-*`,
  cette prop ne traite que le clavier/clic-voile, que le repli DOM ne peut pas voir sans
  `role="dialog"`).

**Rafraîchissement du parent après enregistrement** : le callback `onSuccess`/`onSaved` du
dialogue empilé met à jour l'état du parent (ex. nouvelle version sélectionnée, re-fetch de
la liste) **avant ou en même temps que** sa propre fermeture — jamais une fermeture seule
qui laisserait le parent sur des données périmées.

**Non conforme à ce jour (hors périmètre de ce lot, à traiter par site) :** tout drawer
bâti sur `aura/Drawer` (legacy, hors `useMxLayeredDialog`) et toute confirmation ouverte
depuis un `MxDrawer` via `aura/ConfirmDialog`/`aura/Modal` plutôt que `MxConfirmDialog` —
ni l'un ni l'autre n'est vu par le repli DOM d'`isTopLayer()`. `SettlementDrawerMx` est le
cas confirmé à ce jour (ses 3 `ConfirmDialog` AURA internes). Inventaire complet et plan de
généralisation : rapport du LOT DRAWER-EMPILEMENT, phase A (27/10/2026).

## 12. Pas de menu « … » dans le pied d'un drawer (Greg, 28/10/2026)

**Règle (Greg, valable partout dans le site).** Le pied d'un drawer n'a **jamais** de menu
« … » (déclencheur `MoreHorizontal`, `MxMenu`/`MxEntityActionFooter.overflow` ou
`MxFormActionFooter.overflow`/`secondaryActions` repliés dans un menu). Toute action du pied
d'un drawer est un **bouton visible** : libellé + icône Lucide, ton adapté (`danger` pour
Supprimer / Annuler le contrat / Clore, `success` pour une validation, `ghost`/`primary`
sinon) — même convention que les boutons déjà visibles du pied (voir `MxEntityActionFooter`,
`resolveVisibleVariant`).

**Raison.** Une action repliée dans un menu est une action cachée ; au pied d'un drawer déjà
ouvert (donc déjà une action volontaire de l'utilisateur), la place ne manque pas comme sur
une ligne de tableau étroite — rien ne justifie d'y recréer le même repli.

**Mécanisme.**
- `MxFormActionFooter` (famille b — formulaire/envoi) : `overflow` doit rester vide
  (`[]`/absent) pour tout appelant DRAWER ; les actions qui iraient dans ce menu rejoignent
  `secondaryActions` (boutons visibles, `variant` explicite) à la place. Voir
  `PerformanceModal.tsx` (point A3, LOT NON-ABOUTIES) : `secondaryActions` pour « Clore »/
  « Gérer dans Contrats », `onDelete`/`deleteLabel` pour « Supprimer », `overflow: []`.
- `MxEntityActionFooter` (famille a — entité) : `overflow` doit rester vide (`[]`) pour tout
  appelant DRAWER ; les actions qui iraient dans ce menu rejoignent `primary`, **préfixées**
  (en tête de tableau) — la DERNIÈRE action de `primary` reste ainsi la dernière du tableau
  fusionné, seule promue en bleu (`primary`) par `resolveVisibleVariant` si elle n'a pas de
  ton explicite ; les actions danger/success gardent leur ton quelle que soit leur position.
  Voir `ContractDrawerMx.tsx` : `primary={[...footerOverflow, ...footerPrimary]}`,
  `overflow={[]}`.
- `OfferMxRowActionsBar` (barre d'actions partagée ligne de tableau / carte / pied de drawer
  de l'offre) : prop dédiée `noOverflowMenu` — `true` depuis `OfferDrawerMx.tsx` fusionne
  `overflow` dans `primary` (même préfixage) ; `false` (défaut, ligne de tableau et carte,
  où la place manque réellement) garde le menu. Un seul composant, une seule matrice
  d'actions (`buildActionSpecs`/`offerMxRowActionsSplit.ts`) — seule la présentation change
  selon le contexte.

**Drawers déjà conformes (LOT NON-ABOUTIES, B4b, 2026-10-28) :** `PerformanceModal`,
`ContractDrawerMx`, `OfferDrawerMx`.

**Drawers NON conformes à ce jour (hors périmètre de ce lot, listés pour un lot de
généralisation ultérieur — ne pas modifier sans consigne) :**
- `OfferComposer.tsx` (drawer de création/édition d'une offre) — menu « … » du pied formulaire
  avec 2 actions conditionnelles : « Word » (télécharger le document Word existant), « PDF »
  (voir le PDF existant).
- `ArtistDetailDrawerMx.tsx` (drawer de détail artiste) — menu « … » du pied entité avec
  jusqu'à 3 actions conditionnelles : « Désarchiver »/« Archiver », « Supprimer » (danger).
