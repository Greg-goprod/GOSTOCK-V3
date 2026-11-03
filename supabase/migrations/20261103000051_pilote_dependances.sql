/*
  R3c : dépendances entre éléments d'un projet (« B commence après la fin de A ») et décalage en cascade fait par la base.

  Une dépendance relie deux éléments du MÊME projet : le prédécesseur (A) doit finir avant que le successeur (B) commence.
  Refusés par la base : un élément avec lui-même, deux fois la même dépendance, un élément et son parent ou ce qu'il contient,
  une boucle (A après B après A, même par plusieurs étapes), deux éléments de projets différents ou d'entreprises différentes.

  Réglages par projet (comme Notion) :
    link_mode = 'overlap'  (par défaut) : décaler un successeur SEULEMENT si ses dates chevauchent la fin de son prédécesseur ;
    link_mode = 'keep_gap'              : le successeur suit son prédécesseur en gardant l'intervalle (avance comme recule) ;
    link_mode = 'none'                  : ne rien décaler automatiquement (la dépendance reste une indication).
    link_skip_weekends = true (par défaut) : un successeur décalé automatiquement ne commence jamais un samedi ou un dimanche.

  Cascade : quand les dates d'un élément changent (glissé, fiche, décalage en bloc, API), le déclencheur décale ses successeurs
  (avec tout ce qu'ils contiennent), puis les successeurs de ces successeurs, dans la même opération : tout ou rien.
  Un successeur déplacé volontairement dans la même opération n'est pas décalé une seconde fois. Les éléments sans date sont ignorés.
  Même module (cp.projects) et mêmes droits que les projets ; la cascade s'exécute avec les droits de la personne.
*/

-- 1. Réglages du projet ------------------------------------------------------------------------------------------------
ALTER TABLE public.cp_projects ADD COLUMN IF NOT EXISTS link_mode text NOT NULL DEFAULT 'overlap';
ALTER TABLE public.cp_projects DROP CONSTRAINT IF EXISTS cp_projects_link_mode_check;
ALTER TABLE public.cp_projects ADD CONSTRAINT cp_projects_link_mode_check CHECK (link_mode IN ('overlap', 'keep_gap', 'none'));
ALTER TABLE public.cp_projects ADD COLUMN IF NOT EXISTS link_skip_weekends boolean NOT NULL DEFAULT true;

-- 2. Dépendances ------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cp_item_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  project_id uuid NOT NULL REFERENCES public.cp_projects(id) ON DELETE CASCADE,
  predecessor_id uuid NOT NULL REFERENCES public.cp_items(id) ON DELETE CASCADE,
  successor_id uuid NOT NULL REFERENCES public.cp_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (predecessor_id <> successor_id),
  UNIQUE (predecessor_id, successor_id)
);
CREATE INDEX IF NOT EXISTS cp_item_links_org_idx ON public.cp_item_links (organization_id);
CREATE INDEX IF NOT EXISTS cp_item_links_project_idx ON public.cp_item_links (project_id);
CREATE INDEX IF NOT EXISTS cp_item_links_successor_idx ON public.cp_item_links (successor_id);

