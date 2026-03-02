-- Função para verificar se um usuário (por email) existe e possui assinatura
CREATE OR REPLACE FUNCTION public.check_invitee_plan_by_email(user_email TEXT)
RETURNS TABLE (user_exists BOOLEAN, has_plan BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid UUID;
  has_sub BOOLEAN;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = lower(trim(user_email)) LIMIT 1;
  IF uid IS NULL THEN
    RETURN QUERY SELECT FALSE, FALSE;
    RETURN;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE owner_id = uid AND stripe_subscription_id IS NOT NULL
  ) INTO has_sub;
  RETURN QUERY SELECT TRUE, has_sub;
END;
$$;
