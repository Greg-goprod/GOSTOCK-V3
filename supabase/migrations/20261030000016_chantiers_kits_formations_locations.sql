/*
  Chantiers, kits, formations obligatoires, matériel loué

  - sites : fiche chantier (adresse, responsable, dates, budget matériel, ouvert / clôturé).
    Les demandes, bons de sortie et sorties de consommables sont reliés au chantier par son nom
    (texte « Chantier ou service » déjà saisi partout) : site_id est rempli automatiquement, y compris
    pour l'historique quand la fiche est créée après coup. Un chantier clôturé refuse les nouvelles sorties.
  - site_summary / site_open_items : dépenses face au budget, et tout ce qui doit encore revenir.
  - kits / kit_items : un QR « GOMAT-KIT:<code> » fait sortir tout le contenu ; checkouts.kit_id
    permet de rendre le kit d'un scan et de voir ce qui manque.
  - trainings / user_trainings : formations (nacelle, chariot…) avec validité. Un article qui exige
    une formation ne sort pas (comptoir, bon, demande) pour une personne sans formation valable.
  - rentals : matériel loué chez un loueur, coût par jour, alerte avant la date de restitution et
    pendant le retard ; le coût compte dans les coûts par chantier.
*/

-- 1. Chantiers --------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.site_key(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT lower(regexp_replace(btrim(COALESCE(p_text, '')), '\s+', ' ', 'g')) $$;

CREATE TABLE IF NOT EXISTS public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  name text NOT NULL CHECK (btrim(name) <> ''),
  client text,
  address text,
  manager_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  start_on date,
  end_on date,
  budget numeric(12, 2) CHECK (budget IS NULL OR budget >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_on IS NULL OR start_on IS NULL OR end_on >= start_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS sites_name_key ON public.sites (organization_id, public.site_key(name));

ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.delivery_notes ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS requests_site_idx ON public.requests (site_id) WHERE site_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS delivery_notes_site_idx ON public.delivery_notes (site_id) WHERE site_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_movements_site_idx ON public.stock_movements (site_id) WHERE site_id IS NOT NULL;

-- Chantier désigné par un texte libre : « Chantier Renens » ou « Demande D-0012 · Chantier Renens »
CREATE OR REPLACE FUNCTION public.site_id_for(p_text text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT s.id
  FROM unnest(string_to_array(COALESCE(p_text, ''), ' · ')) WITH ORDINALITY AS part(txt, n)
  JOIN public.sites s ON public.site_key(s.name) = public.site_key(part.txt)
  ORDER BY part.n
  LIMIT 1
$$;

-- Avant écriture : relie la ligne au chantier d'après la colonne texte passée en argument
CREATE OR REPLACE FUNCTION public.link_site()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_text text := to_jsonb(NEW) ->> TG_ARGV[0];
  v_status text;
  v_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.site_id IS NULL THEN
      NEW.site_id := public.site_id_for(v_text);
    END IF;
  ELSIF NEW.site_id IS NOT DISTINCT FROM OLD.site_id AND v_text IS DISTINCT FROM (to_jsonb(OLD) ->> TG_ARGV[0]) THEN
    NEW.site_id := public.site_id_for(v_text);
  END IF;

  -- Chantier clôturé : plus de nouvelles sorties (les retours restent possibles)
  IF TG_OP = 'INSERT' AND NEW.site_id IS NOT NULL
     AND (TG_TABLE_NAME <> 'stock_movements' OR to_jsonb(NEW) ->> 'kind' = 'consumption') THEN
    SELECT status, name INTO v_status, v_name FROM public.sites WHERE id = NEW.site_id;
    IF v_status = 'closed' THEN
      RAISE EXCEPTION 'Le chantier « % » est clôturé : rouvrez-le dans « Chantiers » pour y sortir du matériel', v_name
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES ('requests', 'destination'), ('delivery_notes', 'notes'), ('stock_movements', 'destination')) AS t(tbl, col) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = r.tbl || '_link_site' AND tgrelid = ('public.' || r.tbl)::regclass) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.link_site(%L)',
                     r.tbl || '_link_site', r.tbl, r.col);
    END IF;
  END LOOP;
