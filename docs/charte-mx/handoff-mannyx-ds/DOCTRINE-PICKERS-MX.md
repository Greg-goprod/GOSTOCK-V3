# Doctrine Pickers Mx — sélecteurs du handoff, seuls et uniques (LOT PICKERS-MX)

> **Portée.** Ce document fixe la famille **unique** de sélecteurs de date et d'heure pour
> toute l'application `go-prod-aura`. Décision de Greg, LOT PICKERS-MX (2026-10-16) :
> **les sélecteurs dessinés par la DA dans le handoff** (`reference/Mannyx Components
> V2.html`, section « Sélecteurs date & heure ») **remplacent TOUS les sélecteurs
> existants**, sans exception de module ni de branche (Mannyx ou ancienne). Après migration,
> l'ancien code est supprimé — règle du 06/10 : pas de restes, pas de confusion.
>
> **Statut.** STOP 1 du LOT PICKERS-MX : famille construite (S2) et adoptée dans le module
> Booking (S3) uniquement. L'adoption dans les autres modules et la suppression de l'ancien
> code (`DatePickerPopup`, `TimePickerPopup`, `DateTimePickerPopup`,
> `DateRangePickerPopup`, `DatePickerAura`, `TimePickerCircular24`, `DateTimePickerAura`,
> `src/styles/pickers.css`) **n'interviennent qu'après le GO explicite de Greg sur le
> rapport STOP 1** — ne pas anticiper cette suppression.
>
> **ÉTAPE 1, C1 (recette Greg, 2026-10-16).** Cinq retours sur le Booking, tous corrigés :
> placement du popover hors d'un `MxPortal` (C1.1), superposition sous un drawer (C1.2),
> cadran limité aux multiples de 5 + en-tête tronqué (C1.3), plage horaire de la timeline
> figée sur les heures d'ouverture/fermeture configurées au lieu des performances réelles
> (C1.4), et un arrondi résiduel à 5 minutes dans `CustomTimePicker` qui écrasait la minute
> choisie avant enregistrement (C1.5). Détail au §2 (C1.1/C1.2/C1.3), §6 (C1.4) et §7 (C1.5).
>
> **ÉTAPE 1, C2 (recette Greg, 2026-10-16 14:23).** Deuxième passe sur l'horloge : le
> correctif C1.3 avait lui-même introduit un en-tête à vrais champs `<input>` (« pavé
> numérique immonde », blocs noirs/gris selon le rendu natif du navigateur) et une
> typographie qui s'écartait du handoff. Entièrement réécrit : en-tête texte pur (aucun
> `<input>`), typographie EXACTE du handoff, sélection de segment en un seul clic, saisie
> clavier séquentielle (« 1808 » → 18:08) sans changer l'apparence, Entrée/Échap. Détail
> au §2 (`MxTimePicker`).
>
> Toujours en attente du GO pour la suite.

---

## 1. Les 4 composants

| Composant | Fichier | Remplace | Contrat de valeurs |
| --- | --- | --- | --- |
| `MxDatePicker` | `src/components/mx/MxDatePicker.tsx` | `DatePickerPopup` | `value?: Date \| null`, `onChange(date: Date \| null)` |
| `MxTimePicker` | `src/components/mx/MxTimePicker.tsx` | `TimePickerPopup` | `value?: string \| null` (`"HH:MM"`), `onChange(time: string \| null)` |
| `MxDateTimePicker` | `src/components/mx/MxDateTimePicker.tsx` | `DateTimePickerPopup` | `value?: Date \| null` (instant combiné), `onChange(date: Date \| null)` |
| `MxDateRangePicker` | `src/components/mx/MxDateRangePicker.tsx` | `DateRangePickerPopup` | `startDate: string \| null`, `endDate: string \| null` (`"YYYY-MM-DD"`), `onChange(start, end)` |

Chaque contrat est **identique** à celui du composant qu'il remplace : l'adoption dans un
appelant se limite à changer l'import et à retirer les props propres à l'ancien habillage
(`size`, `className` ciblant un style Tailwind du déclencheur) — **aucune logique de
formulaire, aucune transformation de valeur n'est modifiée**.

## 2. Anatomie — conforme au handoff, sauf l'écart assumé du §3

Source unique : `docs/design/handoff-mannyx-ds/reference/Mannyx Components V2.html`,
classes `DatePicker` et `TimePicker` (L.2270-2610) et markup `.field` à deux déclencheurs
pour le date-heure (L.918-992).

