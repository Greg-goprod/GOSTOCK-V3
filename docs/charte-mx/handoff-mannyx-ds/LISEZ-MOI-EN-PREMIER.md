# Lisez-moi en premier

**Page d'orientation du projet. Elle n'est pas de la direction artistique.** Les autres
fichiers de ce dossier sont la livraison de la DA et ne sont pas réécrits.

---

## Règle de priorité entre les trois sources

Décision de Greg, 2026-09-23.

Ce lot contient trois documents normatifs qui donnent parfois des valeurs différentes pour
un même élément. **Ces divergences sont voulues et validées : ce sont des contextes
différents, pas des contradictions.** Chaque source est souveraine dans son contexte.

| Ce que vous implémentez | La source qui fait foi |
| --- | --- |
| Un composant de **drawer** | `reference/mannyx-drawer.js` |
| Un composant de **page** | `reference/Mannyx Components V2.html` |
| Du **transversal** — tokens, échelles (typo, espacement, rayon, élévation), tons sémantiques, règles d'accessibilité | `README.md` |

Si la source contextuelle est muette sur un point, on remonte : **source contextuelle →
`README.md` → décision de Greg.**

Exemple concret : l'interrupteur fait `34×18` avec un rayon de 4px au catalogue, et `38×22`
avec un rayon de 999px dans `mannyx-drawer.js`. Les deux sont justes. Dans un drawer, c'est
le second qui s'applique.

---

## Échelle typographique — écart projet assumé

Décision de Greg, 2026-09-23. **Définitive.**

**L'échelle typographique du tronc `src/components/mx` prime sur celle du handoff.** Là où le
handoff demande un texte plus grand ou plus gras, c'est la valeur du tronc qui s'applique.

| Élément | Handoff | Tronc — ce qui s'applique |
| --- | --- | --- |
| Texte saisi dans un champ | 13.5px / 600, hauteur 40px | **12.5px / 500, hauteur 34px** |
| Libellé de bouton | 13.5px / 700 (14px pour l'action principale) | **12.5px / 600**, hauteur actuelle |
| Titre d'item de liste | 13px / 700 | **12.5px / 700** — taille du tronc, graisse du handoff |
| Clé et valeur d'une ligne clé/valeur | 12px / 600 et 13px / 700 | **12.5px**, graisse actuelle |
| Libellé d'une ligne d'interrupteur | 13.5px / 600 | **12.5px / 600** — taille du tronc, graisse du handoff |

**Motif :** la densité des écrans réels. Un décompte final tient plusieurs dizaines de valeurs
à l'écran simultanément ; l'échelle du handoff, conçue sur des maquettes de démonstration peu
chargées, y devient trop lourde.

**Ce n'est pas un défaut à corriger.** Un audit de conformité qui retrouve ces écarts doit les
classer « conformes à la décision projet », et non « ERREUR ». Ne pas reproposer l'alignement
sur le handoff.

**Portée exacte : la taille et la graisse du texte, rien d'autre.** Tout le reste du handoff
continue de faire foi, y compris sur les primitives concernées — rayons, bordures, paddings,
espacements, couleurs, tracking, majuscules, chiffres tabulaires, états et micro-interactions.
En particulier, l'absence de majuscules sur un libellé de statistique, le tracking de 0.04em
sur une méta et les chiffres tabulaires sur une valeur chiffrée **restent dus** : ce sont des
réglages de lisibilité, pas des choix de taille.

**La décision a un SENS, elle n'est pas symétrique.** Elle protège le tronc d'un handoff plus
GROS ou plus GRAS que lui. Quand le handoff est au contraire **plus petit ou plus léger** que
le code existant, elle ne s'applique pas et la conformité reprend ses droits : on descend à la
valeur du handoff.

| Le handoff est… | Ce qui s'applique |
| --- | --- |
| plus grand ou plus gras que le tronc | **le tronc** — c'est le cas visé par la décision |
| plus petit ou plus léger que le tronc | **le handoff** — la décision ne joue pas |

Cas réel, pour fixer la lecture : le libellé d'une statistique était en graisse 700 dans le
tronc, le handoff le donne en 600. La décision ne le couvre pas — le handoff allège, il
n'alourdit pas. Le libellé est donc passé en 600. Symétriquement, le titre d'item de liste
garde la taille du tronc (12.5px, plus petite) mais prend la graisse du handoff (700), parce
que la décision ne portait que sur la taille et que l'aplatissement de la hiérarchie
titre/sous-titre n'a jamais été voulu.

C'est exactement la nuance qu'un futur audit inversera s'il lit la décision comme un blanc-seing
« le tronc gagne toujours ». Il ne gagne que vers le haut.

---

## Écart projet assumé — épaisseur du contour de focus clavier

Décision de Greg, 2026-09-23. Même jour que la pose du mécanisme, même traitement que
l'écart typographique ci-dessus.

Le README demande, sur `:focus-visible`, `outline: 2px solid var(--accent); outline-offset:
2px`. Le tronc pose **1px / 1px** : le 2px a été jugé trop épais et daté à l'écran par Greg.

**Le MÉCANISME `:focus-visible` est conservé INTÉGRALEMENT et n'est PAS négociable — c'est
l'accessibilité, le README le dit lui-même (« à conserver »). Seule l'ÉPAISSEUR du contour
diffère.** Rien d'autre ne bouge : ni la couleur (l'accent du thème), ni la seconde règle qui
neutralise le contour hors clavier, ni le périmètre (`data-mx-focus` sur boutons, champs,
interrupteurs, bouton de fermeture du drawer), ni l'exclusion volontaire du panneau du drawer
(focalisé par programme, jamais une cible de focus clavier).

