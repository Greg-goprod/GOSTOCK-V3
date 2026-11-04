# Planification PILOTE — ce qu'on retient de Notion (fonctionnel + Gantt)

Écrit le 2 novembre 2026, d'après les 3 captures de Greg (base « Projets » de Notion) et quelques lectures publiques.
Le connecteur Notion n'a pas pu être ouvert dans cette session : rien n'a été vérifié dans un vrai espace Notion.
Aucun code n'est écrit. Ce document sert à décider avant R2/R3.

## 1. Ce que montrent les captures (fonctions, pas décor)

| # | Fonction vue dans Notion | Ce qu'elle apporte |
|---|---|---|
| a | **Une même liste de projets, plusieurs vues** : Par état (colonnes), Tous les projets (liste), Gantt, Mes projets (filtrée sur moi) | On ne saisit qu'une fois ; on regarde selon le besoin |
| b | Barre de commandes : filtrer, trier, regrouper, chercher, bouton « Nouveau » | Se retrouver dans 200 lignes |
| c | **Gantt regroupé par état**, groupes repliables avec compteur (« Pas commencé 2 ») | Lecture immédiate de ce qui bouge |
| d | Colonne de noms à gauche, barres à droite, ligne « aujourd'hui », week-ends grisés, zoom (« Mois »), « Aujourd'hui », flèches précédent/suivant | Lecture type diagramme de Gantt |
| e | **« Sans date » + « Gérer dans le calendrier »** (« Aucune date (1) ») : les éléments sans date restent visibles et se posent d'un clic | Rien ne disparaît parce qu'on a oublié une date |
| f | Création directe dans la liste (« + Nouveau », ligne vide) | Saisie rapide |
| g | **Fiche en volet latéral** : état, personne assignée, priorité, date de fin, commentaires, « À propos », **liste de tâches à cocher**, documents | On édite sans quitter le Gantt |
| h | **Sous-éléments** (« montage infras phase 2 » sous « MONTAGE INFRAS ») | Hiérarchie projet → phase → tâche |
| i | **Dépendances** : flèche entre deux barres | Voir ce qui bloque quoi |
| j | Réglage des dépendances : décaler **seulement si chevauchement** / **en gardant l'écart** / **pas de décalage** ; **éviter les week-ends** ; décaler selon la date de début ; séparer début et fin | Replanifier en cascade sans tout refaire à la main |
| k | Avancement : % de tâches terminées remonté sur le projet (calcul sur les tâches liées) | Chiffre d'avancement sans saisie |

