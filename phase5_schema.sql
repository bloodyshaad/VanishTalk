-- =============================================
-- PHASE 5: AUDIO & FILE MESSAGING
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Add file_url and file_type columns to messages if not exists
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS audio_duration INTEGER; -- Duration in seconds

-- 2. Create voice-messages storage bucket (run in SQL Editor)
-- Note: You may need to create this manually in Supabase Dashboard
-- Go to Storage > Create bucket > Name: "voice-messages" > Public: true

-- 3. Create files storage bucket
-- Go to Storage > Create bucket > Name: "chat-files" > Public: true

-- 4. Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('file_url', 'file_type', 'file_name', 'audio_url', 'audio_duration');
