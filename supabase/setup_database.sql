-- ============================================
-- CRM - Setup Database
-- Execute no Supabase SQL Editor
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT NOT NULL DEFAULT 'graphyx',
  nicho TEXT NOT NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  endereco TEXT,
  site TEXT,
  tem_site BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN (
    'novo', 'contatado', 'interessado', 'negociacao', 'fechado', 'recusado',
    'testando', 'cliente', 'perdido'
  )),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_workspace ON public.clientes(workspace);
CREATE INDEX IF NOT EXISTS idx_clientes_workspace_nicho ON public.clientes(workspace, nicho);
CREATE INDEX IF NOT EXISTS idx_clientes_status ON public.clientes(status);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON public.clientes(nome);
CREATE INDEX IF NOT EXISTS idx_clientes_created_at ON public.clientes(created_at);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_clientes_updated_at ON public.clientes;
CREATE TRIGGER trigger_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION public.current_workspace_from_email()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT CASE lower(auth.jwt() ->> 'email')
    WHEN 'graphyx.ai@gmail.com' THEN 'graphyx'
    WHEN 'lumyf@gmail.com' THEN 'lumyf'
    ELSE NULL
  END
$$;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace clientes read" ON public.clientes;
DROP POLICY IF EXISTS "Workspace clientes insert" ON public.clientes;
DROP POLICY IF EXISTS "Workspace clientes update" ON public.clientes;
DROP POLICY IF EXISTS "Workspace clientes delete" ON public.clientes;

CREATE POLICY "Workspace clientes read"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (workspace = public.current_workspace_from_email());

CREATE POLICY "Workspace clientes insert"
  ON public.clientes FOR INSERT
  TO authenticated
  WITH CHECK (workspace = public.current_workspace_from_email());

CREATE POLICY "Workspace clientes update"
  ON public.clientes FOR UPDATE
  TO authenticated
  USING (workspace = public.current_workspace_from_email())
  WITH CHECK (workspace = public.current_workspace_from_email());

CREATE POLICY "Workspace clientes delete"
  ON public.clientes FOR DELETE
  TO authenticated
  USING (workspace = public.current_workspace_from_email());

CREATE TABLE IF NOT EXISTS public.nichos (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

INSERT INTO public.nichos (id, label) VALUES
  ('reddit', 'Reddit'),
  ('youtube', 'Youtube'),
  ('instagram', 'Instagram'),
  ('facebook', 'Facebook'),
  ('twitter', 'Twitter'),
  ('lp', 'LP'),
  ('ommigle', 'Ommigle'),
  ('grupos', 'Grupos'),
  ('outros', 'Outros'),
  ('psicologo', 'Psicologo'),
  ('imobiliaria', 'Imobiliaria'),
  ('curso_online', 'Curso Online'),
  ('dentista', 'Dentista'),
  ('clinica_estetica', 'Clinica de Estetica'),
  ('barbearia', 'Barbearia'),
  ('empresa_limpeza', 'Empresa de Limpeza'),
  ('coach', 'Coach'),
  ('turismo_excursao', 'Turismo e Excursao'),
  ('mvp', 'MVP')
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label;
