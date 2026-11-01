/*
  Module 0 — étape 0.4 : fonctions SECURITY DEFINER et tâches planifiées

  Une fonction SECURITY DEFINER ignore les règles de table : l'isolation par entreprise (migration 35)
  ne la protège pas. Cette migration :
    1. pose un garde d'écriture sur toutes les tables : un utilisateur connecté ne peut écrire (même via une
       fonction) que dans son entreprise active. Les tâches qui couvrent volontairement toutes les entreprises
       (rappels, rapports, recalculs) l'écartent pour leur propre durée (réglage de fonction app.org_guard_off) ;
    2. corrige les fonctions qui lisent ou comptent sans filtre d'entreprise (annuaire, qui a quoi, badges,
       chantiers par nom, types d'entretien, page « outil trouvé », rapport mensuel, push, SMS, inventaire) ;
    3. fait poser aux tâches planifiées l'entreprise de la ligne concernée (et non plus l'entreprise historique) ;
    4. retire l'accès anonyme aux fonctions qui n'en ont pas besoin.
  Reste à faire ailleurs : sauvegarde automatique par entreprise (fonction de bord), stockage de fichiers (0.5).
*/

-- 1. Garde d'écriture ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_org uuid;
BEGIN
  -- Pas d'utilisateur (tâches planifiées, console) ou tâche inter-entreprises déclarée : pas de contrôle
  IF auth.uid() IS NULL OR current_setting('app.org_guard_off', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  v_org := public.app_org_id();
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Cette donnée appartient à une autre entreprise' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Écriture refusée : cette donnée n''appartient pas à ton entreprise' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
      AND c.relname NOT IN ('organizations', 'platform_admins', 'account_context')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS a_org_write_guard ON public.%I', t);
    EXECUTE format('CREATE TRIGGER a_org_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.org_write_guard()', t);
  END LOOP;
END $$;

-- Tâches inter-entreprises : le garde est écarté pendant leur exécution
ALTER FUNCTION public.whoami() SET "app.org_guard_off" = 'on';
ALTER FUNCTION public.seed_organization(uuid) SET "app.org_guard_off" = 'on';
ALTER FUNCTION public.platform_create_organization(text, text, text, text) SET "app.org_guard_off" = 'on';
ALTER FUNCTION public.platform_set_organization_active(uuid, boolean) SET "app.org_guard_off" = 'on';
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'check_due_reminders', 'check_equipment_deadlines', 'check_maintenance_due', 'check_people_deadlines',
    'check_training_rental_deadlines', 'check_vehicle_deadlines', 'check_backup_reminder', 'check_monthly_report',
    'claim_push_notifications', 'claim_sms_notifications', 'claim_notification_emails'
  ] LOOP
    EXECUTE COALESCE((
      SELECT string_agg(format('ALTER FUNCTION %s SET "app.org_guard_off" = ''on''', p.oid::regprocedure), '; ')
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f
    ), 'SELECT 1');
  END LOOP;
END $$;

