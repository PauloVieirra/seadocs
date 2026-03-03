-- Política UPDATE para documents (RLS)
-- Sem esta política, o UPDATE não afeta linhas e .select().single() falha com
-- "Cannot coerce the result to a single JSON object" ao usar "Gerar tudo com IA"

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'documents') THEN
    DROP POLICY IF EXISTS "documents_update_authenticated" ON public.documents;
    CREATE POLICY "documents_update_authenticated" ON public.documents
      FOR UPDATE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
