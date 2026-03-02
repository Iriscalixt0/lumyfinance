-- ============================================
-- CRM - Setup Completo (do zero)
-- Supabase / PostgreSQL
-- ============================================
-- Este script cria uma base CRM completa com:
-- - Multi-workspace
-- - Controle de acesso por admin (email no JWT)
-- - Leads/clientes, contatos, pipeline, deals, tarefas, atividades, notas e tags
-- - RLS (Row Level Security) em todas as tabelas de negocio
--
-- Execute no SQL Editor do Supabase.

BEGIN;

-- 1) Extensoes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_status') THEN
    CREATE TYPE public.client_status AS ENUM (
      'novo',
      'contatado',
      'interessado',
      'negociacao',
      'fechado',
      'recusado',
      'testando',
      'cliente',
      'perdido'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_status') THEN
    ALTER TYPE public.client_status ADD VALUE IF NOT EXISTS 'testando';
    ALTER TYPE public.client_status ADD VALUE IF NOT EXISTS 'cliente';
    ALTER TYPE public.client_status ADD VALUE IF NOT EXISTS 'perdido';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_status') THEN
    CREATE TYPE public.deal_status AS ENUM (
      'open',
      'won',
      'lost'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE public.task_status AS ENUM (
      'todo',
      'in_progress',
      'done',
      'canceled'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
    CREATE TYPE public.task_priority AS ENUM (
      'low',
      'medium',
      'high',
      'urgent'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type') THEN
    CREATE TYPE public.activity_type AS ENUM (
      'ligacao',
      'whatsapp',
      'email',
      'reuniao',
      'followup',
      'nota'
    );
  END IF;
END
$$;

-- 3) Funcoes utilitarias
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- 4) Tabelas principais
CREATE TABLE IF NOT EXISTS public.workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace, email)
);

CREATE TABLE IF NOT EXISTS public.niches (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  niche TEXT REFERENCES public.niches(id),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  website TEXT,
  has_website BOOLEAN NOT NULL DEFAULT false,
  status public.client_status NOT NULL DEFAULT 'novo',
  notes TEXT,
  source TEXT DEFAULT 'manual',
  email TEXT,
  whatsapp TEXT,
  company TEXT,
  job_title TEXT,
  city TEXT,
  country TEXT,
  how_heard_about_us TEXT,
  plan_interest TEXT,
  potential_value NUMERIC(14,2),
  first_contact_date DATE,
  owner_name TEXT,
  close_probability INTEGER CHECK (close_probability >= 0 AND close_probability <= 100),
  user_type TEXT,
  main_financial_pain TEXT,
  uses_spreadsheet_or_app BOOLEAN,
  user_count INTEGER CHECK (user_count >= 0),
  needs_shared_workspace BOOLEAN,
  last_contact_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  contact_channel TEXT,
  conversation_notes TEXT,
  created_account BOOLEAN,
  signup_date DATE,
  is_trial BOOLEAN,
  current_plan TEXT,
  renewal_date DATE,
  is_canceled BOOLEAN,
  cancel_reason TEXT,
  lead_source TEXT,
  campaign TEXT,
  affiliate TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace, name)
);

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  win_probability INTEGER NOT NULL DEFAULT 0 CHECK (win_probability >= 0 AND win_probability <= 100),
  is_closed_won BOOLEAN NOT NULL DEFAULT false,
  is_closed_lost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pipeline_id, stage_order)
);

CREATE TABLE IF NOT EXISTS public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE RESTRICT,
  stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  amount NUMERIC(14,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status public.deal_status NOT NULL DEFAULT 'open',
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  owner_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deal_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  to_stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  moved_by_email TEXT,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  type public.activity_type NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  assigned_to_email TEXT,
  created_by_email TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace, name)
);

CREATE TABLE IF NOT EXISTS public.client_tags (
  workspace TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

-- 5) Indices
CREATE INDEX IF NOT EXISTS idx_workspace_admins_email ON public.workspace_admins (lower(email));

