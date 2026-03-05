-- Colunas creator_id e security_level em documents (se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'creator_id') THEN
    ALTER TABLE public.documents ADD COLUMN creator_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'security_level') THEN
    ALTER TABLE public.documents ADD COLUMN security_level text DEFAULT 'public' CHECK (security_level IN ('public', 'restricted', 'confidential', 'secret'));
  END IF;
END $$;

-- Tabela document_shares: compartilhamento de documentos com usuários específicos
-- Usado para documentos restritos - apenas criador + usuários compartilhados podem visualizar

CREATE TABLE IF NOT EXISTS public.document_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  user_id uuid NOT NULL,
  permissions text[] NOT NULL DEFAULT ARRAY['view'],
  created_at timestamptz NULL DEFAULT now(),
  CONSTRAINT document_shares_pkey PRIMARY KEY (id),
  CONSTRAINT document_shares_doc_user_unique UNIQUE (document_id, user_id),
  CONSTRAINT document_shares_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE,
  CONSTRAINT document_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_document_shares_doc_id ON public.document_shares USING btree (document_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_document_shares_user_id ON public.document_shares USING btree (user_id) TABLESPACE pg_default;

-- RLS
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_shares_select_authenticated" ON public.document_shares;
CREATE POLICY "document_shares_select_authenticated" ON public.document_shares
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "document_shares_insert_authenticated" ON public.document_shares;
CREATE POLICY "document_shares_insert_authenticated" ON public.document_shares
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "document_shares_delete_authenticated" ON public.document_shares;
CREATE POLICY "document_shares_delete_authenticated" ON public.document_shares
  FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "document_shares_update_authenticated" ON public.document_shares;
CREATE POLICY "document_shares_update_authenticated" ON public.document_shares
  FOR UPDATE USING (auth.uid() IS NOT NULL);
