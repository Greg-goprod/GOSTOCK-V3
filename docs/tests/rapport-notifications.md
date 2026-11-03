# Rapport des tests des notifications

Base : GO-MAT · comptes : test.collaborateur@example.com, test.magasinier@example.com, test.responsable@example.com · date : 2026-11-02 07:18
Commit testé : à renseigner (`git log --oneline -1`).

**Synthèse : 25 OK · 0 PARTIEL · 0 KO · 1 NON TESTÉ · 0 INFO**

Nettoyage : 12 notification(s) marquée(s) lue(s) pour les trois comptes (les notifications « TEST-NOTIF » restent en base : ces comptes ne peuvent pas les supprimer).

## À corriger (KO et PARTIEL)

Aucun.

## Observations (INFO / NON TESTÉ)

- **N4-menu-lire** — Menu d'une carte : « Marquer comme lue » baisse la pastille de 1 et reste sur la page : aucune carte de test « Non lue » affichée


## N1 Qui voit quoi

| Point | Verdict | Détail |
|---|---|---|
| N1-creation — Création de 3 notifications de test : une pour le magasin, une pour le collaborateur, une pour le magasinier | OK |  |
| N1-collab — Collaborateur : voit son avis, pas l'alerte du magasin ni l'avis du magasinier | OK |  |
| N1-staff — Magasinier : voit l'alerte du magasin et son avis, pas l'avis du collaborateur | OK |  |
| N1-resp — Responsable : voit l'alerte du magasin, pas les avis personnels des autres | OK |  |
| N1-anonyme — Visiteur sans connexion : aucune fonction de notification | OK |  |

## N2 Compteur

| Point | Verdict | Détail |
|---|---|---|
| N2-collab — collab : le compteur est égal au nombre de non lues de la liste | OK |  |
| N2-staff — staff : le compteur est égal au nombre de non lues de la liste | OK |  |
| N2-resp — resp : le compteur est égal au nombre de non lues de la liste | OK |  |

## N3 Lu par personne

| Point | Verdict | Détail |
|---|---|---|
| N3-staff-lit — Magasinier : lit l'alerte du magasin (son compteur baisse de 1) | OK |  |
| N3-resp-inchange — Responsable : l'alerte lue par le magasinier reste NON lue pour lui | OK |  |
| N3-non-lue — Magasinier : remet l'alerte en « non lue » (compteur +1) | OK |  |
| N3-collab-hors-perimetre — Collaborateur : ne peut ni lire ni modifier l'alerte du magasin ni l'avis d'un autre | OK |  |
| N3-lignes-privees — Chacun ne lit que ses propres lignes de lecture | OK |  |
| N3-tout-lire — Collaborateur : « tout marquer comme lu » vide son compteur sans toucher aux autres | OK |  |
| N3-nouvelle — Une nouvelle notification fait remonter le compteur de 1 | OK |  |

## N4 Pastille et page (magasinier)

| Point | Verdict | Détail |
|---|---|---|
| N4-pastille — La pastille du menu et la cloche affichent le compteur de la base | OK |  |
| N4-page — La page affiche « Non lues (n) » avec le même n | OK |  |
| N4-menu-lire — Menu d'une carte : « Marquer comme lue » baisse la pastille de 1 et reste sur la page | NON TESTÉ | aucune carte de test « Non lue » affichée |
| N4-persistant — Après rechargement, la pastille garde sa valeur (le « lu » est enregistré) | OK |  |
| N4-actualiser — Une nouvelle alerte apparaît avec « Actualiser », sans recharger la page | OK |  |
| N4-filtre-non-lues — Filtre « Non lues » : n'affiche que des cartes « Non lue » | OK |  |
| N4-tout-lire — « Tout marquer comme lu » : pastille à zéro, enregistré après rechargement | OK |  |
| N4-resp-inchange — Le « tout lire » du magasinier n'a pas vidé la pastille du responsable | OK |  |

## N5 Avis du collaborateur

| Point | Verdict | Détail |
|---|---|---|
| N5-pastille — Collaborateur : la cloche affiche le compteur de la base | OK |  |
| N5-ok — Collaborateur : « OK » sur un avis le lit (pastille −1, enregistré après rechargement) | OK |  |
| N5-pas-de-page — Collaborateur : pas d'accès à la page Notifications du magasin | OK |  |

## Erreurs JavaScript

Aucune.