- **Popover ancré sous le champ**, jamais une fenêtre centrée ni un drawer (écart
  volontaire avec l'ancien `DatePickerPopup`/`TimePickerPopup`/`DateTimePickerPopup`, qui
  ouvraient une modale `position:fixed` plein écran). Mécanique : trigger ref +
  `MxPortal` + recalcul au `resize`/`scroll` + fermeture au clic extérieur, à `Échap` et si
  le champ sort de l'écran — voir `src/components/mx/internal/useMxFieldPopover.ts`, calqué
  sur `MxMenu.tsx`.
  **CORRECTIF C1.1/C1.2 (retours de recette Greg, 2026-10-16).** Le panneau
  (`MxPickerPanel`, `src/components/mx/internal/MxPickerField.tsx`) était rendu EN PLACE,
  sans `MxPortal` — trouvé en recette dans le composeur, « Modifier l'horaire » et
  « Ajouter une performance » (popover ouvert en bas à droite de l'écran, C1.1) et dans le
  drawer de prolongation (calendrier ouvert DERRIÈRE le drawer, C1.2). Un ancêtre
  `transform` (drawer, fenêtre) crée un bloc conteneur pour tout descendant
  `position:fixed` : la position se calculait alors relativement à CET ancêtre au lieu du
  viewport, et le panneau restait prisonnier du contexte d'empilement de cet ancêtre quel
  que soit son propre `z-index`. Corrigé en passant `MxPickerPanel` par `MxPortal`, comme
  `MxMenu` le fait déjà. Échelle de superposition : `--mx-z-popover` (tokens-mx.css,
  SEULE source de vérité, voir son commentaire de tête) place tout flottant ancré à un
  champ — menu, popover, popup de picker — au-dessus de `--mx-z-drawer` et
  `--mx-z-modal`, À CONDITION de sortir du flux par `MxPortal` ; poser le token seul ne
  suffit pas.
- **`MxDatePicker`** : calendrier `cal-header` (dégradé `--mx-accent`→`--mx-accent-2`, nav
  `‹`/`›`), semaine **LUNDI→DIMANCHE** (`DAYS_FR`, `(getDay()+6)%7` — spécifié par le
  handoff, pas un défaut), grille **fixe de 42 cellules** (6 semaines, hauteur constante),
  drill-down jours → mois → années (décennies de 12 ans). Pied `Effacer` (gauche) /
  `Annuler` + `OK` (droite). Implémentation : `src/components/mx/internal/MxCalendarGrid.tsx`.
- **`MxTimePicker`** : cadran 24h à deux anneaux (intérieur 00-11, extérieur 12-23) pour les
  heures, anneau unique 60 positions pour les minutes — **aucun pas de 5 minutes** (le
  handoff accepte n'importe quelle minute 0-59), sélectionnable **au clic ET au glisser**
  n'importe où sur le cadran (pas seulement sur les 12 repères de graduation affichés tous
  les 5 minutes). En-tête HH:MM en **texte pur** (aucun `<input>` — voir correctif C2
  ci-dessous), un seul clic sur un segment (en-tête ou onglet « Heures »/« Minutes ») pour
  le rendre actif, clic sur une heure (cadran) bascule aussi automatiquement vers le mode
  minutes. Saisie clavier **séquentielle** sur le groupe focalisable (role="group") : taper
  des chiffres remplit le segment actif (« 1808 » → 18:08, bascule auto heures→minutes dès
  l'heure complète), Retour arrière efface, flèches Haut/Bas incrémentent/décrémentent le
  segment actif, Tab bascule de segment, Entrée valide (comme OK), Échap annule (comme
  Annuler). Implémentation : `src/components/mx/internal/MxClockFace.tsx`.
  **CORRECTIF C1.3 (retours de recette Greg, 2026-10-16).** Trois écarts trouvés en
  recette : en-tête HH:MM tronqué, cadran limité aux 12 repères de 5 minutes (le `<svg>`
  capte désormais `mousedown`/`touchstart` + suivi `mousemove`/`touchmove` sur `window`
  pendant le geste, conversion angle → minute exacte, immédiate au clic comme au glisser),
  et absence de flèches/bascule automatique au clavier (ajoutées). Le correctif C1.3
  utilisait deux vrais `<input>` HTML pour la saisie clavier des heures/minutes.
  **CORRECTIF C2 (retours de recette Greg, 2026-10-16 14:23).** Les `<input>` de C1.3
  rendaient, selon le moteur/la plateforme, un chrome natif visible (fond/bordure imposés
  par le navigateur malgré `background:transparent`/`border:none` — « pavé numérique
  immonde », blocs noirs/gris) ; la typographie différait aussi du handoff (30px/`-0.02em`/
  `1.6ch` au lieu de 36px/`-0.04em`/`2ch`, valeurs exactes de `.picker-time-display`/
  `.tp-input` du handoff) ; et un modèle « saisie + commit au `blur` » pouvait, selon
  l'ordre exact des évènements `blur`/`click` du navigateur, enregistrer une valeur
  périmée (18:10 au lieu de 18:08 choisi). En-tête réécrit sans aucun élément de formulaire
  natif : un seul conteneur focalisable (`role="group"`) contenant deux `<span
  aria-hidden="true">` de texte pur, tout le clavier centralisé sur ce groupe, commit
  synchrone à chaque frappe (plus de `blur`) — l'en-tête et l'aiguille du cadran lisent
  tous deux directement `hours`/`minutes`, donc ne peuvent plus diverger. Testé : 18:08
  choisi au cadran (clic heure + glisser-minute hors repère de 5), saisie séquentielle
  « 1808 » au clavier, Retour arrière, flèches, Tab, Entrée/Échap, absence de tout
  `role="textbox"` dans l'en-tête (`MxTimePicker.test.tsx`).
- **`MxDateTimePicker`** : **deux déclencheurs séparés** (date `flex:1`, heure largeur fixe
  82px) — PAS un widget fusionné. Chacun ouvre son propre popover (`MxDatePicker` ou
  `MxTimePicker`), jamais les deux à la fois. Un encart `SÉLECTIONNÉ` (fond
  `--mx-surface2`) affiche la valeur combinée en dessous.
- **`MxDateRangePicker`** : même `MxCalendarGrid` en mode `range` — indice « 1ᵉʳ clic →
  début » / « 2ᵉ clic → fin », 1ᵉʳ clic après une plage complète réinitialise, 2ᵉ clic avant
  le début permute (la plage reste chronologique).

### États couverts

Vide (placeholder), ouvert (popover affiché), sélection (jour/heure en surbrillance pleine
`--mx-accent`), désactivé (`disabled`, opacité réduite, pas de popover), erreur (filet
`--mx-danger` + message sous le champ), focus (anneau `--mx-focus-ring` sur le déclencheur,
`outline` sur la cellule de calendrier focalisée au clavier). Démontrés dans `MxPreview`
(§6), light et dark.

### Formats d'affichage — SPÉCIFIÉS par le handoff, pas une proposition par défaut

Le handoff démontre lui-même, dans son propre code de démo
(`d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})`, L.2558),
le format affiché au champ : **« 16 oct. 2026 »** (jour 2 chiffres, mois abrégé, année).
C'est ce format qui est repris ici — **pas** le format suisse numérique « 16.10.2026 »
qu'un défaut aurait pu proposer en l'absence de spécification : le handoff décide déjà sur
ce point, il n'y avait rien à inventer. Heure : `HH:MM`, 24h, toujours deux chiffres.

## 3. Écart typographique assumé (Greg, LOT PICKERS-MX, 2026-10-16)

Le champ déclencheur (`MxPickerField`) suit l'échelle du **tronc**, pas celle mesurée dans
le handoff pour ce composant : **12,5px / 500-600** de graisse, **~34px** de hauteur
(`--mx-fs-field-label`, `--mx-fs-meta`, `--mx-control-h`), comme tout champ `MxFields`
(`MxTextField`, `MxNumberField`…). Tout le **reste** — anatomie du popover, cadran,
calendrier, pied, couleurs, tailles internes — suit le handoff sans réserve. Même principe
que l'écart typographique général documenté dans `src/components/mx/tokens.ts`
(`MX_TEXT`), étendu ici explicitement par Greg à ce composant précis plutôt que déduit par
défaut.

## 4. Fuseau horaire — jamais d'heure UTC implicite

`MxDateTimePicker` combine une date et une heure saisies séparément. La combinaison passe
par `src/components/mx/internal/mxFestivalTimezone.ts` (`mxZonedWallTimeToUtc` /
`mxZonedWallTimeFromUtc`), qui convertit explicitement entre une heure **murale** du
festival et l'instant UTC qu'elle représente, **quel que soit le fuseau du poste qui
exécute le code** — contrairement à l'ancien `DateTimePickerAura`
(`newDate.setHours(...)`), qui suppose implicitement que le fuseau local du navigateur est
celui du festival.

Fuseau par défaut : **`Europe/Zurich`** (`MX_DEFAULT_FESTIVAL_TIMEZONE`). Vérifié en base au
LOT PICKERS-MX (S0/S4) : la table `events` **ne porte aujourd'hui aucune colonne de fuseau
horaire** — la constante est donc la seule source tant qu'un tel champ n'existe pas.
`MxDateTimePicker` expose une prop `timeZone` pour le jour où un fuseau par événement serait
ajouté ; aucun appelant actuel n'a besoin de la renseigner.

## 5. Interdictions

- **Aucun autre sélecteur de date/heure** ne doit être introduit dans `src/` : ni une
  bibliothèque externe (aucune aujourd'hui — seul `dayjs` est présent, utilisé pour du
  calcul de date, pas pour un composant de sélection), ni un composant maison concurrent.
- **Aucun champ natif** `<input type="date">`, `type="time"`, `type="datetime-local"`,
  `type="month"` ou `type="week"` dans `src/` — règle déjà en vigueur
  (`docs/PROJECT_INSTRUCTIONS.md`, rappelée dans `MxFields.tsx`), désormais applicable
  SANS exception à la date d'adoption complète (verrou prévu après le GO de Greg sur le
  rapport STOP 1 : test ou règle ESLint qui échoue sur tout import d'un ancien sélecteur ou
  tout champ natif).
- Les anciens composants (`DatePickerPopup`, `TimePickerPopup`, `DateTimePickerPopup`,
  `DateRangePickerPopup`, `DatePickerAura`, `TimePickerCircular24`, `DateTimePickerAura`) et
  `src/styles/pickers.css` restent en service **uniquement** pour les modules non encore
  migrés (voir inventaire S1 du rapport STOP 1) — ne pas les réutiliser dans du code neuf,
  même hors Booking.

## 6. Plage horaire de la timeline — toujours étendue aux performances réelles

**CORRECTIF C1.4 (retours de recette Greg, 2026-10-16).** `TimelineGrid.tsx`,
`GlobalTimelineGrid.tsx` et `ReadOnlyTimelineGrid.tsx` calculaient chacun, en triple, la
même amplitude horaire affichée (`globalStartHour`/`globalEndHour`/`totalHours`) à partir
des SEULES heures d'ouverture/fermeture **configurées** du jour (`event_days.open_time` /
`close_time`) — jamais des heures RÉELLES des performances. Une performance placée avant
l'ouverture configurée (ou après la fermeture, ou après minuit au-delà de l'heure de
fermeture prévue) tombait hors de la grille rendue : invisible, sans erreur. Cas vérifié en
base (lecture seule) : « TEST Artiste TEST », scène La Grange, 19.08.2027, 16:00, jour
configuré 17:00–03:00 — absente de la timeline, visible dans la page Offres.

