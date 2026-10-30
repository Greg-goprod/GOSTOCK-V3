# Handoff — Design system Mannyx & primitive Drawer

> **Commencez par `LISEZ-MOI-EN-PREMIER.md`**, dans ce dossier : il porte la règle de
> priorité entre les trois sources normatives de ce lot (drawer, page, transversal), adoptée
> le 2026-09-23. Ce `README.md` fait foi sur le **transversal** — tokens, échelles, tons,
> accessibilité —, mais pas sur les composants de drawer, qui relèvent de
> `reference/mannyx-drawer.js`.
>
> **CE DOCUMENT FAIT FOI** pour le design system de `go-prod-aura`.
> `design_handoff_rider_artistes/`, à la racine du dépôt, ne couvre qu'une page liste et ne
> définit aucun design system : ne pas l'utiliser comme référence visuelle globale.
>
> **Deux fichiers cités dans ce lot n'y figurent pas** — ne pas les chercher :
>
> - `Mannyx Redesign.html`, cité plus bas en « Notes d'intégration », point 6. Périmé, volontairement
>   exclu par l'auteur du handoff.
> - `deal-editorial-mono.html`, cité par `reference/annexe-drawer-deal-metier.md` comme son
>   rendu de référence. Absent du lot livré.
>
> La référence visuelle utilisable est `reference/Mannyx Components V2.html`.
> `01-catalogue-autonome.html` en est un bundle auto-extractible : il n'est pas lisible
> comme source, il déballe ses ressources au chargement dans un navigateur.

## Overview

Refonte de la direction artistique de Mannyx (plateforme B2B de gestion de festivals :
artistes, booking, production, presse, staff, billetterie) et livraison d'un design system
complet, accompagné d'une primitive **Drawer** destinée à remplacer tous les panneaux
latéraux de l'application.

Le lot couvre trois choses :

1. **Une direction artistique** — palette de tokens light + dark, typographie, rayons,
   élévations, courbes d'animation, micro-interactions.
2. **Un inventaire de composants** — 20 familles, du bouton au command palette, avec les
   valeurs exactes.
3. **Une primitive Drawer pilotée par configuration** — un seul composant pour tous les
   panneaux latéraux, quelle que soit la page.

---

## À propos des fichiers de ce bundle

⚠️ **Les fichiers de `reference/` sont des références de design réalisées en HTML/CSS/JS
vanilla. Ce n'est pas du code de production à copier tel quel.**

Ce sont des prototypes qui montrent l'apparence et le comportement attendus. Le travail
consiste à **recréer ces designs dans l'environnement existant du codebase cible**
(React/TypeScript, Vue, etc.) en utilisant ses patterns et ses librairies établis. Si
aucun environnement n'existe encore, choisir le framework le plus adapté au projet et y
implémenter les designs.

Concrètement :

- `reference/Mannyx Components V2.html` — le catalogue complet. Ouvre-le dans un
  navigateur, c'est la source de vérité visuelle. Bascule Light/Dark en haut à droite.
- `reference/mannyx-drawer.js` — la primitive Drawer. Son **API et son modèle de blocs
  sont à reprendre fidèlement** ; son implémentation (concaténation de chaînes HTML) est
  à réécrire en composants du framework cible.
- `reference/mannyx-icons.js` — registre d'icônes Lucide. **À ne pas porter** : installer
  le paquet Lucide officiel du framework cible (voir § Assets).
- `reference/annexe-drawer-deal-metier.md` — annexe métier : les règles du drawer de
  finalisation de deal (rate-card, `edition_tax_config`, conditions de finalisation).
  Fournie par le client, elle décrit la **logique existante à préserver**.

---

## Fidelity

**High-fidelity.** Couleurs, typographie, espacements, rayons, durées et courbes
d'animation sont définitifs. L'UI doit être recréée fidèlement avec les librairies et
patterns du codebase.

Deux nuances :

- Les **données affichées sont des exemples de démo** (ORELSAN, David Guetta, 400 000 EUR,
  VENOGE FESTIVAL). Elles viennent des vraies entités en intégration.