CREATE INDEX IF NOT EXISTS idx_clients_workspace ON public.clients (workspace);
CREATE INDEX IF NOT EXISTS idx_clients_workspace_niche ON public.clients (workspace, niche);
CREATE INDEX IF NOT EXISTS idx_clients_workspace_status ON public.clients (workspace, status);
CREATE INDEX IF NOT EXISTS idx_clients_workspace_created_at ON public.clients (workspace, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_workspace_lead_source ON public.clients (workspace, lead_source);
CREATE INDEX IF NOT EXISTS idx_clients_workspace_next_followup ON public.clients (workspace, next_followup_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_workspace_niche_name_unique
  ON public.clients (workspace, niche, name);

CREATE INDEX IF NOT EXISTS idx_client_contacts_workspace_client ON public.client_contacts (workspace, client_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_workspace ON public.pipelines (workspace);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_workspace_pipeline ON public.pipeline_stages (workspace, pipeline_id, stage_order);
CREATE INDEX IF NOT EXISTS idx_deals_workspace_client ON public.deals (workspace, client_id);
CREATE INDEX IF NOT EXISTS idx_deals_workspace_stage ON public.deals (workspace, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_workspace_status ON public.deals (workspace, status);
CREATE INDEX IF NOT EXISTS idx_activities_workspace_due ON public.activities (workspace, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_due ON public.tasks (workspace, due_date);
CREATE INDEX IF NOT EXISTS idx_notes_workspace_client ON public.notes (workspace, client_id);
CREATE INDEX IF NOT EXISTS idx_import_runs_workspace_started ON public.import_runs (workspace, started_at DESC);

-- 6) Triggers updated_at
DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_niches_updated_at ON public.niches;
CREATE TRIGGER trg_niches_updated_at
BEFORE UPDATE ON public.niches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_client_contacts_updated_at ON public.client_contacts;
CREATE TRIGGER trg_client_contacts_updated_at
BEFORE UPDATE ON public.client_contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pipelines_updated_at ON public.pipelines;
CREATE TRIGGER trg_pipelines_updated_at
BEFORE UPDATE ON public.pipelines
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pipeline_stages_updated_at ON public.pipeline_stages;
CREATE TRIGGER trg_pipeline_stages_updated_at
BEFORE UPDATE ON public.pipeline_stages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_deals_updated_at ON public.deals;
CREATE TRIGGER trg_deals_updated_at
BEFORE UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_activities_updated_at ON public.activities;
CREATE TRIGGER trg_activities_updated_at
BEFORE UPDATE ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_notes_updated_at ON public.notes;
CREATE TRIGGER trg_notes_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tags_updated_at ON public.tags;
CREATE TRIGGER trg_tags_updated_at
BEFORE UPDATE ON public.tags
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7) Seeds basicos
INSERT INTO public.workspaces (id, name)
VALUES
  ('graphyx', 'Graphyx'),
  ('lumyf', 'Lumyf')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name;

-- Troque os emails abaixo se quiser outros admins
INSERT INTO public.workspace_admins (workspace, email)
VALUES
  ('graphyx', 'graphyx.ai@gmail.com'),
  ('lumyf', 'lumyf@gmail.com')
ON CONFLICT (workspace, email) DO NOTHING;

INSERT INTO public.niches (id, label)
VALUES
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
ON CONFLICT (id) DO UPDATE
SET label = EXCLUDED.label;

-- Pipeline default por workspace
INSERT INTO public.pipelines (workspace, name, is_default)
SELECT w.id, 'Pipeline Principal', true
FROM public.workspaces w
ON CONFLICT (workspace, name) DO NOTHING;

-- Estagios default por pipeline
WITH target_pipelines AS (
  SELECT p.id, p.workspace
  FROM public.pipelines p
  WHERE p.name = 'Pipeline Principal'
),
default_stages(name, stage_order, win_probability, is_closed_won, is_closed_lost) AS (
  VALUES
    ('Novo Lead', 1, 10, false, false),
    ('Contato Inicial', 2, 25, false, false),
    ('Qualificacao', 3, 40, false, false),
    ('Proposta', 4, 70, false, false),
    ('Fechado Ganho', 5, 100, true, false),
    ('Fechado Perdido', 6, 0, false, true)
)
INSERT INTO public.pipeline_stages (workspace, pipeline_id, name, stage_order, win_probability, is_closed_won, is_closed_lost)
SELECT tp.workspace, tp.id, ds.name, ds.stage_order, ds.win_probability, ds.is_closed_won, ds.is_closed_lost
FROM target_pipelines tp
CROSS JOIN default_stages ds
ON CONFLICT (pipeline_id, stage_order) DO NOTHING;

-- 8) RLS
CREATE OR REPLACE FUNCTION public.has_workspace_access(workspace_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_admins wa
    WHERE wa.workspace = workspace_id
      AND lower(wa.email) = public.current_user_email()
  )
$$;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.niches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select" ON public.workspaces;
CREATE POLICY "workspace_select" ON public.workspaces
FOR SELECT TO authenticated
USING (public.has_workspace_access(id));

DROP POLICY IF EXISTS "workspace_admins_select" ON public.workspace_admins;
CREATE POLICY "workspace_admins_select" ON public.workspace_admins
FOR SELECT TO authenticated
USING (public.has_workspace_access(workspace));

DROP POLICY IF EXISTS "niches_read_all" ON public.niches;
CREATE POLICY "niches_read_all" ON public.niches
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "clients_crud_by_workspace" ON public.clients;
CREATE POLICY "clients_crud_by_workspace" ON public.clients
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace))
WITH CHECK (public.has_workspace_access(workspace));