**Ce n'est pas un défaut à corriger.** Un audit de conformité qui retrouve ce 1px doit le
classer « conforme à la décision projet », pas « ERREUR », et ne jamais proposer de revenir à
2px. Il doit en revanche **signaler toute disparition du mécanisme lui-même** — contour absent
au clavier, ou contour présent au clic souris : c'est le mécanisme qui compte, pas
l'épaisseur, et c'est lui que cette décision protège, pas la valeur du README.

> **Précision (Greg, 2026-09-24).** « Contour présent au clic souris » ne vaut panne que
> sur les boutons, interrupteurs et autres contrôles non textuels. Sur un **champ de saisie
> de texte** (`input` texte, `textarea`), les navigateurs activent `:focus-visible` au clic,
> par conception : le contour au clic y est le comportement attendu, pas une panne. Vérifié
> à la main sur `MxTextField` / `MxTextArea` (C7, `cf6e674`). En automatisation, toute mesure
> de focus doit relever `document.hasFocus()` : s'il vaut faux, `:focus` et `:focus-visible`
> ne s'appliquent jamais et la mesure est sans valeur.

Mesuré avant application (calcul WCAG sur les valeurs sRGB des tokens, pas une lecture en
navigateur) : le contour reste au-dessus du plancher de contraste 3:1 dans les quatre
contextes qui comptaient — y compris contre le fond réel de `--mx-focus-ring`, le halo
translucide que porte déjà tout champ et interrupteur, où le contour à 1px se loge désormais
entièrement. Le cas le plus juste, sombre sur `--mx-surface2`, mesure 3.59:1. Détail et méthode
dans `src/styles/tokens-mx.css`, au-dessus de la règle `[data-mx-focus]:focus-visible`.

---

## Ce que contient le lot

