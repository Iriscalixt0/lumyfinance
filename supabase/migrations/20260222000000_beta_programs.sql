-- Beta programs: programas de teste beta com link exclusivo, sem Stripe durante o teste

-- beta_programs
CREATE TABLE IF NOT EXISTS public.beta_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  max_participants INT NOT NULL DEFAULT 200,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_beta_programs_token ON public.beta_programs(token);
CREATE INDEX IF NOT EXISTS idx_beta_programs_status_ends ON public.beta_programs(status, ends_at);

ALTER TABLE public.beta_programs ENABLE ROW LEVEL SECURITY;

-- beta_participants
CREATE TABLE IF NOT EXISTS public.beta_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beta_program_id UUID NOT NULL REFERENCES public.beta_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'upgraded', 'feedback_pending', 'feedback_given', 'blocked')),
  feedback_text TEXT,
  feedback_upgraded BOOLEAN DEFAULT FALSE,
  feedback_at TIMESTAMPTZ,
  upgraded_at TIMESTAMPTZ,
  UNIQUE(beta_program_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_beta_participants_program ON public.beta_participants(beta_program_id);
CREATE INDEX IF NOT EXISTS idx_beta_participants_user ON public.beta_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_participants_workspace ON public.beta_participants(workspace_id);

ALTER TABLE public.beta_participants ENABLE ROW LEVEL SECURITY;

-- workspaces: add beta_program_id
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS beta_program_id UUID REFERENCES public.beta_programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workspaces_beta_program ON public.workspaces(beta_program_id) WHERE beta_program_id IS NOT NULL;

-- RLS beta_programs: SELECT for authenticated (middleware needs to check status); INSERT/UPDATE/DELETE via service_role only
DROP POLICY IF EXISTS "Anyone can read beta_programs" ON public.beta_programs;
CREATE POLICY "Anyone can read beta_programs"
  ON public.beta_programs
  FOR SELECT
  USING (true);

-- RLS beta_participants: participants read/update own row; can insert self when joining
DROP POLICY IF EXISTS "Participants can view own beta participation" ON public.beta_participants;
CREATE POLICY "Participants can view own beta participation"
  ON public.beta_participants
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Participants can join beta" ON public.beta_participants;
CREATE POLICY "Participants can join beta"
  ON public.beta_participants
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Participants can update own feedback" ON public.beta_participants;
CREATE POLICY "Participants can update own feedback"
  ON public.beta_participants
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
