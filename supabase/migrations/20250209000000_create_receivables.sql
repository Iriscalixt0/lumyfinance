-- Cobranças (quem te deve, valor, status, etc.)
CREATE TABLE IF NOT EXISTS public.receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  debtor_name TEXT NOT NULL,
  amount BIGINT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  phone TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receivables_workspace ON public.receivables(workspace_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON public.receivables(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_receivables_due_date ON public.receivables(workspace_id, due_date);

-- Funcoes auxiliares de RLS (idempotentes), necessarias para as policies abaixo.
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid() AND accepted_at IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_workspace_role(ws_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = ws_id AND user_id = auth.uid() AND accepted_at IS NOT NULL
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_write(ws_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
      AND role IN ('owner', 'admin', 'editor')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view receivables" ON public.receivables;
CREATE POLICY "Members can view receivables" ON public.receivables FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Writers can insert receivables" ON public.receivables;
CREATE POLICY "Writers can insert receivables" ON public.receivables FOR INSERT WITH CHECK (public.can_write(workspace_id));

DROP POLICY IF EXISTS "Writers can update receivables" ON public.receivables;
CREATE POLICY "Writers can update receivables" ON public.receivables FOR UPDATE USING (public.can_write(workspace_id));

DROP POLICY IF EXISTS "Writers can delete receivables" ON public.receivables;
CREATE POLICY "Writers can delete receivables" ON public.receivables FOR DELETE USING (public.can_write(workspace_id));
