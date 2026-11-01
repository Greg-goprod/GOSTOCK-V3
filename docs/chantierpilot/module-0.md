# Module 0 — Fondation multi-entreprise : état d'avancement

**Statut au 1er novembre 2026 : développé et testé en base locale. NON appliqué sur GO-MAT.** Rien ne change pour les utilisateurs tant que tu n'as pas donné le feu vert.

## Ce qui est fait (migrations 35 et 36, batteries de tests)

| Étape | Contenu | État |
|---|---|---|
| 0.1 | Entreprises (`organizations.active`), administrateurs de plateforme (`platform_admins`), entreprise active du compte (`account_context`), `app_org_id()`, `my_organizations()`, `switch_organization()`, `whoami()` enrichi | Fait, testé |
| 0.2 | `organization_id` sur les 55 tables, par défaut = entreprise active ; l'existant passe dans « ENTREPRISE TEST » ; clés propres à chaque entreprise (e-mail, numéro d'article, numéro de série, réglages, états, rôles) | Fait, testé |
| 0.3 | Règle RESTRICTIVE `org_isolation` sur toutes les tables ; vues déjà en `security_invoker` | Fait, testé |
| 0.4 | Garde d'écriture `a_org_write_guard` ; 30 fonctions SECURITY DEFINER corrigées ou vérifiées ; tâches planifiées par entreprise ; accès anonyme réduit à la page « outil trouvé » | Fait, testé |
| Console | `platform_create_organization`, `platform_list_organizations`, `platform_set_organization_active` (administrateur de plateforme seulement) | Fait côté base, **pas d'écran** |

Tests : `supabase/tests/isolation.sql` (73 contrôles) et `supabase/tests/cycle.sql` (cycle complet commande → sortie → prolongation → retour dans deux entreprises, cohérence des lignes créées) : **91 contrôles, 0 échec**. Lancer : `bash supabase/tests/run.sh` sur la base locale reconstruite.

## Ce qui reste avant d'ouvrir une deuxième entreprise (bloquants)

1. **Sauvegarde automatique (fonction de bord `send-notification-emails`)** : elle exporte toutes les tables en un seul fichier. Avec plusieurs entreprises, elle mélangerait leurs données. À faire par entreprise (un fichier par entreprise, date de dernière sauvegarde par entreprise). **Bloquant.**
2. **Stockage de fichiers (0.5)** : les buckets (`photos-articles`, fichiers de retour, sauvegardes) ne sont pas encore rangés par entreprise. Les règles d'accès doivent comparer le dossier à l'entreprise active. **Bloquant.**
3. **Interface (0.6)** : sélecteur d'entreprise dans l'en-tête pour les comptes à plusieurs entreprises, écran de création des entreprises (réservé à toi), enregistrement des réglages (`system_settings`) avec la clé `organization_id`, page « outil trouvé » qui gère « entreprise inconnue ».
4. **Rejeu des tests e2e** (e2e-complet et e2e-emprunts) sur la base avec les migrations 35 et 36, par ton Claude local.

## Limites connues (acceptées pour l'instant)

- Les numéros de demande, de bon et de commande restent une série commune à toutes les entreprises (uniques, mais pas consécutifs par entreprise). Les factures (module 7) auront une numérotation propre à chaque entreprise.
- Les fonctions qui reçoivent un identifiant (ex. disponibilité d'un article) ne vérifient pas que l'identifiant appartient à l'entreprise ; un identifiant étranger ne s'obtient pas sans accès (identifiants aléatoires), et toute écriture est de toute façon bloquée par le garde. À durcir au module 1.
- Le changement d'entreprise est lié au compte, pas à l'onglet : changer d'entreprise dans un onglet change aussi les autres onglets après leur prochain chargement. L'interface rechargera les données au changement et à chaque retour sur l'onglet.
- Un administrateur de plateforme doit avoir une fiche dans au moins une entreprise pour utiliser l'application ; la console passe par des fonctions qui n'en dépendent pas.

## Mise en service sur GO-MAT (quand tu donnes le feu vert)

1. Sauvegarde complète (Paramètres → Sauvegarde) **et** export Supabase si possible.
2. Appliquer la migration 35, puis la 36 (éditeur SQL, une à la fois).
3. Te déclarer administrateur de plateforme, avec ton propre compte, depuis l'éditeur SQL :
   `insert into public.platform_admins (auth_user_id) select id from auth.users where email = '<ton e-mail de connexion>';`
4. Rejeu des tests e2e par ton Claude local.
5. En cas de problème : `supabase/rollback/module0_neutraliser.sql` (retire l'isolation sans toucher aux données) ou restauration de la sauvegarde.

Vérifications faites en lecture seule sur GO-MAT : 55 tables, une entreprise « Ma société », 19 personnes dont 1 administrateur, aucun e-mail en double, noms de contraintes attendus présents.
