-- Corrige o trigger log_permission_change para incluir a coluna entidade (obrigatória em audit_logs)

CREATE OR REPLACE FUNCTION public.log_permission_change()
RETURNS TRIGGER AS $$
DECLARE
  log_details jsonb;
  target_user_id uuid;
  action_text text;
  entity_name text;
BEGIN
  entity_name := TG_TABLE_NAME;

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
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'entidade') THEN
      INSERT INTO public.audit_logs (entidade, entidade_id, acao, user_id, detalhes)
      VALUES (entity_name, target_user_id, action_text, auth.uid(), log_details);
    ELSE
      INSERT INTO public.audit_logs (entidade_id, acao, user_id, detalhes)
      VALUES (target_user_id, action_text, auth.uid(), log_details);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
