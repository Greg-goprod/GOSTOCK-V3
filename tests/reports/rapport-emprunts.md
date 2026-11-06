# Rapport du cycle de vie d'un emprunt

Base : GO-MAT · comptes : test.collaborateur@example.com, test.magasinier@example.com, test.responsable@example.com · date : 2026-11-02 07:17
Commit testé : à renseigner (`git log --oneline -1`).

**Synthèse : 36 OK · 0 PARTIEL · 0 KO · 0 NON TESTÉ · 13 INFO (comportements à lire)**

Nettoyage : 7 sortie(s) rendue(s), 4 incident(s) clos « retrouvé », 2 maintenance(s) close(s), 2 demande(s) annulée(s), 19 outil(s) retiré(s), rien de bloqué.

## À corriger (KO et PARTIEL)

Aucun.

## Comportements observés (INFO)

- **E1-quantite-excessive** — Sortie de plus d'exemplaires que disponibles : refusée : Plus de stock disponible pour « TEST-EMPRUNT Outil A »
- **E4-a-reparer** — Retour « à réparer » : l'outil passe en maintenance, ne peut plus sortir : refus : Plus de stock disponible pour « TEST-EMPRUNT Outil C » ; disponibilité 0
- **E4-decision-casse** — Responsable : décide « déduit du salaire » avec un coût ; le magasin seul ne peut pas : le magasinier seul ne peut pas décider
- **E5-sortie-echue** — Sortie dont le retour est déjà dépassé (hier) : acceptée ou refusée ? : acceptée (le serveur ne contrôle pas la date de retour passée)
- **E5-commande-en-retard** — Une personne en retard peut-elle encore commander ? : autorisée (aucun blocage automatique des personnes en retard)
- **E5-notification-retard** — Une alerte de retard est créée pour le magasin : alerte : TEST Rôle Collaborateur demande de garder « TEST-EMPRUNT Outil K » jusqu'au 10.11.2026 (retour prévu le 07.11.2026) : TEST-EMPRUNT chantier retardé.
- **E6-perte** — Perte déclarée : sortie « perdue », incident à décider, outil indisponible : disponibilité après perte : 0 (2 sorties, dont 1 perdue)
- **E6-double-declaration** — Déclarer deux fois la même perte : acceptée (un second incident est créé)
- **E6-retrouve** — Objet retrouvé : la sortie n'est plus « perdue », l'outil est de nouveau disponible : statut de la sortie après « retrouvé » : returned ; disponibilité 1
- **E6-collab-declare** — Collaborateur : peut-il déclarer lui-même la perte d'un outil qu'il a ? : accepté (sortie : lost)
- **E7-demande-collab** — Collaborateur : demande une prolongation (avis au magasin, pas de doublon) ; pas pour l'outil d'un autre : 2e demande identique absorbée (un seul avis)
- **E8-demande-perdu** — Demande dont un outil est perdu et l'autre rendu : état de la demande : demande : closed (1 outil perdu, 1 rendu)
- **E9-accueil-retards** — Accueil magasin : le retard/perte est compté : mention « retard » présente


## E1 Sortie

| Point | Verdict | Détail |
|---|---|---|
| E1-sortie — Magasin : sortie de 2 outils sur 3, le collaborateur les voit, la disponibilité baisse | OK |  |
| E1-quantite-excessive — Sortie de plus d'exemplaires que disponibles : refusée | INFO | Plus de stock disponible pour « TEST-EMPRUNT Outil A » |
| E1-quantite-zero — Sortie de quantité 0 ou négative : refusée | OK |  |
| E1-consommable — Sortie d'un consommable en prêt : refusée | OK |  |
| E1-collab-sortie — Collaborateur : ne peut pas se faire une sortie lui-même | OK |  |

## E2 Retour

| Point | Verdict | Détail |
|---|---|---|
| E2-retour-refus-collab — Collaborateur : ne peut pas enregistrer un retour | OK |  |
| E2-etat-inconnu — État de retour inventé : refusé | OK |  |
| E2-retour-complet — Retour des 2 outils : tout redevient disponible, bon « rendu » | OK |  |
| E2-double-retour — Retour d'une sortie déjà rendue : refusé | OK |  |

## E3 Retour partiel

| Point | Verdict | Détail |
|---|---|---|
| E3-partiel — Bon de 3 outils : 1 rendu → bon « partiel », 2 toujours chez la personne | OK |  |
| E3-partiel-collab-voit — Le collaborateur voit encore les 2 sorties restantes | OK |  |
| E3-ui-partiel — Interface magasin : le bon partiel est visible dans Sorties | OK |  |

## E4 États au retour

