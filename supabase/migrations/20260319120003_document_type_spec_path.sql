-- Adiciona spec_path ao tipo de documento (tipo X → spec Y)
ALTER TABLE public.document_types ADD COLUMN IF NOT EXISTS spec_path text;

COMMENT ON COLUMN public.document_types.spec_path IS 'Caminho do Spec associado ao tipo (ex: Spec/Spec_Documento_Requisitos.md). Usado na geração: modelo com tipo X usa o spec do tipo X.';

-- Migra spec_path dos templates para document_types (por nome do tipo)
UPDATE public.document_types dt
SET spec_path = sub.spec_path
FROM (
  SELECT DISTINCT ON (tipo_documento) tipo_documento, spec_path
  FROM public.templates
  WHERE tipo_documento IS NOT NULL AND tipo_documento != '' AND spec_path IS NOT NULL AND spec_path != ''
) sub
WHERE dt.name = sub.tipo_documento AND dt.spec_path IS NULL;

-- Política UPDATE para document_types
CREATE POLICY "document_types_update_authenticated" ON public.document_types
  FOR UPDATE USING (auth.uid() IS NOT NULL);
