-- Tabela de tipos de documento (ex.: Especificação de Requisitos, Contrato, etc.)
CREATE TABLE IF NOT EXISTS public.document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.document_types IS 'Tipos de documento cadastrados. Usados na criação de modelos para associar o modelo a um tipo.';

-- RLS
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_types_select_authenticated" ON public.document_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "document_types_insert_authenticated" ON public.document_types
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Seed com tipos existentes nos templates
INSERT INTO public.document_types (name)
SELECT DISTINCT tipo_documento FROM public.templates WHERE tipo_documento IS NOT NULL AND tipo_documento != ''
ON CONFLICT (name) DO NOTHING;