| Point | Verdict | Détail |
|---|---|---|
| E4-incomplet — Retour « incomplet » : rendu, contrôle enregistré | OK |  |
| E4-retour-final — Dernière ligne rendue : le bon passe à « rendu » | OK |  |
| E4-a-reparer — Retour « à réparer » : l'outil passe en maintenance, ne peut plus sortir | INFO | refus : Plus de stock disponible pour « TEST-EMPRUNT Outil C » ; disponibilité 0 |
| E4-casse — Retour « cassé » : maintenance + incident « cassé » à décider | OK |  |
| E4-decision-casse — Responsable : décide « déduit du salaire » avec un coût ; le magasin seul ne peut pas | INFO | le magasinier seul ne peut pas décider |
| E4-collab-decide — Collaborateur : ne peut pas décider d'un incident | OK |  |

## E5 Retard (non rendu)

| Point | Verdict | Détail |
|---|---|---|
| E5-sortie-echue — Sortie dont le retour est déjà dépassé (hier) : acceptée ou refusée ? | INFO | acceptée (le serveur ne contrôle pas la date de retour passée) |
| E5-passage-retard — Après l'échéance la sortie passe en « en retard » | OK |  |
| E5-dispo-retard — Un outil en retard reste indisponible : 1 sur 2 seulement réservable | OK |  |
| E5-qui-a-quoi — Le retard est visible : « qui a quoi » et « Mon matériel » | OK |  |
| E5-commande-en-retard — Une personne en retard peut-elle encore commander ? | INFO | autorisée (aucun blocage automatique des personnes en retard) |
| E5-notification-retard — Une alerte de retard est créée pour le magasin | INFO | alerte : TEST Rôle Collaborateur demande de garder « TEST-EMPRUNT Outil K » jusqu'au 10.11.2026 (retour prévu le 07.11.2026) : TEST-EMPRUNT chantier retardé. |
| E5-retour-tardif — Retour tardif : accepté, disponibilité rétablie | OK |  |

## E6 Perte et vol

| Point | Verdict | Détail |
|---|---|---|
| E6-perte — Perte déclarée : sortie « perdue », incident à décider, outil indisponible | INFO | disponibilité après perte : 0 (2 sorties, dont 1 perdue) |
| E6-retour-sortie-perdue — Enregistrer un retour sur une sortie « perdue » : refusé | OK |  |
| E6-double-declaration — Déclarer deux fois la même perte | INFO | acceptée (un second incident est créé) |
| E6-decision-assurance — Responsable : décision « assurance » ; collaborateur ne peut pas décider | OK |  |
| E6-retrouve — Objet retrouvé : la sortie n'est plus « perdue », l'outil est de nouveau disponible | INFO | statut de la sortie après « retrouvé » : returned ; disponibilité 1 |
| E6-vol — Vol déclaré : même traitement qu'une perte | OK |  |
| E6-collab-declare — Collaborateur : peut-il déclarer lui-même la perte d'un outil qu'il a ? | INFO | accepté (sortie : lost) |
| E6-collab-declare-autrui — Collaborateur : ne peut pas déclarer la perte d'un outil d'un autre | OK |  |
| E6-ui-pertes — Interface : la perte apparaît dans « Pertes et casse » avec la décision à prendre | OK |  |

## E7 Prolongation

| Point | Verdict | Détail |
|---|---|---|
| E7-collab-modif-directe — Collaborateur : ne peut pas repousser lui-même la date de retour (accès direct) | OK |  |
| E7-collab-extend-refuse — Collaborateur : ne peut pas prolonger via la fonction du magasin | OK |  |
| E7-prolonger — Magasin : prolonge une sortie ; la date change, la note le dit, le collaborateur est prévenu | OK |  |
| E7-date-invalide — Date antérieure au retour prévu, passée ou à plus d'un an : refusées | OK |  |
| E7-prolonger-apres-partiel — Après un retour partiel : seules les sorties restantes sont prolongées | OK |  |
| E7-conflit-reservation — Une réservation à venir sur le même outil empêche la prolongation | OK |  |
| E7-prolonger-retard — Une sortie en retard prolongée redevient « active » | OK |  |
| E7-demande-collab — Collaborateur : demande une prolongation (avis au magasin, pas de doublon) ; pas pour l'outil d'un autre | INFO | 2e demande identique absorbée (un seul avis) |

## E8 Demande puis sortie

| Point | Verdict | Détail |
|---|---|---|
| E8-demande-sortie — Demande de 2 outils → préparée → sortie : la demande est « sortie » | OK |  |
| E8-demande-partielle — Un seul des 2 outils rendu : la demande reste « sortie » | OK |  |
| E8-prolonger-demande — Demande partiellement rendue : « Prolonger » ne touche que l'outil resté dehors, la demande est prolongée | OK |  |
| E8-demande-close — Le second outil rendu : la demande est clôturée automatiquement | OK |  |
| E8-demande-perdu — Demande dont un outil est perdu et l'autre rendu : état de la demande | INFO | demande : closed (1 outil perdu, 1 rendu) |

## E9 Interface collaborateur

| Point | Verdict | Détail |
|---|---|---|
| E9-materiel-chez-moi — Le collaborateur voit ce qu'il a, avec « Signaler » | OK |  |
| E9-accueil-retards — Accueil magasin : le retard/perte est compté | INFO | mention « retard » présente |

## Erreurs JavaScript

Aucune.
