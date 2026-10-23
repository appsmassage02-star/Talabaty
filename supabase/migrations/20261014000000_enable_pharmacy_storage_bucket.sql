-- ==============================================================================
-- TALABAT AL-BAYT: ENABLE PHARMACY STORAGE BUCKET & RLS POLICIES
-- ==============================================================================
-- Ensures the 'pharmacy' bucket exists, is set to public (so delivery driver app
-- and customer app can load prescription images), and has proper RLS policies
-- allowing authenticated and anon users to upload, read, update and delete images.

-- 1. Ensure the 'pharmacy' storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pharmacy',
  'pharmacy',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

-- 2. Drop any previous conflicting policies on the 'pharmacy' bucket
DROP POLICY IF EXISTS "Allow pharmacy bucket upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow pharmacy bucket select" ON storage.objects;
DROP POLICY IF EXISTS "Allow pharmacy bucket update" ON storage.objects;
DROP POLICY IF EXISTS "Allow pharmacy bucket delete" ON storage.objects;
DROP POLICY IF EXISTS "pharmacy_bucket_public_select" ON storage.objects;
DROP POLICY IF EXISTS "pharmacy_bucket_auth_upload" ON storage.objects;

-- 3. Policy: Allow authenticated and anon users to upload prescription images to 'pharmacy'
CREATE POLICY "Allow pharmacy bucket upload"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id = 'pharmacy');

-- 4. Policy: Allow public read access so client app and delivery app can view images directly
CREATE POLICY "Allow pharmacy bucket select"
ON storage.objects FOR SELECT
TO public, authenticated, anon
USING (bucket_id = 'pharmacy');

-- 5. Policy: Allow update
CREATE POLICY "Allow pharmacy bucket update"
ON storage.objects FOR UPDATE
TO authenticated, anon
USING (bucket_id = 'pharmacy')
WITH CHECK (bucket_id = 'pharmacy');

-- 6. Policy: Allow delete for cleanup
CREATE POLICY "Allow pharmacy bucket delete"
ON storage.objects FOR DELETE
TO authenticated, anon
USING (bucket_id = 'pharmacy');
