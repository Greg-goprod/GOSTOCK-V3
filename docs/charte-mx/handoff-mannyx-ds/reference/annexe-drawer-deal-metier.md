> **SECTION 3 (TYPOGRAPHIE) PÉRIMÉE — ne pas appliquer.**
> Elle demande Space Grotesk / Manrope / IBM Plex Mono. Le `README.md` du lot impose
> **Geist seule**, avec `--font-mono` réduit à un alias sémantique qui rend en Geist +
> `tabular-nums`. Geist est déployée dans le dépôt depuis `e5b7b42` (2026-09-19,
> « feat(ds): swap police global vers Geist (Phase 2) »), auto-hébergée via
> `public/fonts/`.
> Les mentions de Space Grotesk en §1 (points 2 et 5) sont périmées pour la même raison.
> Le reste du document — structure §1, tokens §2, grille et rayons §4, états §5 — reste
> valide. Section 3 conservée telle quelle, non corrigée, à titre d'historique.
>
> **Fichier de référence absent du lot** : `deal-editorial-mono.html`, cité ci-dessous
> comme le rendu accompagnant ce document, n'a pas été livré. Ne pas le chercher.

# Handoff — Drawer de finalisation deal (variante "Éditorial mono")

Ce document accompagne `deal-editorial-mono.html` (rendu HTML/CSS autonome, ouvrable dans n'importe quel navigateur, avec bascule dark/light en haut à gauche — ce contrôle est un outil de démo, pas un élément à intégrer).

**Portée** : ceci est un **re-skin visuel** du drawer de finalisation de deal existant (celui qui affiche actuellement "ORELSAN", le cachet, les paramètres fiscaux, etc.). Aucune logique métier n'est modifiée — calcul du cachet, `rate-card` / `edition_tax_config`, validations, refacturations, état des toggles, tout ça reste piloté par le code existant. Le travail consiste à localiser le composant actuel et à lui appliquer la nouvelle direction visuelle (structure DOM, tokens de couleur, typographie, espacements) sans toucher aux données ni aux handlers.

## 1. Structure du composant

1. Scrim (fond assombri) + panneau ancré à droite, largeur fixe **420px**, pleine hauteur, ombre portée à gauche (`box-shadow: -28px 0 64px rgba(0,0,0,.45)`).
2. **Header** : nom de l'artiste (grand, gras, `Space Grotesk`), bouton fermer (icône X), date au format `JJ / MM / AAAA` en police mono.
3. **Bandeau de statut** plein-largeur sous le header, fond ambre plein : `BROUILLON · À TRAITER` (majuscules, tracking large).
4. **Section "Paramètres fiscaux"** — bordure gauche épaisse (3px, couleur du bandeau) :
   - badge `À CONFIRMER`
   - champ "Taux de change (CHF pour 1 unité devise du deal)" (texte libre)
   - grille 2 colonnes : "Personnes" / "Jours"
   - grille 2 colonnes : select "Statut fiscal" / select "Catégorie"
5. **Section "Cachet & calcul"** :
   - libellé "Cachet (offre)" puis montant en **gros caractères** (29px, `Space Grotesk` 700, `font-variant-numeric: tabular-nums`) — c'est le point focal de la section
   - ligne méta en mono : `MODE BRUT / DEVISE EUR`
   - message d'erreur (rouge) si le rate-card de l'édition n'est pas configuré
6. **Section "Grand livre"** : bloc neutre "Aucun acompte versé." (état vide)
7. **Bloc pointillé** (empty state) : "Refacturations : en attente de la source production" + sous-texte explicatif
8. **Section "Finalisation"** : 2 interrupteurs (off par défaut : "J'ai vérifié les paramètres fiscaux", "Pas de refacturations en attente") + texte d'aide expliquant les conditions de finalisation
9. **Footer sticky** : bouton primaire plein "Finaliser" + bouton secondaire outline "Générer le PDF" (icône document)

Tout le contenu textuel ci-dessus est repris tel quel dans le HTML de référence — copier les chaînes depuis ce fichier plutôt que les retaper évite les fautes de recopie.

## 2. Design tokens

### Thème sombre (par défaut)

| Token | Valeur | Usage |
|---|---|---|
| `--scrim` | `#191B21` | fond derrière le drawer |
| `--surface` | `#14161D` | fond du panneau |
| `--surface2` | `#1B1E27` | surfaces secondaires |
| `--text` | `#F5F6F8` | texte principal |
| `--text2` | `#B4B7C0` | texte secondaire / labels de champs |
| `--text3` | `#7D818C` | texte tertiaire / labels de section |
| `--border` | `#282C37` | séparateurs (1.5px) |
| `--band` | `#F0B429` | bandeau de statut, badge, bordure section fiscale |
| `--bandText` | `#14110A` | texte sur le bandeau/badge |
| `--inputBg` / `--inputBorder` | `#191C24` / `#2E323F` | champs de saisie |
| `--toggleOff` | `#2E323F` | fond des interrupteurs (état off) |
| `--accent` | `#8672F5` | CTA "Finaliser" |
| `--danger` | `#FF6B6B` | message rate-card non configuré |
| `--mutedBox` / `--dashed` | `#191C24` / `#2E323F` | bloc grand livre / bloc pointillé |

### Thème clair

| Token | Valeur |
|---|---|
| `--scrim` | `#DADBE0` |
| `--surface` | `#FFFFFF` |
| `--surface2` | `#F6F6F8` |
| `--text` | `#101114` |
| `--text2` | `#4A4D57` |
| `--text3` | `#82858F` |
| `--border` | `#E2E3E9` |
| `--band` / `--bandText` | `#F5C518` / `#14110A` |
| `--inputBg` / `--inputBorder` | `#FFFFFF` / `#CBCDD6` |
| `--toggleOff` | `#E3E4EA` |
| `--accent` | `#5A46D6` |
| `--danger` | `#D6273D` |
| `--mutedBox` / `--dashed` | `#F6F6F8` / `#CBCDD6` |

L'accent violet (`--accent`) est volontairement identique à celui déjà utilisé sur le bouton "Finaliser" du drawer actuel — c'est la seule couleur de marque à préserver telle quelle ; tout le reste (fonds, bordures, ambre) est nouveau.

## 3. Typographie

- **Space Grotesk** (600/700) — nom de l'artiste (26px) et montant du cachet (29px, tabular-nums). Réservée aux deux points d'emphase du composant.
- **Manrope** (400–800) — tout le reste du texte (labels, corps, boutons, selects).
- **IBM Plex Mono** (500–700) — données chiffrées : date, champs "Taux de change" / "Personnes" / "Jours", ligne "MODE BRUT / DEVISE EUR". Donne un rendu "précision fintech" cohérent avec des valeurs numériques.

Police à charger : `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600;700&display=swap`

## 4. Grille, bordures, rayons

- Bordures/séparateurs à **1.5px** (plus marquées que le style précédent, choix délibéré pour le contraste).
- Rayons : 6px (inputs/selects), 8px (boutons, blocs), 10px (bloc pointillé).
- Grilles de champs : `grid-template-columns: repeat(2, minmax(0,1fr))`, gap 12px.
- Padding panneau : 24px latéral en header/footer, 20–24px dans le contenu scrollable.

## 5. États et interactions à préserver

- Les 2 toggles ("vérifié fiscal" / "pas de refacturations") sont pilotés par l'état réel du deal — ne pas les figer en dur.
- Le message d'erreur rate-card ne s'affiche que si `edition_tax_config` n'est pas configuré pour l'édition — condition existante à conserver.
- Le bandeau `BROUILLON / À TRAITER` doit rester dynamique selon le statut réel du deal (les autres statuts possibles, s'il y en a, devront reprendre le même traitement bandeau plein-largeur).
- Bouton "Finaliser" : garder la logique de validation existante (désactivé/actif selon les conditions listées dans le texte d'aide).

## 6. Suggestion d'implémentation (React/TS, go-prod-aura)

- Composant probablement dans le module finance / deal du monorepo (`go-prod-aura/`) — localiser le composant actuel avant de modifier quoi que ce soit, plutôt que de recréer depuis zéro.
- Si le projet utilise déjà des tokens CSS (variables ou config Tailwind), mapper la table de la section 2 sur les tokens existants plutôt que d'introduire un second système de couleurs.
- Le dark/light : si l'app a déjà un mécanisme de thème global, brancher ce composant dessus ; sinon, les deux jeux de valeurs ci-dessus suffisent à dériver un mode clair sans redesign supplémentaire.
- Recommandé : prompt d'audit d'abord (repérer le composant, ses props, son state, ses dépendances de style) avant le prompt d'implémentation — conformément au workflow audit-first habituel.
