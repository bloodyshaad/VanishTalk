-- ======================================================
-- VANISH. - COMPLETE DATABASE ARCHITECTURE 
-- ======================================================

-- 1. CLEANUP (Uncomment to reset everything)
-- DROP TABLE IF EXISTS messages CASCADE;
-- DROP TABLE IF EXISTS chat_members CASCADE;
-- DROP TABLE IF EXISTS chats CASCADE;
-- DROP TABLE IF EXISTS friendships CASCADE;
-- DROP TABLE IF EXISTS friend_requests CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;
-- DROP TYPE IF EXISTS friend_request_status;
-- DROP TYPE IF EXISTS chat_type;

-- 2. TYPE DEFINITIONS
DO $$ BEGIN
    CREATE TYPE friend_request_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE chat_type AS ENUM ('direct', 'group');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. CORE TABLES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  online_status TEXT DEFAULT 'offline',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status friend_request_status DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(sender_id, receiver_id)
);

CREATE TABLE IF NOT EXISTS friendships (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT, 
  type chat_type NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_members (
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  vanish_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. SECURITY (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4.1. HELPER FUNCTION (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.is_chat_member(cid UUID, uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_id = cid AND user_id = uid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.2. POLICIES
DO $$ 
BEGIN
    -- PROFILES: Anyone can read, only owner can update
    DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
    CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
    DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
    CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

    -- FRIEND REQUESTS: Sender/receiver can read, sender can insert, receiver can update
    DROP POLICY IF EXISTS "friends_req_select" ON friend_requests;
    CREATE POLICY "friends_req_select" ON friend_requests FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
    DROP POLICY IF EXISTS "friends_req_insert" ON friend_requests;
    CREATE POLICY "friends_req_insert" ON friend_requests FOR INSERT WITH CHECK (auth.uid() = sender_id);
    DROP POLICY IF EXISTS "friends_req_update" ON friend_requests;
    CREATE POLICY "friends_req_update" ON friend_requests FOR UPDATE USING (auth.uid() = receiver_id);
    DROP POLICY IF EXISTS "friends_req_delete" ON friend_requests;
    CREATE POLICY "friends_req_delete" ON friend_requests FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

    -- FRIENDSHIPS: User can read their own friendships
    DROP POLICY IF EXISTS "friendships_select" ON friendships;
    CREATE POLICY "friendships_select" ON friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
    DROP POLICY IF EXISTS "friendships_insert" ON friendships;
    CREATE POLICY "friendships_insert" ON friendships FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

    -- CHATS: Members can read
    DROP POLICY IF EXISTS "chats_select" ON chats;
    CREATE POLICY "chats_select" ON chats FOR SELECT USING (public.is_chat_member(id, auth.uid()));
    DROP POLICY IF EXISTS "chats_insert" ON chats;
    CREATE POLICY "chats_insert" ON chats FOR INSERT WITH CHECK (true);

    -- CHAT MEMBERS: Anyone can read (needed for finding existing chats), authenticated can insert
    DROP POLICY IF EXISTS "members_select" ON chat_members;
    CREATE POLICY "members_select" ON chat_members FOR SELECT USING (true);
    DROP POLICY IF EXISTS "members_insert" ON chat_members;
    CREATE POLICY "members_insert" ON chat_members FOR INSERT WITH CHECK (true);

    -- MESSAGES: Chat members can read/insert, sender can delete
    DROP POLICY IF EXISTS "messages_select" ON messages;
    CREATE POLICY "messages_select" ON messages FOR SELECT USING (public.is_chat_member(chat_id, auth.uid()));
    DROP POLICY IF EXISTS "messages_insert" ON messages;
    CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id AND public.is_chat_member(chat_id, auth.uid()));
    DROP POLICY IF EXISTS "messages_delete" ON messages;
    CREATE POLICY "messages_delete" ON messages FOR DELETE USING (auth.uid() = sender_id);
END $$;

-- 5. TRIGGERS

-- 5.1 Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    new.id, 
    LOWER(SPLIT_PART(new.email, '@', 1)), 
    new.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5.2 Auto-create bidirectional friendships when request is accepted
CREATE OR REPLACE FUNCTION public.handle_friend_request_accepted()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Create friendship in both directions
    INSERT INTO public.friendships (user_id, friend_id)
    VALUES (NEW.sender_id, NEW.receiver_id)
    ON CONFLICT DO NOTHING;
    
    INSERT INTO public.friendships (user_id, friend_id)
    VALUES (NEW.receiver_id, NEW.sender_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_friend_request_accepted ON friend_requests;
CREATE TRIGGER on_friend_request_accepted
  AFTER UPDATE ON friend_requests
  FOR EACH ROW EXECUTE PROCEDURE public.handle_friend_request_accepted();

-- 5.3 Auto-delete expired vanishing messages
CREATE OR REPLACE FUNCTION public.delete_expired_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM public.messages 
  WHERE vanish_at IS NOT NULL AND vanish_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a cron job to run every minute (requires pg_cron extension)
-- SELECT cron.schedule('delete-expired-messages', '* * * * *', 'SELECT public.delete_expired_messages()');

-- 6. INDEXES
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_vanish_at ON messages(vanish_at) WHERE vanish_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- 7. ENABLE REALTIME
DO $$ 
BEGIN
  -- Enable realtime for messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  -- Enable realtime for friend_requests
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'friend_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;
  END IF;

  -- Enable realtime for friendships
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'friendships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
  END IF;

  -- Enable realtime for chat_members
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_members;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
