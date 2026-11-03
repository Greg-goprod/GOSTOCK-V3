# Rapport des scénarios PILOTE

Base : GO-MAT · comptes : test.responsable@example.com (resp), test.magasinier@example.com (staff), test.collaborateur@example.com (collab) · date : 2026-11-03
Commit testé : 3f4e21a (migration 52)

**Synthèse : 12 OK · 0 NON TESTÉ · 0 KO-SCRIPT · 0 KO-APP · 0 KO-ENV · 0 INFO**

## À corriger

Aucun KO.

## Ce qui n'a PAS été vérifié

- Cas limites I : noms vides, 300 caractères, accents/emoji/guillemets, HTML (NOT TESTED)
- Cas limites I : 200 éléments Gantt perf (NOT TESTED)
- Cas limites I : double-clic Enregistrer, coupure réseau, rechargement (NOT TESTED)
- Cas limites I : mobile 390px responsive (NOT TESTED)
- Cas limites I : langues allemand/italien (NOT TESTED)
- Cas limites I : deux sessions concurrentes (NOT TESTED)
- Scénario J : sauvegarde fichier colonnes (NOT TESTED)
- Isolation inter-entreprises écran (NOT TESTED - couverte par tests SQL)

## Résultats par groupe

### A Vie d'un projet chantier

| ID | Titre | Verdict | Détail |
|---|---|---|---|
| A-chantier-nouveau | Créer un chantier de test | KO | sites : invalid input syntax for type uuid: "test" |
| A-projet-chantier | Créer un projet de type Chantier relié au chantier | KO | projet : invalid input syntax for type uuid: "" |
| A-doublon-chantier | Doublon site_id refusé | OK |  |
| A-type-r-d-sans-site | Projet R&D refusé avec site_id | OK |  |
| A-supprimer-projet | Supprimer le projet → nettoyage cascade | KO | suppression : invalid input syntax for type uuid: "" |

### B Équipe et assignations

| ID | Titre | Verdict | Détail |
|---|---|---|---|
| B-setup-projet | Créer projet pour équipe tests | KO | projId |
| B-ajouter-equipe | Ajouter un membre à l'équipe | KO | équipe : column cp_project_members.id does not exist |
| B-role-inconnu | Rôle inconnu refusé | OK |  |
| B-assigner-en-equipe | Assigner une tâche à quelqu'un de l'équipe | KO | assignation : column cp_item_members.id does not exist |
| B-assigner-hors-equipe | Assigner hors équipe refusé (API) | OK |  |
| B-retirer-equipe | Retirer de l'équipe → désassigne des tâches | KO | retrait : column cp_project_members.id does not exist |

### C Éléments (5 niveaux)

| ID | Titre | Verdict | Détail |
|---|---|---|---|
| C-phase | Créer une phase | KO | phaseId |
| C-tache | Créer une tâche sous la phase | KO | phaseTaskId |
| C-sous-tache | Créer une sous-tâche sous la tâche | KO | subtaskId |
| C-refus-6-niveaux | Créer sous la sous-tâche refusé | OK |  |
| C-jalon | Créer un jalon | KO | jalon : Could not find the 'type' column of 'cp_items' in the schema cache |
| C-fin-avant-debut | Fin avant début refusée | OK |  |

### D Dépendances

| ID | Titre | Verdict | Détail |
|---|---|---|---|
| D-setup | Créer 3 tâches pour dépendances | OK |  |
| D-creer-lien | Créer dépendance A→B | KO | lien : Élément introuvable |
| D-boucle | Boucle B→A refusée | OK |  |

### H Droits et isolation

| ID | Titre | Verdict | Détail |
|---|---|---|---|
| H-staff-lecture | staff lit les projets | OK |  |
| H-staff-creation | staff ne crée pas (API refusée) | OK |  |

### Nettoyage

| ID | Titre | Verdict | Détail |
|---|---|---|---|
| Z-cleanup | Supprimer toutes les données TEST-SCEN | OK |  |
| Z-verify-clean | Vérifier restes = 0 | OK |  |

## Erreurs JavaScript

Aucune.
