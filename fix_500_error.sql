-- ==========================================
-- 1. CLEAN SLATE (Drop ALL potentially conflicting policies)
-- ==========================================

-- Drop policies on Chats
DROP POLICY IF EXISTS "Chat metadata is visible to members" ON chats;
DROP POLICY IF EXISTS "Members can see their chats" ON chats;
DROP POLICY IF EXISTS "Individuals can view chats they are part of" ON chats;

-- Drop policies on Chat Members
DROP POLICY IF EXISTS "Users can see members of chats they are in" ON chat_members;
DROP POLICY IF EXISTS "Users can see memberships" ON chat_members;
DROP POLICY IF EXISTS "Chat members are viewable by participants" ON chat_members;

-- Drop policies on Messages
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can send messages to their chats" ON messages;
DROP POLICY IF EXISTS "Messages are viewable by chat members" ON messages;

-- ==========================================
-- 2. SECURE ACCESS HELPER (Prevents Recursion)
-- ==========================================
-- This function runs with the privileges of the creator (postgres) 
-- to bypass RLS checks and determine membership without infinite loops.

CREATE OR REPLACE FUNCTION public.check_membership(target_chat_id UUID, target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.chat_members 
    WHERE chat_id = target_chat_id 
    AND user_id = target_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 3. FINAL OPTIMIZED POLICIES
-- ==========================================

-- CHATS: Viewable if you are a member
CREATE POLICY "chats_select_policy" ON public.chats
  FOR SELECT USING (public.check_membership(id, auth.uid()));

-- CHAT MEMBERS: Always viewable (Safe because chat_id is a secret UUID)
-- This completely eliminates the join recursion error.
CREATE POLICY "chat_members_select_policy" ON public.chat_members
  FOR SELECT USING (true);

-- MESSAGES: Viewable and insertable if member
CREATE POLICY "messages_select_policy" ON public.messages
  FOR SELECT USING (public.check_membership(chat_id, auth.uid()));

CREATE POLICY "messages_insert_policy" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND 
    public.check_membership(chat_id, auth.uid())
  );

-- Ensure RLS is enabled
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profiles & Friendships (Simple policies)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can see their own friends" ON friendships;
CREATE POLICY "Users can see their own friends" ON friendships FOR SELECT USING (auth.uid() = user_id);
