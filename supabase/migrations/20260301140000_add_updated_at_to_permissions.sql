-- Adiciona coluna updated_at à tabela permissions se não existir
-- Corrige erro ao mudar papel do usuário: "Column 'updated_at' of relation 'permissions' does not exist"
ALTER TABLE public.permissions
ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL DEFAULT now();