-- 3. Contrôles à la création : même projet / même entreprise, pas de parenté, pas de boucle ---------------------------------------
CREATE OR REPLACE FUNCTION public.cp_item_link_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_pred public.cp_items%ROWTYPE;
  v_succ public.cp_items%ROWTYPE;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.predecessor_id <> OLD.predecessor_id OR NEW.successor_id <> OLD.successor_id) THEN
    RAISE EXCEPTION 'Une dépendance ne change pas d''éléments : supprime-la et recrée-la';
  END IF;
  SELECT * INTO v_pred FROM public.cp_items i WHERE i.id = NEW.predecessor_id AND i.organization_id = NEW.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Élément introuvable'; END IF;
  SELECT * INTO v_succ FROM public.cp_items i WHERE i.id = NEW.successor_id AND i.organization_id = NEW.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Élément introuvable'; END IF;
  IF v_pred.project_id <> v_succ.project_id THEN RAISE EXCEPTION 'Les deux éléments doivent être dans le même projet'; END IF;
  NEW.project_id := v_pred.project_id;
  -- Un élément ne dépend pas de son parent (ni de ses ancêtres) ni de ce qu'il contient
  IF EXISTS (
    WITH RECURSIVE up AS (
      SELECT i.id, i.parent_id FROM public.cp_items i WHERE i.id = NEW.successor_id
      UNION ALL SELECT p.id, p.parent_id FROM public.cp_items p JOIN up ON p.id = up.parent_id
    ) SELECT 1 FROM up WHERE up.id = NEW.predecessor_id
  ) OR EXISTS (
    WITH RECURSIVE up AS (
      SELECT i.id, i.parent_id FROM public.cp_items i WHERE i.id = NEW.predecessor_id
      UNION ALL SELECT p.id, p.parent_id FROM public.cp_items p JOIN up ON p.id = up.parent_id
    ) SELECT 1 FROM up WHERE up.id = NEW.successor_id
  ) THEN
    RAISE EXCEPTION 'Un élément ne dépend pas de son parent ni de ce qu''il contient';
  END IF;
  -- Pas de boucle : le prédécesseur ne doit pas déjà dépendre (même de loin) du successeur ; le verrou évite deux créations simultanées
  PERFORM pg_advisory_xact_lock(hashtext('cp_links:' || NEW.project_id::text));
  IF EXISTS (
    WITH RECURSIVE down AS (
      SELECT l.successor_id AS id FROM public.cp_item_links l WHERE l.predecessor_id = NEW.successor_id
      UNION SELECT l.successor_id FROM public.cp_item_links l JOIN down d ON l.predecessor_id = d.id
    ) SELECT 1 FROM down WHERE down.id = NEW.predecessor_id
  ) THEN
    RAISE EXCEPTION 'Cette dépendance créerait une boucle';
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Cascade -----------------------------------------------------------------------------------------------------------------------
-- Décale un successeur (et tout ce qu'il contient) selon les réglages de son projet ; renvoie le nombre de jours décalés (0 = rien).
CREATE OR REPLACE FUNCTION public.cp_link_apply(p_successor uuid, p_pred_end date, p_end_delta integer)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_start date;
  v_mode text;
  v_skip boolean;
  v_new date;
  v_delta integer := 0;
  v_wd integer;
BEGIN
  SELECT i.starts_on, pr.link_mode, pr.link_skip_weekends INTO v_start, v_mode, v_skip
  FROM public.cp_items i JOIN public.cp_projects pr ON pr.id = i.project_id WHERE i.id = p_successor;
  IF v_start IS NULL OR v_mode = 'none' OR p_pred_end IS NULL THEN RETURN 0; END IF;
  IF pg_trigger_depth() > 60 THEN RAISE EXCEPTION 'Chaîne de dépendances trop longue'; END IF;

  IF v_mode = 'overlap' THEN
    -- Seulement si le successeur commence avant la fin de son prédécesseur : il commence le lendemain de cette fin
    IF v_start <= p_pred_end THEN
      v_new := p_pred_end + 1;
      v_wd := extract(isodow FROM v_new)::integer;
      IF v_skip AND v_wd >= 6 THEN v_new := v_new + (8 - v_wd); END IF;
      v_delta := v_new - v_start;
    END IF;
  ELSIF v_mode = 'keep_gap' THEN
    -- Le successeur suit son prédécesseur du même nombre de jours (en avant comme en arrière)
    IF p_end_delta IS NOT NULL AND p_end_delta <> 0 THEN
      v_new := v_start + p_end_delta;
      v_wd := extract(isodow FROM v_new)::integer;
      IF v_skip AND v_wd >= 6 THEN
        v_new := CASE WHEN p_end_delta > 0 THEN v_new + (8 - v_wd) ELSE v_new - (v_wd - 5) END;
      END IF;
      v_delta := v_new - v_start;
    END IF;
  END IF;

  IF v_delta <> 0 THEN
    WITH RECURSIVE tree AS (
      SELECT i.id FROM public.cp_items i WHERE i.id = p_successor
      UNION ALL SELECT c.id FROM public.cp_items c JOIN tree t ON c.parent_id = t.id
    )
    UPDATE public.cp_items i SET starts_on = i.starts_on + v_delta, ends_on = i.ends_on + v_delta WHERE i.id IN (SELECT id FROM tree);
  END IF;
  RETURN v_delta;
END;
$$;

-- Après toute modification de dates : les successeurs des éléments modifiés suivent (un niveau ; chaque niveau relance le suivant)
CREATE OR REPLACE FUNCTION public.cp_links_cascade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  r record;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NULL; END IF;
  FOR r IN
    WITH changed AS (
      SELECT n.id, n.ends_on AS new_end, (n.ends_on - o.ends_on) AS end_delta
      FROM new_t n JOIN old_t o ON o.id = n.id
      WHERE n.starts_on IS DISTINCT FROM o.starts_on OR n.ends_on IS DISTINCT FROM o.ends_on
    ), cand AS (
      SELECT l.successor_id AS sid, c.new_end, c.end_delta
      FROM changed c JOIN public.cp_item_links l ON l.predecessor_id = c.id
      WHERE c.new_end IS NOT NULL AND l.successor_id NOT IN (SELECT id FROM changed)
    )
    SELECT DISTINCT ON (sid) sid, new_end, end_delta FROM cand ORDER BY sid, new_end DESC
  LOOP
    PERFORM public.cp_link_apply(r.sid, r.new_end, r.end_delta);
  END LOOP;
  RETURN NULL;
END;
$$;

-- À la création d'une dépendance : si elle est déjà violée, le successeur est décalé tout de suite (selon le réglage du projet)
CREATE OR REPLACE FUNCTION public.cp_link_enforce_new()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_end date;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NULL; END IF;
  SELECT i.ends_on INTO v_end FROM public.cp_items i WHERE i.id = NEW.predecessor_id;
  PERFORM public.cp_link_apply(NEW.successor_id, v_end, 0);
  RETURN NULL;
END;
$$;

-- 5. Branchements : isolation entreprise, garde d'écriture, contrôles, journal d'audit, règles (module activé ET droit) -------------------
ALTER TABLE public.cp_item_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON public.cp_item_links;
CREATE POLICY org_isolation ON public.cp_item_links AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = (SELECT public.app_org_id())) WITH CHECK (organization_id = (SELECT public.app_org_id()));
DROP POLICY IF EXISTS projects_read ON public.cp_item_links;
DROP POLICY IF EXISTS projects_insert ON public.cp_item_links;
DROP POLICY IF EXISTS projects_update ON public.cp_item_links;
DROP POLICY IF EXISTS projects_delete ON public.cp_item_links;
CREATE POLICY projects_read ON public.cp_item_links FOR SELECT TO authenticated
  USING ((SELECT public.org_module_enabled('cp.projects')) AND (SELECT public.rbac_has_any_permission(ARRAY['cp.projects:read'])));
