-- Rapport de tests du lot 16 (L8) : le message de refus parle de « permis machine » ou de « formation »
-- selon le type, et renvoie au menu « Permis et formations ».
CREATE OR REPLACE FUNCTION public.training_problem(p_user_id uuid, p_equipment_id uuid, p_until timestamptz)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_training public.trainings;
  v_item text;
  v_who text;
  v_expires date;
  v_found boolean;
  v_what text;
BEGIN
  SELECT t.* INTO v_training
  FROM public.equipment e JOIN public.trainings t ON t.id = e.required_training_id
  WHERE e.id = p_equipment_id;
  IF v_training.id IS NULL THEN
    RETURN NULL;
  END IF;
  v_what := CASE v_training.kind WHEN 'machine_permit' THEN 'le permis machine' ELSE 'la formation' END;
  SELECT name INTO v_item FROM public.equipment WHERE id = p_equipment_id;
  SELECT first_name || ' ' || last_name INTO v_who FROM public.users WHERE id = p_user_id;
  SELECT true, ut.expires_on INTO v_found, v_expires
  FROM public.user_trainings ut WHERE ut.user_id = p_user_id AND ut.training_id = v_training.id;
  IF NOT COALESCE(v_found, false) THEN
    RETURN format('« %s » exige %s « %s » : %s ne l''a pas (à saisir dans « Permis et formations »)',
                  v_item, v_what, v_training.name, v_who);
  END IF;
  IF v_expires IS NOT NULL AND v_expires < COALESCE(p_until, now())::date THEN
    RETURN format('%s « %s » de %s %s le %s : « %s » ne peut pas sortir', initcap(left(v_what, 1)) || substr(v_what, 2),
                  v_training.name, v_who,
                  CASE WHEN v_expires < current_date THEN 'a expiré' ELSE 'expire' END, to_char(v_expires, 'DD.MM.YYYY'), v_item);
  END IF;
  RETURN NULL;
END;
$$;

ALTER FUNCTION public.training_problem(uuid, uuid, timestamptz) SET search_path = public, extensions;
