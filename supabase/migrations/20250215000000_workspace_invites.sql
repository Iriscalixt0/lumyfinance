-- Tabela workspace_invites para convites por e-mail
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
  token TEXT UNIQUE NOT NULL,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, email)
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON public.workspace_invites(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON public.workspace_invites(workspace_id);

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- Members can view invites for their workspace
DROP POLICY IF EXISTS "Members can view workspace invites" ON public.workspace_invites;
CREATE POLICY "Members can view workspace invites"
  ON public.workspace_invites
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

-- Only owner and admin can insert invites
DROP POLICY IF EXISTS "Admins can create workspace invites" ON public.workspace_invites;
CREATE POLICY "Admins can create workspace invites"
  ON public.workspace_invites
  FOR INSERT
  WITH CHECK (
    public.get_workspace_role(workspace_id) IN ('owner', 'admin')
  );

-- Only owner and admin can delete invites (cancel)
DROP POLICY IF EXISTS "Admins can delete workspace invites" ON public.workspace_invites;
CREATE POLICY "Admins can delete workspace invites"
  ON public.workspace_invites
  FOR DELETE
  USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin'));

-- Function to get valid invite by token (for accept flow - user is not yet a member)
CREATE OR REPLACE FUNCTION public.get_workspace_invite_by_token(invite_token TEXT)
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  email TEXT,
  role TEXT,
  invited_by UUID
) AS $$
  SELECT wi.id, wi.workspace_id, wi.email, wi.role, wi.invited_by
  FROM public.workspace_invites wi
  WHERE wi.token = invite_token AND wi.expires_at > NOW();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Function to get workspace members with profile (for settings UI)
CREATE OR REPLACE FUNCTION public.get_workspace_members_with_profiles(ws_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  role TEXT,
  full_name TEXT
) AS $$
  SELECT wm.id, wm.user_id, wm.role, p.full_name
  FROM public.workspace_members wm
  JOIN public.profiles p ON p.id = wm.user_id
  WHERE wm.workspace_id = ws_id AND wm.accepted_at IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;