END $$;

-- Fiche créée ou renommée : l'historique déjà saisi sous ce nom lui est rattaché
CREATE OR REPLACE FUNCTION public.sites_link_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND public.site_key(NEW.name) = public.site_key(OLD.name) THEN
    RETURN NEW;
  END IF;
  UPDATE public.requests SET site_id = NEW.id WHERE site_id IS NULL AND public.site_id_for(destination) = NEW.id;
  UPDATE public.delivery_notes SET site_id = NEW.id WHERE site_id IS NULL AND public.site_id_for(notes) = NEW.id;
  UPDATE public.stock_movements SET site_id = NEW.id WHERE site_id IS NULL AND public.site_id_for(destination) = NEW.id;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sites_link_history_trigger' AND tgrelid = 'public.sites'::regclass) THEN
    CREATE TRIGGER sites_link_history_trigger
      AFTER INSERT OR UPDATE OF name ON public.sites
      FOR EACH ROW EXECUTE FUNCTION public.sites_link_history();
  END IF;
END $$;

-- 2. Kits ----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  name text NOT NULL CHECK (btrim(name) <> ''),
  -- Contenu du QR : GOMAT-KIT:<code>
  code text NOT NULL UNIQUE DEFAULT upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  depot_id uuid REFERENCES public.depots(id) ON DELETE SET NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  -- Exemplaire précis (outil numéroté) ; sinon une quantité de l'article
  instance_id uuid REFERENCES public.equipment_instances(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  CHECK (instance_id IS NULL OR quantity = 1)
);
CREATE INDEX IF NOT EXISTS kit_items_kit_idx ON public.kit_items (kit_id);
CREATE UNIQUE INDEX IF NOT EXISTS kit_items_instance_key ON public.kit_items (instance_id) WHERE instance_id IS NOT NULL;

ALTER TABLE public.checkouts ADD COLUMN IF NOT EXISTS kit_id uuid REFERENCES public.kits(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS checkouts_kit_idx ON public.checkouts (kit_id) WHERE kit_id IS NOT NULL;

-- Un kit ne contient que des outils (les consommables sont décomptés, pas rendus)
CREATE OR REPLACE FUNCTION public.kit_items_check()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_type text;
  v_name text;
BEGIN
  SELECT item_type, name INTO v_type, v_name FROM public.equipment WHERE id = NEW.equipment_id;
  IF v_type = 'consumable' THEN
    RAISE EXCEPTION '« % » est un consommable : un kit ne contient que des outils', v_name USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.instance_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.equipment_instances WHERE id = NEW.instance_id AND equipment_id = NEW.equipment_id
  ) THEN
    RAISE EXCEPTION 'Exemplaire introuvable pour cet article' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kit_items_check_trigger' AND tgrelid = 'public.kit_items'::regclass) THEN
    CREATE TRIGGER kit_items_check_trigger
      BEFORE INSERT OR UPDATE ON public.kit_items
      FOR EACH ROW EXECUTE FUNCTION public.kit_items_check();
  END IF;
END $$;

