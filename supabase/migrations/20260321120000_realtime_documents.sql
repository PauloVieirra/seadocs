-- Habilita Realtime para a tabela documents (permite subscribeToDocument receber atualizações)
-- Necessário para que o texto gerado pela IA apareça automaticamente na tela
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
  END IF;
END $$;
