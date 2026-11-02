# Rapport des tests poussés

Base : GO-MAT · comptes : test.collaborateur@example.com, test.magasinier@example.com, test.responsable@example.com · date : 2026-11-02 07:00
Commit testé : à renseigner (`git log --oneline -1`).

**Synthèse : 268 OK · 0 PARTIEL · 0 KO · 0 NON TESTÉ · 14 INFO (observations)**

Nettoyage : 10 commande(s) annulée(s), 8 article(s) retiré(s) du service, stock de test remis à zéro dans 2 dépôt(s), rien de bloqué.

## À corriger (KO et PARTIEL)

Aucun.


## G1 Droits par rôle

| Point | Verdict | Détail |
|---|---|---|
| G1-collab-perms — collab : permissions lues (aucune) | INFO | rôle user |
| G1-collab-/demandes — collab sur /demandes (scan/approve/view_all) | OK |  |
| G1-collab-/scan — collab sur /scan (scan) | OK |  |
| G1-collab-/comptoir — collab sur /comptoir (scan) | OK |  |
| G1-collab-/etiquettes — collab sur /etiquettes (manage_stock) | OK |  |
| G1-collab-/badges — collab sur /badges (manage_people) | OK |  |
| G1-collab-/entretien — collab sur /entretien (manage_stock) | OK |  |
| G1-collab-/inventaire — collab sur /inventaire (scan/manage_stock) | OK |  |
| G1-collab-/commandes — collab sur /commandes (manage_stock) | OK |  |
| G1-collab-/couts — collab sur /couts (view_all/manage_stock) | OK |  |
| G1-collab-/pilotage — collab sur /pilotage (approve/settings) | OK |  |
| G1-collab-/journal — collab sur /journal (approve/settings) | OK |  |
| G1-collab-/chantiers — collab sur /chantiers (view_all/scan/approve/manage_stock) | OK |  |
| G1-collab-/carte — collab sur /carte (view_all/scan/approve/manage_stock) | OK |  |
| G1-collab-/kits — collab sur /kits (scan/manage_stock) | OK |  |
| G1-collab-/formations — collab sur /formations (manage_people/view_all/scan) | OK |  |
| G1-collab-/locations — collab sur /locations (manage_stock/manage_fleet/view_all) | OK |  |
| G1-collab-/transferts — collab sur /transferts (scan/manage_stock) | OK |  |
| G1-collab-/emplacements — collab sur /emplacements (manage_stock/scan) | OK |  |
| G1-collab-/atelier — collab sur /atelier (scan/manage_stock/view_all) | OK |  |
| G1-collab-/comptabilite — collab sur /comptabilite (settings/approve) | OK |  |
| G1-collab-/prevision — collab sur /prevision (manage_stock/view_all) | OK |  |
| G1-collab-/donnees — collab sur /donnees (settings/manage_stock/manage_people) | OK |  |
| G1-collab-/demarrage — collab sur /demarrage (settings) | OK |  |
| G1-collab-/ecran — collab sur /ecran (scan/view_all/manage_stock) | OK |  |
| G1-collab-/epi — collab sur /epi (scan/manage_people/manage_stock/view_all) | OK |  |
| G1-collab-/planning — collab sur /planning (view_all/scan/approve/manage_stock/manage_fleet) | OK |  |
| G1-collab-/incidents — collab sur /incidents (view_all/scan/approve/manage_stock) | OK |  |
| G1-collab-/checkouts — collab sur /checkouts (scan/view_all) | OK |  |
| G1-collab-/consommables — collab sur /consommables (scan/manage_stock) | OK |  |
| G1-collab-/commande — collab sur /commande (manage_stock) | OK |  |
| G1-collab-/notifications — collab sur /notifications (view_all/scan/approve/manage_stock) | OK |  |
| G1-collab-/tableau-de-bord — collab sur /tableau-de-bord (view_all) | OK |  |
| G1-collab-/users — collab sur /users (manage_people) | OK |  |
| G1-collab-/settings — collab sur /settings (settings) | OK |  |
| G1-collab-/entreprises — collab sur /entreprises (platform) | OK |  |
| G1-staff-perms — staff : permissions lues (manage_stock, scan, view_all) | INFO | rôle technician |
| G1-staff-/demandes — staff sur /demandes (scan/approve/view_all) | OK |  |
| G1-staff-/scan — staff sur /scan (scan) | OK |  |
| G1-staff-/comptoir — staff sur /comptoir (scan) | OK |  |
| G1-staff-/etiquettes — staff sur /etiquettes (manage_stock) | OK |  |
| G1-staff-/badges — staff sur /badges (manage_people) | OK |  |
| G1-staff-/entretien — staff sur /entretien (manage_stock) | OK |  |
| G1-staff-/inventaire — staff sur /inventaire (scan/manage_stock) | OK |  |
| G1-staff-/commandes — staff sur /commandes (manage_stock) | OK |  |
| G1-staff-/couts — staff sur /couts (view_all/manage_stock) | OK |  |
| G1-staff-/pilotage — staff sur /pilotage (approve/settings) | OK |  |
| G1-staff-/journal — staff sur /journal (approve/settings) | OK |  |
| G1-staff-/chantiers — staff sur /chantiers (view_all/scan/approve/manage_stock) | OK |  |
| G1-staff-/carte — staff sur /carte (view_all/scan/approve/manage_stock) | OK |  |
| G1-staff-/kits — staff sur /kits (scan/manage_stock) | OK |  |
| G1-staff-/formations — staff sur /formations (manage_people/view_all/scan) | OK |  |
| G1-staff-/locations — staff sur /locations (manage_stock/manage_fleet/view_all) | OK |  |
| G1-staff-/transferts — staff sur /transferts (scan/manage_stock) | OK |  |
| G1-staff-/emplacements — staff sur /emplacements (manage_stock/scan) | OK |  |
| G1-staff-/atelier — staff sur /atelier (scan/manage_stock/view_all) | OK |  |
| G1-staff-/comptabilite — staff sur /comptabilite (settings/approve) | OK |  |
| G1-staff-/prevision — staff sur /prevision (manage_stock/view_all) | OK |  |
| G1-staff-/donnees — staff sur /donnees (settings/manage_stock/manage_people) | OK |  |
| G1-staff-/demarrage — staff sur /demarrage (settings) | OK |  |
| G1-staff-/ecran — staff sur /ecran (scan/view_all/manage_stock) | OK |  |
| G1-staff-/epi — staff sur /epi (scan/manage_people/manage_stock/view_all) | OK |  |
| G1-staff-/planning — staff sur /planning (view_all/scan/approve/manage_stock/manage_fleet) | OK |  |
| G1-staff-/incidents — staff sur /incidents (view_all/scan/approve/manage_stock) | OK |  |
| G1-staff-/checkouts — staff sur /checkouts (scan/view_all) | OK |  |
| G1-staff-/consommables — staff sur /consommables (scan/manage_stock) | OK |  |
| G1-staff-/commande — staff sur /commande (manage_stock) | OK |  |
| G1-staff-/notifications — staff sur /notifications (view_all/scan/approve/manage_stock) | OK |  |
| G1-staff-/tableau-de-bord — staff sur /tableau-de-bord (view_all) | OK |  |
| G1-staff-/users — staff sur /users (manage_people) | OK |  |
| G1-staff-/settings — staff sur /settings (settings) | OK |  |
| G1-staff-/entreprises — staff sur /entreprises (platform) | OK |  |
| G1-resp-perms — resp : permissions lues (all_depots, approve, manage_fleet, manage_people, manage_stock, scan, view_all) | INFO | rôle manager |
| G1-resp-/demandes — resp sur /demandes (scan/approve/view_all) | OK |  |
| G1-resp-/scan — resp sur /scan (scan) | OK |  |
| G1-resp-/comptoir — resp sur /comptoir (scan) | OK |  |
| G1-resp-/etiquettes — resp sur /etiquettes (manage_stock) | OK |  |
| G1-resp-/badges — resp sur /badges (manage_people) | OK |  |
| G1-resp-/entretien — resp sur /entretien (manage_stock) | OK |  |
| G1-resp-/inventaire — resp sur /inventaire (scan/manage_stock) | OK |  |
| G1-resp-/commandes — resp sur /commandes (manage_stock) | OK |  |
| G1-resp-/couts — resp sur /couts (view_all/manage_stock) | OK |  |
| G1-resp-/pilotage — resp sur /pilotage (approve/settings) | OK |  |
| G1-resp-/journal — resp sur /journal (approve/settings) | OK |  |
| G1-resp-/chantiers — resp sur /chantiers (view_all/scan/approve/manage_stock) | OK |  |
| G1-resp-/carte — resp sur /carte (view_all/scan/approve/manage_stock) | OK |  |
| G1-resp-/kits — resp sur /kits (scan/manage_stock) | OK |  |
| G1-resp-/formations — resp sur /formations (manage_people/view_all/scan) | OK |  |
| G1-resp-/locations — resp sur /locations (manage_stock/manage_fleet/view_all) | OK |  |
| G1-resp-/transferts — resp sur /transferts (scan/manage_stock) | OK |  |
| G1-resp-/emplacements — resp sur /emplacements (manage_stock/scan) | OK |  |
| G1-resp-/atelier — resp sur /atelier (scan/manage_stock/view_all) | OK |  |
| G1-resp-/comptabilite — resp sur /comptabilite (settings/approve) | OK |  |
| G1-resp-/prevision — resp sur /prevision (manage_stock/view_all) | OK |  |
| G1-resp-/donnees — resp sur /donnees (settings/manage_stock/manage_people) | OK |  |
| G1-resp-/demarrage — resp sur /demarrage (settings) | OK |  |
| G1-resp-/ecran — resp sur /ecran (scan/view_all/manage_stock) | OK |  |
| G1-resp-/epi — resp sur /epi (scan/manage_people/manage_stock/view_all) | OK |  |
| G1-resp-/planning — resp sur /planning (view_all/scan/approve/manage_stock/manage_fleet) | OK |  |
| G1-resp-/incidents — resp sur /incidents (view_all/scan/approve/manage_stock) | OK |  |
| G1-resp-/checkouts — resp sur /checkouts (scan/view_all) | OK |  |
| G1-resp-/consommables — resp sur /consommables (scan/manage_stock) | OK |  |
| G1-resp-/commande — resp sur /commande (manage_stock) | OK |  |
| G1-resp-/notifications — resp sur /notifications (view_all/scan/approve/manage_stock) | OK |  |
| G1-resp-/tableau-de-bord — resp sur /tableau-de-bord (view_all) | OK |  |
| G1-resp-/users — resp sur /users (manage_people) | OK |  |
| G1-resp-/settings — resp sur /settings (settings) | OK |  |
| G1-resp-/entreprises — resp sur /entreprises (platform) | OK |  |

