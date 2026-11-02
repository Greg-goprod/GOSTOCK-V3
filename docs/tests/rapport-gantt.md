# Rapport des tests du Gantt PILOTE

Base : GO-MAT · comptes : test.responsable@example.com, test.magasinier@example.com, test.collaborateur@example.com · date : 2026-11-02 18:21
Commit testé : 38bdbae (Statut : e2e-projets vert) — inclut c0c2fe0 (Plages de dates : un seul sélecteur début+fin)

**Synthèse : 17 OK · 0 PARTIEL · 2 KO · 0 NON TESTÉ · 0 INFO**

Nettoyage : {"cp_projects":"1 supprimé(s)","cp_programs":"1 supprimé(s)","elements_restants":0}

## À corriger (KO et PARTIEL)

- **KO** P2-ouverture — PILOTE › Gantt s'ouvre : groupe « Programme » et projet visibles, éléments repliés : programme de test absent ([capture](captures-gantt/P2-ouverture.png))
- **KO** P3-placer — « Placer aujourd'hui » date l'élément sans date : dates en base = {"starts_on":null,"ends_on":null} ([capture](captures-gantt/P3-placer.png))

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
| P2-ouverture — PILOTE › Gantt s'ouvre : groupe « Programme » et projet visibles, éléments repliés | KO | programme de test absent |
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
| P3-placer — « Placer aujourd'hui » date l'élément sans date | KO | dates en base = {"starts_on":null,"ends_on":null} |
| P3-supprimer — Supprimer la phase : le message annonce les éléments en dessous, tout part en cascade | OK |  |

## P4 Lecteurs

| Point | Verdict | Détail |
|---|---|---|
| P4-staff — staff : voit le Gantt, aucune création, fiche en lecture seule | OK |  |
| P4-staff-ecriture — staff : la base refuse toute écriture sur les éléments | OK |  |
| P4-collab — collab : voit le Gantt, aucune création, fiche en lecture seule | OK |  |
| P4-collab-ecriture — collab : la base refuse toute écriture sur les éléments | OK |  |

## Erreurs JavaScript

Aucune.
