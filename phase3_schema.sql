-- =============================================
-- PHASE 3: MEDIA & SECURITY FEATURES
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Add avatar_url to profiles for profile pictures
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- 2. Create blocked_users table
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- 3. Add image_url to messages for image sharing
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS image_type TEXT DEFAULT NULL;

-- 4. Enable RLS on blocked_users
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for blocked_users
DROP POLICY IF EXISTS "blocked_select" ON blocked_users;
CREATE POLICY "blocked_select" ON blocked_users 
  FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS "blocked_insert" ON blocked_users;
CREATE POLICY "blocked_insert" ON blocked_users 
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocked_delete" ON blocked_users;
CREATE POLICY "blocked_delete" ON blocked_users 
  FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);

-- 6. Create storage bucket for avatars (run these in Supabase Dashboard > Storage)
-- The bucket creation needs to be done via the Supabase UI or API
-- Bucket name: avatars
-- Public: true

-- 7. Create storage bucket for chat images
-- Bucket name: chat-images
-- Public: true

-- 8. Create function to check if user is blocked
CREATE OR REPLACE FUNCTION is_blocked(user1 UUID, user2 UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocked_users 
    WHERE (blocker_id = user1 AND blocked_id = user2)
       OR (blocker_id = user2 AND blocked_id = user1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Update messages policy to prevent sending to blocked users
-- Drop and recreate with block check
DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages 
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id 
    AND NOT public.is_blocked(
      auth.uid(), 
      (SELECT user_id FROM chat_members WHERE chat_id = messages.chat_id AND user_id != auth.uid() LIMIT 1)
    )
  );

-- 10. Indexes
CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_blocked ON blocked_users(blocked_id);
CREATE INDEX IF NOT EXISTS idx_profiles_avatar ON profiles(avatar_url) WHERE avatar_url IS NOT NULL;

-- 11. Verify
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'avatar_url';

SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'messages' AND column_name IN ('image_url', 'image_type');

SELECT table_name FROM information_schema.tables 
WHERE table_name = 'blocked_users';
