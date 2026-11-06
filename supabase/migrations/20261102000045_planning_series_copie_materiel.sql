/*
  Module 1.4 : récurrence, copie d'un jour, matériel nécessaire par intervention.

    - create_intervention_series : crée la même intervention sur plusieurs jours (jours de la semaine au choix). Tout ou rien :
      si un jour est refusé (chevauchement, hors période, hors heures…), rien n'est créé et le message donne la date fautive.
      Les jours bloqués sont sautés (et comptés). Les interventions d'une série partagent un series_id.
    - copy_interventions_day : copie les interventions d'un jour vers d'autres jours (mêmes heures de Suisse). Tout ou rien.
    - site_intervention_needs : matériel nécessaire (article + quantité) pour une intervention.
    - site_material_issues : pour chaque besoin, compare avec la disponibilité réelle de GO-Mat (stock, maintenance, sorties en cours,
      demandes validées : tool_availability) ET avec le matériel déjà prévu par d'autres interventions qui se chevauchent.
      C'est un AVERTISSEMENT (le planning se prépare avant les réservations), jamais un blocage.
  Les formations requises se contrôleront quand des personnes seront rattachées aux interventions (module 2).
  Toutes ces fonctions s'exécutent avec les droits de la personne : la sécurité par ligne, le module activé et les contrôles de la
  migration 42 s'appliquent comme pour une saisie à la main.
*/

CREATE TABLE IF NOT EXISTS public.site_intervention_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  intervention_id uuid NOT NULL REFERENCES public.site_interventions(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (intervention_id, equipment_id)
);
CREATE INDEX IF NOT EXISTS site_intervention_needs_org_idx ON public.site_intervention_needs (organization_id);
CREATE INDEX IF NOT EXISTS site_intervention_needs_equipment_idx ON public.site_intervention_needs (equipment_id);
CREATE INDEX IF NOT EXISTS site_interventions_series_idx ON public.site_interventions (series_id) WHERE series_id IS NOT NULL;

-- Une personne ne rattache un besoin qu'à une intervention et à un article de SA entreprise (les clés étrangères ignorent la sécurité par ligne)
CREATE OR REPLACE FUNCTION public.site_need_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.site_interventions i WHERE i.id = NEW.intervention_id AND i.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Intervention introuvable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.equipment e WHERE e.id = NEW.equipment_id AND e.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Article introuvable';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.site_intervention_needs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON public.site_intervention_needs;
DROP POLICY IF EXISTS planning_read ON public.site_intervention_needs;
DROP POLICY IF EXISTS planning_insert ON public.site_intervention_needs;
DROP POLICY IF EXISTS planning_update ON public.site_intervention_needs;
DROP POLICY IF EXISTS planning_delete ON public.site_intervention_needs;
CREATE POLICY org_isolation ON public.site_intervention_needs AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = (SELECT public.app_org_id())) WITH CHECK (organization_id = (SELECT public.app_org_id()));
CREATE POLICY planning_read ON public.site_intervention_needs FOR SELECT TO authenticated
  USING ((SELECT public.org_module_enabled('chantiers_planning')) AND (SELECT public.rbac_has_any_permission(ARRAY['chantiers.planning:read'])));
CREATE POLICY planning_insert ON public.site_intervention_needs FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.org_module_enabled('chantiers_planning')) AND (SELECT public.rbac_has_any_permission(ARRAY['chantiers.planning:create'])));
CREATE POLICY planning_update ON public.site_intervention_needs FOR UPDATE TO authenticated
  USING ((SELECT public.org_module_enabled('chantiers_planning')) AND (SELECT public.rbac_has_any_permission(ARRAY['chantiers.planning:update'])))
  WITH CHECK ((SELECT public.org_module_enabled('chantiers_planning')) AND (SELECT public.rbac_has_any_permission(ARRAY['chantiers.planning:update'])));
CREATE POLICY planning_delete ON public.site_intervention_needs FOR DELETE TO authenticated
  USING ((SELECT public.org_module_enabled('chantiers_planning')) AND (SELECT public.rbac_has_any_permission(ARRAY['chantiers.planning:delete'])));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_intervention_needs TO authenticated, service_role;
