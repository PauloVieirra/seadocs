-- Tabela de assinaturas de documentos (rastreamento e auditoria)

CREATE TABLE IF NOT EXISTS public.document_signatures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'PENDENTE',
  nota text NULL,
  signed_at timestamptz NULL,
  created_at timestamptz NULL DEFAULT now(),
  CONSTRAINT document_signatures_pkey PRIMARY KEY (id),
  CONSTRAINT document_signatures_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT document_signatures_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT document_signatures_status_check CHECK (
    status = ANY (ARRAY['PENDENTE', 'ASSINADO', 'RECUSADO'])
  )
) TABLESPACE pg_default;

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS document_signatures_document_id_idx ON public.document_signatures(document_id);
CREATE INDEX IF NOT EXISTS document_signatures_user_id_idx ON public.document_signatures(user_id);
CREATE INDEX IF NOT EXISTS document_signatures_status_idx ON public.document_signatures(status);

-- RLS
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_signatures_select_authenticated" ON public.document_signatures
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "document_signatures_insert_authenticated" ON public.document_signatures
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
