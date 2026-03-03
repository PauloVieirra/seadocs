-- Colunas para RAG: file_url, chunk_count, file_hash
-- file_url: link público do bucket (obrigatório para processamento)
-- chunk_count: quantidade de chunks indexados no ChromaDB
-- file_hash: hash do arquivo para evitar duplicação

ALTER TABLE public.project_materials
ADD COLUMN IF NOT EXISTS file_url text,
ADD COLUMN IF NOT EXISTS chunk_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS file_hash text;

-- Índice para busca por hash (evitar duplicação)
CREATE INDEX IF NOT EXISTS idx_project_materials_file_hash ON public.project_materials(file_hash) WHERE file_hash IS NOT NULL;
