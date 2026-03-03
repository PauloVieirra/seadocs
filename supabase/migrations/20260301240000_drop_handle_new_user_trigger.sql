-- Remove trigger que pode causar falha no createUser (Database error)
-- A Edge Function admin-create-user grava em public.users após createUser.
-- Para signUp/dashboard: considerar webhook ou função separada no futuro.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
