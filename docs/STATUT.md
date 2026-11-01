# Où en sommes-nous ? (mis à jour le 1er novembre 2026, soir)

## FAIT et en service sur GO-MAT
- Prolongation d'emprunts (migration 34).
- Notifications « lu / non lu » par personne (migration 37).
- Multi-entreprise : migrations 35, 36 et 38 appliquées, plus ton compte déclaré administrateur de la plateforme et la sauvegarde par entreprise (fonction de bord v16).
- Correction des chiffres : consommables retirés masqués, « stock bas » défini une seule fois (déployé par Netlify).
- Vue Liste sur Notifications.

## ÉCRIT, TESTÉ EN LOCAL, PAS ENCORE APPLIQUÉ
- Migration 40 : droits compatibles Mannyx (aucun changement visible). Attend ta validation (l'outil a demandé une confirmation sans réponse).

## MIS DE CÔTÉ (ne pas toucher pour l'instant)
- Alignements Mannyx (journal de la plateforme, plan, entreprise active par onglet) : branche locale `wip/alignements-mannyx`.
- Bascule Cartes / Liste sur les 15 autres pages.
- Planning de chantier (module 1) : démarre après l'étape 1 des droits.

## À FAIRE ENSUITE (dans cet ordre, une chose à la fois)
1. **Lenteur de la base après le module 0 (cause trouvée, à corriger avant de relancer les tests)** : 144 règles de sécurité sur 227 appellent `app_has()` / `app_user_id()` une fois par ligne lue. Depuis le module 0, chaque appel coûte plus cher (il cherche l'entreprise active). Mesure sur GO-MAT (compte collaborateur, 161 notifications) : compter les non lues = 1 405 ms ; le même parcours avec les appels calculés une seule fois par requête (`(SELECT app_has(...))`) = 10 ms. Essai fait dans une transaction annulée : rien n'est modifié en base. Correctif prévu : une migration qui réécrit ces règles, vérifiée par les batteries SQL locales.
2. Ensuite seulement : décision sur les 36 KO (la plupart sont des lenteurs, donc à relancer après le correctif).
3. Notifications en vue Cartes : refaire la carte (message en entier, date relative, point « non lue », bouton « Marquer comme lue » sur la carte). La carte actuelle est faite pour des personnes ou des outils : le message est coupé et les initiales n'ont aucun sens.
4. Relancer les trois batteries, puis `e2e-coherence`.
5. Migration 40 (droits compatibles Mannyx).

## BLOQUANT ACTUEL (une seule chose)
Les tests lancés par ton Claude local après le module multi-entreprise ont donné **36 KO** (242 OK sur 281 au test complet, etc.).
On ne sait pas encore s'il s'agit de vraies régressions ou de tests trop pressés (attente fixe de 900 ms). **Étape suivante : lancer le diagnostic `scripts/diag-demarrage.cjs`** (lecture seule, 2 minutes), puis décider.