-- create_checkout : chaque ligne peut porter le kit dont elle fait partie
CREATE OR REPLACE FUNCTION public.create_checkout(
  p_user_id uuid,
  p_due_date timestamptz,
  p_items jsonb,
  p_notes text DEFAULT NULL
)
RETURNS public.delivery_notes
LANGUAGE plpgsql
AS $$
DECLARE
  v_note public.delivery_notes;
  v_item jsonb;
  v_quantity integer;
  v_instance uuid;
  v_kit uuid;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Aucun équipement à sortir';
  END IF;

  INSERT INTO public.delivery_notes (user_id, due_date, notes)
  VALUES (p_user_id, p_due_date, p_notes)
  RETURNING * INTO v_note;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_instance := NULLIF(v_item->>'instance_id', '')::uuid;
    v_kit := NULLIF(v_item->>'kit_id', '')::uuid;

    IF v_instance IS NOT NULL THEN
      -- Le verrou sérialise deux sorties simultanées du même exemplaire
      PERFORM 1 FROM public.equipment_instances
      WHERE id = v_instance AND equipment_id = (v_item->>'equipment_id')::uuid
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Exemplaire introuvable pour cet équipement';
      END IF;
      IF EXISTS (SELECT 1 FROM public.checkouts WHERE instance_id = v_instance AND status IN ('active', 'overdue')) THEN
        RAISE EXCEPTION 'Cet exemplaire est déjà sorti';
      END IF;
      INSERT INTO public.checkouts (equipment_id, instance_id, user_id, delivery_note_id, due_date, status, notes, kit_id)
      VALUES ((v_item->>'equipment_id')::uuid, v_instance, p_user_id, v_note.id, p_due_date, 'active', p_notes, v_kit);
      CONTINUE;
    END IF;

    v_quantity := COALESCE((v_item->>'quantity')::integer, 1);
    IF v_quantity < 1 THEN
      RAISE EXCEPTION 'Quantité invalide';
    END IF;

    -- Une ligne par unité : le trigger refuse la sortie dès qu'il n'y a plus de stock
    INSERT INTO public.checkouts (equipment_id, user_id, delivery_note_id, due_date, status, notes, kit_id)
    SELECT (v_item->>'equipment_id')::uuid, p_user_id, v_note.id, p_due_date, 'active', p_notes, v_kit
    FROM generate_series(1, v_quantity);
  END LOOP;

  RETURN v_note;
END;
$$;

-- 3. Formations obligatoires ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  name text NOT NULL CHECK (btrim(name) <> ''),
  -- Durée de validité ; vide = sans échéance
  validity_months integer CHECK (validity_months IS NULL OR validity_months > 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trainings_name_key ON public.trainings (organization_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.user_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  obtained_on date NOT NULL DEFAULT current_date,
  expires_on date,
  certificate_path text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, training_id),
  CHECK (expires_on IS NULL OR expires_on >= obtained_on)
);

ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS required_training_id uuid REFERENCES public.trainings(id) ON DELETE SET NULL;

-- Échéance calculée d'après la validité de la formation, sauf date saisie
CREATE OR REPLACE FUNCTION public.user_trainings_set_expiry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_months integer;
BEGIN
  IF NEW.expires_on IS NULL THEN
    SELECT validity_months INTO v_months FROM public.trainings WHERE id = NEW.training_id;
    IF v_months IS NOT NULL THEN
      NEW.expires_on := (NEW.obtained_on + make_interval(months => v_months))::date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'user_trainings_set_expiry_trigger' AND tgrelid = 'public.user_trainings'::regclass) THEN
    CREATE TRIGGER user_trainings_set_expiry_trigger
      BEFORE INSERT OR UPDATE ON public.user_trainings
      FOR EACH ROW EXECUTE FUNCTION public.user_trainings_set_expiry();
  END IF;
END $$;