-- 2. Lectures sans filtre d'entreprise ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.people_directory()
RETURNS TABLE (id uuid, first_name text, last_name text, department text, active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT u.id, u.first_name::text, u.last_name::text, u.department::text, u.active
  FROM public.users u
  WHERE public.app_is_member() AND u.organization_id = public.app_org_id()
  ORDER BY u.last_name, u.first_name;
$$;

CREATE OR REPLACE FUNCTION public.who_has()
RETURNS TABLE (equipment_id uuid, user_id uuid, holder_name text, checkout_date timestamptz, due_date timestamptz, notes text, dropped_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT c.equipment_id, c.user_id, trim(u.first_name || ' ' || u.last_name), c.checkout_date, c.due_date, c.notes, c.dropped_at
  FROM public.checkouts c
  JOIN public.users u ON u.id = c.user_id
  WHERE public.app_is_member() AND c.status IN ('active', 'overdue') AND c.organization_id = public.app_org_id();
$$;

CREATE OR REPLACE FUNCTION public.find_user_by_badge(p_code text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code text := lower(regexp_replace(trim(p_code), '^GOMAT-USER:', '', 'i'));
  v_user uuid;
BEGIN
  IF NOT public.app_has('scan') THEN
    RAISE EXCEPTION 'Seul le magasin peut scanner un badge';
  END IF;
  SELECT b.user_id INTO v_user
  FROM public.user_badges b JOIN public.users u ON u.id = b.user_id
  WHERE b.code = v_code AND u.active AND u.organization_id = public.app_org_id()
    AND (u.access_until IS NULL OR u.access_until >= (now() AT TIME ZONE 'Europe/Zurich')::date);
  RETURN v_user;
END;
$$;

CREATE OR REPLACE FUNCTION public.badge_problem(p_code text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code text := lower(regexp_replace(trim(p_code), '^GOMAT-USER:', '', 'i'));
  v_user public.users;
BEGIN
  IF NOT public.app_has('scan') THEN
    RAISE EXCEPTION 'Seul le magasin peut scanner un badge';
  END IF;
  SELECT u.* INTO v_user FROM public.user_badges b JOIN public.users u ON u.id = b.user_id
  WHERE b.code = v_code AND u.organization_id = public.app_org_id();
  IF NOT FOUND THEN
    RETURN 'Badge inconnu';
  END IF;
  IF NOT v_user.active THEN
    RETURN format('%s %s est parti(e)%s : badge désactivé', v_user.first_name, v_user.last_name,
                  COALESCE(' le ' || to_char(v_user.left_on, 'DD.MM.YYYY'), ''));
  END IF;
  IF v_user.access_until IS NOT NULL AND v_user.access_until < (now() AT TIME ZONE 'Europe/Zurich')::date THEN
    RETURN format('Accès de %s %s échu le %s : prolonge la date « accès jusqu''au » dans « Personnes »',
                  v_user.first_name, v_user.last_name, to_char(v_user.access_until, 'DD.MM.YYYY'));
  END IF;
  RETURN NULL;
END;
$$;

-- Chantier désigné par un texte libre : cherché dans l'entreprise de la ligne
DROP FUNCTION IF EXISTS public.site_id_for(text);
CREATE OR REPLACE FUNCTION public.site_id_for(p_text text, p_organization_id uuid DEFAULT public.new_row_org_id())
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT s.id
  FROM unnest(string_to_array(COALESCE(p_text, ''), ' · ')) WITH ORDINALITY AS part(txt, n)
  JOIN public.sites s ON public.site_key(s.name) = public.site_key(part.txt) AND s.organization_id = p_organization_id
  ORDER BY part.n
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.link_site()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_text text := to_jsonb(NEW) ->> TG_ARGV[0];
  v_status text;
  v_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.site_id IS NULL THEN
      NEW.site_id := public.site_id_for(v_text, NEW.organization_id);
    END IF;
  ELSIF NEW.site_id IS NOT DISTINCT FROM OLD.site_id AND v_text IS DISTINCT FROM (to_jsonb(OLD) ->> TG_ARGV[0]) THEN
    NEW.site_id := public.site_id_for(v_text, NEW.organization_id);
  END IF;

  -- Chantier clôturé : plus de nouvelles sorties (les retours restent possibles)
  IF TG_OP = 'INSERT' AND NEW.site_id IS NOT NULL
     AND (TG_TABLE_NAME <> 'stock_movements' OR to_jsonb(NEW) ->> 'kind' = 'consumption') THEN
    SELECT status, name INTO v_status, v_name FROM public.sites WHERE id = NEW.site_id;
    IF v_status = 'closed' THEN
      RAISE EXCEPTION 'Le chantier « % » est clôturé : rouvre-le dans « Chantiers » pour y sortir du matériel', v_name
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sites_link_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND public.site_key(NEW.name) = public.site_key(OLD.name) THEN
    RETURN NEW;
  END IF;
  UPDATE public.requests SET site_id = NEW.id
  WHERE site_id IS NULL AND organization_id = NEW.organization_id AND public.site_id_for(destination, NEW.organization_id) = NEW.id;
  UPDATE public.delivery_notes SET site_id = NEW.id
  WHERE site_id IS NULL AND organization_id = NEW.organization_id AND public.site_id_for(notes, NEW.organization_id) = NEW.id;
  UPDATE public.stock_movements SET site_id = NEW.id
  WHERE site_id IS NULL AND organization_id = NEW.organization_id AND public.site_id_for(destination, NEW.organization_id) = NEW.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintenance_type_id(p_name text, p_color text DEFAULT '#3b82f6')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
  v_org uuid := public.new_row_org_id();
BEGIN
  SELECT id INTO v_id FROM public.maintenance_types WHERE lower(name) = lower(p_name) AND organization_id = v_org LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.maintenance_types (organization_id, name, color, description)
    VALUES (v_org, p_name, p_color, 'Créé automatiquement par GO-Mat')
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

-- Recalculs globaux : appelés par un utilisateur, ils ne touchent que son entreprise ; par la tâche planifiée, toutes
CREATE OR REPLACE FUNCTION public.update_overdue_checkouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.checkouts
  SET status = 'overdue'
  WHERE status = 'active' AND DATE(due_date) < CURRENT_DATE
    AND (auth.uid() IS NULL OR organization_id = public.app_org_id());

  WITH checkout_counts AS (
    SELECT delivery_note_id,
           COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
           COUNT(*) FILTER (WHERE status = 'returned') AS returned_count,
           COUNT(*) AS total_count
    FROM public.checkouts
    WHERE delivery_note_id IS NOT NULL AND (auth.uid() IS NULL OR organization_id = public.app_org_id())
    GROUP BY delivery_note_id
  )
  UPDATE public.delivery_notes dn
  SET status = CASE
      WHEN cc.overdue_count > 0 THEN 'overdue'
      WHEN cc.returned_count = cc.total_count THEN 'returned'
      WHEN cc.returned_count > 0 AND cc.returned_count < cc.total_count THEN 'partial'
      ELSE 'active' END
  FROM checkout_counts cc
  WHERE dn.id = cc.delivery_note_id AND (auth.uid() IS NULL OR dn.organization_id = public.app_org_id());
END;
$$;

CREATE OR REPLACE FUNCTION public.force_update_overdue_checkouts(reference_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.checkouts
  SET status = 'overdue'
  WHERE status = 'active' AND DATE(due_date) < DATE(reference_timestamp)
    AND (auth.uid() IS NULL OR organization_id = public.app_org_id());

  WITH checkout_counts AS (
    SELECT delivery_note_id,
           COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
           COUNT(*) FILTER (WHERE status = 'returned') AS returned_count,
           COUNT(*) AS total_count
    FROM public.checkouts
    WHERE delivery_note_id IS NOT NULL AND (auth.uid() IS NULL OR organization_id = public.app_org_id())
    GROUP BY delivery_note_id
  )
  UPDATE public.delivery_notes dn
  SET status = CASE
      WHEN cc.overdue_count > 0 THEN 'overdue'
      WHEN cc.returned_count = cc.total_count THEN 'returned'
      WHEN cc.returned_count > 0 AND cc.returned_count < cc.total_count THEN 'partial'
      ELSE 'active' END
  FROM checkout_counts cc
  WHERE dn.id = cc.delivery_note_id AND (auth.uid() IS NULL OR dn.organization_id = public.app_org_id());
END;
$$;

CREATE OR REPLACE FUNCTION public.update_equipment_availability()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  UPDATE public.equipment SET total_quantity = total_quantity
  WHERE auth.uid() IS NULL OR organization_id = public.app_org_id();
$$;

-- 3. Page « outil trouvé » (publique) : l'entreprise est celle de l'outil -----------------------------
CREATE OR REPLACE FUNCTION public.found_tool_info(p_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH f AS (
    SELECT e.organization_id AS org
    FROM public.equipment e WHERE e.id = public.found_tool_lookup(left(p_code, 100))
  )
  SELECT jsonb_build_object(
    'company', (SELECT o.name FROM public.organizations o JOIN f ON f.org = o.id),
    'phone', NULLIF((SELECT s.value FROM public.system_settings s JOIN f ON f.org = s.organization_id WHERE s.id = 'found_phone'), ''),
    'message', (SELECT s.value FROM public.system_settings s JOIN f ON f.org = s.organization_id WHERE s.id = 'found_message'),
    'known', EXISTS (SELECT 1 FROM f)
  )
$$;

CREATE OR REPLACE FUNCTION public.report_found_tool(p_code text, p_contact text, p_place text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid := public.found_tool_lookup(left(p_code, 100));
  v_name text;
  v_org uuid;
BEGIN
  IF v_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT name, organization_id INTO v_name, v_org FROM public.equipment WHERE id = v_id;
  INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id, dedupe_key)
  VALUES (v_org, 'tool_found', 'Outil trouvé : ' || v_name,
          format('Quelqu''un a trouvé « %s » (%s). Lieu : %s. Contact : %s.', v_name, left(btrim(p_code), 60),
                 COALESCE(NULLIF(left(btrim(p_place), 200), ''), 'non précisé'), COALESCE(NULLIF(left(btrim(p_contact), 200), ''), 'non précisé')),
          v_id, 'tool_found:' || v_id || ':' || to_char(now(), 'YYYYMMDDHH24'))
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN true;
END;
$$;

-- 4. Rapport mensuel et rappels par entreprise ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.monthly_report(date);
CREATE OR REPLACE FUNCTION public.monthly_report(p_month date DEFAULT (date_trunc('month', now() AT TIME ZONE 'Europe/Zurich') - interval '1 month')::date,
                                                 p_organization_id uuid DEFAULT public.default_organization_id())
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH bounds AS (SELECT date_trunc('month', p_month)::timestamptz AS start, (date_trunc('month', p_month) + interval '1 month')::timestamptz AS stop)
  SELECT jsonb_build_object(
    'month', to_char(p_month, 'MM.YYYY'),
    'checkouts', (SELECT count(*) FROM public.checkouts c, bounds b WHERE c.organization_id = p_organization_id AND c.checkout_date >= b.start AND c.checkout_date < b.stop),
    'late_returns', (SELECT count(*) FROM public.checkouts c, bounds b WHERE c.organization_id = p_organization_id AND c.return_date >= b.start AND c.return_date < b.stop AND c.return_date > c.due_date),
    'overdue_now', (SELECT count(*) FROM public.checkouts c WHERE c.organization_id = p_organization_id AND c.status IN ('active', 'overdue') AND c.due_date < now()),
    'low_stock', (SELECT count(*) FROM public.low_stock_items l WHERE l.organization_id = p_organization_id),
    'consumables_value', (SELECT COALESCE(round(sum(- m.quantity * COALESCE(e.purchase_price, 0)), 2), 0)
                          FROM public.stock_movements m JOIN public.equipment e ON e.id = m.equipment_id, bounds b
                          WHERE m.organization_id = p_organization_id AND m.kind = 'consumption' AND m.created_at >= b.start AND m.created_at < b.stop),
    'incidents', (SELECT count(*) FROM public.incidents i, bounds b WHERE i.organization_id = p_organization_id AND i.occurred_at >= b.start AND i.occurred_at < b.stop),
    'incidents_value', (SELECT COALESCE(round(sum(COALESCE(i.cost, e.purchase_price, 0)), 2), 0) FROM public.incidents i JOIN public.equipment e ON e.id = i.equipment_id, bounds b WHERE i.organization_id = p_organization_id AND i.occurred_at >= b.start AND i.occurred_at < b.stop AND i.decision <> 'found'),
    'orders_value', (SELECT COALESCE(round(sum(l.received * COALESCE(l.unit_price, 0)), 2), 0) FROM public.purchase_order_lines l JOIN public.purchase_orders o ON o.id = l.order_id, bounds b WHERE o.organization_id = p_organization_id AND o.created_at >= b.start AND o.created_at < b.stop),
    'fuel_value', (SELECT COALESCE(round(sum(f.amount), 2), 0) FROM public.fuel_entries f, bounds b WHERE f.organization_id = p_organization_id AND f.filled_at >= b.start AND f.filled_at < b.stop),
    'km', (SELECT COALESCE(sum(t.end_km - t.start_km), 0) FROM public.vehicle_trips t, bounds b WHERE t.organization_id = p_organization_id AND t.end_at >= b.start AND t.end_at < b.stop)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.monthly_report(date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.monthly_report(date, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.check_monthly_report()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
SET "app.org_guard_off" = 'on'
AS $$
DECLARE
  v_month date := (date_trunc('month', now() AT TIME ZONE 'Europe/Zurich') - interval '1 month')::date;
  v_org uuid;
  r jsonb;
  v_count integer := 0;
  v_n integer;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations WHERE active LOOP
    r := public.monthly_report(v_month, v_org);
    INSERT INTO public.notifications (organization_id, kind, title, message, dedupe_key)
    VALUES (v_org, 'monthly_report', 'Rapport GO-Mat · ' || (r->>'month'),
            format('%s sorties, %s retours en retard (%s encore en retard), %s consommables sous le seuil. Consommables CHF %s, commandes reçues CHF %s, carburant CHF %s, %s km. %s perte(s)/casse(s) pour CHF %s.',
                   r->>'checkouts', r->>'late_returns', r->>'overdue_now', r->>'low_stock', r->>'consumables_value',
                   r->>'orders_value', r->>'fuel_value', r->>'km', r->>'incidents', r->>'incidents_value'),
            'monthly_report:' || v_org || ':' || to_char(v_month, 'YYYYMM'))
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_backup_reminder()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
SET "app.org_guard_off" = 'on'
AS $$
DECLARE
  v_org uuid;
  v_last timestamptz;
  v_count integer := 0;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations WHERE active LOOP
    SELECT max(NULLIF(value, '')::timestamptz) INTO v_last
    FROM public.system_settings WHERE organization_id = v_org AND id IN ('last_backup_at', 'last_auto_backup_at');
    IF v_last IS NOT NULL AND v_last > now() - interval '30 days' THEN
      CONTINUE;
    END IF;
    INSERT INTO public.notifications (organization_id, kind, title, message, dedupe_key)
    VALUES (v_org, 'backup_due', 'Sauvegarde du mois',
            CASE WHEN v_last IS NULL THEN 'Aucune sauvegarde complète n''a encore été faite. Paramètres → Sauvegarde.'
                 ELSE format('Dernière sauvegarde le %s. Paramètres → Sauvegarde.', to_char(v_last AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY')) END,
            'backup_due:' || v_org || ':' || to_char(now(), 'YYYYMM'))
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- SMS et notifications push : l'entreprise de la notification décide des réglages et des destinataires
CREATE OR REPLACE FUNCTION public.claim_sms_notifications(p_limit integer DEFAULT 20)
RETURNS TABLE (id uuid, phone text, title text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
SET "app.org_guard_off" = 'on'
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE public.notifications n SET sms_sent_at = now()
    WHERE n.id IN (
      SELECT x.id FROM public.notifications x
      JOIN public.users u ON u.id = x.recipient_user_id AND u.organization_id = x.organization_id
      JOIN public.system_settings s ON s.organization_id = x.organization_id AND s.id = 'sms_enabled' AND s.value = 'true'
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

CREATE OR REPLACE FUNCTION public.claim_push_notifications(p_limit integer DEFAULT 20)
RETURNS TABLE (id uuid, kind text, title text, message text, subscriptions jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
SET "app.org_guard_off" = 'on'
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
    RETURNING n.id, n.kind, n.title, n.message, n.recipient_user_id, n.depot_id, n.organization_id
  ),
  staff AS (
    SELECT u.id, u.organization_id
    FROM public.users u
    WHERE u.active AND (u.access_until IS NULL OR u.access_until >= current_date)
      AND (public.role_permissions(u.role) || COALESCE(u.permissions, '{}')) && ARRAY['scan', 'approve', 'manage_stock', 'manage_people']
  )
  SELECT c.id, c.kind, c.title, c.message,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
           FROM public.push_subscriptions s
           WHERE (c.recipient_user_id IS NOT NULL AND s.user_id = c.recipient_user_id)
              OR (c.recipient_user_id IS NULL AND s.user_id IN (SELECT st.id FROM staff st WHERE st.organization_id = c.organization_id)
                  AND (c.depot_id IS NULL
                       OR NOT EXISTS (SELECT 1 FROM public.user_depots ud WHERE ud.user_id = s.user_id)
                       OR EXISTS (SELECT 1 FROM public.user_depots ud WHERE ud.user_id = s.user_id AND ud.depot_id = c.depot_id)
                       OR 'all_depots' = ANY (public.role_permissions((SELECT role FROM public.users WHERE users.id = s.user_id)))))
         ), '[]'::jsonb)
  FROM claimed c;
END;
$$;

-- 5. Inventaire et commandes : le dépôt par défaut et les articles sont ceux de l'entreprise -------------
CREATE OR REPLACE FUNCTION public.start_inventory_count(p_depot_id uuid, p_size integer DEFAULT 20)
RETURNS public.inventory_counts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count public.inventory_counts;
  v_org uuid := (SELECT organization_id FROM public.depots WHERE id = p_depot_id);
  v_default uuid;
BEGIN
  IF v_org IS NULL OR (auth.uid() IS NOT NULL AND v_org IS DISTINCT FROM public.app_org_id()) THEN
    RAISE EXCEPTION 'Dépôt introuvable';
  END IF;
  v_default := (SELECT id FROM public.depots WHERE is_default AND organization_id = v_org LIMIT 1);
  IF current_setting('role', true) = 'authenticated'
     AND (NOT (public.app_has('manage_stock') OR public.app_has('scan')) OR NOT public.app_depot_ok(p_depot_id)) THEN
    RAISE EXCEPTION 'Inventaire réservé au magasin de ce dépôt';
  END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_counts WHERE depot_id = p_depot_id AND status = 'open') THEN
    RAISE EXCEPTION 'Un inventaire est déjà en cours dans ce dépôt';
  END IF;

  INSERT INTO public.inventory_counts (organization_id, depot_id, started_by) VALUES (v_org, p_depot_id, public.app_user_id())
  RETURNING * INTO v_count;

  -- Les articles du dépôt comptés depuis le plus longtemps (jamais comptés d'abord), puis les plus chers
  INSERT INTO public.inventory_count_lines (organization_id, count_id, equipment_id, expected)
  SELECT v_org, v_count.id, c.id, public.inventory_expected(c.id, p_depot_id)
  FROM (
    SELECT e.id,
           (SELECT max(l.counted_at) FROM public.inventory_count_lines l
              JOIN public.inventory_counts ic ON ic.id = l.count_id
             WHERE l.equipment_id = e.id AND ic.depot_id = p_depot_id AND l.counted IS NOT NULL) AS last_counted,
           COALESCE(e.purchase_price, 0) * public.inventory_expected(e.id, p_depot_id) AS value
    FROM public.equipment e
    WHERE e.organization_id = v_org AND e.status <> 'retired'
      AND ((e.item_type = 'consumable' AND EXISTS (SELECT 1 FROM public.consumable_stock s WHERE s.equipment_id = e.id AND s.depot_id = p_depot_id))
        OR (COALESCE(e.item_type, 'tool') <> 'consumable' AND COALESCE(e.depot_id, v_default) = p_depot_id))
    ORDER BY last_counted NULLS FIRST, value DESC
    LIMIT GREATEST(1, p_size)
  ) c;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_orders_from_low_stock(p_depot_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_supplier uuid;
  v_order uuid;
  v_orders integer := 0;
  v_org uuid := (SELECT organization_id FROM public.depots WHERE id = p_depot_id);
BEGIN
  IF v_org IS NULL OR (auth.uid() IS NOT NULL AND v_org IS DISTINCT FROM public.app_org_id()) THEN
    RAISE EXCEPTION 'Dépôt introuvable';
  END IF;
  IF current_setting('role', true) = 'authenticated' AND NOT public.app_has('manage_stock') THEN
    RAISE EXCEPTION 'Seul un gestionnaire de stock passe commande';
  END IF;

  -- Fournisseurs ayant au moins une ligne à commander (sous le seuil, pas déjà en commande)
  FOR v_supplier IN
    SELECT DISTINCT e.supplier_id
    FROM public.low_stock_items lsi
    JOIN public.equipment e ON e.id = lsi.equipment_id
    LEFT JOIN public.open_order_quantities oq ON oq.equipment_id = lsi.equipment_id AND oq.depot_id = lsi.depot_id
    WHERE lsi.depot_id = p_depot_id AND e.supplier_id IS NOT NULL
      AND lsi.quantity_to_order - COALESCE(oq.quantity, 0) > 0
  LOOP
    INSERT INTO public.purchase_orders (organization_id, supplier_id, depot_id, created_by)
    VALUES (v_org, v_supplier, p_depot_id, public.app_user_id())
    RETURNING id INTO v_order;

    INSERT INTO public.purchase_order_lines (organization_id, order_id, equipment_id, quantity, unit_price)
    SELECT v_org, v_order, lsi.equipment_id, lsi.quantity_to_order - COALESCE(oq.quantity, 0), e.purchase_price
    FROM public.low_stock_items lsi
    JOIN public.equipment e ON e.id = lsi.equipment_id
    LEFT JOIN public.open_order_quantities oq ON oq.equipment_id = lsi.equipment_id AND oq.depot_id = lsi.depot_id
    WHERE lsi.depot_id = p_depot_id AND e.supplier_id = v_supplier
      AND lsi.quantity_to_order - COALESCE(oq.quantity, 0) > 0;

    v_orders := v_orders + 1;
  END LOOP;
  RETURN v_orders;
END;
$$;

-- 6. Journal d'audit et notifications : l'entreprise de la ligne ------------------------------------------
CREATE OR REPLACE FUNCTION public.notifications_set_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  -- Sans utilisateur (tâche planifiée) : l'entreprise de la personne, de l'article, du véhicule, de la demande ou du dépôt visés
  IF auth.uid() IS NULL THEN
    NEW.organization_id := COALESCE(
      (SELECT organization_id FROM public.users WHERE id = NEW.recipient_user_id),
      (SELECT organization_id FROM public.equipment WHERE id = NEW.equipment_id),
      (SELECT organization_id FROM public.vehicles WHERE id = NEW.vehicle_id),
      (SELECT organization_id FROM public.requests WHERE id = NEW.request_id),
      (SELECT organization_id FROM public.depots WHERE id = NEW.depot_id),
      NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS b_notifications_set_org ON public.notifications;
CREATE TRIGGER b_notifications_set_org BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_set_org();

-- 7. Accès anonyme : seules les fonctions de la page « outil trouvé » restent publiques --------------------
REVOKE EXECUTE ON FUNCTION public.extension_conflict(uuid, timestamptz, timestamptz, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_write_guard(), public.organizations_guard(), public.notifications_set_org() FROM PUBLIC, anon;
DO $$
BEGIN
  EXECUTE COALESCE((SELECT string_agg(format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', p.oid::regprocedure), '; ')
                    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'tools_availability'), 'SELECT 1');
END $$;
GRANT EXECUTE ON FUNCTION public.people_directory(), public.who_has(), public.find_user_by_badge(text), public.badge_problem(text),
  public.site_id_for(text, uuid), public.maintenance_type_id(text, text), public.start_inventory_count(uuid, integer),
  public.create_orders_from_low_stock(uuid), public.check_monthly_report(), public.check_backup_reminder(),
  public.claim_sms_notifications(integer), public.claim_push_notifications(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_sms_notifications(integer), public.claim_push_notifications(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.found_tool_info(text), public.report_found_tool(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extension_conflict(uuid, timestamptz, timestamptz, uuid[]) TO authenticated;
DO $$
BEGIN
  EXECUTE COALESCE((SELECT string_agg(format('GRANT EXECUTE ON FUNCTION %s TO authenticated', p.oid::regprocedure), '; ')
                    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'tools_availability'), 'SELECT 1');
END $$;

-- 8. Tâches planifiées : l'entreprise de la ligne concernée (version générée depuis les définitions précédentes)
CREATE OR REPLACE FUNCTION public.check_due_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_today text := to_char(now() AT TIME ZONE 'Europe/Zurich', 'YYYYMMDD');
  v_count integer := 0;
  v_n integer;
BEGIN
  INSERT INTO public.notifications (organization_id, kind, title, message, recipient_user_id, dedupe_key)
  SELECT u.organization_id, 'return_reminder', 'À rendre demain',
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
  SELECT u.organization_id, 'return_overdue', 'Matériel en retard',
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
  SELECT u.organization_id, 'return_escalation', 'Retard de plus de 3 jours : ' || e.name,
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
$function$;

CREATE OR REPLACE FUNCTION public.check_equipment_deadlines()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_count integer := 0;
  v_n integer;
BEGIN
  INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id, depot_id, dedupe_key)
  SELECT e.organization_id, 'warranty_end', 'Fin de garantie : ' || e.name,
         format('La garantie de « %s » se termine le %s. Un défaut à signaler ? C''est le moment de l''envoyer.', e.name, to_char(e.warranty_until, 'DD.MM.YYYY')),
         e.id, e.depot_id, 'warranty_end:' || e.id || ':' || e.warranty_until
  FROM public.equipment e
  WHERE e.warranty_until BETWEEN v_today AND v_today + 30 AND e.status <> 'retired'
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id, dedupe_key)
  SELECT e.organization_id, 'repair_late', 'Réparation en retard : ' || e.name,
         format('« %s » est chez %s depuis le %s (retour prévu le %s).', e.name, r.repairer, to_char(r.sent_on, 'DD.MM.YYYY'), to_char(r.expected_on, 'DD.MM.YYYY')),
         e.id, 'repair_late:' || r.id || ':' || r.expected_on
  FROM public.repair_orders r JOIN public.equipment e ON e.id = r.equipment_id
  WHERE r.status = 'sent' AND r.expected_on < v_today
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id, depot_id, dedupe_key)
  SELECT (SELECT e2.organization_id FROM public.equipment e2 WHERE e2.id = b.equipment_id), 'battery_end', 'Batterie en fin de vie : ' || b.name,
         format('« %s »%s : %s mois, %s sorties. À tester ou remplacer.', b.name, COALESCE(' (' || b.code || ')', ''), b.age_months, b.uses),
         b.equipment_id, b.depot_id, 'battery_end:' || COALESCE(b.instance_id, b.equipment_id)
  FROM public.battery_status b
  WHERE b.state = 'end'
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_people_deadlines()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_count integer := 0;
  v_n integer;
BEGIN
  -- EPI à renouveler dans 30 jours : la personne et le magasin, une fois par échéance
  INSERT INTO public.notifications (organization_id, kind, title, message, recipient_user_id, dedupe_key)
  SELECT u.organization_id, 'ppe_renewal', 'EPI à renouveler : ' || t.name,
         format('Ton %s%s est à renouveler le %s. Passe au magasin.', t.name, COALESCE(' (taille ' || i.size || ')', ''), to_char(i.renew_on, 'DD.MM.YYYY')),
         i.user_id, 'ppe_renewal:user:' || i.id
  FROM public.ppe_issues i
  JOIN public.ppe_types t ON t.id = i.ppe_type_id
  JOIN public.users u ON u.id = i.user_id AND u.active
  WHERE i.renew_on IS NOT NULL AND i.renew_on <= v_today + 30 AND i.returned_on IS NULL
    -- Pas d'alerte si un EPI du même type a été remis depuis
    AND NOT EXISTS (SELECT 1 FROM public.ppe_issues n WHERE n.user_id = i.user_id AND n.ppe_type_id = i.ppe_type_id AND n.issued_on > i.issued_on)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  INSERT INTO public.notifications (organization_id, kind, title, message, dedupe_key)
  SELECT u.organization_id, 'ppe_renewal', 'EPI à renouveler : ' || u.first_name || ' ' || u.last_name,
         format('%s %s : %s%s à renouveler le %s.', u.first_name, u.last_name, t.name, COALESCE(' taille ' || i.size, ''), to_char(i.renew_on, 'DD.MM.YYYY')),
         'ppe_renewal:staff:' || i.id
  FROM public.ppe_issues i
  JOIN public.ppe_types t ON t.id = i.ppe_type_id
  JOIN public.users u ON u.id = i.user_id AND u.active
  WHERE i.renew_on IS NOT NULL AND i.renew_on <= v_today + 30 AND i.returned_on IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.ppe_issues n WHERE n.user_id = i.user_id AND n.ppe_type_id = i.ppe_type_id AND n.issued_on > i.issued_on)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  -- Fin de mission dans 3 jours ou moins avec du matériel encore sorti
  INSERT INTO public.notifications (organization_id, kind, title, message, dedupe_key)
  SELECT u.organization_id, 'mission_end', 'Fin de mission : ' || u.first_name || ' ' || u.last_name,
         format('%s %s%s termine le %s et a encore : %s.', u.first_name, u.last_name, COALESCE(' (' || u.company || ')', ''),
                to_char(u.access_until, 'DD.MM.YYYY'), string_agg(e.name, ', ' ORDER BY e.name)),
         'mission_end:' || u.id || ':' || u.access_until
  FROM public.users u
  JOIN public.checkouts c ON c.user_id = u.id AND c.status IN ('active', 'overdue')
  JOIN public.equipment e ON e.id = c.equipment_id
  WHERE u.access_until IS NOT NULL AND u.access_until BETWEEN v_today AND v_today + 3
  GROUP BY u.id
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_training_rental_deadlines()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_count integer := 0;
  v_n integer;
BEGIN
  -- Formation qui expire dans 30 jours ou moins : la personne et le magasin, une fois par échéance
  INSERT INTO public.notifications (organization_id, kind, title, message, recipient_user_id, dedupe_key)
  SELECT u.organization_id, 'training_expiry', 'Formation à renouveler : ' || t.name,
         format('Ta formation « %s » %s le %s.', t.name, CASE WHEN ut.expires_on < v_today THEN 'a expiré' ELSE 'expire' END,
                to_char(ut.expires_on, 'DD.MM.YYYY')),
         ut.user_id, 'training_expiry:user:' || ut.id || ':' || ut.expires_on
  FROM public.user_trainings ut
  JOIN public.trainings t ON t.id = ut.training_id
  JOIN public.users u ON u.id = ut.user_id AND u.active
  WHERE ut.expires_on IS NOT NULL AND ut.expires_on <= v_today + 30
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  INSERT INTO public.notifications (organization_id, kind, title, message, dedupe_key)
  SELECT u.organization_id, 'training_expiry', 'Formation à renouveler : ' || u.first_name || ' ' || u.last_name,
         format('La formation « %s » de %s %s %s le %s.', t.name, u.first_name, u.last_name,
                CASE WHEN ut.expires_on < v_today THEN 'a expiré' ELSE 'expire' END, to_char(ut.expires_on, 'DD.MM.YYYY')),
         'training_expiry:staff:' || ut.id || ':' || ut.expires_on
  FROM public.user_trainings ut
  JOIN public.trainings t ON t.id = ut.training_id
  JOIN public.users u ON u.id = ut.user_id AND u.active
  WHERE ut.expires_on IS NOT NULL AND ut.expires_on <= v_today + 30
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  -- Location à rendre dans 2 jours ou moins : une alerte par échéance (repart si la date est prolongée)
  INSERT INTO public.notifications (organization_id, kind, title, message, depot_id, dedupe_key)
  SELECT r.organization_id, 'rental_due', 'Location à rendre : ' || r.description,
         format('« %s » loué chez %s%s est à rendre le %s. Prolongez-la ou organisez le retour.',
                r.description, r.rental_company, COALESCE(' pour ' || s.name, ''), to_char(r.end_on, 'DD.MM.YYYY')),
         r.depot_id, 'rental_due:' || r.id || ':' || r.end_on
  FROM public.rentals r
  LEFT JOIN public.sites s ON s.id = r.site_id
  WHERE r.returned_on IS NULL AND r.end_on BETWEEN v_today AND v_today + 2
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  -- En retard : chaque jour coûte ; une alerte par jour
  INSERT INTO public.notifications (organization_id, kind, title, message, depot_id, dedupe_key)
  SELECT r.organization_id, 'rental_due', 'Location en retard : ' || r.description,
         format('« %s » (%s) devait être rendu le %s : %s jour(s) facturé(s) en plus, %s CHF.',
                r.description, r.rental_company, to_char(r.end_on, 'DD.MM.YYYY'), v_today - r.end_on,
                to_char((v_today - r.end_on) * r.daily_rate * r.quantity, 'FM999G990D00')),
         r.depot_id, 'rental_overdue:' || r.id || ':' || v_today
  FROM public.rentals r
  WHERE r.returned_on IS NULL AND r.end_on < v_today
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  -- Le responsable de la location est prévenu aussi (avis personnel)
  INSERT INTO public.notifications (organization_id, kind, title, message, recipient_user_id, dedupe_key)
  SELECT r.organization_id, 'rental_due',
         CASE WHEN r.end_on < v_today THEN 'Location en retard' ELSE 'Location à rendre' END,
         format('« %s » loué chez %s est à rendre le %s.', r.description, r.rental_company, to_char(r.end_on, 'DD.MM.YYYY')),
         r.responsible_id,
         'rental_due:user:' || r.id || ':' || CASE WHEN r.end_on < v_today THEN v_today ELSE r.end_on END
  FROM public.rentals r
  WHERE r.returned_on IS NULL AND r.responsible_id IS NOT NULL AND r.end_on <= v_today + 2
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  RETURN v_count;
END;
$function$;

-- 9. Journal d'audit : entreprise de la ligne modifiée
CREATE OR REPLACE FUNCTION public.audit_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  -- Colonnes recalculées par la base ou techniques : pas des décisions humaines
  v_ignore text[] := ARRAY['available_quantity', 'image_cache_key', 'updated_at', 'email_claimed_at',
                           'email_attempts', 'emailed_at', 'email_error', 'current_km', 'fuel_level',
                           'article_counter'];
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb := '{}';
  v_key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_changes := v_new - v_ignore - 'start_signature' - 'end_signature';
  ELSIF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_changes := v_old - v_ignore - 'start_signature' - 'end_signature';
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key <> ALL (v_ignore) AND v_key NOT IN ('start_signature', 'end_signature')
         AND (v_old -> v_key) IS DISTINCT FROM (v_new -> v_key) THEN
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_array(v_old -> v_key, v_new -> v_key));
      END IF;
    END LOOP;
    -- Les quantités en stock sont déjà tracées par stock_movements : seuls les seuils comptent ici
    IF TG_TABLE_NAME = 'consumable_stock' THEN
      v_changes := v_changes - 'quantity';
    END IF;
    -- L'état d'un article change avec les sorties : seul un changement manuel (retrait du service) compte
    IF TG_TABLE_NAME = 'equipment' THEN
      v_changes := v_changes - 'status' || CASE WHEN (v_new->>'status' = 'retired') IS DISTINCT FROM (v_old->>'status' = 'retired')
                                               THEN jsonb_build_object('status', jsonb_build_array(v_old->'status', v_new->'status')) ELSE '{}' END;
    END IF;
    IF v_changes = '{}' THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_log (organization_id, user_id, table_name, record_id, action, changes)
  VALUES (COALESCE(NULLIF(COALESCE(v_new, v_old) ->> 'organization_id', '')::uuid, CASE WHEN TG_TABLE_NAME = 'organizations' THEN NULLIF(COALESCE(v_new, v_old) ->> 'id', '')::uuid END, public.new_row_org_id()), public.app_user_id(), TG_TABLE_NAME,
          COALESCE(v_new->>'id', v_old->>'id', v_new->>'user_id', v_old->>'user_id'),
          lower(TG_OP), v_changes);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

-- 10. Tâches inter-entreprises : garde écarté (à placer après les CREATE OR REPLACE, qui effacent les réglages de fonction)
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'check_due_reminders', 'check_equipment_deadlines', 'check_maintenance_due', 'check_people_deadlines',
    'check_training_rental_deadlines', 'check_vehicle_deadlines', 'check_backup_reminder', 'check_monthly_report',
    'claim_push_notifications', 'claim_sms_notifications', 'claim_notification_emails'
  ] LOOP
    EXECUTE COALESCE((
      SELECT string_agg(format('ALTER FUNCTION %s SET "app.org_guard_off" = ''on''', p.oid::regprocedure), '; ')
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f
    ), 'SELECT 1');
  END LOOP;
END $$;
