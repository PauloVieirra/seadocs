-- Corrige verificação de admin: alguns admins podem ter role/tipo em formato diferente
-- ou existir apenas em auth.users

CREATE OR REPLACE FUNCTION public.user_can_manage_permissions()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Verifica na tabela permissions (gerenciar_usuarios ou acesso_total)
  IF EXISTS (
    SELECT 1 FROM public.permissions p
    WHERE p.user_id = auth.uid()
    AND (p.gerenciar_usuarios = true OR p.acesso_total = true)
  ) THEN
    RETURN true;
  END IF;

  -- 2. Verifica na tabela public.users (role ou tipo)
  IF EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND (
      LOWER(COALESCE(u.role, '')) = 'admin'
      OR u.tipo = 'Administrador'
    )
  ) THEN
    RETURN true;
  END IF;

  -- 3. Fallback: auth.users (metadata pode ter role)
  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
    AND LOWER(COALESCE(u.raw_user_meta_data->>'role', '')) = 'admin'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