-- La personne peut-elle utiliser cet article jusqu'à cette date ? NULL = oui, sinon la raison
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
BEGIN
  SELECT t.* INTO v_training
  FROM public.equipment e JOIN public.trainings t ON t.id = e.required_training_id
  WHERE e.id = p_equipment_id;
  IF v_training.id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT name INTO v_item FROM public.equipment WHERE id = p_equipment_id;
  SELECT first_name || ' ' || last_name INTO v_who FROM public.users WHERE id = p_user_id;
  SELECT true, ut.expires_on INTO v_found, v_expires
  FROM public.user_trainings ut WHERE ut.user_id = p_user_id AND ut.training_id = v_training.id;
  IF NOT COALESCE(v_found, false) THEN
    RETURN format('« %s » exige la formation « %s » : %s ne l''a pas (à saisir dans « Formations »)', v_item, v_training.name, v_who);
  END IF;
  IF v_expires IS NOT NULL AND v_expires < COALESCE(p_until, now())::date THEN
    RETURN format('La formation « %s » de %s %s le %s : « %s » ne peut pas sortir', v_training.name, v_who,
                  CASE WHEN v_expires < current_date THEN 'a expiré' ELSE 'expire' END, to_char(v_expires, 'DD.MM.YYYY'), v_item);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.checkouts_check_training()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_problem text;
BEGIN
  IF NEW.status NOT IN ('active', 'overdue') THEN
    RETURN NEW;
  END IF;
  -- La formation doit couvrir la sortie entière, sans bloquer une date de retour déjà passée
  v_problem := public.training_problem(NEW.user_id, NEW.equipment_id, GREATEST(NEW.due_date, now()));
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION 'Sortie refusée : %', v_problem USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'checkouts_check_training_trigger' AND tgrelid = 'public.checkouts'::regclass) THEN
    CREATE TRIGGER checkouts_check_training_trigger
      BEFORE INSERT ON public.checkouts
      FOR EACH ROW EXECUTE FUNCTION public.checkouts_check_training();
  END IF;
END $$;

-- create_request : permis pour les véhicules, formation pour les outils (refus dès la demande)
CREATE OR REPLACE FUNCTION public.create_request(
  p_requester_id uuid, p_depot_id uuid, p_start timestamptz, p_end timestamptz,
  p_items jsonb, p_destination text DEFAULT NULL, p_notes text DEFAULT NULL
)
RETURNS public.requests
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item jsonb;
  v_problem text;
BEGIN
  IF current_setting('role', true) = 'authenticated' THEN
    IF public.app_user_id() IS NULL THEN
      RAISE EXCEPTION 'Accès refusé';
    END IF;
    IF p_requester_id IS DISTINCT FROM public.app_user_id()
       AND NOT (public.app_has('scan') OR public.app_has('approve')) THEN
      RAISE EXCEPTION 'Vous ne pouvez faire une demande que pour vous-même';
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    v_problem := NULL;
    IF v_item->>'kind' = 'vehicle' THEN
      SELECT public.license_covers(p_requester_id, v.license_category, p_end) INTO v_problem
      FROM public.vehicles v WHERE v.id = (v_item->>'id')::uuid;
    ELSIF v_item->>'kind' = 'tool' THEN
      v_problem := public.training_problem(p_requester_id, (v_item->>'id')::uuid, p_end);
    END IF;
    IF v_problem IS NOT NULL THEN
      RAISE EXCEPTION '%', v_problem;
    END IF;
  END LOOP;

  RETURN public.create_request_impl(p_requester_id, p_depot_id, p_start, p_end, p_items, p_destination, p_notes);
END;
$$;

-- 4. Matériel loué chez un loueur ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  rental_company text NOT NULL CHECK (btrim(rental_company) <> ''),
  description text NOT NULL CHECK (btrim(description) <> ''),
  contract_ref text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  daily_rate numeric(10, 2) NOT NULL DEFAULT 0 CHECK (daily_rate >= 0),
  -- Forfait unique (transport, nettoyage…)
  fixed_cost numeric(10, 2) NOT NULL DEFAULT 0 CHECK (fixed_cost >= 0),
  start_on date NOT NULL DEFAULT current_date,
  end_on date NOT NULL,
  returned_on date,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  depot_id uuid REFERENCES public.depots(id) ON DELETE SET NULL,
  responsible_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  contract_path text,
  notes text,
  created_by uuid DEFAULT public.app_user_id() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_on >= start_on),
  CHECK (returned_on IS NULL OR returned_on >= start_on)
);
CREATE INDEX IF NOT EXISTS rentals_open_idx ON public.rentals (end_on) WHERE returned_on IS NULL;

