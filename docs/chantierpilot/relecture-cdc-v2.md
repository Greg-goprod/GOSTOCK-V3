# ChantierPilot : relecture du cahier des charges v2 et plan révisé

Statut : **document de cadrage, aucun code**. Il répond à la demande du 2 novembre 2026 : relire le cahier des charges v2, constater l'écart avec ce qui est construit, et intégrer deux exigences nouvelles de Greg :

1. le planning ne sert pas qu'aux chantiers : il faut aussi planifier **à l'année** des phases de R&D, des échéances, de la conception, de l'élaboration, des plans, du recrutement, etc. ;
2. **PILOTE ne doit pas être dans « Chantiers »** : tout ce qui existe aujourd'hui passe sous une icône **Logistique** (qui déroule Accueil, Magasin, Matériel…), et **PILOTE** devient une seconde icône qui déroule les futures rubriques du module.

Le fichier original du cahier des charges n'est pas dans le dépôt (il faut le rajouter : `docs/chantierpilot/cahier-des-charges-v2.md`, à committer depuis le poste de Greg, pour pouvoir le joindre aux futures sessions comme le prévoit la section 34).

---

## 1. Ce que dit le cahier des charges, en bref

Un outil où **le planning est la source de vérité** : chaque affectation génère automatiquement les besoins de repas et de chambres, les documents à fournir, les bons QR, puis la facturation (entreprise → prestataires / ouvriers). 13 rôles (dont 4 externes : prestataire, chef d'équipe prestataire, traiteur, ouvrier), 13 modules (A à M), 16 décisions validées (D1 à D16), 7 lots de livraison, un modèle de données d'environ 60 tables, des machines à états, des algorithmes (besoins, bons, scan, payeur, prix, clôture) et des prompts de livraison.

Ce qu'il impose en méthode : audit avant tout code, réutilisation de l'existant, charte graphique inchangée, préfixe `cp_`, un module activable par entreprise, isolation stricte des externes testée, livraison par lots.

## 2. Ce qui est déjà en place chez nous (réutilisé, rien à refaire)

| Exigence du cahier des charges | État dans GO-Mat |
|---|---|
| Multi-entreprise, `organization_id` partout, isolation | Fait, prouvé par 6 batteries SQL (isolation, cycle, notifications, droits, planning, console) |
| Un module activable par entreprise (flags) | Fait : `platform_modules` / `organization_modules`, console de la plateforme, `module:` dans l'accès |
| Droits fins par module (`module.page:action`) | Fait : `rbac_roles`, `rbac_role_permissions`, `rbac_has_any_permission` |
| Journal d'audit | Fait (`audit_log` par entreprise, `admin_audit_log` pour la plateforme) |
| i18n | Fait en FR, DE, IT, EN (pas PT ni ES : voir § 4.5) |
| Charte graphique, composants, drawers, pickers, cartes/liste | Fait (charte MX) |
| Notifications (in-app, e-mail, push, SMS), état lu par personne | Fait |
| Sauvegarde / restauration par entreprise | Fait, étendue au planning |
| QR codes, badges, scan, comptoir hors-ligne | Existent pour le matériel (pas encore pour des bons de repas) |
| Exports comptables (Bexio, Abacus), PDF | Existent pour le matériel |
| Aide intégrée, tests e2e par un Claude local | Fait |

## 3. Où en est le module PILOTE par rapport aux modules A à M

| Module du cahier | État | Détail |
|---|---|---|
| A. Chantiers | **Partiel** | Le chantier de GO-Mat (`sites` : budget, matériel, clôture, carte) existe ; zones, phases, réglages (heures, 24 h/24, pas, jours bloqués) ajoutés. **Manque** : lots (corps de métier), pages riches, membres et rôles du chantier, statuts de phase (DRAFT → ARCHIVED), fuseau par chantier, jours fériés cantonaux, vues Kanban / galerie / timeline génériques |
| B. Planning et affectations | **Partiel, et d'une autre nature** | Nous avons des **interventions** (équipe × zone × créneau) avec frise glisser-déposer, séries, copie d'un jour, matériel nécessaire. Le cahier décrit des **tâches** (dépendances, avancement, effectif requis) et des **affectations** de personnes (statuts, demandes de modification, historique). **Manque** : tout cela, plus Gantt, chemin critique, vue multi-chantiers, « Mon planning », import / export CSV / iCal / PDF, cascade vers repas et nuitées |
| C. Personnel interne | **Peu** | Fiches `users`, formations avec échéance, EPI existent ; **manque** : absences et congés, régimes / allergies chiffrés, disponibilités, équipes de personnes, import CSV |
| D. Prestataires et portail | **Minimal** | Une table `contractors` (nom, contact). **Manque** : conformité (documents et échéances), onboarding, statuts, UID / TVA, portail externe |
| E. Pointage | Rien | |
| F. Hébergement | Rien | |
| G, H, I. Repas, bons, cuisine, traiteur | Rien | (les briques QR / scan existent) |
| J, K. Prise en charge, facturation | Rien | (exports comptables existants) |
| L. Communication, documents | Notifications seulement | Pas de fils de discussion, consignes à acquitter, documents versionnés |
| M. Tableaux de bord | Rien pour PILOTE | |
| Vues « à la Notion » | Très partiel | Bascule cartes / liste et filtres propres à chaque page ; pas de vues enregistrées, Kanban, timeline ni calendrier génériques |

En clair : nous avons posé le **socle technique** (multi-entreprise, droits, modules, aide, tests) et une **première version du planning de terrain**. Les modules métier C à M sont à construire, et le planning doit être élargi.

## 4. Écarts et points à trancher (relecture critique)

### 4.1 Le périmètre du planning (nouvelle exigence)
Le cahier est centré sur le **chantier** : presque toutes les tables portent un `site_id` obligatoire (`Task`, `Assignment`, `Milestone`…), et le **Gantt est classé « V2 »**. Or Greg veut planifier à l'année des activités qui ne sont pas des chantiers (R&D, conception, élaboration, plans, recrutement, échéances). Conséquences :
- il faut un objet **parent plus général que le chantier** : un *projet* (ou *dossier*) de **type** chantier, R&D, conception, recrutement, administratif, évènement… ;
- le **Gantt / frise annuelle avec phases, jalons et dépendances** devient prioritaire, pas V2 ;
- seul le type « chantier » porte la logistique détaillée (zones, équipes, interventions, repas, hébergement, bons, facturation) ;
- « recrutement » est ici une **activité planifiée** (dates, responsable), pas un suivi de candidatures : à confirmer.

### 4.2 Navigation : Logistique et PILOTE (nouvelle exigence)
Deux espaces de premier niveau dans le rail : **Logistique** (aujourd'hui Accueil, Magasin, Matériel, Consommables, Véhicules, Chantiers, Personnes, Pilotage) et **PILOTE** (nouvelles rubriques, apparaissant selon les modules activés pour l'entreprise). Points d'attention :
- **collision de nom** : GO-Mat a déjà un espace « Pilotage » (statistiques, coûts, comptabilité, journal). À côté d'une icône « PILOTE » c'est source de confusion : à renommer (« Gestion », « Suivi »…) ;
- **Réglages, Aide et la console de la plateforme** ne sont pas propres à un produit : ils restent communs (en bas du rail) ;
- **URLs** : garder celles de Logistique telles quelles (aucune page, aucun lien, aucun test e2e ne casse) et mettre PILOTE sous `/pilote/…`. La séparation est alors purement une affaire de navigation ;
- la page « Planning chantier » que j'ai placée sous Chantiers **sort de Chantiers** et devient une rubrique de PILOTE ;
- cela rejoint la logique commerciale déjà actée : Logistique et PILOTE sont deux produits (modules payants) d'un même socle.

### 4.3 Nommage, préfixes et clés de modules
- Le cahier demande le préfixe **`cp_`**. Nos tables de planning s'appellent `site_zones`, `site_teams`, `site_interventions`, `contractors`… : à **renommer maintenant** (il n'y a que des données de test, le coût est quasi nul ; plus tard il ne le sera plus).
- Les clés de modules du cahier (`cp.sites`, `cp.planning`, `cp.workers`, `cp.subcontractors`, `cp.timesheets`, `cp.lodging`, `cp.meals`, `cp.vouchers`, `cp.caterers`, `cp.invoicing`) diffèrent des nôtres (`chantiers_planning`, `personnes_externes`, `portails`…) : à aligner.
- À la fusion avec Mannyx, `organization_id` devient `company_id` (renommage mécanique) et PILOTE viendrait dans un schéma séparé.

