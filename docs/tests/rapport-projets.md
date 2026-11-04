# Rapport des tests des projets PILOTE

Base : GO-MAT · comptes : test.responsable@example.com, test.magasinier@example.com, test.collaborateur@example.com · date : 2026-11-04 14:38
Commit testé : à renseigner (`git log --oneline -1`).

**Synthèse : 30 OK · 0 PARTIEL · 0 KO · 0 NON TESTÉ · 0 INFO**

Nettoyage : {"cp_projects":"8 supprimé(s)","cp_statuses":"0 supprimé(s)","sites":"2 supprimé(s)","restants":0}

## À corriger (KO et PARTIEL)

Aucun.

## Observations (INFO / NON TESTÉ)



## P0 Prérequis

| Point | Verdict | Détail |
|---|---|---|
| P0-module — Le module « Plan annuel et projets » (cp.projects) est activé pour l'entreprise des comptes de test | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 89.9 Go] |
| P0-droits — Droits : le responsable écrit ; magasinier et collaborateur lisent seulement | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 89.9 Go] |
| P0-etats — Les 4 états de base existent, une fois par famille | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 89.9 Go] |

## P1 Données

| Point | Verdict | Détail |
|---|---|---|
| P1-prepa — Chantiers de test, projets de plusieurs types, responsables | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 89.9 Go] |
| P1-defaut — Sans état précisé, un projet est « Pas commencé » | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 89.9 Go] |

## P2 Contrôles de la base

| Point | Verdict | Détail |
|---|---|---|
| P2-type-site — type-site : projet R&D relié à un chantier refusé | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 89.9 Go] |
| P2-doublon-chantier — doublon-chantier : deux projets sur le même chantier refusé | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |
| P2-dates — dates : fin avant début refusée | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |
| P2-type-inconnu — type-inconnu : type inconnu refusé | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |
| P2-responsable-doublon — responsable-doublon : même responsable deux fois refusé | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |
| P2-equipe — Équipe : rôle inconnu refusé ; une tâche ne s'assigne qu'à l'équipe ; quitter l'équipe désassigne | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |
| P2-etat-base — Un état de base ne se supprime pas et ne change pas de famille | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |
| P2-etat-ajoute — État ajouté : créé dans une famille, utilisé par un projet (suppression refusée), puis supprimé une fois libre | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |
| P2-programme-absent — Le programme n'existe plus : ni table, ni colonne (migration 55) | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |

## P3 Droits par rôle

| Point | Verdict | Détail |
|---|---|---|
| P3-staff-lecture — staff : lit projets, états et responsables | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |
| P3-staff-ecriture — staff : ne crée, ne modifie, ne supprime rien | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |
| P3-collab-lecture — collab : lit projets, états et responsables | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |
| P3-collab-ecriture — collab : ne crée, ne modifie, ne supprime rien | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |

## P4 Écran

| Point | Verdict | Détail |
|---|---|---|
| P4-ouverture — Responsable : PILOTE › Projets s'ouvre, les projets de test s'affichent, compteurs par état | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |
| P4-liste — Bascule cartes / liste | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |
| P4-creation — Création d'un projet par le formulaire (type, responsable) ; plus de champ « Programme » | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |
| P4-programme-masque — Le « programme » n'existe plus (formulaire, onglets) ; modifier un projet par l'écran enregistre sa description | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 90.0 Go] |
| U8-dupliquer — Écran : « Dupliquer » sur la carte d'un projet ouvre la fenêtre, crée la copie (éléments, équipe) et l'ouvre | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 89.5 Go] |
| P4-equipe-ecran — Fiche du projet : ajouter un membre par l'écran ne défait pas les assignations existantes ; retirer la personne la désassigne | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 89.6 Go] |
| P4-mes-taches — Onglet « Mes tâches » : la tâche assignée au responsable s'affiche et ouvre sa fiche | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 89.6 Go] |
| P4-chantier-pris — Le chantier déjà relié n'est plus proposé pour un autre projet | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 89.6 Go] |
| U6-onglets — Page unique : vues Gantt / Projets / Mes tâches, plus d'entrée « Gantt » dans la navigation, /pilote/gantt ouvre la vue Gantt | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 89.7 Go] |
| P4-programmes-etats — Réglages : états d'avancement derrière l'icône, lignes visibles, états de base non supprimables, retour aux projets | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 89.9 Go] |
| P4-staff-ecran — staff : l'écran s'ouvre en lecture seule | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 89.8 Go] |
| P4-collab-ecran — collab : l'écran s'ouvre en lecture seule | OK |  [mémoire : resp 54 Mo · staff 54 Mo · collab 48 Mo · libre 89.6 Go] |

## Erreurs JavaScript

Aucune.
