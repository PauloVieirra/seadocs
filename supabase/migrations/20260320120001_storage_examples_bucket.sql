-- Políticas de acesso para o bucket 'examples' (Storage)
-- Armazena documentos de exemplo (.md) que orientam a IA na organização e formato.

-- Criar bucket 'examples' se não existir (privado; acesso via RLS)
INSERT INTO storage.buckets (id, name, public)
SELECT 'examples', 'examples', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'examples');

-- Leitura: qualquer usuário autenticado pode listar e baixar exemplos
DROP POLICY IF EXISTS "examples_select_authenticated" ON storage.objects;
CREATE POLICY "examples_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'examples');

-- Upload: apenas administradores podem enviar exemplos
DROP POLICY IF EXISTS "examples_insert_admin" ON storage.objects;
CREATE POLICY "examples_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'examples'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND tipo = 'Administrador'
    )
  );

-- Atualização: apenas administradores
DROP POLICY IF EXISTS "examples_update_admin" ON storage.objects;
CREATE POLICY "examples_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'examples'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND tipo = 'Administrador'
    )
  )
  WITH CHECK (bucket_id = 'examples');

-- Exclusão: apenas administradores
DROP POLICY IF EXISTS "examples_delete_admin" ON storage.objects;
CREATE POLICY "examples_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'examples'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND tipo = 'Administrador'
    )
  );
