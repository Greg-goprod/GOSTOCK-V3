-- 1. Messages de la base au tutoiement, comme l'interface (décision du 30.10.2026).
--    Les fonctions concernées sont réécrites à partir de leur définition actuelle (pg_get_functiondef) :
--    seules ces phrases changent, le reste du code est conservé tel quel.
-- 2. « Qui a quoi » : tout membre voit qui a quel outil (nom, date de retour, chantier), via une fonction
--    dédiée. Les emprunts eux-mêmes (table checkouts) restent lisibles seulement par le magasin et l'emprunteur.

DO $$
DECLARE
  pairs text[][] := ARRAY[
    ['Vous ne pouvez déclarer un incident que sur votre propre emprunt', 'Tu ne peux déclarer un incident que sur ton propre emprunt'],
    ['Vous ne pouvez faire une demande que pour vous-même', 'Tu ne peux faire une demande que pour toi-même'],
    ['Vous ne pouvez régénérer que votre propre badge', 'Tu ne peux régénérer que ton propre badge'],
    ['Vous pouvez seulement annuler votre demande', 'Tu peux seulement annuler ta demande'],
    ['Votre demande', 'Ta demande'],
    ['Votre formation', 'Ta formation'],
    ['Votre %s%s est à renouveler le %s. Passez au magasin.', 'Ton %s%s est à renouveler le %s. Passe au magasin.'],
    ['prolongez la date', 'prolonge la date'],
    ['prolongez la location', 'prolonge la location'],
    ['choisissez un retour', 'choisis un retour'],
    ['Choisissez ', 'Choisis '],
    ['clôturez-les ou retirez-le', 'clôture-les ou retire-le'],
    ['clôturez la réception', 'clôture la réception'],
    ['clôturez le trajet', 'clôture le trajet'],
    ['rouvrez-le', 'rouvre-le'],
    ['Indiquez ', 'Indique '],
    ['Relevez ', 'Relève '],
    ['utilisez create_request', 'utilise create_request'],
    ['passez au magasin', 'passe au magasin'],
    ['enregistrez son retour', 'enregistre son retour']
  ];
  f record;
  def text;
  i int;
BEGIN
  FOR f IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND p.prosrc ~ '(Vous |Votre |vous-même|prolongez|choisissez|Choisissez|clôturez|rouvrez|Indiquez|Relevez|utilisez create|passez au|enregistrez son)'
  LOOP
    def := pg_get_functiondef(f.oid);
    FOR i IN 1 .. array_length(pairs, 1) LOOP
      def := replace(def, pairs[i][1], pairs[i][2]);
    END LOOP;
    EXECUTE def;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.who_has()
RETURNS TABLE (equipment_id uuid, user_id uuid, holder_name text, checkout_date timestamptz, due_date timestamptz, notes text, dropped_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT c.equipment_id, c.user_id, trim(u.first_name || ' ' || u.last_name), c.checkout_date, c.due_date, c.notes, c.dropped_at
  FROM public.checkouts c
  JOIN public.users u ON u.id = c.user_id
  WHERE public.app_is_member() AND c.status IN ('active', 'overdue');
$$;

REVOKE EXECUTE ON FUNCTION public.who_has() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.who_has() TO authenticated;
ALTER FUNCTION public.who_has() SET search_path = public, extensions;
