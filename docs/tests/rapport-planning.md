# Rapport des tests du planning de chantier

Base : GO-MAT · comptes : test.responsable@example.com, test.magasinier@example.com, test.collaborateur@example.com · date : 2026-11-03 14:02
Commit testé : a09d0ea (Tests PILOTE : correction P4-chantier-pris, e2e-pilote-scenarios complet)

**Synthèse : 40 OK · 0 PARTIEL · 0 KO · 0 NON TESTÉ · 1 INFO**

Nettoyage : {"6520b687-7564-4118-aa1e-6844f1a4f5de":"supprimé","de7eca1e-af20-4e57-8889-84eaaf263707":"supprimé","contractor":"supprimé","restants":0}

## À corriger (KO et PARTIEL)

Aucun.

## Observations (INFO / NON TESTÉ)

- **P5-besoin** — Besoin en matériel : ajout, doublon et quantité nulle refusés, avertissement si le stock ne suffit pas : article de test : Scie circulaire à métaux XGT ®


## P0 Prérequis

| Point | Verdict | Détail |
|---|---|---|
| P0-module — Le module « Planning de chantier » est activé pour l'entreprise des comptes de test | OK |  |
| P0-droits — Droits : le responsable écrit ; magasinier et collaborateur lisent seulement | OK |  |

## P1 Préparation

| Point | Verdict | Détail |
|---|---|---|
| P1-prepa — Chantier de test (juin 2027), prestataire, zones, équipes, phase, jour bloqué, réglages | OK |  |
| P1-doublon — Deux zones de même nom sur un chantier : refusées | OK |  |

## P2 Interventions

| Point | Verdict | Détail |
|---|---|---|
| P2-valide — Trois interventions valides (lundi 2 juin… heures de Zurich) | OK |  |
| P2-chevauche — Même équipe qui se chevauche : refusée | OK |  |
| P2-contigu — Créneau qui touche sans chevaucher : accepté | OK |  |
| P2-pas — Heure hors du pas de 15 minutes : refusée | OK |  |
| P2-tot — Avant l'ouverture de la journée : refusée | OK |  |
| P2-tard — Après la fermeture de la journée : refusée | OK |  |
| P2-bloque — Jour bloqué (dimanche 13) : refusée | OK |  |
| P2-avant — Avant le début du chantier : refusée | OK |  |
| P2-apres — Après la fin du chantier : refusée | OK |  |
| P2-inverse — Fin avant le début : refusée | OK |  |
| P2-zone-etrangere — Zone d'un autre chantier : refusée | OK |  |
| P2-deplacer — Déplacer une intervention dans le créneau d'une autre de la même équipe : refusé | OK |  |
| P2-zone-utilisee — Une zone ou une équipe utilisée ne se supprime pas | OK |  |

## P3 Séries

| Point | Verdict | Détail |
|---|---|---|
| P3-serie — Série du lundi au vendredi (7 au 11 juin) : 5 interventions, même série | OK |  |
| P3-bloque — Jour bloqué sauté dans une série (12 au 14 juin, le 13 est bloqué) | OK |  |
| P3-tout-ou-rien — Un chevauchement refuse TOUTE la série et nomme la date | OK |  |
| P3-entrees — Entrées invalides refusées : aucun jour, plus de 120 jours, dernier jour avant le premier | OK |  |
| P3-supprimer — Supprimer toute une série (par son series_id) | OK |  |

## P4 Copie

| Point | Verdict | Détail |
|---|---|---|
| P4-copie — Copier le 2 juin (3 interventions) vers le 21 et le 22 : 6 créées, mêmes heures | OK |  |
| P4-rejouer — Recopier au même endroit : refusé avec la date | OK |  |
| P4-vide — Copier un jour sans intervention : refusé | OK |  |

## P5 Matériel

| Point | Verdict | Détail |
|---|---|---|
| P5-besoin — Besoin en matériel : ajout, doublon et quantité nulle refusés, avertissement si le stock ne suffit pas | INFO | article de test : Scie circulaire à métaux XGT ® |

## P6 Droits

| Point | Verdict | Détail |
|---|---|---|
| P6-staff-lit — staff : lit le planning (interventions, zones, équipes, prestataires) | OK |  |
| P6-staff-ecrit — staff : ne crée, ne modifie, ne supprime rien | OK |  |
| P6-collab-lit — collab : lit le planning (interventions, zones, équipes, prestataires) | OK |  |
| P6-collab-ecrit — collab : ne crée, ne modifie, ne supprime rien | OK |  |
| P6-anonyme — Visiteur sans connexion : aucune donnée de planning | OK |  |

## P7 Écran

| Point | Verdict | Détail |
|---|---|---|
| P7-frise — Responsable : la frise s'affiche (jour du premier chantier) avec les interventions du 2 juin | OK |  |
| P7-glisser — Responsable : glisser « Montage » de +30 min l'enregistre (08:30) | OK |  |
| P7-glisser-refuse — Responsable : glisser « Montage » sur un créneau où son équipe est déjà occupée : refusé, remis en place avec le message | OK |  |
| P7-clavier — Responsable : flèche droite sur « Montage » le décale d'un pas (08:45) | OK |  |
| P7-vues — Responsable : « Par prestataire » et « 1 semaine » s'affichent | OK |  |
| P7-liste — Responsable : onglet Interventions (liste) et fenêtres « Nouvelle intervention » / « Copier un jour » | OK |  |
| P7-avertissement — Responsable : l'avertissement de matériel est visible sur « Montage » | OK |  |
| P7-staff-ecran — staff : l'écran s'ouvre en lecture seule (pas de bouton de création, pas de glisser) | OK |  |
| P7-collab-ecran — collab : l'écran s'ouvre en lecture seule (pas de bouton de création, pas de glisser) | OK |  |
| P7-chantier-clos — Chantier clôturé : lecture seule et création refusée | OK |  |

## Erreurs JavaScript

Aucune.
