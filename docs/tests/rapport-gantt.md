# Rapport des tests du Gantt PILOTE

Base : GO-MAT · comptes : test.responsable@example.com, test.magasinier@example.com, test.collaborateur@example.com · date : 2026-11-03 11:59
Commit testé : 78094b8 (e2e-gantt : fenêtre de départ Gantt corrigée)

**Synthèse : 35 OK · 0 PARTIEL · 0 KO · 0 NON TESTÉ · 0 INFO**

Nettoyage : {"cp_projects":"3 supprimé(s)","cp_programs":"1 supprimé(s)","elements_restants":0}

## À corriger (KO et PARTIEL)

Aucun.

## Observations (INFO / NON TESTÉ)



## P0 Prérequis

| Point | Verdict | Détail |
|---|---|---|
| P0-module — Le module « Plan annuel et projets » (cp.projects) est activé | OK |  |
| P0-droits — Le responsable écrit ; magasinier et collaborateur lisent seulement | OK |  |

## P1 Données

| Point | Verdict | Détail |
|---|---|---|
| P1-prepa — Programme, projet, phase, tâches, sous-tâche, jalon, élément sans date | OK |  |
| P1-regles — La base refuse une phase sous une tâche et une sous-tâche sous le projet | OK |  |

## P2 Écran

| Point | Verdict | Détail |
|---|---|---|
| P2-ouverture — PILOTE › Gantt s'ouvre : groupe « Programme » et projet visibles, éléments repliés | OK |  |
| P2-deplier — « Tout déplier » montre la phase, la tâche, la sous-tâche et le jalon | OK |  |
| P2-barres — Une barre par élément daté, un losange pour le jalon | OK |  |
| P2-sans-date — L'élément sans date est dans le bac « Sans date » | OK |  |
| P2-zoom-regroupement — Périodes affichées et regroupements sans erreur | OK |  |

## P3 Fiche

| Point | Verdict | Détail |
|---|---|---|
| P3-ouvrir — Clic sur la tâche : fiche avec type verrouillé et parent | OK |  |
| P3-modifier — Modifier le nom, cocher une étape ajoutée, enregistrer : tout est en base | OK |  |
| P3-creer — Nouvel élément par la fiche : une sous-tâche sous la tâche, avec un responsable | OK |  |
| P3-plus — Le « + » d'une phase propose tâche et jalon, parent figé | OK |  |
| P3-placer — « Placer aujourd'hui » date l'élément sans date | OK |  |
| P3-supprimer — Supprimer la phase : le message annonce les éléments en dessous, tout part en cascade | OK |  |

## P3b Gestes

| Point | Verdict | Détail |
|---|---|---|
| P3b-prepa — Projet « Gestes » : phase, tâche et sous-tâche datées à partir d'aujourd'hui (donc visibles à l'ouverture) | OK |  |
| P3b-clavier-deplacer — Flèche droite sur la tâche : elle ET sa sous-tâche se décalent d'un jour (la phase ne bouge pas) | OK |  |
| P3b-clavier-bord — Maj + flèche droite sur la sous-tâche : sa fin avance d'un jour, son début ne bouge pas | OK |  |
| P3b-souris-deplacer — Glisser la phase de +2 jours à la souris : la phase, la tâche et la sous-tâche se décalent de 2 jours | OK |  |
| P3b-souris-bord — Tirer le bord droit de la tâche de +2 jours : seule sa fin change | OK |  |
| P3b-clic-fiche — Un clic sans mouvement ouvre toujours la fiche | OK |  |
| P3b-nouveau — « + Nouveau » dans la liste : une tâche créée sous la phase, avec des dates, et la saisie reste ouverte | OK |  |

## P3c Dépendances

| Point | Verdict | Détail |
|---|---|---|
| P3c-prepa — Projet « Liens » : deux tâches qui se chevauchent, une troisième plus tard | OK |  |
| P3c-creer — Dépendance A → B : B (qui chevauchait) passe au lundi 8 mars, même durée (6 jours : 8 → 13) | OK |  |
| P3c-cascade — Décaler A de +7 jours par la base : B suit (au lundi 15) ; C, plus tard, ne bouge pas | OK |  |
| P3c-refus — La base refuse la boucle (B → A), la même dépendance deux fois et un élément avec lui-même | OK |  |
| P3c-fleche — Écran : une flèche relie A et B sur le Gantt | OK |  |
| P3c-fiche — Fiche de B : « Commence après » liste A ; ajout de A → C par la fiche de C, puis retrait | OK |  |
| P3c-mode-garder — Réglage « Garder l'intervalle » : A +3 jours → B suit de 3 jours (sans week-end évité) | OK |  |
| P3c-mode-aucun — Réglage « Ne pas décaler » : A +10 jours → B ne bouge pas | OK |  |
| P3c-reglages-ecran — Fiche du projet : les réglages « Dépendances entre éléments » s'affichent et s'enregistrent | OK |  |

## P4 Lecteurs

| Point | Verdict | Détail |
|---|---|---|
| P4-staff — staff : voit le Gantt, aucune création, fiche en lecture seule | OK |  |
| P4-staff-ecriture — staff : la base refuse toute écriture sur les éléments | OK |  |
| P4-collab — collab : voit le Gantt, aucune création, fiche en lecture seule | OK |  |
| P4-collab-ecriture — collab : la base refuse toute écriture sur les éléments | OK |  |

## Erreurs JavaScript

Aucune.
