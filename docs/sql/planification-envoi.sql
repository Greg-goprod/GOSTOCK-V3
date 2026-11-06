-- GO-Mat : envoi automatique des alertes (e-mail, notifications téléphone, SMS) toutes les 5 minutes,
-- plus les échéances, relances, rapport mensuel et sauvegarde mensuelle.
-- À coller une fois dans Supabase → projet GO-MAT → SQL Editor → Run. Peut être relancé sans risque.
-- La clé ci-dessous est la clé publique (anon) de l'application : elle n'est pas secrète.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gomat-notification-emails';

SELECT cron.schedule('gomat-notification-emails', '*/5 * * * *', $cron$
  SELECT net.http_post(
    url := 'https://xxzcaxizqndvhnzchqkp.supabase.co/functions/v1/send-notification-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4emNheGl6cW5kdmhuemNocWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyNzA2NTQsImV4cCI6MjEwODg0NjY1NH0.cwpU393hH_dp_B00qaT6-jKJCRyYmM2MR-vQ9k1nXLg'
    ),
    body := '{}'::jsonb
  );
$cron$);

-- Contrôle : une ligne « gomat-notification-emails » active
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'gomat-notification-emails';
