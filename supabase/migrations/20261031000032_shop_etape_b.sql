-- Lot 25 — Shop étape B
-- 1. Disponibilité de tous les outils sur une période, en un seul appel (catalogue par dates)
-- 2. « Souvent pris avec » : articles les plus souvent commandés avec un article donné

CREATE OR REPLACE FUNCTION public.tools_availability(p_start timestamptz, p_end timestamptz)
RETURNS TABLE (equipment_id uuid, free integer)
LANGUAGE sql
STABLE
AS $$
  SELECT e.id, public.tool_availability(e.id, p_start, p_end)
  FROM public.equipment e
  WHERE e.item_type IS DISTINCT FROM 'consumable' AND e.status <> 'retired' AND p_end > p_start;
$$;

GRANT EXECUTE ON FUNCTION public.tools_availability(timestamptz, timestamptz) TO authenticated;

-- SECURITY DEFINER : les demandes des autres ne sont pas lisibles par un collaborateur, mais le
-- résultat (identifiant d'article + nombre de commandes communes) ne révèle personne.
CREATE OR REPLACE FUNCTION public.often_taken_with(p_equipment_id uuid, p_limit integer DEFAULT 4)
RETURNS TABLE (equipment_id uuid, times integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.app_is_member() THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT b.equipment_id, count(DISTINCT b.request_id)::integer AS times
  FROM public.request_items a
  JOIN public.request_items b ON b.request_id = a.request_id AND b.equipment_id <> a.equipment_id
  JOIN public.requests r ON r.id = a.request_id AND r.status NOT IN ('cancelled', 'rejected')
  JOIN public.equipment e ON e.id = b.equipment_id AND e.status <> 'retired'
  WHERE a.equipment_id = p_equipment_id AND b.equipment_id IS NOT NULL
  GROUP BY b.equipment_id
  HAVING count(DISTINCT b.request_id) >= 2
  ORDER BY times DESC
  LIMIT GREATEST(1, LEAST(p_limit, 8));
END;
$$;

REVOKE ALL ON FUNCTION public.often_taken_with(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.often_taken_with(uuid, integer) TO authenticated;
