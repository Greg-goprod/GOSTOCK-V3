-- Lot 24 — Shop matériel : photos des articles prises au téléphone ou importées.
-- Compartiment PUBLIC en lecture (les photos produit ne sont pas sensibles et s'affichent
-- en grille dans le shop sans lien temporaire) ; seul le magasin (manage_stock) peut
-- ajouter, remplacer ou supprimer une photo.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photos-articles', 'photos-articles', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'photos_articles_ajout') THEN
    CREATE POLICY photos_articles_ajout ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'photos-articles' AND public.app_has('manage_stock'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'photos_articles_modif') THEN
    CREATE POLICY photos_articles_modif ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'photos-articles' AND public.app_has('manage_stock'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'photos_articles_suppression') THEN
    CREATE POLICY photos_articles_suppression ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'photos-articles' AND public.app_has('manage_stock'));
  END IF;
END $$;
