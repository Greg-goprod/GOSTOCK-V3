/*
  Étape 2 de PILOTE : notifications.

  On réutilise TOUT ce qui existe déjà pour les avis personnels de GO-Mat : la table notifications (une ligne avec
  recipient_user_id), la cloche et l'écran « Notifications », l'état « lu » propre à chaque personne, l'e-mail (fonction Edge
  send-notification-emails) et la notification push. Cette migration ne fait donc que PRODUIRE des avis PILOTE :

    cp_assigned       on t'assigne une phase / tâche / jalon / sous-tâche
    cp_team_added     on t'ajoute à l'équipe d'un projet
    cp_dates_changed  les dates d'un élément qui t'est assigné changent (plusieurs changements rapprochés = un seul avis)
    cp_due_soon       un élément qui t'est assigné se termine aujourd'hui ou demain (un avis par jour)
    cp_overdue        un élément qui t'est assigné est en retard de 1 à 3 jours (un avis par jour, puis on arrête)

  Règles : on ne s'avertit jamais soi-même ; rien pendant une restauration de sauvegarde ; les éléments terminés ou annulés
  ne produisent pas de rappel ; seules les personnes actives sont averties.

  Choix par personne et par type d'avis (cp_notification_prefs) : « dans l'application », « e-mail », « push ». Sans choix
  enregistré, valeurs par défaut (cp_pref_defaults) : tout activé, sauf l'e-mail pour « dates modifiées ». Un canal désactivé
  n'est pas simplement caché : l'avis est créé déjà marqué comme envoyé (emailed_at / pushed_at), donc les fonctions d'envoi
  existantes ne le prennent jamais (aucune modification de ces fonctions). « Dans l'application » désactivé = aucun avis du tout.
*/

-- 1. Lien vers le projet / l'élément concerné -----------------------------------------------------------------------
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS cp_project_id uuid REFERENCES public.cp_projects(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS cp_item_id uuid REFERENCES public.cp_items(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS notifications_cp_project_idx ON public.notifications (cp_project_id) WHERE cp_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_cp_item_idx ON public.notifications (cp_item_id) WHERE cp_item_id IS NOT NULL;

-- 2. Choix par personne ------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cp_notification_prefs (
  user_id uuid NOT NULL DEFAULT public.app_user_id() REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('cp_assigned', 'cp_team_added', 'cp_dates_changed', 'cp_due_soon', 'cp_overdue')),
  organization_id uuid NOT NULL DEFAULT public.new_row_org_id() REFERENCES public.organizations(id),
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  push boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);
CREATE INDEX IF NOT EXISTS cp_notification_prefs_org_idx ON public.cp_notification_prefs (organization_id);

ALTER TABLE public.cp_notification_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON public.cp_notification_prefs;
CREATE POLICY org_isolation ON public.cp_notification_prefs AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = (SELECT public.app_org_id())) WITH CHECK (organization_id = (SELECT public.app_org_id()));
DROP POLICY IF EXISTS cp_notification_prefs_own ON public.cp_notification_prefs;
CREATE POLICY cp_notification_prefs_own ON public.cp_notification_prefs FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cp_notification_prefs TO authenticated, service_role;
REVOKE ALL ON public.cp_notification_prefs FROM anon;
DROP TRIGGER IF EXISTS a_org_write_guard ON public.cp_notification_prefs;
CREATE TRIGGER a_org_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.cp_notification_prefs FOR EACH ROW EXECUTE FUNCTION public.org_write_guard();

-- Valeurs par défaut, dans l'ordre d'affichage
CREATE OR REPLACE FUNCTION public.cp_pref_defaults()
RETURNS TABLE (kind text, in_app boolean, email boolean, push boolean, ord integer)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT * FROM (VALUES
    ('cp_assigned'::text, true, true, true, 1),
    ('cp_team_added', true, true, true, 2),
    ('cp_dates_changed', true, false, true, 3),
    ('cp_due_soon', true, true, true, 4),
    ('cp_overdue', true, true, true, 5)
  ) v (kind, in_app, email, push, ord)
$$;

