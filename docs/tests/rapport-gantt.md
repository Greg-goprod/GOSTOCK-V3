# Rapport des tests du Gantt PILOTE

Base : GO-MAT · comptes : test.responsable@example.com, test.magasinier@example.com, test.collaborateur@example.com · date : 2026-11-05 09:08
Commit testé : d955337 STATUT : migration 61 appliquée et vérifiée sur GO-MAT

**Synthèse : 46 OK · 0 PARTIEL · 0 KO · 0 NON TESTÉ · 0 INFO**

Nettoyage : {"cp_projects":"4 supprimé(s)","elements_restants":0}

## À corriger (KO et PARTIEL)

Aucun.

## Observations (INFO / NON TESTÉ)



## P0 Prérequis

| Point | Verdict | Détail |
|---|---|---|
| P0-module — Le module « Plan annuel et projets » (cp.projects) est activé | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| P0-droits — Le responsable écrit ; magasinier et collaborateur lisent seulement | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |

## P1 Données

| Point | Verdict | Détail |
|---|---|---|
| P1-prepa — Projet, phase, tâches, sous-tâche, jalon, élément sans date | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| P1-regles — La base refuse une phase sous une tâche et une sous-tâche sous le projet | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |

## P2 Écran

| Point | Verdict | Détail |
|---|---|---|
| P2-ouverture — PILOTE › Gantt s'ouvre : groupes par état, projet visible, éléments repliés | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 89.0 Go] |
| P2-deplier — « Tout déplier » montre la phase, la tâche, la sous-tâche et le jalon | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| P2-barres — Une barre par élément daté, un losange pour le jalon | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| P2-sans-date — L'élément sans date est dans le menu « Sans date (n) » | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| P2-zoom-regroupement — Échelles, période libre et regroupements sans erreur | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| P2b-couleur — Couleur des barres : par état (défaut), puis par projet | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| P2b-fantome — Barre fantôme : survoler une ligne sans date propose une plage ; un clic la donne à l'élément | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 89.1 Go] |
| P2b-fleche-hors-zone — Une ligne hors de la période affichée a une flèche ; un clic amène la fenêtre sur sa barre | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 89.1 Go] |
| P2b-liste-masquee — Masquer la liste des noms : la frise prend toute la largeur ; la réafficher | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 89.2 Go] |

## UI-4 Création rapide

| Point | Verdict | Détail |
|---|---|---|
| U4-groupe-etat — Le « + » d'un groupe d'état crée un projet qui reprend cet état ; titre en focus, détails repliés | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 89.1 Go] |
| U4-groupe-type — Le « + » d'un groupe de type crée un projet de ce type | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 89.0 Go] |
| U4-focus-fiche — « Nouveau › Nouvelle tâche » : le curseur est dans le nom de l'élément | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 89.0 Go] |
| U5-choix-etat — Choix de l'état : menu groupé par famille avec pastilles ; l'état choisi est enregistré | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 89.0 Go] |
| U5c-conflit — Deux sessions : la seconde à enregistrer une fiche modifiée entre-temps est refusée, rien n'est écrasé ; après rechargement, l'enregistrement passe | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| U7-discussion — Fiche d'un élément : section Discussion — écrire (Ctrl+Entrée) sans enregistrer la fiche, modifier, supprimer ; un lecteur lit sans pouvoir écrire | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 89.0 Go] |
| U7b-documents — Fiche d'un élément : section Documents — déposer (un exécutable est refusé), télécharger, supprimer ; un lecteur télécharge sans pouvoir déposer | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.7 Go] |

## P3 Fiche

| Point | Verdict | Détail |
|---|---|---|
| P3-ouvrir — Clic sur la tâche : fiche avec le type en sous-titre, propriétés clés visibles, parent dans les détails | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.7 Go] |
| P3-modifier — Modifier le nom, cocher une étape ajoutée, enregistrer : tout est en base | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.7 Go] |
| P3-creer — Nouvel élément par la fiche : une sous-tâche sous la tâche, avec un responsable | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.8 Go] |
| P3-plus — Le « + » d'une phase propose tâche et jalon, parent figé | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.8 Go] |
| P3-placer — « Placer aujourd'hui » date l'élément sans date | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.8 Go] |
| P3-supprimer — Supprimer la phase : le message annonce les éléments en dessous, tout part en cascade | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 89.0 Go] |

## P3b Gestes

| Point | Verdict | Détail |
|---|---|---|
| P3b-prepa — Projet « Gestes » : phase, tâche et sous-tâche datées à partir d'aujourd'hui (donc visibles à l'ouverture) | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| P3b-clavier-deplacer — Flèche droite sur la tâche : elle ET sa sous-tâche se décalent d'un jour (la phase ne bouge pas) | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| P3b-clavier-bord — Maj + flèche droite sur la sous-tâche : sa fin avance d'un jour, son début ne bouge pas | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| P3b-souris-deplacer — Glisser la phase de +2 jours à la souris : la phase, la tâche et la sous-tâche se décalent de 2 jours | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| P3b-souris-bord — Tirer le bord droit de la tâche de +2 jours : seule sa fin change | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| P3b-clic-fiche — Un clic sans mouvement ouvre toujours la fiche | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| P3b-nouveau — « + Nouveau » dans la liste : une tâche créée sous la phase, avec des dates, et la saisie reste ouverte | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |

## P3c Dépendances

| Point | Verdict | Détail |
|---|---|---|
| P3c-prepa — Projet « Liens » : deux tâches qui se chevauchent, une troisième plus tard | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| P3c-creer — Dépendance A → B : B (qui chevauchait) passe au lundi 8 mars, même durée (6 jours : 8 → 13) | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.9 Go] |
| P3c-cascade — Décaler A de +7 jours par la base : B suit (au lundi 15) ; C, plus tard, ne bouge pas | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.8 Go] |
| P3c-refus — La base refuse la boucle (B → A), la même dépendance deux fois et un élément avec lui-même | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.8 Go] |
| P3c-fleche — Écran : une flèche relie A et B sur le Gantt | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.7 Go] |
| P3c-fiche — Fiche de B : « Commence après » liste A ; ajout de A → C par la fiche de C, puis retrait | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.7 Go] |
| P3c-mode-garder — Réglage « Garder l'intervalle » : A +3 jours → B suit de 3 jours (sans week-end évité) | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.7 Go] |
| P3c-mode-aucun — Réglage « Ne pas décaler » : A +10 jours → B ne bouge pas | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.8 Go] |
| P3c-reglages-ecran — Fiche du projet : les réglages « Dépendances entre éléments » s'affichent et s'enregistrent | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.7 Go] |

## P4 Lecteurs

| Point | Verdict | Détail |
|---|---|---|
| P4-staff — staff : voit le Gantt, aucune création, fiche en lecture seule | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.6 Go] |
| P4-staff-ecriture — staff : la base refuse toute écriture sur les éléments | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.6 Go] |
| P4-collab — collab : voit le Gantt, aucune création, fiche en lecture seule | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.5 Go] |
| P4-collab-ecriture — collab : la base refuse toute écriture sur les éléments | OK |  [mémoire : resp 54 Mo · staff 51 Mo · collab 48 Mo · libre 88.5 Go] |

## Erreurs JavaScript

Aucune.
