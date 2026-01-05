-- =============================================
-- FIX RLS POLICIES FOR CHAT CREATION
-- Run this in your Supabase SQL Editor
-- =============================================

-- Fix chats table - allow any authenticated user to create chats
DROP POLICY IF EXISTS "chats_insert" ON chats;
CREATE POLICY "chats_insert" ON chats 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Also need to allow selecting new chats immediately after creation
DROP POLICY IF EXISTS "chats_select" ON chats;
CREATE POLICY "chats_select" ON chats 
  FOR SELECT 
  TO authenticated
  USING (true);

-- Fix chat_members - allow authenticated users to add members
DROP POLICY IF EXISTS "members_insert" ON chat_members;
CREATE POLICY "members_insert" ON chat_members 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "members_select" ON chat_members;
CREATE POLICY "members_select" ON chat_members 
  FOR SELECT 
  TO authenticated
  USING (true);

-- Fix messages - ensure members can insert
DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Verify the policies were created
SELECT tablename, policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('chats', 'chat_members', 'messages');
