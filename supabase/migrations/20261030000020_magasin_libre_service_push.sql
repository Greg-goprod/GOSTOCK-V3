/*
  Magasin : libre-service, boîte de retour, outil trouvé, sauvegarde, notifications sur le téléphone

  - Libre-service : un consommable marqué « libre-service » peut être pris par n'importe quel membre
    avec son téléphone (self_service_take), dans la limite par prise ; la sortie est à son nom et
    imputée au chantier choisi.
  - Boîte de retour : le collaborateur déclare avoir déposé ses outils (drop_box_return) ; ils restent
    à son nom jusqu'au contrôle du magasin (return_with_check), mais ne déclenchent plus de relance.
  - Outil trouvé : page publique /t/<code> ; found_tool_info() ne renvoie que le nom de l'entreprise,
    le téléphone et le message saisis dans les paramètres ; report_found_tool() prévient le magasin
    (au plus une alerte par outil et par heure).
  - Sauvegarde : rappel mensuel tant qu'aucune sauvegarde complète n'a été téléchargée.
  - Notifications sur le téléphone : abonnements Web Push par personne ; claim_push_notifications()
    (service_role) donne à la fonction d'envoi chaque nouvel avis avec les appareils à prévenir.
*/

-- 1. Libre-service --------------------------------------------------------------------------------
ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS self_service boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_service_max numeric(12, 3) CHECK (self_service_max IS NULL OR self_service_max > 0);