## G2 Sécurité API (collaborateur)

| Point | Verdict | Détail |
|---|---|---|
| G2-users — GET users : seulement sa propre fiche | OK |  |
| G2-audit — GET audit_log : refusé ou vide | OK |  |
| G2-requests — GET requests : seulement les siennes | OK |  |
| G2-checkouts — GET checkouts : seulement les siens | OK |  |
| G2-settings — GET system_settings : aucun secret lisible | OK |  |
| G2-insert-equipment — POST equipment : refusé | OK |  |
| G2-self-promote — PATCH users : ne peut pas se donner le rôle admin | OK |  |
| G2-delete-requests — DELETE requests : refusé | OK |  |
| G2-other-requester — create_request pour une autre personne : refusé | OK |  |
| G2-decide — decide_request par un collaborateur : refusé | OK |  |
| G2-storage — Envoi dans photos-articles par un collaborateur : refusé | OK |  |
| G2-injection — Filtre avec apostrophe/injection : pas d'erreur 500 | INFO | bloquée avant d'atteindre la base (pare-feu) |
| G2-anonyme — Sans connexion : equipment, users, requests illisibles | OK |  |

## Préparation

| Point | Verdict | Détail |
|---|---|---|
| PREP — Données de test créées | INFO | 8 articles ; seuil de validation = 10 ; 2 dépôt(s) ; permis : Gerbeur et transpalette électriques |