### 4.4 La pile technique du cahier n'est pas la nôtre
Le cahier cite Next.js, Prisma, BullMQ, Zod. Nous sommes en **React + Vite + Supabase (Postgres, RLS, fonctions de bord, pg_cron)**. Le cahier prévoit lui-même de s'aligner sur l'existant. Équivalences proposées : Prisma → migrations SQL et RPC ; files d'attente → pg_cron + fonctions de bord ; API `/api/cp/...` → tables protégées par RLS + fonctions RPC ; PDF et QR → briques existantes. Chaque écart important donnera une ADR.

### 4.5 Langues : le cahier contredit une décision de Greg
Cahier D9 : FR, EN, DE, IT, **PT, ES**. Décision de Greg du 1er novembre : « FR, DE, IT, EN. **Pas de PT/ES.** » À trancher (le coût est une traduction de plus par langue sur tous les portails externes).

### 4.6 Hébergement des données (D16 : Suisse par défaut)
Les projets Supabase actuels sont **GO-MAT en eu-west-1 (Irlande)** et **Mannyx en eu-north-1 (Stockholm)**. Un projet GO-STATICK est déjà en **eu-central-2 (Zurich)**, donc la région suisse existe chez Supabase. Avant de stocker des allergies (données de santé, module 5) et de fusionner, il faut décider de la **région cible** : un changement de région impose de recréer le projet et de copier les données.

