-- ========================================================
-- SPOTIFY KAWAII WEB PLAYER - SUPABASE DATABASE SCHEMA
-- Run this in your Supabase Project -> SQL Editor -> New Query
-- ========================================================

-- 1. Profiles Table (Automatically synced on auth signup)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to create profile row automatically when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Playlists Table
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover_url TEXT DEFAULT 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Playlists
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own playlists or public ones"
  ON public.playlists FOR SELECT 
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can create their own playlists"
  ON public.playlists FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own playlists"
  ON public.playlists FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own playlists"
  ON public.playlists FOR DELETE 
  USING (auth.uid() = user_id);

-- 3. Playlist Tracks Table
CREATE TABLE IF NOT EXISTS public.playlist_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID REFERENCES public.playlists(id) ON DELETE CASCADE NOT NULL,
  track_id TEXT NOT NULL,
  youtube_id TEXT,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  cover TEXT,
  duration TEXT DEFAULT '3:30',
  duration_sec INT DEFAULT 210,
  position INT DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Playlist Tracks
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tracks in viewable playlists"
  ON public.playlist_tracks FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists p 
      WHERE p.id = playlist_tracks.playlist_id 
      AND (p.user_id = auth.uid() OR p.is_public = true)
    )
  );

CREATE POLICY "Users can insert tracks in their playlists"
  ON public.playlist_tracks FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists p 
      WHERE p.id = playlist_tracks.playlist_id 
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tracks in their playlists"
  ON public.playlist_tracks FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists p 
      WHERE p.id = playlist_tracks.playlist_id 
      AND p.user_id = auth.uid()
    )
  );

-- 4. Liked Songs Table
CREATE TABLE IF NOT EXISTS public.liked_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  track_id TEXT NOT NULL,
  youtube_id TEXT,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  cover TEXT,
  duration TEXT DEFAULT '3:30',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, track_id)
);

-- Enable RLS on Liked Songs
ALTER TABLE public.liked_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own liked songs"
  ON public.liked_songs FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their liked songs"
  ON public.liked_songs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their liked songs"
  ON public.liked_songs FOR DELETE 
  USING (auth.uid() = user_id);