-- Jours facturés jusqu'à la restitution (ou aujourd'hui tant que le matériel n'est pas rendu)
CREATE OR REPLACE VIEW public.rental_status WITH (security_invoker = true) AS
SELECT
  r.*,
  CASE WHEN r.returned_on IS NOT NULL THEN 'returned'
       WHEN r.end_on < current_date THEN 'overdue'
       ELSE 'active' END AS state,
  (COALESCE(r.returned_on, GREATEST(current_date, r.start_on)) - r.start_on + 1) AS days_billed,
  (r.end_on - r.start_on + 1) AS days_planned,
  (COALESCE(r.returned_on, GREATEST(current_date, r.start_on)) - r.start_on + 1) * r.daily_rate * r.quantity + r.fixed_cost AS cost,
  CASE WHEN r.returned_on IS NULL AND r.end_on < current_date
       THEN (current_date - r.end_on) * r.daily_rate * r.quantity ELSE 0 END AS overdue_cost,
  s.name AS site_name
FROM public.rentals r
LEFT JOIN public.sites s ON s.id = r.site_id;

-- 5. Coûts et suivi par chantier -----------------------------------------------------------------
-- Les locations s'ajoutent aux coûts par chantier (consommables, jours d'outils)
CREATE OR REPLACE VIEW public.site_cost_lines WITH (security_invoker = true) AS
SELECT
  'consumable'::text AS source,
  COALESCE(NULLIF(trim(m.destination), ''), 'Sans chantier') AS site,
  m.created_at AS at,
  m.equipment_id,
  e.name,
  -m.quantity AS quantity,
  e.unit,
  COALESCE(e.purchase_price, 0) AS unit_cost,
  -m.quantity * COALESCE(e.purchase_price, 0) AS amount,
  m.user_id
FROM public.stock_movements m
JOIN public.equipment e ON e.id = m.equipment_id
WHERE m.kind = 'consumption'
UNION ALL
SELECT
  'tool',
  COALESCE(NULLIF(trim(r.destination), ''), NULLIF(trim(dn.notes), ''), 'Sans chantier'),
  c.checkout_date,
  c.equipment_id,
  e.name,
  GREATEST(1, ceil(extract(epoch FROM COALESCE(c.return_date, now()) - c.checkout_date) / 86400.0))::numeric,
  'jour',
  COALESCE(e.daily_rate, 0),
  GREATEST(1, ceil(extract(epoch FROM COALESCE(c.return_date, now()) - c.checkout_date) / 86400.0)) * COALESCE(e.daily_rate, 0),
  c.user_id
FROM public.checkouts c
JOIN public.equipment e ON e.id = c.equipment_id
LEFT JOIN public.delivery_notes dn ON dn.id = c.delivery_note_id
LEFT JOIN public.requests r ON r.delivery_note_id = c.delivery_note_id
UNION ALL
SELECT
  'rental',
  COALESCE(rs.site_name, 'Sans chantier'),
  rs.start_on::timestamptz,
  NULL::uuid,
  rs.description || ' (' || rs.rental_company || ')',
  rs.days_billed::numeric * rs.quantity,
  'jour',
  rs.daily_rate,
  rs.cost,
  rs.responsible_id
FROM public.rental_status rs;

-- Dépenses par chantier (fiche) : consommables, jours d'outils, locations
CREATE OR REPLACE VIEW public.site_summary WITH (security_invoker = true) AS
SELECT
  s.*,
  COALESCE(c.amount, 0) AS consumables_cost,
  COALESCE(t.amount, 0) AS tools_cost,
  COALESCE(l.amount, 0) AS rentals_cost,
  COALESCE(c.amount, 0) + COALESCE(t.amount, 0) + COALESCE(l.amount, 0) AS spent,
  COALESCE(t.open_items, 0) AS open_tools,
  COALESCE(l.open_items, 0) AS open_rentals