**Correction (affichage seul, aucune donnée modifiée) :** logique extraite une seule fois,
pure et testée — `src/features/timeline/timelineHourRange.ts`
(`computeTimelineHourRange`), consommée par les trois grilles. La plage s'étend désormais
aussi sur les heures RÉELLES des performances du jour : toute heure ≥ 12h (midi) peut
étendre le début (performance plus tôt que prévu) ou la fin (performance plus tardive que
prévu) ; toute heure < 12h est traitée comme la continuation de la même nuit après minuit et
ne peut étendre que la fin — aucune colonne en base ne distinguant « avant minuit » de
« après minuit » sur une heure murale seule, ce seuil (aucune performance de scène n'est
programmée entre 00h et 12h sur une nuit de festival) lève l'ambiguïté sans supposition sur
les données. Voir le commentaire de tête de `timelineHourRange.ts` pour le détail et
`timelineHourRange.test.ts` pour le cas reproduit.

**Performances actuellement hors plage sur l'édition VENOGE FESTIVAL 2027 (lecture seule,
avant correctif)** — seule « TEST Artiste TEST » était réellement invisible (hors grille,
`hoursSinceStart` très supérieur à `totalHours`) ; les performances après minuit listées
ci-dessous étaient déjà correctement affichées (le wrap de `close_time` les couvrait déjà) :

