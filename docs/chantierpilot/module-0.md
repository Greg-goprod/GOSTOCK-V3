# Module 0 — Fondation multi-entreprise : état d'avancement

**Statut au 1er novembre 2026 : développé et testé en base locale (étapes 0.1 à 0.6). Migrations 35, 36 et 38 NON appliquées sur GO-MAT.** Rien ne change pour les utilisateurs tant que tu n'as pas donné le feu vert.

## Ce qui est fait (migrations 35 et 36, batteries de tests)

| Étape | Contenu | État |
|---|---|---|
| 0.1 | Entreprises (`organizations.active`), administrateurs de plateforme (`platform_admins`), entreprise active du compte (`account_context`), `app_org_id()`, `my_organizations()`, `switch_organization()`, `whoami()` enrichi | Fait, testé |
| 0.2 | `organization_id` sur les 55 tables, par défaut = entreprise active ; l'existant passe dans « ENTREPRISE TEST » ; clés propres à chaque entreprise (e-mail, numéro d'article, numéro de série, réglages, états, rôles) | Fait, testé |
| 0.3 | Règle RESTRICTIVE `org_isolation` sur toutes les tables ; vues déjà en `security_invoker` | Fait, testé |
| 0.4 | Garde d'écriture `a_org_write_guard` ; 30 fonctions SECURITY DEFINER corrigées ou vérifiées ; tâches planifiées par entreprise ; accès anonyme réduit à la page « outil trouvé » | Fait, testé |
| Console | `platform_create_organization`, `platform_list_organizations`, `platform_set_organization_active` (administrateur de plateforme seulement) | Fait côté base, **pas d'écran** |

Tests : `supabase/tests/isolation.sql` (73 contrôles) et `supabase/tests/cycle.sql` (cycle complet commande → sortie → prolongation → retour dans deux entreprises, cohérence des lignes créées) : **91 contrôles, 0 échec**. Lancer : `bash supabase/tests/run.sh` sur la base locale reconstruite.

## Étapes 0.5 et 0.6 (faites le 1er novembre, mêmes tests)

| Étape | Contenu | État |
|---|---|---|
| 0.5 | Migration 38 : fichiers rangés par entreprise (`fichiers`, `backups`, `photos-articles`), anciens fichiers rattachés à l'entreprise historique sans les déplacer ; table des lectures de notifications reprise dans l'isolation | Fait, testé (batterie d'isolation : 85 contrôles) |
| 0.5 | Sauvegarde automatique : un fichier **par entreprise** (`<entreprise>/GO-Mat_sauvegarde_….json`), date de dernière sauvegarde par entreprise, une entreprise en échec ne bloque pas les autres | Écrit (fonction de bord `send-notification-emails`) : **à redéployer** par toi |
| 0.5 | Série des numéros d'article propre à chaque entreprise (modifiable par son administrateur seulement) | Fait, testé |
| 0.6 | Sélecteur d'entreprise dans la barre du haut (comptes à plusieurs entreprises), rechargement complet au changement, rechargement automatique si l'entreprise active a changé dans un autre onglet | Fait, testé sur maquette |
| 0.6 | Console « Entreprises » (Réglages) : créer, lister, suspendre ; réservée à l'administrateur de la plateforme | Fait, testé sur maquette |
| 0.7 | Rejeu des tests e2e sur la vraie base après mise en service | **À faire par ton Claude local** |

L'application déployée reste compatible avec une base sans les migrations 35, 36 et 38 : tant qu'elles ne sont pas appliquées, le sélecteur et la console n'apparaissent pas et les fichiers restent rangés comme avant.

## Ce qui reste avant d'ouvrir une deuxième entreprise

1. Appliquer les migrations **35, 36 et 38** (la 37 est déjà en place), dans cet ordre, après une sauvegarde complète.
2. Redéployer la fonction `send-notification-emails` (sauvegarde par entreprise).
3. Te déclarer administrateur de la plateforme (voir « Mise en service »).
4. Rejouer les tests e2e (ton Claude local), puis créer une première entreprise de test depuis la console et vérifier à la main qu'elle ne voit rien de « ENTREPRISE TEST ».

## Limites connues (acceptées pour l'instant)

- Les numéros de demande, de bon et de commande restent une série commune à toutes les entreprises (uniques, mais pas consécutifs par entreprise). Les factures (module 7) auront une numérotation propre à chaque entreprise.
- Les fonctions qui reçoivent un identifiant (ex. disponibilité d'un article) ne vérifient pas que l'identifiant appartient à l'entreprise ; un identifiant étranger ne s'obtient pas sans accès (identifiants aléatoires), et toute écriture est de toute façon bloquée par le garde. À durcir au module 1.
- Le changement d'entreprise est lié au compte, pas à l'onglet : changer d'entreprise dans un onglet change aussi les autres onglets après leur prochain chargement. L'interface rechargera les données au changement et à chaque retour sur l'onglet.
- Un administrateur de plateforme doit avoir une fiche dans au moins une entreprise pour utiliser l'application ; la console passe par des fonctions qui n'en dépendent pas.

## Mise en service sur GO-MAT (quand tu donnes le feu vert)

1. Sauvegarde complète (Paramètres → Sauvegarde) **et** export Supabase si possible.
2. Appliquer la migration 35, puis la 36, puis la 38 (éditeur SQL, une à la fois ; la 37 est déjà appliquée).
3. Te déclarer administrateur de plateforme, avec ton propre compte, depuis l'éditeur SQL :
   `insert into public.platform_admins (auth_user_id) select id from auth.users where email = '<ton e-mail de connexion>';`
4. Rejeu des tests e2e par ton Claude local.
5. En cas de problème : `supabase/rollback/module0_neutraliser.sql` (retire l'isolation sans toucher aux données) ou restauration de la sauvegarde.

Vérifications faites en lecture seule sur GO-MAT : 55 tables, une entreprise « Ma société », 19 personnes dont 1 administrateur, aucun e-mail en double, noms de contraintes attendus présents.
