/**
 * Serviço de Permissões RBAC + ABAC
 * Validação de papéis globais, hierarquia e permissões granulares
 */

import { supabase } from './supabase';
import type { User } from './api';

/** Permissões efetivas por usuário (tabela permissions) */
export interface UserPermissions {
  userId: string;
  gerenciar_usuarios: boolean;
  gerenciar_grupos: boolean;
  criar_projetos: boolean;
  editar_projetos: boolean;
  excluir_projetos: boolean;
  visualizar_todos_projetos: boolean;
  visualizar_documentos: boolean;
  criar_documentos: boolean;
  editar_documentos: boolean;
  excluir_documentos: boolean;
  download_documentos: boolean;
  compartilhar_documentos: boolean;
  criar_templates: boolean;
  editar_templates: boolean;
  excluir_templates: boolean;
  assinar_documentos: boolean;
  solicitar_assinatura: boolean;
  alimentar_ia: boolean;
  gerenciar_ia: boolean;
  acesso_total: boolean;
}

/** Códigos de permissões granulares */
export type GranularPermissionCode =
  | 'CREATE_PROJECT'
  | 'EDIT_PROJECT'
  | 'DELETE_PROJECT'
  | 'SHARE_PROJECT'
  | 'USE_AI'
  | 'VIEW_AUDIT_LOG'
  | 'MANAGE_USERS'
  | 'APPROVE_DOCUMENT'
  | 'EDIT_SECTION'
  | 'LOCK_DOCUMENT'
  | 'VIEW_ALL_PROJECTS'
  | 'VIEW_DOCUMENTS'
  | 'CREATE_DOCUMENTS'
  | 'EDIT_DOCUMENTS'
  | 'DELETE_DOCUMENTS'
  | 'DOWNLOAD_DOCUMENTS'
  | 'SHARE_DOCUMENTS'
  | 'MANAGE_TEMPLATES'
  | 'MANAGE_GROUPS'
  | 'CONFIGURE_SYSTEM';

/** Nível de permissão em projeto */
export type ProjectPermissionLevel = 'VIEW' | 'EDIT' | 'ADMIN';

/** Ações que podem ser validadas */
export type PermissionAction =
  | 'gerenciar_usuarios'
  | 'gerenciar_grupos'
  | 'criar_projetos'
  | 'editar_projetos'
  | 'excluir_projetos'
  | 'visualizar_todos_projetos'
  | 'visualizar_documentos'
  | 'criar_documentos'
  | 'editar_documentos'
  | 'excluir_documentos'
  | 'download_documentos'
  | 'compartilhar_documentos'
  | 'criar_templates'
  | 'editar_templates'
  | 'excluir_templates'
  | 'alimentar_ia'
  | 'gerenciar_ia'
  | 'acesso_total';

const DEFAULT_PERMISSIONS: UserPermissions = {
  userId: '',
  gerenciar_usuarios: false,
  gerenciar_grupos: false,
  criar_projetos: false,
  editar_projetos: false,
  excluir_projetos: false,
  visualizar_todos_projetos: false,
  visualizar_documentos: true,
  criar_documentos: false,
  editar_documentos: false,
  excluir_documentos: false,
  download_documentos: true,
  compartilhar_documentos: false,
  criar_templates: false,
  editar_templates: false,
  excluir_templates: false,
  assinar_documentos: false,
  solicitar_assinatura: false,
  alimentar_ia: false,
  gerenciar_ia: false,
  acesso_total: false,
};