| Jour | Artiste | Heure | Scène | Statut avant correctif |
| --- | --- | --- | --- | --- |
| 19.08.2027 | TEST Artiste TEST | 16:00 | La Grange | **invisible** (hors plage, < ouverture 17:00) |
| 18.08.2027 | NISKA | 00:00 | MAINSTAGE | déjà visible (wrap minuit couvert) |
| 20.08.2027 | Black Eyed Peas | 00:00 | MAINSTAGE | déjà visible (wrap minuit couvert) |
| 20.08.2027 | MOSIMANN | 01:30 | RIVERSTAGE | déjà visible (wrap minuit couvert) |
| 21.08.2027 | Orelsan | 00:00 | MAINSTAGE | déjà visible (wrap minuit couvert) |
| 21.08.2027 | LinLin | 01:30 | RIVERSTAGE | déjà visible (wrap minuit couvert) |

Après correctif : « TEST Artiste TEST » (16:00) entre dans la plage affichée
(`globalStartHour` passe de 17 à 16 pour ce jour), sans effet sur les cinq autres lignes.

## 7. Enregistrement de l'heure choisie — pas d'arrondi résiduel

**CORRECTIF C1.5 (retours de recette Greg, 2026-10-16).** Revérification du contrat de
valeurs `MxTimePicker` (`"HH:MM" | null`) de bout en bout sur les deux points d'entrée
Booking :