- Les composants du catalogue autres que le Drawer sont des **specs visuelles**, pas des
  composants finis : implémenter ceux dont l'app a besoin, au fil des écrans.

---

## Design tokens

Les tokens sont la **source de vérité unique**. Aucune couleur de marque ne doit être
écrite en dur dans un composant. Dans le prototype ils sont déclarés en variables CSS sur
`:root` / `html[data-theme="dark"]` ; les mapper sur le système du codebase (variables CSS,
config Tailwind, thème JS) plutôt que d'introduire un second système de couleurs.

### Couleurs — thème clair (défaut de l'app)

| Token | Valeur | Usage |
|---|---|---|
| `--scrim` | `#DADBE0` | fond de page, fond derrière un drawer |
| `--surface` | `#FFFFFF` | cartes, panneaux, drawer |
| `--surface2` | `#F6F6F8` | surfaces secondaires, en-têtes de tableau |
| `--text` | `#101114` | texte principal |
| `--text2` | `#4A4D57` | texte secondaire, labels de champs |
| `--text3` | `#82858F` | texte tertiaire, labels de section |
| `--border` | `#E2E3E9` | séparateurs et bordures |
| `--band` | `#F5C518` | bandeau de statut, badge d'alerte |
| `--bandText` | `#14110A` | texte sur `--band` |
| `--chipBg` | `#F1F2F5` | fond de chip |
| `--chipText` | `#4A4D57` | texte de chip |
| `--inputBg` | `#FFFFFF` | fond de champ |
| `--inputBorder` | `#CBCDD6` | bordure de champ |
| `--toggleOff` | `#E3E4EA` | interrupteur éteint |
| `--accent` | `#5A46D6` | couleur de marque, CTA |
| `--accent-rgb` | `90,70,214` | triplet pour les `rgba()` |
| `--danger` | `#D6273D` | erreurs, actions destructives |
| `--mutedBox` | `#F6F6F8` | encart neutre |
| `--dashed` | `#CBCDD6` | bordure d'état vide |
| `--scrimOverlay` | `rgba(16,17,20,0.55)` | voile modal |

### Couleurs — thème sombre

| Token | Valeur |
|---|---|
| `--scrim` | `#191B21` |
| `--surface` | `#14161D` |
| `--surface2` | `#1B1E27` |
| `--text` | `#F5F6F8` |
| `--text2` | `#B4B7C0` |
| `--text3` | `#7D818C` |
| `--border` | `#282C37` |
| `--band` | `#F0B429` |
| `--bandText` | `#14110A` |
| `--chipBg` | `#1B1E27` |
| `--chipText` | `#B4B7C0` |
| `--inputBg` | `#191C24` |
| `--inputBorder` | `#2E323F` |
| `--toggleOff` | `#2E323F` |
| `--accent` | `#8672F5` |
| `--accent-rgb` | `134,114,245` |
| `--danger` | `#FF6B6B` |
| `--mutedBox` | `#191C24` |
| `--dashed` | `#2E323F` |
| `--scrimOverlay` | `rgba(6,7,10,0.68)` |

L'accent violet est la **seule couleur de marque à préserver telle quelle** — elle reprend
celle du bouton « Finaliser » du drawer actuel. Tout le reste (fonds, bordures, ambre) est
nouveau.

### Couleurs dérivées

Calculées à partir des tokens ci-dessus, jamais saisies en dur :

| Token | Formule | Clair | Sombre |
|---|---|---|---|
| `--bg` | `var(--scrim)` | — | — |
| `--accent-lt` | `rgba(var(--accent-rgb), α)` | α = 0.09 | α = 0.16 |
| `--accent-2` | `color-mix(in srgb, var(--accent) 78%, #fff)` | — | — |
| `--accent-deep` | `color-mix(in srgb, var(--accent) 72%, #000)` | — | — |
| `--border2` | `color-mix(in srgb, var(--border) 60%, transparent)` | — | — |
| `--green` | statut « validé / signé » | `#0F9D6E` | `#3DD9A5` |
| `--cyan` | statut « en cours » | `#0B7FA8` | `#4FC9E8` |
| `--pink` | accent catégoriel | `#C42678` | `#FF6FA8` |

