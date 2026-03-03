-- Adiciona o status 'published' à tabela projects
-- Rascunho existe apenas para projetos não publicados; após publicar, o status passa a ser 'published'

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects ADD CONSTRAINT projects_status_check CHECK (
  status = ANY (ARRAY[
    'draft'::text,
    'published'::text,
    'in-progress'::text,
    'review'::text,
    'approved'::text
  ])
);
