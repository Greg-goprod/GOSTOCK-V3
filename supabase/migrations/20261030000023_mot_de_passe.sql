/*
  Connexion par mot de passe (en plus du code par e-mail).

  Un compte n'est lié à la fiche de même e-mail que si cette adresse est confirmée : avec un mot de
  passe, quelqu'un pourrait sinon créer un compte au nom d'une adresse qui n'est pas la sienne
  et hériter des droits de la fiche. Un compte créé par l'administrateur dans Supabase avec
  « Auto Confirm User », ou confirmé par le lien ou le code reçu, est lié normalement.
*/
CREATE OR REPLACE FUNCTION public.whoami()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_user public.users;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_user FROM public.users WHERE auth_user_id = v_uid;
  IF NOT FOUND THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid AND email_confirmed_at IS NOT NULL;
    IF v_email IS NOT NULL THEN
      UPDATE public.users SET auth_user_id = v_uid
      WHERE lower(email) = lower(v_email) AND auth_user_id IS NULL
      RETURNING * INTO v_user;
    END IF;
  END IF;
  IF v_user.id IS NULL OR NOT v_user.active
     OR (v_user.access_until IS NOT NULL AND v_user.access_until < (now() AT TIME ZONE 'Europe/Zurich')::date) THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'id', v_user.id,
    'first_name', v_user.first_name,
    'last_name', v_user.last_name,
    'email', v_user.email,
    'role', v_user.role,
    'permissions', to_jsonb(public.app_permissions()),
    'depot_ids', COALESCE((SELECT jsonb_agg(depot_id) FROM public.user_depots WHERE user_id = v_user.id), '[]'::jsonb)
  );
END;
$$;

ALTER FUNCTION public.whoami() SET search_path = public, extensions;
