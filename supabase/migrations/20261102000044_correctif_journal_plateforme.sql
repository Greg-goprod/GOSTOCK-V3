-- Correctif de la migration 43 : auth.users.email est de type varchar(255) sur Supabase ; platform_audit() le renvoie en text.
CREATE OR REPLACE FUNCTION public.platform_audit(p_limit integer DEFAULT 100)
RETURNS TABLE (id uuid, at timestamptz, actor_email text, action text, target_type text, target_name text, metadata jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_owner_admin() THEN
    RAISE EXCEPTION 'Réservé à l''administrateur de la plateforme';
  END IF;
  RETURN QUERY
  SELECT l.id, l.created_at, (SELECT a.email::text FROM auth.users a WHERE a.id = l.actor_id), l.action, l.target_type,
         COALESCE((SELECT o.name FROM public.organizations o WHERE o.id = l.target_id), l.metadata ->> 'name'), l.metadata
  FROM public.admin_audit_log l ORDER BY l.created_at DESC, l.id DESC LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_audit(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_audit(integer) TO authenticated;
