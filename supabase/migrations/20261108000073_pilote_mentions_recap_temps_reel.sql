/*
  PILOTE P11 : mentions @, récapitulatif quotidien, temps réel.

  MENTIONS. Écrire « @Prénom Nom » dans un message avertit cette personne (avis « cp_mention », qui ouvre la discussion).
    - cp_comments.mentions : personnes mentionnées, DÉDUITES DU TEXTE par la base (cp_comment_guard) : personnes actives de l'entreprise, jamais l'auteur,
      20 au plus. Le client n'envoie aucune liste : impossible d'avertir quelqu'un dont le nom n'est pas écrit dans le message.
    - Choix de la personne (cp_notification_prefs) : dans l'application activé par défaut ; E-MAIL et PUSH DÉSACTIVÉS par défaut, à activer par chacune
      (décision de Greg). Un canal désactivé = avis créé déjà marqué comme envoyé (même mécanisme que les autres avis PILOTE).
    - Une personne mentionnée ne reçoit pas EN PLUS l'avis « nouveau message » du même message. Modifier un message n'avertit que les NOUVELLES personnes
      mentionnées ; une même personne n'est avertie qu'une fois par message (clé anti-doublon).
  RÉCAPITULATIF QUOTIDIEN (avis « cp_digest »). Une fois par jour ouvré (lundi à vendredi, hors jours du calendrier de travail de l'entreprise), dans l'heure qui suit
    l'heure réglée par l'administrateur (réglage système « pilote_digest_hour », 0 à 23, heure de Zurich, 7 par défaut), chaque personne active reçoit un avis qui
    résume : ses éléments à terminer aujourd'hui, ses éléments en retard, ses avis PILOTE non lus. Rien à signaler = aucun avis. Les modèles, terminés et annulés
    ne comptent pas. Mêmes choix que les autres avis : dans l'application activé par défaut, e-mail et push désactivés. Calculé par check_cp_deadlines (déjà appelée
    toutes les 5 minutes par la fonction d'e-mails) : aucun redéploiement de la fonction n'est nécessaire pour CE point.
  TEMPS RÉEL. cp_enable_realtime() ajoute les tables PILOTE à la publication « supabase_realtime » si elle existe (sans effet, sans erreur sinon). Les abonnements
    respectent les règles d'accès (isolation par entreprise).
*/

-- 1. Mentions -------------------------------------------------------------------------------------------------------------
ALTER TABLE public.cp_comments ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.cp_comments DROP CONSTRAINT IF EXISTS cp_comments_mentions_check;
ALTER TABLE public.cp_comments ADD CONSTRAINT cp_comments_mentions_check CHECK (cardinality(mentions) <= 20);

ALTER TABLE public.cp_notification_prefs DROP CONSTRAINT IF EXISTS cp_notification_prefs_kind_check;
ALTER TABLE public.cp_notification_prefs ADD CONSTRAINT cp_notification_prefs_kind_check
  CHECK (kind IN ('cp_assigned', 'cp_team_added', 'cp_dates_changed', 'cp_due_soon', 'cp_overdue', 'cp_comment', 'cp_mention', 'cp_digest'));

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
    ('cp_overdue', true, true, true, 5),
    ('cp_comment', true, false, true, 6),
    ('cp_mention', true, false, false, 7),
    ('cp_digest', true, false, false, 8)
  ) v (kind, in_app, email, push, ord)
$$;

