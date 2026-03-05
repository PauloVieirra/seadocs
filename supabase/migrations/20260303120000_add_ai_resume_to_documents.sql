-- Coluna ai_resume: resumo de entendimento da IA sobre o documento
-- Alimenta o RAG e permite que a IA tenha contexto sempre que o documento for aberto

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS ai_resume text;

COMMENT ON COLUMN public.documents.ai_resume IS 'Resumo de entendimento gerado pela IA sobre o documento, usado para alimentar o RAG e exibir no chat';
