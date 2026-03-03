-- Corrige erro 500 no signup ao cadastrar usuário
-- O trigger em auth.users falhava e causava rollback do signup.
-- Solução: remover o trigger. O fluxo da aplicação (api.ts register) já faz:
-- 1. signUp -> cria em auth.users
-- 2. upsert em public.users -> dispara sync_user_permissions_from_role
-- Assim o signup não falha e public.users + permissions são preenchidos corretamente.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
