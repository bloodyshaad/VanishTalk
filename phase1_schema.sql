-- =============================================
-- PHASE 1: ROBUSTNESS FEATURES
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Add last_seen column for online status
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

-- 2. Create message_reads table for read receipts
CREATE TABLE IF NOT EXISTS message_reads (
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

-- 3. Enable RLS on message_reads
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for message_reads
DROP POLICY IF EXISTS "message_reads_select" ON message_reads;
CREATE POLICY "message_reads_select" ON message_reads 
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "message_reads_insert" ON message_reads;
CREATE POLICY "message_reads_insert" ON message_reads 
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Create function to update last_seen
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS void AS $$
BEGIN
  UPDATE profiles 
  SET last_seen = NOW() 
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Enable realtime for message_reads
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_reads;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 7. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_message_reads_message ON message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user ON message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles(last_seen);

-- 8. Verify tables
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'last_seen';

SELECT table_name FROM information_schema.tables 
WHERE table_name = 'message_reads';
