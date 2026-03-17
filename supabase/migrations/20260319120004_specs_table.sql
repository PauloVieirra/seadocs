-- Tabela de Specs (documentos de especificação usados na geração)
CREATE TABLE IF NOT EXISTS public.specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.specs IS 'Specs cadastrados. Usados para associar tipos de documento a diretrizes de geração.';

-- RLS
ALTER TABLE public.specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "specs_select_authenticated" ON public.specs
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Seed com specs da pasta Spec/
INSERT INTO public.specs (path, label)
VALUES
  ('Spec/Spec_Documento_Requisitos.md', 'Spec Documento Requisitos'),
  ('Spec/Spec_Toolbar_Criacao_Documento.md', 'Spec Toolbar Criação Documento')
ON CONFLICT (path) DO NOTHING;
