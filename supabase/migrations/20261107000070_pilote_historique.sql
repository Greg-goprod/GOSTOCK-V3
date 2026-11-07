/*
  PILOTE P12 : historique d'une fiche (projet ou élément).

  Le journal d'audit existe déjà et enregistre chaque création, modification et suppression des projets et des éléments (qui, quand, quels champs, ancienne et
  nouvelle valeur). Mais il n'est lisible que par les droits « approuver » ou « réglages » : une personne qui voit un projet ne pouvait pas voir son histoire.

  cp_history(type, identifiant) renvoie les 100 dernières lignes du journal d'un projet (type « project ») ou d'un élément (« item ») : date, auteur, action, champs.
  Elle s'exécute avec les droits du propriétaire (pour lire le journal) mais exige : module PILOTE activé pour l'entreprise de la personne, droit de lecture des projets,
  et ne renvoie que les lignes de SON entreprise. Rien d'autre du journal n'est exposé (une seule table, un seul enregistrement à la fois).
*/
CREATE OR REPLACE FUNCTION public.cp_history(p_kind text, p_id uuid)
RETURNS TABLE (at timestamptz, who text, action text, changes jsonb)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_org uuid := public.app_org_id();
  v_table text;
BEGIN
  IF v_org IS NULL OR NOT public.org_module_enabled('cp.projects') OR NOT public.rbac_has_any_permission(ARRAY['cp.projects:read']) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF p_kind = 'item' THEN v_table := 'cp_items';
  ELSIF p_kind = 'project' THEN v_table := 'cp_projects';
  ELSE RAISE EXCEPTION 'Type inconnu';
  END IF;
  RETURN QUERY
  SELECT a.at, COALESCE(NULLIF(btrim(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), '—'), a.action, a.changes
  FROM public.audit_log a
  LEFT JOIN public.users u ON u.id = a.user_id AND u.organization_id = v_org
  WHERE a.organization_id = v_org AND a.table_name = v_table AND a.record_id = p_id::text
  ORDER BY a.at DESC, a.id DESC
  LIMIT 100;
END;
$$;
REVOKE ALL ON FUNCTION public.cp_history(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cp_history(text, uuid) TO authenticated;
