-- Políticas de acesso para o bucket 'skill' (Storage)
-- Armazena arquivos Skill (.md) usados pela IA.

-- Criar bucket 'skill' se não existir (privado; acesso via RLS)
INSERT INTO storage.buckets (id, name, public)
SELECT 'skill', 'skill', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'skill');

-- Leitura: qualquer usuário autenticado pode listar e baixar
DROP POLICY IF EXISTS "skill_select_authenticated" ON storage.objects;
CREATE POLICY "skill_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'skill');

-- Upload: apenas administradores
DROP POLICY IF EXISTS "skill_insert_admin" ON storage.objects;
CREATE POLICY "skill_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'skill'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND tipo = 'Administrador'
    )
  );

-- Atualização: apenas administradores
DROP POLICY IF EXISTS "skill_update_admin" ON storage.objects;
CREATE POLICY "skill_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'skill'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND tipo = 'Administrador'
    )
  )
  WITH CHECK (bucket_id = 'skill');

-- Exclusão: apenas administradores
DROP POLICY IF EXISTS "skill_delete_admin" ON storage.objects;
CREATE POLICY "skill_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'skill'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND tipo = 'Administrador'
    )
  );
