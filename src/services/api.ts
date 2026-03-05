// API Service - Supabase + IndexedDB para rascunhos locais

import { manusAPIService, type ManusConfig } from './manus-api';
import { indexDocumentInRAG, deleteDocumentFromRAG, chatWithRAG } from './rag-api';
import { supabase } from './supabase';
import * as localDb from './local-db';
import { permissionsService } from './permissions';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'sqlserver';
}

export interface AIConfig {
  apiKey: string;
  provider?: 'openai' | 'anthropic' | 'manus' | 'custom';
}

export { type ManusConfig } from './manus-api';

export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  role: 'admin' | 'director' | 'manager' | 'technical_responsible' | 'operational' | 'external';
  managerId?: string;
  createdAt: string;
  updatedAt?: string;
  isActive?: boolean;
  forcePasswordChange?: boolean;
}

/** Mapeamento role (código) -> tipo (label para coluna tipo na tabela users) */
const ROLE_TO_TIPO: Record<User['role'], string> = {
  admin: 'Administrador',
  director: 'Diretor',
  manager: 'Gerente',
  technical_responsible: 'Responsável Técnico',
  operational: 'Operacional',
  external: 'Usuário Externo',
};

/** Mapeamento tipo (label) -> role (código) para leitura do banco */
const TIPO_TO_ROLE: Record<string, User['role']> = {
  Administrador: 'admin',
  Diretor: 'director',
  Gerente: 'manager',
  'Responsável Técnico': 'technical_responsible',
  Operacional: 'operational',
  'Usuário Externo': 'external',
  EXTERNO: 'external', // compatibilidade com valores antigos
};

function parseRoleFromDb(tipo: string | null | undefined, role: string | null | undefined): User['role'] {
  const validRoles = ['admin', 'director', 'manager', 'technical_responsible', 'operational', 'external'] as const;
  const roleLower = role?.toLowerCase();
  if (roleLower && validRoles.includes(roleLower)) return roleLower as User['role'];
  if (tipo && TIPO_TO_ROLE[tipo]) return TIPO_TO_ROLE[tipo];
  const tipoLower = tipo?.toLowerCase();
  if (tipoLower && validRoles.includes(tipoLower)) return tipoLower as User['role'];
  return 'operational';
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  memberIds: string[];
  responsibleId?: string;
  projectIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  content: DocumentContent;
  updatedAt: string;
  updatedBy: string;
}

export interface Document {
  id: string;
  projectId: string;
  name: string;
  groupId?: string;
  securityLevel: 'public' | 'restricted' | 'confidential' | 'secret';
  templateId?: string;
  creatorId: string;
  creatorName: string;
  currentVersionId: string;
  sharedWith?: { userId: string; permissions: ('view' | 'edit' | 'comment')[] }[];
  createdAt: string;
  updatedAt: string;
  content?: DocumentContent;
  version?: number;
  updatedBy?: string;
}

export interface DocumentContent {
  sections: DocumentSection[];
  /** Instruções para a IA sobre o tipo de documento (vem do modelo) */
  aiGuidance?: string;
}

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
  isEditable: boolean;
  /** Texto de ajuda/instrução para a IA (vem do modelo) */
  helpText?: string;
}

export interface UploadedFile {
  id: string;
  projectId: string;
  name: string;
  type: 'pdf' | 'doc' | 'docx' | 'txt' | 'audio' | 'other';
  size: number;
  status: 'processing' | 'processed' | 'error' | 'pending';
  uploadedBy: string;
  uploadedAt: string;
  isDataSource?: boolean;
  fileUrl?: string;
  chunkCount?: number;
  filePath?: string;
}

export interface AuditLog {
  id: string;
  projectId: string;
  action: string;
  userId: string;
  userName: string;
  details: string;
  timestamp: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  creatorId: string;
  creatorName: string;
  status: 'draft' | 'published' | 'archived' | 'in-progress' | 'review' | 'approved';
  /** true = publicado (visível), false = arquivado (visível apenas a admins) */
  estado: boolean;
  createdAt: string;
  updatedAt: string;
  responsibleIds?: string[];
  groupIds?: string[];
  documentIds: string[];
}

export interface DocumentModel {
  id: string;
  name: string;
  type: string;
  templateContent: string;
  isGlobal: boolean;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  isDraft?: boolean;
  aiGuidance?: string;
  isLocalDraft?: boolean;
}

class APIService {
  private dbConfig: DatabaseConfig | null = null;
  private aiConfig: AIConfig | null = null;
  private currentUser: User | null = null;
  private listeners: Set<{ event: string; callback: Function }> = new Set();
  private inMemoryLocks: Map<string, { userId: string; userName: string; timestamp: string }> = new Map();

  public isUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  constructor() {
    this.loadConfigFromIndexedDB();
  }

  private async loadConfigFromIndexedDB(): Promise<void> {
    try {
      this.dbConfig = await localDb.getConfig<DatabaseConfig>('db_config');
      this.aiConfig = await localDb.getConfig<AIConfig>('ai_config');
      const user = await localDb.getSession<User>('current_user');
      if (user) this.currentUser = user;
    } catch (e) {
      console.warn('[APIService] Erro ao carregar config do IndexedDB:', e);
    }
  }

  // Configurações (IndexedDB)
  async configurarBancoDeDados(config: DatabaseConfig): Promise<boolean> {
    this.dbConfig = config;
    await localDb.saveConfig('db_config', config);
    return true;
  }

  async getConfiguracao(): Promise<DatabaseConfig | null> {
    if (this.dbConfig) return this.dbConfig;
    this.dbConfig = await localDb.getConfig<DatabaseConfig>('db_config');
    return this.dbConfig;
  }

  async configurarIA(config: AIConfig): Promise<boolean> {
    this.aiConfig = config;
    await localDb.saveConfig('ai_config', config);
    return true;
  }

  async getAIConfiguracao(): Promise<AIConfig | null> {
    if (this.aiConfig) return this.aiConfig;
    this.aiConfig = await localDb.getConfig<AIConfig>('ai_config');
    return this.aiConfig;
  }

  async resetToDefaults(): Promise<void> {
    await localDb.clearSession();
    await localDb.clearAllModelDrafts();
    this.currentUser = null;
    window.location.reload();
  }

