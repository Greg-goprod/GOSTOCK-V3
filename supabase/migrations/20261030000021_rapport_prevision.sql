/*
  Rapport de fin de chantier et prévision d'achat

  - site_report_lines : tout ce qui a été utilisé sur une fiche chantier (consommables, jours d'outils,
    locations) avec quantités, prix et montant — base du rapport PDF et de « préparer un chantier
    semblable ».
  - purchase_forecast : par consommable et par dépôt, la consommation des 90 derniers jours ramenée
    à 30 jours, plus les demandes à venir (30 jours), face au stock, au seuil et à ce qui est déjà
    commandé ; « to_order » est la quantité à commander pour le mois prochain.
*/

CREATE OR REPLACE VIEW public.site_report_lines WITH (security_invoker = true) AS
SELECT
  m.site_id,
  'consumable'::text AS source,
  m.equipment_id,
  e.name,
  e.unit,
  -m.quantity AS quantity,
  COALESCE(e.purchase_price, 0) AS unit_cost,
  -m.quantity * COALESCE(e.purchase_price, 0) AS amount,
  m.created_at AS at,
  m.user_id
FROM public.stock_movements m
JOIN public.equipment e ON e.id = m.equipment_id
WHERE m.site_id IS NOT NULL AND m.kind = 'consumption'
UNION ALL
SELECT
  dn.site_id,
  'tool',
  c.equipment_id,
  e.name,
  'jour',
  GREATEST(1, ceil(extract(epoch FROM COALESCE(c.return_date, now()) - c.checkout_date) / 86400.0))::numeric,
  COALESCE(e.daily_rate, 0),
  GREATEST(1, ceil(extract(epoch FROM COALESCE(c.return_date, now()) - c.checkout_date) / 86400.0)) * COALESCE(e.daily_rate, 0),
  c.checkout_date,
  c.user_id
FROM public.checkouts c
JOIN public.delivery_notes dn ON dn.id = c.delivery_note_id
JOIN public.equipment e ON e.id = c.equipment_id
WHERE dn.site_id IS NOT NULL
UNION ALL
SELECT
  rs.site_id,
  'rental',
  NULL::uuid,
  rs.description || ' (' || rs.rental_company || ')',
  'jour',
  rs.days_billed::numeric * rs.quantity,
  rs.daily_rate,
  rs.cost,
  rs.start_on::timestamptz,
  rs.responsible_id
FROM public.rental_status rs
WHERE rs.site_id IS NOT NULL;

CREATE OR REPLACE VIEW public.purchase_forecast WITH (security_invoker = true) AS
WITH consumed AS (
  SELECT equipment_id, depot_id, sum(-quantity) AS qty
  FROM public.stock_movements
  WHERE kind = 'consumption' AND created_at > now() - interval '90 days'
  GROUP BY equipment_id, depot_id
),
planned AS (
  SELECT i.equipment_id, r.depot_id, sum(i.quantity) AS qty
  FROM public.request_items i
  JOIN public.requests r ON r.id = i.request_id
  WHERE i.item_kind = 'consumable' AND r.status IN ('requested', 'approved', 'ready')
    AND r.start_at < now() + interval '30 days'
  GROUP BY i.equipment_id, r.depot_id
)
SELECT
  cs.equipment_id,
  cs.depot_id,
  d.name AS depot_name,
  e.name,
  e.unit,
  e.article_number,
  e.supplier_id,
  s.name AS supplier_name,
  s.lead_time_days,
  e.purchase_price,
  cs.quantity AS stock,
  cs.min_quantity,
  COALESCE(c.qty, 0) AS consumed_90,
  round(COALESCE(c.qty, 0) / 3.0, 1) AS usual_30,
  COALESCE(p.qty, 0) AS planned_30,
  COALESCE(oq.quantity, 0) AS on_order,
  ceil(COALESCE(c.qty, 0) / 3.0 + COALESCE(p.qty, 0)) AS need_30,
  GREATEST(0, ceil(COALESCE(c.qty, 0) / 3.0 + COALESCE(p.qty, 0) + cs.min_quantity - cs.quantity - COALESCE(oq.quantity, 0))) AS to_order
FROM public.consumable_stock cs
JOIN public.equipment e ON e.id = cs.equipment_id AND e.status <> 'retired'
JOIN public.depots d ON d.id = cs.depot_id
LEFT JOIN public.suppliers s ON s.id = e.supplier_id
LEFT JOIN consumed c ON c.equipment_id = cs.equipment_id AND c.depot_id = cs.depot_id
LEFT JOIN planned p ON p.equipment_id = cs.equipment_id AND p.depot_id = cs.depot_id
LEFT JOIN public.open_order_quantities oq ON oq.equipment_id = cs.equipment_id AND oq.depot_id = cs.depot_id;

GRANT SELECT ON public.site_report_lines, public.purchase_forecast TO authenticated, service_role;
