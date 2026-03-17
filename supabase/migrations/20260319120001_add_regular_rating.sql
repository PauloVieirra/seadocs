-- Adiciona 'regular' como opção de avaliação (entre bom e ruim)
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'document_evaluations' AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%rating%';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.document_evaluations DROP CONSTRAINT %I', conname);
  END IF;
  ALTER TABLE public.document_evaluations ADD CONSTRAINT document_evaluations_rating_check
    CHECK (rating IN ('good', 'bad', 'regular'));
END $$;

COMMENT ON COLUMN public.document_evaluations.rating IS 'good = documento ficou bom; regular = pode melhorar (comentário obrigatório); bad = não ficou bom';
