-- Políticas RLS para tabela templates (modelos de documento)
-- Permite usuários autenticados com permissão de templates acessarem
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'templates') THEN
    ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "templates_select_authenticated" ON public.templates;
    CREATE POLICY "templates_select_authenticated" ON public.templates
      FOR SELECT USING (auth.uid() IS NOT NULL);

    DROP POLICY IF EXISTS "templates_insert_authenticated" ON public.templates;
    CREATE POLICY "templates_insert_authenticated" ON public.templates
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

    DROP POLICY IF EXISTS "templates_update_authenticated" ON public.templates;
    CREATE POLICY "templates_update_authenticated" ON public.templates
      FOR UPDATE USING (auth.uid() IS NOT NULL);

    DROP POLICY IF EXISTS "templates_delete_authenticated" ON public.templates;
    CREATE POLICY "templates_delete_authenticated" ON public.templates
      FOR DELETE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
