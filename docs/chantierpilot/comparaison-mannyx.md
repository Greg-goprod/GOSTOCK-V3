# Multi-entreprise : Mannyx et GO-Mat (comparaison, 1er novembre 2026)

Source : documents et spécifications du dépôt Mannyx (`ARCHI.md`, `SECURITY_PHASE1_BILAN.md`, `specs/001`, `010`, `020`, `021`) et une migration. **La base Mannyx n'a pas été lue** (interdit) ; les points ci-dessous viennent donc de la documentation, pas des règles réellement actives en production.

| Sujet | Mannyx | GO-Mat (modules 0.1 à 0.6) | Écart |
|---|---|---|---|
| Racine | table `companies` (tenant) | table `organizations` | Nom seulement |
| Clé sur chaque table | `company_id` | `organization_id` | Nom seulement (correspondance 1 pour 1) |
| Isolation | règles `company_id = auth_company_id()` + droits fins par table | règle restrictive `organization_id = app_org_id()` sur les 55 tables + garde d'écriture | Même principe |
| Entreprise active | lue dans le **jeton de connexion** (claim, puis métadonnées, puis `profiles`) | lue **en base** (`account_context`, puis fiche la plus ancienne) | Différent : jeton (par session) contre base (par compte) |
| Utilisateur ↔ entreprise | **1 utilisateur = 1 entreprise** (`profiles.company_id`) | **1 compte = plusieurs fiches** (une par entreprise, mêmes e-mail) | Différent (décision de Greg : plusieurs) |
| Rôles et droits | RBAC fin : permissions `booking.offers:update`, rôles en table | 4 rôles et 8 droits (`app_has`) | Très différent |
| Création d'une entreprise | `create_tenant()` : entreprise + listes par défaut + contact | `platform_create_organization()` : entreprise + réglages par défaut + 1er administrateur | Équivalent |
| Super-administrateur | `is_superadmin`, panneau `/admin`, impersonation (jeton 1 h), plan et statut par entreprise, journal des actions | `platform_admins`, console « Entreprises » (créer, suspendre) | GO-Mat n'a ni impersonation, ni plan, ni journal des actions de la plateforme |
| Protection contre l'auto-promotion | trigger `protect_user_metadata` (company_id et rôle interdits dans les métadonnées) | non nécessaire (rien n'est lu dans les métadonnées) ; `users_guard` protège rôles et droits | Équivalent par construction |
| Fichiers | buckets cloisonnés par entreprise (dossier ou jointure) | dossier `<entreprise>/` + règle de stockage | Même principe |
| Dimension évènement | `event_id` en plus de `company_id` | chantiers (`sites`), sans niveau « évènement » | À aligner au module 1 |
| Portails externes | comptes séparés (`artist_users`) | prévus (module 3) | À concevoir |
| Numérotation | par entreprise (finance) | commune pour demandes et bons ; par entreprise pour les articles | À reprendre pour les factures |

## Verdict
Compatible sur le **principe** (entreprise racine, clé sur chaque table, isolation par règles de base, fichiers cloisonnés, super-administrateur). **Pas branchable tel quel** : noms, entreprise active (jeton contre base), plusieurs entreprises par personne, droits fins, niveau « évènement ». Une fusion future passerait par une table de correspondance (organization → company, users → profiles) et par le passage de GO-Mat aux droits fins de Mannyx.

## Alignements peu coûteux à faire maintenant (à décider)
1. Journal des actions de la plateforme (qui a créé ou suspendu quelle entreprise).
2. Statut et plan d'une entreprise (champs vides pour l'instant) pour coller à `AdminTenant`.
3. Nom de la clé : garder `organization_id` et documenter la correspondance (renommer les 55 tables n'apporte rien tant que les bases restent séparées).
4. Lire l'entreprise active dans le jeton de connexion, au lieu de la base, si le multi-onglet pose problème (nécessite un réglage Supabase à ta charge).
