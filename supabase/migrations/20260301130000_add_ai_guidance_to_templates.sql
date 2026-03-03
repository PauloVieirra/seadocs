-- Adiciona coluna ai_guidance à tabela templates (instruções para a IA sobre o tipo de documento)
ALTER TABLE public.templates
ADD COLUMN IF NOT EXISTS ai_guidance text;
