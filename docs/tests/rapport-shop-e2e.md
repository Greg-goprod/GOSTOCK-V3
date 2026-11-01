# Rapport des parcours Shop (Playwright)

Commit testé : à renseigner avec `git log --oneline -1`. Base : GO-MAT. Comptes : test.collaborateur@example.com et test.magasinier@example.com.

Synthèse : 25 OK · 0 PARTIEL · 1 KO · 0 NON TESTÉ
Commande de test créée puis annulée : DEM2611-0001

| Point | Verdict | Détail | Capture |
|---|---|---|---|
| A1-demandes-interdit — Collaborateur : /demandes est inaccessible | OK |  | [A1-demandes-interdit.png](captures-shop-e2e/A1-demandes-interdit.png) |
| A2-rail — Rail : icône + nom, un lien par chapitre | OK | Accueil
6, Magasin, Matériel, Véhicules, Aide | [A2-rail.png](captures-shop-e2e/A2-rail.png) |
| B1-dispo-dates — Disponibilité par dates : les cartes d'outils changent | OK | avant : « Scie circulaire à métaux XGT ® 1 disponible Ajouter » → après : « Scie circulaire à métaux XGT ® 1 libre sur ces dates Ajouter » | [B1-dispo-dates.png](captures-shop-e2e/B1-dispo-dates.png) |
| B2-lot — Lot : « Lot » ajoute les articles du kit au panier | OK | 1 ligne(s) dans le panier | [B2-lot.png](captures-shop-e2e/B2-lot.png) |
| B3-vehicule — Véhicules : un seul par commande | OK |  | [B3-vehicule.png](captures-shop-e2e/B3-vehicule.png) |
| B4-commande-livraison — Commande d'un consommable en livraison sur chantier | OK | commande DEM2611-0001 | [B4-commande-livraison.png](captures-shop-e2e/B4-commande-livraison.png) |
| B5-mes-commandes — Mes commandes : la commande apparaît avec son suivi | OK |  | [B5-mes-commandes.png](captures-shop-e2e/B5-mes-commandes.png) |
| C1-a-livrer — Magasin : la commande en livraison est dans « À livrer » | OK |  | [C1-a-livrer.png](captures-shop-e2e/C1-a-livrer.png) |
| C2-cartes-demandes — Demandes : groupes par étape et cartes | OK | VALIDÉES, À PRÉPARER (3) / TERMINÉES (18) | [C2-cartes-demandes.png](captures-shop-e2e/C2-cartes-demandes.png) |
| D1-recommander — « Commander à nouveau » remet les articles dans le panier | OK |  | [D1-recommander.png](captures-shop-e2e/D1-recommander.png) |
| D2-annuler — Annuler la commande (Envoyée / Validée) | KO | Erreur : locator.click: Timeout 30000ms exceeded. | [D2-annuler.png](captures-shop-e2e/D2-annuler.png) |
| E-demandes — Page demandes : s'affiche, une carte s'ouvre, pas de débordement | OK | 3 carte(s) ; menu ⋮ : Ouvrir | [E-demandes.png](captures-shop-e2e/E-demandes.png) |
| E-chantiers — Page chantiers : s'affiche, une carte s'ouvre, pas de débordement | OK | 2 carte(s) ; menu ⋮ : Rapport PDF Préparer un chantier semblable Modifier Clôturer | [E-chantiers.png](captures-shop-e2e/E-chantiers.png) |
| E-kits — Page kits : s'affiche, une carte s'ouvre, pas de débordement | OK | 2 carte(s) ; menu ⋮ : Imprimer l'étiquette Modifier Supprimer | [E-kits.png](captures-shop-e2e/E-kits.png) |
| E-locations — Page locations : s'affiche, une carte s'ouvre, pas de débordement | OK | 3 carte(s) ; menu ⋮ : + 7 jours Rendu Modifier Supprimer | [E-locations.png](captures-shop-e2e/E-locations.png) |
| E-entretien — Page entretien : s'affiche, une carte s'ouvre, pas de débordement | OK | 0 carte(s) | [E-entretien.png](captures-shop-e2e/E-entretien.png) |
| E-atelier — Page atelier : s'affiche, une carte s'ouvre, pas de débordement | OK | 0 carte(s) | [E-atelier.png](captures-shop-e2e/E-atelier.png) |
| E-formations — Page formations : s'affiche, une carte s'ouvre, pas de débordement | OK | 0 carte(s) | [E-formations.png](captures-shop-e2e/E-formations.png) |
| E-epi — Page epi : s'affiche, une carte s'ouvre, pas de débordement | OK | 1 carte(s) ; menu ⋮ : Modifier Supprimer | [E-epi.png](captures-shop-e2e/E-epi.png) |
| E-consommables — Page consommables : s'affiche, une carte s'ouvre, pas de débordement | OK | 3 carte(s) ; menu ⋮ : Sortir Réception Inventaire Transfert Seuil minimum Modifier | [E-consommables.png](captures-shop-e2e/E-consommables.png) |
| E-incidents — Page incidents : s'affiche, une carte s'ouvre, pas de débordement | OK | 0 carte(s) | [E-incidents.png](captures-shop-e2e/E-incidents.png) |
| E-vehicules — Page vehicules : s'affiche, une carte s'ouvre, pas de débordement | OK | 7 carte(s) ; menu ⋮ : Carnet | [E-vehicules.png](captures-shop-e2e/E-vehicules.png) |
| E-transferts — Page transferts : s'affiche, une carte s'ouvre, pas de débordement | OK | 0 carte(s) | [E-transferts.png](captures-shop-e2e/E-transferts.png) |
| F-de — Shop en DE : s'affiche (relecture à faire sur la capture) | OK |  | [F-de.png](captures-shop-e2e/F-de.png) |
| F-it — Shop en IT : s'affiche (relecture à faire sur la capture) | OK |  | [F-it.png](captures-shop-e2e/F-it.png) |
| F-en — Shop en EN : s'affiche (relecture à faire sur la capture) | OK |  | [F-en.png](captures-shop-e2e/F-en.png) |

Aucune erreur JavaScript.
