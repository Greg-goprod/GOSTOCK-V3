# Charte graphique Mannyx (MX) — fichiers de référence pour GO-Mat

Copie, en lecture seule, de la direction artistique de Mannyx (dépôt NEW-GO-PROD,
`go-prod-aura/docs/design/handoff-mannyx-ds` et `go-prod-aura/docs/04-DESIGN-SYSTEM.md`), au 30.10.2026.
Ne pas modifier ces fichiers ici : ils suivent Mannyx.

## Ordre de lecture

1. `handoff-mannyx-ds/LISEZ-MOI-EN-PREMIER.md` — quelle source fait foi selon le contexte, et l'écart typographique
   assumé (le tronc l'emporte seulement quand le handoff est plus grand ou plus gras).
2. `handoff-mannyx-ds/README.md` — transversal : tokens, échelles (typo, espacements, rayons, élévations), tons, accessibilité.
3. `handoff-mannyx-ds/reference/Mannyx Components V2.html` — **composants de page** (à ouvrir dans le navigateur).
4. `handoff-mannyx-ds/reference/mannyx-drawer.js` — **composants de drawer**.
5. `handoff-mannyx-ds/01-catalogue-autonome.html` — catalogue complet, à ouvrir dans le navigateur.
6. Les doctrines : `DOCTRINE-TABLEAUX.md`, `DOCTRINE-DRAWER.md`, `DOCTRINE-BARRE-OUTILS.md`, `DOCTRINE-ETATS-VIDES.md`,
   `DOCTRINE-VUES-CARTES-LISTE.md`, `DOCTRINE-CONFIGURATION.md`, `DOCTRINE-PICKERS-MX.md`, `DOCTRINE-GRAPHIQUES.md`.
7. `04-DESIGN-SYSTEM-mannyx.md` — le design system tel qu'implémenté dans Mannyx.

## Dans GO-Mat

- Tokens : `src/styles/tokens-mx.css` (identique à celui de Mannyx), police Geist `src/styles/geist.css`.
- Adaptation GO-Mat : `src/styles/gomat-mx.css` (classes `mx-btn*`, `mx-card`, `mx-page-title`, `mx-section-label`,
  correspondance des couleurs Tailwind gray/primary vers les tokens).
- Composants repris de Mannyx : `src/components/mx/` (drawer, sélecteurs, tableaux…).
- Audit précédent : `docs/DA-AUDIT.md`.
