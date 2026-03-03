-- Remove trigger em auth.users que causa "Database error creating new user"
-- O trigger handle_new_user falha ao inserir em public.users e reverte o createUser.
-- A Edge Function admin-create-user já insere em public.users após o createUser.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
