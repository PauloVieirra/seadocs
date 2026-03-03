-- Exige permissão criar_documentos para INSERT em documents (aplicação no banco)
-- Garante que mesmo se o cliente estiver errado, o banco bloqueia

CREATE OR REPLACE FUNCTION public.user_can_create_documents()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_criar boolean;
  v_total boolean;
BEGIN
  -- Se tem row em permissions, usar os valores da tabela (prioridade)
  SELECT p.criar_documentos, p.acesso_total INTO v_criar, v_total
  FROM public.permissions p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  IF FOUND THEN
    RETURN COALESCE(v_total, false) OR COALESCE(v_criar, false);
  END IF;

  -- Fallback: role em public.users (quando não há row em permissions)
  IF EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND LOWER(COALESCE(u.role, '')) IN ('admin', 'manager', 'technical_responsible', 'operational')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'documents') THEN
    DROP POLICY IF EXISTS "documents_insert_authenticated" ON public.documents;
    DROP POLICY IF EXISTS "documents_insert_any" ON public.documents;
    CREATE POLICY "documents_insert_requires_permission" ON public.documents
      FOR INSERT WITH CHECK (public.user_can_create_documents());
  END IF;
END $$;
