-- ==============================================
-- SEND Webmail — Database Schema
-- Run this in the Supabase SQL Editor
-- ==============================================

-- User profiles (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL,
  email       TEXT UNIQUE NOT NULL GENERATED ALWAYS AS (username || '@send.dedyn.io') STORED,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read any profile (needed for address book lookups)
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(
      -- If email is user@send.dedyn.io, extract username
      SPLIT_PART(NEW.email, '@', 1),
      -- Otherwise use the full email prefix
      REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', '_')
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ==============================================
-- EMAILS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS public.emails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  folder        TEXT NOT NULL DEFAULT 'inbox' CHECK (folder IN ('inbox', 'sent', 'trash')),
  sender_email  TEXT NOT NULL,
  sender_name   TEXT,
  recipient_email TEXT NOT NULL,
  subject       TEXT,
  body_text     TEXT,
  body_html     TEXT,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast inbox queries
CREATE INDEX IF NOT EXISTS idx_emails_user_folder ON public.emails (user_id, folder, created_at DESC);

-- Enable RLS
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Users can only read their own emails
CREATE POLICY "Users can read own emails"
  ON public.emails FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own emails (for sent items)
CREATE POLICY "Users can insert own emails"
  ON public.emails FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own emails (mark as read, move to trash)
CREATE POLICY "Users can update own emails"
  ON public.emails FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own emails (permanent delete from trash)
CREATE POLICY "Users can delete own emails"
  ON public.emails FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ==============================================
-- CONTACTS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON public.contacts (user_id, name);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own contacts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contacts"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contacts"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
