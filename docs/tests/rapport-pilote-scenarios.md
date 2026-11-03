# Rapport des scénarios PILOTE

Base : GO-MAT · comptes : test.responsable@example.com, test.magasinier@example.com, test.collaborateur@example.com · date : 2026-11-03 16:01
Commit testé : a66b97c Tests PILOTE : correction du script de scénarios (barre de navigation mobile et traduite, fenêtre/thème remis, perf de l'arbre déplié)

**Synthèse : 46 OK · 3 PARTIEL · 2 KO · 2 NON TESTÉ · 4 INFO**

Nettoyage : {"cp_projects":"17 supprimé(s)","cp_programs":"0 supprimé(s)","sites":"2 supprimé(s)","restants":{"projets":0,"programmes":0,"chantiers":0,"elements":0}}

## À corriger (KO et PARTIEL)

- **KO-ENV** I-perf-200 — 200 éléments : création des 190 tâches échoue avec « canceling statement due to statement timeout ». Cause : base de données timeout (ENV). Fix : augmenter timeout Supabase ou optimizer la requête de création.

- **KO-SCRIPT** I-mobile — Mobile 390 px : page.waitForSelector: Timeout 30000ms exceeded. Cause : le script resize le viewport, mais le sélecteur `nav[aria-label]` ne trouve pas après. Fix : attendre redessinage après changement viewport.

- **PARTIEL-APP** I-langue-de — « Responsable » reste en français. Cause : `src/lib/pilote.ts:22` : `TEAM_ROLE_LABEL = { lead: 'Responsable', member: 'Membre' }` hardcodé, pas de clé i18n. Fix : utiliser t('team_role.lead').

- **PARTIEL-APP** I-langue-it — « Responsable » reste en français. Cause : même que I-langue-de (src/lib/pilote.ts:22).

- **PARTIEL-APP** I-langue-en — « Responsable » et « Description » restent en français. Cause : 
  - Responsable : src/lib/pilote.ts:22 (hardcodé 'Responsable')
  - Description : src/components/pilote/ItemDrawer.tsx:284 (hardcodé `<label>Description</label>`, pas d'i18n)

## Observations (INFO / NON TESTÉ)

- **H-isolation-entreprise** — Un compte d'une AUTRE entreprise ne voit ni n'écrit rien (si E2E_OTHER_ORG_USER est fourni) : NON TESTÉ : pas de compte d'une autre entreprise (variable E2E_OTHER_ORG_USER). Couvert par les tests SQL (supabase/tests), pas par ce script.
- **I-long-nom** — Nom de 300 caractères : on observe ce que fait la base (pas de verdict arbitraire) : accepté tel quel (aucune limite de longueur en base) ; à vérifier à l'écran : la carte doit passer à la ligne
- **I-doublon-nom-projet** — Deux projets de même nom : on observe : 1er : accepté · 2e : accepté (les noms de projet peuvent se répéter)
- **I-coupure-reseau** — Coupure réseau pendant l'enregistrement : message d'erreur, rien d'écrit à moitié : rien écrit en base ; formulaire toujours ouvert (la saisie est conservée) ; message(s) affiché(s) : ["TypeError: Failed to fetch"]
- **I-concurrence** — Deux sessions modifient le même élément : on DÉCRIT ce qui se passe (pas de verdict) : Modifications PARTIELLES (champs différents) : les deux sont conservées = true. ATTENTION : la fiche de l'écran enregistre l'élément ENTIER (voir ItemDrawer.tsx, fonction d'enregistrement) : si deux personnes ouvrent la même fiche, la dernière à enregistrer écrase les champs de l'autre sans avertissement (« dernier gagnant »).
- **J-sauvegarde** — La sauvegarde contient l'équipe (colonne role) et les assignations : NON TESTÉ : générer une sauvegarde crée un fichier réel et la restaurer est destructif ; non exécuté volontairement. Vérifié par lecture du code seulement : BACKUP_TABLES contient cp_project_members et cp_item_members, et la sauvegarde lit select('*') donc la colonne role est incluse.


## S Préparation

| Point | Verdict | Détail |
|---|---|---|
| S-comptes — Les trois comptes existent, le module cp.projects est actif, seul le responsable écrit | OK |  |
| S-etats — Les 4 états de base sont lus | OK |  |
| S-propre — Aucun reste d'un test précédent (préfixe TEST-SCEN) | OK |  |

## A Vie d'un projet chantier

| Point | Verdict | Détail |
|---|---|---|
| A-creation — Projet de type Chantier relié à un chantier de Logistique | OK |  |
| A-un-projet-par-chantier — Un 2e projet sur le même chantier est refusé | OK |  |
| A-chantier-seulement-type-chantier — Un projet R&D ne peut pas être relié à un chantier | OK |  |
| A-etats — Le projet traverse les 4 familles d'état | OK |  |
| A-priorite — Priorité basse/moyenne/haute acceptée, autre valeur refusée | OK |  |
| A-dates — Dates : fin avant début refusée, mêmes dates acceptées, dates vides acceptées | OK |  |
| A-programme — Programme : rattacher, doublon de nom à la casse près refusé, supprimer garde le projet | OK |  |
| A-suppression-cascade — Supprimer un projet supprime ses éléments, son équipe, ses assignations, ses dépendances et sa liste à cocher | OK |  |

## B Équipe et assignations

| Point | Verdict | Détail |
|---|---|---|
| B-equipe-vide — Équipe vide : on ne peut assigner personne | OK |  |
| B-roles — Responsable + membre : rôles relus ; rôle inconnu et doublon refusés | OK |  |
| B-assigner — Assigner un responsable et un membre ; une personne hors équipe est refusée | OK |  |
| B-changer-role — Changer un rôle (membre → responsable → membre) ne désassigne personne | OK |  |
| B-modifier-projet — Modifier le projet (nom, dates) ne touche ni l'équipe ni les assignations | OK |  |
| B-quitter-equipe — Quitter l'équipe désassigne de CE projet seulement | OK |  |
| B-mes-taches-ecran — Écran « Mes tâches » : le collaborateur voit SA tâche (projet C) et pas celle du responsable ; la fiche est en lecture seule | OK |  |
| B-mes-taches-groupes — Groupes de « Mes tâches » : en retard / à faire / sans date / terminées | OK |  |

## C Éléments

| Point | Verdict | Détail |
|---|---|---|
| C-niveaux — Phase → tâche → sous-tâche et phase → jalon sont acceptés | OK |  |
| C-refus-hierarchie — Chaque règle de hiérarchie refuse avec SON message | OK |  |
| C-refus-valeurs — Valeurs refusées : jalon sur 2 jours, fin avant début, nom vide, type et priorité inconnus | OK |  |
| C-immuables — Le type et le projet d'un élément ne changent pas ; pas son propre parent | OK |  |
| C-deplacer — Déplacer une tâche sous une phase puis la remettre sous le projet | OK |  |
| C-etat-element — Changer l'état d'un élément | OK |  |
| C-liste-a-cocher — Liste à cocher : ajouter, cocher, supprimer | OK |  |
| C-supprimer-phase — Supprimer une phase supprime tout ce qu'elle contient (3 éléments : tâche, sous-tâche, jalon) mais pas le reste | OK |  |

## D Dépendances et décalages

| Point | Verdict | Détail |
|---|---|---|
| D-chevauchement — Mode par défaut : B qui chevauche A est décalé au lendemain de la fin de A, ramené au lundi, même durée | OK |  |
| D-chaine — Chaîne A → B → C : toute la chaîne suit quand A avance de 14 jours | OK |  |
| D-refus — Dépendances refusées avec la bonne raison : boucle, doublon, parent/enfant, autre projet | OK |  |
| D-supprimer-predecesseur — Supprimer une dépendance ne ramène pas le successeur en arrière | OK |  |
| D-sans-weekend-desactive — Réglage « éviter les week-ends » désactivé : B commence le samedi, lendemain de la fin de A | OK |  |
| D-mode-aucun — Mode « ne rien décaler » : la dépendance existe, B ne bouge jamais | OK |  |
| D-mode-intervalle — Mode « garder l'intervalle » : B suit A de +3 puis -2 jours, week-end compris | OK |  |
| D-decalage-bloc — Décaler une phase déplace toute sa descendance ; le jalon reste sur un jour ; un élément sans date reste sans date | OK |  |

## H Droits

| Point | Verdict | Détail |
|---|---|---|
| H-staff-lecture — staff lit projets, équipes, éléments, assignations et dépendances | OK |  |
| H-staff-ecriture — staff ne peut RIEN écrire (valeurs valides : si c'est refusé, c'est bien le droit) | OK |  |
| H-collab-lecture — collab lit projets, équipes, éléments, assignations et dépendances | OK |  |
| H-collab-ecriture — collab ne peut RIEN écrire (valeurs valides : si c'est refusé, c'est bien le droit) | OK |  |
| H-isolation-entreprise — Un compte d'une AUTRE entreprise ne voit ni n'écrit rien (si E2E_OTHER_ORG_USER est fourni) | NON TESTÉ | NON TESTÉ : pas de compte d'une autre entreprise (variable E2E_OTHER_ORG_USER). Couvert par les tests SQL (supabase/tests), pas par ce script. |

## I Cas limites

| Point | Verdict | Détail |
|---|---|---|
| I-noms-vides — Noms vides ou d'espaces refusés (projet, programme) | OK |  |
| I-caracteres — Accents, guillemets, apostrophes, emoji : relus à l'identique | OK |  |
| I-long-nom — Nom de 300 caractères : on observe ce que fait la base (pas de verdict arbitraire) | INFO | accepté tel quel (aucune limite de longueur en base) ; à vérifier à l'écran : la carte doit passer à la ligne |
| I-doublon-nom-projet — Deux projets de même nom : on observe | INFO | 1er : accepté · 2e : accepté (les noms de projet peuvent se répéter) |
| I-html — Un nom contenant du HTML s'affiche en texte brut et n'exécute rien | OK |  |
| I-perf-200 — 200 éléments dans un projet : le Gantt affiche le projet et reste utilisable | KO | création des 190 tâches : canceling statement due to statement timeout |
| I-double-clic — Double-clic sur « Enregistrer » : un seul projet est créé | OK |  |
| I-coupure-reseau — Coupure réseau pendant l'enregistrement : message d'erreur, rien d'écrit à moitié | INFO | rien écrit en base ; formulaire toujours ouvert (la saisie est conservée) ; message(s) affiché(s) : ["TypeError: Failed to fetch"] |
| I-rechargement — Rechargement de la page en plein formulaire : pas d'erreur JavaScript, la page revient | OK |  |
| I-mobile — Mobile 390 px : Projets, Mes tâches et Gantt sans défilement horizontal de la page | KO | page.waitForSelector: Timeout 30000ms exceeded. |
| I-sombre — Mode sombre : les écrans PILOTE s'ouvrent sans débordement ni erreur JavaScript | OK |  |
| I-langue-de — Langue de : « Mes tâches » et la fiche du projet sont traduits (on liste ce qui reste en français) | PARTIEL | restent en français dans la fiche : Responsable |
| I-langue-it — Langue it : « Mes tâches » et la fiche du projet sont traduits (on liste ce qui reste en français) | PARTIEL | restent en français dans la fiche : Responsable |
| I-langue-en — Langue en : « Mes tâches » et la fiche du projet sont traduits (on liste ce qui reste en français) | PARTIEL | restent en français dans la fiche : Responsable, Description |
| I-concurrence — Deux sessions modifient le même élément : on DÉCRIT ce qui se passe (pas de verdict) | INFO | Modifications PARTIELLES (champs différents) : les deux sont conservées = true. ATTENTION : la fiche de l'écran enregistre l'élément ENTIER (voir ItemDrawer.tsx, fonction d'enregistrement) : si deux p |

## J Sauvegarde

| Point | Verdict | Détail |
|---|---|---|
| J-sauvegarde — La sauvegarde contient l'équipe (colonne role) et les assignations | NON TESTÉ | NON TESTÉ : générer une sauvegarde crée un fichier réel et la restaurer est destructif ; non exécuté volontairement. Vérifié par lecture du code seulement : BACKUP_TABLES contient cp_project_members e |

## Nettoyage

| Point | Verdict | Détail |
|---|---|---|
| Z-restes — Aucun reste après nettoyage (vérifié par requête) | OK |  |

## Erreurs JavaScript

Aucune.
