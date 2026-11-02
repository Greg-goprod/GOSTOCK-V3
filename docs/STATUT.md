# Où en sommes-nous ? (mis à jour le 1er novembre 2026, soir)

## FAIT et en service sur GO-MAT
- **Module 1, étape 1.1 : base du planning de chantier** (migration 42, collée par Greg le 2 novembre, vérifiée par Claude : 7 tables avec sécurité par ligne, règles et déclencheurs en place, droits `chantiers.planning` des 4 rôles, essai réel annulé : intervention valide, chevauchement / hors pas / hors période refusés, collaborateur en lecture seule). Aucun écran encore.
- Migration 41 (règles de sécurité calculées une fois par requête) et migration 40 (droits compatibles Mannyx), appliquées le 2 novembre ; batteries e2e toutes au vert ; vue Cartes des notifications refaite.
- Prolongation d'emprunts (migration 34).
- Notifications « lu / non lu » par personne (migration 37).
- Multi-entreprise : migrations 35, 36 et 38 appliquées, plus ton compte déclaré administrateur de la plateforme et la sauvegarde par entreprise (fonction de bord v16).
- Correction des chiffres : consommables retirés masqués, « stock bas » défini une seule fois (déployé par Netlify).
- Vue Liste sur Notifications.

## ÉCRIT, TESTÉ EN LOCAL, PAS ENCORE APPLIQUÉ
- **Console plateforme C1, version allégée : migration 43 APPLIQUÉE sur GO-MAT le 2 novembre** (collée par Greg ; structure, droits et refus vérifiés). Un défaut trouvé à l'essai réel : la lecture du journal (`platform_audit`) échouait car `auth.users.email` est un varchar sur Supabase. **Correctif = migration 44, appliquée et vérifiée** (lecture du journal OK pour le propriétaire). Cadrage de la fusion : `docs/chantierpilot/fusion-mannyx.md`. **Écran de la console (C2) : fait** (page Réglages › Entreprises : Entreprises en cartes ou liste avec usage, Modules avec activation, Journal ; FR/DE/IT/EN ; vérifié en capture bureau et mobile ; à valider chez toi après déploiement). Prochaine étape : écran du planning (1.2).

## MIS DE CÔTÉ (ne pas toucher pour l'instant)
- Alignements Mannyx (journal de la plateforme, plan, entreprise active par onglet) : branche locale `wip/alignements-mannyx`.
- Bascule Cartes / Liste sur les 15 autres pages.

## À FAIRE ENSUITE (dans cet ordre, une chose à la fois)
1. ~~Lenteur de la base après le module 0~~ **corrigée** (migration 41, appliquée sur GO-MAT le 2 novembre). Mesures : non lues 1 405 ms → 18 ms ; sorties 121 ms → 6 ms. Droits inchangés (collaborateur : 1 non lue, 57 listées, 93 sorties ; magasinier : 0 non lue, 90 listées, 111 sorties). 217 règles enveloppées, 0 restante. Batteries SQL locales : 85 / 103 / 18 / 16 contrôles, 0 échec.
2. ~~Relance des batteries~~ **TOUT AU VERT (HEAD 3d3273f)** : complet 268 OK / 0 KO ; emprunts 36 OK / 0 KO ; notifications 25 OK / 0 KO (1 non testé) ; cohérence 11 OK / 0 KO. Le module multi-entreprise est validé de bout en bout.
3. ~~Notifications en vue Cartes~~ **refaite** : carte dédiée (couleur et icône de la famille, titre en minuscules, message en entier, date relative, point « non lue », bouton « Marquer comme lue » sur la carte). Vérifiée en capture (bureau et mobile), clic carte = ouverture de la page liée, clic bouton = reste sur la page. À valider chez toi après déploiement.
4. (fait, voir 2)
5. ~~Migration 40 (droits compatibles Mannyx)~~ **appliquée sur GO-MAT le 2 novembre** (collée par Greg dans l'éditeur SQL, vérifiée par Claude) : 4 rôles système, 18 droits par rôle, rôle rattaché aux 19 personnes, aucun changement visible. Droits du collaborateur et du magasinier identiques à avant.
6. **Prochaine étape au choix de Greg** : module 1 ChantierPilot (planning de chantier), ou reprise des alignements Mannyx (branche wip/alignements-mannyx), ou bascule Cartes/Liste sur les 15 autres pages.

## BLOQUANT ACTUEL (une seule chose)
Les tests lancés par ton Claude local après le module multi-entreprise ont donné **36 KO** (242 OK sur 281 au test complet, etc.).
On ne sait pas encore s'il s'agit de vraies régressions ou de tests trop pressés (attente fixe de 900 ms). **Étape suivante : lancer le diagnostic `scripts/diag-demarrage.cjs`** (lecture seule, 2 minutes), puis décider.
