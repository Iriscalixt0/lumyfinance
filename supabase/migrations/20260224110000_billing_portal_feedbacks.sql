-- Feedback opcional antes de abrir o portal Stripe (motivo + comentário)

CREATE TABLE IF NOT EXISTS public.billing_portal_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_portal_feedbacks_workspace ON public.billing_portal_feedbacks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_billing_portal_feedbacks_created ON public.billing_portal_feedbacks(created_at);

ALTER TABLE public.billing_portal_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert billing_portal_feedbacks"
  ON public.billing_portal_feedbacks
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Authenticated user can insert own feedback"
  ON public.billing_portal_feedbacks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
