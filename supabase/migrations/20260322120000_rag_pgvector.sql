-- RAG com pgvector: armazena chunks e embeddings no Supabase
-- Dimensão 768 = nomic-embed-text (Ollama)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.rag_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id text NOT NULL UNIQUE,
  content text NOT NULL,
  embedding vector(768) NOT NULL,
  document_id text NOT NULL,
  project_id text NOT NULL,
  file_name text,
  source text DEFAULT 'bucket',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Índice para busca por similaridade (IVFFlat)
-- lists=1 permite criar em tabela vazia; aumentar após popular (ex: lists=100 para ~10k rows)
CREATE INDEX IF NOT EXISTS idx_rag_documents_embedding ON public.rag_documents
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 1);

-- Índices para filtros
CREATE INDEX IF NOT EXISTS idx_rag_documents_project_id ON public.rag_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_document_id ON public.rag_documents(document_id);

-- RLS: service_role bypassa. Para usuários autenticados, pode restringir por project_id
ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;

-- Política permissiva para service_role (usado pelo RAG backend)
CREATE POLICY "Service role full access" ON public.rag_documents
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.rag_documents IS 'Chunks indexados para RAG - embeddings via pgvector';

-- Função para busca por similaridade (chamada via RPC)
CREATE OR REPLACE FUNCTION public.rag_match_documents(
  query_embedding vector(768),
  match_project_id text DEFAULT NULL,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  content text,
  metadata jsonb,
  distance float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rd.content,
    jsonb_build_object(
      'document_id', rd.document_id,
      'project_id', rd.project_id,
      'file_name', rd.file_name,
      'source', rd.source
    ) || COALESCE(rd.metadata, '{}'),
    (rd.embedding <=> query_embedding)::float
  FROM public.rag_documents rd
  WHERE (match_project_id IS NULL OR rd.project_id = match_project_id)
  ORDER BY rd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Função para limpar toda a base RAG
CREATE OR REPLACE FUNCTION public.rag_clear_all()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.rag_documents;
$$;