REVOKE ALL ON public.site_intervention_needs FROM anon;
DROP TRIGGER IF EXISTS a_org_write_guard ON public.site_intervention_needs;
CREATE TRIGGER a_org_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.site_intervention_needs FOR EACH ROW EXECUTE FUNCTION public.org_write_guard();
DROP TRIGGER IF EXISTS b_site_need_guard ON public.site_intervention_needs;
CREATE TRIGGER b_site_need_guard BEFORE INSERT OR UPDATE ON public.site_intervention_needs FOR EACH ROW EXECUTE FUNCTION public.site_need_guard();
DROP TRIGGER IF EXISTS site_intervention_needs_audit_trigger ON public.site_intervention_needs;
CREATE TRIGGER site_intervention_needs_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.site_intervention_needs FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Série : la même intervention sur plusieurs jours (p_weekdays : 1 = lundi … 7 = dimanche)
CREATE OR REPLACE FUNCTION public.create_intervention_series(
  p_site_id uuid, p_zone_id uuid, p_team_id uuid, p_phase_id uuid, p_title text, p_notes text,
  p_first_day date, p_last_day date, p_weekdays integer[], p_start time, p_end time,
  p_end_day_offset integer DEFAULT 0, p_needs jsonb DEFAULT '[]'
)
RETURNS TABLE (created integer, skipped_blocked integer, series_id uuid)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  tz constant text := 'Europe/Zurich';
  d date;
  v_series uuid := gen_random_uuid();
  v_created integer := 0;
  v_skipped integer := 0;
  v_id uuid;
  v_need jsonb;
BEGIN
  IF p_first_day IS NULL OR p_last_day IS NULL THEN RAISE EXCEPTION 'Indique le premier et le dernier jour'; END IF;
  IF p_last_day < p_first_day THEN RAISE EXCEPTION 'Le dernier jour est avant le premier'; END IF;
  IF p_last_day - p_first_day > 120 THEN RAISE EXCEPTION 'Une série couvre 120 jours au plus'; END IF;
  IF p_weekdays IS NULL OR cardinality(p_weekdays) = 0 THEN RAISE EXCEPTION 'Choisis au moins un jour de la semaine'; END IF;
  IF p_end_day_offset IS NULL OR p_end_day_offset < 0 OR p_end_day_offset > 7 THEN RAISE EXCEPTION 'Décalage du jour de fin invalide'; END IF;
  FOR d IN SELECT g::date FROM generate_series(p_first_day::timestamp, p_last_day::timestamp, interval '1 day') g LOOP
    CONTINUE WHEN NOT (extract(isodow FROM d)::integer = ANY (p_weekdays));
    IF EXISTS (SELECT 1 FROM public.site_blocked_days b WHERE b.site_id = p_site_id AND b.day = d) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    BEGIN
      INSERT INTO public.site_interventions (site_id, zone_id, team_id, phase_id, title, notes, starts_at, ends_at, series_id)
      VALUES (p_site_id, p_zone_id, p_team_id, p_phase_id, p_title, p_notes, (d + p_start) AT TIME ZONE tz, ((d + p_end_day_offset) + p_end) AT TIME ZONE tz, v_series)
      RETURNING id INTO v_id;
      FOR v_need IN SELECT * FROM jsonb_array_elements(COALESCE(p_needs, '[]'::jsonb)) LOOP
        INSERT INTO public.site_intervention_needs (intervention_id, equipment_id, quantity)
        VALUES (v_id, (v_need ->> 'equipment_id')::uuid, COALESCE((v_need ->> 'quantity')::integer, 1));
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION '%: %', to_char(d, 'DD.MM.YYYY'), SQLERRM;
    END;
    v_created := v_created + 1;
  END LOOP;
  IF v_created = 0 THEN RAISE EXCEPTION 'Aucun jour ne convient (jours de la semaine non choisis ou jours bloqués)'; END IF;
  RETURN QUERY SELECT v_created, v_skipped, v_series;
END;
$$;

-- Copie d'un jour : les interventions (et leurs besoins) d'un jour sont recopiées aux mêmes heures de Suisse sur d'autres jours
CREATE OR REPLACE FUNCTION public.copy_interventions_day(p_site_id uuid, p_from_day date, p_to_days date[])
RETURNS TABLE (created integer, skipped_blocked integer)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  tz constant text := 'Europe/Zurich';
  d date;
  r public.site_interventions%ROWTYPE;
  v_id uuid;
  v_created integer := 0;
  v_skipped integer := 0;
  v_sources integer;
