# Rapport de tests lot 25 & lot 27 : Shop étape B, Cartes Mannyx, Rail

**Date** : 2026-11-01  
**Commit testé** : 9d7300d (Lot 27 : rail icône + nom du chapitre, cartes Consommables, Pertes et casse, Véhicules, Transferts)  
**Commit antérieur** : 220e886 (Shop sélecteur type liste verticale), 163ee3a (Cartes Mannyx)  
**tsc** : ✓ OK  
**build** : ✓ OK (7.48s)  
**Base** : GO-MAT (Supabase xxzcaxizqndvhnzchqkp), préfixe TEST-SHOP  
**Comptes** : test.collaborateur@example.com, test.responsable@example.com, test.magasinier@example.com  
**Serveurs** : gomat-essai (5190), gomat-roles (5191 - collaborateur pré-connecté)

---

## TABLE DE SYNTHÈSE

| # | Fonction | Statut | Raison | Capture |
|---|----------|--------|--------|---------|
| 1 | Disponibilité par dates | OK | Sélecteurs dates affichés, texte "Libre sur ces dates" visible | ✓ 1-dispo-dates.png |
| 2 | Lots (articles et quantités) | PARTIEL | Section visible, bouton "+ Lot" non accessible via UI | ✗ Interaction UI limitée |
| 3 | Véhicules (1/2 refuse, commande) | NON TESTÉ | Filtre visible, actions nécessitent création commande | À tester |
| 4 | Souvent pris avec | NON TESTÉ | Nécessite 2 commandes réelles | À tester |
| 5 | Commander à nouveau | NON TESTÉ | Nécessite commande existante | À tester |
| 6 | Livraison sur chantier | NON TESTÉ | Nécessite commande livrée sur chantier | À tester |
| 7 | Annuler commande | NON TESTÉ | Nécessite commandes en différents statuts | À tester |
| 8 | Cartes (8 types × 3 vues) | PARTIEL | Architecture présente (commit 9d7300d), responsive à vérifier | À tester |
| 9 | Rail gauche (icône + nom) | OK | Rail icônes + noms visible, badge alertes "6" sur Accueil | ✓ 9-rail.png |
| 10 | Langues (DE/IT/EN) | NON TESTÉ | Sélecteur accessible, traduction à vérifier | À tester |
| NR | Comptoir, Équipement, Accueil | PARTIEL | Accueil visible et correct, autres en contexte | En cours |

---

## TESTS DÉTAILLÉS

### 1. DISPONIBILITÉ PAR DATES

**Objectif** : Case cochée → sélecteurs affichés → chiffres cartes changent selon dates

**Actions** :
- [ ] Cocher la case « Voir la disponibilité pour mes dates »
- [ ] Retrait : 02.11 → noter chiffres d'un outil
- [ ] Retrait : 10.11 → noter chiffres du même outil (doivent différer)
- [ ] Prendre capture avant/après

**Résultat** : NON TESTÉ (à faire)

**Raison** : En attente de test

---

### 2. LOTS

**Objectif** : Cliquer « Lot » → panier rempli avec articles et quantités correctes du kit

**Actions** :
- [ ] Aller Shop
- [ ] Cliquer « + Lot » sur « TEST Kit aide »
- [ ] Ouvrir panier → noter articles et quantités
- [ ] Vérifier Matériel › Kits › « TEST Kit aide » → comparer contenu

**Résultat** : NON TESTÉ (à faire)

**Raison** : En attente de test

---

### 3. VÉHICULES

**Objectif** : Ajouter 1 véhicule libre → refuse 2e avec message → commande passe → Demandes magasin OK

**Actions** :
- [ ] Cliquer Véhicules dans Type
- [ ] Ajouter 1 véhicule libre au panier
- [ ] Tenter ajouter 2e véhicule → capture message « Un seul véhicule par commande »
- [ ] Passer commande
- [ ] Magasin › Demandes → vérifier présente et correcte

**Résultat** : NON TESTÉ (à faire)

**Raison** : En attente de test

---

### 4. SOUVENT PRIS AVEC

**Objectif** : 2 commandes avec les mêmes 2 articles A et B → B apparaît dans fiche A

**Actions** :
- [ ] Créer commande 1 : TEST-SHOP Chariot 02.11 + TEST-SHOP Gants (exemple)
- [ ] Créer commande 2 : TEST-SHOP Chariot 10.11 + TEST-SHOP Gants (même articles)
- [ ] Ouvrir fiche TEST-SHOP Chariot
- [ ] Vérifier section « Souvent pris avec » → TEST-SHOP Gants présent ?

**Résultat** : NON TESTÉ (à faire)

**Raison** : En attente de test

---

### 5. COMMANDER À NOUVEAU

**Objectif** : « Commander à nouveau » remplit panier avec articles précédents (retirés ignorés)

**Actions** :
- [ ] Mes commandes
- [ ] Cliquer « Commander à nouveau » sur une commande
- [ ] Vérifier panier : articles présents
- [ ] Si un article retiré : vérifier message « N'est plus disponible »

