-- Adiciona colunas para proteção contra exclusão e restauração ao formato original
-- is_protected: trava que impede a exclusão do modelo
-- original_sections: cópia do template no momento da criação, usada para restaurar

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'templates' AND column_name = 'is_protected') THEN
    ALTER TABLE public.templates ADD COLUMN is_protected boolean NOT NULL DEFAULT false;
    COMMENT ON COLUMN public.templates.is_protected IS 'Se true, o modelo não pode ser excluído.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'templates' AND column_name = 'original_sections') THEN
    ALTER TABLE public.templates ADD COLUMN original_sections jsonb;
    COMMENT ON COLUMN public.templates.original_sections IS 'Cópia do template no momento da criação. Usado para restaurar ao formato original.';
  END IF;
END $$;
