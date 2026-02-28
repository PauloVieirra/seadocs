// API Service - Configurável para qualquer banco de dados

import { manusAPIService, type ManusConfig } from './manus-api';
import { supabase } from './supabase';

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
  role: 'admin' | 'director' | 'manager' | 'technical_responsible' | 'operational';
  managerId?: string;
  createdAt: string;
  updatedAt?: string;
  isActive?: boolean;
  forcePasswordChange?: boolean;
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
}

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
  isEditable: boolean;
}

export interface UploadedFile {
  id: string;
  projectId: string;
  name: string;
  type: 'pdf' | 'doc' | 'docx' | 'txt' | 'audio' | 'other';
  size: number;
  status: 'processing' | 'processed' | 'error';
  uploadedBy: string;
  uploadedAt: string;
  isDataSource?: boolean;
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
  status: 'draft' | 'in-progress' | 'review' | 'approved';
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
}

class APIService {
  private readonly storageKey = 'sgid:mockdb:v1';
  private dbConfig: DatabaseConfig | null = null;
  private aiConfig: AIConfig | null = null;
  private currentUser: User | null = null;
  private listeners: Set<{ event: string; callback: Function }> = new Set();

  public isUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  // Mock data (Fallback)
  private mockUsers: User[] = [
    { id: '1', email: 'admin@empresa.com', name: 'Admin Sistema', password: 'admin123', role: 'admin', createdAt: new Date().toISOString(), isActive: true, forcePasswordChange: false },
    { id: '2', email: 'diretor@empresa.com', name: 'Diretor Geral', password: 'diretor123', role: 'director', createdAt: new Date().toISOString(), isActive: true, forcePasswordChange: false },
    { id: '3', email: 'gerente@empresa.com', name: 'Gerente de Projeto', password: 'gerente123', role: 'manager', createdAt: new Date().toISOString(), isActive: true, forcePasswordChange: false },
    { id: '4', email: 'responsavel.tecnico@empresa.com', name: 'Responsável Técnico', password: 'tecnico123', role: 'technical_responsible', createdAt: new Date().toISOString(), isActive: true, forcePasswordChange: false },
    { id: '5', email: 'operacional@empresa.com', name: 'Designer UI', password: 'operacional123', role: 'operational', managerId: '3', createdAt: new Date().toISOString(), isActive: true, forcePasswordChange: false }
  ];

  private mockGroups: Group[] = [
    { id: 'g1', name: 'Engenharia de Software', description: 'Grupo responsável pelo desenvolvimento de software', memberIds: ['1', '2', '3', '4', '5'], responsibleId: '2', projectIds: ['1'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'g2', name: 'Infraestrutura', description: 'Grupo responsável pela infraestrutura e operações', parentId: 'g1', memberIds: ['1', '5'], responsibleId: '1', projectIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ];

  private mockDocumentModels: DocumentModel[] = [
    { id: 'dm1', name: 'Modelo de Especificação de Requisitos', type: 'Especificação de Requisitos', templateContent: `<h1>1. Introdução</h1><p><!-- EDITABLE_SECTION_START:intro:Introdução --><!-- EDITABLE_SECTION_END --></p>`, isGlobal: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ];

  private mockProjects: Project[] = [];
  private mockDocuments: Map<string, Document> = new Map();
  private mockDocumentVersions: Map<string, DocumentVersion[]> = new Map();
  private mockFiles: Map<string, UploadedFile[]> = new Map();
  private mockAuditLogs: Map<string, AuditLog[]> = new Map();
  private mockLocks: Map<string, { userId: string; userName: string; timestamp: string }> = new Map();

  constructor() {
    this.hydrateFromLocalStorage();
  }

  private persistToLocalStorage(): void {
    try {
      const payload = {
        version: 1,
        users: this.mockUsers,
        groups: this.mockGroups,
        documentModels: this.mockDocumentModels,
        projects: this.mockProjects,
        documents: Array.from(this.mockDocuments.entries()),
        documentVersions: Array.from(this.mockDocumentVersions.entries()),
        files: Array.from(this.mockFiles.entries()),
        auditLogs: Array.from(this.mockAuditLogs.entries()),
      };
      localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('[SGID] Erro ao salvar localmente:', error);
    }
  }

  private hydrateFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.users) this.mockUsers = parsed.users;
      if (parsed.groups) this.mockGroups = parsed.groups;
      if (parsed.projects) this.mockProjects = parsed.projects;
      if (parsed.documents) this.mockDocuments = new Map(parsed.documents);
      if (parsed.documentVersions) this.mockDocumentVersions = new Map(parsed.documentVersions);
      if (parsed.files) this.mockFiles = new Map(parsed.files);
      if (parsed.auditLogs) this.mockAuditLogs = new Map(parsed.auditLogs);
    } catch (error) {
      console.warn('[SGID] Erro ao carregar localmente:', error);
    }
  }

