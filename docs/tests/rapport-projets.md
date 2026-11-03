# Rapport des tests des projets PILOTE

Base : GO-MAT · comptes : test.responsable@example.com, test.magasinier@example.com, test.collaborateur@example.com · date : 2026-11-03 14:44
Commit testé : a09d0ea (Tests PILOTE : correction P4-chantier-pris, e2e-pilote-scenarios complet)

**Synthèse : 29 OK · 0 PARTIEL · 0 KO · 0 NON TESTÉ · 0 INFO**

Nettoyage : {"cp_projects":"9 supprimé(s)","cp_programs":"2 supprimé(s)","cp_statuses":"0 supprimé(s)","sites":"2 supprimé(s)","restants":0}

## À corriger (KO et PARTIEL)

Aucun.

## Observations (INFO / NON TESTÉ)



## P0 Prérequis

| Point | Verdict | Détail |
|---|---|---|
| P0-module — Le module « Plan annuel et projets » (cp.projects) est activé pour l'entreprise des comptes de test | OK |  |
| P0-droits — Droits : le responsable écrit ; magasinier et collaborateur lisent seulement | OK |  |
| P0-etats — Les 4 états de base existent, une fois par famille | OK |  |

## P1 Données

| Point | Verdict | Détail |
|---|---|---|
| P1-prepa — Programme, chantier de test, projets de plusieurs types, responsables | OK |  |
| P1-defaut — Sans état précisé, un projet est « Pas commencé » | OK |  |

## P2 Contrôles de la base

| Point | Verdict | Détail |
|---|---|---|
| P2-type-site — type-site : projet R&D relié à un chantier refusé | OK |  |
| P2-doublon-chantier — doublon-chantier : deux projets sur le même chantier refusé | OK |  |
| P2-dates — dates : fin avant début refusée | OK |  |
| P2-type-inconnu — type-inconnu : type inconnu refusé | OK |  |
| P2-programme-doublon — programme-doublon : programme de même nom refusé | OK |  |
| P2-responsable-doublon — responsable-doublon : même responsable deux fois refusé | OK |  |
| P2-equipe — Équipe : rôle inconnu refusé ; une tâche ne s'assigne qu'à l'équipe ; quitter l'équipe désassigne | OK |  |
| P2-etat-base — Un état de base ne se supprime pas et ne change pas de famille | OK |  |
| P2-etat-ajoute — État ajouté : créé dans une famille, utilisé par un projet (suppression refusée), puis supprimé une fois libre | OK |  |
| P2-programme-supprime — Supprimer un programme garde ses projets, sans programme | OK |  |

## P3 Droits par rôle

| Point | Verdict | Détail |
|---|---|---|
| P3-staff-lecture — staff : lit programmes, projets, états et responsables | OK |  |
| P3-staff-ecriture — staff : ne crée, ne modifie, ne supprime rien | OK |  |
| P3-collab-lecture — collab : lit programmes, projets, états et responsables | OK |  |
| P3-collab-ecriture — collab : ne crée, ne modifie, ne supprime rien | OK |  |

## P4 Écran

| Point | Verdict | Détail |
|---|---|---|
| P4-ouverture — Responsable : PILOTE › Projets s'ouvre, les projets de test s'affichent, compteurs par état | OK |  |
| P4-liste — Bascule cartes / liste | OK |  |
| P4-creation — Création d'un projet par le formulaire (type, programme, responsable) | OK |  |
| P4-programme-inline — Formulaire de projet : « Créer un programme » crée et sélectionne le programme, le projet y est rangé | OK |  |
| P4-equipe-ecran — Fiche du projet : ajouter un membre par l'écran ne défait pas les assignations existantes ; retirer la personne la désassigne | OK |  |
| P4-mes-taches — Onglet « Mes tâches » : la tâche assignée au responsable s'affiche et ouvre sa fiche | OK |  |
| P4-chantier-pris — Le chantier déjà relié n'est plus proposé pour un autre projet | OK |  |
| P4-programmes-etats — Onglets Programmes et États : lignes visibles, états de base non supprimables | OK |  |
| P4-staff-ecran — staff : l'écran s'ouvre en lecture seule | OK |  |
| P4-collab-ecran — collab : l'écran s'ouvre en lecture seule | OK |  |

## Erreurs JavaScript

Aucune.
