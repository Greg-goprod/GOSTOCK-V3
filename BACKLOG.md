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

## Dettes techniques

- **xlsx 0.18.5** (import Excel) : failles connues (prototype pollution, ReDoS). La version corrigée
  n'existe que sur `cdn.sheetjs.com` (`xlsx-0.20.3.tgz`), ou remplacer par `exceljs`.
- **Vite 5 → 8** : failles limitées au serveur de développement ; saut majeur (Node ≥ 20.19).
- **ESLint** : 68 `any` explicites (surtout `AppContext.tsx`), 11 dépendances de hooks manquantes.
- **Import Excel** : le numéro de série y est encore obligatoire, alors qu'il est facultatif ailleurs.
- **Renumérotation** : la scie `GOMAT-20261029-0001` garde l'ancien format de numéro.

## À venir

- Connexion et rôles (Supabase Auth, RLS par organisation et par rôle) — en dernier, comme convenu.