DROP POLICY IF EXISTS "client_contacts_crud_by_workspace" ON public.client_contacts;
CREATE POLICY "client_contacts_crud_by_workspace" ON public.client_contacts
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace))
WITH CHECK (public.has_workspace_access(workspace));

DROP POLICY IF EXISTS "pipelines_crud_by_workspace" ON public.pipelines;
CREATE POLICY "pipelines_crud_by_workspace" ON public.pipelines
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace))
WITH CHECK (public.has_workspace_access(workspace));

DROP POLICY IF EXISTS "pipeline_stages_crud_by_workspace" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_crud_by_workspace" ON public.pipeline_stages
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace))
WITH CHECK (public.has_workspace_access(workspace));

DROP POLICY IF EXISTS "deals_crud_by_workspace" ON public.deals;
CREATE POLICY "deals_crud_by_workspace" ON public.deals
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace))
WITH CHECK (public.has_workspace_access(workspace));

DROP POLICY IF EXISTS "deal_history_crud_by_workspace" ON public.deal_stage_history;
CREATE POLICY "deal_history_crud_by_workspace" ON public.deal_stage_history
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace))
WITH CHECK (public.has_workspace_access(workspace));

DROP POLICY IF EXISTS "activities_crud_by_workspace" ON public.activities;
CREATE POLICY "activities_crud_by_workspace" ON public.activities
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace))
WITH CHECK (public.has_workspace_access(workspace));

DROP POLICY IF EXISTS "tasks_crud_by_workspace" ON public.tasks;
CREATE POLICY "tasks_crud_by_workspace" ON public.tasks
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace))
WITH CHECK (public.has_workspace_access(workspace));

DROP POLICY IF EXISTS "notes_crud_by_workspace" ON public.notes;
CREATE POLICY "notes_crud_by_workspace" ON public.notes
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace))
WITH CHECK (public.has_workspace_access(workspace));

DROP POLICY IF EXISTS "tags_crud_by_workspace" ON public.tags;
CREATE POLICY "tags_crud_by_workspace" ON public.tags
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace))
WITH CHECK (public.has_workspace_access(workspace));

DROP POLICY IF EXISTS "client_tags_crud_by_workspace" ON public.client_tags;
CREATE POLICY "client_tags_crud_by_workspace" ON public.client_tags
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace))
WITH CHECK (public.has_workspace_access(workspace));

DROP POLICY IF EXISTS "import_runs_crud_by_workspace" ON public.import_runs;
CREATE POLICY "import_runs_crud_by_workspace" ON public.import_runs
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace))
WITH CHECK (public.has_workspace_access(workspace));

COMMIT;