/** Permissões por papel (fallback quando tabela permissions não existe) */
const ROLE_PERMISSIONS: Record<User['role'], Partial<UserPermissions>> = {
  admin: {
    ...DEFAULT_PERMISSIONS,
    gerenciar_usuarios: true,
    gerenciar_grupos: true,
    criar_projetos: true,
    editar_projetos: true,
    excluir_projetos: true,
    visualizar_todos_projetos: true,
    visualizar_documentos: true,
    criar_documentos: true,
    editar_documentos: true,
    excluir_documentos: true,
    download_documentos: true,
    compartilhar_documentos: true,
    criar_templates: true,
    editar_templates: true,
    excluir_templates: true,
    alimentar_ia: true,
    gerenciar_ia: true,
    acesso_total: true,
  },
  director: {
    ...DEFAULT_PERMISSIONS,
    visualizar_todos_projetos: true,
    visualizar_documentos: true,
    download_documentos: true,
    alimentar_ia: false,
  },
  manager: {
    ...DEFAULT_PERMISSIONS,
    gerenciar_usuarios: true,
    gerenciar_grupos: true,
    criar_projetos: true,
    editar_projetos: true,
    excluir_projetos: true,
    visualizar_todos_projetos: true,
    visualizar_documentos: true,
    criar_documentos: true,
    editar_documentos: true,
    excluir_documentos: true,
    download_documentos: true,
    compartilhar_documentos: true,
    criar_templates: true,
    editar_templates: true,
    excluir_templates: true,
    alimentar_ia: true,
    gerenciar_ia: true,
  },
  technical_responsible: {
    ...DEFAULT_PERMISSIONS,
    gerenciar_usuarios: true,
    gerenciar_grupos: true,
    criar_projetos: true,
    editar_projetos: true,
    visualizar_todos_projetos: true,
    visualizar_documentos: true,
    criar_documentos: true,
    editar_documentos: true,
    download_documentos: true,
    compartilhar_documentos: true,
    alimentar_ia: true,
  },
  operational: {
    ...DEFAULT_PERMISSIONS,
    visualizar_documentos: true,
    criar_documentos: true,
    editar_documentos: true,
    download_documentos: true,
    alimentar_ia: false,
  },
  user: { ...DEFAULT_PERMISSIONS },
  external: { ...DEFAULT_PERMISSIONS },
};

class PermissionsService {
  private cache: Map<string, { perms: UserPermissions; fetchedAt: number }> = new Map();
  private cacheTtlMs = 10_000; // 10 segundos - permissões atualizadas pelo admin devem refletir em breve

  /** Carrega permissões efetivas do usuário (tabela permissions ou fallback por role) */
  async getUserPermissions(user: User, skipCache = false): Promise<UserPermissions> {
    if (!skipCache) {
      const cached = this.cache.get(user.id);
      if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
        return cached.perms;
      }
    }