CREATE POLICY projects_insert ON public.cp_item_links FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.org_module_enabled('cp.projects')) AND (SELECT public.rbac_has_any_permission(ARRAY['cp.projects:create'])));
CREATE POLICY projects_update ON public.cp_item_links FOR UPDATE TO authenticated
  USING ((SELECT public.org_module_enabled('cp.projects')) AND (SELECT public.rbac_has_any_permission(ARRAY['cp.projects:update'])))
  WITH CHECK ((SELECT public.org_module_enabled('cp.projects')) AND (SELECT public.rbac_has_any_permission(ARRAY['cp.projects:update'])));
CREATE POLICY projects_delete ON public.cp_item_links FOR DELETE TO authenticated
  USING ((SELECT public.org_module_enabled('cp.projects')) AND (SELECT public.rbac_has_any_permission(ARRAY['cp.projects:delete'])));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cp_item_links TO authenticated, service_role;
REVOKE ALL ON public.cp_item_links FROM anon;

DROP TRIGGER IF EXISTS a_org_write_guard ON public.cp_item_links;
CREATE TRIGGER a_org_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.cp_item_links FOR EACH ROW EXECUTE FUNCTION public.org_write_guard();
DROP TRIGGER IF EXISTS b_cp_item_link_guard ON public.cp_item_links;
CREATE TRIGGER b_cp_item_link_guard BEFORE INSERT OR UPDATE ON public.cp_item_links FOR EACH ROW EXECUTE FUNCTION public.cp_item_link_guard();
DROP TRIGGER IF EXISTS c_cp_item_link_enforce ON public.cp_item_links;
CREATE TRIGGER c_cp_item_link_enforce AFTER INSERT ON public.cp_item_links FOR EACH ROW EXECUTE FUNCTION public.cp_link_enforce_new();
DROP TRIGGER IF EXISTS cp_item_links_audit_trigger ON public.cp_item_links;
CREATE TRIGGER cp_item_links_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.cp_item_links FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS c_cp_items_links_cascade ON public.cp_items;
CREATE TRIGGER c_cp_items_links_cascade AFTER UPDATE ON public.cp_items
  REFERENCING OLD TABLE AS old_t NEW TABLE AS new_t FOR EACH STATEMENT EXECUTE FUNCTION public.cp_links_cascade();