## G3 Commandes

| Point | Verdict | Détail |
|---|---|---|
| G3-auto — Consommable x1 : validée automatiquement | OK |  |
| G3-seuil — Quantité au-delà du seuil (10) : à valider | OK |  |
| G3-seuil-pile — Quantité = seuil (10) : pas de validation | OK |  |
| G3-article-validation — Article « validation requise » : à valider | OK |  |
| G3-permis — Outil exigeant un permis, sans permis : refusé avec le nom du permis | OK |  |
| G3-chevauchement — Même outil (1 exemplaire) sur la même période : 2e commande refusée | OK |  |
| G3-periode-suivante — Même outil, période qui suit (sans chevauchement) : acceptée | OK |  |
| G3-fin-avant-debut — Fin avant début : refusée | OK |  |
| G3-qte-zero — Quantité 0 : refusée | OK |  |
| G3-qte-negative — Quantité négative : refusée | OK |  |
| G3-qte-enorme — Quantité 1 000 000 : refusée ou à valider (jamais validée seule) | INFO | acceptée « à valider » |
| G3-qte-decimale — Quantité décimale 1,5 sur un outil | INFO | refusée : Pas assez de « TEST-E2E Outil simple » sur la période : 1 disponible(s), 1.5 demandé(s) |
| G3-vide — Commande sans article : refusée | OK |  |
| G3-article-inconnu — Article inexistant : refusé | OK |  |
| G3-article-retire — Article retiré du service : refusé | OK |  |
| G3-stock-insuffisant — Quantité supérieure au stock (stock 40, demande 45) | INFO | acceptée (statut requested) : le stock est contrôlé à la sortie |
| G3-unicode — Texte libre : accents, emoji, guillemets, 3 000 caractères | OK |  |
| G3-passe — Retrait dans le passé (appel direct de l'API) | INFO | refusée : Le retrait est dans le passé : choisis une date à venir. |
| G3-changement-heure — Période à cheval sur le changement d'heure d'octobre 2026 | INFO | refusée : Le retrait est dans le passé : choisis une date à venir. |
| G3-vehicule — Véhicule : toujours « à valider » ; permis contrôlé | INFO | refusée (permis G) : TEST Rôle Collaborateur n'a pas le permis G requis (permis non renseigné dans « Personnes ») |
| G3-2-vehicules — Deux véhicules dans une commande : refusé | OK |  |

## G4 Cycle de vie

| Point | Verdict | Détail |
|---|---|---|
| G4-collab-decide — Collaborateur : ne peut pas valider sa propre commande | OK |  |
| G4-staff-decide — Magasinier sans « approve » : ne peut pas valider | OK |  |
| G4-resp-valide — Responsable : valide, et la décision porte son nom | OK |  |
| G4-notif-validee — Le collaborateur reçoit l'avis « validée » | OK |  |
| G4-prete — Magasin : validée → prête, avis au collaborateur | OK |  |
| G4-annule-prete-collab — Collaborateur : ne peut pas annuler une commande « prête » | OK |  |
| G4-sauter-etape — Passer directement « à valider » → « prête » : refusé | OK |  |
| G4-retour-etat — Statut inventé : refusé | OK |  |
| G4-sortie-collab — Collaborateur : ne peut pas sortir une commande | OK |  |
| G4-sortie-conso — Magasin : sortie d'un consommable, stock diminué | INFO | statut après sortie : closed |
| G4-double-sortie — Sortir deux fois la même commande : refusé, stock inchangé | OK |  |
| G4-refus — Responsable : refuse une commande avec motif, avis au collaborateur | OK |  |
| G4-annule-envoyee — Collaborateur : annule une commande « à valider » | OK |  |
| G4-annule-validee-libere — Annuler libère l'outil : la même période redevient réservable | OK |  |
| G4-annule-autrui — Collaborateur : ne peut pas annuler la commande d'un autre | OK |  |
| G4-journal — Le journal enregistre les décisions (lecture par le responsable) | OK |  |

## G5 Stock

| Point | Verdict | Détail |
|---|---|---|
| G5-reception — Réception +5 : stock augmente de 5 | OK |  |
| G5-reception-zero — Réception de 0 ou négative : refusée | OK |  |
| G5-sortie-trop — Sortie supérieure au stock : refusée | OK |  |
| G5-sortie-sans-motif — Sortie sans personne ni chantier : refusée | OK |  |
| G5-sortie-ok — Sortie de 2 avec chantier : stock −2 | OK |  |
| G5-inventaire — Inventaire : le stock devient la valeur comptée | OK |  |
| G5-inventaire-negatif — Inventaire négatif : refusé | OK |  |
| G5-transfert — Transfert entre deux dépôts (si 2 dépôts) | OK |  |
| G5-transfert-meme-depot — Transfert vers le même dépôt : refusé | OK |  |
| G5-collab-stock — Collaborateur : ne peut pas modifier le stock | OK |  |
| G5-seuil-alerte — Stock sous le seuil : une alerte est créée | INFO | alerte : TEST-E2E Consommable : il reste 2 pièce au Dépôt principal (seuil 5). |

## G6 Interface Shop

| Point | Verdict | Détail |
|---|---|---|
| G6-recherche-accent — Recherche « perceuse » = « PERÇEUSE » = « percuss » | OK |  |
| G6-recherche-vide — Recherche sans résultat : état vide propre | OK |  |
| G6-recherche-speciaux — Recherche avec caractères spéciaux (% _ ' " < >) | OK |  |
| G6-xss — Nom d'article avec <img onerror> : affiché comme texte, rien d'exécuté | OK |  |
| G6-nom-long — Nom de 200 caractères : pas de débordement (bureau et téléphone) | OK |  |
| G6-panier-qte — Panier : − à 1 retire l'article, + augmente, rechargement conserve | OK |  |
| G6-double-clic — Double clic sur « Commander » : une seule commande | OK |  |
| G6-hors-ligne — Hors ligne : message clair, panier conservé | OK |  |
| G6-article-retire — Article retiré pendant qu'il est au panier : retiré avec un avis | OK |  |
| G6-session-expiree — Session supprimée : retour à la page de connexion | OK |  |
| G6-upload-image — Image d'article (API, compte responsable) : PNG accepté, texte refusé | OK |  |

## G7 Pages

| Point | Verdict | Détail |
|---|---|---|
| G7-_-bureau — / (bureau) | OK | 1518 ms |
| G7-_-tablette — / (tablette) | OK | 1524 ms |
| G7-_-téléphone — / (téléphone) | OK | 1518 ms |
| G7-_shop-bureau — /shop (bureau) | OK | 1500 ms |
| G7-_shop-tablette — /shop (tablette) | OK | 1509 ms |
| G7-_shop-téléphone — /shop (téléphone) | OK | 1514 ms |
| G7-_shop_vue_commandes-bureau — /shop?vue=commandes (bureau) | OK | 1544 ms |
| G7-_shop_vue_commandes-tablette — /shop?vue=commandes (tablette) | OK | 1514 ms |
| G7-_shop_vue_commandes-téléphone — /shop?vue=commandes (téléphone) | OK | 1552 ms |
| G7-_demandes-bureau — /demandes (bureau) | OK | 1565 ms |
| G7-_demandes-tablette — /demandes (tablette) | OK | 1541 ms |
| G7-_demandes-téléphone — /demandes (téléphone) | OK | 1503 ms |
| G7-_consommables-bureau — /consommables (bureau) | OK | 1530 ms |
| G7-_consommables-tablette — /consommables (tablette) | OK | 1516 ms |
| G7-_consommables-téléphone — /consommables (téléphone) | OK | 1525 ms |
| G7-_commande-bureau — /commande (bureau) | OK | 1525 ms |
| G7-_commande-tablette — /commande (tablette) | OK | 1543 ms |
| G7-_commande-téléphone — /commande (téléphone) | OK | 1552 ms |
| G7-_commandes-bureau — /commandes (bureau) | OK | 1535 ms |
| G7-_commandes-tablette — /commandes (tablette) | OK | 1503 ms |
| G7-_commandes-téléphone — /commandes (téléphone) | OK | 1521 ms |
| G7-_equipment-bureau — /equipment (bureau) | OK | 1536 ms |
| G7-_equipment-tablette — /equipment (tablette) | OK | 1526 ms |
| G7-_equipment-téléphone — /equipment (téléphone) | OK | 1535 ms |
| G7-_kits-bureau — /kits (bureau) | OK | 1511 ms |
| G7-_kits-tablette — /kits (tablette) | OK | 1533 ms |
| G7-_kits-téléphone — /kits (téléphone) | OK | 1539 ms |
| G7-_entretien-bureau — /entretien (bureau) | OK | 1536 ms |
| G7-_entretien-tablette — /entretien (tablette) | OK | 1544 ms |
| G7-_entretien-téléphone — /entretien (téléphone) | OK | 1528 ms |
| G7-_atelier-bureau — /atelier (bureau) | OK | 1534 ms |
| G7-_atelier-tablette — /atelier (tablette) | OK | 1520 ms |
| G7-_atelier-téléphone — /atelier (téléphone) | OK | 1538 ms |
| G7-_incidents-bureau — /incidents (bureau) | OK | 1568 ms |
| G7-_incidents-tablette — /incidents (tablette) | OK | 1552 ms |
| G7-_incidents-téléphone — /incidents (téléphone) | OK | 1522 ms |
| G7-_etiquettes-bureau — /etiquettes (bureau) | OK | 1601 ms |
| G7-_etiquettes-tablette — /etiquettes (tablette) | OK | 1552 ms |
| G7-_etiquettes-téléphone — /etiquettes (téléphone) | OK | 1520 ms |
| G7-_vehicules-bureau — /vehicules (bureau) | OK | 1537 ms |
| G7-_vehicules-tablette — /vehicules (tablette) | OK | 1549 ms |
| G7-_vehicules-téléphone — /vehicules (téléphone) | OK | 1547 ms |
| G7-_chantiers-bureau — /chantiers (bureau) | OK | 1521 ms |
| G7-_chantiers-tablette — /chantiers (tablette) | OK | 1564 ms |
| G7-_chantiers-téléphone — /chantiers (téléphone) | OK | 1558 ms |
| G7-_locations-bureau — /locations (bureau) | OK | 1534 ms |
| G7-_locations-tablette — /locations (tablette) | OK | 1534 ms |
| G7-_locations-téléphone — /locations (téléphone) | OK | 1566 ms |
| G7-_planning-bureau — /planning (bureau) | OK | 1582 ms |
| G7-_planning-tablette — /planning (tablette) | OK | 1557 ms |
| G7-_planning-téléphone — /planning (téléphone) | OK | 1532 ms |
| G7-_users-bureau — /users (bureau) | OK | 1588 ms |
| G7-_users-tablette — /users (tablette) | OK | 1570 ms |
| G7-_users-téléphone — /users (téléphone) | OK | 1560 ms |
| G7-_formations-bureau — /formations (bureau) | OK | 1545 ms |
| G7-_formations-tablette — /formations (tablette) | OK | 1542 ms |
| G7-_formations-téléphone — /formations (téléphone) | OK | 1569 ms |
| G7-_epi-bureau — /epi (bureau) | OK | 1533 ms |
| G7-_epi-tablette — /epi (tablette) | OK | 1552 ms |
| G7-_epi-téléphone — /epi (téléphone) | OK | 1570 ms |
| G7-_transferts-bureau — /transferts (bureau) | OK | 1534 ms |
| G7-_transferts-tablette — /transferts (tablette) | OK | 1554 ms |
| G7-_transferts-téléphone — /transferts (téléphone) | OK | 1550 ms |
| G7-_emplacements-bureau — /emplacements (bureau) | OK | 1539 ms |
| G7-_emplacements-tablette — /emplacements (tablette) | OK | 1547 ms |
| G7-_emplacements-téléphone — /emplacements (téléphone) | OK | 1519 ms |
| G7-_inventaire-bureau — /inventaire (bureau) | OK | 1555 ms |
| G7-_inventaire-tablette — /inventaire (tablette) | OK | 1580 ms |
| G7-_inventaire-téléphone — /inventaire (téléphone) | OK | 1538 ms |
| G7-_checkouts-bureau — /checkouts (bureau) | OK | 1570 ms |
| G7-_checkouts-tablette — /checkouts (tablette) | OK | 1572 ms |
| G7-_checkouts-téléphone — /checkouts (téléphone) | OK | 1620 ms |
| G7-_journal-bureau — /journal (bureau) | OK | 1534 ms |
| G7-_journal-tablette — /journal (tablette) | OK | 1529 ms |
| G7-_journal-téléphone — /journal (téléphone) | OK | 1520 ms |
| G7-_couts-bureau — /couts (bureau) | OK | 1558 ms |
| G7-_couts-tablette — /couts (tablette) | OK | 1569 ms |
| G7-_couts-téléphone — /couts (téléphone) | OK | 1519 ms |
| G7-_pilotage-bureau — /pilotage (bureau) | OK | 1520 ms |
| G7-_pilotage-tablette — /pilotage (tablette) | OK | 1545 ms |
| G7-_pilotage-téléphone — /pilotage (téléphone) | OK | 1522 ms |
| G7-_notifications-bureau — /notifications (bureau) | OK | 1522 ms |
| G7-_notifications-tablette — /notifications (tablette) | OK | 1504 ms |
| G7-_notifications-téléphone — /notifications (téléphone) | OK | 1529 ms |
| G7-_aide-bureau — /aide (bureau) | OK | 1524 ms |
| G7-_aide-tablette — /aide (tablette) | OK | 1511 ms |
| G7-_aide-téléphone — /aide (téléphone) | OK | 1516 ms |
| G7-ouverture-cartes — Une carte ouvre un panneau qui se ferme avec Échap (6 pages) | INFO | 6 pages vérifiées |
| G7-clavier — Clavier : Tab atteint les boutons du Shop, focus visible | OK | 25 éléments, focus visible 25/25 |

## G8 Langues

| Point | Verdict | Détail |
|---|---|---|
| G8-de-_shop — DE /shop : mots français restants | OK |  |
| G8-de-_shop_vue_commandes — DE /shop?vue=commandes : mots français restants | OK |  |
| G8-de-_ — DE / : mots français restants | OK |  |
| G8-de-_consommables — DE /consommables : mots français restants | OK |  |
| G8-it-_shop — IT /shop : mots français restants | OK |  |
| G8-it-_shop_vue_commandes — IT /shop?vue=commandes : mots français restants | OK |  |
| G8-it-_ — IT / : mots français restants | OK |  |
| G8-it-_consommables — IT /consommables : mots français restants | OK |  |
| G8-en-_shop — EN /shop : mots français restants | OK |  |
| G8-en-_shop_vue_commandes — EN /shop?vue=commandes : mots français restants | OK |  |
| G8-en-_ — EN / : mots français restants | OK |  |
| G8-en-_consommables — EN /consommables : mots français restants | OK |  |

## Erreurs JavaScript

Aucune.
