-- Preserve the role granted in the invite independently from effective role.
-- Effective role may be downgraded to viewer while the user has no own Pro plan.
ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS granted_role TEXT
  CHECK (granted_role IN ('owner', 'admin', 'editor', 'viewer'));

UPDATE public.workspace_members
SET granted_role = role
WHERE granted_role IS NULL;
