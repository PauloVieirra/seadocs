-- =============================================================================
-- RBAC + ABAC: Modelo de Papéis com Permissões Predeterminadas e Controle Granular
-- =============================================================================

-- 1. Tabela permissions (permissões efetivas por usuário - uma linha por user_id)
-- Referencia users(id). A tabela users deve existir com id uuid.
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  gerenciar_usuarios boolean NULL DEFAULT false,
  gerenciar_grupos boolean NULL DEFAULT false,
  criar_projetos boolean NULL DEFAULT false,
  editar_projetos boolean NULL DEFAULT false,
  excluir_projetos boolean NULL DEFAULT false,
  visualizar_todos_projetos boolean NULL DEFAULT false,
  visualizar_documentos boolean NULL DEFAULT true,
  criar_documentos boolean NULL DEFAULT false,
  editar_documentos boolean NULL DEFAULT false,
  excluir_documentos boolean NULL DEFAULT false,
  download_documentos boolean NULL DEFAULT true,
  compartilhar_documentos boolean NULL DEFAULT false,
  criar_templates boolean NULL DEFAULT false,
  editar_templates boolean NULL DEFAULT false,
  excluir_templates boolean NULL DEFAULT false,
  assinar_documentos boolean NULL DEFAULT false,
  solicitar_assinatura boolean NULL DEFAULT false,
  alimentar_ia boolean NULL DEFAULT false,
  gerenciar_ia boolean NULL DEFAULT false,
  acesso_total boolean NULL DEFAULT false,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  CONSTRAINT permissions_pkey PRIMARY KEY (id),
  CONSTRAINT permissions_user_id_key UNIQUE (user_id),
  CONSTRAINT permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Índice para buscas por user_id
CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON public.permissions(user_id);

-- 2. Tabela permission_definitions (catálogo de permissões granulares)
CREATE TABLE IF NOT EXISTS public.permission_definitions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NULL,
  created_at timestamptz NULL DEFAULT now(),
  CONSTRAINT permission_definitions_pkey PRIMARY KEY (id)
);

-- 3. Tabela role_permissions (mapeamento papel -> permissão granular)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission_id uuid NOT NULL,
  created_at timestamptz NULL DEFAULT now(),
  CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT role_permissions_unique UNIQUE (role, permission_id),
  CONSTRAINT role_permissions_permission_fkey FOREIGN KEY (permission_id) REFERENCES public.permission_definitions(id) ON DELETE CASCADE
);

-- 4. Tabela user_permissions (permissões granulares por usuário - overrides temporários)
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  granted_by uuid NULL,
  expires_at timestamptz NULL,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz NULL DEFAULT now(),
  CONSTRAINT user_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT user_permissions_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT user_permissions_permission_fkey FOREIGN KEY (permission_id) REFERENCES public.permission_definitions(id) ON DELETE CASCADE,
  CONSTRAINT user_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_expires_at ON public.user_permissions(expires_at);