Sources lues : [intro Notion à la vue Timeline](https://www.notion.com/de/help/guides/intro-to-timeline-view), [sous-éléments et dépendances](https://www.simonesmerilli.com/business/notion-sub-items), [relations et rollups](https://uno.notion.vip/the-power-of-relations-and-rollups/). Les sources divergent sur les niveaux de zoom exacts ; on ne s'y fie pas.

## 2. Ce que je propose de reprendre, et comment ça s'emboîte avec ce qu'on a

**Principe** : Notion = une base « Projets » + une base « Tâches » reliées. Chez nous : un **projet** (R2) et des **éléments de planning** (R3) rattachés à un projet, avec parent (phase → tâche), type (phase / tâche / jalon), état, priorité, responsable, début, fin, description, liste à cocher. La frise horaire du chantier (zones, équipes, interventions) **reste** : c'est le plan fin, à l'heure près, d'un projet de type chantier. Le Gantt, lui, est le plan large (jours à années).

### À reprendre dès R3 (cœur)
1. **Cinq vues sur les mêmes données** : Gantt, Par état, Liste, Calendrier, Mes éléments. Vues fixes (pas de « vues sur mesure » au début) ; filtre, tri et regroupement choisis à la volée.
2. **Gantt épuré à la Notion** : liste à gauche (repliable), barres à droite, regroupement (état, responsable, type de projet), groupes repliables avec compteur, ligne « aujourd'hui », jours non travaillés grisés, zoom Semaine / Mois / Trimestre / Année, glisser pour déplacer, tirer les bords pour changer la durée, création directe « + Nouveau ».
3. **Plateau « Sans date »** (équivalent de « Gérer dans le calendrier »).
4. **Fiche en volet latéral** avec liste à cocher, commentaires simples, description. Responsable choisi parmi les personnes existantes de l'entreprise.
5. **Sous-éléments** (3 niveaux maximum : projet → phase → tâche ; jalon = élément sans durée).
6. **Avancement calculé** : % de tâches terminées remonté sur la phase puis le projet.
7. **Jours non travaillés = calendrier de l'entreprise** (week-ends, jours fériés par canton, jours bloqués). Notre « jours bloqués » du chantier devient un calendrier plus général : c'est notre version de « éviter les week-ends », en mieux.

### À reprendre un cran plus tard (R3 bis)
8. **Dépendances** (« B commence après la fin de A ») avec flèche, contrôle de cycle côté base, et les trois modes de décalage de Notion (si chevauchement / en gardant l'écart / aucun). Le décalage en cascade doit être fait **dans la base**, en une opération atomique, sinon deux personnes qui déplacent en même temps se contredisent.
9. Rappels d'échéance via les notifications existantes.

### À NE PAS reprendre (volontairement)
Propriétés personnalisées, formules, pages libres, intégrations Drive / Figma / PDF, automatisations, IA, partage par lien public. C'est ce qui ferait de PILOTE un deuxième Notion ; on garde seulement la planification.

## 3. Écarts avec le cahier des charges v2
- Le cahier parle de planning **de chantier** ; ici on ajoute le plan **généraliste** (R&D, conception, recrutement…) comme Greg l'a demandé. Déjà acté dans la relecture (§7).
- Notion n'a pas de notion de ressource ; nous si : une intervention de chantier réserve matériel, équipe et zone. Les éléments du Gantt, eux, n'engagent que des personnes responsables (pas de contrôle de conflit de matériel au niveau Gantt).

## 4. Réalisation du Gantt (honnêteté technique)
Notre frise actuelle est faite pour des heures dans une journée. Le Gantt demande une **nouvelle échelle en jours** : je réutilise les maths de temps existantes quand c'est possible mais le composant est nouveau, avec son propre test. Rendu visé : sobre, mêmes tokens et composants Mx que le reste.

## 5. Décisions de Greg (2 novembre)
1. **Profondeur** : **5 niveaux validés** — Programme → Projet → Phase → Tâche (ou jalon) → Sous-tâche. Tous facultatifs sauf le projet (on peut sauter un niveau). Le Gantt s'ouvre sur 2 niveaux et se déplie. Le programme est une table à part (regroupe des projets, sans dates ni état propres) ; les niveaux 3 à 5 sont une seule table d'éléments avec parent et type, la base refusant un 6ᵉ niveau et les parentés absurdes. Les mini-étapes sans date ni responsable restent en liste à cocher. Noms des niveaux modifiables dans les Paramètres : proposé, à confirmer (libellés seulement).
2. **États** : 4 états de base fixes (Pas commencé / En cours / Terminé / Annulé) **et** possibilité d'en ajouter dans les Paramètres. Un état ajouté se range dans l'une des 4 familles (comme les groupes de Notion), pour que l'avancement et les filtres restent calculables.
3. **Dépendances** : juste après le Gantt.
4. **Responsables** : **plusieurs** personnes par élément (table de liaison élément ↔ personne).

---

## Analyse de la création d'un projet dans Notion (complément du 2026-11-04) et plan mis à jour

Sources : `RAPPORT-ANALYSE-GANTT-NOTION.md` et `RAPPORT-CREATION-PROJET.md` (captures S01 à S46), faits par Claude dans Chrome.

### Ce qu'on retient
1. **Création en un geste** : « Nouveau » ouvre tout de suite la fiche en panneau latéral, titre sélectionné (on tape le nom), propriétés épinglées sous le titre (État déjà « Pas commencé », personne assignée, priorité, date), le reste sous « Afficher les détails ».
2. **Une fiche = des sections** : propriétés, « À propos » (notre description), « Tâches à accomplir » (notre liste à cocher), « Documents », commentaires/discussion. C'est là que viennent se brancher le chat et les documents demandés par Greg.
3. **États groupés en 3 familles fixes** (À faire / En cours / Terminé), options libres dans chaque famille, une couleur parmi 10, une option « par défaut » ; la couleur de l'état colore la ligne et la barre du Gantt. Notre modèle (4 familles, états ajoutables) est le même principe.
4. **Créer depuis le contexte** : « + Nouveau » en bas d'un groupe (état prérempli), barre fantôme sur la frise (dates préremplies), menu « Aucune date ».
5. **Modèles de projet** : valeurs préremplies + corps de page, option « Vide », répétition possible.
6. **Mise en page configurable** (propriétés épinglées, onglets), menu « … » de la page (dupliquer, copier le lien, historique, verrouiller, supprimer).

### Défauts relevés chez Notion (à ne pas copier)
- Date de fin épinglée mais date de début cachée : on crée des projets sans début, absents du Gantt (→ chez nous un seul sélecteur de plage, déjà en place).
- Aucun champ obligatoire et création immédiate : des projets vides s'accumulent (→ chez nous le nom est obligatoire et on enregistre explicitement).
- « Progrès » mal calculé (départ ÷ finale, sans plafond) ; budget en dollars ; options génériques ; langue mélangée (« Done »).
- Les tâches sont de simples cases à cocher, sans lien avec le Gantt (→ chez nous de vraies tâches avec dépendances, et l'avancement se calcule tout seul).

### Plan (mis à jour)
UI-1 barre d'outils du Gantt, UI-2 fiche d'élément : faits.
UI-3 frise (barre fantôme, titre débordant, flèches hors zone, table masquable, plage éclairée au survol).
UI-4 création rapide : « Nouveau » → fiche latérale, titre en focus, propriétés épinglées, formulaire projet allégé ; création depuis un groupe (état prérempli), depuis la frise (dates), depuis « Sans date ».
UI-5 états : choix groupé par famille avec pastilles de couleur, palette de 10, option par défaut, couleur des barres par état.
UI-6 une seule page « Projets » à onglets (Gantt / Liste / Cartes / Mes tâches), réglages (états, filtres) derrière une icône.
UI-7 fiche en sections : Description, Liste à cocher, Discussion (chat), Documents (mini-dropbox) — le chat et les documents deviennent des sections de la fiche (projet et élément).
UI-8 « Dupliquer un projet » (avec décalage des dates) comme premier modèle, répétition annuelle plus tard ; lien direct vers un élément (`?item=`), menu « … » de la fiche (dupliquer, copier le lien, supprimer), navigation ↑ ↓ entre éléments.
Non retenu : mise en page configurable, catalogue de types de propriété, formules, automatisations, IA, création immédiate d'un brouillon.
