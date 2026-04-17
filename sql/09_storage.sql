-- ============================================================
-- CITYPULSE — STEP 09: STORAGE BUCKET SETUP
-- ============================================================
-- Run in Supabase SQL Editor. Creates the storage bucket
-- used for citizen report images and admin resolution photos.
-- NOTE: If using Supabase Dashboard, you can create the bucket
-- there instead. This is for programmatic setup only.

-- Create images bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  TRUE,           -- Public read: images are served via CDN URL
  10485760,       -- 10MB max file size
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = TRUE,
      file_size_limit = 10485760;

-- RLS policy: Allow service role to do everything
DROP POLICY IF EXISTS "Service full access" ON storage.objects;
CREATE POLICY "Service full access"
  ON storage.objects FOR ALL
  USING (bucket_id = 'images')
  WITH CHECK (bucket_id = 'images');

-- RLS policy: Allow anyone to read images (public CDN)
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'images');
