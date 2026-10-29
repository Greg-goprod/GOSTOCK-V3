/*
  Numérotation automatique des articles

  Chaque organisation choisit une série de 6 caractères (lettres et chiffres) ; la base
  attribue ensuite les numéros SERIE-000001, SERIE-000002… à chaque nouvel article.
  - Le compteur est propre à l'organisation et ne revient jamais en arrière
    (verrou de ligne : deux ajouts simultanés n'obtiennent pas le même numéro).
  - Changer de série ne remet pas le compteur à zéro.
  - Les articles déjà numérotés gardent leur numéro (étiquettes déjà imprimées).
  - Un numéro saisi à la main (import Excel) est conservé tel quel.
*/

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS article_series text NOT NULL DEFAULT 'GOMAT1',
  ADD COLUMN IF NOT EXISTS article_counter bigint NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_article_series_format') THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_article_series_format CHECK (article_series ~ '^[A-Z0-9]{6}$');
  END IF;
END $$;

-- Prochain numéro de l'organisation (incrémente le compteur)
CREATE OR REPLACE FUNCTION public.next_article_number(p_organization_id uuid DEFAULT public.default_organization_id())
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_series text;
  v_counter bigint;
  v_number text;
BEGIN
  LOOP
    UPDATE public.organizations
    SET article_counter = article_counter + 1
    WHERE id = p_organization_id
    RETURNING article_series, article_counter INTO v_series, v_counter;

    IF v_series IS NULL THEN
      RAISE EXCEPTION 'Organisation introuvable : %', p_organization_id;
    END IF;

    v_number := v_series || '-' || lpad(v_counter::text, 6, '0');
    -- Saute un numéro déjà pris (saisi à la main ou importé)
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.equipment WHERE article_number = v_number);
  END LOOP;
  RETURN v_number;
END;
$$;

-- Aperçu du prochain numéro, sans le consommer (affiché dans les paramètres)
CREATE OR REPLACE FUNCTION public.preview_article_number(p_organization_id uuid DEFAULT public.default_organization_id())
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT article_series || '-' || lpad((article_counter + 1)::text, 6, '0')
  FROM public.organizations
  WHERE id = p_organization_id;
$$;

-- Choix de la série par le responsable
CREATE OR REPLACE FUNCTION public.set_article_series(p_series text, p_organization_id uuid DEFAULT public.default_organization_id())
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_series text := upper(trim(p_series));
BEGIN
  IF v_series !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'La série doit contenir exactement 6 lettres ou chiffres (sans accent ni espace)';
  END IF;
  UPDATE public.organizations SET article_series = v_series WHERE id = p_organization_id;
  RETURN public.preview_article_number(p_organization_id);
END;
$$;

-- Le déclencheur existant (equipment_article_number_trigger) appelle cette fonction
CREATE OR REPLACE FUNCTION public.set_article_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.article_number IS NULL OR btrim(NEW.article_number) = '' THEN
    -- equipment n'a pas encore de colonne organization_id : organisation par défaut
    NEW.article_number := public.next_article_number(public.default_organization_id());
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.next_article_number(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.preview_article_number(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.set_article_series(text, uuid) SET search_path = public, extensions;
ALTER FUNCTION public.set_article_number() SET search_path = public, extensions;
