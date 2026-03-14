-- Adiciona coluna spec_path à tabela templates (documento Spec obrigatório para o modelo)
-- O caminho referencia arquivos na pasta Spec/ (ex: Spec/Spac_Requisitos_Design.md)
ALTER TABLE public.templates
ADD COLUMN IF NOT EXISTS spec_path text;

COMMENT ON COLUMN public.templates.spec_path IS 'Caminho do documento Spec associado (ex: Spec/Spac_Requisitos_Design.md). Obrigatório para novos modelos.';
