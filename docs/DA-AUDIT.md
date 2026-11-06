# Contrôle de conformité — charte Mannyx (MX)

Source de vérité : `design_handoff_mannyx_ds` (zip fourni), identique au dossier
`go-prod-aura/docs/design/handoff-mannyx-ds/` de Mannyx pour le catalogue, le drawer et les icônes ;
`README.md` du handoff pour les tokens ; `DOCTRINE-*.md` de Mannyx pour l'usage.
Contrôle du 30.10.2026 : lecture du handoff, rendu du catalogue `Mannyx Components V2.html`,
analyse automatique du code et captures des 36 pages en clair et en sombre (ordinateur et téléphone).

## Résultat par point

| Point de la charte | Règle (handoff) | État GO-Mat |
|---|---|---|
| Tokens couleurs clair/sombre | `--scrim`, `--surface`, `--accent`… | Conforme : `tokens-mx.css` repris tel quel ; Tailwind gray/primary branchés dessus |
| Couleurs en dur | Interdites dans les composants | Conforme pour l'interface ; restent les documents imprimés (bons, rapports PDF), les couleurs choisies par l'utilisateur (catégories) et l'écran d'erreur de configuration |
| Police | Geist seule, pas de chasse fixe | Conforme : Geist auto-hébergée ; `font-mono` = Geist + chiffres tabulaires |
| Rayons | 3 / 4 / 6 / 8 / 10 px | Conforme via la config Tailwind (lg = 6px) |
| Bordures | 1.5px champs et drawer | Conforme (champs, drawer, navigation) |
| Élévations | 5 niveaux | Conforme (ombres Tailwind = niveaux MX) |
| Boutons | primaire avec ombre d'offset, survol −2px, appui 0.96, désactivé 40 % | Conforme (`Button` → `.mx-btn-*`) ; libellés en capitales corrigés |
| Badges | rayon 4px, 11px, graisse 700, fond teinté | Conforme sur les pages (28 pastilles converties) |
| Champs | libellé 12.5px/600, focus accent + halo 3px | Conforme (règles globales) |
| Select | chevron Lucide sur select natif | Conforme |
| Sélecteurs date/heure | composants MX, 280×320, lundi→dimanche | Conforme : 26 champs convertis, plus aucun champ natif |
| Drawer | une seule primitive pour tous les panneaux | Conforme : toutes les fenêtres, filtres, confirmations et saisies |
| Pied de drawer | collant, hors corps défilant | Conforme pour les formulaires (pied collant automatique) |
| Tableaux | en-tête surface2 11px majuscules, filets, survol accent | Conforme (règle globale) |
| Cartes | surface, filet 1px, rayon 6, élévation 2 | Conforme (`Card`, `.mx-card`) |
| Titre de page | 52px, 700, −0.05em, pas de capitales | Conforme sur toutes les pages |
| Navigation | item 3 états, fil d'Ariane | Conforme (rail par métier, liste, fil d'Ariane) |
| Command palette | ⌘K, ↑↓, ↵, Échap | Conforme |
| Notifications (toasts) | surface, filet, ombre | Conforme |
| Émojis | interdits | Conforme dans l'interface |
| Focus clavier | contour 2px accent | Conforme |

## Écarts restants (à reprendre page par page)

- Cartes de liste anciennes (Sorties, Personnes, Outils) : couleurs MX, mais pas encore la mise en page
  exacte des cartes du catalogue (carte module / carte entité).
- Titres de section en capitales dans certains formulaires (« INFORMATIONS DE BASE ») : tolérés comme
  sous-titres, à passer au style « sous-titre de section » 11px.
- États vides : texte simple ; le modèle MX (icône sur fond teinté + titre + action) reste à appliquer.
