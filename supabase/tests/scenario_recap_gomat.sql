-- SCÉNARIO DE TEST DU RÉCAPITULATIF QUOTIDIEN PILOTE — à coller dans le SQL Editor de GO-MAT (exécuté en administrateur de la base).
-- Ce fichier n'est PAS une migration : il ne crée ni table ni fonction. Il ajoute 2 tâches de test, puis (partie 3) les retire.
--
-- Ce que l'on veut voir : le lendemain (jour ouvré) vers 7 h 00 (Zurich), UN avis « Ton récapitulatif du jour » pour la personne de test
-- (noreply@gc-entertainment.ch), et l'e-mail qui va avec (elle a déjà l'e-mail activé pour « cp_digest »).
-- Il part seulement s'il y a quelque chose à signaler : on crée donc une tâche à terminer ce jour-là et une tâche en retard.
--
-- ============ PARTIE 1 — PRÉPARATION (à lancer UNE fois, puis NE PAS ouvrir les avis de la personne de test) ============
DO $scenario$
DECLARE
  v_org     constant uuid := '00000000-0000-0000-0000-000000000001';
  v_project constant uuid := '62d8cb72-3624-4e45-9453-01b9d680d579';   -- « test projet b »
  v_user    uuid;
  v_status  uuid;
  v_today   date := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_due     date;
  v_late    date;
  v_item_a  uuid;
  v_item_b  uuid;
BEGIN
  SELECT id INTO v_user FROM public.users WHERE organization_id = v_org AND lower(email) = 'noreply@gc-entertainment.ch' AND active;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Personne de test introuvable (noreply@gc-entertainment.ch, active) : rien n''a été créé'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cp_projects WHERE id = v_project AND organization_id = v_org AND NOT is_template) THEN
    RAISE EXCEPTION 'Projet « test projet b » introuvable : rien n''a été créé';
  END IF;
  IF EXISTS (SELECT 1 FROM public.cp_items WHERE project_id = v_project AND name LIKE 'ZZ-TEST récap%') THEN
    RAISE EXCEPTION 'Le scénario est déjà en place (tâches « ZZ-TEST récap… » présentes) : lance d''abord la partie 3 pour le retirer';
  END IF;
  SELECT id INTO v_status FROM public.cp_statuses WHERE organization_id = v_org AND family = 'in_progress' ORDER BY position LIMIT 1;
  IF v_status IS NULL THEN RAISE EXCEPTION 'État « En cours » introuvable : rien n''a été créé'; END IF;

  -- Prochain jour ouvré STRICTEMENT après aujourd'hui (le récapitulatif ne part pas le week-end) ; la tâche en retard est plus ancienne de 2 jours
  v_due := v_today + 1;
  WHILE extract(isodow FROM v_due) > 5 OR EXISTS (SELECT 1 FROM public.cp_calendar_days d WHERE d.organization_id = v_org AND d.day = v_due) LOOP
    v_due := v_due + 1;
  END LOOP;
  v_late := v_due - 2;

  -- Sans avis « ajouté à l'équipe » ni d'assignation (même réglage que la copie de projet, limité à cette exécution) : le décompte attendu reste simple
  PERFORM set_config('gomat.cp_copy', 'on', true);

  -- Une tâche ne s'assigne qu'à une personne de l'équipe du projet
  INSERT INTO public.cp_project_members (project_id, user_id, organization_id, role) VALUES (v_project, v_user, v_org, 'member') ON CONFLICT DO NOTHING;

  INSERT INTO public.cp_items (organization_id, project_id, kind, name, status_id, starts_on, ends_on)
    VALUES (v_org, v_project, 'task', 'ZZ-TEST récap — à terminer ce jour-là', v_status, v_due, v_due) RETURNING id INTO v_item_a;
  INSERT INTO public.cp_items (organization_id, project_id, kind, name, status_id, starts_on, ends_on)
    VALUES (v_org, v_project, 'task', 'ZZ-TEST récap — en retard', v_status, v_late, v_late) RETURNING id INTO v_item_b;
  INSERT INTO public.cp_item_members (item_id, user_id, organization_id) VALUES (v_item_a, v_user, v_org), (v_item_b, v_user, v_org);

  RAISE NOTICE 'Scénario en place. Jour attendu du récapitulatif : % (vers 7 h 00 Zurich). Tâche à terminer : %, tâche en retard : %.', v_due, v_due, v_late;
END
$scenario$;

-- Contrôle de la préparation (lecture seule) : doit montrer 2 tâches, assignées à « TEST Utilisateur PILOTE »
SELECT i.name, i.starts_on, i.ends_on, s.name AS etat, u.email AS assignee
FROM public.cp_items i
JOIN public.cp_statuses s ON s.id = i.status_id
JOIN public.cp_item_members m ON m.item_id = i.id
JOIN public.users u ON u.id = m.user_id
WHERE i.name LIKE 'ZZ-TEST récap%' ORDER BY i.ends_on;

-- ============ PARTIE 2 — CONTRÔLE (lecture seule, à lancer le jour attendu, après 7 h 10 Zurich) ============
-- Attendu : 1 ligne « cp_digest » créée entre 07:00 et 07:10 (Zurich), message du genre
--   « 1 à terminer aujourd'hui (« ZZ-TEST récap — à terminer ce jour-là ») · 1 en retard (« ZZ-TEST récap — en retard ») · N avis PILOTE non lu(s). »
-- avec N = les avis « échéance proche » / « en retard » créés automatiquement par la fonction d'e-mails (la veille et dans la nuit), tant que la personne de test ne les a pas ouverts (en général 2 à 4 : ils partent aussi par e-mail, ce qui teste au passage les liens).
-- emailed_at rempli = l'e-mail est parti (la boîte de noreply@gc-entertainment.ch doit le montrer). pushed_at rempli sans push réel : le push est désactivé pour ce type d'avis.
/*
SELECT n.created_at AT TIME ZONE 'Europe/Zurich' AS heure_zurich, n.kind, n.title, n.message, n.read_at, n.emailed_at, n.email_error, n.email_attempts
FROM public.notifications n
JOIN public.users u ON u.id = n.recipient_user_id
WHERE lower(u.email) = 'noreply@gc-entertainment.ch' AND n.kind LIKE 'cp\_%' AND n.created_at > now() - interval '3 days'
ORDER BY n.created_at;
*/

-- ============ PARTIE 3 — NETTOYAGE (à lancer quand le test est fini) ============
-- Retire les 2 tâches, la place de la personne de test dans l'équipe du projet, et SES avis PILOTE des 4 derniers jours (créés par ce scénario).
/*
DO $nettoyage$
DECLARE
  v_org     constant uuid := '00000000-0000-0000-0000-000000000001';
  v_project constant uuid := '62d8cb72-3624-4e45-9453-01b9d680d579';
  v_user    uuid;
BEGIN
  SELECT id INTO v_user FROM public.users WHERE organization_id = v_org AND lower(email) = 'noreply@gc-entertainment.ch';
  DELETE FROM public.cp_items WHERE project_id = v_project AND name LIKE 'ZZ-TEST récap%';
  DELETE FROM public.cp_project_members WHERE project_id = v_project AND user_id = v_user;
  DELETE FROM public.notifications WHERE recipient_user_id = v_user AND kind LIKE 'cp\_%' AND created_at > now() - interval '4 days';
END
$nettoyage$;
*/