- **« Ajouter une performance »** (`PerformanceModal.tsx`, `handleTimeChange`) : la valeur
  de `MxTimePicker` est écrite telle quelle dans `formData.performance_time`, envoyée sans
  transformation à l'enregistrement. Aucun arrondi, conforme avant comme après C1.3.
- **« Modifier l'horaire »** (`CustomTimePicker.tsx`, timeline) : **bug trouvé et corrigé**.
  `handleSubmit` appliquait un `snapTo5()` sur la valeur AVANT `onConfirm` — reliquat de
  l'ancien sélecteur par pas de 5 minutes. Avec `MxTimePicker` (minute exacte, C1.3), ce
  résidu écrasait silencieusement le choix (18:08 enregistré 18:10). Supprimé : la valeur du
  champ est désormais enregistrée exactement comme choisie. `snapTo5` reste utilisé ailleurs
  dans `TimelineGrid.tsx`/`TimelineGrid_SIMPLE.tsx`/`ContractorTimelineGrid.tsx` pour
  l'accrochage au pixel du glisser-déposer sur la grille — un besoin différent, non touché.

**RE-VÉRIFICATION C2.5 (retours de recette Greg, 2026-10-16 14:23).** Greg a constaté
18:10 enregistré pour 18:08 visé depuis « Ajouter une performance », malgré le correctif
C1.5 ci-dessus. Cause : le modèle `<input>` + commit au `blur` de C1.3 (pas `snapTo5`, déjà
retiré) pouvait, selon l'ordre exact des évènements navigateur entre le `blur` du champ
minutes et le `click` du bouton OK, lire une valeur de state pas encore commise. Éliminé
par la réécriture du §2 (CORRECTIF C2) : plus de `blur` dans le chemin critique, commit
synchrone à chaque frappe. Re-tracé `PerformanceModal.tsx` → `createPerformance` →
`toIsoTime()` (`timelineApi.ts`) : aucun arrondi sur ce chemin, seul un formatage
`"HH:MM"` → `"HH:MM:00"` avant l'insertion Supabase.
- Chaîne vérifiée jusqu'en base : `onConfirm` → `handleTimePickerConfirm`
  (`LineupTimelinePage.tsx`) → `updatePerformance` → `toIsoTime` (ajoute seulement `:00`,
  aucun arrondi) → `performance_time` en base. 18:08 traverse la chaîne sans être modifié.

## 8. Démonstration — `MxPreview`

`src/components/mx/__demo__/MxPreview.tsx`, groupe « LOT PICKERS-MX » : les 4 composants
dans leurs états vide / rempli / erreur / désactivé, en colonnes dark et light (même
mécanisme `data-theme` que le reste de la vitrine). Démo jetable, non routée — voir l'en-tête
du fichier.
