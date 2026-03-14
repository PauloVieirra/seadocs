-- Políticas de acesso para o bucket 'specs' (Storage)
-- Armazena arquivos Spec (.md) que orientam a IA na geração de documentos por modelo.

-- Criar bucket 'specs' se não existir (privado; acesso via RLS)
INSERT INTO storage.buckets (id, name, public)
SELECT 'specs', 'specs', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'specs');

-- Leitura: qualquer usuário autenticado pode listar e baixar specs
DROP POLICY IF EXISTS "specs_select_authenticated" ON storage.objects;
CREATE POLICY "specs_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'specs');

-- Upload: apenas administradores podem enviar specs
DROP POLICY IF EXISTS "specs_insert_admin" ON storage.objects;
CREATE POLICY "specs_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'specs'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND tipo = 'Administrador'
    )
  );

-- Atualização: apenas administradores
DROP POLICY IF EXISTS "specs_update_admin" ON storage.objects;
CREATE POLICY "specs_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'specs'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND tipo = 'Administrador'
    )
  )
  WITH CHECK (bucket_id = 'specs');

-- Exclusão: apenas administradores
DROP POLICY IF EXISTS "specs_delete_admin" ON storage.objects;
CREATE POLICY "specs_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'specs'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND tipo = 'Administrador'
    )
  );
