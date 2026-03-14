-- Adiciona coluna creator_id à tabela templates (usuário que criou o modelo)
-- Usado para regra: apenas o dono pode excluir modelos não utilizados
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'templates' AND column_name = 'creator_id') THEN
    ALTER TABLE public.templates ADD COLUMN creator_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.templates.creator_id IS 'Usuário que criou o modelo. Apenas o dono pode excluir modelos não utilizados.';
  END IF;
END $$;
