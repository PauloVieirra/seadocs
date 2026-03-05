-- Altera ai_resume de text para jsonb
-- Estrutura: {"summary": "texto do resumo técnico"}
-- Permite extensão futura com metadados (versão, data, etc.)

ALTER TABLE public.documents
ALTER COLUMN ai_resume TYPE jsonb
USING jsonb_build_object('summary', COALESCE(ai_resume, ''));

COMMENT ON COLUMN public.documents.ai_resume IS 'Resumo técnico gerado pela IA (jsonb: {summary: string}), usado para alimentar o RAG e exibir no chat';