Alias de compatibilité présents dans le prototype (`--text-muted` → `--text2`,
`--text-sub` → `--text3`, `--red` → `--danger`, `--amber` → `--band`,
`--accent-sec` → `--band`) : **ne pas les reproduire** dans le codebase, utiliser
directement les tokens canoniques.

### Tons sémantiques

Le Drawer et les badges consomment une échelle de tons plutôt que des couleurs directes.
Chaque ton = un triplet fond / texte / filet :

| Ton | Fond | Texte | Filet |
|---|---|---|---|
| `warning` | `--band` | `--bandText` | `--band` |
| `danger` | `--danger` | `#fff` | `--danger` |
| `success` | `--green` | `#fff` | `--green` |
| `info` | `--cyan` | `#fff` | `--cyan` |
| `accent` | `--accent` | `#fff` | `--accent` |
| `neutral` | `--surface2` | `--text2` | `--border` |

### Typographie

**Une seule famille : Geist.** Pas de police à chasse fixe dans le système.

```
--font-display: 'Geist', ui-sans-serif, system-ui, sans-serif;
--font-ui:      'Geist', ui-sans-serif, system-ui, sans-serif;
--font-mono:    var(--font-ui);   /* alias sémantique, rend en Geist */
```

`--font-mono` est conservé comme **point d'accroche sémantique** pour les données
chiffrées (dates, montants, taux, champs numériques). Il ne change pas la famille : à la
place, ces zones portent `font-variant-numeric: tabular-nums` pour garder l'alignement
vertical des colonnes de chiffres. Si le codebase préfère supprimer l'alias, appliquer
directement `tabular-nums` sur les mêmes zones.

Échelle typographique :

| Rôle | Taille | Graisse | Tracking | Autres |
|---|---|---|---|---|
| Titre de page | 52px | 700 | −0.05em | `line-height: 0.95` |
| Titre de section | 26px | 700 | −0.04em | majuscules, bordure basse 3px `--accent` |
| Titre de drawer | 26px | 700 | −0.02em | — |
| Valeur focale (montant) | 29px | 700 | −0.02em | `tabular-nums` |
| Titre de bloc | 16px | 700 | −0.02em | — |
| Sous-titre de section | 11px | 800 | 0.14em | majuscules, `--text3` |
| Label de section (drawer) | 11px | 700 | 0.08em | majuscules, `--text3` |
| Corps | 13–13.5px | 400–600 | — | `line-height: 1.5–1.6` |
| Label de champ | 12.5px | 600 | — | `--text2` |
| Méta / données chiffrées | 12.5px | 500–600 | 0.01–0.04em | `tabular-nums` |
| Aide | 11.5px | 500 | — | `line-height: 1.55` |
| Badge | 10.5px | 700 | 0.04em | majuscules |
| Bandeau de statut | 11px | 700 | 0.1em | majuscules |

### Espacement

Échelle : **4, 8, 12, 16, 24, 32, 48, 64, 80, 96** px.

Padding de drawer : 24px latéral en en-tête et pied, 20–24px dans le corps scrollable.
Gap de grille de champs : 12px. Gap entre blocs du corps : 24px.

### Rayons

| Valeur | Usage |
|---|---|
| 3px | badges, onglets de picker, `kbd` |
| 4px | boutons, chips, cellules de calendrier |
| 6px | cartes, champs, selects, menus (`--radius`) |
| 8px | boutons de drawer, encarts neutres |
| 10px | états vides en pointillés |
| 999px | interrupteurs, pastilles |

Direction générale : **bordures peu arrondies, assumées**. Ne pas arrondir davantage.

### Bordures

- **1.5px** dans le drawer, les champs et les encarts — choix délibéré pour le contraste.
- 1px pour les séparateurs secondaires du catalogue.

### Élévations

