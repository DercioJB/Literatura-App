-- SCHEMA DE MIGRAÇÃO PARA SUPABASE POSTGRESQL
-- Copie e cole este script no Painel SQL (SQL Editor) do seu projeto Supabase.

-- Ativar extenções úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Espaços de Trabalho (Workspaces)
CREATE TABLE IF NOT EXISTS public.workspaces (
    id TEXT PRIMARY KEY DEFAULT 'global_workspace',
    owner_id TEXT NOT NULL DEFAULT 'default_admin',
    access_list JSONB DEFAULT '[]'::jsonb,
    locations JSONB DEFAULT '["MANANGA PT", "CHOTA PT"]'::jsonb,
    low_stock_threshold INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inserir o primeiro workspace padrão se ele não existir
INSERT INTO public.workspaces (id, owner_id, access_list, locations, low_stock_threshold)
VALUES ('global_workspace', 'default_admin', '[]'::jsonb, '["MANANGA PT", "CHOTA PT"]'::jsonb, 10)
ON CONFLICT (id) DO NOTHING;

-- 2. Tabela de Livros (Estoque)
CREATE TABLE IF NOT EXISTS public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE DEFAULT 'global_workspace',
    access_list JSONB DEFAULT '[]'::jsonb,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    category TEXT NOT NULL,
    loc TEXT NOT NULL,
    origin INTEGER DEFAULT 0 NOT NULL,
    qty_in INTEGER DEFAULT 0 NOT NULL,
    qty_out INTEGER DEFAULT 0 NOT NULL,
    last_date TEXT NOT NULL,
    last_month TEXT NOT NULL,
    changes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Histórico (Fotos mensais de fecho do stock)
CREATE TABLE IF NOT EXISTS public.history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE DEFAULT 'global_workspace',
    access_list JSONB DEFAULT '[]'::jsonb,
    month_key TEXT NOT NULL,
    snapshots JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (workspace_id, month_key)
);

-- 4. Tabela de Backups (Cópias de segurança)
CREATE TABLE IF NOT EXISTS public.backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE DEFAULT 'global_workspace',
    access_list JSONB DEFAULT '[]'::jsonb,
    backup_date TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Perfil de Utilizadores para ligação com o Supabase Auth (Opcional)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    name TEXT,
    email TEXT,
    role TEXT DEFAULT 'user' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Criar índices de desempenho para consultas recorrentes rápidas
CREATE INDEX IF NOT EXISTS books_workspace_id_idx ON public.books (workspace_id);
CREATE INDEX IF NOT EXISTS books_loc_idx ON public.books (loc);
CREATE INDEX IF NOT EXISTS history_workspace_id_idx ON public.history (workspace_id);
CREATE INDEX IF NOT EXISTS backups_workspace_id_idx ON public.backups (workspace_id);

-- Ativar Publicações em Tempo Real (Realtime) para manter o App sincronizado instantaneamente
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspaces;
ALTER PUBLICATION supabase_realtime ADD TABLE public.books;
ALTER PUBLICATION supabase_realtime ADD TABLE public.history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.backups;

-- ==========================================================
-- DEFINE ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts if reapplying
DROP POLICY IF EXISTS "Permitir leitura de workspaces a utilizadores autenticados" ON public.workspaces;
DROP POLICY IF EXISTS "Permitir escrita de workspaces a utilizadores autenticados" ON public.workspaces;
DROP POLICY IF EXISTS "Permitir tudo em books a utilizadores autenticados" ON public.books;
DROP POLICY IF EXISTS "Permitir tudo em history a utilizadores autenticados" ON public.history;
DROP POLICY IF EXISTS "Permitir tudo em backups a utilizadores autenticados" ON public.backups;
DROP POLICY IF EXISTS "Permitir leitura de profiles aos utilizadores" ON public.profiles;
DROP POLICY IF EXISTS "Permitir inserção do próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Permitir atualização do próprio perfil" ON public.profiles;

-- 3. WORKSPACES POLICIES
CREATE POLICY "Permitir leitura de workspaces a utilizadores autenticados"
ON public.workspaces
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir escrita de workspaces a utilizadores autenticados"
ON public.workspaces
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. BOOKS POLICIES (Allow authenticated users to CRUD books)
CREATE POLICY "Permitir tudo em books a utilizadores autenticados"
ON public.books
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. HISTORY POLICIES (Allow authenticated users to CRUD history)
CREATE POLICY "Permitir tudo em history a utilizadores autenticados"
ON public.history
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 6. BACKUPS POLICIES (Allow authenticated users to CRUD backups)
CREATE POLICY "Permitir tudo em backups a utilizadores autenticados"
ON public.backups
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 7. PROFILES POLICIES (Allow authenticated users to read, but only self can write)
CREATE POLICY "Permitir leitura de profiles aos utilizadores"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir inserção do próprio perfil"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Permitir atualização do próprio perfil"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

