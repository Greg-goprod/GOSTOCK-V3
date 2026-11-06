-- Contre-test A2 : avec seulement « CE » coché, license_covers refusait C, C1 et B, alors que l'interface
-- dit de ne cocher que la catégorie la plus haute. En Suisse, une catégorie suppose celles qu'elle exige
-- (C et D exigent B ; CE exige C…) : on ajoute ces inclusions, appliquées jusqu'à stabilité
-- (CE → C → C1 → B → F → G, M).

CREATE OR REPLACE FUNCTION public.license_covers(p_user_id uuid, p_category text, p_until timestamptz)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user public.users;
  v_needed text := upper(trim(COALESCE(p_category, '')));
  v_held text[];
BEGIN
  IF v_needed = '' THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF v_user.license_expires_on IS NOT NULL AND v_user.license_expires_on < p_until::date THEN
    RETURN format('Le permis de %s %s expire le %s, avant la fin de la réservation',
                  v_user.first_name, v_user.last_name, to_char(v_user.license_expires_on, 'DD.MM.YYYY'));
  END IF;
  WITH RECURSIVE held(c) AS (
    SELECT upper(trim(x)) FROM unnest(COALESCE(v_user.license_categories, '{}')) AS x
    UNION
    SELECT unnest(CASE held.c
      WHEN 'A' THEN ARRAY['A1']
      WHEN 'B' THEN ARRAY['B1', 'F', 'G', 'M']
      WHEN 'BE' THEN ARRAY['B']
      WHEN 'C1' THEN ARRAY['B']
      WHEN 'C1E' THEN ARRAY['C1', 'BE']
      WHEN 'C' THEN ARRAY['C1']
      WHEN 'CE' THEN ARRAY['C', 'C1E', 'BE']
      WHEN 'D1' THEN ARRAY['B']
      WHEN 'D1E' THEN ARRAY['D1', 'BE']
      WHEN 'D' THEN ARRAY['D1']
      WHEN 'DE' THEN ARRAY['D', 'D1E', 'BE']
      WHEN 'F' THEN ARRAY['G', 'M']
      ELSE ARRAY[]::text[] END)
    FROM held
  )
  SELECT array_agg(c) INTO v_held FROM held;
  IF v_needed = ANY (COALESCE(v_held, '{}')) THEN
    RETURN NULL;
  END IF;
  RETURN format('%s %s n''a pas le permis %s requis%s', v_user.first_name, v_user.last_name, v_needed,
                CASE WHEN cardinality(v_user.license_categories) = 0 THEN ' (permis non renseigné dans « Personnes »)' ELSE '' END);
END;
$$;
ALTER FUNCTION public.license_covers(uuid, text, timestamptz) SET search_path = public, extensions;
