/*
  Lot 14 : caution des intérimaires, sauvegarde automatique et restauration, SMS, carte des chantiers.

  - Caution : montant versé, date de versement et de restitution par personne (soldée au départ).
  - Sauvegarde automatique : la fonction d'envoi dépose chaque mois un fichier complet dans le
    stockage privé « backups » (lisible par qui a le droit « settings »). Le rappel mensuel ne part
    plus si une sauvegarde automatique a moins de 30 jours.
  - Restauration : restore_missing_rows() remet les lignes absentes d'une table depuis un fichier de
    sauvegarde ; une ligne encore présente n'est jamais modifiée (rien n'est écrasé ni supprimé).
  - SMS : rappels personnels (retour demain, retard, demande prête) envoyés aussi par SMS si le
    réglage sms_enabled est actif et la personne a un numéro ; claim_sms_notifications() (service_role).
  - Carte : coordonnées des chantiers (adresse géocodée ou position du téléphone).
*/

-- 1. Caution ---------------------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(10, 2) CHECK (deposit_amount IS NULL OR deposit_amount >= 0),
  ADD COLUMN IF NOT EXISTS deposit_paid_on date,
  ADD COLUMN IF NOT EXISTS deposit_returned_on date;

-- 2. Sauvegarde automatique ------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'backups_read_admin') THEN
    CREATE POLICY backups_read_admin ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'backups' AND public.app_has('settings'));
  END IF;
END $$;

INSERT INTO public.system_settings (id, value, description) VALUES
  ('auto_backup', 'true', 'Sauvegarde complète automatique chaque mois dans le stockage privé'),
  ('last_auto_backup_at', '', 'Dernière sauvegarde automatique'),
  ('sms_enabled', 'false', 'Rappels personnels envoyés aussi par SMS')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.check_backup_reminder()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last timestamptz;
BEGIN
  SELECT max(NULLIF(value, '')::timestamptz) INTO v_last
  FROM public.system_settings WHERE id IN ('last_backup_at', 'last_auto_backup_at');
  IF v_last IS NOT NULL AND v_last > now() - interval '30 days' THEN
    RETURN 0;
  END IF;
  INSERT INTO public.notifications (organization_id, kind, title, message, dedupe_key)
  VALUES (public.default_organization_id(), 'backup_due', 'Sauvegarde du mois',
          CASE WHEN v_last IS NULL THEN 'Aucune sauvegarde complète n''a encore été faite. Paramètres → Sauvegarde.'
               ELSE format('Dernière sauvegarde le %s. Paramètres → Sauvegarde.', to_char(v_last AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY')) END,
          'backup_due:' || to_char(now(), 'YYYYMM'))
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN 1;
END;
$$;

-- 3. Restauration des lignes manquantes ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_missing_rows(p_table text, p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_columns text;
  v_count integer;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT public.app_has('settings') THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  -- Codes de badge et abonnements de téléphones : jamais dans une sauvegarde, jamais restaurés
  IF p_table IN ('user_badges', 'push_subscriptions') OR NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = p_table
  ) THEN
    RAISE EXCEPTION 'Table inconnue : %', p_table;
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN 0;
  END IF;
  -- Colonnes ordinaires seulement (les colonnes calculées sont recalculées par la base)
  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO v_columns
  FROM pg_attribute a
  WHERE a.attrelid = format('public.%I', p_table)::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '';
  EXECUTE format(
    'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_recordset(NULL::public.%1$I, $1) ON CONFLICT DO NOTHING',
    p_table, v_columns
  ) USING p_rows;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 4. SMS -------------------------------------------------------------------------------------------
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sms_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_sms_notifications(p_limit integer DEFAULT 50)
RETURNS TABLE (id uuid, phone text, title text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF COALESCE((SELECT value FROM public.system_settings WHERE system_settings.id = 'sms_enabled'), 'false') <> 'true' THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH claimed AS (
    UPDATE public.notifications n SET sms_sent_at = now()
    WHERE n.id IN (
      SELECT x.id FROM public.notifications x
      JOIN public.users u ON u.id = x.recipient_user_id
      WHERE x.sms_sent_at IS NULL AND x.created_at > now() - interval '1 day'
        AND x.kind IN ('return_reminder', 'return_overdue', 'request_ready')
        AND u.active AND NULLIF(btrim(u.phone), '') IS NOT NULL
      ORDER BY x.created_at LIMIT p_limit FOR UPDATE OF x SKIP LOCKED
    )
    RETURNING n.id, n.title, n.message, n.recipient_user_id
  )
  SELECT c.id, u.phone, c.title, c.message
  FROM claimed c JOIN public.users u ON u.id = c.recipient_user_id;
END;
$$;

-- 5. Carte des chantiers ---------------------------------------------------------------------------
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS latitude double precision CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD COLUMN IF NOT EXISTS longitude double precision CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);

-- 6. Droits ----------------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.restore_missing_rows(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_missing_rows(text, jsonb) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.claim_sms_notifications(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sms_notifications(integer) TO service_role;

ALTER FUNCTION public.check_backup_reminder() SET search_path = public, extensions;
ALTER FUNCTION public.restore_missing_rows(text, jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.claim_sms_notifications(integer) SET search_path = public, extensions;
