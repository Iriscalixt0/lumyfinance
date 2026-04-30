-- ============================================================
-- Tabela de itens de supermercado (lista de compras)
-- Suporta itens FIXOS (todo mês) e itens AVULSOS (de um mês específico).
-- Marcações de comprado/pular são por mês (month_key = 'YYYY-MM').
-- Rode este SQL no SQL Editor do seu Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.grocery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  qty TEXT,
  -- 'fixed' = aparece todo mês; 'month' = só naquele mês específico
  kind TEXT NOT NULL CHECK (kind IN ('fixed','month')),
  -- Para kind='month' guarda o mês ('YYYY-MM'). NULL para fixos.
  month_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT grocery_month_requires_key CHECK (
    (kind = 'fixed' AND month_key IS NULL) OR
    (kind = 'month' AND month_key ~ '^[0-9]{4}-[0-9]{2}$')
  )
);

-- Marcações por mês (comprado / pulado para fixos; comprado para avulsos)
CREATE TABLE IF NOT EXISTS public.grocery_item_marks (
  item_id UUID NOT NULL REFERENCES public.grocery_items(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL CHECK (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  skipped BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_grocery_items_workspace ON public.grocery_items(workspace_id, kind);
CREATE INDEX IF NOT EXISTS idx_grocery_items_month     ON public.grocery_items(workspace_id, month_key) WHERE kind = 'month';
CREATE INDEX IF NOT EXISTS idx_grocery_marks_month     ON public.grocery_item_marks(month_key);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.grocery_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grocery_item_marks ENABLE ROW LEVEL SECURITY;

-- grocery_items: visível para qualquer membro do workspace; escrita para writers
DROP POLICY IF EXISTS "grocery_items: members can view" ON public.grocery_items;
CREATE POLICY "grocery_items: members can view"
  ON public.grocery_items
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "grocery_items: writers can manage" ON public.grocery_items;
CREATE POLICY "grocery_items: writers can manage"
  ON public.grocery_items
  FOR ALL
  USING (public.can_write(workspace_id))
  WITH CHECK (public.can_write(workspace_id) AND created_by = auth.uid());

-- grocery_item_marks: idem, derivado do workspace do item pai
DROP POLICY IF EXISTS "grocery_marks: members can view" ON public.grocery_item_marks;
CREATE POLICY "grocery_marks: members can view"
  ON public.grocery_item_marks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.grocery_items gi
      WHERE gi.id = grocery_item_marks.item_id
        AND public.is_workspace_member(gi.workspace_id)
    )
  );

DROP POLICY IF EXISTS "grocery_marks: writers can manage" ON public.grocery_item_marks;
CREATE POLICY "grocery_marks: writers can manage"
  ON public.grocery_item_marks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.grocery_items gi
      WHERE gi.id = grocery_item_marks.item_id
        AND public.can_write(gi.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grocery_items gi
      WHERE gi.id = grocery_item_marks.item_id
        AND public.can_write(gi.workspace_id)
    )
  );
