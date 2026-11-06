# Rapport des scénarios PILOTE

Base : GO-MAT · comptes : test.responsable@example.com, test.magasinier@example.com, test.collaborateur@example.com · date : 2026-11-06 17:44
Commit testé : 2564f4db6fb71704391b896108559d0f93ed9c92

**Synthèse : 62 OK · 0 PARTIEL · 0 KO · 3 NON TESTÉ · 5 INFO**

Nettoyage : {"cp_projects":"21 supprimé(s)","sites":"2 supprimé(s)","restants":{"projets":0,"chantiers":0,"avis":0,"elements":0}}

## À corriger (KO et PARTIEL)

Aucun.

## Observations (INFO / NON TESTÉ)

- **A-documents** — Documents : l'équipe et les responsables déposent (jusqu'à 12 Mo), les autres lisent et téléchargent ; 51 Mo, exécutables et lecteurs refusés ; ligne supprimée = fichier illisible : les fichiers (note, 12 Mo) sont effacés du stockage par la fonction d'e-mails dans les 5 minutes qui suivent (corbeille) : non vérifié ici [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.6 Go]
- **H-isolation-entreprise** — Un compte d'une AUTRE entreprise ne voit ni n'écrit rien (si E2E_OTHER_ORG_USER est fourni) : NON TESTÉ : pas de compte d'une autre entreprise (variable E2E_OTHER_ORG_USER). Couvert par les tests SQL (supabase/tests), pas par ce script. [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.8 Go]
- **I-long-nom** — Nom de 300 caractères : on observe ce que fait la base (pas de verdict arbitraire) : accepté tel quel (aucune limite de longueur en base) ; à vérifier à l'écran : la carte doit passer à la ligne [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.8 Go]
- **I-doublon-nom-projet** — Deux projets de même nom : on observe : 1er : accepté · 2e : accepté (les noms de projet peuvent se répéter) [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.8 Go]
- **I-coupure-reseau** — Coupure réseau pendant l'enregistrement : message d'erreur, rien d'écrit à moitié : rien écrit en base ; formulaire toujours ouvert (la saisie est conservée) ; message(s) affiché(s) : ["TypeError: Failed to fetch"] [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go]
- **I-concurrence** — Deux sessions modifient le même élément : on DÉCRIT ce qui se passe (pas de verdict) : Modifications PARTIELLES (champs différents) : les deux sont conservées = true. NB : ceci décrit les écritures DIRECTES par l'API (dernier gagnant, champ par champ). L'ÉCRAN est protégé depuis la fiche versionnée (updateIfUnchanged) : une fiche modifiée entre-temps est refusée ; voir l'étape U5c-conflit de e2e-gantt. [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.1 Go]
- **N-rappels-quotidiens** — Rappels d'échéance (cp_due_soon / cp_overdue) : NON TESTÉ ici : le contrôle quotidien est réservé à la clé de service (la fonction Edge) ; il est couvert par les tests SQL (notifications_pilote.sql) et par un essai annulé sur la vraie base, pas par ce script. [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go]
- **J-sauvegarde** — La sauvegarde contient l'équipe (colonne role) et les assignations : NON TESTÉ : générer une sauvegarde crée un fichier réel et la restaurer est destructif ; non exécuté volontairement. Vérifié par lecture du code seulement : BACKUP_TABLES contient cp_project_members et cp_item_members, et la sauvegarde lit select('*') donc la colonne role est incluse. [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go]


## S Préparation

| Point | Verdict | Détail |
|---|---|---|
| S-comptes — Les trois comptes existent, le module cp.projects est actif, seul le responsable écrit | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.6 Go] |
| S-etats — Les 4 états de base sont lus | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| S-propre — Aucun reste d'un test précédent (préfixe TEST-SCEN) : les restes d'un passage arrêté sont supprimés d'abord | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |

## A Vie d'un projet chantier

| Point | Verdict | Détail |
|---|---|---|
| A-creation — Projet de type Chantier relié à un chantier de Logistique | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| A-un-projet-par-chantier — Un 2e projet sur le même chantier est refusé | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| A-chantier-seulement-type-chantier — Un projet R&D ne peut pas être relié à un chantier | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| A-etats — Le projet traverse les 4 familles d'état | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| A-priorite — Priorité basse/moyenne/haute acceptée, autre valeur refusée | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| A-dates — Dates : fin avant début refusée, mêmes dates acceptées, dates vides acceptées | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| A-programme-supprime — Le programme n'existe plus : ni table, ni colonne (migration 55) | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| A-dupliquer — Dupliquer un projet : arborescence, dates décalées, liste remise à zéro, dépendance, équipe ; assignations seulement sur demande ; aucun avis ; un lecteur ne copie pas | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| A-discussion — Discussion : l'équipe et les responsables écrivent, les autres lisent ; auteur imposé ; un seul avis regroupé pour l'équipe, jamais pour l'auteur ; chacun supprime les siens | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.8 Go] |
| A-documents — Documents : l'équipe et les responsables déposent (jusqu'à 12 Mo), les autres lisent et téléchargent ; 51 Mo, exécutables et lecteurs refusés ; ligne supprimée = fichier illisible | INFO | les fichiers (note, 12 Mo) sont effacés du stockage par la fonction d'e-mails dans les 5 minutes qui suivent (corbeille) : non vérifié ici [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83 |
| A-quota — Quota de stockage (migration 62) : l'espace utilisé grandit exactement de la taille d'un dépôt et revient après son effacement ; un administrateur d'entreprise ne peut pas modifier la limite | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| A-suppression-cascade — Supprimer un projet supprime ses éléments, son équipe, ses assignations, ses dépendances et sa liste à cocher | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |

