# Doctrine États vides — trois rôles, une seule primitive en pointillés (décision Greg, 2026-10-05)

> **Portée.** Ce document fixe les trois rôles qu'un « rien à afficher » peut jouer dans le
> tronc `src/components/mx`, et tranche définitivement l'usage des pointillés. Il complète
> `README.md` (catalogue du handoff d'origine) sans le réécrire : le bloc `empty` du
> prototype (`reference/mannyx-drawer.js`) décrit une carte en pointillés — ce document
> documente l'ÉCART assumé par le tronc depuis ce lot.
>
> **Statut.** Décision définitive de Greg, LOT TRONC-ETATS-VIDES (2026-10-05).

## 1. Les pointillés sont RÉSERVÉS au dépôt de fichiers

`MxDropzone` (`src/components/mx/MxDropzone.tsx`) est désormais la **seule** primitive du
tronc à porter un filet en pointillés (`--mx-dashed`). Aucune autre primitive, aucune page
Mannyx ne doit réintroduire ce filet hors de ce composant.

`MxEmpty` **abandonne** la carte en pointillés héritée du handoff (`.mx-dr-empty`, filet
`--mx-dashed` 1.5px, rayon 10px) — écart assumé, définitif.

## 2. Les trois rôles

### a. `MxEmpty`, variante par défaut (`density="comfortable"`, défaut)

Pour un grand espace sans résultat : un onglet de drawer entier, une page de liste vide.

- **Centré, sans cadre ni pointillés.**
- Une **pastille ronde** (fond `--mx-surface`, filet `1px solid var(--mx-border)` — un
  repère discret, volontairement plus fin que `--mx-border-w`, pas une bordure de carte)
  porte l'icône Lucide.
- Titre, description facultative, action facultative, tous centrés sous la pastille.

**Exemple en production (C2, 2026-10-06) :** `ArtistConcerts.tsx`, onglet Concerts de la
fiche artiste — aucun concert à venir ni passé rendait un onglet vide (`return null`) sans
aucun message ; remplacé par `MxEmpty` (icône `CalendarX`), avec la date de la dernière
donnée de `artist_events` en seconde ligne de description quand elle existe (pas une donnée
de CET artiste — il n'y en a aucune — mais la fraîcheur générale du jeu de données, pour
écarter l'hypothèse d'une panne de synchronisation).

### b. `MxEmpty`, variante compacte (`density="compact"`)

Pour un état vide inséré ENTRE d'autres blocs : un widget de tableau de bord, une
sous-section de drawer parmi d'autres (liste de liens sociaux, etc.).

- **Une seule ligne** : icône discrète, texte secondaire, action facultative en fin de
  ligne.
- Encadrée par **deux filets fins** (`var(--mx-border-w) solid var(--mx-border)` — le même
  filet que `MxDivider`), jamais en pointillés.

### c. Un manque important : `MxNote`, pas `MxEmpty`

Un manque qui a une **conséquence concrète sur le flux de travail** (ex. : aucun agent de
booking renseigné pour un artiste — il ne sera proposé à aucune offre ni contrat) n'est
**pas** un état vide neutre : c'est un signal à part entière, porté par `MxNote`
(`tone="info"` ou `tone="warning"` selon la gravité), jamais par `MxEmpty`.

**Exemples en production (LOT TRONC-ETATS-VIDES, C1/C3, 2026-10-06) :**
- `ArtistAgentsSectionMx.tsx` — aucun agent de booking pour l'artiste
  (`artists_mx.agents_empty_note`).
- `ArtistDetailDrawerMx.tsx`, onglet Contacts — aucun contact du tout pour l'artiste
  (`artists_mx.detail_contacts_empty_note`) : la fiche n'a alors aucun destinataire
  d'offre ni de contrat tant qu'un agent de booking n'est pas associé via « Modifier ».
  Les DEUX cas partagent le même ton (`info`) et la même icône (`UserPlus`), la même
  invitation à agir plutôt qu'un simple constat d'absence.

Un état vide neutre (aucun résultat de recherche, aucune donnée encore produite en amont,
liste pas encore remplie) reste `MxEmpty` — la distinction se fait sur la **conséquence**,
pas sur la simple absence de données.

## 3. Échelle et thèmes

Toutes les valeurs de `MxEmpty` (pastille, espacements, typographie) suivent `--mx-scale`
comme le reste du tronc, et consomment uniquement des tokens déjà définis dans les deux
blocs de thème de `tokens-mx.css` (`--mx-surface`, `--mx-border`, `--mx-text2`,
`--mx-text3`, etc.) — aucune valeur hors tokens, aucun réglage par thème.

## 4. Référence d'implémentation

`src/components/mx/MxEmpty.tsx` — voir le commentaire de tête du fichier pour le détail des
deux variantes. `src/components/mx/MxDropzone.tsx` reste la référence pour le filet en
pointillés.
