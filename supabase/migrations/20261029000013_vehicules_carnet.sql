/*
  Véhicules : carnet de bord, photos, permis

  - vehicle_trips : photos au départ et au retour (comparaison côte à côte des dégâts).
  - fuel_entries : pleins (date, km, litres, CHF, ticket en photo, plein complet ou non).
  - vehicle_logbook : trajets avec conducteur, chantier de la demande et distance.
  - vehicle_fuel_stats : consommation moyenne (L/100 km) entre le premier et le dernier plein
    complet, et dépenses de carburant.
  - Permis : catégories et date d'expiration par personne ; une demande de véhicule est
    refusée si le permis du demandeur ne couvre pas la catégorie du véhicule (C couvre C1,
    CE couvre C1E, D couvre D1) ou s'il expire avant la fin de la réservation.
*/

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS license_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS license_expires_on date;

ALTER TABLE public.vehicle_trips
  ADD COLUMN IF NOT EXISTS start_photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS end_photos text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.fuel_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.vehicle_trips(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  filled_at timestamptz NOT NULL DEFAULT now(),
  km integer NOT NULL CHECK (km >= 0),
  liters numeric(8, 2) NOT NULL CHECK (liters > 0),
  amount numeric(10, 2) CHECK (amount IS NULL OR amount >= 0),
  full_tank boolean NOT NULL DEFAULT true,
  receipt_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fuel_entries_vehicle_idx ON public.fuel_entries (vehicle_id, filled_at DESC);

CREATE OR REPLACE VIEW public.vehicle_logbook WITH (security_invoker = true) AS
SELECT
  t.id, t.vehicle_id, t.request_id, t.driver_id,
  u.first_name || ' ' || u.last_name AS driver_name,
  r.number AS request_number,
  COALESCE(NULLIF(trim(r.destination), ''), 'Sans chantier') AS site,
  t.start_at, t.end_at, t.start_km, t.end_km,
  CASE WHEN t.end_km IS NOT NULL THEN t.end_km - t.start_km END AS distance,
  t.start_fuel, t.end_fuel, t.start_damages, t.end_damages, t.start_photos, t.end_photos
FROM public.vehicle_trips t
LEFT JOIN public.users u ON u.id = t.driver_id
LEFT JOIN public.requests r ON r.id = t.request_id;

CREATE OR REPLACE VIEW public.vehicle_fuel_stats WITH (security_invoker = true) AS
SELECT
  v.id AS vehicle_id,
  f.fills,
  f.liters_total,
  f.amount_total,
  -- Litres versés après le premier plein complet, rapportés aux km parcourus depuis
  CASE WHEN f.km_last > f.km_first AND f.liters_after_first > 0
       THEN round(f.liters_after_first / (f.km_last - f.km_first) * 100, 1) END AS liters_per_100km
FROM public.vehicles v
LEFT JOIN LATERAL (
  SELECT count(*) AS fills,
         sum(e.liters) AS liters_total,
         sum(e.amount) AS amount_total,
         min(e.km) FILTER (WHERE e.full_tank) AS km_first,
         max(e.km) FILTER (WHERE e.full_tank) AS km_last,
         sum(e.liters) FILTER (WHERE e.km > (SELECT min(x.km) FROM public.fuel_entries x WHERE x.vehicle_id = v.id AND x.full_tank)) AS liters_after_first
  FROM public.fuel_entries e
  WHERE e.vehicle_id = v.id
) f ON true;

-- Le permis couvre-t-il la catégorie du véhicule jusqu'à la date donnée ?
CREATE OR REPLACE FUNCTION public.license_covers(p_user_id uuid, p_category text, p_until timestamptz)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user public.users;
  v_needed text := upper(trim(COALESCE(p_category, '')));
BEGIN
  IF v_needed = '' THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF v_user.license_expires_on IS NOT NULL AND v_user.license_expires_on < p_until::date THEN
    RETURN format('Le permis de %s %s expire le %s, avant la fin de la réservation',
                  v_user.first_name, v_user.last_name, to_char(v_user.license_expires_on, 'DD.MM.YYYY'));
  END IF;
  IF v_needed = ANY (v_user.license_categories)
     OR (v_needed = 'C1' AND 'C' = ANY (v_user.license_categories))
     OR (v_needed = 'C1E' AND 'CE' = ANY (v_user.license_categories))
     OR (v_needed = 'D1' AND 'D' = ANY (v_user.license_categories)) THEN
    RETURN NULL;
  END IF;
  RETURN format('%s %s n''a pas le permis %s requis%s', v_user.first_name, v_user.last_name, v_needed,
                CASE WHEN cardinality(v_user.license_categories) = 0 THEN ' (permis non renseigné dans « Personnes »)' ELSE '' END);
END;
$$;

-- create_request : vérification du permis pour chaque véhicule demandé
CREATE OR REPLACE FUNCTION public.create_request(
  p_requester_id uuid, p_depot_id uuid, p_start timestamptz, p_end timestamptz,
  p_items jsonb, p_destination text DEFAULT NULL, p_notes text DEFAULT NULL
)
RETURNS public.requests
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item jsonb;
  v_problem text;
BEGIN
  IF current_setting('role', true) = 'authenticated' THEN
    IF public.app_user_id() IS NULL THEN
      RAISE EXCEPTION 'Accès refusé';
    END IF;
    IF p_requester_id IS DISTINCT FROM public.app_user_id()
       AND NOT (public.app_has('scan') OR public.app_has('approve')) THEN
      RAISE EXCEPTION 'Vous ne pouvez faire une demande que pour vous-même';
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    IF v_item->>'kind' = 'vehicle' THEN
      SELECT public.license_covers(p_requester_id, v.license_category, p_end) INTO v_problem
      FROM public.vehicles v WHERE v.id = (v_item->>'id')::uuid;
      IF v_problem IS NOT NULL THEN
        RAISE EXCEPTION '%', v_problem;
      END IF;
    END IF;
  END LOOP;

  RETURN public.create_request_impl(p_requester_id, p_depot_id, p_start, p_end, p_items, p_destination, p_notes);
END;
$$;

ALTER TABLE public.fuel_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fuel_entries' AND policyname = 'fuel_entries_read') THEN
    CREATE POLICY fuel_entries_read ON public.fuel_entries FOR SELECT TO authenticated
      USING (user_id = public.app_user_id() OR public.app_has('scan') OR public.app_has('manage_fleet') OR public.app_has('view_all'));
  END IF;
  -- Le conducteur note son plein ; le magasin et la gestion de flotte pour tous
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fuel_entries' AND policyname = 'fuel_entries_insert') THEN
    CREATE POLICY fuel_entries_insert ON public.fuel_entries FOR INSERT TO authenticated
      WITH CHECK (public.app_is_member() AND (user_id = public.app_user_id() OR public.app_has('scan') OR public.app_has('manage_fleet')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fuel_entries' AND policyname = 'fuel_entries_manage') THEN
    CREATE POLICY fuel_entries_manage ON public.fuel_entries FOR UPDATE TO authenticated
      USING (public.app_has('manage_fleet')) WITH CHECK (public.app_has('manage_fleet'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fuel_entries' AND policyname = 'fuel_entries_remove') THEN
    CREATE POLICY fuel_entries_remove ON public.fuel_entries FOR DELETE TO authenticated
      USING (public.app_has('manage_fleet'));
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_entries TO authenticated;
GRANT ALL ON public.fuel_entries TO service_role;
GRANT SELECT ON public.vehicle_logbook, public.vehicle_fuel_stats TO authenticated;

REVOKE EXECUTE ON FUNCTION public.license_covers(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.license_covers(uuid, text, timestamptz) TO authenticated;
ALTER FUNCTION public.license_covers(uuid, text, timestamptz) SET search_path = public, extensions;
ALTER FUNCTION public.create_request(uuid, uuid, timestamptz, timestamptz, jsonb, text, text) SET search_path = public, extensions;