## B Équipe et assignations

| Point | Verdict | Détail |
|---|---|---|
| B-equipe-vide — Équipe vide : on ne peut assigner personne | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| B-roles — Responsable + membre : rôles relus ; rôle inconnu et doublon refusés | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| B-assigner — Assigner un responsable et un membre ; une personne hors équipe est refusée | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| B-changer-role — Changer un rôle (membre → responsable → membre) ne désassigne personne | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| B-modifier-projet — Modifier le projet (nom, dates) ne touche ni l'équipe ni les assignations | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| B-quitter-equipe — Quitter l'équipe désassigne de CE projet seulement | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.8 Go] |
| B-mes-taches-ecran — Écran « Mes tâches » : le collaborateur voit SA tâche (projet C) et pas celle du responsable ; la fiche est en lecture seule | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go] |
| B-mes-taches-groupes — Groupes de « Mes tâches » : en retard / à faire / sans date / terminées | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.6 Go] |

## C Éléments

| Point | Verdict | Détail |
|---|---|---|
| C-niveaux — Phase → tâche → sous-tâche et phase → jalon sont acceptés | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.6 Go] |
| C-refus-hierarchie — Chaque règle de hiérarchie refuse avec SON message | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.6 Go] |
| C-refus-valeurs — Valeurs refusées : jalon sur 2 jours, fin avant début, nom vide, type et priorité inconnus | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.6 Go] |
| C-immuables — Le type et le projet d'un élément ne changent pas ; pas son propre parent | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.6 Go] |
| C-deplacer — Déplacer une tâche sous une phase puis la remettre sous le projet | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.6 Go] |
| C-etat-element — Changer l'état d'un élément | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.6 Go] |
| C-liste-a-cocher — Liste à cocher : ajouter, cocher, supprimer | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.6 Go] |
| C-supprimer-phase — Supprimer une phase supprime tout ce qu'elle contient (3 éléments : tâche, sous-tâche, jalon) mais pas le reste | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.6 Go] |

## D Dépendances et décalages

| Point | Verdict | Détail |
|---|---|---|
| D-chevauchement — Mode par défaut : B qui chevauche A est décalé au lendemain de la fin de A, ramené au lundi, même durée | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| D-chaine — Chaîne A → B → C : toute la chaîne suit quand A avance de 14 jours | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| D-refus — Dépendances refusées avec la bonne raison : boucle, doublon, parent/enfant, autre projet | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| D-supprimer-predecesseur — Supprimer une dépendance ne ramène pas le successeur en arrière | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| D-sans-weekend-desactive — Réglage « éviter les week-ends » désactivé : B commence le samedi, lendemain de la fin de A | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| D-mode-aucun — Mode « ne rien décaler » : la dépendance existe, B ne bouge jamais | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| D-mode-intervalle — Mode « garder l'intervalle » : B suit A de +3 puis -2 jours, week-end compris | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| D-decalage-bloc — Décaler une phase déplace toute sa descendance ; le jalon reste sur un jour ; un élément sans date reste sans date | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |

## H Droits

| Point | Verdict | Détail |
|---|---|---|
| H-staff-lecture — staff lit projets, équipes, éléments, assignations et dépendances | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| H-staff-ecriture — staff ne peut RIEN écrire (valeurs valides : si c'est refusé, c'est bien le droit) | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| H-collab-lecture — collab lit projets, équipes, éléments, assignations et dépendances | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| H-collab-ecriture — collab ne peut RIEN écrire (valeurs valides : si c'est refusé, c'est bien le droit) | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.8 Go] |
| H-isolation-entreprise — Un compte d'une AUTRE entreprise ne voit ni n'écrit rien (si E2E_OTHER_ORG_USER est fourni) | NON TESTÉ | NON TESTÉ : pas de compte d'une autre entreprise (variable E2E_OTHER_ORG_USER). Couvert par les tests SQL (supabase/tests), pas par ce script. [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libr |

## I Cas limites

