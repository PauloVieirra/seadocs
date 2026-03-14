-- Colunas para Revisão e Assinatura de Documentos
-- signed_at: data/hora da assinatura (Gov.br)
-- review_justification: justificativa da revisão

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'signed_at') THEN
    ALTER TABLE public.documents ADD COLUMN signed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'review_justification') THEN
    ALTER TABLE public.documents ADD COLUMN review_justification text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'signed_by') THEN
    ALTER TABLE public.documents ADD COLUMN signed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.documents.signed_at IS 'Data/hora da assinatura digital via Gov.br';
COMMENT ON COLUMN public.documents.review_justification IS 'Justificativa da revisão do documento';
COMMENT ON COLUMN public.documents.signed_by IS 'Usuário que assinou o documento';
