-- Add user_type to profiles for visitor vs full user
-- Visitors: non-Pro users who accepted invite via link; can only view shared workspace(s)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'full';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_type_check'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_type_check
      CHECK (user_type IN ('full', 'visitor'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.user_type IS 'full = normal user with own workspace; visitor = view-only access via invite, no own workspace';
