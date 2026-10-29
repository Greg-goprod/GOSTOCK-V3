/*
  Catalogue fournisseur (ex. Makita CH)

  Référentiel de produits qu'on ne possède pas forcément : il sert à remplir la fiche
  d'un outil ou d'un consommable au moment où on l'ajoute au stock.
  - catalog_products : un produit par (fournisseur, référence), réimportable sans doublon
  - equipment.catalog_product_id : lien vers la fiche catalogue d'origine
  - equipment.ean : code-barres du fabricant, reconnu par le scanner
*/

CREATE TABLE IF NOT EXISTS public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id() REFERENCES public.organizations(id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  reference text NOT NULL,
  name text NOT NULL,
  family text NOT NULL CHECK (family IN ('machine', 'accessory')),
  categories text[] NOT NULL DEFAULT '{}',
  ean text,
  short_title text,
  description text,
  image_url text,
  images text[] NOT NULL DEFAULT '{}',
  specs jsonb NOT NULL DEFAULT '[]',
  supplied_accessories jsonb NOT NULL DEFAULT '[]',
  url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, supplier_id, reference)
);

-- Texte de recherche : référence, nom, résumé et EAN en minuscules
ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS search_text text GENERATED ALWAYS AS (
    lower(reference || ' ' || name || ' ' || coalesce(short_title, '') || ' ' || coalesce(ean, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS catalog_products_ean_idx ON public.catalog_products (ean);
CREATE INDEX IF NOT EXISTS catalog_products_supplier_idx ON public.catalog_products (supplier_id);

ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ean text;

CREATE INDEX IF NOT EXISTS equipment_ean_idx ON public.equipment (ean);

-- Sécurité : RLS ouverte comme le reste tant que l'app n'a pas de connexion
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'catalog_products' AND policyname = 'catalog_products_open_access'
  ) THEN
    CREATE POLICY catalog_products_open_access ON public.catalog_products
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