  // Configurações
  async configurarBancoDeDados(config: DatabaseConfig): Promise<boolean> {
      this.dbConfig = config;
      localStorage.setItem('db_config', JSON.stringify(config));
      return true;
  }

  getConfiguracao(): DatabaseConfig | null {
    if (this.dbConfig) return this.dbConfig;
    const stored = localStorage.getItem('db_config');
    return stored ? JSON.parse(stored) : null;
    }
    
  async configurarIA(config: AIConfig): Promise<boolean> {
      this.aiConfig = config;
      localStorage.setItem('ai_config', JSON.stringify(config));
      return true;
  }

  getAIConfiguracao(): AIConfig | null {
    if (this.aiConfig) return this.aiConfig;
    const stored = localStorage.getItem('ai_config');
    return stored ? JSON.parse(stored) : null;
    }
    
  resetToDefaults(): void {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem('current_user');
    window.location.reload();
  }

  // Autenticação
  async login(email: string, password: string): Promise<User | null> {
    try {
      if (supabase) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (!authError && authData.user) {
          const { data: userData } = await supabase.from('users').select('*').eq('email', email).single();
          const user: User = {
            id: authData.user.id,
            email: authData.user.email!,
            name: userData?.nome || authData.user.user_metadata?.name || email.split('@')[0],
            password: '',
            role: (userData?.role?.toLowerCase() || authData.user.user_metadata?.role || 'operational') as User['role'],
            createdAt: authData.user.created_at,
            isActive: userData?.status !== 'INATIVO',
            forcePasswordChange: userData?.force_password_change === true
          };
          this.currentUser = user;
          localStorage.setItem('current_user', JSON.stringify(user));
          return user;
        }
      }
    } catch (err) {
      console.warn('[APIService] Falha login Supabase, tentando mock:', err);
    }

