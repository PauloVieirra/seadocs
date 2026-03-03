-- RPC para atualizar permissões, executando com SECURITY DEFINER (bypassa RLS)
-- Evita erro "new row violates row-level security policy"

CREATE OR REPLACE FUNCTION public.update_user_permissions(
  p_user_id uuid,
  p_gerenciar_usuarios boolean DEFAULT NULL,
  p_gerenciar_grupos boolean DEFAULT NULL,
  p_criar_projetos boolean DEFAULT NULL,
  p_editar_projetos boolean DEFAULT NULL,
  p_excluir_projetos boolean DEFAULT NULL,
  p_visualizar_todos_projetos boolean DEFAULT NULL,
  p_visualizar_documentos boolean DEFAULT NULL,
  p_criar_documentos boolean DEFAULT NULL,
  p_editar_documentos boolean DEFAULT NULL,
  p_excluir_documentos boolean DEFAULT NULL,
  p_download_documentos boolean DEFAULT NULL,
  p_compartilhar_documentos boolean DEFAULT NULL,
  p_criar_templates boolean DEFAULT NULL,
  p_editar_templates boolean DEFAULT NULL,
  p_excluir_templates boolean DEFAULT NULL,
  p_assinar_documentos boolean DEFAULT NULL,
  p_solicitar_assinatura boolean DEFAULT NULL,
  p_alimentar_ia boolean DEFAULT NULL,
  p_gerenciar_ia boolean DEFAULT NULL,
  p_acesso_total boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_can_manage_permissions() THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar permissões';
  END IF;

  INSERT INTO public.permissions (
    user_id, gerenciar_usuarios, gerenciar_grupos, criar_projetos, editar_projetos,
    excluir_projetos, visualizar_todos_projetos, visualizar_documentos, criar_documentos,
    editar_documentos, excluir_documentos, download_documentos, compartilhar_documentos,
    criar_templates, editar_templates, excluir_templates, assinar_documentos,
    solicitar_assinatura, alimentar_ia, gerenciar_ia, acesso_total
  ) VALUES (
    p_user_id,
    COALESCE(p_gerenciar_usuarios, false),
    COALESCE(p_gerenciar_grupos, false),
    COALESCE(p_criar_projetos, false),
    COALESCE(p_editar_projetos, false),
    COALESCE(p_excluir_projetos, false),
    COALESCE(p_visualizar_todos_projetos, false),
    COALESCE(p_visualizar_documentos, true),
    COALESCE(p_criar_documentos, false),
    COALESCE(p_editar_documentos, false),
    COALESCE(p_excluir_documentos, false),
    COALESCE(p_download_documentos, true),
    COALESCE(p_compartilhar_documentos, false),
    COALESCE(p_criar_templates, false),
    COALESCE(p_editar_templates, false),
    COALESCE(p_excluir_templates, false),
    COALESCE(p_assinar_documentos, false),
    COALESCE(p_solicitar_assinatura, false),
    COALESCE(p_alimentar_ia, false),
    COALESCE(p_gerenciar_ia, false),
    COALESCE(p_acesso_total, false)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    gerenciar_usuarios = COALESCE(p_gerenciar_usuarios, permissions.gerenciar_usuarios),
    gerenciar_grupos = COALESCE(p_gerenciar_grupos, permissions.gerenciar_grupos),
    criar_projetos = COALESCE(p_criar_projetos, permissions.criar_projetos),
    editar_projetos = COALESCE(p_editar_projetos, permissions.editar_projetos),
    excluir_projetos = COALESCE(p_excluir_projetos, permissions.excluir_projetos),
    visualizar_todos_projetos = COALESCE(p_visualizar_todos_projetos, permissions.visualizar_todos_projetos),
    visualizar_documentos = COALESCE(p_visualizar_documentos, permissions.visualizar_documentos),
    criar_documentos = COALESCE(p_criar_documentos, permissions.criar_documentos),
    editar_documentos = COALESCE(p_editar_documentos, permissions.editar_documentos),
    excluir_documentos = COALESCE(p_excluir_documentos, permissions.excluir_documentos),
    download_documentos = COALESCE(p_download_documentos, permissions.download_documentos),
    compartilhar_documentos = COALESCE(p_compartilhar_documentos, permissions.compartilhar_documentos),
    criar_templates = COALESCE(p_criar_templates, permissions.criar_templates),
    editar_templates = COALESCE(p_editar_templates, permissions.editar_templates),
    excluir_templates = COALESCE(p_excluir_templates, permissions.excluir_templates),
    assinar_documentos = COALESCE(p_assinar_documentos, permissions.assinar_documentos),
    solicitar_assinatura = COALESCE(p_solicitar_assinatura, permissions.solicitar_assinatura),
    alimentar_ia = COALESCE(p_alimentar_ia, permissions.alimentar_ia),
    gerenciar_ia = COALESCE(p_gerenciar_ia, permissions.gerenciar_ia),
    acesso_total = COALESCE(p_acesso_total, permissions.acesso_total);
END;
$$;