CREATE OR REPLACE FUNCTION public.self_service_take(p_depot_id uuid, p_items jsonb, p_destination text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user uuid := public.app_user_id();
  v_line jsonb;
  v_item public.equipment;
  v_qty numeric;
  v_count integer := 0;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND v_user IS NULL THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Rien à prendre';
  END IF;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_item FROM public.equipment WHERE id = (v_line->>'equipment_id')::uuid;
    IF v_item.id IS NULL OR v_item.item_type <> 'consumable' OR NOT v_item.self_service THEN
      RAISE EXCEPTION '« % » n''est pas en libre-service : passez au magasin', COALESCE(v_item.name, 'Cet article');
    END IF;
    v_qty := COALESCE((v_line->>'quantity')::numeric, 1);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantité invalide pour « % »', v_item.name;
    END IF;
    IF v_item.self_service_max IS NOT NULL AND v_qty > v_item.self_service_max THEN
      RAISE EXCEPTION '« % » : au plus % % par prise en libre-service', v_item.name, trim_scale(v_item.self_service_max), COALESCE(v_item.unit, '');
    END IF;
    PERFORM public.apply_stock_movement(v_item.id, p_depot_id, 'consumption', -v_qty, v_user,
                                        NULLIF(btrim(p_destination), ''), NULL, 'Libre-service');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 2. Boîte de retour ------------------------------------------------------------------------------
ALTER TABLE public.checkouts
  ADD COLUMN IF NOT EXISTS dropped_at timestamptz,
  ADD COLUMN IF NOT EXISTS dropped_note text;

CREATE OR REPLACE FUNCTION public.drop_box_return(p_checkout_ids uuid[], p_note text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user uuid := public.app_user_id();
  v_count integer;
  v_names text;
  v_who text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  WITH dropped AS (
    UPDATE public.checkouts SET dropped_at = now(), dropped_note = NULLIF(btrim(p_note), '')
    WHERE id = ANY (p_checkout_ids) AND user_id = v_user AND status IN ('active', 'overdue') AND dropped_at IS NULL
    RETURNING equipment_id
  )
  SELECT count(*), string_agg(e.name, ', ' ORDER BY e.name) INTO v_count, v_names
  FROM dropped d JOIN public.equipment e ON e.id = d.equipment_id;

  IF v_count > 0 THEN
    SELECT first_name || ' ' || last_name INTO v_who FROM public.users WHERE id = v_user;
    INSERT INTO public.notifications (organization_id, kind, title, message)
    VALUES (public.default_organization_id(), 'drop_box', 'Boîte de retour : ' || v_who,
            format('%s a déposé : %s. À contrôler au comptoir.', v_who, v_names));
  END IF;
  RETURN v_count;
END;
$$;

-- Relances : un outil déposé dans la boîte n'est plus « en retard » pour la personne
CREATE OR REPLACE FUNCTION public.check_due_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today text := to_char(now() AT TIME ZONE 'Europe/Zurich', 'YYYYMMDD');
  v_count integer := 0;
  v_n integer;
BEGIN
  INSERT INTO public.notifications (organization_id, kind, title, message, recipient_user_id, dedupe_key)
  SELECT public.default_organization_id(), 'return_reminder', 'À rendre demain',
         'À rendre demain : ' || string_agg(e.name, ', ' ORDER BY e.name) || '.',
         u.id, 'return_reminder:' || u.id || ':' || v_today
  FROM public.checkouts c
  JOIN public.users u ON u.id = c.user_id
  JOIN public.equipment e ON e.id = c.equipment_id
  WHERE c.status = 'active' AND c.dropped_at IS NULL
    AND (c.due_date AT TIME ZONE 'Europe/Zurich')::date = (now() AT TIME ZONE 'Europe/Zurich')::date + 1
  GROUP BY u.id
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  INSERT INTO public.notifications (organization_id, kind, title, message, recipient_user_id, dedupe_key)
  SELECT public.default_organization_id(), 'return_overdue', 'Matériel en retard',
         'Merci de rendre au plus vite : ' || string_agg(e.name || ' (prévu le ' || to_char(c.due_date AT TIME ZONE 'Europe/Zurich', 'DD.MM') || ')', ', ' ORDER BY c.due_date) || '.',
         u.id, 'return_overdue:' || u.id || ':' || v_today
  FROM public.checkouts c
  JOIN public.users u ON u.id = c.user_id
  JOIN public.equipment e ON e.id = c.equipment_id
  WHERE c.status IN ('active', 'overdue') AND c.due_date < now() AND c.dropped_at IS NULL
  GROUP BY u.id
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id, dedupe_key)
  SELECT public.default_organization_id(), 'return_escalation', 'Retard de plus de 3 jours : ' || e.name,
         format('%s %s n''a pas rendu « %s », attendu le %s.', u.first_name, u.last_name, e.name, to_char(c.due_date AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY')),
         e.id, 'return_escalation:' || c.id
  FROM public.checkouts c
  JOIN public.users u ON u.id = c.user_id
  JOIN public.equipment e ON e.id = c.equipment_id
  WHERE c.status IN ('active', 'overdue') AND c.due_date < now() - interval '3 days' AND c.dropped_at IS NULL
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  RETURN v_count;
END;
$$;

-- 3. Outil trouvé (page publique) -------------------------------------------------------------------
INSERT INTO public.system_settings (id, value, description) VALUES
  ('found_phone', '', 'Téléphone affiché à qui trouve un outil (page publique)'),
  ('found_message', 'Cet outil appartient à notre entreprise. Merci de nous appeler pour que nous venions le chercher.', 'Message affiché à qui trouve un outil')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.found_tool_lookup(p_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM (
    SELECT i.equipment_id AS id, 1 AS rank FROM public.equipment_instances i WHERE upper(i.qr_code) = upper(btrim(p_code))
    UNION ALL
    SELECT e.id, 2 FROM public.equipment e WHERE upper(e.article_number) = upper(btrim(p_code))
    UNION ALL
    SELECT e.id, 3 FROM public.equipment e WHERE e.id::text = lower(btrim(p_code))
  ) found
  ORDER BY rank
  LIMIT 1
$$;

-- Ce que voit la personne qui trouve l'outil : rien d'autre que le contact de l'entreprise
CREATE OR REPLACE FUNCTION public.found_tool_info(p_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'company', (SELECT name FROM public.organizations WHERE id = public.default_organization_id()),
    'phone', NULLIF((SELECT value FROM public.system_settings WHERE id = 'found_phone'), ''),
    'message', (SELECT value FROM public.system_settings WHERE id = 'found_message'),
    'known', public.found_tool_lookup(left(p_code, 100)) IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.report_found_tool(p_code text, p_contact text, p_place text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid := public.found_tool_lookup(left(p_code, 100));
  v_name text;
BEGIN
  IF v_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT name INTO v_name FROM public.equipment WHERE id = v_id;
  INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id, dedupe_key)
  VALUES (public.default_organization_id(), 'tool_found', 'Outil trouvé : ' || v_name,
          format('Quelqu''un a trouvé « %s » (%s). Lieu : %s. Contact : %s.', v_name, left(btrim(p_code), 60),
                 COALESCE(NULLIF(left(btrim(p_place), 200), ''), 'non précisé'), COALESCE(NULLIF(left(btrim(p_contact), 200), ''), 'non précisé')),
          v_id, 'tool_found:' || v_id || ':' || to_char(now(), 'YYYYMMDDHH24'))
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN true;
END;
$$;

-- 4. Sauvegarde : rappel mensuel ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_backup_reminder()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last timestamptz;
BEGIN
  SELECT NULLIF(value, '')::timestamptz INTO v_last FROM public.system_settings WHERE id = 'last_backup_at';
  IF v_last IS NOT NULL AND v_last > now() - interval '30 days' THEN
    RETURN 0;
  END IF;
  INSERT INTO public.notifications (organization_id, kind, title, message, dedupe_key)
  VALUES (public.default_organization_id(), 'backup_due', 'Sauvegarde du mois',
          CASE WHEN v_last IS NULL THEN 'Aucune sauvegarde complète n''a encore été téléchargée. Paramètres → Sauvegarde.'
               ELSE format('Dernière sauvegarde le %s. Paramètres → Sauvegarde.', to_char(v_last AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY')) END,
          'backup_due:' || to_char(now(), 'YYYYMM'))
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN 1;
END;
$$;

-- 5. Notifications sur le téléphone (Web Push) -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.app_user_id() REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS pushed_at timestamptz;
CREATE INDEX IF NOT EXISTS notifications_push_idx ON public.notifications (created_at) WHERE pushed_at IS NULL;

-- Nouveaux avis et appareils à prévenir : la personne visée, sinon le magasin (selon droits et dépôts)
CREATE OR REPLACE FUNCTION public.claim_push_notifications(p_limit integer DEFAULT 100)
RETURNS TABLE (id uuid, kind text, title text, message text, subscriptions jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE public.notifications n SET pushed_at = now()
    WHERE n.id IN (
      SELECT x.id FROM public.notifications x
      WHERE x.pushed_at IS NULL AND x.created_at > now() - interval '1 day'
      ORDER BY x.created_at LIMIT p_limit FOR UPDATE SKIP LOCKED
    )
    RETURNING n.id, n.kind, n.title, n.message, n.recipient_user_id, n.depot_id
  ),
  staff AS (
    SELECT u.id
    FROM public.users u
    WHERE u.active AND (u.access_until IS NULL OR u.access_until >= current_date)
      AND (public.role_permissions(u.role) || COALESCE(u.permissions, '{}')) && ARRAY['scan', 'approve', 'manage_stock', 'manage_people']
  )
  SELECT c.id, c.kind, c.title, c.message,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
           FROM public.push_subscriptions s
           WHERE (c.recipient_user_id IS NOT NULL AND s.user_id = c.recipient_user_id)
              OR (c.recipient_user_id IS NULL AND s.user_id IN (SELECT st.id FROM staff st)
                  AND (c.depot_id IS NULL
                       OR NOT EXISTS (SELECT 1 FROM public.user_depots ud WHERE ud.user_id = s.user_id)
                       OR EXISTS (SELECT 1 FROM public.user_depots ud WHERE ud.user_id = s.user_id AND ud.depot_id = c.depot_id)
                       OR 'all_depots' = ANY (public.role_permissions((SELECT role FROM public.users WHERE users.id = s.user_id)))))
         ), '[]'::jsonb)
  FROM claimed c;
END;
$$;

-- 6. Règles d'accès --------------------------------------------------------------------------------
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND policyname = 'push_subscriptions_own') THEN
    CREATE POLICY push_subscriptions_own ON public.push_subscriptions FOR ALL TO authenticated
      USING (user_id = public.app_user_id()) WITH CHECK (user_id = public.app_user_id());
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

REVOKE EXECUTE ON FUNCTION public.self_service_take(uuid, jsonb, text), public.drop_box_return(uuid[], text),
  public.check_backup_reminder() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.self_service_take(uuid, jsonb, text), public.drop_box_return(uuid[], text),
  public.check_backup_reminder() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_backup_reminder() TO service_role;
-- Seules fonctions ouvertes sans connexion : la page « outil trouvé »
REVOKE EXECUTE ON FUNCTION public.found_tool_lookup(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.found_tool_info(text), public.report_found_tool(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.found_tool_info(text), public.report_found_tool(text, text, text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_push_notifications(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_notifications(integer) TO service_role;

ALTER FUNCTION public.self_service_take(uuid, jsonb, text) SET search_path = public, extensions;
ALTER FUNCTION public.drop_box_return(uuid[], text) SET search_path = public, extensions;
ALTER FUNCTION public.check_due_reminders() SET search_path = public, extensions;
ALTER FUNCTION public.found_tool_lookup(text) SET search_path = public, extensions;
ALTER FUNCTION public.found_tool_info(text) SET search_path = public, extensions;
ALTER FUNCTION public.report_found_tool(text, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.check_backup_reminder() SET search_path = public, extensions;
ALTER FUNCTION public.claim_push_notifications(integer) SET search_path = public, extensions;