-- Les choix de la personne connectée, valeurs par défaut comprises (pour l'écran)
CREATE OR REPLACE FUNCTION public.my_cp_notification_prefs()
RETURNS TABLE (kind text, in_app boolean, email boolean, push boolean)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT d.kind, COALESCE(p.in_app, d.in_app), COALESCE(p.email, d.email), COALESCE(p.push, d.push)
  FROM public.cp_pref_defaults() d
  LEFT JOIN public.cp_notification_prefs p ON p.kind = d.kind AND p.user_id = public.app_user_id()
  ORDER BY d.ord
$$;

-- 3. Création d'un avis (interne : réservée aux déclencheurs et aux contrôles planifiés) -------------------------------
CREATE OR REPLACE FUNCTION public.cp_notify(
  p_user uuid, p_kind text, p_title text, p_message text, p_project uuid, p_item uuid, p_dedupe text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_org uuid;
  v_in boolean;
  v_mail boolean;
  v_push boolean;
BEGIN
  SELECT u.organization_id INTO v_org FROM public.users u WHERE u.id = p_user AND u.active;
  IF v_org IS NULL THEN RETURN false; END IF;
  SELECT COALESCE(p.in_app, d.in_app), COALESCE(p.email, d.email), COALESCE(p.push, d.push)
    INTO v_in, v_mail, v_push
  FROM public.cp_pref_defaults() d
  LEFT JOIN public.cp_notification_prefs p ON p.kind = d.kind AND p.user_id = p_user
  WHERE d.kind = p_kind;
  IF v_in IS NULL THEN RAISE EXCEPTION 'Type d''avis inconnu : %', p_kind; END IF;
  IF NOT v_in THEN RETURN false; END IF;
  INSERT INTO public.notifications (organization_id, kind, title, message, recipient_user_id, cp_project_id, cp_item_id, dedupe_key, emailed_at, pushed_at)
  VALUES (v_org, p_kind, p_title, p_message, p_user, p_project, p_item, p_dedupe,
          CASE WHEN v_mail THEN NULL ELSE now() END, CASE WHEN v_push THEN NULL ELSE now() END)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_notify(uuid, text, text, text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- Nom de la personne qui agit (pour « X t'a assigné… »)
CREATE OR REPLACE FUNCTION public.cp_actor_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE((SELECT NULLIF(btrim(u.first_name || ' ' || u.last_name), '') FROM public.users u WHERE u.id = public.app_user_id()), 'Quelqu''un')
$$;
REVOKE EXECUTE ON FUNCTION public.cp_actor_name() FROM PUBLIC, anon, authenticated;

-- 4. Déclencheurs ---------------------------------------------------------------------------------------------------------
-- 4a. On t'assigne un élément
CREATE OR REPLACE FUNCTION public.cp_notify_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  i record;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.user_id IS NOT DISTINCT FROM public.app_user_id() THEN RETURN NEW; END IF;
  SELECT it.id, it.name, it.kind, it.ends_on, it.project_id, p.name AS project_name INTO i
  FROM public.cp_items it JOIN public.cp_projects p ON p.id = it.project_id WHERE it.id = NEW.item_id;
  IF i.id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.cp_notify(
    NEW.user_id, 'cp_assigned', 'Nouvelle assignation',
    format('%s t''a assigné %s « %s » (projet « %s »)%s.', public.cp_actor_name(),
           CASE i.kind WHEN 'phase' THEN 'la phase' WHEN 'task' THEN 'la tâche' WHEN 'milestone' THEN 'le jalon' ELSE 'la sous-tâche' END,
           i.name, i.project_name, CASE WHEN i.ends_on IS NULL THEN '' ELSE ', à terminer le ' || to_char(i.ends_on, 'DD.MM.YYYY') END),
    i.project_id, i.id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_notify_assigned() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS c_cp_notify_assigned ON public.cp_item_members;
CREATE TRIGGER c_cp_notify_assigned AFTER INSERT ON public.cp_item_members FOR EACH ROW EXECUTE FUNCTION public.cp_notify_assigned();

-- 4b. On t'ajoute à l'équipe d'un projet
CREATE OR REPLACE FUNCTION public.cp_notify_team_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_project text;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.user_id IS NOT DISTINCT FROM public.app_user_id() THEN RETURN NEW; END IF;
  SELECT p.name INTO v_project FROM public.cp_projects p WHERE p.id = NEW.project_id;
  IF v_project IS NULL THEN RETURN NEW; END IF;
  PERFORM public.cp_notify(
    NEW.user_id, 'cp_team_added', 'Tu rejoins un projet',
    format('%s t''a ajouté à l''équipe du projet « %s » (%s).', public.cp_actor_name(), v_project, CASE NEW.role WHEN 'lead' THEN 'responsable' ELSE 'membre' END),
    NEW.project_id, NULL);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_notify_team_added() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS c_cp_notify_team_added ON public.cp_project_members;
CREATE TRIGGER c_cp_notify_team_added AFTER INSERT ON public.cp_project_members FOR EACH ROW EXECUTE FUNCTION public.cp_notify_team_added();

-- 4c. Les dates d'un élément assigné changent. Un seul avis par personne et par projet et par instruction, et les changements
--     rapprochés (moins de 10 minutes, décalage en cascade compris) sont regroupés dans le même avis.
CREATE OR REPLACE FUNCTION public.cp_notify_dates_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor uuid := public.app_user_id();
  r record;
  v_id uuid;
  v_fmt text;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NULL; END IF;
  FOR r IN
    SELECT m.user_id, n.project_id, p.name AS project_name,
           count(DISTINCT n.id) AS items,
           (array_agg(n.id ORDER BY n.name))[1] AS first_id,
           (array_agg(n.name ORDER BY n.name))[1] AS first_name,
           (array_agg(n.starts_on ORDER BY n.name))[1] AS first_from,
           (array_agg(n.ends_on ORDER BY n.name))[1] AS first_to
    FROM n
    JOIN o ON o.id = n.id
    JOIN public.cp_item_members m ON m.item_id = n.id
    JOIN public.cp_projects p ON p.id = n.project_id
    WHERE (n.starts_on, n.ends_on) IS DISTINCT FROM (o.starts_on, o.ends_on)
      AND m.user_id IS DISTINCT FROM v_actor
    GROUP BY m.user_id, n.project_id, p.name
  LOOP
    v_id := NULL;
    UPDATE public.notifications SET
      title = 'Dates modifiées',
      message = format('Des dates ont changé dans le projet « %s » (plusieurs de tes éléments).', r.project_name),
      cp_item_id = NULL
    WHERE id = (
      SELECT x.id FROM public.notifications x
      WHERE x.recipient_user_id = r.user_id AND x.kind = 'cp_dates_changed' AND x.cp_project_id = r.project_id
        AND x.created_at > now() - interval '10 minutes'
      ORDER BY x.created_at DESC LIMIT 1)
    RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN CONTINUE; END IF;
    v_fmt := CASE
      WHEN r.items > 1 THEN format('Des dates ont changé pour %s de tes éléments du projet « %s ».', r.items, r.project_name)
      WHEN r.first_from IS NULL AND r.first_to IS NULL THEN format('%s a retiré les dates de « %s » (projet « %s »).', public.cp_actor_name(), r.first_name, r.project_name)
      ELSE format('%s a changé les dates de « %s » (projet « %s ») : du %s au %s.', public.cp_actor_name(), r.first_name, r.project_name,
                  COALESCE(to_char(r.first_from, 'DD.MM.YYYY'), '?'), COALESCE(to_char(r.first_to, 'DD.MM.YYYY'), '?'))
    END;
    PERFORM public.cp_notify(r.user_id, 'cp_dates_changed', 'Dates modifiées', v_fmt, r.project_id, CASE WHEN r.items = 1 THEN r.first_id END);
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_notify_dates_changed() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS c_cp_notify_dates ON public.cp_items;
CREATE TRIGGER c_cp_notify_dates AFTER UPDATE ON public.cp_items
  REFERENCING OLD TABLE AS o NEW TABLE AS n FOR EACH STATEMENT EXECUTE FUNCTION public.cp_notify_dates_changed();

-- 5. Rappels quotidiens (appelés par la fonction Edge, comme les autres contrôles planifiés) ------------------------------
-- cp_due_soon : se termine aujourd'hui ou demain ; cp_overdue : fini depuis 1 à 3 jours. Éléments terminés / annulés exclus.
-- Un avis par personne et par jour par type (dedupe_key) : rappeler cette fonction plusieurs fois par jour ne double rien.
CREATE OR REPLACE FUNCTION public.check_cp_deadlines()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_key text := to_char((now() AT TIME ZONE 'Europe/Zurich')::date, 'YYYYMMDD');
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT m.user_id, count(*) AS n,
           CASE WHEN count(DISTINCT i.project_id) = 1 THEN (array_agg(i.project_id))[1] END AS project_id,
           (array_agg(format('« %s » (%s)', i.name, CASE WHEN i.ends_on = v_today THEN 'aujourd''hui' ELSE 'demain' END) ORDER BY i.ends_on, i.name))[1:5] AS lst
    FROM public.cp_items i
    JOIN public.cp_statuses s ON s.id = i.status_id AND s.family IN ('not_started', 'in_progress')
    JOIN public.cp_item_members m ON m.item_id = i.id
    WHERE i.ends_on IN (v_today, v_today + 1)
    GROUP BY m.user_id
  LOOP
    IF public.cp_notify(r.user_id, 'cp_due_soon', 'Échéance proche',
         'À terminer aujourd''hui ou demain : ' || array_to_string(r.lst, ', ') || CASE WHEN r.n > 5 THEN format(' et %s autre(s)', r.n - 5) ELSE '' END || '.',
         r.project_id, NULL, 'cp_due_soon:' || r.user_id || ':' || v_key) THEN v_count := v_count + 1; END IF;
  END LOOP;

  FOR r IN
    SELECT m.user_id, count(*) AS n,
           CASE WHEN count(DISTINCT i.project_id) = 1 THEN (array_agg(i.project_id))[1] END AS project_id,
           (array_agg(format('« %s » (prévu le %s)', i.name, to_char(i.ends_on, 'DD.MM')) ORDER BY i.ends_on, i.name))[1:5] AS lst
    FROM public.cp_items i
    JOIN public.cp_statuses s ON s.id = i.status_id AND s.family IN ('not_started', 'in_progress')
    JOIN public.cp_item_members m ON m.item_id = i.id
    WHERE i.ends_on < v_today AND i.ends_on >= v_today - 3
    GROUP BY m.user_id
  LOOP
    IF public.cp_notify(r.user_id, 'cp_overdue', 'Élément en retard',
         'En retard : ' || array_to_string(r.lst, ', ') || CASE WHEN r.n > 5 THEN format(' et %s autre(s)', r.n - 5) ELSE '' END || '.',
         r.project_id, NULL, 'cp_overdue:' || r.user_id || ':' || v_key) THEN v_count := v_count + 1; END IF;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_cp_deadlines() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_cp_deadlines() TO service_role;
