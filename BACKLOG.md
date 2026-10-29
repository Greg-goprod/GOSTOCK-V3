# GO-Mat — Backlog

Travaux commencés mais pas terminés, et dettes connues. Mis à jour le 29.10.2026.

## En cours (non terminé)

### Notifications par e-mail — ⚠️ inachevé

Fait :
- Destinataires par type d'alerte et par dépôt (Paramètres → Notifications par e-mail)
- Fonction Edge `send-notification-emails` déployée sur GO-MAT (relais SMTP Mannyx `go-prod-smtp-relay.fly.dev`)
- Migration `20261029000007_notifications_email.sql` (file d'envoi, réservation sans double envoi, 3 essais)

Reste à faire :
1. **Appliquer sur GO-MAT** la nouvelle signature de `mark_notification_email(uuid, text, boolean)` :
   le `DROP FUNCTION mark_notification_email(uuid, text)` attend une confirmation dans Supabase.
   Tant que ce n'est pas fait, la fonction Edge ne peut pas marquer les alertes comme envoyées.
2. **Secrets de la fonction Edge** (saisis par le propriétaire dans Supabase, jamais dans le code) :
   `SMTP_RELAY_API_KEY` (= `API_SECRET_KEY` du relais Fly.io, même valeur que dans Mannyx),
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` ;
   facultatifs `SMTP_FROM_NAME`, `APP_URL`.
3. **Planification pg_cron** toutes les 5 minutes (SQL en fin de migration 00007).
4. Essai réel avec le bouton « Tester », puis une vraie alerte de stock bas.

### Connexion — réglages Supabase à faire par le propriétaire

La connexion (e-mail + code) et les rôles sont en place (migrations 00008 et 00009 appliquées sur GO-MAT).
À régler dans le tableau de bord Supabase (Authentication), sans quoi l'envoi des codes reste limité :
1. **URL Configuration** : Site URL = adresse de l'app (en local `http://localhost:5174`), et l'ajouter
   aux Redirect URLs (le lien de l'e-mail y renvoie).
2. **Email Templates → Magic Link** : ajouter `{{ .Token }}` pour que l'e-mail affiche le code à 6 chiffres
   (sans cela, seul le lien fonctionne).
3. **SMTP Settings** : le serveur d'envoi par défaut de Supabase n'écrit qu'aux membres de l'équipe du
   projet et quelques fois par heure. Saisir le compte SMTP (le même que pour les alertes) avant
   d'inviter les collaborateurs.

Conseiller de sécurité : les avertissements « SECURITY DEFINER exécutable par authenticated » restants
sont voulus (whoami, fonctions app_* utilisées par les règles RLS, create_request, disponibilités,
recalculs) ; les fonctions de déclencheurs ne sont plus appelables directement.

## Dettes techniques

- **Vite 5 → 8** : failles limitées au serveur de développement ; saut majeur (Node ≥ 20.19).
- **ESLint** : 68 `any` explicites (surtout `AppContext.tsx`), 11 dépendances de hooks manquantes.
- **Import Excel** : n'accepte plus que le format `.xlsx` (exceljs ne lit pas l'ancien `.xls`).
- **Renumérotation** : la scie `GOMAT-20261029-0001` garde l'ancien format de numéro.

## À venir

- Multi-organisation (intégration Mannyx) : `organization_id` est présent sur les nouvelles tables, mais
  les règles RLS ne filtrent pas encore par organisation (une seule organisation aujourd'hui).
- Envoi des e-mails de connexion via le relais Mannyx (hook « Send Email » de Supabase Auth), si on ne
  veut pas saisir le SMTP dans Supabase.