FROM public.sites s
LEFT JOIN LATERAL (
  SELECT sum(-m.quantity * COALESCE(e.purchase_price, 0)) AS amount
  FROM public.stock_movements m JOIN public.equipment e ON e.id = m.equipment_id
  WHERE m.site_id = s.id AND m.kind = 'consumption'
) c ON true
LEFT JOIN LATERAL (
  SELECT sum(GREATEST(1, ceil(extract(epoch FROM COALESCE(ck.return_date, now()) - ck.checkout_date) / 86400.0)) * COALESCE(e.daily_rate, 0)) AS amount,
         count(*) FILTER (WHERE ck.status IN ('active', 'overdue')) AS open_items
  FROM public.checkouts ck
  JOIN public.delivery_notes dn ON dn.id = ck.delivery_note_id
  JOIN public.equipment e ON e.id = ck.equipment_id
  WHERE dn.site_id = s.id
) t ON true
LEFT JOIN LATERAL (
  SELECT sum(rs.cost) AS amount, count(*) FILTER (WHERE rs.returned_on IS NULL) AS open_items
  FROM public.rental_status rs WHERE rs.site_id = s.id
) l ON true;

-- Ce qui doit encore revenir du chantier (outils sortis et matériel loué)
CREATE OR REPLACE VIEW public.site_open_items WITH (security_invoker = true) AS
SELECT
  dn.site_id,
  'tool'::text AS kind,
  ck.id AS item_id,
  e.name || COALESCE(' · ' || i.qr_code, '') AS label,
  u.first_name || ' ' || u.last_name AS holder,
  ck.due_date AS due_at,
  ck.due_date < now() AS late
FROM public.checkouts ck
JOIN public.delivery_notes dn ON dn.id = ck.delivery_note_id
JOIN public.equipment e ON e.id = ck.equipment_id
LEFT JOIN public.equipment_instances i ON i.id = ck.instance_id
LEFT JOIN public.users u ON u.id = ck.user_id
WHERE dn.site_id IS NOT NULL AND ck.status IN ('active', 'overdue')
UNION ALL
SELECT
  r.site_id,
  'rental',
  r.id,
  r.description || ' (' || r.rental_company || ')',
  u.first_name || ' ' || u.last_name,
  r.end_on::timestamptz,
  r.end_on < current_date
FROM public.rentals r
LEFT JOIN public.users u ON u.id = r.responsible_id
WHERE r.site_id IS NOT NULL AND r.returned_on IS NULL;

-- 6. Alertes : formations qui expirent, restitutions de location ------------------------------------
CREATE OR REPLACE FUNCTION public.check_training_rental_deadlines()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_count integer := 0;
  v_n integer;