| Niveau | Valeur |
|---|---|
| 0 — flat | `none` + bordure 1px `--border` |
| 1 — subtle | `0 1px 3px rgba(0,0,0,.06), 0 1px 8px rgba(0,0,0,.04)` |
| 2 — card (`--shadow`) | clair `0 1px 2px rgba(16,17,20,.05), 0 2px 10px rgba(16,17,20,.05)` · sombre `0 1px 2px rgba(0,0,0,.4), 0 2px 10px rgba(0,0,0,.35)` |
| 3 — float | `0 4px 12px rgba(0,0,0,.08), 0 12px 32px rgba(0,0,0,.1)` |
| 4 — modal (`--shadow-lg`) | clair `0 4px 16px rgba(16,17,20,.1), 0 16px 48px rgba(16,17,20,.12)` · sombre `0 4px 16px rgba(0,0,0,.5), 0 16px 48px rgba(0,0,0,.55)` |
| Drawer | `-28px 0 64px rgba(0,0,0,.45)` (ancré à droite) |

### Animation

| Token / usage | Valeur |
|---|---|
| `--ease-spring` | `cubic-bezier(.2,.8,.3,1.3)` |
| Transition standard | 0.15s |
| Apparition / modale | `cubic-bezier(0,0,.2,1)` |
| Glissement de drawer | 0.32s `cubic-bezier(.22,1,.36,1)` |
| Fondu du scrim | 0.25s |
| Shimmer de skeleton | 1.2s, boucle |

---

## Micro-interactions

La direction demande des retours **visibles**. À reproduire :

