/*
  Module 1.5 : la restauration d'une sauvegarde reprend les interventions telles quelles.
  Sans cela, une intervention d'un chantier clôturé, ou planifiée avec d'anciens horaires, serait refusée par les contrôles
  de la migration 42 au moment de restaurer (même réglage que les autres contrôles de GO-Mat : gomat.restoring).
*/

CREATE OR REPLACE FUNCTION public.site_interventions_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  tz constant text := 'Europe/Zurich';
  v_site public.sites%ROWTYPE;
  v_cfg public.site_config%ROWTYPE;
  v_step integer;
  v_all_day boolean;
  v_from time;
  v_to time;
  ls timestamp;
  le timestamp;
  v_last_day date;
  v_blocked date;
BEGIN
  -- Restauration d'une sauvegarde : les données d'origine sont reprises telles quelles (chantier clôturé, anciens horaires…)
  IF current_setting('gomat.restoring', true) = 'on' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_site FROM public.sites s WHERE s.id = NEW.site_id AND s.organization_id = NEW.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chantier introuvable'; END IF;
  IF v_site.status <> 'open' THEN RAISE EXCEPTION 'Ce chantier est clôturé : son planning ne peut plus être modifié'; END IF;
  IF NEW.ends_at <= NEW.starts_at THEN RAISE EXCEPTION 'La fin doit être après le début'; END IF;

  SELECT * INTO v_cfg FROM public.site_config c WHERE c.site_id = NEW.site_id;
  v_step := COALESCE(v_cfg.step_minutes, 15);
  v_all_day := COALESCE(v_cfg.all_day, false);
  v_from := COALESCE(v_cfg.day_start, '07:00');
  v_to := COALESCE(v_cfg.day_end, '19:00');
  ls := NEW.starts_at AT TIME ZONE tz;
  le := NEW.ends_at AT TIME ZONE tz;

  IF date_trunc('minute', ls) <> ls OR date_trunc('minute', le) <> le
     OR ((extract(hour FROM ls) * 60 + extract(minute FROM ls))::integer % v_step) <> 0
     OR ((extract(hour FROM le) * 60 + extract(minute FROM le))::integer % v_step) <> 0 THEN
    RAISE EXCEPTION 'Les heures doivent tomber sur un pas de % minutes', v_step;
  END IF;

  IF NOT v_all_day THEN
    IF ls::date <> le::date THEN RAISE EXCEPTION 'Une intervention tient dans une seule journée (sauf chantier 24 h/24)'; END IF;
    IF ls::time < v_from OR le::time > v_to THEN
      RAISE EXCEPTION 'Hors des heures du chantier (% à %)', to_char(v_from, 'HH24:MI'), to_char(v_to, 'HH24:MI');
    END IF;
  END IF;

  v_last_day := (le - interval '1 second')::date;
  IF v_site.start_on IS NOT NULL AND ls::date < v_site.start_on THEN
    RAISE EXCEPTION 'Avant le début du chantier (%)', to_char(v_site.start_on, 'DD.MM.YYYY');
  END IF;
  IF v_site.end_on IS NOT NULL AND v_last_day > v_site.end_on THEN
    RAISE EXCEPTION 'Après la fin du chantier (%)', to_char(v_site.end_on, 'DD.MM.YYYY');
  END IF;

  SELECT b.day INTO v_blocked FROM public.site_blocked_days b WHERE b.site_id = NEW.site_id AND b.day BETWEEN ls::date AND v_last_day LIMIT 1;
  IF v_blocked IS NOT NULL THEN RAISE EXCEPTION 'Jour bloqué : %', to_char(v_blocked, 'DD.MM.YYYY'); END IF;

  IF NOT EXISTS (SELECT 1 FROM public.site_zones z WHERE z.id = NEW.zone_id AND z.site_id = NEW.site_id) THEN RAISE EXCEPTION 'Zone inconnue pour ce chantier'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.site_teams t WHERE t.id = NEW.team_id AND t.site_id = NEW.site_id) THEN RAISE EXCEPTION 'Équipe inconnue pour ce chantier'; END IF;
  IF NEW.phase_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.site_phases p WHERE p.id = NEW.phase_id AND p.site_id = NEW.site_id) THEN RAISE EXCEPTION 'Phase inconnue pour ce chantier'; END IF;

  -- Une équipe n'est jamais à deux endroits à la fois (le verrou évite que deux enregistrements simultanés passent ensemble)
  PERFORM pg_advisory_xact_lock(hashtext('site_team:' || NEW.team_id::text));
  IF EXISTS (SELECT 1 FROM public.site_interventions i WHERE i.team_id = NEW.team_id AND i.id <> NEW.id AND i.starts_at < NEW.ends_at AND i.ends_at > NEW.starts_at) THEN
    RAISE EXCEPTION 'Cette équipe a déjà une intervention sur ce créneau';
  END IF;
  RETURN NEW;
END;
$$;