BEGIN
  IF p_to_days IS NULL OR cardinality(p_to_days) = 0 THEN RAISE EXCEPTION 'Choisis au moins un jour de destination'; END IF;
  IF cardinality(p_to_days) > 60 THEN RAISE EXCEPTION 'Copie sur 60 jours au plus'; END IF;
  SELECT count(*) INTO v_sources FROM public.site_interventions i WHERE i.site_id = p_site_id AND (i.starts_at AT TIME ZONE tz)::date = p_from_day;
  IF v_sources = 0 THEN RAISE EXCEPTION 'Aucune intervention ce jour-là'; END IF;
  FOR d IN SELECT DISTINCT x FROM unnest(p_to_days) AS x ORDER BY x LOOP
    CONTINUE WHEN d = p_from_day;
    IF EXISTS (SELECT 1 FROM public.site_blocked_days b WHERE b.site_id = p_site_id AND b.day = d) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    FOR r IN SELECT * FROM public.site_interventions i WHERE i.site_id = p_site_id AND (i.starts_at AT TIME ZONE tz)::date = p_from_day ORDER BY i.starts_at LOOP
      BEGIN
        INSERT INTO public.site_interventions (site_id, zone_id, team_id, phase_id, title, notes, starts_at, ends_at)
        VALUES (r.site_id, r.zone_id, r.team_id, r.phase_id, r.title, r.notes,
                (d + (r.starts_at AT TIME ZONE tz)::time) AT TIME ZONE tz,
                ((d + ((r.ends_at AT TIME ZONE tz)::date - (r.starts_at AT TIME ZONE tz)::date)) + (r.ends_at AT TIME ZONE tz)::time) AT TIME ZONE tz)
        RETURNING id INTO v_id;
        INSERT INTO public.site_intervention_needs (intervention_id, equipment_id, quantity)
        SELECT v_id, n.equipment_id, n.quantity FROM public.site_intervention_needs n WHERE n.intervention_id = r.id;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION '%: % (%)', to_char(d, 'DD.MM.YYYY'), SQLERRM, r.title;
      END;
      v_created := v_created + 1;
    END LOOP;
  END LOOP;
  IF v_created = 0 THEN RAISE EXCEPTION 'Rien n''a été copié (jours bloqués ou identiques au jour d''origine)'; END IF;
  RETURN QUERY SELECT v_created, v_skipped;
END;
$$;

-- Matériel : ce qui manque pour chaque intervention du chantier (avertissement, pas un blocage)
CREATE OR REPLACE FUNCTION public.site_material_issues(p_site_id uuid)
RETURNS TABLE (intervention_id uuid, equipment_id uuid, equipment_name text, needed integer, available integer, shortage integer)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  WITH n AS (
    SELECT s.intervention_id, s.equipment_id, s.quantity, i.starts_at, i.ends_at
    FROM public.site_intervention_needs s
    JOIN public.site_interventions i ON i.id = s.intervention_id
    WHERE i.site_id = p_site_id
  ), calc AS (
    SELECT n.*,
           public.tool_availability(n.equipment_id, n.starts_at, n.ends_at) AS avail,
           COALESCE((SELECT sum(o.quantity)
                     FROM public.site_intervention_needs o
                     JOIN public.site_interventions oi ON oi.id = o.intervention_id
                     WHERE o.equipment_id = n.equipment_id AND o.intervention_id <> n.intervention_id
                       AND tstzrange(oi.starts_at, oi.ends_at, '[)') && tstzrange(n.starts_at, n.ends_at, '[)')), 0)::integer AS others
    FROM n
  )
  SELECT c.intervention_id, c.equipment_id, e.name::text, c.quantity,
         GREATEST(c.avail - c.others, 0), c.quantity - GREATEST(c.avail - c.others, 0)
  FROM calc c JOIN public.equipment e ON e.id = c.equipment_id
  WHERE c.quantity > GREATEST(c.avail - c.others, 0)
$$;

REVOKE EXECUTE ON FUNCTION public.create_intervention_series(uuid, uuid, uuid, uuid, text, text, date, date, integer[], time, time, integer, jsonb),
  public.copy_interventions_day(uuid, date, date[]), public.site_material_issues(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_intervention_series(uuid, uuid, uuid, uuid, text, text, date, date, integer[], time, time, integer, jsonb),
  public.copy_interventions_day(uuid, date, date[]), public.site_material_issues(uuid) TO authenticated;