    const user = this.mockUsers.find(u => u.email === email && u.password === password);
    if (user) {
    this.currentUser = user;
    localStorage.setItem('current_user', JSON.stringify(user));
    return user;
    }
    return null;
  }

  async register(email: string, password: string, name: string, role: User['role'] = 'operational'): Promise<User | null> {
    try {
      if (supabase) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
          options: { data: { name, role } }
        });
        if (!authError && authData.user) {
          await supabase.from('users').insert({ id: authData.user.id, email, nome: name, role, status: 'ATIVO' });
          const newUser: User = { id: authData.user.id, email, name, password: '', role, createdAt: authData.user.created_at, isActive: true };
          this.mockUsers.push(newUser);
          this.persistToLocalStorage();
          return newUser;
        }
      }
    } catch (err) {
      console.warn('[APIService] Falha registro Supabase:', err);
    }
    const newUser: User = { id: Date.now().toString(), email, name, password, role, createdAt: new Date().toISOString(), isActive: true };
    this.mockUsers.push(newUser);
    this.persistToLocalStorage();
    return newUser;
  }

  logout(): void {
    supabase?.auth.signOut();
    this.currentUser = null;
    localStorage.removeItem('current_user');
  }

  getCurrentUser(): User | null {
    if (this.currentUser) return this.currentUser;
    const stored = localStorage.getItem('current_user');
    return stored ? JSON.parse(stored) : null;
  }

  async updateUser(updatedUser: User): Promise<User> {
    try {
      if (supabase && this.isUUID(updatedUser.id)) {
        await supabase
          .from('users')
          .update({
            nome: updatedUser.name,
            role: updatedUser.role
          })
          .eq('id', updatedUser.id);
      }
    } catch (err) {
      console.warn('[APIService] Erro ao atualizar usuário no Supabase:', err);
    }
    const index = this.mockUsers.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) this.mockUsers[index] = updatedUser;
    this.persistToLocalStorage();
    return updatedUser;
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      if (supabase && this.isUUID(userId)) {
        await supabase.from('users').delete().eq('id', userId);
      }
    } catch (err) {
      console.warn('[APIService] Erro ao deletar usuário no Supabase:', err);
    }
    const initialLength = this.mockUsers.length;
    this.mockUsers = this.mockUsers.filter(u => u.id !== userId);
    this.persistToLocalStorage();
    return this.mockUsers.length < initialLength;
  }

  async getUser(id: string): Promise<User | null> {
    try {
      if (supabase && this.isUUID(id)) {
        const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
        if (!error && data) {
          return {
            id: data.id,
            email: data.email,
            name: data.nome,
            password: '',
            role: data.role?.toLowerCase() || 'operational',
            createdAt: data.created_at,
            isActive: data.status !== 'INATIVO'
          };
        }
      }
    } catch (err) {}
    return this.mockUsers.find(u => u.id === id) || null;
  }

  async getAllUsers(): Promise<User[]> {
    let supabaseUsers: User[] = [];
    try {
      if (supabase) {
        const { data, error } = await supabase.from('users').select('*');
        if (!error && data) {
          supabaseUsers = data.map(u => ({
            id: u.id,
            email: u.email,
            name: u.nome || u.name,
            password: '',
            role: (u.role?.toLowerCase() || 'operational') as User['role'],
            createdAt: u.created_at,
            isActive: u.status !== 'INATIVO'
          }));
        }
      }
    } catch (err) {}
    
    // Merge mock users
    const allUsers = [...supabaseUsers];
    this.mockUsers.forEach(mockUser => {
      if (!allUsers.find(u => u.id === mockUser.id)) {
        allUsers.push(mockUser);
      }
    });
    return allUsers;
  }

  async updateUserPassword(userId: string, newPassword: string, forcePasswordChange?: boolean): Promise<User> {
    if (this.currentUser?.id === userId) {
      try {
        await supabase?.auth.updateUser({ password: newPassword });
      } catch (err) {}
    }
    const targetUser = this.mockUsers.find(u => u.id === userId);
    if (!targetUser) throw new Error('Usuário não encontrado');
    targetUser.password = newPassword;
    targetUser.forcePasswordChange = forcePasswordChange === true;
    this.persistToLocalStorage();
    return targetUser;
  }

  getTotalUsersCount = async () => this.mockUsers.length;

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
    let supabaseProjects: Project[] = [];
    try {
      if (supabase) {
        // Buscamos projetos do Supabase
        const { data, error } = await supabase.from('projects').select('*');
        if (!error && data) {
          supabaseProjects = data.map(p => ({
            id: p.id,
            name: p.nome || p.name || 'Sem nome',
            description: p.descricao || p.description || '',
            creatorId: p.criado_por || p.created_by,
            creatorName: 'Usuário',
            status: (p.status?.toLowerCase() || 'draft') as Project['status'],
            createdAt: p.created_at,
            updatedAt: p.updated_at,
            responsibleIds: p.responsavel_id ? [p.responsavel_id] : (p.responsible_id ? [p.responsible_id] : []),
            groupIds: p.group_id ? [p.group_id] : (p.grupo_id ? [p.grupo_id] : []),
            documentIds: []
          }));
        }
      }
    } catch (err) {
      console.error('[APIService] Erro getProjects Supabase:', err);
    }

    // Unimos os projetos do Supabase com os projetos locais (mock)
    // Evitando duplicatas se o ID for o mesmo
    const allProjects = [...supabaseProjects];
    
    this.mockProjects.forEach(mockProj => {
      if (!allProjects.find(p => p.id === mockProj.id)) {
        allProjects.push(mockProj);
      }
    });

    return allProjects;
  }

  async getProject(projectId: string): Promise<Project | null> {
    try {
      if (supabase && this.isUUID(projectId)) {
        const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!error && data) {
          return {
            id: data.id,
            name: data.name,
            description: data.description,
            creatorId: data.created_by,
            creatorName: 'Usuário',
            status: data.status?.toLowerCase() || 'draft',
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            responsibleIds: data.responsible_id ? [data.responsible_id] : [],
            groupIds: [],
            documentIds: []
          };
        }
      }
    } catch (err) {}
    return this.mockProjects.find(p => p.id === projectId) || null;
  }

  async createProject(name: string, description?: string, responsibleIds?: string[], groupIds?: string[]): Promise<Project> {
    try {
      if (supabase && this.currentUser && this.isUUID(this.currentUser.id)) {
        // Tentamos inserir com os nomes em português (padrão do projeto) e inglês como fallback
        const projectToInsert: any = {
          nome: name,
          descricao: description || '',
          status: 'DRAFT',
          criado_por: this.currentUser.id,
          responsavel_id: (responsibleIds && responsibleIds.length > 0 && this.isUUID(responsibleIds[0])) 
            ? responsibleIds[0] 
            : this.currentUser.id
        };

        // Se houver grupos, tentamos associar o primeiro (se a tabela suportar grupo_id único)
        if (groupIds && groupIds.length > 0 && this.isUUID(groupIds[0])) {
          projectToInsert.grupo_id = groupIds[0];
        }

        const { data, error } = await supabase
          .from('projects')
          .insert(projectToInsert)
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            name: data.nome || data.name,
            description: data.descricao || data.description,
            creatorId: data.criado_por || data.created_by,
            creatorName: this.currentUser.name,
            status: (data.status?.toLowerCase() || 'draft') as Project['status'],
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            responsibleIds: data.responsavel_id ? [data.responsavel_id] : (data.responsible_id ? [data.responsible_id] : []),
            groupIds: data.grupo_id ? [data.grupo_id] : (data.group_id ? [data.group_id] : []),
            documentIds: []
          };
        } else if (error) {
          console.warn('[APIService] Falha ao inserir projeto no Supabase, tentando com nomes em inglês:', error);
          
          // Fallback para nomes em inglês caso o banco use outro padrão
          const fallbackProject = {
            name,
            description: description || '',
            status: 'DRAFT',
            created_by: this.currentUser.id,
            responsible_id: (responsibleIds && responsibleIds.length > 0 && this.isUUID(responsibleIds[0])) 
              ? responsibleIds[0] 
              : this.currentUser.id
          };

          const { data: fallbackData, error: fallbackError } = await supabase
            .from('projects')
            .insert(fallbackProject)
            .select()
            .single();

          if (!fallbackError && fallbackData) {
            return {
              id: fallbackData.id,
              name: fallbackData.name || fallbackData.nome,
              description: fallbackData.description || fallbackData.descricao,
              creatorId: fallbackData.created_by || fallbackData.criado_por,
              creatorName: this.currentUser.name,
              status: (fallbackData.status?.toLowerCase() || 'draft') as Project['status'],
              createdAt: fallbackData.created_at,
              updatedAt: fallbackData.updated_at,
              responsibleIds: fallbackData.responsible_id ? [fallbackData.responsible_id] : (fallbackData.responsavel_id ? [fallbackData.responsavel_id] : []),
              groupIds: fallbackData.group_id ? [fallbackData.group_id] : (fallbackData.grupo_id ? [fallbackData.grupo_id] : []),
              documentIds: []
            };
          }
        }
      } else if (supabase && this.currentUser && !this.isUUID(this.currentUser.id)) {
        console.warn('[APIService] Usuário logado com conta MOCK. Para persistir no Supabase, use uma conta real.');
      }
    } catch (err) {
      console.error('[APIService] Erro createProject Supabase:', err);
    }

    // Se tudo falhar ou estiver usando mock, usa o mock local
    const newProject: Project = {
      id: Date.now().toString(),
      name,
      description,
      creatorId: this.currentUser?.id || '0',
      creatorName: this.currentUser?.name || 'Sistema',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      responsibleIds: responsibleIds || [],
      groupIds: groupIds || [],
      documentIds: []
    };
    this.mockProjects.push(newProject);
    this.persistToLocalStorage();
    return newProject;
  }

  async updateProject(updatedProject: Project): Promise<Project> {
    try {
      if (supabase && this.isUUID(updatedProject.id)) {
        const updateData: any = {
          nome: updatedProject.name,
          descricao: updatedProject.description,
          status: updatedProject.status.toUpperCase()
        };
        
        const { error } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', updatedProject.id);
        
        if (error) {
          // Fallback para nomes em inglês
          await supabase
            .from('projects')
            .update({
              name: updatedProject.name,
              description: updatedProject.description,
              status: updatedProject.status.toUpperCase()
            })
            .eq('id', updatedProject.id);
        }
      }
    } catch (err) {}
    const index = this.mockProjects.findIndex(p => p.id === updatedProject.id);
    if (index !== -1) this.mockProjects[index] = updatedProject;
    this.persistToLocalStorage();
    return updatedProject;
  }

  async deleteProject(projectId: string): Promise<boolean> {
    try {
      if (supabase && this.isUUID(projectId)) {
        await supabase.from('projects').delete().eq('id', projectId);
        return true;
      }
    } catch (err) {}
    const initialLength = this.mockProjects.length;
    this.mockProjects = this.mockProjects.filter(p => p.id !== projectId);
    this.persistToLocalStorage();
    return this.mockProjects.length < initialLength;
  }

  // Documentos
  async getDocument(projectId: string): Promise<Document | null> {
    try {
      if (supabase && this.isUUID(projectId)) {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('project_id', projectId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!error && data) {
          return {
            id: data.id,
            projectId: data.project_id,
            name: data.nome,
            currentVersionId: data.current_version_id,
            updatedAt: data.updated_at,
            content: data.conteudo as any,
            version: 1
          } as Document;
        }
      }
    } catch (err) {}

    const doc = Array.from(this.mockDocuments.values()).find(d => d.projectId === projectId);
    if (!doc) return null;
    const versions = this.mockDocumentVersions.get(doc.id);
    const currentVersion = versions?.find(v => v.id === doc.currentVersionId);
    return currentVersion 
      ? { ...doc, content: currentVersion.content, version: currentVersion.versionNumber, updatedAt: currentVersion.updatedAt, updatedBy: currentVersion.updatedBy } as Document 
      : null;
  }

  async getDocumentById(documentId: string): Promise<Document | null> {
    try {
      if (supabase && this.isUUID(documentId)) {
        const { data, error } = await supabase.from('documents').select('*').eq('id', documentId).single();
        if (!error && data) {
    return {
            id: data.id,
            projectId: data.project_id,
            name: data.nome,
            currentVersionId: data.current_version_id,
            updatedAt: data.updated_at,
            content: data.conteudo as any,
            version: 1
          } as Document;
        }
      }
    } catch (err) {}

    const doc = this.mockDocuments.get(documentId);
    if (!doc) return null;
    const versions = this.mockDocumentVersions.get(documentId);
    const currentVersion = versions?.find(v => v.id === doc.currentVersionId);
    return currentVersion 
      ? { ...doc, content: currentVersion.content, version: currentVersion.versionNumber, updatedBy: currentVersion.updatedBy } 
      : doc;
  }

  async updateDocument(documentId: string, content: DocumentContent): Promise<Document> {
    try {
      if (supabase && this.isUUID(documentId)) {
        const { data, error } = await supabase
          .from('documents')
          .update({
            conteudo: content,
            updated_at: new Date().toISOString()
          })
          .eq('id', documentId)
          .select()
          .single();

        if (!error && data) {
    return {
            id: data.id,
            projectId: data.project_id,
            name: data.nome,
            currentVersionId: data.current_version_id,
            updatedAt: data.updated_at,
            content: data.conteudo as any,
            version: 1
          } as Document;
        }
      }
    } catch (err) {}

    const doc = this.mockDocuments.get(documentId);
    if (!doc) throw new Error('Documento não encontrado');
    const versions = this.mockDocumentVersions.get(documentId) || [];
    const nextVersion = versions.length + 1;
    const newVersion: DocumentVersion = {
      id: `v${documentId}_${nextVersion}`,
      documentId,
      versionNumber: nextVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: this.currentUser?.name || 'Sistema',
      content
    };
    versions.push(newVersion);
    this.mockDocumentVersions.set(documentId, versions);
    doc.currentVersionId = newVersion.id;
    this.mockDocuments.set(documentId, doc);
    this.persistToLocalStorage();
    return { ...doc, content: newVersion.content, version: newVersion.versionNumber, updatedAt: newVersion.updatedAt, updatedBy: newVersion.updatedBy } as Document;
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
    try {
      if (supabase && this.isUUID(projectId)) {
        const { data, error } = await supabase
          .from('documents')
          .insert({
            nome: name,
            project_id: projectId,
            template_id: templateId || null,
            seguranca: securityLevel.toUpperCase(),
            criado_por: this.currentUser?.id,
            conteudo: { sections: [] }
          })
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            projectId: data.project_id,
            name: data.nome,
            currentVersionId: data.current_version_id,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            content: data.conteudo as any,
            version: 1
          };
        }
      }
    } catch (err) {}

    const newId = `doc_${Date.now()}`;
    const doc: Document = {
      id: newId,
      projectId,
      name,
      groupId,
      securityLevel,
      templateId,
      creatorId: this.currentUser?.id || '0',
      creatorName: this.currentUser?.name || 'Sistema',
      currentVersionId: `v${newId}_1`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sharedWith: []
    };
    this.mockDocuments.set(newId, doc);
    this.mockDocumentVersions.set(newId, [{
      id: `v${newId}_1`,
      documentId: newId,
      versionNumber: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: this.currentUser?.name || 'Sistema',
      content: { sections: [] }
    }]);
    this.persistToLocalStorage();
    return doc;
  }

  async listProjectDocuments(projectId: string): Promise<Document[]> {
    try {
      if (supabase && this.isUUID(projectId)) {
        const { data, error } = await supabase.from('documents').select('*').eq('project_id', projectId);
        if (!error && data) {
          return data.map(d => ({
            id: d.id,
            projectId: d.project_id,
            name: d.nome,
            currentVersionId: d.current_version_id,
            updatedAt: d.updated_at,
            content: d.conteudo as any,
            version: 1
          } as Document));
        }
      }
    } catch (err) {}
    return Array.from(this.mockDocuments.values()).filter(d => d.projectId === projectId);
  }

  async deleteDocument(projectId: string, documentId: string): Promise<void> {
    try {
      if (supabase && this.isUUID(documentId)) {
        await supabase.from('documents').delete().eq('id', documentId);
        return;
      }
    } catch (err) {}
    this.mockDocuments.delete(documentId);
    this.mockDocumentVersions.delete(documentId);
    this.persistToLocalStorage();
  }

  async shareDocument(documentId: string, userId: string, permissions: ('view' | 'edit' | 'comment')[]) {
    const doc = this.mockDocuments.get(documentId);
    if (doc) { doc.sharedWith = [...(doc.sharedWith || []), { userId, permissions }]; this.mockDocuments.set(documentId, doc); this.persistToLocalStorage(); }
  }

  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    return this.mockDocumentVersions.get(documentId) || [];
  }

  getTotalDocumentsCount = async () => Array.from(this.mockDocuments.values()).length;

  // Locks (Presence)
  async acquireSectionLock(documentId: string, sectionId: string) {
    const lockKey = `${documentId}:${sectionId}`;
    if (this.mockLocks.has(lockKey) && this.mockLocks.get(lockKey)?.userId !== this.currentUser?.id) return false;
    this.mockLocks.set(lockKey, { userId: this.currentUser?.id || '0', userName: this.currentUser?.name || 'Sistema', timestamp: new Date().toISOString() });
    return true;
  }

  async releaseSectionLock(documentId: string, sectionId: string) {
    this.mockLocks.delete(`${documentId}:${sectionId}`);
  }

  async releaseAllMyLocks(documentId: string) {
    for (const [key, lock] of this.mockLocks.entries()) { if (key.startsWith(`${documentId}:`) && lock.userId === this.currentUser?.id) this.mockLocks.delete(key); }
  }

  async getActiveLocks(documentId: string) {
    const locks: Record<string, { userId: string; userName: string }> = {};
    for (const [key, lock] of this.mockLocks.entries()) { if (key.startsWith(`${documentId}:`)) locks[key.split(':')[1]] = lock; }
    return locks;
  }

  subscribeToLocks(documentId: string, callback: (locks: any) => void) {
    const interval = setInterval(() => callback(this.getActiveLocks(documentId)), 2000);
    return { unsubscribe: () => clearInterval(interval) };
  }

  // Files
  async uploadFile(projectId: string, file: File, isDataSource: boolean = false): Promise<UploadedFile> {
    try {
      if (supabase && this.isUUID(projectId)) {
        const filePath = `${projectId}/${file.name}`;
        await supabase.storage.from('Documentos').upload(filePath, file, { upsert: true });
        
        const { data: dbData, error: dbError } = await supabase
          .from('project_materials')
          .insert({
            project_id: projectId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.name.split('.').pop() || 'other',
            uploaded_by: this.currentUser?.id,
            status: 'PROCESSED',
            is_data_source: isDataSource
          })
          .select()
          .single();

        if (!dbError && dbData) {
          return {
            id: dbData.id,
            projectId: dbData.project_id,
            name: dbData.file_name,
            type: dbData.file_type as any,
            size: dbData.file_size,
            status: 'processed',
            uploadedBy: this.currentUser?.name || 'Usuário',
            uploadedAt: dbData.created_at,
            isDataSource: dbData.is_data_source
          };
        }
      }
    } catch (err) {}

    const mockFile: UploadedFile = {
      id: Date.now().toString(),
      projectId,
      name: file.name,
      type: 'pdf',
      size: file.size,
      status: 'processed',
      uploadedBy: 'Usuário',
      uploadedAt: new Date().toISOString(),
      isDataSource
    };
    const files = this.mockFiles.get(projectId) || [];
    files.push(mockFile);
    this.mockFiles.set(projectId, files);
    this.persistToLocalStorage();
    return mockFile;
  }

  async getProjectFiles(projectId: string): Promise<UploadedFile[]> {
    try {
      if (supabase && this.isUUID(projectId)) {
        const { data, error } = await supabase.from('project_materials').select('*').eq('project_id', projectId);
        if (!error && data) {
          return data.map(f => ({
            id: f.id,
            projectId: f.project_id,
            name: f.file_name,
            type: f.file_type as any,
            size: f.file_size,
            status: f.status?.toLowerCase() || 'processed',
            uploadedBy: 'Usuário',
            uploadedAt: f.created_at,
            isDataSource: f.is_data_source
          }));
        }
      }
    } catch (err) {}
    return this.mockFiles.get(projectId) || [];
  }

  async getFilePublicUrl(projectId: string, fileName: string): Promise<string> {
    try {
      if (supabase && this.isUUID(projectId)) {
        const { data, error } = await supabase
          .from('project_materials')
          .select('file_path')
          .eq('project_id', projectId)
          .eq('file_name', fileName)
          .single();
        
        if (!error && data?.file_path) {
          return supabase.storage.from('Documentos').getPublicUrl(data.file_path).data.publicUrl;
        }
      }
    } catch (err) {}
    return '#';
  }

  async deleteFile(projectId: string, fileId: string): Promise<void> {
    try {
      if (supabase && this.isUUID(fileId)) {
        const { data, error } = await supabase.from('project_materials').select('file_path').eq('id', fileId).single();
        if (!error && data?.file_path) {
          await supabase.storage.from('Documentos').remove([data.file_path]);
          await supabase.from('project_materials').delete().eq('id', fileId);
        }
      }
    } catch (err) {}
    const files = this.mockFiles.get(projectId) || [];
    this.mockFiles.set(projectId, files.filter(f => f.id !== fileId));
    this.persistToLocalStorage();
  }

  async setFileAsDataSource(projectId: string, fileId: string, isDataSource: boolean): Promise<void> {
    try {
      if (supabase && this.isUUID(fileId)) {
        await supabase.from('project_materials').update({ is_data_source: isDataSource }).eq('id', fileId);
      }
    } catch (err) {}
  }

  // Grupos
  async getGroups(): Promise<Group[]> {
    let supabaseGroups: Group[] = [];
    try {
      if (supabase) {
        const { data: groupsData, error: groupsError } = await supabase.from('groups').select('*');
        if (!groupsError && groupsData) {
          supabaseGroups = await Promise.all(groupsData.map(async (g) => {
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
      }
    } catch (err) {}
    
    // Merge mock groups
    const allGroups = [...supabaseGroups];
    this.mockGroups.forEach(mockGroup => {
      if (!allGroups.find(g => g.id === mockGroup.id)) {
        allGroups.push(mockGroup);
      }
    });
    return allGroups;
  }

  async createGroup(name: string, description?: string, parentId?: string, memberIds: string[] = [], responsibleId?: string, projectIds: string[] = []): Promise<Group> {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('groups')
          .insert({
            nome: name,
            descricao: description,
            responsavel_id: responsibleId,
            project_id: projectIds?.[0]
          })
          .select()
          .single();

        if (!error && data) {
          if (memberIds.length > 0) {
            await supabase
              .from('group_members')
              .insert(memberIds.map(uid => ({ group_id: data.id, user_id: uid })));
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
      }
    } catch (err) {
      console.warn('[APIService] Erro ao criar grupo no Supabase:', err);
    }

    const newGroup: Group = {
      id: Date.now().toString(),
      name,
      description,
      parentId,
      memberIds,
      responsibleId,
      projectIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.mockGroups.push(newGroup);
    this.persistToLocalStorage();
    return newGroup;
  }

  async updateGroup(updatedGroup: Group): Promise<Group> {
    try {
      if (supabase && this.isUUID(updatedGroup.id)) {
        await supabase
          .from('groups')
          .update({
            nome: updatedGroup.name,
            descricao: updatedGroup.description,
            responsavel_id: updatedGroup.responsibleId
          })
          .eq('id', updatedGroup.id);

        await supabase.from('group_members').delete().eq('group_id', updatedGroup.id);
        
        if (updatedGroup.memberIds.length > 0) {
          await supabase
            .from('group_members')
            .insert(updatedGroup.memberIds.map(uid => ({ group_id: updatedGroup.id, user_id: uid })));
        }
      }
    } catch (err) {
      console.warn('[APIService] Erro ao atualizar grupo no Supabase:', err);
    }

    const index = this.mockGroups.findIndex(g => g.id === updatedGroup.id);
    if (index !== -1) this.mockGroups[index] = updatedGroup;
    this.persistToLocalStorage();
    return updatedGroup;
  }

  async deleteGroup(groupId: string): Promise<boolean> {
    try {
      if (supabase && this.isUUID(groupId)) {
        await supabase.from('groups').delete().eq('id', groupId);
        return true;
      }
    } catch (err) {
      console.warn('[APIService] Erro ao deletar grupo no Supabase:', err);
    }

    const initialLength = this.mockGroups.length;
    this.mockGroups = this.mockGroups.filter(g => g.id !== groupId);
    this.persistToLocalStorage();
    return this.mockGroups.length < initialLength;
  }

  // Modelos
  async getDocumentModels(projectId?: string): Promise<DocumentModel[]> {
    try {
      if (supabase) {
        let query = supabase.from('templates').select('*');
        if (projectId) {
          query = query.or(`global.eq.true,project_id.eq.${projectId}`);
        }
        const { data, error } = await query;
        if (!error && data) {
          return data.map(t => ({
            id: t.id,
            name: t.nome,
            type: t.tipo_documento,
            templateContent: t.sections?.html || '',
            isGlobal: t.global === true,
            projectId: t.project_id,
            createdAt: t.created_at,
            updatedAt: t.updated_at
          }));
        }
      }
    } catch (err) {
      console.warn('[APIService] Erro ao buscar modelos no Supabase:', err);
    }
    return projectId 
      ? this.mockDocumentModels.filter(m => m.isGlobal || m.projectId === projectId) 
      : this.mockDocumentModels;
  }

  async createDocumentModel(name: string, type: string, templateContent: string, isGlobal: boolean = false, projectId?: string): Promise<DocumentModel> {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('templates')
          .insert({
            nome: name,
            tipo_documento: type,
            sections: { html: templateContent },
            global: isGlobal,
            project_id: projectId
          })
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            name: data.nome,
            type: data.tipo_documento,
            templateContent: data.sections?.html || '',
            isGlobal: data.global,
            projectId: data.project_id,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };
        }
      }
    } catch (err) {
      console.warn('[APIService] Erro ao criar modelo no Supabase:', err);
    }

    const model: DocumentModel = {
      id: Date.now().toString(),
      name,
      type,
      templateContent,
      isGlobal,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.mockDocumentModels.push(model);
      this.persistToLocalStorage();
    return model;
  }

  async updateDocumentModel(updatedModel: DocumentModel): Promise<DocumentModel> {
    try {
      if (supabase && this.isUUID(updatedModel.id)) {
        await supabase
          .from('templates')
          .update({
            nome: updatedModel.name,
            tipo_documento: updatedModel.type,
            sections: { html: updatedModel.templateContent },
            global: updatedModel.isGlobal
          })
          .eq('id', updatedModel.id);
      }
    } catch (err) {
      console.warn('[APIService] Erro ao atualizar modelo no Supabase:', err);
    }

    const index = this.mockDocumentModels.findIndex(m => m.id === updatedModel.id);
    if (index !== -1) this.mockDocumentModels[index] = updatedModel;
    this.persistToLocalStorage();
    return updatedModel;
  }

  async deleteDocumentModel(id: string): Promise<boolean> {
    try {
      if (supabase && this.isUUID(id)) {
        await supabase.from('templates').delete().eq('id', id);
        return true;
      }
    } catch (err) {
      console.warn('[APIService] Erro ao deletar modelo no Supabase:', err);
    }

    const initialLength = this.mockDocumentModels.length;
    this.mockDocumentModels = this.mockDocumentModels.filter(m => m.id !== id);
    this.persistToLocalStorage();
    return this.mockDocumentModels.length < initialLength;
  }

  getLocalModelDrafts = () => [];

  // Audit
  async getAuditLogs(projectId: string): Promise<AuditLog[]> {
    try {
      if (supabase && this.isUUID(projectId)) {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('entidade_id', projectId)
          .order('created_at', { ascending: false });
        
        if (!error && data) {
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
      }
    } catch (err) {}
    return this.mockAuditLogs.get(projectId) || [];
  }

  // AI & Wiki
  async generateWithAI(projectId: string, prompt: string, context?: any) { return "Conteúdo gerado pela IA SGID baseado no contexto do projeto."; }
  async chatWithAI(projectId: string, message: string, options: { documentId?: string }) { return "Resposta da IA SGID sobre o projeto."; }
  async analyzeProjectMaterials(projectId: string, callback?: (status: string) => void, isForce?: boolean) { if (callback) callback('Concluído'); return "Análise concluída."; }
  async analyzeProjectModels(projectId: string) { return "Modelos analisados."; }
  async hasExistingSummary(projectId: string) { return true; }
  async listWikiDocuments(page: number, pageSize: number) { return { data: [], total: 0 }; }

  // Outros
  getActiveUsers = (projectId: string) => [];
  async uploadModelFile(projectId: string, file: File) {}
  async deleteModelFile(projectId: string, fileName: string) {}

  // Helpers
  private decodeHtmlEntities(input: string): string { try { const doc = new DOMParser().parseFromString(input, 'text/html'); return doc.documentElement.textContent || input; } catch { return input; } }
  private parseTemplateContentToSections(templateContent: string): DocumentSection[] {
    const html = templateContent || ''; const sections: DocumentSection[] = [];
    try { const doc = new DOMParser().parseFromString(html, 'text/html'); const fields = doc.querySelectorAll('.sgid-metadata-field'); fields.forEach((el, i) => { sections.push({ id: el.getAttribute('data-field-id') || `field-${i}`, title: this.decodeHtmlEntities(el.getAttribute('data-field-title') || 'Campo'), content: '', isEditable: true }); }); } catch {}
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
