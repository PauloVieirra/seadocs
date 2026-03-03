-- Políticas de acesso para o bucket Documentos (storage)
-- Estrutura: Documentos/{project_id}/{arquivo.ext}
-- Crie o bucket "Documentos" no Dashboard (Storage > New bucket) se não existir.

-- Políticas para storage.objects no bucket Documentos
-- Permite usuários autenticados fazer upload em pastas de projeto (project_id como primeiro segmento do path)
DROP POLICY IF EXISTS "documentos_insert_authenticated" ON storage.objects;
CREATE POLICY "documentos_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'Documentos');

DROP POLICY IF EXISTS "documentos_select_authenticated" ON storage.objects;
CREATE POLICY "documentos_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'Documentos');

DROP POLICY IF EXISTS "documentos_update_authenticated" ON storage.objects;
CREATE POLICY "documentos_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'Documentos')
  WITH CHECK (bucket_id = 'Documentos');

DROP POLICY IF EXISTS "documentos_delete_authenticated" ON storage.objects;
CREATE POLICY "documentos_delete_authenticated" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'Documentos');
