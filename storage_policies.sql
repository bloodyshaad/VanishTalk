-- =============================================
-- SUPABASE STORAGE SETUP
-- Run this AFTER creating buckets in the Dashboard
-- =============================================

-- NOTE: Storage buckets must be created manually in Supabase Dashboard:
-- 1. Go to Storage > New bucket
-- 2. Create "avatars" bucket (Public: YES)
-- 3. Create "chat-images" bucket (Public: YES)
-- Then run this SQL to set up policies.

-- =============================================
-- AVATARS BUCKET POLICIES
-- =============================================

-- Allow anyone to view avatars (public read)
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'avatars');

-- Allow authenticated users to upload avatars
DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
CREATE POLICY "avatars_auth_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Allow users to update their own avatars
DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
CREATE POLICY "avatars_auth_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars');

-- Allow users to delete their own avatars
DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;
CREATE POLICY "avatars_auth_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars');

-- =============================================
-- CHAT-IMAGES BUCKET POLICIES
-- =============================================

-- Allow anyone to view chat images (public read)
DROP POLICY IF EXISTS "chat_images_public_read" ON storage.objects;
CREATE POLICY "chat_images_public_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'chat-images');

-- Allow authenticated users to upload chat images
DROP POLICY IF EXISTS "chat_images_auth_insert" ON storage.objects;
CREATE POLICY "chat_images_auth_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-images');

-- Allow authenticated users to delete their chat images
DROP POLICY IF EXISTS "chat_images_auth_delete" ON storage.objects;
CREATE POLICY "chat_images_auth_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'chat-images');

-- =============================================
-- VERIFICATION
-- =============================================

-- Check if policies were created
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;