| Point | Verdict | Détail |
|---|---|---|
| I-noms-vides — Noms vides ou d'espaces refusés (projet) | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.8 Go] |
| I-caracteres — Accents, guillemets, apostrophes, emoji : relus à l'identique | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.8 Go] |
| I-long-nom — Nom de 300 caractères : on observe ce que fait la base (pas de verdict arbitraire) | INFO | accepté tel quel (aucune limite de longueur en base) ; à vérifier à l'écran : la carte doit passer à la ligne [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.8 Go] |
| I-doublon-nom-projet — Deux projets de même nom : on observe | INFO | 1er : accepté · 2e : accepté (les noms de projet peuvent se répéter) [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.8 Go] |
| I-html — Un nom contenant du HTML s'affiche en texte brut et n'exécute rien | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.6 Go] |
| I-perf-200 — 200 éléments dans un projet : le Gantt affiche le projet et reste utilisable | OK | replié : 1353 ms, 22 lignes · déplié : 163 ms, 253 lignes [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.6 Go] |
| I-double-clic — Double-clic sur « Enregistrer » : un seul projet est créé | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go] |
| I-coupure-reseau — Coupure réseau pendant l'enregistrement : message d'erreur, rien d'écrit à moitié | INFO | rien écrit en base ; formulaire toujours ouvert (la saisie est conservée) ; message(s) affiché(s) : ["TypeError: Failed to fetch"] [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.7 Go] |
| I-rechargement — Rechargement de la page en plein formulaire : pas d'erreur JavaScript, la page revient | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go] |
| I-mobile — Mobile 390 px : Projets, Mes tâches et Gantt sans défilement horizontal de la page | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go] |
| I-sombre — Mode sombre : les écrans PILOTE s'ouvrent sans débordement ni erreur JavaScript | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go] |
| I-langue-de — Langue de : « Mes tâches » et la fiche du projet sont traduits (textes attendus lus dans src/i18n/de.json) | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go] |
| I-langue-it — Langue it : « Mes tâches » et la fiche du projet sont traduits (textes attendus lus dans src/i18n/it.json) | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go] |
| I-langue-en — Langue en : « Mes tâches » et la fiche du projet sont traduits (textes attendus lus dans src/i18n/en.json) | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.4 Go] |
| I-concurrence — Deux sessions modifient le même élément : on DÉCRIT ce qui se passe (pas de verdict) | INFO | Modifications PARTIELLES (champs différents) : les deux sont conservées = true. NB : ceci décrit les écritures DIRECTES par l'API (dernier gagnant, champ par champ). L'ÉCRAN est protégé depuis la fich |

## N Notifications

| Point | Verdict | Détail |
|---|---|---|
| N-equipe-assignation — Ajouter le collaborateur à l'équipe puis lui assigner une tâche : il reçoit 2 avis précis, le responsable (auteur) aucun | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.4 Go] |
| N-dates-regroupees — Décaler une tâche assignée : avis « dates modifiées » ; un 2e décalage rapproché est regroupé (toujours un seul avis) | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go] |
| N-ecran-notifications — Écran « Notifications » du collaborateur : famille PILOTE, avis lisibles, un clic sur l'avis d'assignation ouvre la FICHE de la tâche (migration 61) | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.6 Go] |
| N-lien-message — Un message écrit par le responsable sur la tâche : le collaborateur reçoit un avis ; son clic ouvre la fiche AVEC la discussion visible (même si la section était repliée) | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go] |
| N-lien-disparu — Lien vers un élément qui n'existe pas (ou plus) : un message clair, aucune fiche vide | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go] |
| N-choix-ecran — Choix par personne à l'écran : un type d'avis par ligne (6 depuis la migration 58) × 3 canaux, une case cochée est enregistrée en base | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go] |
| N-choix-respecte — « Dans l'application » décoché : une nouvelle assignation ne produit AUCUN avis ; recoché, elle en produit un | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go] |
| N-droits — Droits : les choix d'un autre sont illisibles ; les rappels quotidiens ne se lancent pas à la main | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go] |
| N-rappels-quotidiens — Rappels d'échéance (cp_due_soon / cp_overdue) | NON TESTÉ | NON TESTÉ ici : le contrôle quotidien est réservé à la clé de service (la fonction Edge) ; il est couvert par les tests SQL (notifications_pilote.sql) et par un essai annulé sur la vraie base, pas par |

## J Sauvegarde

| Point | Verdict | Détail |
|---|---|---|
| J-sauvegarde — La sauvegarde contient l'équipe (colonne role) et les assignations | NON TESTÉ | NON TESTÉ : générer une sauvegarde crée un fichier réel et la restaurer est destructif ; non exécuté volontairement. Vérifié par lecture du code seulement : BACKUP_TABLES contient cp_project_members e |

## Nettoyage

| Point | Verdict | Détail |
|---|---|---|
| Z-restes — Aucun reste après nettoyage (vérifié par requête) | OK |  [mémoire : resp 51 Mo · staff 54 Mo · collab 54 Mo · libre 83.5 Go] |

## Erreurs JavaScript

Aucune.
