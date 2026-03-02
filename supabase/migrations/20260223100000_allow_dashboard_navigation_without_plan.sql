-- Permite navegação em todo o dashboard mesmo sem assinatura ativa.
-- Ações (transações, investimentos, etc.) são bloqueadas no client e redirecionam para /dashboard/plan.

CREATE OR REPLACE FUNCTION public.check_dashboard_access(p_workspace_id UUID DEFAULT NULL)
RETURNS TABLE (can_access BOOLEAN, redirect_to TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_workspace_id UUID;
  v_stripe_subscription_id TEXT;
  v_beta_program_id UUID;
  v_prog_status TEXT;
  v_prog_ends_at TIMESTAMPTZ;
  v_feedback_upgraded BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT;
    RETURN;
  END IF;

  IF p_workspace_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = p_workspace_id AND user_id = v_user_id AND accepted_at IS NOT NULL
    ) THEN
      v_workspace_id := p_workspace_id;
    END IF;
  END IF;

  IF v_workspace_id IS NULL THEN
    SELECT wm.workspace_id INTO v_workspace_id
    FROM workspace_members wm
    WHERE wm.user_id = v_user_id AND wm.accepted_at IS NOT NULL
    ORDER BY wm.workspace_id
    LIMIT 1;
  END IF;

  IF v_workspace_id IS NULL THEN
    RETURN QUERY SELECT true, NULL::TEXT;
    RETURN;
  END IF;

  SELECT ws.stripe_subscription_id, ws.beta_program_id
  INTO v_stripe_subscription_id, v_beta_program_id
  FROM workspaces ws
  WHERE ws.id = v_workspace_id;

  IF v_stripe_subscription_id IS NOT NULL THEN
    RETURN QUERY SELECT true, NULL::TEXT;
    RETURN;
  END IF;

  IF v_beta_program_id IS NOT NULL THEN
    SELECT status, ends_at INTO v_prog_status, v_prog_ends_at
    FROM beta_programs WHERE id = v_beta_program_id;

    IF v_prog_status = 'blocked' THEN
      SELECT COALESCE(bp.feedback_upgraded, false) INTO v_feedback_upgraded
      FROM beta_participants bp
      WHERE bp.user_id = v_user_id
        AND bp.workspace_id = v_workspace_id;
      IF NOT COALESCE(v_feedback_upgraded, false) THEN
        RETURN QUERY SELECT false, '/dashboard/beta/blocked'::TEXT;
        RETURN;
      END IF;
    END IF;
    RETURN QUERY SELECT true, NULL::TEXT;
    RETURN;
  END IF;

  -- Sem Stripe e sem beta: permite navegar; ações bloqueadas no client redirecionam para /dashboard/plan
  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;