BEGIN
  -- Formation qui expire dans 30 jours ou moins : la personne et le magasin, une fois par échéance
  INSERT INTO public.notifications (organization_id, kind, title, message, recipient_user_id, dedupe_key)
  SELECT public.default_organization_id(), 'training_expiry', 'Formation à renouveler : ' || t.name,
         format('Votre formation « %s » %s le %s.', t.name, CASE WHEN ut.expires_on < v_today THEN 'a expiré' ELSE 'expire' END,
                to_char(ut.expires_on, 'DD.MM.YYYY')),
         ut.user_id, 'training_expiry:user:' || ut.id || ':' || ut.expires_on
  FROM public.user_trainings ut
  JOIN public.trainings t ON t.id = ut.training_id
  JOIN public.users u ON u.id = ut.user_id AND u.active
  WHERE ut.expires_on IS NOT NULL AND ut.expires_on <= v_today + 30
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  INSERT INTO public.notifications (organization_id, kind, title, message, dedupe_key)
  SELECT public.default_organization_id(), 'training_expiry', 'Formation à renouveler : ' || u.first_name || ' ' || u.last_name,
         format('La formation « %s » de %s %s %s le %s.', t.name, u.first_name, u.last_name,
                CASE WHEN ut.expires_on < v_today THEN 'a expiré' ELSE 'expire' END, to_char(ut.expires_on, 'DD.MM.YYYY')),
         'training_expiry:staff:' || ut.id || ':' || ut.expires_on
  FROM public.user_trainings ut
  JOIN public.trainings t ON t.id = ut.training_id
  JOIN public.users u ON u.id = ut.user_id AND u.active
  WHERE ut.expires_on IS NOT NULL AND ut.expires_on <= v_today + 30
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  -- Location à rendre dans 2 jours ou moins : une alerte par échéance (repart si la date est prolongée)
  INSERT INTO public.notifications (organization_id, kind, title, message, depot_id, dedupe_key)
  SELECT public.default_organization_id(), 'rental_due', 'Location à rendre : ' || r.description,
         format('« %s » loué chez %s%s est à rendre le %s. Prolongez-la ou organisez le retour.',
                r.description, r.rental_company, COALESCE(' pour ' || s.name, ''), to_char(r.end_on, 'DD.MM.YYYY')),
         r.depot_id, 'rental_due:' || r.id || ':' || r.end_on
  FROM public.rentals r
  LEFT JOIN public.sites s ON s.id = r.site_id
  WHERE r.returned_on IS NULL AND r.end_on BETWEEN v_today AND v_today + 2
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  -- En retard : chaque jour coûte ; une alerte par jour
  INSERT INTO public.notifications (organization_id, kind, title, message, depot_id, dedupe_key)
  SELECT public.default_organization_id(), 'rental_due', 'Location en retard : ' || r.description,
         format('« %s » (%s) devait être rendu le %s : %s jour(s) facturé(s) en plus, %s CHF.',
                r.description, r.rental_company, to_char(r.end_on, 'DD.MM.YYYY'), v_today - r.end_on,
                to_char((v_today - r.end_on) * r.daily_rate * r.quantity, 'FM999G990D00')),
         r.depot_id, 'rental_overdue:' || r.id || ':' || v_today
  FROM public.rentals r
  WHERE r.returned_on IS NULL AND r.end_on < v_today
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  -- Le responsable de la location est prévenu aussi (avis personnel)
  INSERT INTO public.notifications (organization_id, kind, title, message, recipient_user_id, dedupe_key)
  SELECT public.default_organization_id(), 'rental_due',
         CASE WHEN r.end_on < v_today THEN 'Location en retard' ELSE 'Location à rendre' END,
         format('« %s » loué chez %s est à rendre le %s.', r.description, r.rental_company, to_char(r.end_on, 'DD.MM.YYYY')),
         r.responsible_id,
         'rental_due:user:' || r.id || ':' || CASE WHEN r.end_on < v_today THEN v_today ELSE r.end_on END
  FROM public.rentals r
  WHERE r.returned_on IS NULL AND r.responsible_id IS NOT NULL AND r.end_on <= v_today + 2
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  RETURN v_count;
END;
$$;

