# LOT OFFRES-B3 — consignes pour B4 et B5

Document de handoff (2026-10-11, recette validée). Référence pour les lots
**B4** (actions / libellés / parité comportement) et **B5** (drawer offre en
Mannyx).

---

## 1. Matrice des actions de ligne (corrigée, référence B4)

Source de vérité **Legacy** : `getOfferRowActionFlags()` +
`OffersListView.tsx`. Branche **Mannyx** (B4) : `getOfferMxRowActionFlags()` +
`offersMxListColumns.tsx` (libellés et règles B4 ci-dessous).

| Action | Affichée si | RBAC | Note B4 / dette |
|--------|-------------|------|------------------|
| **Établir offre** | `type === 'performance'` et `booking_status` ∈ (`offre_a_faire`, **`idee`** LOT OFFRES-CYCLE) | `canCreate` | La performance prend le statut de l'offre créée. |
| **Supprimer** | Legacy : `offre_a_faire` **ou** `draft`. Mx : offre jamais envoyée (`draft`, `ready_to_send`, `legal_review`, `management_review`, `negotiating`) + perf `offre_a_faire` | `canDelete` | Mx : message V1 si contre-proposition |
| **Voir PDF** | offre (`type !== 'performance'`) et `pdf_storage_path` | — | — |
| **Télécharger Word** | offre et `word_storage_path` | — | — |
| **Modifier** | `showModify` (= pas `accepted`, `rejected`, `expired`) | `canUpdate` | LOT OFFRES-CYCLE (2026-10-17) : **visible aussi sur `sent`**, remplace « Contre-proposition » (retirée, `showCounterProposal` figée à `false`). |
| **Ajuster** | `status === 'accepted'` et aucun ajustement déjà en cours/envoyé | `canUpdate` | Crée une V2 (ajustement). |
| **Accepter** | `status === 'sent'` | `canUpdate` | Legacy « Valider » ; Mx libellé **Accepter** ; handler `sent → accepted` (contrat à recevoir inclus). |
| **Refuser** | `sent` **ou** `accepted` | `canUpdate` | Mx libellé **Refuser** (Legacy « Rejeter »). |
| **Envoyer** | `showSend` (= pas `rejected`, `accepted`, `expired`, **ni `sent`**) | `canUpdate` | Premier envoi (transition vers `sent`) ; sur un ajustement (V2), c'est « Envoyer à l'agent ». |
| **Renvoyer** | `status === 'sent'` | `canUpdate` | Mx B4 F0 : ouvre `SendOfferModal` sans `moveOffer` ; `booking_emails` + `offer_activity_log` (`rpc_log_offer_email_sent`). |
| **Prolonger** | `expired` **ou** `sent` | `canUpdate` | LOT OFFRES-B2c (C1.2). |
| **S’abonner** | offre (`type !== 'performance'`) avec `id` | session | `SubscribeButton` — **rétabli en Mx** (C1.3). |
| **Réactiver** *(LOT OFFRES-CYCLE)* | `status === 'rejected'` et offre réelle (`type !== 'performance'`) | `canUpdate` | `rpc` : `create_offer_version` (ancre `rejected` autorisée) → nouvelle version `draft`, PAS un ajustement. Confirmation `MxConfirmDialog`. |
| **Valider sans renvoi** *(LOT OFFRES-CYCLE)* | `adjusts_offer_id` non nul et statut pas encore `accepted`/`rejected` (avant **et** après l'envoi) | `canUpdate`, `booking.offers:update` | `rpc_validate_offer_adjustment_without_resend` : la V2 devient l'offre acceptée, la V1 passe en `superseded`, contrat transféré, historique dédié. Confirmation `MxConfirmDialog`. Réservé aux ajustements. |
| *(perf)* **Performance** | performance sans bouton « Établir offre » | — | Texte indicatif seulement. |

**Correction B2c rappelée** : `expired` n’affiche plus Modifier / Envoyer (évite
erreurs serveur sur transitions interdites).

**LOT OFFRES-CYCLE (2026-10-17, décisions Greg)** : tant qu'un ajustement (V2)
n'est pas **envoyé**, la ligne « Acceptées » affiche le statut/les actions de
la V2 (`adjustment_in_progress`), dans **les deux vues** (« Qui doit agir » et
« Par jour »), mêmes rangements et mêmes compteurs — correctif
`classifyGroup()` (`offersActionGrouping.ts`) qui routait auparavant ces
lignes par leur statut brut, pas par ce drapeau. Une fois l'ajustement
**envoyé**, la V1 reste affichée telle quelle (badge « Ajustement envoyé »,
`adjustment_sent`), et la V2 apparaît comme une ligne `sent` normale (badge
« Ajustement de l'offre acceptée ») dans « Offres en cours »/« À traiter par
vous ».

**Pastilles de statut (B3/C1)** : `MxStatusPill` couvre tous les statuts prod
(`bookingStatusDbSnapshot.ts`) + legacy `offre_*` ; inconnu → ton neutre, pas de
crash.

---

## 2. Comparatif drawers — Finances / Final Settlement / Offres (B5)

Décision à prendre **avant B5** : quel patron de drawer pour l’offre (aujourd’hui
`OfferComposer` + modales AURA, inchangés en B3).

| Critère | Final Settlement (pilote) | Finances (`/app/administration/finances`) | Offres (état B3) |
|---------|---------------------------|-------------------------------------------|------------------|
| **Flag** | `VITE_USE_MX_SETTLEMENT_DRAWER` | `VITE_USE_NEW_FINANCE_UI` | `VITE_USE_MX_BOOKING_OFFERS` (liste seule) |
| **Shell** | `MxDrawer` + bandeau statut pleine largeur | Module Finances (Mx partiel selon flag) | Liste Mx ; **pas de drawer Mx offre** |
| **Référence visuelle** | `DOCTRINE-DRAWER.md`, `reference/annexe-drawer-deal-metier.md`, preset `deal` | Layout finances existant | — |
| **Découpage code** | `SettlementDrawer.tsx` / `SettlementDrawerMx.tsx` (doublon présentation, comportement partagé) | Coquille `finances.tsx` | Host `booking.tsx` + `OffersPageViewLegacy` / `OffersPageViewMx` |
| **Modales empilées** | PDF / confirmations dans le drawer | Selon écran | Send / Reject / Extend / PDF / **OfferComposer** (AURA) |

**Décision B5 (Greg, recette validée)** : patron **Finances / Contrats** — page
hôte (`OffersPageViewMx`) garde état, handlers et URL ; drawer Mx =
présentation + lecture ; **`OfferComposer`** (AURA) **empilé** au-dessus du
drawer (`suspended`), pas remplacé.

---

## 3. Drawer offre Mannyx — livré (B5 + C1 + C2)

Toujours derrière **`VITE_USE_MX_BOOKING_OFFERS`** (désactivé par défaut).
Legacy (`OffersPageViewLegacy`, `booking.tsx` branche legacy) **inchangé**.

| Élément | Implémentation |
|---------|----------------|
| **Shell** | `OfferDrawerMx` — `MxDrawer` **`size="xxl"`** (800px, aligné `ArtistDetailDrawerMx`), `bodyMode="fill"` |
| **Structure** | Bandeau statut (preset Final Settlement), en-tête avec navigation offre **précédente / suivante**, pied sticky **une rangée** |
| **Onglets** | Aperçu, Conditions, **Documents** (PDF pleine largeur), Envois, **Revues**, **Historique** — libellés complets (C2) |
| **Actions** | Même matrice que la ligne : principales visibles (`OfferMxRowActionsBar` + `offerMxRowActionsSplit`), reste dans menu **« ··· »** (`MxMenu`) |
| **Ouverture** | Clic ligne (hors perf / idée / offre à faire) ou **`?offre=<id>`** (`offerDrawerMxUrl.ts`, seul endroit qui écrit ce paramètre) |
| **Revues** | Onglet Revues : approuver / demander modifications si `showDecide` (RBAC) ; « Décider » bascule vers cet onglet |
| **Étape revue (MxSteps)** | Affichée seulement si réglages revue, `offer_reviews`, historique revue ou statut en revue (`resolveIncludeOfferReviewStep`, C1.1) |
| **Statuts** | Libellés accentués Mx (`offerMxStatusLabels.ts`) ; Legacy `getStatusLabel` inchangé |
| **Doctrine** | `DOCTRINE-DRAWER.md` — offre au cran **xxl** (6 onglets, aperçu documents) |

**Fichiers principaux** : `OfferDrawerMx.tsx`, `offerDrawerMxRead.ts`, `offerDrawerMxNav.ts`, `OfferHistoryPanel.tsx`, `OffersPageViewMx.tsx`, tests `offerDrawerMx.test.ts`.

### Avant retrait de l’ancienne branche (Legacy liste / host)

- Recette prod avec flag **`VITE_USE_MX_BOOKING_OFFERS=true`** (Greg).
- Parité actions restante si écart constaté vs `OffersListView.tsx` (hors périmètre B5 drawer).
- Retrait Legacy : flag par défaut → Mx, suppression `OffersPageViewLegacy` et bascule `booking.tsx` — **lot dédié**, pas B5.
- `OfferComposer` et modales Send / Reject / Extend restent partagées Mx / Legacy.

---

## 4. Règle de travail (worktree)

Voir `.cursor/rules/hygiene-worktree.mdc` (section « Réécritures et STOP ») :
pas de réécriture intégrale de fichiers existants ; audit `git diff HEAD
--numstat` ; build + tsc à chaque STOP.