### 4.7 Fuseau horaire
Le cahier prévoit un fuseau **par chantier** (`Site.timezone`, heures limites en heure locale du chantier). Nos contrôles de base et notre affichage utilisent la constante `Europe/Zurich`. Suffisant pour la Suisse, à corriger si un chantier est hors Suisse.

### 4.8 Conflits : bloquants « forçables »
Cahier 8.4 : un double engagement est **bloquant mais forçable par le conducteur avec motif**. Chez nous le chevauchement d'une équipe est un **refus dur**. À prévoir : un forçage tracé (motif, auteur) pour les rôles autorisés.

### 4.9 Incohérences relevées dans le cahier lui-même
- `23.2` utilise `arrive_day_before`, absent du modèle `Assignment` (section 21).
- La matrice 5.2 fusionne `CATERER_ADMIN` et `CATERER_STAFF` en une colonne « CATERER ».
- Le Gantt est « V2 » (section 31) alors que la section 8.3 le liste comme vue de planning n°1.
- `TEAM` accepte des scans partiels, mais l'unicité « un scan par bon » est décrite pour le seul mode nominatif : l'idempotence par `scan_request_id` doit couvrir les deux.
- Les seuils légaux (repos 11 h, 50 h par semaine) sont à valider selon la convention collective applicable au chantier.
- La TVA (D12) est à faire confirmer par la fiduciaire **avant le lot 5**, comme le cahier le dit lui-même.

### 4.10 Comptes externes (prestataires, traiteurs, ouvriers)
- Le cahier veut des utilisateurs du SaaS avec un `user_type` et des **adhésions limitées à un périmètre** (chantier, prestataire, équipe). Notre modèle est : un compte, une fiche par entreprise, des rôles par entreprise. Il manque les **adhésions par périmètre** (chez Mannyx aussi).
- Notre connexion exige aujourd'hui une fiche dans une entreprise active. Les ouvriers **sans e-mail** (code PIN, lien SMS, profil géré par le chef d'équipe) demandent une connexion spécifique : fonction de bord dédiée.
- Les portails externes ne doivent jamais lire les tables directement : **fonctions RPC et vues restreintes** seulement. Notre expérience du module 0 (règles de sécurité évaluées ligne par ligne = 1,4 s pour 161 lignes) impose de les écrire dès le départ avec des vérifications calculées une fois par requête.

### 4.11 Vues « à la Notion »
Le moteur de vues générique (Tableau, Kanban, Calendrier, Timeline, Galerie, filtres enregistrés, édition en ligne, ⌘K) est un gros composant. Proposition : l'introduire **progressivement**, en commençant par ce qui sert le planning annuel (frise / Gantt, liste, Kanban, calendrier), plutôt qu'un moteur complet d'emblée.

