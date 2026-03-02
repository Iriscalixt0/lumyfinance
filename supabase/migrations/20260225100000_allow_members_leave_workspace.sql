-- Allow any non-owner member to remove their own membership row.
-- This enables "leave workspace" without requiring service role fallback.

DROP POLICY IF EXISTS "Members can leave own workspace" ON public.workspace_members;
CREATE POLICY "Members can leave own workspace"
  ON public.workspace_members
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND role <> 'owner'
    AND accepted_at IS NOT NULL
  );