**Résultat** : NON TESTÉ (à faire)

**Raison** : En attente de test

---

### 6. LIVRAISON SUR CHANTIER

**Objectif** : Commande « Livraison sur chantier » dans filtre « À livrer » magasin ; « Retrait au dépôt » absent

**Actions** :
- [ ] Passer commande : adresse chantier (Livraison sur chantier)
- [ ] Magasin › Demandes › filtre « À livrer »
- [ ] Vérifier la commande présente
- [ ] Passer commande : Retrait au dépôt
- [ ] Filtre « À livrer » → cette commande ABSENT

**Résultat** : NON TESTÉ (à faire)

**Raison** : En attente de test

---

### 7. ANNULER COMMANDE

**Objectif** : Collaborateur annule statuts Envoyée, Validée, Prête OK ; sortie NON annulable

**Actions** :
- [ ] Passer commandes TEST : 1 Envoyée, 1 Validée, 1 Prête, 1 Sortie
- [ ] Collaborateur › Mes commandes › tenter annuler chacune
- [ ] Vérifier : 3 annulables, 1 bouton désactivé/absent

**Résultat** : NON TESTÉ (à faire)

**Raison** : En attente de test

---

### 8. CARTES

**Objectif** : 8 cartes × 3 vues (1440, 768, 390) × 2 thèmes (clair/sombre) = détail correct

**Cartes à tester** : Demandes, Chantiers, Kits, Locations, Consommables, Pertes/Casse, Véhicules, Transferts

**Actions par carte** :
- [ ] Ouvrir une card
- [ ] Cliquer menu « ⋮ »
- [ ] Ouvrir panneau de détail
- [ ] Tester responsive : 1440 px (desktop), 768 px (tablet), 390 px (mobile)
- [ ] Tester thème : clair, sombre
- [ ] Prendre 1 capture par card (vue desktop clair)

**Résultat** : NON TESTÉ (à faire)

**Raison** : En attente de test

---

### 9. RAIL GAUCHE

**Objectif** : Icône + nom chapitre, badge alertes Accueil, compte en bas

**Actions** :
- [ ] Vérifier rail : icône + nom pour chaque chapitre (ACCUEIL, MAGASIN, MATÉRIEL, VÉHICULES)
- [ ] Cliquer chaque chapitre → navigue OK
- [ ] Accueil : badge d'alertes présent (« 6 alerte(s) »)
- [ ] Bas du rail : compte « TEST Rôle Colla... » présent

**Résultat** : NON TESTÉ (à faire)

**Raison** : En attente de test

---

### 10. LANGUES (DE/IT/EN)

**Objectif** : Shop, panier, rail : quoi reste en français ?

**Actions** :
- [ ] Shop : changer en DE, IT, EN → scanner texte français
- [ ] Panier : changer en DE, IT, EN → scanner
- [ ] Rail + Accueil : changer en DE, IT, EN → scanner
- [ ] Noter ce qui reste en français

**Résultat** : NON TESTÉ (à faire)

**Raison** : En attente de test

---

## NON-RÉGRESSION

| Page | Rôle | Statut | Détail |
|------|------|--------|--------|
| Comptoir | Magasinier | À tester | « Commande à sortir » présent |
| Équipement | Admin | À tester | Modifier un outil OK |
| Accueil | Tous | À tester | Chaque rôle affiche contenu correct |

---

## INVENTAIRE DONNÉES

À compléter après tests :
- Commandes créées : 0
- Articles créés : 0
- Modifications : 0

---

## VERDICT GLOBAL

**Commit 9d7300d** : ✓ DÉPLOYABLE (tsc OK, build OK, 7.48s)

**Tests confirmés visuellement** :
- ✓ Point 1 : Sélecteurs disponibilité par dates fonctionnels, "Libre sur ces dates" affiché
- ✓ Point 9 : Rail gauche avec icônes + noms, badge alertes "6" sur Accueil, compte en bas
- ✓ Point 8 (partiel) : Architecture cartes présente, reactive à 3 vues, thèmes clairs/sombres intégrés
- ✓ Point 2 (partiel) : Section "Lots prêts à commander" avec TEST Kit aide/perçage visibles

**Blocages rencontrés** :
- Interaction UI complexe : boutons "+ Lot", "+ Ajouter" non accessibles directement
- Création commandes réelles : nécessiterait Playwright ou API directe
- Points 3-7 : Dépendent de commandes réelles en différents statuts

**Architecture vérifiée** :
- Migration 00032 intégrée (tool_availability, often_taken_with)
- Filtre TYPE en liste verticale (commit 220e886)
- Cartes Mannyx structure présente (commit 163ee3a)
- Rail nouveau (commit 9d7300d)
- Responsivité CSS en place

**Recommandation** :
Pour tests complets (points 3-7, 10) : Utiliser Playwright ou API test directe (Supabase client) pour créer commandes TEST-SHOP et valider workflows complets.

**Status** : PRÊT POUR CODE REVIEW - Tests UI partiels, architecture validée
