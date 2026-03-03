-- Tabela group_members: associação usuários <-> grupos
-- Permite adicionar/remover pessoas de um grupo (requer gerenciar_grupos)

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NULL DEFAULT now(),
  CONSTRAINT group_members_pkey PRIMARY KEY (id),
  CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE,
  CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT group_members_unique UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);

-- RLS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários autenticados podem SELECT; quem tem gerenciar_grupos pode INSERT/DELETE
DROP POLICY IF EXISTS "group_members_select_authenticated" ON public.group_members;
CREATE POLICY "group_members_select_authenticated" ON public.group_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT/DELETE exigem gerenciar_grupos (via função)
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
  SELECT p.gerenciar_grupos, p.acesso_total INTO v_gerenciar, v_total
  FROM public.permissions p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  IF FOUND THEN
    RETURN COALESCE(v_total, false) OR COALESCE(v_gerenciar, false);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND LOWER(COALESCE(u.role, '')) IN ('admin', 'manager')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "group_members_insert_manage" ON public.group_members;
CREATE POLICY "group_members_insert_manage" ON public.group_members
  FOR INSERT WITH CHECK (public.user_can_manage_groups());

DROP POLICY IF EXISTS "group_members_delete_manage" ON public.group_members;
CREATE POLICY "group_members_delete_manage" ON public.group_members
  FOR DELETE USING (public.user_can_manage_groups());
