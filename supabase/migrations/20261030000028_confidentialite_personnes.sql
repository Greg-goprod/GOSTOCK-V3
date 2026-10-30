-- Contre-test du lot 16, N4 (confidentialité) : un collaborateur sans droit lisait par l'API l'e-mail,
-- le téléphone, la caution, les permis et les dates de départ de toutes les personnes.
--
-- Désormais :
--   - la fiche complète (table users) n'est lisible que par la personne elle-même et par le personnel
--     (magasin, responsables, gestion du stock, de la flotte, des personnes, réglages) ;
--   - tout membre peut lire un annuaire minimal (people_directory : nom, prénom, service, actif),
--     suffisant pour afficher qui a quoi.
-- L'écriture ne change pas : l'ancienne règle « users_member » (tout membre, en lecture et en écriture)
-- est remplacée par la même règle limitée à l'écriture ; les règles restrictives users_insert_rule,
-- users_update_rule, users_delete_rule (droit « gérer les personnes ») et la garde users_guard s'appliquent
-- toujours par-dessus.

DROP POLICY IF EXISTS users_member ON public.users;
DROP POLICY IF EXISTS users_member_insert ON public.users;
DROP POLICY IF EXISTS users_member_update ON public.users;
DROP POLICY IF EXISTS users_member_delete ON public.users;
CREATE POLICY users_member_insert ON public.users FOR INSERT TO authenticated WITH CHECK (public.app_has('manage_people'));
CREATE POLICY users_member_update ON public.users FOR UPDATE TO authenticated
  USING (public.app_is_member()) WITH CHECK (public.app_has('manage_people'));
CREATE POLICY users_member_delete ON public.users FOR DELETE TO authenticated USING (public.app_is_member());
DROP POLICY IF EXISTS users_read ON public.users;
CREATE POLICY users_read ON public.users FOR SELECT TO authenticated
  USING (
    id = public.app_user_id()
    OR public.app_has('view_all') OR public.app_has('manage_people') OR public.app_has('scan')
    OR public.app_has('approve') OR public.app_has('manage_stock') OR public.app_has('manage_fleet')
    OR public.app_has('settings')
  );

CREATE OR REPLACE FUNCTION public.people_directory()
RETURNS TABLE (id uuid, first_name text, last_name text, department text, active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT u.id, u.first_name::text, u.last_name::text, u.department::text, u.active
  FROM public.users u
  WHERE public.app_is_member()
  ORDER BY u.last_name, u.first_name;
$$;

REVOKE EXECUTE ON FUNCTION public.people_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.people_directory() TO authenticated;
ALTER FUNCTION public.people_directory() SET search_path = public, extensions;

-- N2 : motif précis d'un badge refusé au comptoir (accès échu, personne partie, badge inconnu)
CREATE OR REPLACE FUNCTION public.badge_problem(p_code text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_code text := lower(regexp_replace(trim(p_code), '^GOMAT-USER:', '', 'i'));
  v_user public.users;
BEGIN
  IF NOT public.app_has('scan') THEN
    RAISE EXCEPTION 'Seul le magasin peut scanner un badge';
  END IF;
  SELECT u.* INTO v_user FROM public.user_badges b JOIN public.users u ON u.id = b.user_id WHERE b.code = v_code;
  IF NOT FOUND THEN
    RETURN 'Badge inconnu';
  END IF;
  IF NOT v_user.active THEN
    RETURN format('%s %s est parti(e)%s : badge désactivé', v_user.first_name, v_user.last_name,
                  COALESCE(' le ' || to_char(v_user.left_on, 'DD.MM.YYYY'), ''));
  END IF;
  IF v_user.access_until IS NOT NULL AND v_user.access_until < (now() AT TIME ZONE 'Europe/Zurich')::date THEN
    RETURN format('Accès de %s %s échu le %s : prolongez la date « accès jusqu''au » dans « Personnes »',
                  v_user.first_name, v_user.last_name, to_char(v_user.access_until, 'DD.MM.YYYY'));
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.badge_problem(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.badge_problem(text) TO authenticated;
ALTER FUNCTION public.badge_problem(text) SET search_path = public, extensions;
