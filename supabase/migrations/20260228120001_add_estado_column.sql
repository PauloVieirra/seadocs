-- Coluna estado (boolean) na tabela projects
-- estado = true: projeto publicado (visível a todos)
-- estado = false: projeto arquivado (visível apenas a administradores)

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS estado BOOLEAN NOT NULL DEFAULT true;

-- Projetos existentes com status 'archived' recebem estado = false
UPDATE public.projects SET estado = false WHERE status = 'archived';

-- Índice para filtrar projetos por visibilidade
CREATE INDEX IF NOT EXISTS idx_projects_estado ON public.projects(estado);
