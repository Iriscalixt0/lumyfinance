-- Beta conversion operations:
-- 1) Contact preferences and explicit consent capture
-- 2) Campaign event log for idempotent multi-channel reminders
-- 3) Blocking metadata and 10-day retention window

CREATE TABLE IF NOT EXISTS public.beta_contact_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_e164 TEXT,
  marketing_email_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT beta_contact_preferences_whatsapp_format
    CHECK (
      whatsapp_e164 IS NULL OR whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'
    )
);

CREATE TABLE IF NOT EXISTS public.beta_conversion_campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beta_program_id UUID NOT NULL REFERENCES public.beta_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'whatsapp')),
  stage TEXT NOT NULL CHECK (stage IN ('d0', 'd2', 'd7', 'd9')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  provider_message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_beta_campaign_unique_user_stage_channel
  ON public.beta_conversion_campaign_events(user_id, stage, channel);

CREATE INDEX IF NOT EXISTS idx_beta_campaign_program_stage
  ON public.beta_conversion_campaign_events(beta_program_id, stage, created_at DESC);

ALTER TABLE public.beta_contact_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_conversion_campaign_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own beta contact preferences" ON public.beta_contact_preferences;
CREATE POLICY "Users can view own beta contact preferences"
  ON public.beta_contact_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert own beta contact preferences" ON public.beta_contact_preferences;
CREATE POLICY "Users can upsert own beta contact preferences"
  ON public.beta_contact_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own beta contact preferences" ON public.beta_contact_preferences;
CREATE POLICY "Users can update own beta contact preferences"
  ON public.beta_contact_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can manage beta conversion events" ON public.beta_conversion_campaign_events;
CREATE POLICY "Service can manage beta conversion events"
  ON public.beta_conversion_campaign_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.beta_participants
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_delete_after TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_beta_participants_status_data_delete
  ON public.beta_participants(status, data_delete_after);
