# Rapport de cohérence des chiffres

Base : GO-MAT · comptes : test.responsable@example.com, test.collaborateur@example.com · date : 2026-11-02 07:04
Commit testé : 2564f4db6fb71704391b896108559d0f93ed9c92

**Synthèse : 11 OK · 0 PARTIEL · 0 KO · 0 NON TESTÉ · 0 INFO**

Nettoyage : 6 article(s) de test retiré(s) du service (ils ne s'affichent plus).

## À corriger (KO et PARTIEL)

Aucun.


## Préparation

| Point | Verdict | Détail |
|---|---|---|
| PREP — Articles pièges : bas (2/5), épuisé avec seuil (0/5), épuisé sans seuil, retiré avec seuil, en ordre (8/3) | OK |  |

## C1 La base

| Point | Verdict | Détail |
|---|---|---|
| C1-vue — La feuille « À commander » (vue de la base) = les lignes sous leur seuil des articles en service | OK |  |

## C2 Écran Consommables

| Point | Verdict | Détail |
|---|---|---|
| C2-cartes — Autant de cartes que d'articles en service ; aucun article retiré affiché | OK |  |
| C2-stock-bas — « Stock bas seulement (n) » = n articles bas ou épuisés de la base | OK |  |
| C2-retires — « Afficher les articles retirés » fait apparaître l'article retiré avec la pastille « Retiré » | OK |  |

## C3 Écran À commander

| Point | Verdict | Détail |
|---|---|---|
| C3-lignes — Autant de lignes que la vue de la base ; chaque article bas ou épuisé avec seuil y figure | OK |  |
| C3-sans-seuil — Un article épuisé sans seuil est signalé par un avis (il ne peut pas être commandé automatiquement) | OK |  |

## C4 Accueil

| Point | Verdict | Détail |
|---|---|---|
| C4-chiffres — Accueil : Consommables, Sous le seuil, Outils et Véhicules = la base | OK |  |

## C5 Pastille de notifications

| Point | Verdict | Détail |
|---|---|---|
| C5-resp — resp : la pastille = le nombre de non lues de la base | OK |  |
| C5-collab — collab : la pastille = le nombre de non lues de la base | OK |  |

## C6 Mise à jour sans recharger

| Point | Verdict | Détail |
|---|---|---|
| C6-stock — Un stock modifié dans la base apparaît sur l'écran Consommables en moins de 90 secondes, sans recharger | OK |  |

## Erreurs JavaScript

Aucune.
