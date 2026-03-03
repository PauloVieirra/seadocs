-- Corrige recursão infinita nas políticas RLS da tabela permissions.
-- A política consultava a própria tabela permissions, causando loop.
-- Usamos função SECURITY DEFINER que bypassa RLS ao ler permissions.

-- Remove políticas que causam recursão
DROP POLICY IF EXISTS "managers_read_any_permissions" ON public.permissions;
DROP POLICY IF EXISTS "managers_write_permissions" ON public.permissions;

-- Função que verifica se o usuário atual pode gerenciar permissões (bypassa RLS)
CREATE OR REPLACE FUNCTION public.user_can_manage_permissions()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.permissions p
    WHERE p.user_id = auth.uid()
    AND (p.gerenciar_usuarios = true OR p.acesso_total = true)
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND LOWER(COALESCE(u.role, '')) = 'admin'
  );
$$;

-- Políticas que usam a função (evita recursão)
CREATE POLICY "managers_read_any_permissions" ON public.permissions
  FOR SELECT USING (public.user_can_manage_permissions());

CREATE POLICY "managers_write_permissions" ON public.permissions
  FOR ALL
  USING (public.user_can_manage_permissions())
  WITH CHECK (public.user_can_manage_permissions());