  // Autenticação (apenas Supabase)
  async login(email: string, password: string): Promise<User | null> {
    if (!supabase) return null;
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !authData.user) return null;
    const { data: userData } = await supabase.from('users').select('*').eq('email', email).single();
    const user: User = {
      id: authData.user.id,
      email: authData.user.email!,
      name: userData?.nome || authData.user.user_metadata?.name || email.split('@')[0],
      password: '',
      role: parseRoleFromDb(userData?.tipo, userData?.role) || (authData.user.user_metadata?.role as User['role']) || 'operational',
      createdAt: authData.user.created_at,
      isActive: userData?.status !== 'INATIVO',
      forcePasswordChange: userData?.force_password_change === true
    };
    this.currentUser = user;
    await localDb.saveSession('current_user', user);
    void permissionsService.getUserPermissions(user); // Pré-carrega cache
    return user;
  }

  async register(email: string, password: string, name: string, role: User['role'] = 'operational'): Promise<User | null> {
    if (!supabase) throw new Error('Supabase não configurado');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current) throw new Error('É necessário estar autenticado para criar usuários');
    if (!(await permissionsService.can(current, 'gerenciar_usuarios'))) {
      throw new Error('Sem permissão para cadastrar usuários');
    }

    // Garante que a sessão está ativa (necessária para o header Authorization na Edge Function)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    // Usa Edge Function admin-create-user (auth.admin.createUser) para evitar 500 do signup
    const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-create-user', {
      body: { email, password, name, role },
    });

    if (!fnError && fnData?.id) {
      return {
        id: fnData.id,
        email: fnData.email ?? email,
        name: fnData.name ?? name,
        password: '',
        role: (fnData.role as User['role']) ?? role,
        createdAt: fnData.createdAt ?? new Date().toISOString(),
        isActive: true,
      };
    }

    let errMsg = 'Erro ao criar usuário';
    const dataError = (fnData as { error?: string })?.error;
    if (typeof dataError === 'string') errMsg = dataError;
    else if (fnError) {
      errMsg = fnError.message;
      const errAny = fnError as { context?: { json?: () => Promise<{ error?: string }> } };
      if (errAny.context?.json) {
        try {
          const body = await errAny.context.json();
          if (body?.error) errMsg = body.error;
        } catch {
          /* ignorar */
        }
      }
    }
    throw new Error(errMsg);

    // Fallback: signUp direto (pode falhar com 500 se trigger existir)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role } },
    });
    if (authError || !authData.user) throw new Error(authError?.message || 'Erro ao criar conta');
    const tipo = ROLE_TO_TIPO[role] ?? 'Operacional';
    const { error: insertError } = await supabase.from('users').upsert(
      { id: authData.user.id, email, nome: name, role, tipo, status: 'ATIVO' },
      { onConflict: 'id' }
    );
    if (insertError) throw new Error(insertError.message);
    return {
      id: authData.user.id,
      email,
      name,
      password: '',
      role,
      createdAt: authData.user.created_at,
      isActive: true,
    };
  }

  logout(): void {
    supabase?.auth.signOut();
    this.currentUser = null;
    void localDb.removeSession('current_user');
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  async loadCurrentUserFromStorage(): Promise<User | null> {
    const user = await localDb.getSession<User>('current_user');
    if (user) this.currentUser = user;
    return this.currentUser;
  }

  async updateUser(updatedUser: User): Promise<User> {
    if (!supabase || !this.isUUID(updatedUser.id)) throw new Error('Usuário inválido');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    const existing = await this.getUser(updatedUser.id);
    if (!existing) throw new Error('Usuário não encontrado');
    if (existing.role === 'external' && updatedUser.role !== 'external') {
      throw new Error('Usuário externo não pode ser promovido a outro tipo. Sua role não pode ser modificada.');
    }
    const isEditingSelf = current?.id === updatedUser.id;
    if (isEditingSelf && updatedUser.role !== existing.role) {
      throw new Error('Não é permitido alterar o próprio papel');
    }
    if (!isEditingSelf) {
      if (updatedUser.role !== existing.role && (!current || !permissionsService.canAssignRole(current, updatedUser.role))) {
        throw new Error('Sem permissão para atribuir este papel');
      }
      if (!current || !(await permissionsService.can(current, 'gerenciar_usuarios'))) {
        throw new Error('Sem permissão para editar usuários');
      }
    }
    const { error } = await supabase
      .from('users')
      .update({ nome: updatedUser.name, role: updatedUser.role, tipo: ROLE_TO_TIPO[updatedUser.role] })
      .eq('id', updatedUser.id);
    if (error) throw new Error(error.message);
    permissionsService.invalidateCache(updatedUser.id);
    return updatedUser;
  }

  async deleteUser(userId: string): Promise<boolean> {
    if (!supabase || !this.isUUID(userId)) return false;
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'gerenciar_usuarios'))) {
      throw new Error('Sem permissão para excluir usuários');
    }
    const { error } = await supabase.from('users').delete().eq('id', userId);
    return !error;
  }

  async updateUserPermissions(
    userId: string,
    perms: Partial<import('./permissions').UserPermissions>
  ): Promise<void> {
    if (!this.isUUID(userId)) throw new Error('Usuário inválido');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'gerenciar_usuarios'))) {
      throw new Error('Sem permissão para gerenciar permissões');
    }
    await permissionsService.updateUserPermissions(userId, perms);
  }

  async getUser(id: string): Promise<User | null> {
    if (!supabase || !this.isUUID(id)) return null;
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error || !data) return null;
    return {
      id: data.id,
      email: data.email,
      name: data.nome || data.name,
      password: '',
      role: parseRoleFromDb(data.tipo, data.role),
      createdAt: data.created_at,
      isActive: data.status !== 'INATIVO',
      forcePasswordChange: data.force_password_change === true
    };
  }

  async getAllUsers(): Promise<User[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('users').select('*');
    if (error || !data) return [];
    return data.map(u => ({
      id: u.id,
      email: u.email,
      name: u.nome || u.name,
      password: '',
      role: parseRoleFromDb(u.tipo, u.role),
      createdAt: u.created_at,
      isActive: u.status !== 'INATIVO',
      forcePasswordChange: u.force_password_change === true
    }));
  }

  async updateUserPassword(userId: string, newPassword: string, forcePasswordChange?: boolean): Promise<User> {
    const shouldForceChange = forcePasswordChange === true;
    if (!supabase || !this.isUUID(userId)) throw new Error('Usuário inválido');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());

    if (current?.id === userId) {
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) throw new Error(authError.message);
      const { error: updateError } = await supabase
        .from('users')
        .update({ force_password_change: shouldForceChange })
        .eq('id', userId);
      if (updateError) throw new Error(updateError.message);
      this.currentUser = this.currentUser ? { ...this.currentUser, forcePasswordChange: shouldForceChange } : null;
      void localDb.saveSession('current_user', this.currentUser);
      return this.currentUser!;
    }

    const { data, error } = await supabase.functions.invoke('admin-reset-password', {
      body: { userId, newPassword, forcePasswordChange: shouldForceChange },
    });
    if (error) throw new Error(error.message || 'Erro ao resetar senha');
    if (data?.error) throw new Error(data.error);
    const userData = await supabase.from('users').select('*').eq('id', userId).single();
    const d = userData.data;
    return d ? {
      id: d.id,
      email: d.email,
      name: d.nome || d.name,
      password: '',
      role: parseRoleFromDb(d.tipo, d.role),
      createdAt: d.created_at,
      isActive: d.status !== 'INATIVO',
      forcePasswordChange: d.force_password_change === true,
    } : { id: userId, email: '', name: '', password: '', role: 'operational', createdAt: '', forcePasswordChange: shouldForceChange };
  }

  async getTotalUsersCount(): Promise<number> {
    const users = await this.getAllUsers();
    return users.length;
  }

  // Project members (permissões por projeto)
  async addProjectMember(projectId: string, userId: string, permissionLevel: 'VIEW' | 'EDIT' | 'ADMIN'): Promise<void> {
    if (!supabase || !this.isUUID(projectId) || !this.isUUID(userId)) throw new Error('IDs inválidos');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'editar_projetos'))) {
      throw new Error('Sem permissão para gerenciar membros do projeto');
    }
    const { error } = await supabase.from('project_members').upsert(
      { project_id: projectId, user_id: userId, permission_level: permissionLevel, updated_at: new Date().toISOString() },
      { onConflict: 'project_id,user_id' }
    );
    if (error) throw new Error(error.message);
  }

  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    if (!supabase || !this.isUUID(projectId) || !this.isUUID(userId)) throw new Error('IDs inválidos');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'editar_projetos'))) {
      throw new Error('Sem permissão para gerenciar membros do projeto');
    }
    const { error } = await supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId);
    if (error) throw new Error(error.message);
  }

  async getProjectMembers(projectId: string): Promise<{ userId: string; permissionLevel: string }[]> {
    if (!supabase || !this.isUUID(projectId)) return [];
    const { data } = await supabase.from('project_members').select('user_id, permission_level').eq('project_id', projectId);
    return (data || []).map((r) => ({ userId: r.user_id, permissionLevel: r.permission_level }));
  }

  // Hierarquia (supervisor-subordinado)
  async addSupervisorSubordinate(supervisorId: string, subordinateId: string): Promise<void> {
    if (!supabase || !this.isUUID(supervisorId) || !this.isUUID(subordinateId)) throw new Error('IDs inválidos');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'gerenciar_usuarios'))) {
      throw new Error('Sem permissão para gerenciar hierarquia');
    }
    const { error } = await supabase.from('user_hierarchy').insert({ supervisor_id: supervisorId, subordinate_id: subordinateId });
    if (error) throw new Error(error.message);
  }

  async removeSupervisorSubordinate(supervisorId: string, subordinateId: string): Promise<void> {
    if (!supabase || !this.isUUID(supervisorId) || !this.isUUID(subordinateId)) throw new Error('IDs inválidos');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'gerenciar_usuarios'))) {
      throw new Error('Sem permissão para gerenciar hierarquia');
    }
    const { error } = await supabase.from('user_hierarchy').delete().eq('supervisor_id', supervisorId).eq('subordinate_id', subordinateId);
    if (error) throw new Error(error.message);
  }

  // Permissões granulares (user_permissions)
  async grantUserPermission(userId: string, permissionCode: string, expiresAt?: string, grantedBy?: string): Promise<void> {
    if (!supabase || !this.isUUID(userId)) throw new Error('Usuário inválido');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'gerenciar_usuarios'))) {
      throw new Error('Sem permissão para conceder permissões granulares');
    }
    const { data: permDef } = await supabase.from('permission_definitions').select('id').eq('code', permissionCode).single();
    if (!permDef) throw new Error('Permissão não encontrada');
    const { error } = await supabase.from('user_permissions').insert({
      user_id: userId,
      permission_id: permDef.id,
      granted_by: grantedBy || current.id,
      expires_at: expiresAt || null,
      granted: true,
    });
    if (error) throw new Error(error.message);
    permissionsService.invalidateCache(userId);
  }

  async revokeUserPermission(userId: string, permissionCode: string): Promise<void> {
    if (!supabase || !this.isUUID(userId)) throw new Error('Usuário inválido');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'gerenciar_usuarios'))) {
      throw new Error('Sem permissão para revogar permissões granulares');
    }
    const { data: permDef } = await supabase.from('permission_definitions').select('id').eq('code', permissionCode).single();
    if (!permDef) throw new Error('Permissão não encontrada');
    const { error } = await supabase.from('user_permissions').delete().eq('user_id', userId).eq('permission_id', permDef.id);
    if (error) throw new Error(error.message);
    permissionsService.invalidateCache(userId);
  }

  // Realtime
  subscribeToDocuments(projectId: string | null, callback: () => void) {
    const channel = supabase?.channel('public:documents').on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => callback()).subscribe();
    return { unsubscribe: () => { if (channel) supabase?.removeChannel(channel); } };
  }

  subscribeToDocument(documentId: string, callback: (doc: Document) => void) {
    const channel = supabase?.channel(`doc:${documentId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${documentId}` }, (payload) => callback(payload.new as any)).subscribe();
    return { unsubscribe: () => { if (channel) supabase?.removeChannel(channel); } };
  }

  subscribeToDocumentModels(callback: () => void) {
    const channel = supabase?.channel('public:templates').on('postgres_changes', { event: '*', schema: 'public', table: 'templates' }, () => callback()).subscribe();
    return { unsubscribe: () => { if (channel) supabase?.removeChannel(channel); } };
  }

  // Projetos
  async getProjects(): Promise<Project[]> {
    if (!supabase) return [];
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    const { data, error } = await supabase.from('projects').select('*');
    if (error || !data) return [];
    let projects = data.map(p => ({
      id: p.id,
      name: p.name || 'Sem nome',
      description: p.description || '',
      creatorId: p.creator_id,
      creatorName: 'Usuário',
      status: (p.status?.toLowerCase() || 'draft') as Project['status'],
      estado: p.estado !== false,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      responsibleIds: p.responsible_ids?.length ? p.responsible_ids : (p.responsible_id ? [p.responsible_id] : []),
      groupIds: p.group_ids || [],
      documentIds: []
    }));
    const isAdmin = current && (await permissionsService.can(current, 'acesso_total'));
    const canViewAll = current && (await permissionsService.can(current, 'visualizar_todos_projetos'));
    if (!isAdmin) {
      projects = projects.filter(p => p.estado !== false);
    }
    if (!current) return [];
    if (isAdmin || canViewAll) return projects;
    const { data: memberships } = await supabase.from('project_members').select('project_id').eq('user_id', current.id);
    const memberProjectIds = new Set((memberships || []).map((m: { project_id: string }) => m.project_id));
    const { data: userGroups } = await supabase.from('group_members').select('group_id').eq('user_id', current.id);
    const userGroupIds = new Set((userGroups || []).map((g: { group_id: string }) => g.group_id));
    projects = projects.filter(p =>
      p.creatorId === current.id ||
      memberProjectIds.has(p.id) ||
      (p.responsibleIds?.includes(current.id) ?? false) ||
      (p.groupIds?.length && p.groupIds.some((gid: string) => userGroupIds.has(gid)))
    );
    return projects;
  }

  async getProject(projectId: string): Promise<Project | null> {
    if (!supabase || !this.isUUID(projectId)) return null;
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (error || !data) return null;
    const estado = data.estado !== false;
    const isAdmin = current && (await permissionsService.can(current, 'acesso_total'));
    const canViewAll = current && (await permissionsService.can(current, 'visualizar_todos_projetos'));
    if (!estado && !isAdmin) return null;
    if (!current) return null;
    if (!isAdmin && !canViewAll) {
      const isCreator = data.creator_id === current.id;
      const respIds = data.responsible_ids?.length ? data.responsible_ids : (data.responsible_id ? [data.responsible_id] : []);
      const isResponsible = respIds.includes(current.id);
      const { data: mem } = await supabase.from('project_members').select('user_id').eq('project_id', projectId).eq('user_id', current.id).single();
      const isMember = !!mem;
      const projectGroupIds = data.group_ids || [];
      const { data: userGroups } = await supabase.from('group_members').select('group_id').eq('user_id', current.id);
      const userGroupIds = new Set((userGroups || []).map((g: { group_id: string }) => g.group_id));
      const isInProjectGroup = projectGroupIds.length > 0 && projectGroupIds.some((gid: string) => userGroupIds.has(gid));
      if (!isCreator && !isResponsible && !isMember && !isInProjectGroup) return null;
    }
    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      creatorId: data.creator_id,
      creatorName: 'Usuário',
      status: (data.status?.toLowerCase() || 'draft') as Project['status'],
      estado,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      responsibleIds: data.responsible_ids?.length ? data.responsible_ids : (data.responsible_id ? [data.responsible_id] : []),
      groupIds: data.group_ids || [],
      documentIds: []
    };
  }

  async createProject(name: string, description?: string, responsibleIds?: string[], groupIds?: string[]): Promise<Project> {
    if (!this.currentUser) await this.loadCurrentUserFromStorage();
    if (!supabase || !this.currentUser || !this.isUUID(this.currentUser.id)) {
      throw new Error('Usuário não identificado. Por favor, faça login novamente.');
    }
    if (!(await permissionsService.can(this.currentUser, 'criar_projetos'))) {
      throw new Error('Sem permissão para criar projetos');
    }
    const projectToInsert: Record<string, unknown> = {
      name,
      description: description || '',
      status: 'published',
      estado: true,
      creator_id: this.currentUser.id,
      responsible_id: (responsibleIds?.length && this.isUUID(responsibleIds[0])) ? responsibleIds[0] : this.currentUser.id,
      responsible_ids: (responsibleIds?.filter(id => this.isUUID(id))) || [this.currentUser.id],
      group_ids: (groupIds?.filter(id => this.isUUID(id))) || []
    };
    const { data, error } = await supabase.from('projects').insert(projectToInsert).select().single();
    if (error) throw new Error(`Erro ao salvar projeto: ${error.message}`);
    return {
      id: data.id,
      name: data.name || name,
      description: data.description || description || '',
      creatorId: data.creator_id || this.currentUser.id,
      creatorName: this.currentUser.name,
      status: (data.status?.toLowerCase() || 'published') as Project['status'],
      estado: data.estado !== false,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      responsibleIds: data.responsible_ids?.length ? data.responsible_ids : (data.responsible_id ? [data.responsible_id] : []),
      groupIds: data.group_ids || [],
      documentIds: []
    };
  }

  async updateProject(updatedProject: Project): Promise<Project> {
    if (!supabase || !this.isUUID(updatedProject.id)) throw new Error('Projeto inválido');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'editar_projetos'))) {
      throw new Error('Sem permissão para editar projetos');
    }
    const updateData: Record<string, unknown> = {
      name: updatedProject.name,
      description: updatedProject.description,
      status: updatedProject.status
    };
    if (updatedProject.responsibleIds?.length) updateData.responsible_ids = updatedProject.responsibleIds.filter(id => this.isUUID(id));
    if (updatedProject.groupIds?.length) updateData.group_ids = updatedProject.groupIds.filter(id => this.isUUID(id));
    const { error } = await supabase.from('projects').update(updateData).eq('id', updatedProject.id);
    if (error) throw new Error(error.message);
    return updatedProject;
  }

  async deleteProject(projectId: string): Promise<void> {
    if (!supabase || !this.isUUID(projectId)) throw new Error('Projeto inválido');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'excluir_projetos'))) {
      throw new Error('Sem permissão para excluir projetos');
    }
    // Excluir dependências antes do projeto (evita erro de FK)
    try {
      const docs = await this.listProjectDocuments(projectId);
      for (const doc of docs) {
        const { error: docErr } = await supabase.from('documents').delete().eq('id', doc.id);
        if (docErr) console.warn('[deleteProject] documentos:', docErr.message);
      }
      const files = await this.getProjectFiles(projectId);
      for (const f of files) {
        const { data } = await supabase.from('project_materials').select('file_path').eq('id', f.id).single();
        if (data?.file_path) await supabase.storage.from('Documentos').remove([data.file_path]);
      }
      const { error: pmErr } = await supabase.from('project_materials').delete().eq('project_id', projectId);
      if (pmErr) console.warn('[deleteProject] project_materials:', pmErr.message);
      const { error: membErr } = await supabase.from('project_members').delete().eq('project_id', projectId);
      if (membErr) console.warn('[deleteProject] project_members:', membErr.message);
      await supabase.from('audit_logs').delete().eq('entidade_id', projectId);
      await supabase.from('groups').update({ project_id: null }).eq('project_id', projectId);
      await supabase.from('templates').update({ project_id: null }).eq('project_id', projectId);
    } catch (e) {
      console.warn('[deleteProject] dependências:', e);
    }
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw new Error(`Erro ao excluir projeto: ${error.message}`);
  }

  async publishProject(projectId: string): Promise<Project> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error('Projeto não encontrado');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current) throw new Error('Usuário não identificado');
    const isArchived = project.estado === false;
    if (isArchived && !(await permissionsService.can(current, 'acesso_total'))) {
      throw new Error('Apenas administradores podem republicar projetos arquivados');
    }
    const updatePayload: Record<string, unknown> = { estado: true, updated_at: new Date().toISOString() };
    if (project.status === 'draft') updatePayload.status = 'published';
    const { error } = await supabase!.from('projects').update(updatePayload).eq('id', projectId);
    if (error) throw new Error(error.message);
    return this.getProject(projectId) as Promise<Project>;
  }

  async archiveProject(projectId: string): Promise<Project> {
    if (!supabase || !this.isUUID(projectId)) throw new Error('Projeto inválido');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'acesso_total'))) {
      throw new Error('Apenas administradores podem arquivar projetos');
    }
    const { data: existing, error: fetchErr } = await supabase.from('projects').select('id, estado').eq('id', projectId).single();
    if (fetchErr || !existing) throw new Error('Projeto não encontrado');
    if (existing.estado === false) throw new Error('Projeto já está arquivado');
    const { error } = await supabase.from('projects').update({ estado: false, updated_at: new Date().toISOString() }).eq('id', projectId);
    if (error) throw new Error(`Erro ao arquivar: ${error.message}`);
    const updated = await this.getProject(projectId);
    if (!updated) throw new Error('Projeto arquivado mas não foi possível recarregar');
    return updated;
  }

  async verifyPassword(password: string): Promise<boolean> {
    if (!this.currentUser) await this.loadCurrentUserFromStorage();
    if (!this.currentUser || !supabase || !this.isUUID(this.currentUser.id)) return false;
    const { error } = await supabase.auth.signInWithPassword({
      email: this.currentUser.email,
      password
    });
    return !error;
  }

  async deleteProjectWithPassword(projectId: string, password: string): Promise<void> {
    const isPasswordValid = await this.verifyPassword(password);
    if (!isPasswordValid) {
      throw new Error('Senha incorreta');
    }
    await this.deleteProject(projectId);
  }

  async archiveProjectWithPassword(projectId: string, password: string): Promise<Project> {
    const isPasswordValid = await this.verifyPassword(password);
    if (!isPasswordValid) {
      throw new Error('Senha incorreta');
    }
    return this.archiveProject(projectId);
  }

  // Documentos
  async getDocument(projectId: string): Promise<Document | null> {
    if (!supabase || !this.isUUID(projectId)) return null;
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) return null;
    return {
      id: data.id,
      projectId: data.project_id,
      name: data.nome,
      currentVersionId: data.current_version_id,
      updatedAt: data.updated_at,
      content: data.conteudo as DocumentContent,
      version: 1
    } as Document;
  }

  async getDocumentById(documentId: string): Promise<Document | null> {
    if (!supabase || !this.isUUID(documentId)) return null;
    const { data, error } = await supabase.from('documents').select('*').eq('id', documentId).single();
    if (error || !data) return null;
    return {
      id: data.id,
      projectId: data.project_id,
      name: data.nome,
      currentVersionId: data.current_version_id,
      updatedAt: data.updated_at,
      content: data.conteudo as DocumentContent,
      version: 1
    } as Document;
  }

  async updateDocument(documentId: string, content: DocumentContent): Promise<Document> {
    if (!supabase || !this.isUUID(documentId)) throw new Error('Documento inválido');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'editar_documentos'))) {
      throw new Error('Sem permissão para editar documentos');
    }
    const { data, error } = await supabase
      .from('documents')
      .update({ conteudo: content, updated_at: new Date().toISOString() })
      .eq('id', documentId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      projectId: data.project_id,
      name: data.nome,
      currentVersionId: data.current_version_id,
      updatedAt: data.updated_at,
      content: data.conteudo as DocumentContent,
      version: 1
    } as Document;
  }

  async updateDocumentSection(documentId: string, sectionId: string, sectionContent: string): Promise<Document> {
    const doc = await this.getDocumentById(documentId);
    if (!doc) throw new Error('Documento não encontrado');
    const sections = doc.content?.sections || [];
    const index = sections.findIndex(s => s.id === sectionId);
    if (index !== -1) {
      sections[index].content = sectionContent;
    } else {
      sections.push({ id: sectionId, title: 'Seção', content: sectionContent, isEditable: true });
    }
    return this.updateDocument(documentId, { sections });
  }

  async createDocument(projectId: string, name: string, groupId: string, templateId: string | undefined, securityLevel: 'public' | 'restricted' | 'confidential' | 'secret'): Promise<Document> {
    if (!this.currentUser) await this.loadCurrentUserFromStorage();
    if (!supabase || !this.isUUID(projectId)) throw new Error('Projeto inválido');
    if (!this.currentUser || !(await permissionsService.can(this.currentUser, 'criar_documentos', true))) {
      throw new Error('Sem permissão para criar documentos');
    }
    let conteudo: DocumentContent = { sections: [] };
    if (templateId && this.isUUID(templateId)) {
      const model = await this.getDocumentModel(templateId);
      if (model?.templateContent) {
        const sections = this.parseTemplateContentToSections(model.templateContent);
        conteudo = { sections, aiGuidance: model.aiGuidance };
      }
    }
    const { data, error } = await supabase
      .from('documents')
      .insert({
        nome: name,
        project_id: projectId,
        template_id: templateId || null,
        conteudo,
        creator_id: this.currentUser.id,
        security_level: securityLevel
      })
      .select()
      .single();
    if (error) {
      const msg = error.message?.includes('row-level security') ? 'Sem permissão para criar documentos.' : error.message;
      throw new Error(msg);
    }
    return {
      id: data.id,
      projectId: data.project_id,
      name: data.nome,
      currentVersionId: data.current_version_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      content: data.conteudo as DocumentContent,
      version: 1
    };
  }

  async listProjectDocuments(projectId: string): Promise<Document[]> {
    if (!supabase || !this.isUUID(projectId)) return [];
    const { data, error } = await supabase.from('documents').select('*').eq('project_id', projectId);
    if (error || !data) return [];
    return data.map(d => ({
      id: d.id,
      projectId: d.project_id,
      name: d.nome,
      currentVersionId: d.current_version_id,
      updatedAt: d.updated_at,
      content: d.conteudo as DocumentContent,
      version: 1
    } as Document));
  }

  async deleteDocument(_projectId: string, documentId: string): Promise<void> {
    if (!supabase || !this.isUUID(documentId)) throw new Error('Documento inválido');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'excluir_documentos'))) {
      throw new Error('Sem permissão para excluir documentos');
    }
    const { error } = await supabase.from('documents').delete().eq('id', documentId);
    if (error) throw new Error(error.message);
  }

  async shareDocument(documentId: string, userId: string, permissions: ('view' | 'edit' | 'comment')[]): Promise<void> {
    if (!supabase || !this.isUUID(documentId) || !this.isUUID(userId)) return;
    const perms = permissions.map(p => p as string);
    await supabase.from('document_shares').upsert(
      { document_id: documentId, user_id: userId, permissions: perms },
      { onConflict: 'document_id,user_id' }
    );
  }

  async getDocumentVersions(_documentId: string): Promise<DocumentVersion[]> {
    return [];
  }

  async getTotalDocumentsCount(): Promise<number> {
    const projects = await this.getProjects();
    let total = 0;
    for (const p of projects) {
      const docs = await this.listProjectDocuments(p.id);
      total += docs.length;
    }
    return total;
  }

  // Locks (Presence - em memória)
  async acquireSectionLock(documentId: string, sectionId: string) {
    if (!this.currentUser) await this.loadCurrentUserFromStorage();
    const lockKey = `${documentId}:${sectionId}`;
    if (this.inMemoryLocks.has(lockKey) && this.inMemoryLocks.get(lockKey)?.userId !== this.currentUser?.id) return false;
    this.inMemoryLocks.set(lockKey, { userId: this.currentUser?.id || '0', userName: this.currentUser?.name || 'Sistema', timestamp: new Date().toISOString() });
    return true;
  }

  async releaseSectionLock(documentId: string, sectionId: string) {
    this.inMemoryLocks.delete(`${documentId}:${sectionId}`);
  }

  async releaseAllMyLocks(documentId: string) {
    if (!this.currentUser) await this.loadCurrentUserFromStorage();
    for (const [key, lock] of this.inMemoryLocks.entries()) {
      if (key.startsWith(`${documentId}:`) && lock.userId === this.currentUser?.id) this.inMemoryLocks.delete(key);
    }
  }

  async getActiveLocks(documentId: string): Promise<{ section_id: string; user_id: string; user_name: string }[]> {
    const locks: { section_id: string; user_id: string; user_name: string }[] = [];
    for (const [key, lock] of this.inMemoryLocks.entries()) {
      if (key.startsWith(`${documentId}:`)) {
        locks.push({
          section_id: key.split(':')[1],
          user_id: lock.userId || '',
          user_name: lock.userName || 'Usuário',
        });
      }
    }
    return locks;
  }

  subscribeToLocks(documentId: string, callback: (locks: { section_id: string; user_id: string; user_name: string }[]) => void) {
    const interval = setInterval(() => {
      this.getActiveLocks(documentId).then(callback);
    }, 2000);
    return { unsubscribe: () => clearInterval(interval) };
  }

  // Files
  async uploadFile(projectId: string, file: File, isDataSource: boolean = false): Promise<UploadedFile> {
    if (!this.currentUser) await this.loadCurrentUserFromStorage();
    if (!supabase || !this.isUUID(projectId)) throw new Error('Projeto inválido');
    // Bucket Documentos, subpasta = project_id, arquivos dentro: evita sobrescrita com timestamp
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = `${projectId}/${safeName}`;
    await supabase.storage.from('Documentos').upload(filePath, file, { upsert: true });
    const fileUrl = supabase.storage.from('Documentos').getPublicUrl(filePath).data.publicUrl;
    const status = isDataSource ? 'PENDING' : 'PROCESSED';
    const insertPayload: Record<string, unknown> = {
      project_id: projectId,
      file_name: file.name,
      file_path: filePath,
      file_url: fileUrl,
      file_size: file.size,
      file_type: file.name.split('.').pop() || 'other',
      uploaded_by: this.currentUser?.id,
      status,
      is_data_source: isDataSource
    };
    const { data: dbData, error: dbError } = await supabase
      .from('project_materials')
      .insert(insertPayload)
      .select()
      .single();
    if (dbError) throw new Error(dbError.message);
    const uploadedFile: UploadedFile = {
      id: dbData.id,
      projectId: dbData.project_id,
      name: dbData.file_name,
      type: dbData.file_type as UploadedFile['type'],
      size: dbData.file_size,
      status: (dbData.status?.toLowerCase() || 'processed') as UploadedFile['status'],
      uploadedBy: this.currentUser?.name || 'Usuário',
      uploadedAt: dbData.created_at,
      isDataSource: dbData.is_data_source,
      fileUrl: dbData.file_url,
      chunkCount: dbData.chunk_count
    };
    if (isDataSource && fileUrl) {
      indexDocumentInRAG({
        documentId: dbData.id,
        fileUrl,
        fileName: uploadedFile.name,
        projectId,
        filePath,
      }).then(() => {
        // Documento indexado no ChromaDB; status atualizado pelo serviço RAG
      }).catch((err) => {
        console.error('[RAG] Erro ao indexar:', err);
      });
    }
    return uploadedFile;
  }

  async getProjectFiles(projectId: string): Promise<UploadedFile[]> {
    if (!supabase || !this.isUUID(projectId)) return [];
    const { data, error } = await supabase.from('project_materials').select('*').eq('project_id', projectId);
    if (error || !data) return [];
    return data.map(f => ({
      id: f.id,
      projectId: f.project_id,
      name: f.file_name,
      type: f.file_type as UploadedFile['type'],
      size: f.file_size,
      status: (f.status?.toLowerCase() || 'processed') as UploadedFile['status'],
      uploadedBy: 'Usuário',
      uploadedAt: f.created_at,
      isDataSource: f.is_data_source,
      fileUrl: f.file_url,
      chunkCount: f.chunk_count,
      filePath: f.file_path
    }));
  }

  async getFilePublicUrl(projectId: string, fileIdOrFileName: string): Promise<string> {
    if (!supabase || !this.isUUID(projectId)) return '#';
    const isUuid = this.isUUID(fileIdOrFileName);
    const query = supabase.from('project_materials').select('file_path').eq('project_id', projectId);
    const { data, error } = await (isUuid ? query.eq('id', fileIdOrFileName) : query.eq('file_name', fileIdOrFileName)).single();
    if (error || !data?.file_path) return '#';
    return supabase.storage.from('Documentos').getPublicUrl(data.file_path).data.publicUrl;
  }

  async deleteFile(projectId: string, fileId: string): Promise<void> {
    if (!supabase || !this.isUUID(fileId)) throw new Error('Arquivo inválido');
    const { data, error } = await supabase.from('project_materials').select('file_path, is_data_source').eq('id', fileId).single();
    if (error || !data?.file_path) throw new Error('Arquivo não encontrado');
    if (data.is_data_source) {
      deleteDocumentFromRAG(fileId).catch((err) => console.warn('[RAG] Erro ao remover do ChromaDB:', err));
    }
    await supabase.storage.from('Documentos').remove([data.file_path]);
    await supabase.from('project_materials').delete().eq('id', fileId);
  }

  async reindexDocumentInRAG(projectId: string, fileId: string): Promise<void> {
    const files = await this.getProjectFiles(projectId);
    const f = files.find(x => x.id === fileId);
    if (!f?.isDataSource) throw new Error('Documento não é fonte de dados');
    const url = f.fileUrl || (await this.getFilePublicUrl(projectId, fileId));
    if (!url || url === '#') throw new Error('URL do arquivo não disponível');
    await indexDocumentInRAG({
      documentId: fileId,
      fileUrl: url,
      fileName: f.name,
      projectId,
      filePath: f.filePath,
      reindex: true,
    });
  }

  async setFileAsDataSource(projectId: string, fileId: string, isDataSource: boolean): Promise<void> {
    if (!supabase || !this.isUUID(fileId)) throw new Error('Arquivo inválido');
    const { error } = await supabase.from('project_materials').update({ is_data_source: isDataSource }).eq('id', fileId);
    if (error) throw new Error(error.message);
  }

  // Grupos
  async getGroups(): Promise<Group[]> {
    if (!supabase) return [];
    const { data: groupsData, error } = await supabase.from('groups').select('*');
    if (error || !groupsData) return [];
    return Promise.all(groupsData.map(async (g) => {
      const { data: membersData } = await supabase.from('group_members').select('user_id').eq('group_id', g.id);
      return {
        id: g.id,
        name: g.nome || g.name,
        description: g.descricao || g.description,
        responsibleId: g.responsavel_id || g.responsible_id,
        memberIds: membersData?.map(m => m.user_id) || [],
        projectIds: g.project_id ? [g.project_id] : (g.projeto_id ? [g.projeto_id] : []),
        createdAt: g.created_at,
        updatedAt: g.updated_at
      } as Group;
    }));
  }

  async createGroup(name: string, description?: string, parentId?: string, memberIds: string[] = [], responsibleId?: string, projectIds: string[] = []): Promise<Group> {
    if (!supabase) throw new Error('Supabase não configurado');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'gerenciar_grupos'))) {
      throw new Error('Sem permissão para criar grupos');
    }
    const { data, error } = await supabase
      .from('groups')
      .insert({ nome: name, descricao: description, responsavel_id: responsibleId, project_id: projectIds?.[0] })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (memberIds.length > 0) {
      const { error: membersError } = await supabase.from('group_members').insert(memberIds.map(uid => ({ group_id: data.id, user_id: uid })));
      if (membersError) throw new Error(membersError.message || 'Erro ao adicionar membros ao grupo');
    }
    return {
      id: data.id,
      name: data.nome,
      description: data.descricao,
      responsibleId: data.responsavel_id,
      memberIds,
      projectIds,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async updateGroup(updatedGroup: Group): Promise<Group> {
    if (!supabase || !this.isUUID(updatedGroup.id)) throw new Error('Grupo inválido');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'gerenciar_grupos'))) {
      throw new Error('Sem permissão para editar grupos');
    }
    const { error: updateError } = await supabase.from('groups').update({
      nome: updatedGroup.name,
      descricao: updatedGroup.description,
      responsavel_id: updatedGroup.responsibleId,
      updated_at: new Date().toISOString()
    }).eq('id', updatedGroup.id);
    if (updateError) throw new Error(updateError.message || 'Erro ao atualizar grupo');

    const { error: deleteError } = await supabase.from('group_members').delete().eq('group_id', updatedGroup.id);
    if (deleteError) throw new Error(deleteError.message || 'Erro ao atualizar membros do grupo');

    if (updatedGroup.memberIds.length > 0) {
      const { error: insertError } = await supabase.from('group_members').insert(
        updatedGroup.memberIds.map(uid => ({ group_id: updatedGroup.id, user_id: uid }))
      );
      if (insertError) throw new Error(insertError.message || 'Erro ao adicionar membros ao grupo');
    }
    return updatedGroup;
  }

  async deleteGroup(groupId: string): Promise<boolean> {
    if (!supabase || !this.isUUID(groupId)) return false;
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'gerenciar_grupos'))) {
      throw new Error('Sem permissão para excluir grupos');
    }
    const { error } = await supabase.from('groups').delete().eq('id', groupId);
    return !error;
  }

  // Modelos
  async getDocumentModel(id: string): Promise<DocumentModel | null> {
    if (!supabase || !this.isUUID(id)) return null;
    const { data, error } = await supabase.from('templates').select('*').eq('id', id).single();
    if (error || !data) return null;
    return {
      id: data.id,
      name: data.nome,
      type: data.tipo_documento,
      templateContent: data.sections?.html || '',
      isGlobal: data.global === true,
      projectId: data.project_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isDraft: data.is_draft === true,
      aiGuidance: data.ai_guidance ?? undefined,
    };
  }

  async getDocumentModels(projectId?: string): Promise<DocumentModel[]> {
    if (!supabase) return [];
    let query = supabase.from('templates').select('*');
    if (projectId) query = query.or(`global.eq.true,project_id.eq.${projectId}`);
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(t => ({
      id: t.id,
      name: t.nome,
      type: t.tipo_documento,
      templateContent: t.sections?.html || '',
      isGlobal: t.global === true,
      projectId: t.project_id,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      isDraft: t.is_draft === true,
      aiGuidance: t.ai_guidance ?? undefined,
    }));
  }

  async createDocumentModel(
    name: string,
    type: string,
    templateContent: string,
    isGlobal: boolean = false,
    projectId?: string,
    isDraft?: boolean,
    aiGuidance?: string
  ): Promise<DocumentModel> {
    if (!supabase) throw new Error('Supabase não configurado');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'criar_templates'))) {
      throw new Error('Sem permissão para criar modelos de documento');
    }
    const insertData: Record<string, unknown> = {
      nome: name,
      tipo_documento: type,
      sections: { html: templateContent },
      global: isGlobal,
      project_id: projectId,
      file_url: '', // obrigatório na tabela templates; modelos criados no app não usam arquivo
      ai_guidance: aiGuidance || null
    };
    const { data, error } = await supabase.from('templates').insert(insertData).select().single();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      name: data.nome,
      type: data.tipo_documento,
      templateContent: data.sections?.html || '',
      isGlobal: data.global,
      projectId: data.project_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isDraft: data.is_draft === true,
      aiGuidance: data.ai_guidance ?? aiGuidance
    };
  }

  async updateDocumentModel(updatedModel: DocumentModel): Promise<DocumentModel> {
    if (!supabase || !this.isUUID(updatedModel.id)) throw new Error('Modelo inválido');
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'editar_templates'))) {
      throw new Error('Sem permissão para editar modelos de documento');
    }
    const updateData: Record<string, unknown> = {
      nome: updatedModel.name ?? '',
      tipo_documento: updatedModel.type || '',
      sections: { html: updatedModel.templateContent ?? '' },
      global: updatedModel.isGlobal === true,
      ai_guidance: updatedModel.aiGuidance ?? null
    };
    if (updatedModel.projectId !== undefined) updateData.project_id = updatedModel.projectId || null;
    const { error } = await supabase.from('templates').update(updateData).eq('id', updatedModel.id);
    if (error) throw new Error(error.message);
    return updatedModel;
  }

  async deleteDocumentModel(id: string): Promise<boolean> {
    if (!supabase || !this.isUUID(id)) return false;
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current || !(await permissionsService.can(current, 'excluir_templates'))) {
      throw new Error('Sem permissão para excluir modelos de documento');
    }
    const { error } = await supabase.from('templates').delete().eq('id', id);
    return !error;
  }

  async getLocalModelDrafts(): Promise<DocumentModel[]> {
    const drafts = await localDb.getModelDrafts();
    return drafts.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      templateContent: d.templateContent,
      isGlobal: false,
      createdAt: d.updatedAt,
      updatedAt: d.updatedAt,
      isDraft: d.isDraft,
      aiGuidance: d.aiGuidance,
      isLocalDraft: true
    }));
  }

  async saveLocalModelDraft(draft: { id: string; name: string; type: string; templateContent: string; aiGuidance?: string; isDraft: boolean }): Promise<void> {
    await localDb.saveModelDraft(draft);
  }

  async deleteLocalModelDraft(id: string): Promise<void> {
    await localDb.deleteModelDraft(id);
  }

  // Audit
  async getAuditLogs(projectId: string): Promise<AuditLog[]> {
    if (!supabase || !this.isUUID(projectId)) return [];
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entidade_id', projectId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(l => ({
      id: l.id,
      projectId: l.entidade_id,
      action: l.acao,
      userId: l.user_id,
      userName: l.detalhes?.user_name || 'Usuário',
      details: l.detalhes?.message || '',
      timestamp: l.created_at
    }));
  }

  // AI & Wiki
  async generateWithAI(projectId: string, prompt: string, context?: any) { return "Conteúdo gerado pela IA SGID baseado no contexto do projeto."; }
  async chatWithAI(projectId: string, message: string, options: { documentId?: string }): Promise<string> {
    const { response } = await chatWithRAG({
      projectId,
      message,
      documentId: options.documentId,
    });
    return response;
  }
  async analyzeProjectMaterials(projectId: string, callback?: (status: string) => void, isForce?: boolean): Promise<string> {
    const files = await this.getProjectFiles(projectId);
    const toIndex = files.filter(f => f.isDataSource && (f.status === 'pending' || isForce) && (f.fileUrl || f.id));
    if (toIndex.length === 0) {
      if (callback) callback('Concluído');
      return 'Nenhum documento pendente para indexar.';
    }
    for (const f of toIndex) {
      const url = f.fileUrl || (await this.getFilePublicUrl(projectId, f.id));
      if (!url || url === '#') continue;
      try {
        if (callback) callback(`Indexando ${f.name}...`);
        await indexDocumentInRAG({
          documentId: f.id,
          fileUrl: url,
          fileName: f.name,
          projectId,
          filePath: f.filePath,
          reindex: !!isForce,
        });
      } catch (err) {
        console.warn('[RAG] Erro ao indexar', f.name, err);
      }
    }
    if (callback) callback('Concluído');
    return `Indexados ${toIndex.length} documento(s) no RAG.`;
  }
  async analyzeProjectModels(projectId: string) { return "Modelos analisados."; }
  async hasExistingSummary(projectId: string) { return true; }

  /** Lista documentos para a Wiki. Admin vê todos; outros veem conforme projeto + nível de sigilo. */
  async listWikiDocuments(page: number, pageSize: number): Promise<{ data: Document[]; total: number }> {
    if (!supabase) return { data: [], total: 0 };
    const current = this.currentUser ?? (await this.loadCurrentUserFromStorage());
    if (!current) return { data: [], total: 0 };

    const mapRow = (d: Record<string, unknown>) => ({
      id: d.id,
      projectId: d.project_id,
      name: d.nome,
      currentVersionId: d.current_version_id,
      updatedAt: d.updated_at,
      content: d.conteudo as DocumentContent,
      creatorId: d.creator_id ?? '',
      creatorName: '',
      securityLevel: (d.security_level as Document['securityLevel']) || 'public',
      version: 1
    } as Document);

    const isAdmin = await permissionsService.can(current, 'acesso_total');

    if (isAdmin) {
      const from = (page - 1) * pageSize;
      const { data, error, count } = await supabase
        .from('documents')
        .select('*', { count: 'exact' })
        .order('id', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) {
        console.error('[listWikiDocuments] Erro admin:', error);
        return { data: [], total: 0 };
      }
      return { data: (data || []).map(mapRow), total: count ?? (data?.length ?? 0) };
    }

    const projects = await this.getProjects();
    const projectIds = projects.map(p => p.id);
    if (projectIds.length === 0) return { data: [], total: 0 };

    const { data: docsData, error } = await supabase
      .from('documents')
      .select('*')
      .in('project_id', projectIds)
      .order('id', { ascending: false });
    if (error) {
      console.error('[listWikiDocuments] Erro não-admin:', error);
      return { data: [], total: 0 };
    }
    const docs = docsData || [];

    const sharedMap = new Map<string, boolean>();
    const { data: shares } = await supabase.from('document_shares').select('document_id').eq('user_id', current.id);
    if (shares) for (const s of shares) sharedMap.set((s as { document_id: string }).document_id, true);

    const filtered = docs.filter((d: Record<string, unknown>) => {
      const level = (d.security_level as string) || 'public';
      if (level === 'public') return true;
      const creatorId = d.creator_id as string | null;
      if (level === 'confidential' || level === 'secret') return creatorId === current.id;
      if (level === 'restricted') return creatorId === current.id || sharedMap.has(d.id as string);
      return true;
    });

    const total = filtered.length;
    const from = (page - 1) * pageSize;
    const pageData = filtered.slice(from, from + pageSize);
    return { data: pageData.map(mapRow), total };
  }

  // Outros
  getActiveUsers = (projectId: string) => [];
  async uploadModelFile(projectId: string, file: File) {}
  async deleteModelFile(projectId: string, fileName: string) {}

  // Helpers
  private decodeHtmlEntities(input: string): string { try { const doc = new DOMParser().parseFromString(input, 'text/html'); return doc.documentElement.textContent || input; } catch { return input; } }
  private parseTemplateContentToSections(templateContent: string): DocumentSection[] {
    const html = templateContent || ''; const sections: DocumentSection[] = [];
    try { const doc = new DOMParser().parseFromString(html, 'text/html'); const fields = doc.querySelectorAll('.sgid-metadata-field'); fields.forEach((el, i) => { sections.push({ id: el.getAttribute('data-field-id') || `field-${i}`, title: this.decodeHtmlEntities(el.getAttribute('data-field-title') || 'Campo'), content: '', isEditable: true, helpText: this.decodeHtmlEntities(el.getAttribute('data-field-help') || '') || undefined }); }); } catch {}
    if (sections.length === 0) { const legacyRegex = /<!-- EDITABLE_SECTION_START:([^:]+):([^>]+) -->(.*?)<!-- EDITABLE_SECTION_END -->/gs; let match; while ((match = legacyRegex.exec(html)) !== null) { sections.push({ id: match[1], title: this.decodeHtmlEntities(match[2]), content: '', isEditable: true }); } }
    return sections.length > 0 ? sections : [{ id: 'section1', title: 'Seção 1', content: '', isEditable: true }];
  }

  async addSectionToDocument(documentId: string, title: string, index?: number): Promise<Document> {
    const doc = await this.getDocumentById(documentId); if (!doc) throw new Error('Documento não encontrado');
    const sections = doc.content?.sections || []; const newSection = { id: `sec-${Date.now()}`, title, content: '', isEditable: true };
    if (index !== undefined) sections.splice(index, 0, newSection); else sections.push(newSection);
    return this.updateDocument(documentId, { sections });
  }
}

export const apiService = new APIService();
