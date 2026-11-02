# Module 1 : planning de chantier

Décisions de Greg (audit, § 10) : les deux vues (par zone et par prestataire) ; pas de planification de 15 minutes ; le module démarre après la fondation multi-entreprise et l'étape 1 des droits (faits).

## Découpage (une étape à la fois, validation à chaque étape)

| Étape | Contenu | État |
|---|---|---|
| 1.1 | **Base de données** : prestataires, équipes, zones, phases, interventions, configuration du chantier, jours bloqués ; droits `chantiers.planning:*` ; contrôles faits par la base ; batterie SQL locale | Écrite et testée en local (50 contrôles). **Pas encore appliquée sur GO-MAT** |
| 1.2 | Écran « Planning » du chantier : configuration (heures, 24 h/24, pas, jours bloqués), zones, équipes, prestataires, phases ; liste des interventions en cartes et en tableau ; création et modification | À faire |
| 1.3 | Frise horaire glisser-déposer, vue par zone et vue par prestataire, vue jour et semaine | À faire |
| 1.4 | Récurrence (`series_id`), copie d'un jour, contrôles de matériel non disponible et de formation non valide | À faire |
| 1.5 | Aide intégrée, traductions FR/DE/IT/EN, sauvegarde des nouvelles tables (liste de BackupPanel et fonction de bord), parcours e2e | À faire |

## Étape 1.1 : ce que la base garantit

- Un chantier reçoit : `site_config` (heures de la journée, 24 h/24, pas de 5/15/30/60 min), `site_blocked_days`, `site_zones`, `site_phases`, `site_teams` (rattachées ou non à un prestataire `contractors`), `site_interventions` (une équipe, une zone, début, fin).
- La période du chantier reste celle de la fiche (`sites.start_on` / `end_on`) : elle n'est pas dupliquée.
- Contrôles, tous dans la base (un écran ne peut pas les contourner) : chantier ouvert ; fin après début ; heures sur le pas ; dans les heures de la journée (sauf 24 h/24) ; dans la période du chantier ; pas un jour bloqué ; zone, équipe et phase du même chantier ; **une équipe n'est jamais à deux endroits à la fois** (verrou contre deux enregistrements simultanés).
- Sans `site_config`, valeurs par défaut : 07:00 à 19:00, pas de 15 min.
- Heures calculées en `Europe/Zurich`.
- Une zone ou une équipe qui a des interventions ne se supprime pas ; supprimer un chantier supprime tout son planning.
- Journal d'audit sur tout, sauf les jours bloqués.

## Droits (clés Mannyx)

`chantiers.planning:read | create | update | delete`.

| Rôle | Droits |
|---|---|
| Administrateur, Responsable | lecture, création, modification, suppression |
| Magasinier, Collaborateur | lecture |
| Rôle personnalisé | ce que l'entreprise lui accorde (clés à la carte) |

Un nouveau module ajoute ses lignes dans `rbac_default_permissions` : toute nouvelle entreprise les reçoit, et la migration les distribue aux entreprises existantes.

## Isolation entreprise (prouvée par `supabase/tests/planning.sql`)

- Chaque table : règle restrictive d'isolation par entreprise + garde d'écriture.
- Les clés étrangères ignorent la sécurité par ligne : un déclencheur refuse qu'un élément se rattache à un chantier, un prestataire, une zone ou une équipe d'une autre entreprise.
- Testé : B ne voit rien de A, ne crée rien chez A, ne rattache rien à A, ne modifie ni ne supprime rien ; le collaborateur de A lit mais n'écrit pas.

## Points à retenir pour la suite

- Les nouvelles tables sont à ajouter à la sauvegarde par entreprise (étape 1.5).
- Les noms de tables suivent GO-Mat (anglais) ; à la fusion avec Mannyx, `organization_id` devient `company_id` et `sites` correspond à `events` (voir `compatibilite-mannyx.md`).
