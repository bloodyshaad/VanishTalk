-- =============================================
-- ADD CHAT SETTINGS & FIX MESSAGE DELETION
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Add default_vanish_hours column to chats table
ALTER TABLE chats 
ADD COLUMN IF NOT EXISTS default_vanish_hours INTEGER DEFAULT NULL;

-- 2. Fix message deletion policy
DROP POLICY IF EXISTS "messages_delete" ON messages;
CREATE POLICY "messages_delete" ON messages 
  FOR DELETE 
  TO authenticated
  USING (auth.uid() = sender_id);

-- 3. Allow chat members to update chat settings
DROP POLICY IF EXISTS "chats_update" ON chats;
CREATE POLICY "chats_update" ON chats 
  FOR UPDATE 
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_members 
    WHERE chat_id = id AND user_id = auth.uid()
  ));

-- 4. Ensure realtime is enabled for messages (for DELETE events)
DO $$ 
BEGIN
  -- Enable REPLICA IDENTITY FULL for realtime DELETE events
  ALTER TABLE messages REPLICA IDENTITY FULL;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 5. Verify the new column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'chats' AND column_name = 'default_vanish_hours';
