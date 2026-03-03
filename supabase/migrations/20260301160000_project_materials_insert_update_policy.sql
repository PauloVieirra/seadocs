-- Adiciona políticas INSERT e UPDATE em project_materials (corrige 401 ao enviar arquivos)
-- A tabela tinha apenas SELECT e DELETE, bloqueando upload de fontes de dados

DROP POLICY IF EXISTS "project_materials_insert_authenticated" ON public.project_materials;
CREATE POLICY "project_materials_insert_authenticated" ON public.project_materials
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "project_materials_update_authenticated" ON public.project_materials;
CREATE POLICY "project_materials_update_authenticated" ON public.project_materials
  FOR UPDATE USING (auth.uid() IS NOT NULL);

