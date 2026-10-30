# Doctrine — graphiques et repartitions (Mannyx)

LOT BOOKING-DASHBOARD, B4 (2026-10-03). Ce document fixe la regle de choix
entre les outils de visualisation disponibles dans le projet, pour que les
prochaines pages migrees n'aient pas a redecider au cas par cas.

## 1. Statuts -> tons semantiques, pas une couleur par statut

Un statut metier (statut d'offre, de contrat, de facture...) ne recoit JAMAIS
sa propre couleur. Il est d'abord **range dans un des 6 tons semantiques du
tronc** (`warning | danger | success | info | accent | neutral`,
`src/components/mx/tokens.ts`), puis affiche avec le ton correspondant
(`MX_TONE_FILL` / `MX_TONE_TEXT` / `MX_TONE_LINE` / `mxToneDot`).

Quand un ecran a plus de statuts que de tons utiles a distinguer (c'est
systematiquement le cas : 6 statuts de contrat, 10 d'offre), on **regroupe**
les statuts en 3 a 5 buckets avant affichage, plutot que d'inventer une
nouvelle couleur par statut. Exemple en place (LOT BOOKING-DASHBOARD, B2) :

- Contrats (`src/pages/app/administration/contrats/contractStatusGroups.ts`,
  module PARTAGE avec la page Contrats) : les 6 etapes de `stepOrder.ts`
  regroupees en 4 — a recevoir (warning), a traiter par vous = review +
  internal_sign + internal_signed (accent), a signer artiste (info),
  finalise (success).
- Offres (`src/pages/app/booking/offerStatusGroups.ts`) : les 10 statuts de
  `OFFER_STATUS_CONFIG` regroupes en 5 — en preparation = draft,
  ready_to_send, legal_review, management_review (accent), en cours = sent,
  negotiating (info), acceptees (success), refusees (danger), cloturees
  (neutre). Mapping et tons DEFINITIFS, poses par Greg (LOT BOOKING-DASHBOARD,
  C1, 2026-10-03) — voir la regle 1bis ci-dessous pour le sens exact
  d'accent/info.

### 1bis. Accent = chez nous, info = chez l'autre partie

Entre les deux tons « actifs » du tronc (ni positif comme `success`, ni
negatif comme `danger`/`warning`), le choix ne se fait PAS sur un critere
d'intensite ou d'urgence, mais sur UNE SEULE question : **qui doit agir
maintenant ?**

- **`accent`** — l'action attendue est DE NOTRE COTE (interne, equipe
  festival). Cote contrats : `review`/`internal_sign`/`internal_signed` (« a
  traiter par vous »). Cote offres : `draft`/`ready_to_send` (pas encore
  envoyee) et `legal_review`/`management_review` (revues faites par l'equipe
  du festival, pas par l'agence).
- **`info`** — on ATTEND l'autre partie (artiste, agence, agent). Cote
  contrats : `external_sign` (« a signer artiste »). Cote offres :
  `sent`/`negotiating` (l'offre est chez l'agence, elle doit repondre ou
  negocier).

Meme sens dans les deux pages (Contrats et Booking Dashboard) : un lecteur
qui a appris le code couleur sur l'une le retrouve inchange sur l'autre.
Erreur a eviter (ecartee au C1 de ce lot) : lire `accent` comme « etape
active/en mouvement » et `info` comme « etape secondaire » — ce decoupage ne
dit rien sur QUI doit agir, qui est la seule question pertinente ici.

Un regroupement est une fonction PURE, testee, qui prend un compte par statut
(`{ [status]: count }`) et retourne un tableau de buckets `{ id, labelKey,
tone, count }`, DANS UN ORDRE FIXE. Elle ne fait ni requete ni effet de bord.

## 2. Repartition simple d'une poignee de buckets -> MxBarList / MxDonut

Pour une repartition de 3 a 6 buckets (le resultat typique d'un regroupement
de statuts), ou pour une serie de categories nommees (budget par scene,
artistes par statut...), utiliser les primitives du tronc :

- **MxBarList** (`src/components/mx/MxBarList.tsx`) — liste de barres
  horizontales proportionnelles, un ton par ligne (ou accent unique pour une
  serie non categorisee, ex. « Budget par scene »).
- **MxDonut** (`src/components/mx/MxDonut.tsx`) — anneau SVG a la main (3
  `<circle>` + `stroke-dasharray`, pas Recharts), legende HTML integree,
  total central optionnel.

Les deux sont des elements SVG/HTML a la main, sur le modele du catalogue
(`reference/Mannyx Components V2.html`, section `#s-charts`) — PAS un
wrapper Recharts habille en tokens : le catalogue ne maquette ce besoin que
sous cette forme simplifiee, jamais comme un bar/pie chart generique.

Zero couleur codee en dur dans ces deux primitives : chaque segment/ligne
recoit un `MxTone`, jamais un hex.

## 3. Serie unique, sans categorie -> accent

Une serie qui ne distingue PAS des categories de statut (ex. « Budget par
scene », ou toute autre repartition ou le ton n'a pas de sens metier) reste
en **accent unique** pour toutes ses lignes/segments — jamais une couleur par
ligne qui n'encoderait rien (pas de legende de ton necessaire dans ce cas).

## 4. Graphique complexe -> Recharts avec `var(--mx-*)` (fill / stroke)

Quand le besoin depasse une repartition simple (axes, courbes temporelles,
comparaison multi-series, zoom/brush...), Recharts reste l'outil : la
primitive la plus proche du besoin reel (MxBarList/MxDonut) ne suffit plus.

Verifie concretement (LOT BOOKING-DASHBOARD, Phase A, sonde navigateur) :
`var(--mx-...)` fonctionne nativement en attribut SVG `fill`/`stroke`
(`<Cell fill="var(--mx-tone-text-success)">` etc.) — Recharts se contente de
transmettre la chaine a l'attribut SVG, il ne l'introspecte jamais en JS.
Donc un graphique Recharts migre vers Mannyx pose ses couleurs en
`var(--mx-tone-text-<ton>)` (ou `var(--mx-accent)` pour une serie unique),
jamais en hex — meme regle « zero couleur codee en dur » que les primitives
du tronc. Consequence acceptee : la couleur d'une serie peut changer de
teinte entre theme clair et sombre (comme un badge), contrairement a un hex
fige qui reste identique dans les deux themes.

Aucune page de ce projet n'a encore ce besoin a ce jour (2026-10-03) : le
tableau de bord Booking, qui semblait le candidat naturel, a vu ses deux
graphiques Recharts remplaces par MxBarList/MxDonut (regroupements B2) — ils
ne depassaient jamais 5-6 categories, donc relevaient de la regle 2, pas de
celle-ci.

## 5. Pas de palette categorielle tant qu'aucun besoin reel n'est valide

`--mx-pink` (`src/styles/tokens-mx.css`) reste reserve, EXPLICITEMENT COMMENTE
« accent categoriel », SANS consommateur a ce jour. La Phase A de ce lot avait
propose d'en deriver une serie `--mx-chart-1..6` pour un besoin categoriel
(statuts d'offre/contrat affiches chacun dans sa propre teinte). **Decision de
Greg (LOT BOOKING-DASHBOARD, B4) : non.**

Raison : multiplier les couleurs pour distinguer des categories est TOUJOURS
une option de repli face a un probleme qui se resout mieux en amont, par un
regroupement (regle 1). Les 10 statuts d'offre et les 6 statuts de contrat de
ce lot en sont la preuve : regroupes en 4-5 buckets, ils rentrent entierement
dans les 6 tons semantiques existants, sans qu'aucune nouvelle couleur ne
soit necessaire.

Consequence pour les lots futurs : si un ecran semble demander plus de
categories visuellement distinctes que de tons semantiques, la premiere
question est « peut-on regrouper ? », jamais « quelle nouvelle couleur
ajouter ? ». Une palette categorielle ne sera construite que sur un besoin
CONCRET, VALIDE par Greg, qui demontre qu'aucun regroupement ne convient —
pas par anticipation.

## 6. Derogation — couleurs de marque externes

LOT ARTISTES-FICHE, B5 (2026-10-04, Greg). Les regles 1 a 5 ci-dessus
regissent des COULEURS DE STATUT (une donnee METIER, interne au projet, qui
varie par theme comme tout le reste du tronc). L'identite visuelle d'une
**plateforme tierce** (vert Spotify, degrade Instagram, noir TikTok/X...)
n'est **jamais un statut** : c'est une marque externe, fixe, que l'utilisateur
reconnait au premier coup d'oeil independamment de notre propre theme clair/
sombre. Lui appliquer la regle 1 (ranger dans un des 6 tons semantiques)
ferait disparaitre cette reconnaissance immediate sans aucun gain de sens.

**Derogation accordee** : une couleur de plateforme externe se declare en
`--mx-brand-<plateforme>` (`src/styles/tokens-mx.css`, section « COULEURS DE
MARQUE EXTERNES »), **IDENTIQUE dans les deux themes** (declaree une seule
fois, jamais redeclaree dans le bloc `[data-theme='light']`) — a la difference
de `--mx-tone-text-*`, qui varie par theme. Toujours une couleur de PLATEFORME
(l'identite externe elle-meme), jamais une couleur de statut ou de metrique
propre au projet : une metrique CALCULEE par nos soins (ex. le score de
popularite Spotify, 0-100) n'est pas une identite de marque et reste en
`var(--mx-accent)` (regle 3), meme si elle accompagne une metrique de marque
dans le meme graphique (ex. `ArtistStatsChart` : followers en
`--mx-brand-spotify`, popularite en `--mx-accent`).

Consommateurs a ce jour : `ArtistStatsChart.tsx`, `ArtistHistoryChart.tsx`,
`ArtistStatsOverview.tsx` (`src/components/artist/`), via le helper partage
`src/components/artist/platformBrandColors.ts`. `ArtistSocialLinks.tsx` et
`SocialLinksContainer.tsx` gardent pour l'instant leur propre table de
couleurs (hors perimetre du lot B5) — a aligner sur ce meme token le jour ou
ils sont retouches, pas par anticipation ici.