| Fichier | Rôle |
| --- | --- |
| `README.md` | La spécification du design system. Fait foi sur tout le transversal. |
| `reference/Mannyx Components V2.html` | Le catalogue (v5) : 25 sections et 50 sous-sections, avec leur CSS — comptage des titres `section-title` / `subsection-title`, pas un nombre de composants. Le `README.md` de la DA annonce 22 sections : chiffre non tenu à jour (23 déjà en v3). **C'est la référence visuelle à ouvrir dans un navigateur.** |
| `reference/mannyx-drawer.js` | La primitive Drawer et ses blocs (`.mx-dr-*`). Fait foi sur tout ce qui vit dans un drawer. |
| `reference/mannyx-icons.js` | Le jeu d'icônes du prototype. Dans le dépôt, on utilise `lucide-react`. |
| `reference/annexe-drawer-deal-metier.md` | Note métier sur le drawer de deal. **Voir l'avertissement ci-dessous.** |
| `01-catalogue-autonome.html` | Bundle auto-extractible du catalogue. **Non lisible comme source** : il déballe ses ressources au chargement dans un navigateur. Pour lire du CSS, ouvrir `reference/Mannyx Components V2.html`. |

---

## Trois avertissements

**1. La §3 de `reference/annexe-drawer-deal-metier.md` est périmée.** Elle demande Space
Grotesk / Manrope / IBM Plex Mono. Le `README.md` impose **Geist seule**, déployée dans le
dépôt depuis `e5b7b42` (2026-09-19). Le reste de l'annexe reste valide. Un bandeau le
rappelle en tête du fichier ; la §3 n'a pas été corrigée, elle est conservée à titre
d'historique.

