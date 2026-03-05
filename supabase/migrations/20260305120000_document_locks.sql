-- Tabela document_locks: bloqueio de seções em edição por usuário
-- Quando um usuário foca em um campo de seção, adquire lock; ao sair (blur), libera.
-- Locks expiram em 2 minutos para evitar locks órfãos.

CREATE TABLE IF NOT EXISTS public.document_locks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  section_id text NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  created_at timestamptz NULL DEFAULT now(),
  expires_at timestamptz NULL DEFAULT (now() + interval '2 minutes'),
  CONSTRAINT document_locks_pkey PRIMARY KEY (id),
  CONSTRAINT document_locks_doc_section_unique UNIQUE (document_id, section_id),
  CONSTRAINT document_locks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE,
  CONSTRAINT document_locks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_document_locks_doc_id ON public.document_locks USING btree (document_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_document_locks_expires ON public.document_locks USING btree (expires_at) TABLESPACE pg_default;

-- RLS: usuários autenticados podem ver locks (para exibir "editado por X")
-- e inserir/deletar seus próprios locks
ALTER TABLE public.document_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_locks_select_authenticated" ON public.document_locks;
CREATE POLICY "document_locks_select_authenticated" ON public.document_locks
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "document_locks_insert_own" ON public.document_locks;
CREATE POLICY "document_locks_insert_own" ON public.document_locks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "document_locks_delete_own" ON public.document_locks;
CREATE POLICY "document_locks_delete_own" ON public.document_locks
  FOR DELETE USING (auth.uid() = user_id);

-- UPDATE para heartbeat (renovar expires_at) - usuário pode atualizar seu próprio lock
DROP POLICY IF EXISTS "document_locks_update_own" ON public.document_locks;
CREATE POLICY "document_locks_update_own" ON public.document_locks
  FOR UPDATE USING (auth.uid() = user_id);

-- Realtime: habilitar para document_locks (publicação deve ser configurada no Supabase Dashboard ou via SQL)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.document_locks;
