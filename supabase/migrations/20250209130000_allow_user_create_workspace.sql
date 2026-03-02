-- Permite que usuários criem profile/workspace (fallback quando trigger/RPC não existe)
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
CREATE POLICY "Users can create own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can create own workspace" ON public.workspaces;
CREATE POLICY "Users can create own workspace"
  ON public.workspaces
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can add self as owner" ON public.workspace_members;
CREATE POLICY "Users can add self as owner"
  ON public.workspace_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = workspace_id AND owner_id = auth.uid()
    )
  );
