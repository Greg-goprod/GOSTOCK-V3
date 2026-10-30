-- Lot 16 (suite) : permis machines suisses et catégories complètes du permis de conduire.
--
-- Les permis machines (cariste, nacelle, grutier, machiniste…) sont des « formations » de type
-- « permis machine » : même suivi (attestation, échéance) et même blocage à la sortie, à la demande
-- et au comptoir quand un outil les exige. Le catalogue ci-dessous est ajouté une fois ; chaque
-- entreprise peut renommer, compléter ou supprimer.

ALTER TABLE public.trainings ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'training';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trainings_kind_check') THEN
    ALTER TABLE public.trainings ADD CONSTRAINT trainings_kind_check CHECK (kind IN ('training', 'machine_permit'));
  END IF;
END $$;

INSERT INTO public.trainings (name, kind, validity_months, description)
SELECT name, 'machine_permit', validity, description
FROM (VALUES
  ('Chariot élévateur frontal (permis de cariste)', NULL::integer, 'Formation de cariste reconnue (directive CFST 6518 « Chariots de manutention »).'),
  ('Chariot élévateur télescopique', NULL, 'Module télescopique de la formation de cariste (directive CFST 6518).'),
  ('Chariot télescopique rotatif', NULL, 'Module télescopique rotatif de la formation de cariste (directive CFST 6518).'),
  ('Gerbeur et transpalette électriques', NULL, 'Instruction documentée selon la directive CFST 6518.'),
  ('Nacelle PEMP – IPAF 1a (statique verticale)', 60, 'Carte IPAF PAL, valable 5 ans.'),
  ('Nacelle PEMP – IPAF 1b (statique à flèche)', 60, 'Carte IPAF PAL, valable 5 ans.'),
  ('Nacelle PEMP – IPAF 3a (mobile verticale, ciseaux)', 60, 'Carte IPAF PAL, valable 5 ans.'),
  ('Nacelle PEMP – IPAF 3b (mobile à flèche)', 60, 'Carte IPAF PAL, valable 5 ans.'),
  ('Grutier – catégorie A (grue à tour)', NULL, 'Permis de grutier selon l''ordonnance sur les grues (OGrues).'),
  ('Grutier – catégorie B (grue automotrice)', NULL, 'Permis de grutier selon l''ordonnance sur les grues (OGrues).'),
  ('Grue de chargement (camion-grue)', NULL, 'Attestation de formation pour grues de chargement.'),
  ('Pont roulant et palan', NULL, 'Instruction documentée par l''employeur.'),
  ('Machiniste – pelle hydraulique', NULL, 'Formation de machiniste de chantier.'),
  ('Machiniste – chargeuse sur pneus', NULL, 'Formation de machiniste de chantier.'),
  ('Machiniste – dumper (tombereau)', NULL, 'Formation de machiniste de chantier.'),
  ('Machiniste – rouleau compresseur', NULL, 'Formation de machiniste de chantier.'),
  ('Mini-pelle et mini-chargeuse', NULL, 'Formation de machiniste de chantier (engins compacts).'),
  ('Échafaudage roulant (montage)', NULL, 'Instruction au montage et à l''utilisation (Suva).')
) AS p(name, validity, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.trainings t
  WHERE t.organization_id = public.default_organization_id() AND lower(btrim(t.name)) = lower(btrim(p.name))
);

-- Permis de conduire : catégories suisses (OAC) et ce que chacune autorise aussi
--   A → A1 ; B → B1, F, G, M ; C → C1 ; CE → C1E, BE ; D → D1 ; DE → D1E, BE ; F → G, M
CREATE OR REPLACE FUNCTION public.license_covers(p_user_id uuid, p_category text, p_until timestamptz)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user public.users;
  v_needed text := upper(trim(COALESCE(p_category, '')));
  v_held text[];
BEGIN
  IF v_needed = '' THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF v_user.license_expires_on IS NOT NULL AND v_user.license_expires_on < p_until::date THEN
    RETURN format('Le permis de %s %s expire le %s, avant la fin de la réservation',
                  v_user.first_name, v_user.last_name, to_char(v_user.license_expires_on, 'DD.MM.YYYY'));
  END IF;
  SELECT array_agg(DISTINCT c) INTO v_held FROM (
    SELECT unnest(v_user.license_categories) AS c
    UNION ALL
    SELECT unnest(CASE h
      WHEN 'A' THEN ARRAY['A1']
      WHEN 'B' THEN ARRAY['B1', 'F', 'G', 'M']
      WHEN 'C' THEN ARRAY['C1']
      WHEN 'CE' THEN ARRAY['C1E', 'BE']
      WHEN 'D' THEN ARRAY['D1']
      WHEN 'DE' THEN ARRAY['D1E', 'BE']
      WHEN 'F' THEN ARRAY['G', 'M']
      ELSE ARRAY[]::text[] END)
    FROM unnest(v_user.license_categories) AS h
  ) x;
  IF v_needed = ANY (COALESCE(v_held, '{}')) THEN
    RETURN NULL;
  END IF;
  RETURN format('%s %s n''a pas le permis %s requis%s', v_user.first_name, v_user.last_name, v_needed,
                CASE WHEN cardinality(v_user.license_categories) = 0 THEN ' (permis non renseigné dans « Personnes »)' ELSE '' END);
END;
$$;
ALTER FUNCTION public.license_covers(uuid, text, timestamptz) SET search_path = public, extensions;
