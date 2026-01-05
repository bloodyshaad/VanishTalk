-- =============================================
-- FIX: DELETE POLICIES FOR GROUP MANAGEMENT
-- Run this in your Supabase SQL Editor
-- =============================================

-- NOTE: First, let's check if RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- 1. Allow chat creator to delete the chat
DROP POLICY IF EXISTS "Chat creator can delete chat" ON chats;
CREATE POLICY "Chat creator can delete chat"
ON chats FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- 2. Allow deletion of chat_members when user is chat admin
DROP POLICY IF EXISTS "Chat admin can remove members" ON chat_members;
CREATE POLICY "Chat admin can remove members"
ON chat_members FOR DELETE
TO authenticated
USING (
    chat_id IN (
        SELECT id FROM chats WHERE created_by = auth.uid()
    )
);

-- 3. Also allow members to remove themselves (leave group)
DROP POLICY IF EXISTS "Members can leave chat" ON chat_members;
CREATE POLICY "Members can leave chat"
ON chat_members FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 4. Allow deletion of messages in chats where user is admin
DROP POLICY IF EXISTS "Chat admin can delete all messages" ON messages;
CREATE POLICY "Chat admin can delete all messages"
ON messages FOR DELETE
TO authenticated
USING (
    chat_id IN (
        SELECT id FROM chats WHERE created_by = auth.uid()
    )
);

-- 5. Allow users to delete their own messages
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;
CREATE POLICY "Users can delete own messages"
ON messages FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

-- 6. If message_reactions table exists, add delete policy
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'message_reactions') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Allow delete reactions" ON message_reactions';
        EXECUTE 'CREATE POLICY "Allow delete reactions" ON message_reactions FOR DELETE TO authenticated USING (true)';
    END IF;
END $$;

-- Verify policies were created
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND cmd = 'DELETE'
ORDER BY tablename;
