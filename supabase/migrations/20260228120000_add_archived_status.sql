-- Adiciona o status 'archived' (arquivado) à tabela projects
-- Projetos arquivados ficam invisíveis para todos exceto administradores

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects ADD CONSTRAINT projects_status_check CHECK (
  status = ANY (ARRAY[
    'draft'::text,
    'published'::text,
    'archived'::text,
    'in-progress'::text,
    'review'::text,
    'approved'::text
  ])
);
