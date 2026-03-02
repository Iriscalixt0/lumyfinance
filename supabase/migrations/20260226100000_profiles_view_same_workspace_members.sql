-- Permite que membros do mesmo workspace vejam o perfil (ex.: full_name) dos colegas.
-- Necessário para exibir "quem pagou" nas transações para todos os membros.
CREATE POLICY "Members can view same-workspace members profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm_me
      JOIN public.workspace_members wm_other
        ON wm_me.workspace_id = wm_other.workspace_id
        AND wm_other.user_id = profiles.id
      WHERE wm_me.user_id = auth.uid()
        AND wm_me.accepted_at IS NOT NULL
        AND wm_other.accepted_at IS NOT NULL
    )
  );
