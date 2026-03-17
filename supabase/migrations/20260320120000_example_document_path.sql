-- Adiciona example_document_path ao modelo (templates).
-- Documento de exemplo: referência visual para a IA entender organização e formato esperado.
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS example_document_path text;

COMMENT ON COLUMN public.templates.example_document_path IS 'Caminho do documento de exemplo no bucket examples (ex: Exemplo_Requisitos.md). A IA usa para entender organização e formato esperado.';
