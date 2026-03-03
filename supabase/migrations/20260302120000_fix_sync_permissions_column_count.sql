-- Corrige "INSERT has more target columns than expressions" no sync_user_permissions_from_role
-- O trigger dispara ao inserir em public.users e insere em permissions.
-- Faltava o valor para excluir_templates (21 colunas, 20 valores). Agora 21 colunas e 21 valores.

CREATE OR REPLACE FUNCTION public.sync_user_permissions_from_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  target_id uuid;
BEGIN
  target_id := COALESCE(NEW.id, OLD.id);
  user_role := LOWER(COALESCE(NEW.role, OLD.role, 'operational')::text);

  INSERT INTO public.permissions (
    user_id,
    gerenciar_usuarios,
    gerenciar_grupos,
    criar_projetos,
    editar_projetos,
    excluir_projetos,
    visualizar_todos_projetos,
    visualizar_documentos,
    criar_documentos,
    editar_documentos,
    excluir_documentos,
    download_documentos,
    compartilhar_documentos,
    criar_templates,
    editar_templates,
    excluir_templates,
    assinar_documentos,
    solicitar_assinatura,
    alimentar_ia,
    gerenciar_ia,
    acesso_total
  ) VALUES (
    target_id,
    user_role = 'admin',
    user_role IN ('admin', 'manager', 'technical_responsible'),
    user_role IN ('admin', 'manager', 'technical_responsible'),
    user_role IN ('admin', 'manager', 'technical_responsible'),
    user_role IN ('admin', 'manager'),
    user_role IN ('admin', 'director', 'manager', 'technical_responsible', 'operational'),
    true,
    user_role IN ('admin', 'manager', 'technical_responsible', 'operational'),
    user_role IN ('admin', 'manager', 'technical_responsible', 'operational'),
    user_role IN ('admin', 'manager', 'technical_responsible', 'operational'),
    true,
    user_role IN ('admin', 'manager', 'technical_responsible'),
    user_role IN ('admin', 'manager', 'technical_responsible'),
    user_role IN ('admin', 'manager', 'technical_responsible'),
    user_role IN ('admin', 'manager', 'technical_responsible'),
    false,
    false,
    user_role IN ('admin', 'manager', 'technical_responsible', 'operational'),
    user_role IN ('admin', 'manager'),
    user_role = 'admin'
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
    assinar_documentos = EXCLUDED.assinar_documentos,
    solicitar_assinatura = EXCLUDED.solicitar_assinatura,
    alimentar_ia = EXCLUDED.alimentar_ia,
    gerenciar_ia = EXCLUDED.gerenciar_ia,
    acesso_total = EXCLUDED.acesso_total,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;