- **Boutons** — `hover: translateY(-2px)` ; `active: translateY(0) scale(0.96)`. Le bouton
  primaire porte une ombre d'offset `0 2px 0 var(--accent-deep)` qui passe à
  `0 1px 0` au `:active` (effet d'enfoncement).
- **Cartes** — `hover`: passage à l'élévation 4 + bordure `--accent`.
- **Carte artiste** — `hover: translateY(-4px) scale(1.02)`.
- **Bouton d'icône contextuel** — `hover`: fond `--accent`, texte blanc, `scale(1.08)`.
- **Cellule de mois** — `hover`: fond `--accent`, texte blanc, `scale(1.05)`.
- **Item de dropdown** — `hover: translateX(2px)`.
- **Pagination** — `hover: translateY(-2px)`.
- **Focus clavier** — `outline: 2px solid var(--accent); outline-offset: 2px` sur
  `:focus-visible` pour boutons, champs et liens. À conserver : c'est l'accessibilité.

---

## La primitive Drawer

### Principe

**Un seul composant pour tous les panneaux latéraux de l'application.** La structure n'est
jamais écrite en HTML : on passe une configuration et le drawer se compose à partir de
**blocs typés**. Cela permet à la même primitive de servir une finalisation de deal, une
fiche en lecture, une confirmation destructive ou un panneau de filtres — et garantit que
tous les panneaux de l'app restent cohérents.

```js
Drawer.open({
  title: 'ORELSAN',
  meta: ['21 / 08 / 2027'],
  band: { tone: 'warning', labels: ['Brouillon', 'À traiter'] },
  blocks: [ /* blocs typés */ ],
  footer: { primary: { label: 'Finaliser', gate: s => !!s.fields.rate } }
});
```

En React, la forme naturelle est un composant `<Drawer config={…} />` ou un hook
`useDrawer()` ; garder le **modèle de blocs** comme contrat de données.

### Options de premier niveau

| Option | Valeurs | Défaut | Rôle |
|---|---|---|---|
| `title` | string | — | titre principal (26px display) |
| `titleIcon` | nom d'icône Lucide | — | icône devant le titre, en `--accent` |
| `eyebrow` | string | — | surtitre 11px majuscules `--text3` |
| `meta` | string[] | — | ligne de méta, séparée par `·`, `tabular-nums` |
| `band` | `{ tone, labels[], icon }` | — | bandeau de statut pleine largeur |
| `size` | `sm` 360 · `md` 420 · `lg` 520 · `xl` 680 · nombre | `md` | largeur en px |
| `side` | `right` · `left` | `right` | ancrage (l'ombre s'inverse) |
| `theme` | `dark` · `light` · `inherit` | `dark` | thème local, indépendant de la page |
| `themeToggle` | bool | `false` | affiche un sélecteur dark/light dans l'en-tête |
| `headerActions` | `[{ icon, label, onClick }]` | — | boutons icône dans l'en-tête |
| `blocks` | bloc[] | `[]` | contenu du corps scrollable |
| `footer` | `{ primary, secondary[] }` | — | pied collant |
| `dismissible` | bool | `true` | clic sur le scrim et `Escape` ferment |
| `autofocus` | bool | `true` | focus le premier champ du corps |
| `onChange` | `(state) => void` | — | à chaque saisie ou bascule |
| `onClose` | `() => void` | — | après l'animation de fermeture |

`theme: 'inherit'` fait suivre le thème global de la page. `dark` / `light` forcent un
thème **local** en re-déclarant les tokens sur le panneau (classes `.scope-dark` /
`.scope-light` dans le prototype) : c'est ce qui permet au drawer de rester sombre dans une
page claire, comme spécifié à l'origine pour le drawer de deal.

### Blocs disponibles

| Type | Champs | Rendu |
|---|---|---|
| `section` | `label`, `badge`, `accent`, `tone`, `children[]` | groupe titré ; `accent: true` ajoute une bordure gauche de 3px dans la couleur du ton |
| `fields` | `cols` (1–4), `items[]` | grille de champs `repeat(cols, minmax(0,1fr))`, gap 12px |
| `stat` | `label`, `value`, `meta[]`, `note` | valeur focale 29px + ligne de méta + note optionnelle |
| `kv` | `items: [[clé, valeur]]` | lignes clé/valeur séparées par un filet 1.5px |
| `toggles` | `items: [{ name, label, on }]`, `help` | interrupteurs + texte d'aide |
| `list` | `items: [{ icon, title, sub, badge, tone }]` | liste d'entités |
| `steps` | `items: [{ label, state }]` | progression ; `state`: `done` · `active` · absent |
| `empty` | `icon`, `title`, `text` | état vide, bordure pointillée 1.5px, rayon 10px |
| `muted` | `text` | encart neutre sur `--mutedBox` |
| `note` | `tone`, `icon`, `text` | message toné avec icône |
| `divider` | — | filet 1.5px |
| `html` | `html` | échappatoire pour un cas non couvert |

Un `item` de `fields` : `{ kind, label, name, value, placeholder, options[], mono, rows }`
avec `kind` ∈ `text` · `select` · `date` · `textarea`. `name` expose le champ dans l'état.
`mono: true` marque la donnée comme chiffrée (`tabular-nums`).

### Pied et portillon de validation

```js
footer: {
  primary: {
    label: 'Finaliser',
    icon: 'check',
    variant: 'primary' | 'danger',
    gate: (state) => boolean,   // active/désactive le CTA
    onClick: (state, api) => {}
  },
  secondary: [{ label: 'Générer le PDF', icon: 'file-down', onClick }]
}
```

`state` a la forme `{ toggles: { [name]: bool }, fields: { [name]: string } }`. `gate` est
réévalué à chaque saisie et à chaque bascule. `api` expose `{ el, state, refresh, close }`.

### Presets livrés

Quatre presets démontrent que la primitive encaisse des architectures différentes. Ce sont
des **exemples de composition**, à remplacer par les vraies configurations métier :

| Preset | Architecture |
|---|---|
| `deal` | finalisation de deal — `md`, dark, bandeau ambre, section fiscale à bordure accentuée, valeur focale + note d'erreur, états vides, portillon à 3 conditions |
| `artist` | fiche en lecture — `md`, thème hérité, bandeau succès, valeur focale, étapes, clé/valeur, liste de contacts, zone de notes |
| `confirm` | confirmation destructive — `sm`, ton danger, pas de formulaire, portillon sur un acquittement |
| `filters` | panneau de filtres — `lg`, **ancré à gauche**, formulaire dense 2–3 colonnes |

### Accessibilité

`role="dialog"`, `aria-modal="true"`, `aria-label` = titre. `Escape` ferme si
`dismissible`. Le focus part sur le premier champ. **À ajouter en intégration** (absent du
prototype) : piégeage du focus dans le panneau, et restitution du focus à l'élément
déclencheur à la fermeture.

---

## Inventaire des composants

Le catalogue (`reference/Mannyx Components V2.html`) contient 22 sections. Ouvrir le
fichier pour les valeurs exactes de chaque état.

**Fondations** — palette des tokens, échelle typographique, échelle d'espacement,
5 niveaux d'élévation, 4 courbes d'easing (démos cliquables).

**Composants de base**
- *Boutons* — 4 variantes (`primary`, `secondary`, `ghost`, `danger`) × 4 tailles
  (XS 11px → L 15px), avec ou sans icône, état désactivé à 40% d'opacité.
- *Badges & statuts* — badge toné (bordure pleine + fond à 10%), badge à pastille.
- *Formulaires* — champ texte, select, recherche, montant avec suffixe de devise,
  zone de texte, date, interrupteur, case à cocher, boutons radio (liste, ligne, cartes).
- *Accordéons* — groupé exclusif, séparé multiple avec icônes.
- *Bascule liste/grille* — contrôle segmenté + collection qui bascule de disposition.
- *Cartes* — carte de module (dashboard), carte de statistique, carte artiste.
- *Tableaux* — en-tête `--surface2`, lignes à filet, survol teinté accent, cellule
  d'avatar, badge de statut, bouton d'actions.
- *Navigation* — item de sidebar (3 états), onglets, fil d'ariane.

**Superpositions**
- *Modales* — 4 variantes de grille intérieure : 1, 2, 3 et 4 colonnes.
- *Modales de preview* — quick view artiste, preview de contrat (rendu document),
  lightbox de fichier, preview générique 2 panneaux.
- *Dropdown & menus* — dropdown simple, menu contextuel, select groupé.
- *Tooltip · Popover · Drawer* — tooltip 3 positions, popover riche, déclencheurs de drawer.
- *Command palette* — recherche globale, raccourci `⌘K`, navigation clavier, résultats groupés.

**Données**
- *Graphiques* — barres de progression, donut de répartition, encarts de KPI.
- *Sélecteurs date & heure* — date picker, time picker à cadran, datetime picker,
  date range picker. Tous à **280×320px** exactement.
- *Loaders & upload* — skeletons (carte, ligne de tableau, grille), zone de
  glisser-déposer, liste de fichiers à 3 états.
- *Drag & drop* — liste réordonnable, colonnes kanban.
- *États vides* — avec et sans CTA.
- *Notifications* — 4 tons.

**Métier Mannyx**
- *Carte d'accréditation presse* — en-tête accent, zones autorisées, emplacement de QR code.
- *Carte staff / bénévole* — avatar, rôle, shifts, zone, statut.
- *Template d'email booking* — en-tête de marque, récapitulatif de l'offre, CTA accepter/refuser.

### Accordéons, radio, bascule liste/grille — points d'attention

- **Accordéon** — deux variantes : *groupé* (un conteneur, filets entre items) et *séparé* (items espacés de 8px, bordure accent quand ouvert). Attribut `data-single` = un seul item ouvert à la fois. Ouverture animée par `grid-template-rows: 0fr → 1fr` (0.3s `cubic-bezier(.22,1,.36,1)`), contenu en fondu + glissement de 6px, chevron qui pivote de 180° en `--ease-spring` et passe en `--accent`. Item ouvert en variante groupée : filet gauche de 3px `--accent`. En-tête = `<button aria-expanded>`. Action « Tout déplier / Tout replier » sur la variante multiple.
- **Bouton radio** — pastille 18px, bordure 1.5px `--inputBorder`, point intérieur 8px `--accent` qui apparaît en `scale(0 → 1)` avec `--ease-spring`, `scale(.86)` au clic. Trois formes : liste verticale, ligne horizontale, *radio cards* (fond `--accent-lt` + bordure accent quand sélectionnée, `translateY(-2px)` au survol). Sémantique `role="radiogroup"` / `role="radio"`, navigation aux flèches, tabindex itinérant, état désactivé à 40%.
- **Bascule liste/grille** — contrôle segmenté avec pastille glissante (0.28s `--ease-spring`), variantes avec libellé ou icône seule (`list` / `layout-grid`). Au changement, les items rejouent une entrée décalée de 35ms chacun. Choix persisté (clé `mannyx-ds-view` dans le prototype — en intégration, persister par écran).

### Sélecteurs date & heure — points d'attention

- Les quatre sélecteurs font **280px de large et 320px de haut**, sans exception.
- **Clic sur l'en-tête `Mois AAAA`** → grille de sélection des 12 mois ; **clic sur
  l'année** dans cette grille → grille de 12 années, décennies navigables. Retour possible
  à chaque niveau (années → mois → jours).
- Le **time picker fonctionne à la minute** : le cadran accepte le clic et le
  glisser-déposer sur n'importe quelle position des 60 minutes, pas seulement les
  multiples de 5. L'aiguille se place à la minute exacte ; les libellés restent tous les 5.
- Les **heures et minutes sont éditables au clavier** directement dans l'affichage de
  l'en-tête, sans passer par le cadran. Bornes : 0–23 et 0–59, avec écrêtage silencieux.
- Cadran des heures : anneau extérieur 12–23, anneau intérieur 0–11, discriminés par le
  rayon du point de clic.
- Le popup d'un datetime picker est en `position: absolute` **hors du flux** de sa carte,
  `z-index: 500` — sinon il déborde et pousse le contenu.

---

## Interactions & comportements

- **Thème** — attribut `data-theme` sur `<html>` (`light` | `dark`), persisté dans
  `localStorage` sous la clé `mannyx-ds-theme`. Le drawer peut forcer un thème local
  indépendamment de la page.
- **Command palette** — s'ouvre au `⌘K` / `Ctrl+K`, filtre sur libellé, sous-titre et
  groupe ; `↑` `↓` naviguent, `↵` valide, `Escape` ferme.
- **Drag & drop** — liste réordonnable par `draggable` HTML5 ; kanban par déplacement du
  nœud entre colonnes. À remplacer par la librairie DnD du codebase.
- **Upload** — retour visuel sur `dragover`, 3 états de fichier (terminé, en cours avec
  barre de progression, erreur).
- **Skeletons** — shimmer 1.2s en boucle, teinté à l'accent à 8%.
- **Escape** ferme drawer, modales et command palette.

---

## State management

Pas de state global : chaque composant est autonome. Ce dont l'intégration a besoin :

- **Thème** — `'light' | 'dark'`, persisté, lu au démarrage.
- **Drawer** — un seul panneau ouvert à la fois (le prototype ferme le précédent à
  l'ouverture d'un nouveau). État interne : valeurs des champs et des interrupteurs, dérivé
  en `{ toggles, fields }` pour le `gate`. En React, remonter ces valeurs dans le state du
  formulaire du codebase plutôt que de lire le DOM.
- **Pickers** — heure `{ h, m, mode }`, date `{ month, year, selected, view }` avec
  `view` ∈ `days` · `months` · `years`, plage `{ rangeStart, rangeEnd }`.
- **Command palette** — `{ open, query, activeIndex }`.

Aucun appel réseau dans le prototype : toutes les données sont des exemples en dur.

---

## Assets

- **Icônes — Lucide** (https://lucide.dev, licence ISC). Le prototype embarque un registre
  de 55 icônes en géométrie Lucide d'origine (viewBox 24, `stroke-width: 2`, caps et joins
  arrondis) uniquement parce qu'il doit fonctionner sans build.
  **En intégration : installer le paquet officiel** (`lucide-react`, `lucide-vue-next`, …)
  et ne pas porter `mannyx-icons.js`. Noms utilisés, tels quels dans Lucide :
  `check` `x` `plus` `minus` `pencil` `copy` `trash` (= `trash-2`) `upload` `download`
  `share` (= `share-2`) `settings` (= `settings-2`) `search` `filter` `chevron-down`
  `chevron-up` `chevron-left` `chevron-right` `arrow-right` `arrow-left` `arrow-up-right`
  `external-link` `panel-right` `more-horizontal` `grip-vertical` `alert-triangle`
  `circle-check` `circle-x` `circle-alert` `info` `loader` `file-text` `file-down` `image`
  `folder-open` `clipboard-list` `user` `users` `music` `calendar` `clock` `ticket` `mail`
  `banknote` `layout-grid` `list` `sun` `moon`.
- **Émoji — interdits.** Aucun émoji ne doit apparaître dans l'UI ; toute iconographie
  passe par Lucide. Le catalogue en est exempt (vérifié).
- **Police — Geist** (licence SIL OFL 1.1), disponible sur Google Fonts. Graisses
  utilisées : 300 à 900. Geist Mono n'est **pas** utilisée.
- **QR code** — la carte d'accréditation réserve un emplacement de 52×52px ; le QR réel
  est généré côté app.
- **Images** — aucune image dans le lot. Les avatars d'artistes sont des monogrammes sur
  fond accent teinté ; prévoir un fallback monogramme si l'app affiche de vraies photos.

---

## Notes d'intégration

1. **Mapper les tokens, ne pas dupliquer.** Si le projet a déjà des variables CSS ou une
   config Tailwind, brancher la table de tokens dessus. Ne jamais écrire une couleur de
   marque en dur dans un composant.
2. **Le Drawer est un re-skin, pas une refonte fonctionnelle.** Pour le drawer de deal
   existant : localiser le composant actuel dans le codebase et lui appliquer la nouvelle
   structure et les nouveaux tokens. Aucune logique métier ne change — calcul du cachet,
   `rate-card` / `edition_tax_config`, validations, refacturations, état des toggles
   restent pilotés par le code existant. Voir `reference/annexe-drawer-deal-metier.md`.
3. **Les états du preset `deal` sont une démo.** Les deux interrupteurs, le bandeau
   `BROUILLON · À TRAITER` et le message d'erreur de rate-card sont en dur dans le
   prototype pour montrer le rendu. En intégration : brancher sur l'état réel du deal, et
   n'afficher le message que si `edition_tax_config` n'est pas configuré pour l'édition.
   Les autres statuts de deal reprennent le même traitement de bandeau pleine largeur.
4. **Recommandé : audit avant implémentation.** Repérer les composants actuels, leurs
   props, leur state et leurs dépendances de style avant de modifier quoi que ce soit,
   plutôt que de recréer depuis zéro.
5. **Attribut `font-family` en SVG** — les attributs de présentation SVG n'acceptent pas
   `var()`. Les quelques `<text>` du cadran d'horloge portent donc `font-family="Geist,
   sans-serif"` en dur. En React, préférer une prop CSS `style={{ fontFamily: … }}`.
6. **Fichier obsolète.** Le projet contient aussi `Mannyx Redesign.html`, un prototype
   antérieur de trois directions visuelles (Obsidian / Studio / Prism) sur une palette
   violette différente. Il est **périmé** : il précède l'adoption des tokens de ce handoff
   et ne doit pas servir de référence. Il n'est volontairement pas inclus dans ce bundle.

---

## Files

Dans `reference/` :

| Fichier | Nature | À porter ? |
|---|---|---|
| `Mannyx Components V2.html` | catalogue complet, source de vérité visuelle | référence — ne pas porter tel quel |
| `mannyx-drawer.js` | primitive Drawer : API, modèle de blocs, CSS | **API et blocs à reprendre**, implémentation à réécrire |
| `mannyx-icons.js` | registre Lucide pour fonctionner sans build | non — installer le paquet Lucide officiel |
| `annexe-drawer-deal-metier.md` | annexe métier du drawer de deal, fournie par le client | lecture obligatoire avant de toucher au drawer de deal |

Le catalogue charge les deux `.js` par `<script src>` : garder les trois fichiers dans le
même dossier pour que l'ouverture en local fonctionne.
