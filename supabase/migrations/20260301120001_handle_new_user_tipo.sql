-- Corrige o trigger handle_new_user para incluir a coluna tipo (obrigatória)
-- Se o trigger falhar ao inserir, o signup retorna 500
-- O tipo é derivado do role em raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
  user_tipo text;
BEGIN
  user_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'operational'));
  user_tipo := CASE user_role
    WHEN 'admin' THEN 'Administrador'
    WHEN 'director' THEN 'Diretor'
    WHEN 'manager' THEN 'Gerente'
    WHEN 'technical_responsible' THEN 'Responsável Técnico'
    WHEN 'operational' THEN 'Operacional'
    WHEN 'external' THEN 'Usuário Externo'
    ELSE 'Operacional'
  END;

  INSERT INTO public.users (id, email, nome, tipo, status, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    user_tipo,
    'ATIVO',
    user_role,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = EXCLUDED.nome,
    tipo = EXCLUDED.tipo,
    status = EXCLUDED.status,
    role = EXCLUDED.role,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Remove trigger antigo se existir (pode ter nome variado)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;

-- Cria trigger para executar ao inserir novo usuário em auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
