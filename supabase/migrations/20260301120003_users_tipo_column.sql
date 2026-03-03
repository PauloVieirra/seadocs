-- Adiciona coluna tipo na tabela users (label do papel: Administrador, Diretor, etc.)
-- role = código (admin, director, ...), tipo = label para exibição
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'tipo'
  ) THEN
    ALTER TABLE public.users ADD COLUMN tipo text;
  END IF;

  -- Remove constraint antiga que pode usar valores diferentes (ex: EXTERNO, OPERACIONAL)
  ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_tipo_check;

  -- Sincroniza tipo com labels baseados em role para TODAS as linhas
  -- ELSE 'Operacional' garante que valores antigos (ex: EXTERNO) sejam substituídos
  UPDATE public.users SET tipo = CASE LOWER(COALESCE(role, ''))
    WHEN 'admin' THEN 'Administrador'
    WHEN 'director' THEN 'Diretor'
    WHEN 'manager' THEN 'Gerente'
    WHEN 'technical_responsible' THEN 'Responsável Técnico'
    WHEN 'operational' THEN 'Operacional'
    WHEN 'external' THEN 'Usuário Externo'
    ELSE 'Operacional'
  END;

  -- Recria constraint com os valores corretos
  ALTER TABLE public.users ADD CONSTRAINT users_tipo_check CHECK (
    tipo IN ('Administrador', 'Diretor', 'Gerente', 'Responsável Técnico', 'Operacional', 'Usuário Externo')
  );
END $$;
