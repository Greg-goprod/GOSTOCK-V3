# Consignes de test — lot 16 et contre-tests du rapport Chrome

Branche à tester : `claude/loving-thompson-6zfo06` (dernier commit attendu : « Permis machines suisses… » ou plus récent).
Base : **GO-MAT uniquement** (`xxzcaxizqndvhnzchqkp`). Ne jamais toucher GO-STATICK ni Go-Prod-AURA.
Rapport à écrire : `docs/tests/rapport-lot16.md` sur la branche `tests/rapport-chrome` (comme le précédent).
Ne pas pousser sur `claude/loving-thompson-6zfo06`.

## 0. Préparation

1. Terminer la fusion en cours dans `GOSTOCK-V3` (`git status` indique « All conflicts fixed but you are still
   merging ») : `git commit --no-edit`.
2. Tester le code de `claude/loving-thompson-6zfo06` dans un dossier séparé pour ne pas mélanger avec le rapport :
   `git fetch origin claude/loving-thompson-6zfo06` puis
   `git worktree add ..\GOMAT-essai origin/claude/loving-thompson-6zfo06`, copier `.env`, `npm ci`,
   `npm run dev -- --port 5190`.
3. Toutes les données créées commencent par **TEST** (personnes, locations, chantiers…).
4. Photos : sur ordinateur, choisir n'importe quelle image du disque ; signatures à la souris.

## 1. Permis et formations (menu « Permis et formations »)

- [ ] La liste montre deux groupes : « Permis machines » (18 entrées : cariste, nacelles IPAF 1a/1b/3a/3b,
      grutier A/B, grue de chargement, machinistes…) puis « Formations ».
- [ ] « Nouveau permis ou formation » propose le type (permis machine / formation).
- [ ] Donner à « TEST Cariste » l'attestation « Nacelle PEMP – IPAF 3b » ; l'échéance proposée est à 5 ans.
- [ ] Fiche personne : les permis de conduire montrent toutes les catégories suisses (A1 … M) avec libellé.
- [ ] Une personne avec seulement **B** peut réserver un véhicule exigeant **F** ou **G** ; pas **C1** ni **BE**.

## 2. Location d'un outil / engin

- [ ] « Locations » → « Nouvelle location » : type **Outil ou engin**, « TEST Nacelle 3b », loueur « TEST Loueur »,
      fin dans 3 jours, « Permis machine exigé » = IPAF 3b. La ligne affiche « Réception à faire chez le loueur ».
- [ ] « Réception » : refuser d'enregistrer sans les 2 photos obligatoires (vue d'ensemble, plaque signalétique)
      et sans signature → messages clairs.
- [ ] Avec photos, un dégât (zone + description + photo), accessoires cochés, signature : enregistrement OK,
      pastille « Dans le stock ».
- [ ] « Matériel » : « TEST Nacelle 3b » avec la pastille « Loué jusqu'au … », numéro `LOC-…`, sans prix par jour.
- [ ] Comptoir : sortie refusée pour une personne **sans** IPAF 3b ; acceptée pour « TEST Cariste ».
- [ ] Sortie avec un retour **après** la fin de location → refusée (« Location « … » jusqu'au … »).
- [ ] « Restitution » refusée tant que l'outil est sorti ; après retour au comptoir : restitution OK
      (vignettes de la réception à côté de chaque vue, dégâts de la réception rappelés).
- [ ] Après restitution : location « Rendu le … », l'outil n'est plus proposé (retiré), son historique reste.
- [ ] « PV réception et restitution » : la fenêtre d'impression montre les deux colonnes, la grille des photos
      côte à côte, les signatures et l'heure.
- [ ] Supprimer une location qui a une réception → refusé.

## 3. Location d'un véhicule

- [ ] Type **Véhicule**, plaque « TEST 123 », permis B, fin dans 5 jours. Réception : refusée sans les 5 vues
      (avant, arrière, côtés, compteur) ni kilométrage ; OK ensuite.
- [ ] « Véhicules » : le véhicule apparaît avec « Loué jusqu'au … ».
- [ ] Demande avec ce véhicule : le choix affiche « loué jusqu'au … » ; une demande qui finit **après** la fin
      de location est refusée ; une demande dans la période passe.
- [ ] « + 7 jours » sur la location : la pastille du véhicule suit la nouvelle date.
- [ ] Restitution refusée tant que la demande est ouverte (message avec le numéro DEM…) ; kilométrage inférieur
      à la réception refusé ; après clôture/annulation de la demande : restitution OK, véhicule retiré.
- [ ] Location « Autre (coût seulement) » : bouton « Rendu » comme avant, pas d'état des lieux.

## 4. Contre-tests du rapport précédent (`docs/tests/rapport-chrome.md`)

- [ ] P10 : sortie d'un outil à QR individuels → exemplaire attaché (contrôle en base `checkouts.instance_id`).
- [ ] P8 : préparation d'une demande (scan) → « Marquer prête » → recharger : préparation conservée.
- [ ] P7 : retour d'un kit par scan du QR du kit (à rejouer, non reproduit côté base).
- [ ] P2 : personne créée dans la session, badge scanné tout de suite au comptoir.
- [ ] P12 : départ avec caution non rendue (point compté, confirmation à la clôture).
- [ ] P1 : QR de badge sur la fiche personne lu par le comptoir.
- [ ] P13 : personne partie absente de « Pour qui ».
- [ ] P6 : supprimer un outil avec historique → proposition de retrait du service.
- [ ] P14 : boutons du formulaire d'outil toujours visibles.
- [ ] P11 : date obligatoire vide → « Ce champ est obligatoire » sous le champ.
- [ ] P17 : jours hors du mois estompés dans le calendrier.
- [ ] P15 : bulle de la carte non coupée.
- [ ] P18 : chantier saisi sans fiche → avertissement sous le champ.
- [ ] P3 : plus de 401 dans la console au démarrage.
- [ ] P9 : restauration d'une sauvegarde → aucun doublon.

## 5. Langues

- [ ] Passer en DE puis EN sur « Locations », l'état des lieux et « Permis et formations » : pas de texte
      français oublié (sauf données saisies et messages venant de la base).

## Format du rapport

Même format que `rapport-chrome.md` : tableau des scénarios (✅ / ⚠️ / ❌), défauts numérotés **L1, L2…** avec
page, ce qui a été fait, attendu, constaté, captures ; liste des données TEST laissées en base.
