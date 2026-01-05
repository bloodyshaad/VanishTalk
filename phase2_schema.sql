-- =============================================
-- PHASE 2: COMMUNICATION FEATURES
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Create message_reactions table for emoji reactions
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- 2. Add reply_to field to messages for threading
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES messages(id) ON DELETE SET NULL;

-- 3. Add edited fields to messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS original_content TEXT DEFAULT NULL;

-- 4. Enable RLS on message_reactions
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for message_reactions
DROP POLICY IF EXISTS "reactions_select" ON message_reactions;
CREATE POLICY "reactions_select" ON message_reactions 
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "reactions_insert" ON message_reactions;
CREATE POLICY "reactions_insert" ON message_reactions 
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reactions_delete" ON message_reactions;
CREATE POLICY "reactions_delete" ON message_reactions 
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 6. Policy for message updates (editing)
DROP POLICY IF EXISTS "messages_update" ON messages;
CREATE POLICY "messages_update" ON messages 
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- 7. Enable realtime for reactions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 8. Create indexes
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to) WHERE reply_to IS NOT NULL;

-- 9. Verify changes
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'messages' AND column_name IN ('reply_to', 'edited_at', 'original_content');

SELECT table_name FROM information_schema.tables 
WHERE table_name = 'message_reactions';