### 4.12 Volume du cahier
7 lots, plus de 60 tables, facturation légale (QR-facture, numérotation sans trou, avoirs), allergies chiffrées, mode hors-ligne, portails en 6 langues : c'est un programme de plusieurs mois. Il faut **ordonner** : l'ordre du cahier (lots 0 à 6) ne correspond ni à ce que nous avons fait (planning d'abord) ni à la nouvelle priorité (planning annuel).

## 5. Architecture cible proposée

**Hiérarchie** : Organisation → **Plan annuel** (vue sur une année) → **Projets** (type : chantier, R&D, conception, recrutement, administratif, évènement…) → **Phases** → **Tâches, jalons, échéances** (dépendances, responsable, avancement). Un projet de type **chantier** ajoute la couche terrain : zones, équipes, prestataires, interventions, matériel (ce que nous avons déjà), puis plus tard repas, hébergement, bons, facturation.

**Lien avec Logistique** : un projet de type chantier peut être relié (facultatif) à un chantier de Logistique (`sites`) pour le matériel, le budget et la carte. Un seul sens de dépendance : PILOTE peut lire Logistique, jamais l'inverse.

**Navigation** (rail) :
- haut : **Logistique** (déroule Accueil, Magasin, Matériel, Consommables, Véhicules, Chantiers, Personnes, + « Pilotage » renommé) ;
- puis **PILOTE** (déroule : Plan annuel, Projets, Planning, puis Personnes externes, Prestataires, Repas, Hébergement, Facturation… selon les modules activés) ;
- bas, communs : **Réglages**, **Aide**, et pour le propriétaire de la plateforme, la **console**.
- L'icône PILOTE n'apparaît que si au moins un module PILOTE est activé pour l'entreprise.

## 6. Plan révisé (une étape à la fois, comme convenu)

| Étape | Contenu | Remarque |
|---|---|---|
| R0 | Réponses aux questions du § 7 ; le fichier du cahier ajouté au dépôt | Rien n'est construit avant |
| R1 | **Navigation Logistique / PILOTE** : regroupement du rail, renommage de « Pilotage », la page planning actuelle déménage sous PILOTE (`/pilote/…`) ; aucune donnée ni URL de Logistique ne change | Petite, visible, réversible |
| R2 | **Fondation PILOTE** : renommage des tables en `cp_`, alignement des clés de modules sur les flags du cahier, objet *projet* généraliste relié au chantier | Migration (je te la donne à coller) ; données de test seulement |
| R3 | **Planning annuel** : plan annuel, phases, tâches, jalons, échéances, dépendances, avancement ; frise annuelle / Gantt (en réutilisant la frise existante), liste, Kanban, calendrier | Le cœur de la nouvelle demande |
| R4 | Personnes, prestataires et conformité, comptes externes à périmètre (cahier lot 1) | Les conflits d'habilitation et la vérification des formations deviennent possibles |
| R5 et suivants | Affectations et cascade besoins (lot 2), repas / bons / scan (lot 3), hébergement (lot 4), prise en charge et facturation (lot 5, après avis fiduciaire), tableaux de bord et pointage (lot 6) | Dans l'ordre que tu fixeras |

## 7. Questions à trancher (recommandation en premier)

1. **Projet généraliste** : un seul objet *projet* de type chantier / R&D / conception / recrutement… (**recommandé**), ou un outil de planification annuelle séparé à côté du planning de chantier ?
2. **Lien chantier** : un projet de type chantier est relié (facultatif) à un chantier de Logistique, PILOTE possédant son propre planning (**recommandé**), ou les deux sont un seul et même objet ?
3. **« Recrutement »** : une activité planifiée (dates, responsable) (**recommandé**), ou un vrai suivi de candidatures ?
4. **Nom de l'espace « Pilotage »** de Logistique : à renommer en quoi (« Suivi », « Gestion », autre) ?
5. **Réglages, Aide, console** : communs aux deux produits, en bas du rail (**recommandé**) ?
6. **Renommer maintenant** les tables en `cp_` et les clés de modules selon le cahier (**recommandé**, il n'y a que des données de test) ?
7. **Langues** : FR, DE, IT, EN comme décidé (**recommandé**), ou ajouter PT et ES comme le cahier ?
8. **Région d'hébergement** : à trancher avant les données de santé et la fusion (Zurich disponible) ; le décider maintenant ou au module allergies ?
9. **Ordre des étapes** : R1 (navigation) puis R2 puis R3 (**recommandé**), ou autre ?
10. **Le fichier du cahier** : peux-tu le faire ajouter au dépôt (`docs/chantierpilot/cahier-des-charges-v2.md`) ?

## 8. Limites de cette relecture

- Je n'ai pas le fichier original, seulement le texte collé dans la conversation : je ne peux pas le citer par numéro de ligne ni le joindre aux prochaines sessions.
- Les estimations de durée du cahier (lots de 1 à 3 semaines) sont celles de l'auteur : je ne les reprends pas à mon compte.
- Je n'ai pas vérifié les points légaux (TVA, QR-facture, durée du travail, nLPD) : ils restent à valider par la fiduciaire et les conseils compétents.
