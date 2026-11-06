# Compatibilité avec Mannyx : décisions à prendre avant d'aller plus loin

Statut : **document de décision**. Aucun code n'est ajouté tant que ces points ne sont pas tranchés. Le travail en cours sur les « alignements » est mis de côté dans la branche locale `wip/alignements-mannyx` (non poussée, non appliquée).

Source : dépôt Mannyx, lecture seule (`ARCHI.md`, `SECURITY_PHASE1_BILAN.md`, spécifications 001, 009, 010, 020, 021, `permissionsMatrix.ts`). La base Mannyx n'a pas été lue : ce qui suit décrit ce que la documentation annonce, à confirmer avant toute fusion.

## 1. Noms des tables et des colonnes

| Sujet | Mannyx | GO-Mat aujourd'hui | Collision ? |
|---|---|---|---|
| Entreprise | `companies` | `organizations` | Non (autre nom), mais deux mots pour une même chose |
| Clé d'entreprise | `company_id` | `organization_id` | Idem |
| Personnes | `profiles` (1 compte = 1 profil), `staff_volunteers`, `crm_contacts` | `users` (une fiche, avec ou sans compte) | Sens différent : `users` GO-Mat = « personne de l'entreprise », pas seulement « compte » |
| Noms identiques | `departments`, `notifications`, `vehicles` (cités dans les spécifications Mannyx) | idem | **Oui** : 3 collisions déjà visibles ; la base Mannyx en a sûrement d'autres (84 migrations) |
| Super-administrateur | `is_superadmin` sur le profil, `admin_audit_log` | `platform_admins`, (journal en préparation) | Noms à aligner |

### Pistes
- **A. Garder nos noms, isoler dans un schéma.** À la fusion, les tables GO-Mat passent dans un schéma `mat` de la base Mannyx (une commande par table, rien n'est renommé) : plus aucune collision possible, quel que soit le nombre de tables de Mannyx. L'application GO-Mat lit ce schéma. Coût : faible, au moment de la fusion.
- **B. Adopter les noms Mannyx maintenant** (`companies`, `company_id`). Renommer 60 tables, 22 vues et une centaine de fonctions : faisable par script avec nos batteries de tests comme filet, mais gros chantier et gain nul tant que les bases restent séparées.
- **C. Préfixer les tables GO-Mat** (`mat_equipment`…) : lourd et sans avantage sur A.

**Recommandation : A pour l'existant**, plus une règle pour tout ce qu'on construit maintenant (ChantierPilot) : les **nouvelles** tables prennent déjà les noms Mannyx quand le concept existe chez lui (`company_id` ? voir 4), et le mot « company » plutôt qu'« organization » dans les nouveaux libellés techniques.

## 2. Rôles et droits (le point le plus important)

| | Mannyx | GO-Mat |
|---|---|---|
| Rôles | **Définis par entreprise** : table `rbac_roles` (nom, `company_id`, rôle système protégé « Administrateur ») | 4 rôles **fixes** : administrateur, responsable, magasinier, collaborateur |
| Droits | Table `rbac_role_permissions` : clé `{page}:{action}` (ex. `booking.offers:update`), actions lecture / création / modification / suppression, **matrice** modules × actions dans l'interface | 8 droits larges (`scan`, `approve`, `manage_stock`…) + droits supplémentaires par personne |
| Vérification en base | `rbac_has_any_permission(ARRAY['booking.offers:update'])` | `app_has('scan')` |
| Modèles de rôles | `ROLE_TEMPLATES` (ex. « Chargé de production ») | aucun |

Pourquoi c'est important pour GO-Mat, pas seulement pour la fusion : avec 15 à 20 entreprises clientes, **chacune voudra ses propres rôles** (ex. « chef d'équipe prestataire », « traiteur », « responsable hôtel » pour ChantierPilot). Les 4 rôles fixes ne tiendront pas.

### Proposition (en trois temps, sans rien casser)
1. **Tables compatibles** : `rbac_roles` et `rbac_role_permissions` (mêmes noms, mêmes colonnes que Mannyx), `users.rbac_role_id`, et la fonction `rbac_has_any_permission(text[])` avec le même nom et la même signature. On y crée, pour chaque entreprise, les 4 rôles actuels avec leurs droits actuels. `app_has('scan')` continue de répondre exactement comme aujourd'hui : **aucun changement visible**.
2. **Les nouveaux modules (ChantierPilot) naissent avec des clés Mannyx** : `chantiers.planning:read`, `repas.bons:update`, `hotel.rooming:create`…, vérifiées par `rbac_has_any_permission`.
3. **Écran « Rôles et droits »** (matrice comme Mannyx) quand un client en a besoin ; ensuite, remplacement progressif de `app_has` par les clés fines.

## 3. Une personne dans plusieurs entreprises

Mannyx : un compte = une entreprise (`profiles.company_id`), l'entreprise est lue dans le jeton de connexion. GO-Mat : un compte peut avoir une fiche par entreprise (ta décision).

Conséquence à la fusion : la base Mannyx devrait accepter qu'un compte appartienne à plusieurs entreprises (table d'appartenance, du type `company_members`). C'est une évolution **de Mannyx**, pas de GO-Mat.

Deux issues possibles :
- **Garder « plusieurs »** (recommandé : tes consultants et intérimaires en ont besoin). Tout ce qui y touche est concentré en quatre objets (`users`, `account_context`, `app_org_id()`, `my_organizations()`), donc la conversion à la fusion reste un seul chantier bien délimité.
- **Revenir à « une entreprise par compte »** comme Mannyx : un consultant aurait un compte (une adresse e-mail) par entreprise. Plus simple, mais plus pénible pour les personnes concernées.

## 4. Niveau « évènement »

Mannyx cloisonne par `company_id` **et** `event_id` (un évènement = un cadre de travail). GO-Mat a des chantiers (`sites`). Pour ChantierPilot, le montage évènementiel est le cœur du métier : le chantier de GO-Mat est l'évènement de Mannyx.

**Proposition** : au module 1, les tables de planning référencent `site_id` (chantier) ; à la fusion, `sites` correspond à `events` (même identifiant). On peut même appeler le futur parent « évènement » dans l'interface.

## 5. Décisions demandées

1. Noms : **piste A** (garder nos noms + schéma séparé à la fusion) — d'accord ? Et les nouvelles tables en `company_id` ou en `organization_id` ?
2. Droits : lancer **le temps 1** (tables et fonction compatibles Mannyx, sans changement visible) avant le module 1 ?
3. Plusieurs entreprises par compte : **on garde** (avec le coût côté Mannyx noté ci-dessus) ou on revient à « une par compte » ?
4. Alignements en attente (journal de la plateforme, plan, entreprise active par onglet) : on les reprend **après** ces décisions, avec les noms Mannyx (`admin_audit_log`, etc.).
