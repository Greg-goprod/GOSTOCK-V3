/*
  Pilotage : journal d'audit, relances, rapport mensuel, indicateurs

  - audit_log : qui a modifié quoi et quand (personnes et rôles, articles, demandes, sorties,
    véhicules, réglages, entretiens, commandes, incidents). Les recalculs automatiques
    (quantité disponible, état calculé) ne sont pas journalisés : seules les vraies
    modifications le sont. Lecture : responsables et administrateurs.
  - check_due_reminders() : un avis par personne et par jour — matériel à rendre demain,
    matériel en retard — et, après 3 jours de retard, une alerte au magasin (une fois par
    emprunt). Appelée à chaque ouverture de l'application et par l'envoi des e-mails.
  - check_monthly_report() : le 1er du mois, un résumé du mois écoulé pour les destinataires
    des alertes « rapport mensuel ».
  - tool_usage : taux d'utilisation des outils sur 90 jours ; late_returns_by_person.
*/

-- 1. Journal d'audit ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  table_name text NOT NULL,
  record_id text,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  changes jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS audit_log_at_idx ON public.audit_log (at DESC);
CREATE INDEX IF NOT EXISTS audit_log_record_idx ON public.audit_log (table_name, record_id);

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

  INSERT INTO public.audit_log (user_id, table_name, record_id, action, changes)
  VALUES (public.app_user_id(), TG_TABLE_NAME,
          COALESCE(v_new->>'id', v_old->>'id', v_new->>'user_id', v_old->>'user_id'),
          lower(TG_OP), v_changes);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'user_depots', 'equipment', 'requests', 'checkouts', 'vehicles', 'system_settings',
    'organizations', 'depots', 'maintenance_plans', 'purchase_orders', 'incidents', 'notification_recipients',
    'consumable_stock'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = t || '_audit_trigger' AND tgrelid = ('public.' || t)::regclass) THEN
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()',
                     t || '_audit_trigger', t);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_log' AND policyname = 'audit_log_read') THEN
    CREATE POLICY audit_log_read ON public.audit_log FOR SELECT TO authenticated
      USING (public.app_has('approve') OR public.app_has('settings'));
  END IF;
END $$;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