-- Contrôles de ligne d'un message (remplace la version de la migration 58 : + déduction des personnes mentionnées)
CREATE OR REPLACE FUNCTION public.cp_comment_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_item_project uuid;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    -- L'auteur est la personne connectée : le client ne choisit pas (sans session, par exemple la fonction de service, on garde la valeur donnée)
    IF public.app_user_id() IS NOT NULL THEN NEW.author_id := public.app_user_id(); END IF;
    IF NOT EXISTS (SELECT 1 FROM public.cp_projects p WHERE p.id = NEW.project_id AND p.organization_id = NEW.organization_id) THEN
      RAISE EXCEPTION 'Projet introuvable';
    END IF;
    IF NEW.item_id IS NOT NULL THEN
      SELECT i.project_id INTO v_item_project FROM public.cp_items i WHERE i.id = NEW.item_id AND i.organization_id = NEW.organization_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Élément introuvable'; END IF;
      IF v_item_project <> NEW.project_id THEN RAISE EXCEPTION 'Cet élément n''est pas dans ce projet'; END IF;
    END IF;
  ELSE
    IF NEW.project_id <> OLD.project_id OR NEW.item_id IS DISTINCT FROM OLD.item_id OR NEW.author_id IS DISTINCT FROM OLD.author_id OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'Un message ne change ni de fiche, ni d''auteur, ni de date';
    END IF;
    IF NEW.body <> OLD.body THEN NEW.edited_at := now(); ELSE NEW.edited_at := OLD.edited_at; END IF;
  END IF;
  -- Personnes mentionnées : « @Prénom Nom » écrit dans le texte (majuscules indifférentes, pas collé à une lettre, pas suivi d'une lettre, d'un chiffre ou d'un tiret),
  -- personnes ACTIVES de la même entreprise, jamais l'auteur, 20 au plus. Déduit du texte par la base : le client ne choisit pas qui est averti.
  NEW.mentions := COALESCE((
    SELECT (array_agg(u.id ORDER BY u.last_name, u.first_name, u.id))[1:20]
    FROM public.users u
    WHERE u.organization_id = NEW.organization_id AND u.active AND u.id IS DISTINCT FROM NEW.author_id
      AND btrim(u.first_name || ' ' || u.last_name) <> ''
      AND NEW.body ~* ('(?<![[:alnum:]])@' || regexp_replace(btrim(u.first_name || ' ' || u.last_name), '([][\\.^$|?*+(){}])', '\\\1', 'g') || '(?![[:alnum:]_-])')
  ), '{}');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_comment_guard() FROM PUBLIC, anon, authenticated;

-- Avis « nouveau message » (remplace la version de la migration 58 : ne double plus l'avis de mention)
CREATE OR REPLACE FUNCTION public.cp_notify_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_target text;
  v_excerpt text;
  r record;
  v_id uuid;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.item_id IS NULL THEN
    SELECT p.name INTO v_target FROM public.cp_projects p WHERE p.id = NEW.project_id;
  ELSE
    SELECT i.name INTO v_target FROM public.cp_items i WHERE i.id = NEW.item_id;
  END IF;
  IF v_target IS NULL THEN RETURN NEW; END IF;
  v_excerpt := regexp_replace(NEW.body, '\s+', ' ', 'g');
  IF char_length(v_excerpt) > 90 THEN v_excerpt := left(v_excerpt, 89) || '…'; END IF;

  FOR r IN
    SELECT DISTINCT u.user_id
    FROM (
      SELECT m.user_id FROM public.cp_project_members m WHERE NEW.item_id IS NULL AND m.project_id = NEW.project_id
      UNION
      SELECT im.user_id FROM public.cp_item_members im WHERE NEW.item_id IS NOT NULL AND im.item_id = NEW.item_id
    ) u
    WHERE u.user_id IS DISTINCT FROM NEW.author_id
      AND NOT (u.user_id = ANY (NEW.mentions))   -- une personne mentionnée reçoit l'avis de mention, pas en plus celui du message
  LOOP
    -- Un avis non lu de moins de 10 minutes sur la même fiche : on le met à jour au lieu d'en créer un autre
    v_id := NULL;
    UPDATE public.notifications SET
      title = 'Nouveaux messages',
      message = format('Plusieurs nouveaux messages dans « %s ».', v_target)
    WHERE id = (
      SELECT x.id FROM public.notifications x
      WHERE x.recipient_user_id = r.user_id AND x.kind = 'cp_comment' AND x.cp_project_id = NEW.project_id
        AND x.cp_item_id IS NOT DISTINCT FROM NEW.item_id
        AND x.created_at > now() - interval '10 minutes'
        AND x.read_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.notification_reads rd WHERE rd.notification_id = x.id AND rd.user_id = r.user_id AND rd.is_read)
      ORDER BY x.created_at DESC LIMIT 1)
    RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN CONTINUE; END IF;
    PERFORM public.cp_notify(
      r.user_id, 'cp_comment', 'Nouveau message',
      format('%s a écrit dans « %s » : « %s ».', public.cp_actor_name(), v_target, v_excerpt),
      NEW.project_id, NEW.item_id);
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_notify_comment() FROM PUBLIC, anon, authenticated;

-- Avis de mention : à l'ajout du message, et à sa modification pour les personnes NOUVELLEMENT mentionnées
CREATE OR REPLACE FUNCTION public.cp_notify_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_target text;
  v_excerpt text;
  v_user uuid;
BEGIN
  IF current_setting('gomat.restoring', true) = 'on' THEN RETURN NEW; END IF;
  IF cardinality(NEW.mentions) = 0 THEN RETURN NEW; END IF;
  IF NEW.item_id IS NULL THEN
    SELECT p.name INTO v_target FROM public.cp_projects p WHERE p.id = NEW.project_id;
  ELSE
    SELECT i.name INTO v_target FROM public.cp_items i WHERE i.id = NEW.item_id;
  END IF;
  IF v_target IS NULL THEN RETURN NEW; END IF;
  v_excerpt := regexp_replace(NEW.body, '\s+', ' ', 'g');
  IF char_length(v_excerpt) > 90 THEN v_excerpt := left(v_excerpt, 89) || '…'; END IF;
  FOREACH v_user IN ARRAY NEW.mentions LOOP
    IF TG_OP = 'UPDATE' AND v_user = ANY (OLD.mentions) THEN CONTINUE; END IF;
    PERFORM public.cp_notify(v_user, 'cp_mention', 'Tu as été mentionné',
      format('%s t''a mentionné dans « %s » : « %s ».', public.cp_actor_name(), v_target, v_excerpt),
      NEW.project_id, NEW.item_id, 'cp_mention:' || NEW.id || ':' || v_user);
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_notify_mentions() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS c_cp_notify_mentions ON public.cp_comments;
CREATE TRIGGER c_cp_notify_mentions AFTER INSERT ON public.cp_comments FOR EACH ROW EXECUTE FUNCTION public.cp_notify_mentions();
DROP TRIGGER IF EXISTS c_cp_notify_mentions_upd ON public.cp_comments;
CREATE TRIGGER c_cp_notify_mentions_upd AFTER UPDATE OF body ON public.cp_comments FOR EACH ROW WHEN (NEW.mentions IS DISTINCT FROM OLD.mentions) EXECUTE FUNCTION public.cp_notify_mentions();

-- 2. Récapitulatif quotidien ---------------------------------------------------------------------------------------------
-- p_now : l'instant « présent » (réservé aux essais ; la tâche planifiée appelle sans paramètre). Renvoie le nombre d'avis créés.
CREATE OR REPLACE FUNCTION public.cp_send_digests(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_local timestamp := p_now AT TIME ZONE 'Europe/Zurich';
  v_today date := (p_now AT TIME ZONE 'Europe/Zurich')::date;
  v_key text := to_char((p_now AT TIME ZONE 'Europe/Zurich')::date, 'YYYYMMDD');
  v_hour integer;
  o record;
  u record;
  v_due_n integer; v_due_l text[];
  v_late_n integer; v_late_l text[];
  v_unread integer;
  v_parts text[];
  v_sent integer := 0;
BEGIN
  IF extract(isodow FROM v_today) > 5 THEN RETURN 0; END IF;
  FOR o IN
    SELECT og.id FROM public.organizations og
    WHERE og.active AND EXISTS (SELECT 1 FROM public.organization_modules m WHERE m.organization_id = og.id AND m.module_key = 'cp.projects')
  LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.cp_calendar_days d WHERE d.organization_id = o.id AND d.day = v_today);
    SELECT CASE WHEN btrim(s.value) ~ '^\d{1,2}$' AND btrim(s.value)::integer BETWEEN 0 AND 23 THEN btrim(s.value)::integer END
      INTO v_hour FROM public.system_settings s WHERE s.organization_id = o.id AND s.id = 'pilote_digest_hour';
    v_hour := COALESCE(v_hour, 7);
    -- Dans l'heure qui suit l'heure réglée seulement : un réglage changé le soir ne produit pas de récapitulatif tardif
    CONTINUE WHEN extract(hour FROM v_local)::integer <> v_hour;
    FOR u IN
      SELECT x.id FROM public.users x
      WHERE x.organization_id = o.id AND x.active
        AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.dedupe_key = 'cp_digest:' || x.id || ':' || v_key)
    LOOP
      SELECT count(*), COALESCE((array_agg(format('« %s »', i.name) ORDER BY i.name))[1:3], '{}') INTO v_due_n, v_due_l
      FROM public.cp_items i
      JOIN public.cp_projects p ON p.id = i.project_id AND NOT p.is_template
      JOIN public.cp_statuses s ON s.id = i.status_id AND s.family IN ('not_started', 'in_progress')
      JOIN public.cp_item_members m ON m.item_id = i.id AND m.user_id = u.id
      WHERE i.organization_id = o.id AND i.ends_on = v_today;
      SELECT count(*), COALESCE((array_agg(format('« %s »', i.name) ORDER BY i.ends_on, i.name))[1:3], '{}') INTO v_late_n, v_late_l
      FROM public.cp_items i
      JOIN public.cp_projects p ON p.id = i.project_id AND NOT p.is_template
      JOIN public.cp_statuses s ON s.id = i.status_id AND s.family IN ('not_started', 'in_progress')
      JOIN public.cp_item_members m ON m.item_id = i.id AND m.user_id = u.id
      WHERE i.organization_id = o.id AND i.ends_on < v_today;
      SELECT count(*) INTO v_unread FROM public.notifications n
      WHERE n.recipient_user_id = u.id AND n.kind LIKE 'cp\_%' AND n.kind <> 'cp_digest' AND n.read_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.notification_reads rd WHERE rd.notification_id = n.id AND rd.user_id = u.id AND rd.is_read);
      v_parts := ARRAY[]::text[];
      IF v_due_n > 0 THEN v_parts := v_parts || format('%s à terminer aujourd''hui (%s%s)', v_due_n, array_to_string(v_due_l, ', '), CASE WHEN v_due_n > 3 THEN format(' et %s autre(s)', v_due_n - 3) ELSE '' END); END IF;
      IF v_late_n > 0 THEN v_parts := v_parts || format('%s en retard (%s%s)', v_late_n, array_to_string(v_late_l, ', '), CASE WHEN v_late_n > 3 THEN format(' et %s autre(s)', v_late_n - 3) ELSE '' END); END IF;
      IF v_unread > 0 THEN v_parts := v_parts || format('%s avis PILOTE non lu(s)', v_unread); END IF;
      CONTINUE WHEN cardinality(v_parts) = 0;
      IF public.cp_notify(u.id, 'cp_digest', 'Ton récapitulatif du jour', array_to_string(v_parts, ' · ') || '.', NULL, NULL, 'cp_digest:' || u.id || ':' || v_key) THEN
        v_sent := v_sent + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN v_sent;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_send_digests(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cp_send_digests(timestamptz) TO service_role;

-- Rappels d'échéance (remplace la version de la migration 53 : + récapitulatif quotidien)
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
  -- Récapitulatif quotidien (une fois par jour ouvré, à l'heure réglée par l'administrateur) : voir cp_send_digests
  v_count := v_count + public.cp_send_digests();
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_cp_deadlines() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_cp_deadlines() TO service_role;

-- 3. Temps réel ------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cp_enable_realtime()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  t text;
  v_added integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN RETURN 0; END IF;
  FOREACH t IN ARRAY ARRAY['cp_projects', 'cp_items', 'cp_item_members', 'cp_project_members', 'cp_comments', 'cp_item_resources'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      v_added := v_added + 1;
    END IF;
  END LOOP;
  RETURN v_added;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cp_enable_realtime() FROM PUBLIC, anon, authenticated;
SELECT public.cp_enable_realtime();
