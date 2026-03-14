-- Tabela groups: grupos de usuários (vinculados opcionalmente a projetos)
-- Cria a tabela se não existir e configura RLS para permitir leitura por usuários autenticados

CREATE TABLE IF NOT EXISTS public.groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NULL,
  nome text NOT NULL,
  descricao text NULL,
  responsavel_id uuid NULL,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT groups_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT groups_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.users(id) ON DELETE SET NULL
);

-- Atualiza user_can_manage_groups para incluir technical_responsible e ser mais robusta
CREATE OR REPLACE FUNCTION public.user_can_manage_groups()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gerenciar boolean;
  v_total boolean;
BEGIN
  -- 1. Verifica na tabela permissions (gerenciar_grupos ou acesso_total)
  SELECT p.gerenciar_grupos, p.acesso_total INTO v_gerenciar, v_total
  FROM public.permissions p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  IF FOUND THEN
    RETURN COALESCE(v_total, false) OR COALESCE(v_gerenciar, false);
  END IF;

  -- 2. Fallback: public.users.role (admin, manager, technical_responsible)
  IF EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND LOWER(COALESCE(u.role, '')) IN ('admin', 'manager', 'technical_responsible')
  ) THEN
    RETURN true;
  END IF;

  -- 3. Fallback: auth.users metadata (usuário criado antes do trigger)
  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
    AND LOWER(COALESCE(u.raw_user_meta_data->>'role', '')) IN ('admin', 'manager', 'technical_responsible')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- RLS: usuários autenticados podem ver grupos; quem tem gerenciar_grupos pode inserir/atualizar/excluir
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups_select_authenticated" ON public.groups;
CREATE POLICY "groups_select_authenticated" ON public.groups
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "groups_insert_manage" ON public.groups;
CREATE POLICY "groups_insert_manage" ON public.groups
  FOR INSERT WITH CHECK (public.user_can_manage_groups());

DROP POLICY IF EXISTS "groups_update_manage" ON public.groups;
CREATE POLICY "groups_update_manage" ON public.groups
  FOR UPDATE USING (public.user_can_manage_groups());

DROP POLICY IF EXISTS "groups_delete_manage" ON public.groups;
CREATE POLICY "groups_delete_manage" ON public.groups
  FOR DELETE USING (public.user_can_manage_groups());
