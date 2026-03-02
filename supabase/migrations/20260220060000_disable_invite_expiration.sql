-- Disable workspace invite expiration.
-- Existing and new invites remain valid until accepted/cancelled.

ALTER TABLE public.workspace_invites
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '100 years');

UPDATE public.workspace_invites
SET expires_at = NOW() + INTERVAL '100 years'
WHERE expires_at < NOW();

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
  WHERE wi.token = invite_token;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;