-- 2. Relances de retour ------------------------------------------------------------------
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
  -- À rendre demain : un avis par personne
  INSERT INTO public.notifications (organization_id, kind, title, message, recipient_user_id, dedupe_key)
  SELECT public.default_organization_id(), 'return_reminder', 'À rendre demain',
         'À rendre demain : ' || string_agg(e.name, ', ' ORDER BY e.name) || '.',
         u.id, 'return_reminder:' || u.id || ':' || v_today
  FROM public.checkouts c
  JOIN public.users u ON u.id = c.user_id
  JOIN public.equipment e ON e.id = c.equipment_id
  WHERE c.status = 'active'
    AND (c.due_date AT TIME ZONE 'Europe/Zurich')::date = (now() AT TIME ZONE 'Europe/Zurich')::date + 1
  GROUP BY u.id
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  -- En retard : un avis par personne et par jour
  INSERT INTO public.notifications (organization_id, kind, title, message, recipient_user_id, dedupe_key)
  SELECT public.default_organization_id(), 'return_overdue', 'Matériel en retard',
         'Merci de rendre au plus vite : ' || string_agg(e.name || ' (prévu le ' || to_char(c.due_date AT TIME ZONE 'Europe/Zurich', 'DD.MM') || ')', ', ' ORDER BY c.due_date) || '.',
         u.id, 'return_overdue:' || u.id || ':' || v_today
  FROM public.checkouts c
  JOIN public.users u ON u.id = c.user_id
  JOIN public.equipment e ON e.id = c.equipment_id
  WHERE c.status IN ('active', 'overdue') AND c.due_date < now()
  GROUP BY u.id
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  -- Plus de 3 jours de retard : le magasin est prévenu (une fois par emprunt)
  INSERT INTO public.notifications (organization_id, kind, title, message, equipment_id, dedupe_key)
  SELECT public.default_organization_id(), 'return_escalation', 'Retard de plus de 3 jours : ' || e.name,
         format('%s %s n''a pas rendu « %s », attendu le %s.', u.first_name, u.last_name, e.name, to_char(c.due_date AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY')),
         e.id, 'return_escalation:' || c.id
  FROM public.checkouts c
  JOIN public.users u ON u.id = c.user_id
  JOIN public.equipment e ON e.id = c.equipment_id
  WHERE c.status IN ('active', 'overdue') AND c.due_date < now() - interval '3 days'
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  RETURN v_count;
END;
$$;

-- 3. Indicateurs -------------------------------------------------------------------------
-- Jours de sortie sur les 90 derniers jours, rapportés au nombre d'exemplaires
CREATE OR REPLACE VIEW public.tool_usage WITH (security_invoker = true) AS
SELECT
  e.id AS equipment_id,
  e.name,
  e.article_number,
  COALESCE(e.total_quantity, 1) AS units,
  COALESCE(e.purchase_price, 0) AS purchase_price,
  round(COALESCE(u.days_out, 0)::numeric, 1) AS days_out,
  COALESCE(u.checkouts, 0) AS checkouts,
  round(COALESCE(u.days_out, 0)::numeric / (90.0 * GREATEST(COALESCE(e.total_quantity, 1), 1)) * 100, 1) AS usage_rate,
  u.last_checkout
FROM public.equipment e
LEFT JOIN LATERAL (
  SELECT count(*) AS checkouts,
         max(c.checkout_date) AS last_checkout,
         sum(extract(epoch FROM LEAST(COALESCE(c.return_date, now()), now()) - GREATEST(c.checkout_date, now() - interval '90 days')) / 86400.0) AS days_out
  FROM public.checkouts c
  WHERE c.equipment_id = e.id
    AND COALESCE(c.return_date, now()) > now() - interval '90 days'
) u ON true
WHERE COALESCE(e.item_type, 'tool') <> 'consumable' AND e.status <> 'retired';

CREATE OR REPLACE VIEW public.late_returns_by_person WITH (security_invoker = true) AS
SELECT
  u.id AS user_id,
  u.first_name || ' ' || u.last_name AS name,
  count(*) FILTER (WHERE c.return_date > c.due_date) AS late_returns,
  count(*) FILTER (WHERE c.status IN ('active', 'overdue') AND c.due_date < now()) AS overdue_now,
  count(*) AS checkouts
FROM public.users u
JOIN public.checkouts c ON c.user_id = u.id AND c.checkout_date > now() - interval '90 days'
GROUP BY u.id, u.first_name, u.last_name;

-- 4. Rapport mensuel ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.monthly_report(p_month date DEFAULT (date_trunc('month', now()) - interval '1 month')::date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH bounds AS (SELECT date_trunc('month', p_month)::timestamptz AS start, (date_trunc('month', p_month) + interval '1 month')::timestamptz AS stop)
  SELECT jsonb_build_object(
    'month', to_char(p_month, 'MM.YYYY'),
    'checkouts', (SELECT count(*) FROM public.checkouts c, bounds b WHERE c.checkout_date >= b.start AND c.checkout_date < b.stop),
    'late_returns', (SELECT count(*) FROM public.checkouts c, bounds b WHERE c.return_date >= b.start AND c.return_date < b.stop AND c.return_date > c.due_date),
    'overdue_now', (SELECT count(*) FROM public.checkouts c WHERE c.status IN ('active', 'overdue') AND c.due_date < now()),
    'low_stock', (SELECT count(*) FROM public.low_stock_items),
    'consumables_value', (SELECT COALESCE(round(sum(l.amount), 2), 0) FROM public.site_cost_lines l, bounds b WHERE l.source = 'consumable' AND l.at >= b.start AND l.at < b.stop),
    'incidents', (SELECT count(*) FROM public.incidents i, bounds b WHERE i.occurred_at >= b.start AND i.occurred_at < b.stop),
    'incidents_value', (SELECT COALESCE(round(sum(COALESCE(i.cost, e.purchase_price, 0)), 2), 0) FROM public.incidents i JOIN public.equipment e ON e.id = i.equipment_id, bounds b WHERE i.occurred_at >= b.start AND i.occurred_at < b.stop AND i.decision <> 'found'),
    'orders_value', (SELECT COALESCE(round(sum(l.received * COALESCE(l.unit_price, 0)), 2), 0) FROM public.purchase_order_lines l JOIN public.purchase_orders o ON o.id = l.order_id, bounds b WHERE o.created_at >= b.start AND o.created_at < b.stop),
    'fuel_value', (SELECT COALESCE(round(sum(f.amount), 2), 0) FROM public.fuel_entries f, bounds b WHERE f.filled_at >= b.start AND f.filled_at < b.stop),
    'km', (SELECT COALESCE(sum(t.end_km - t.start_km), 0) FROM public.vehicle_trips t, bounds b WHERE t.end_at >= b.start AND t.end_at < b.stop)
  );
$$;

CREATE OR REPLACE FUNCTION public.check_monthly_report()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month date := (date_trunc('month', now() AT TIME ZONE 'Europe/Zurich') - interval '1 month')::date;
  r jsonb;
  v_count integer;
BEGIN
  r := public.monthly_report(v_month);
  INSERT INTO public.notifications (organization_id, kind, title, message, dedupe_key)
  VALUES (public.default_organization_id(), 'monthly_report', 'Rapport GO-Mat · ' || (r->>'month'),
          format('%s sorties, %s retours en retard (%s encore en retard), %s consommables sous le seuil. Consommables CHF %s, commandes reçues CHF %s, carburant CHF %s, %s km. %s perte(s)/casse(s) pour CHF %s.',
                 r->>'checkouts', r->>'late_returns', r->>'overdue_now', r->>'low_stock', r->>'consumables_value',
                 r->>'orders_value', r->>'fuel_value', r->>'km', r->>'incidents', r->>'incidents_value'),
          'monthly_report:' || to_char(v_month, 'YYYYMM'))
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT SELECT ON public.tool_usage, public.late_returns_by_person TO authenticated;

REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_due_reminders() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.monthly_report(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_monthly_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_due_reminders(), public.check_monthly_report() TO authenticated, service_role;
-- Totaux de l'entreprise : pas pour tous les membres (le tableau de pilotage lit les vues, filtrées par les droits)
REVOKE EXECUTE ON FUNCTION public.monthly_report(date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.monthly_report(date) TO service_role;

ALTER FUNCTION public.audit_trigger() SET search_path = public, extensions;
ALTER FUNCTION public.check_due_reminders() SET search_path = public, extensions;
ALTER FUNCTION public.monthly_report(date) SET search_path = public, extensions;
ALTER FUNCTION public.check_monthly_report() SET search_path = public, extensions;
