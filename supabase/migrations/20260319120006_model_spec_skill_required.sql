-- Adiciona skill_path ao modelo (templates). Spec e skill passam a ser obrigatórios no modelo.
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS skill_path text;

COMMENT ON COLUMN public.templates.skill_path IS 'Caminho do Skill no bucket skill. Obrigatório com spec_path para geração eficiente.';