    if (!supabase) {
      return this.getFallbackPermissions(user);
    }

    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return this.getFallbackPermissions(user);
    }
    if (!data) {
      return this.getFallbackPermissions(user);
    }

    const perms: UserPermissions = {
      userId: data.user_id,
      gerenciar_usuarios: data.gerenciar_usuarios ?? false,
      gerenciar_grupos: data.gerenciar_grupos ?? false,
      criar_projetos: data.criar_projetos ?? false,
      editar_projetos: data.editar_projetos ?? false,
      excluir_projetos: data.excluir_projetos ?? false,
      visualizar_todos_projetos: data.visualizar_todos_projetos ?? false,
      visualizar_documentos: data.visualizar_documentos ?? true,
      criar_documentos: data.criar_documentos ?? false,
      editar_documentos: data.editar_documentos ?? false,
      excluir_documentos: data.excluir_documentos ?? false,
      download_documentos: data.download_documentos ?? true,
      compartilhar_documentos: data.compartilhar_documentos ?? false,
      criar_templates: data.criar_templates ?? false,
      editar_templates: data.editar_templates ?? false,
      excluir_templates: data.excluir_templates ?? false,
      assinar_documentos: data.assinar_documentos ?? false,
      solicitar_assinatura: data.solicitar_assinatura ?? false,
      alimentar_ia: data.alimentar_ia ?? false,
      gerenciar_ia: data.gerenciar_ia ?? false,
      acesso_total: data.acesso_total ?? false,
    };

    this.cache.set(user.id, { perms, fetchedAt: Date.now() });
    return perms;
  }

  private getFallbackPermissions(user: User): UserPermissions {
    const rolePerms = ROLE_PERMISSIONS[user.role] ?? ROLE_PERMISSIONS.operational;
    return { ...DEFAULT_PERMISSIONS, ...rolePerms, userId: user.id };
  }

  /** Verifica se o usuário tem permissão para uma ação global */
  async can(user: User, action: PermissionAction, skipCache = false): Promise<boolean> {
    const perms = await this.getUserPermissions(user, skipCache);

    if (perms.acesso_total) return true;

    const value = perms[action];
    return value === true;
  }

  /** Verifica permissão de forma síncrona usando cache (para UI) */
  canSync(user: User | null, action: PermissionAction): boolean {
    if (!user) return false;
    const cached = this.cache.get(user.id);
    if (cached) {
      if (cached.perms.acesso_total) return true;
      return cached.perms[action] === true;
    }
    const fallback = this.getFallbackPermissions(user);
    if (fallback.acesso_total) return true;
    return fallback[action] === true;
  }

  /** Verifica se usuário pode promover outro para um papel (regra: nunca acima do próprio nível) */
  canAssignRole(actor: User, targetRole: User['role']): boolean {
    const hierarchy: Record<string, number> = {
      admin: 5,
      director: 4,
      manager: 3,
      technical_responsible: 2,
      operational: 1,
      user: 0,
      external: 0,
    };
    const actorLevel = hierarchy[actor.role] ?? 0;
    const targetLevel = hierarchy[targetRole] ?? 0;
    if (targetRole === 'admin') return actor.role === 'admin';
    return actorLevel > targetLevel;
  }

  /** Verifica se o usuário é supervisor do alvo na hierarquia */
  async isSupervisorOf(supervisorId: string, subordinateId: string): Promise<boolean> {
    if (!supabase || supervisorId === subordinateId) return false;
    const { data } = await supabase
      .from('user_hierarchy')
      .select('id')
      .eq('supervisor_id', supervisorId)
      .eq('subordinate_id', subordinateId)
      .limit(1)
      .maybeSingle();
    return !!data;
  }

  /** Obtém nível de permissão do usuário no projeto */
  async getProjectPermission(userId: string, projectId: string): Promise<ProjectPermissionLevel | null> {
    if (!supabase) return null;
    const { data } = await supabase
      .from('project_members')
      .select('permission_level')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();
    return data?.permission_level ?? null;
  }

  /** Verifica se usuário pode executar ação no projeto (considera permissão global + projeto) */
  async canInProject(
    user: User,
    projectId: string,
    action: 'view' | 'edit' | 'admin'
  ): Promise<boolean> {
    const perms = await this.getUserPermissions(user);
    if (perms.acesso_total) return true;

    const projectLevel = await this.getProjectPermission(user.id, projectId);

    if (action === 'view') {
      if (perms.visualizar_todos_projetos) return true;
      return projectLevel !== null;
    }
    if (action === 'edit') {
      if (!perms.editar_projetos) return false;
      return projectLevel === 'EDIT' || projectLevel === 'ADMIN' || perms.visualizar_todos_projetos;
    }
    if (action === 'admin') {
      if (!perms.gerenciar_usuarios && !perms.editar_projetos) return false;
      return projectLevel === 'ADMIN' || perms.acesso_total;
    }
    return false;
  }

  /** Invalida cache (chamar após alterar permissões) */
  invalidateCache(userId?: string): void {
    if (userId) this.cache.delete(userId);
    else this.cache.clear();
  }

  /** Atualiza permissões de um usuário via RPC (bypassa RLS) */
  async updateUserPermissions(
    userId: string,
    perms: Partial<Omit<UserPermissions, 'userId'>>
  ): Promise<void> {
    if (!supabase) throw new Error('Supabase não configurado');

    const { error } = await supabase.rpc('update_user_permissions', {
      p_user_id: userId,
      p_gerenciar_usuarios: perms.gerenciar_usuarios,
      p_gerenciar_grupos: perms.gerenciar_grupos,
      p_criar_projetos: perms.criar_projetos,
      p_editar_projetos: perms.editar_projetos,
      p_excluir_projetos: perms.excluir_projetos,
      p_visualizar_todos_projetos: perms.visualizar_todos_projetos,
      p_visualizar_documentos: perms.visualizar_documentos,
      p_criar_documentos: perms.criar_documentos,
      p_editar_documentos: perms.editar_documentos,
      p_excluir_documentos: perms.excluir_documentos,
      p_download_documentos: perms.download_documentos,
      p_compartilhar_documentos: perms.compartilhar_documentos,
      p_criar_templates: perms.criar_templates,
      p_editar_templates: perms.editar_templates,
      p_excluir_templates: perms.excluir_templates,
      p_assinar_documentos: perms.assinar_documentos,
      p_solicitar_assinatura: perms.solicitar_assinatura,
      p_alimentar_ia: perms.alimentar_ia,
      p_gerenciar_ia: perms.gerenciar_ia,
      p_acesso_total: perms.acesso_total,
    });

    if (error) throw new Error(error.message);
    this.invalidateCache(userId);
  }
}

export const permissionsService = new PermissionsService();