-- 5. Tabela user_hierarchy (hierarquia supervisor-subordinado)
CREATE TABLE IF NOT EXISTS public.user_hierarchy (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  supervisor_id uuid NOT NULL,
  subordinate_id uuid NOT NULL,
  created_at timestamptz NULL DEFAULT now(),
  CONSTRAINT user_hierarchy_pkey PRIMARY KEY (id),
  CONSTRAINT user_hierarchy_unique UNIQUE (supervisor_id, subordinate_id),
  CONSTRAINT user_hierarchy_supervisor_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT user_hierarchy_subordinate_fkey FOREIGN KEY (subordinate_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT user_hierarchy_no_self CHECK (supervisor_id != subordinate_id)
);

CREATE INDEX IF NOT EXISTS idx_user_hierarchy_supervisor ON public.user_hierarchy(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_user_hierarchy_subordinate ON public.user_hierarchy(subordinate_id);

-- 6. Tabela project_members (permissões por projeto)
CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  permission_level text NOT NULL CHECK (permission_level IN ('VIEW', 'EDIT', 'ADMIN')),
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  CONSTRAINT project_members_pkey PRIMARY KEY (id),
  CONSTRAINT project_members_unique UNIQUE (project_id, user_id),
  CONSTRAINT project_members_project_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT project_members_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);

-- =============================================================================
-- Inserir definições de permissões granulares
-- =============================================================================
INSERT INTO public.permission_definitions (code, description) VALUES
  ('CREATE_PROJECT', 'Criar projetos'),
  ('EDIT_PROJECT', 'Editar projetos'),
  ('DELETE_PROJECT', 'Excluir projetos'),
  ('SHARE_PROJECT', 'Compartilhar projetos'),
  ('USE_AI', 'Usar IA'),
  ('VIEW_AUDIT_LOG', 'Visualizar logs de auditoria'),
  ('MANAGE_USERS', 'Gerenciar usuários'),
  ('APPROVE_DOCUMENT', 'Aprovar documentos'),
  ('EDIT_SECTION', 'Editar seções de documento'),
  ('LOCK_DOCUMENT', 'Bloquear documento'),
  ('VIEW_ALL_PROJECTS', 'Visualizar todos os projetos'),
  ('VIEW_DOCUMENTS', 'Visualizar documentos'),
  ('CREATE_DOCUMENTS', 'Criar documentos'),
  ('EDIT_DOCUMENTS', 'Editar documentos'),
  ('DELETE_DOCUMENTS', 'Excluir documentos'),
  ('DOWNLOAD_DOCUMENTS', 'Baixar documentos'),
  ('SHARE_DOCUMENTS', 'Compartilhar documentos'),
  ('MANAGE_TEMPLATES', 'Gerenciar modelos de documento'),
  ('MANAGE_GROUPS', 'Gerenciar grupos'),
  ('CONFIGURE_SYSTEM', 'Configurar API/Banco de dados')
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- Função para popular permissions baseado no role do usuário
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sync_user_permissions_from_role()
RETURNS TRIGGER AS $$
DECLARE
  user_role text;
  target_id uuid;
BEGIN
  target_id := COALESCE(NEW.id, OLD.id);
  user_role := LOWER(COALESCE(NEW.role, OLD.role, 'operational')::text);

  -- Inserir ou atualizar permissions baseado no role
  INSERT INTO public.permissions (
    user_id, gerenciar_usuarios, gerenciar_grupos, criar_projetos, editar_projetos,
    excluir_projetos, visualizar_todos_projetos, visualizar_documentos, criar_documentos,
    editar_documentos, excluir_documentos, download_documentos, compartilhar_documentos,
    criar_templates, editar_templates, excluir_templates, assinar_documentos,
    solicitar_assinatura, alimentar_ia, gerenciar_ia, acesso_total, updated_at
  ) VALUES (
    target_id,
    CASE user_role WHEN 'admin' THEN true ELSE false END,
    CASE user_role WHEN 'admin' THEN true WHEN 'manager' THEN true WHEN 'technical_responsible' THEN true ELSE false END,
    CASE user_role WHEN 'admin' THEN true WHEN 'manager' THEN true WHEN 'technical_responsible' THEN true ELSE false END,
    CASE user_role WHEN 'admin' THEN true WHEN 'manager' THEN true WHEN 'technical_responsible' THEN true ELSE false END,
    CASE user_role WHEN 'admin' THEN true WHEN 'manager' THEN true ELSE false END,
    CASE user_role WHEN 'admin' THEN true WHEN 'director' THEN true WHEN 'manager' THEN true WHEN 'technical_responsible' THEN true WHEN 'operational' THEN true ELSE false END,
    true,
    CASE user_role WHEN 'admin' THEN true WHEN 'manager' THEN true WHEN 'technical_responsible' THEN true WHEN 'operational' THEN true ELSE false END,
    CASE user_role WHEN 'admin' THEN true WHEN 'manager' THEN true WHEN 'technical_responsible' THEN true WHEN 'operational' THEN true ELSE false END,
    CASE user_role WHEN 'admin' THEN true WHEN 'manager' THEN true WHEN 'technical_responsible' THEN true WHEN 'operational' THEN true ELSE false END,
    true,
    CASE user_role WHEN 'admin' THEN true WHEN 'manager' THEN true WHEN 'technical_responsible' THEN true WHEN 'operational' THEN true ELSE false END,
    CASE user_role WHEN 'admin' THEN true WHEN 'manager' THEN true WHEN 'technical_responsible' THEN true ELSE false END,
    CASE user_role WHEN 'admin' THEN true WHEN 'manager' THEN true ELSE false END,
    CASE user_role WHEN 'admin' THEN true WHEN 'manager' THEN true ELSE false END,
    CASE user_role WHEN 'admin' THEN true WHEN 'manager' THEN true ELSE false END,
    false, false,
    CASE user_role WHEN 'admin' THEN true WHEN 'manager' THEN true WHEN 'technical_responsible' THEN true WHEN 'operational' THEN true ELSE false END,
    CASE user_role WHEN 'admin' THEN true WHEN 'manager' THEN true ELSE false END,
    CASE user_role WHEN 'admin' THEN true ELSE false END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    gerenciar_usuarios = EXCLUDED.gerenciar_usuarios,
    gerenciar_grupos = EXCLUDED.gerenciar_grupos,
    criar_projetos = EXCLUDED.criar_projetos,
    editar_projetos = EXCLUDED.editar_projetos,
    excluir_projetos = EXCLUDED.excluir_projetos,
    visualizar_todos_projetos = EXCLUDED.visualizar_todos_projetos,
    visualizar_documentos = EXCLUDED.visualizar_documentos,
    criar_documentos = EXCLUDED.criar_documentos,
    editar_documentos = EXCLUDED.editar_documentos,
    excluir_documentos = EXCLUDED.excluir_documentos,
    download_documentos = EXCLUDED.download_documentos,
    compartilhar_documentos = EXCLUDED.compartilhar_documentos,
    criar_templates = EXCLUDED.criar_templates,
    editar_templates = EXCLUDED.editar_templates,
    excluir_templates = EXCLUDED.excluir_templates,
    alimentar_ia = EXCLUDED.alimentar_ia,
    gerenciar_ia = EXCLUDED.gerenciar_ia,
    acesso_total = EXCLUDED.acesso_total,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Nota: O trigger em auth.users pode não ser permitido. Alternativa: trigger na tabela public.users
-- Verificar se existe tabela public.users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS trg_sync_permissions_on_user_change ON public.users;
    CREATE TRIGGER trg_sync_permissions_on_user_change
      AFTER INSERT OR UPDATE OF role ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_user_permissions_from_role();
  END IF;
END $$;

-- =============================================================================
-- Função para registrar alterações de permissão em audit_logs
-- =============================================================================
CREATE OR REPLACE FUNCTION public.log_permission_change()
RETURNS TRIGGER AS $$
DECLARE
  log_details jsonb;
  target_user_id uuid;
  action_text text;
BEGIN
  IF TG_TABLE_NAME = 'permissions' THEN
    target_user_id := COALESCE(NEW.user_id, OLD.user_id);
    IF TG_OP = 'INSERT' THEN
      action_text := 'PERMISSION_CREATED';
      log_details := jsonb_build_object('user_id', target_user_id, 'permission_row', to_jsonb(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
      action_text := 'PERMISSION_UPDATED';
      log_details := jsonb_build_object('user_id', target_user_id, 'old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    ELSIF TG_OP = 'DELETE' THEN
      action_text := 'PERMISSION_DELETED';
      log_details := jsonb_build_object('user_id', target_user_id, 'deleted', to_jsonb(OLD));
    END IF;
  ELSIF TG_TABLE_NAME = 'user_permissions' THEN
    target_user_id := COALESCE(NEW.user_id, OLD.user_id);
    IF TG_OP = 'INSERT' THEN
      action_text := 'USER_PERMISSION_GRANTED';
      log_details := jsonb_build_object('user_id', target_user_id, 'granted_by', NEW.granted_by, 'expires_at', NEW.expires_at);
    ELSIF TG_OP = 'UPDATE' THEN
      action_text := 'USER_PERMISSION_UPDATED';
      log_details := jsonb_build_object('user_id', target_user_id, 'old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    ELSIF TG_OP = 'DELETE' THEN
      action_text := 'USER_PERMISSION_REVOKED';
      log_details := jsonb_build_object('user_id', target_user_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'user_hierarchy' THEN
    target_user_id := COALESCE(NEW.subordinate_id, OLD.subordinate_id);
    IF TG_OP = 'INSERT' THEN
      action_text := 'HIERARCHY_ASSIGNED';
      log_details := jsonb_build_object('supervisor_id', NEW.supervisor_id, 'subordinate_id', NEW.subordinate_id);
    ELSIF TG_OP = 'DELETE' THEN
      action_text := 'HIERARCHY_REMOVED';
      log_details := jsonb_build_object('supervisor_id', OLD.supervisor_id, 'subordinate_id', OLD.subordinate_id);
    END IF;
  END IF;

  IF action_text IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    INSERT INTO public.audit_logs (entidade_id, acao, user_id, detalhes)
    VALUES (target_user_id, action_text, auth.uid(), log_details);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers de audit
DROP TRIGGER IF EXISTS trg_audit_permissions ON public.permissions;
CREATE TRIGGER trg_audit_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_permission_change();

DROP TRIGGER IF EXISTS trg_audit_user_permissions ON public.user_permissions;
CREATE TRIGGER trg_audit_user_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_permission_change();

DROP TRIGGER IF EXISTS trg_audit_user_hierarchy ON public.user_hierarchy;
CREATE TRIGGER trg_audit_user_hierarchy
  AFTER INSERT OR DELETE ON public.user_hierarchy
  FOR EACH ROW EXECUTE FUNCTION public.log_permission_change();

-- =============================================================================
-- Sincronizar permissões para usuários existentes
-- Desabilita o trigger de audit durante a sincronização (evita erro em audit_logs)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_audit_permissions ON public.permissions;

DO $$
DECLARE
  r record;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    FOR r IN SELECT id, COALESCE(role, 'operational')::text as role FROM public.users
    LOOP
      INSERT INTO public.permissions (
        user_id, gerenciar_usuarios, gerenciar_grupos, criar_projetos, editar_projetos,
        excluir_projetos, visualizar_todos_projetos, visualizar_documentos, criar_documentos,
        editar_documentos, excluir_documentos, download_documentos, compartilhar_documentos,
        criar_templates, editar_templates, excluir_templates, assinar_documentos,
        solicitar_assinatura, alimentar_ia, gerenciar_ia, acesso_total
      ) VALUES (
        r.id,
        r.role = 'admin',
        r.role IN ('admin', 'manager', 'technical_responsible'),
        r.role IN ('admin', 'manager', 'technical_responsible'),
        r.role IN ('admin', 'manager', 'technical_responsible'),
        r.role IN ('admin', 'manager'),
        true,
        true,
        r.role IN ('admin', 'manager', 'technical_responsible', 'operational'),
        r.role IN ('admin', 'manager', 'technical_responsible', 'operational'),
        r.role IN ('admin', 'manager', 'technical_responsible', 'operational'),
        true,
        r.role IN ('admin', 'manager', 'technical_responsible', 'operational'),
        r.role IN ('admin', 'manager', 'technical_responsible', 'operational'),
        r.role IN ('admin', 'manager', 'technical_responsible', 'operational'),
        r.role IN ('admin', 'manager'),
        false, false,
        r.role IN ('admin', 'manager', 'technical_responsible', 'operational'),
        r.role IN ('admin', 'manager'),
        r.role = 'admin'
      )
      ON CONFLICT (user_id) DO UPDATE SET
        gerenciar_usuarios = EXCLUDED.gerenciar_usuarios,
        gerenciar_grupos = EXCLUDED.gerenciar_grupos,
        criar_projetos = EXCLUDED.criar_projetos,
        editar_projetos = EXCLUDED.editar_projetos,
        excluir_projetos = EXCLUDED.excluir_projetos,
        visualizar_todos_projetos = EXCLUDED.visualizar_todos_projetos,
        visualizar_documentos = EXCLUDED.visualizar_documentos,
        criar_documentos = EXCLUDED.criar_documentos,
        editar_documentos = EXCLUDED.editar_documentos,
        excluir_documentos = EXCLUDED.excluir_documentos,
        download_documentos = EXCLUDED.download_documentos,
        compartilhar_documentos = EXCLUDED.compartilhar_documentos,
        criar_templates = EXCLUDED.criar_templates,
        editar_templates = EXCLUDED.editar_templates,
        excluir_templates = EXCLUDED.excluir_templates,
        alimentar_ia = EXCLUDED.alimentar_ia,
        gerenciar_ia = EXCLUDED.gerenciar_ia,
        acesso_total = EXCLUDED.acesso_total;
    END LOOP;
  END IF;
END $$;

-- Reabilita o trigger de audit após a sincronização
CREATE TRIGGER trg_audit_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_permission_change();

-- =============================================================================
-- Row Level Security (RLS) - políticas básicas
-- =============================================================================
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Permissions: usuário pode ler suas próprias permissões
CREATE POLICY "users_read_own_permissions" ON public.permissions
  FOR SELECT USING (auth.uid() = user_id);

-- User_permissions: usuário pode ler suas próprias permissões granulares
CREATE POLICY "users_read_own_user_permissions" ON public.user_permissions
  FOR SELECT USING (auth.uid() = user_id);

-- User_hierarchy: usuário pode ler hierarquia onde é supervisor ou subordinado
CREATE POLICY "users_read_hierarchy" ON public.user_hierarchy
  FOR SELECT USING (auth.uid() = supervisor_id OR auth.uid() = subordinate_id);

-- Project_members: usuário pode ler membros dos projetos em que participa
CREATE POLICY "users_read_project_members" ON public.project_members
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.creator_id = auth.uid())
  );

-- Permissions: escrita feita pelo trigger sync_user_permissions_from_role (SECURITY DEFINER)
