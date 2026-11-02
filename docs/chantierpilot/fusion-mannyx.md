# Fusion de GO-Mat dans Mannyx : cadrage

Statut : **document de cadrage** (2 novembre 2026). Il sert à garder GO-Mat fusionnable pendant qu'on le construit, et à préparer les décisions à prendre côté Mannyx.
Sources : réponses de Greg ; code de Mannyx lu en lecture seule (`github.com/Greg-goprod/NEW-GO-PROD`, dossier `go-prod-aura`) ; documents `compatibilite-mannyx.md` et `module-0.md`.
Ce qui est noté « à confirmer » n'a pas été vérifié dans la base réelle de Mannyx (seulement dans ses fichiers de migration).

## 1. Cible

- **GO-Mat devient un module payant de Mannyx**, comme ChantierPilot. Les entreprises clientes sont **les mêmes**.
- Échéance : « un jour, probablement dans 6 mois ». GO-Mat vit seul entre-temps, avec sa propre base et sa propre connexion.
- **Scénario retenu : une seule base et une seule connexion** (projet Supabase de Mannyx). Conséquences :
  - on arrive depuis Mannyx **sans se réidentifier** (même session) ;
  - une seule liste d'entreprises, un seul plan, un seul journal d'administration ;
  - la console d'administration de GO-Mat disparaît au profit de celle de Mannyx (voir § 5).
