-- Add onboarding fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_intent TEXT
    CHECK (onboarding_intent IN ('personal', 'family', 'business', 'other'));
