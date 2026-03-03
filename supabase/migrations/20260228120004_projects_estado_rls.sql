ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS estado BOOLEAN NULL;

UPDATE public.projects SET estado = true WHERE estado IS NULL;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_authenticated" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_authenticated" ON public.projects;
DROP POLICY IF EXISTS "projects_update_authenticated" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_authenticated" ON public.projects;

CREATE POLICY "projects_select_authenticated" ON public.projects
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "projects_insert_authenticated" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "projects_update_authenticated" ON public.projects
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "projects_delete_authenticated" ON public.projects
  FOR DELETE USING (auth.uid() IS NOT NULL);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'documents') THEN
    ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "documents_select_authenticated" ON public.documents;
    DROP POLICY IF EXISTS "documents_delete_authenticated" ON public.documents;
    CREATE POLICY "documents_select_authenticated" ON public.documents FOR SELECT USING (auth.uid() IS NOT NULL);
    CREATE POLICY "documents_delete_authenticated" ON public.documents FOR DELETE USING (auth.uid() IS NOT NULL);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_materials') THEN
    ALTER TABLE public.project_materials ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "project_materials_select_authenticated" ON public.project_materials;
    DROP POLICY IF EXISTS "project_materials_delete_authenticated" ON public.project_materials;
    CREATE POLICY "project_materials_select_authenticated" ON public.project_materials FOR SELECT USING (auth.uid() IS NOT NULL);
    CREATE POLICY "project_materials_delete_authenticated" ON public.project_materials FOR DELETE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