- Écarté : deux produits reliés par un lien. Il imposerait soit une double connexion, soit un passage de jeton à construire, et il dupliquerait les comptes (une personne qui quitte une entreprise garderait son accès à l'autre produit).
- Les deux projets Supabase actuels : **GO-MAT** (`xxzcaxizqndvhnzchqkp`, région eu-west-1) et **Go-Prod-AURA** = Mannyx (`alhoefdrjbwdzijizrxc`, région eu-north-1). Les régions diffèrent : la fusion déplace des données d'une région européenne à une autre (à confirmer sans impact pour la nLPD).

## 2. Ce que Mannyx a réellement (vérifié dans ses migrations et son code)

| Sujet | Mannyx |
|---|---|
| Entreprises | `companies`, clé `company_id` partout ; entreprise lue dans le jeton (`auth_company_id()`) |
| Compte → entreprise | **une seule** : `profiles.company_id` |
| Administrateur de plateforme | `owner_admins(user_id)` + `is_owner_admin()` ; page `/admin` (`PlatformAdminPage`) avec une liste de sections extensible ; un `owner_admin` n'a **pas d'espace entreprise** en v1 |
| Console plateforme | coquille seulement : « Formulaires cantonaux » existe ; « Tenants », « Barèmes », « Plans », « Support » sont marqués « à venir » |
| Journal d'administration | `admin_audit_log` : **décrit dans la spécification 020, pas créé** dans les migrations |
| Plans, modules payants | **inexistants** (la spécification 020 prévoit une table `plans` avec `features_json`) |
| Création d'une entreprise | à la main en SQL ; `create_tenant()` existe mais est fermée et sans appelant |
| Droits | `rbac_roles`, `rbac_role_permissions(role_id, permission_key)`, `rbac_user_roles(user_id, role_id, company_id)`, `rbac_teams` / `rbac_team_permissions` / `rbac_user_teams`, `rbac_user_overrides` (accorder / refuser) ; `rbac_has_any_permission(text[])` = administrateur **ou** une des clés |
| Plusieurs entreprises par compte | **non** (mais `rbac_user_roles` porte déjà une `company_id`) |

## 3. Correspondance GO-Mat ↔ Mannyx

| GO-Mat | Mannyx | Action à la fusion |
|---|---|---|
| `organizations`, `organization_id` | `companies`, `company_id` | renommage mécanique ; les entreprises GO-Mat sont rattachées aux `companies` existantes (table de correspondance à établir) |
| `users` (une fiche par personne et par entreprise) | `profiles` (+ personnel, contacts) | à concevoir : la fiche GO-Mat est une donnée du module, le compte vient de `auth.users` |
| `account_context`, `app_org_id()`, `whoami()`, `my_organizations()` | `auth_company_id()` + jeton | remplacés ; voir § 4 pour le plusieurs-entreprises |
| `rbac_roles`, `rbac_role_permissions` (migration 40) | mêmes noms, mêmes colonnes essentielles | fusion directe ; les clés `module.page:action` sont déjà au même format |
| `users.rbac_role_id` (un rôle par personne) | `rbac_user_roles` (plusieurs rôles, par entreprise) | conversion : une ligne `rbac_user_roles` par fiche |
| `app_has('scan')` etc. | `rbac_has_any_permission(...)` | `rbac_legacy_permission_map` fait le pont ; remplacement progressif |
| `owner_admins`, `is_owner_admin()` (migration 43) | **identiques** | une seule table à la fusion |
| `admin_audit_log` (migration 43) | spécification 020 | notre table peut devenir la référence ; mêmes colonnes |
| `organization_modules`, `platform_modules` (migration 43) | n'existent pas | proposés comme base des modules payants (futur `company_modules`) |
| `sites` (chantiers) | `events` (évènements) | à rapprocher au module 1 : un chantier = un évènement |
| `platform_*` (fonctions de la console) | page `/admin` | remplacées par les sections de `/admin` |

## 4. Les vrais chantiers

1. **Plusieurs entreprises par compte.** Mannyx : un compte, une entreprise. GO-Mat en a besoin (consultants, intérimaires de plusieurs sociétés ; décision de Greg du 1er novembre). Il faut, côté Mannyx : une table d'appartenance (compte ↔ entreprise ↔ rôles), le choix de l'entreprise active (nous l'avons préparé : en-tête par onglet, branche `wip/alignements-mannyx`), et l'adaptation de `auth_company_id()` et du jeton. **C'est le point à concevoir en premier avec Mannyx.**
2. **Modules payants.** Ni plans ni modules par entreprise chez Mannyx. Proposition : adopter notre pièce `organization_modules` (devenue `company_modules`), avec des clés comme `go_mat`, `chantiers_planning`, `repas`… ; les droits (`rbac`) ne s'appliquent que si le module est activé. À valider avec la future table `plans`.
3. **Schéma séparé.** Les tables de GO-Mat passent dans un schéma `mat` de la base de Mannyx. Points d'attention : noms de fonctions identiques (`whoami`, `audit_trigger`, `app_*`…), tables homonymes (`notifications`, `departments`, `vehicles`), `search_path` de chaque fonction. Nos batteries SQL (isolation, cycle, notifications, rbac, planning, plateforme) servent de filet.
4. **Comptes et connexions.** Les comptes GO-Mat (`auth.users`) sont rapprochés de ceux de Mannyx **par adresse e-mail**. GO-Mat relie déjà une fiche à un compte par l'e-mail à la première connexion, ce qui simplifie la reprise. Les mots de passe peuvent être repris avec leur empreinte (à confirmer avec Supabase).
5. **Fichiers.** Les fichiers GO-Mat sont déjà rangés par entreprise (`<id entreprise>/…`). Ils sont copiés vers le stockage de Mannyx ; les chemins ne changent pas.
6. **Fonctions de bord.** `send-notification-emails` et les autres sont redéployées dans le projet de Mannyx, avec leurs secrets.
7. **Interface.** Deux options, qui marchent toutes deux avec une connexion partagée : GO-Mat devient des routes de l'application Mannyx, ou reste une application séparée sur un sous-domaine du même domaine. À décider plus tard ; la charte graphique est déjà celle de Mannyx.

## 5. Console d'administration : ce qu'on construit, ce qui est jetable

- **Construit maintenant (migration 43, allégée) :** `owner_admins` + `is_owner_admin()`, `admin_audit_log` (ajout seul), modules activés par entreprise, fonctions : créer / suspendre / réactiver une entreprise, activer un module, liste avec usage (chiffres, jamais le contenu), journal. Un seul niveau d'accès : Greg.
- **Choix de conception :** les pièces qui existent chez Mannyx portent **le même nom** (`owner_admins`, `admin_audit_log`) ; l'écran suivra la forme de la page `/admin` de Mannyx (liste de sections) pour s'y déplacer presque tel quel.
- **Volontairement absents :** niveaux « propriétaire / support » (Mannyx n'a qu'un niveau), plan commercial (Mannyx aura `plans`), note interne (une entrée du journal suffit), identifiant lisible d'entreprise.
- **À la fusion :** la création d'entreprise et la suspension deviennent celles de Mannyx ; il reste de GO-Mat les **modules** et l'**usage de GO-Mat** (un onglet dans `/admin`).
- **Voir comme un client** (impersonation) : hors périmètre tant que Greg est seul. À reprendre seulement avec un accès limité dans le temps, motivé, tracé dans `admin_audit_log` et visible du client (données de santé du module 5).

## 6. À demander ou décider côté Mannyx

| # | Question |
|---|---|
| D1 | Un compte peut-il appartenir à plusieurs entreprises ? Modèle d'appartenance et choix de l'entreprise active |
| D2 | Table des modules payants par entreprise : `company_modules` (notre proposition) ou `plans.features_json` |
| D3 | Un `owner_admin` n'a pas d'espace entreprise ; GO-Mat suppose que Greg a aussi une fiche dans une entreprise (pour voir l'application). À arbitrer |
| D4 | `admin_audit_log` : reprendre notre table, mêmes colonnes que la spécification 020 |
| D5 | `auth_company_id()` contient, d'après le fichier de migration lu, un identifiant d'entreprise de développement en dernier recours : vérifier qu'il n'est jamais utilisé en production |
| D6 | Les droits de `owner_admins` : une migration indique « aucune règle, accès service seulement », le hook côté application mentionne une règle de lecture de sa propre ligne : confirmer l'état réel |
| D7 | Région Supabase (eu-north-1 pour Mannyx, eu-west-1 pour GO-Mat) : confirmer que le transfert pose un problème ni contractuel ni légal |

## 7. Calendrier proposé (d'ici ~6 mois)

| Quand | Quoi |
|---|---|
| Maintenant | Console allégée ; module 1 (planning) ; garder les noms alignés (règle ci-dessous) |
| Après l'écran du planning (module 1.3) | **Répétition de fusion** sur une branche (copie) de la base de Mannyx : schéma `mat`, collisions de noms, comptes. Objectif : lister les blocages, pas livrer |
| Dans 3 mois | Deuxième répétition ; D1 à D7 tranchées ; choix de l'interface (§ 4.7) |
| Fusion réelle | Après une répétition sans blocage et une sauvegarde complète ; GO-Mat reste lisible et réversible jusqu'à validation |

**Règle de construction jusqu'à la fusion :** tout ce qu'on ajoute (a) porte le nom de Mannyx quand le concept existe chez lui, (b) vit sous une clé d'entreprise unique `organization_id` (renommage mécanique en `company_id`), (c) est couvert par une batterie SQL d'isolation, (d) n'utilise aucun secret dans le code.

## 8. Risques

| Risque | Réponse |
|---|---|
| Le plusieurs-entreprises est refusé ou retardé côté Mannyx | Le décider tôt (D1) ; en repli, un compte par entreprise (moins pratique pour les consultants) |
| Collisions de noms dans la base de Mannyx (440 migrations) | Schéma `mat` ; répétition sur copie ; batteries SQL |
| Perte ou doublon de comptes | Rapprochement par e-mail, rapport d'écarts avant bascule |
| Régression sur les droits | `rbac_legacy_permission_map`, batterie `rbac.sql`, e2e complets rejoués |
| Retour arrière impossible | Sauvegarde complète des deux bases ; GO-Mat conservé en lecture jusqu'à validation |