-- 7. Règles d'accès ------------------------------------------------------------------------------
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  staff constant text := '(public.app_has(''view_all'') OR public.app_has(''scan'') OR public.app_has(''approve'') OR public.app_has(''manage_stock''))';
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    -- table, nom, commande, USING, WITH CHECK
    ('sites', 'sites_read', 'SELECT', 'public.app_is_member()', NULL),
    ('sites', 'sites_write', 'ALL', 'public.app_has(''manage_stock'') OR public.app_has(''approve'')',
       'public.app_has(''manage_stock'') OR public.app_has(''approve'')'),
    ('kits', 'kits_read', 'SELECT', 'public.app_is_member()', NULL),
    ('kits', 'kits_write', 'ALL', 'public.app_has(''manage_stock'')', 'public.app_has(''manage_stock'')'),
    ('kit_items', 'kit_items_read', 'SELECT', 'public.app_is_member()', NULL),
    ('kit_items', 'kit_items_write', 'ALL', 'public.app_has(''manage_stock'')', 'public.app_has(''manage_stock'')'),
    ('trainings', 'trainings_read', 'SELECT', 'public.app_is_member()', NULL),
    ('trainings', 'trainings_write', 'ALL', 'public.app_has(''manage_people'')', 'public.app_has(''manage_people'')'),
    ('user_trainings', 'user_trainings_read', 'SELECT', 'user_id = public.app_user_id() OR public.app_has(''manage_people'') OR ' || staff, NULL),
    ('user_trainings', 'user_trainings_write', 'ALL', 'public.app_has(''manage_people'')', 'public.app_has(''manage_people'')'),
    ('rentals', 'rentals_read', 'SELECT', 'responsible_id = public.app_user_id() OR ' || staff, NULL),
    ('rentals', 'rentals_write', 'ALL', 'public.app_has(''manage_stock'') OR public.app_has(''manage_fleet'')',
       'public.app_has(''manage_stock'') OR public.app_has(''manage_fleet'')')
  ) AS t(tbl, pol, cmd, using_expr, check_expr) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tbl AND policyname = r.pol) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated USING (%s)%s',
        r.pol, r.tbl, r.cmd, r.using_expr, CASE WHEN r.check_expr IS NOT NULL THEN format(' WITH CHECK (%s)', r.check_expr) ELSE '' END);
    END IF;
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites, public.kits, public.kit_items, public.trainings,
  public.user_trainings, public.rentals TO authenticated;
GRANT SELECT ON public.rental_status, public.site_summary, public.site_open_items, public.site_cost_lines TO authenticated;
GRANT ALL ON public.sites, public.kits, public.kit_items, public.trainings, public.user_trainings, public.rentals TO service_role;
GRANT SELECT ON public.rental_status, public.site_summary, public.site_open_items TO service_role;

-- Journal des modifications
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sites', 'kits', 'kit_items', 'trainings', 'user_trainings', 'rentals'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = t || '_audit_trigger' AND tgrelid = ('public.' || t)::regclass) THEN
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()',
                     t || '_audit_trigger', t);
    END IF;
  END LOOP;
END $$;

-- Fonctions de déclencheurs : pas appelables directement
REVOKE EXECUTE ON FUNCTION public.link_site(), public.sites_link_history(), public.kit_items_check(),
  public.user_trainings_set_expiry(), public.checkouts_check_training() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.site_id_for(text), public.training_problem(uuid, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_problem(uuid, uuid, timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.check_training_rental_deadlines() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_training_rental_deadlines() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_checkout(uuid, timestamptz, jsonb, text) FROM PUBLIC, anon;

ALTER FUNCTION public.site_key(text) SET search_path = public, extensions;
ALTER FUNCTION public.site_id_for(text) SET search_path = public, extensions;
ALTER FUNCTION public.link_site() SET search_path = public, extensions;
ALTER FUNCTION public.sites_link_history() SET search_path = public, extensions;
ALTER FUNCTION public.kit_items_check() SET search_path = public, extensions;
ALTER FUNCTION public.create_checkout(uuid, timestamptz, jsonb, text) SET search_path = public, extensions;
ALTER FUNCTION public.user_trainings_set_expiry() SET search_path = public, extensions;
ALTER FUNCTION public.training_problem(uuid, uuid, timestamptz) SET search_path = public, extensions;
ALTER FUNCTION public.checkouts_check_training() SET search_path = public, extensions;
ALTER FUNCTION public.create_request(uuid, uuid, timestamptz, timestamptz, jsonb, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.check_training_rental_deadlines() SET search_path = public, extensions;