**2. Deux fichiers sont cités mais absents du bundle** — ne pas les chercher :
`deal-editorial-mono.html` (cité par l'annexe comme son rendu de référence) et
`Mannyx Redesign.html` (cité par le `README.md`, périmé et volontairement exclu par
l'auteur du handoff).

**3. `design_handoff_rider_artistes/`, à la racine du dépôt, ne fait pas foi.** Il ne couvre
qu'une page liste et ne définit aucun design system. Le 2026-09-23, un audit de conformité
a été mené contre lui par défaut et a dû être entièrement refait. **Le handoff du design
system est celui-ci.**

---

## Version versée

Décision de Greg, 2026-09-24.

Ce dossier porte la **v5** du handoff (livraison du 2026-09-24).

Fichiers remplacés à l'identique par la v5 : `01-catalogue-autonome.html`,
`reference/Mannyx Components V2.html`. Inchangés entre la version précédente et la v5,
vérifié par hachage Git : `reference/mannyx-drawer.js`, `reference/mannyx-icons.js`.

`README.md` : v5, bloc projet de tête reporté à l'identique (renvoi `Mannyx Redesign.html`
corrigé vers « Notes d'intégration », point 6). `reference/annexe-drawer-deal-metier.md` :
inchangée, vérifiée par diff (seul le bandeau projet diffère).

---

## Sources des 3 composants de page ajoutés en v5

Accordéon, bascule liste/grille, bouton radio : trois composants de **page**, absents du
drawer.

| Composant | Source qui fait foi |
| --- | --- |
| Accordéon | Catalogue, `#s-accordion` |
| Bascule liste/grille | Catalogue, `#s-viewtoggle` |
| Bouton radio | Catalogue, section Formulaires « Boutons radio » |

À défaut, `README.md`, section « Accordéons, radio, bascule liste/grille — points
d'attention ».

**Le drawer (`reference/mannyx-drawer.js`) est muet sur les trois** — vérifié par
recherche dans le fichier (`accordion`, `viewtoggle`, `radio` : zéro occurrence).

---

## `00-README.html` — non versionné (rappel)

Livré en v5, ce fichier est un rendu HTML 1:1 de `README.md`, sans les annotations projet
(ce présent fichier, la règle de priorité entre les trois sources, les avertissements).
**Volontairement non versionné** — ne pas le réintroduire dans le dépôt.

---

## Écarts assumés (Greg, 2026-09-24)

- **Focus de l'accordéon** : `outline: 1px`, `outline-offset: -1px` (vers l'intérieur).
  Le conteneur est en `overflow:hidden` ; un offset positif rogne le contour. Le
  mécanisme `:focus-visible` reste non négociable — seul le sens de l'offset change.
- **`prefers-reduced-motion`** : règle du **TRONC ENTIER** (`src/components/mx/**`), pas
  seulement des 3 composants v5. Sous reduce : déplacements, ressorts, rotations et
  entrées décalées supprimés ; seuls les fondus d'opacité sont conservés, raccourcis. Le
  handoff n'en prévoit aucun. Alignement des primitives déjà livrées : lot dédié « C-RM ».
- **Précisions (Greg, 2026-09-24)** : transitions de couleur et d'ombre hors périmètre,
  inchangées ; rouet de chargement (MxLoadingLine) exempté — un indicateur figé ferait
  croire à un blocage ; fondus sous reduce en var(--mx-dur-fast), sans nouveau token ;
  drawer sous reduce : immobile, fondu d'opacité seul.
- **Libellé radio = champ** → 12.5px / 500 (écart typographique directionnel, même
  traitement que la décision du 2026-09-23). Titre des radio cards : à trancher au
  cadrage de `MxRadio`.
- **Accessibilité de la bascule** : le prototype exclut `.vt` de la navigation aux
  flèches (vérifié : seuls des listeners `click` sont attachés dans `vtInit()`).
  `MxSegmented` doit reprendre la sémantique `radiogroup` complète (flèches, tabindex
  itinérant).

---

## `@keyframes vtIn` — pas de 3e exception CSS

L'entrée décalée des items de la bascule liste/grille (`@keyframes vtIn`, 35ms par item)
ne justifie pas une 3e exception dans `tokens-mx.css`. Passer par la Web Animations API
côté TSX, ou abandonner l'effet.

---

## C8 — MxDrawer : écarts et équivalences (Greg, 2026-09-24)

- **`theme` par défaut `'inherit'`** (handoff : `'dark'`) : le panneau suit le thème
  ambiant sauf demande explicite, cohérent avec le reste du tronc (aucune primitive
  n'impose un thème local par défaut).
- **`themeToggle` non repris** : pas de sélecteur dark/light dans l'en-tête. Un
  consommateur qui veut basculer le thème local passe directement une valeur
  différente à la prop `theme`.
- **`gate` non repris** : le portillon de validation du pied (`footer.primary.gate`)
  n'existe pas côté tronc — l'appelant calcule sa condition lui-même et passe
  `disabled` au bouton, comme le reste des primitives `Mx*`.
- **`onClose` appelé à l'action, pas après l'animation** : Échap, clic sur le voile et
  bouton de fermeture appellent `onClose` immédiatement ; le prototype attend la fin
  de la transition (`setTimeout` 320ms) avant de démonter et d'appeler `cfg.onClose`.
  Le tronc ne démonte jamais le panneau (`inert` seul porte la fermeture), donc rien
  n'attend l'animation.
- **`size` en échelle fermée** : pas de largeur en pixels libres (le handoff accepte un
  nombre). Une largeur hors échelle doit devenir un cran, ou ne pas exister.
- **`MxSteps` : `--mx-accent-lt` et `--mx-tone-on-accent`**, pas `rgba(accent, .14)` et
  `#fff` — l'alpha exact du prototype n'a pas d'équivalent tokenisé, et un blanc fixe
  échouerait le contraste en thème sombre sur un fond accent clair. Structure en liste
  ordonnée (`<ol>`/`<li>`) avec `aria-current="step"`, absente du prototype (`<div>`
  simples).
- **`MxSteps` : paliers 9.5px (libellé) et 10px (numéro) créés** pour respecter la règle
  directionnelle (le handoff peut être plus petit que l'échelle du tronc, jamais
  l'inverse) — voir `--mx-fs-step-label` / `--mx-fs-step-num` dans `tokens-mx.css`.
- **`headerActions` avec `aria-label`** : chaque bouton porte `aria-label` ET `title`
  égaux au `label` fourni — le prototype ne pose qu'un `title`.
