-- =============================================
-- PHASE 4: GROUP ADMIN & USER DETAILS
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Add created_by column to chats for tracking group admin
ALTER TABLE chats 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Update existing chats to set created_by from first member (if not set)
-- For existing groups, set the first member as creator
UPDATE chats c
SET created_by = (
    SELECT user_id FROM chat_members 
    WHERE chat_id = c.id 
    ORDER BY created_at ASC 
    LIMIT 1
)
WHERE created_by IS NULL;

-- 3. Add role column to chat_members for future extensibility
ALTER TABLE chat_members
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member'));

-- 4. Set existing creators as admins
UPDATE chat_members cm
SET role = 'admin'
FROM chats c
WHERE cm.chat_id = c.id 
  AND cm.user_id = c.created_by;

-- 5. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chats_created_by ON chats(created_by);

-- 6. Verify changes
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'chats' AND column_name = 'created_by';

SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'chat_members' AND column_name = 'role';
