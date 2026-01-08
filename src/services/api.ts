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
  password: string; // Senha do usuário (em produção seria hashed)
  role: 'admin' | 'director' | 'manager' | 'technical_responsible' | 'operational';
  managerId?: string;
  createdAt: string;
  isActive?: boolean; // Adicionado para indicar se o usuário está ativo/suspenso
  forcePasswordChange?: boolean; // Força alteração de senha no próximo login
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  parentId?: string; // Para hierarquia de grupos
  memberIds: string[]; // IDs dos usuários membros
  responsibleId?: string; // ID do usuário responsável pelo grupo
  projectIds?: string[]; // IDs dos projetos atribuídos ao grupo
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
  status: 'RASCUNHO' | 'EM_APROVACAO' | 'APROVADO' | 'RECUSADO'; // Alinhado com o banco
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
  isDataSource?: boolean; // Adicionado para identificar fontes de dados da IA
  uploadedBy: string;
  uploadedAt: string;
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
  responsibleIds?: string[]; // Adicionado para gerentes e responsáveis técnicos
  groupIds?: string[]; // Adicionado para associar projetos a grupos
  documentIds: string[]; // IDs dos documentos dentro do projeto
}

export interface DocumentModel {
  id: string;
  name: string;
  type: string; // Ex: Ofício, Minuta, Especificação de Requisitos
  aiGuidance?: string; // Orientação para a IA
  templateContent: string; // Conteúdo do template em formato HTML
  isGlobal: boolean; // Se o modelo está disponível para todos os projetos
  isDraft?: boolean; // Adicionado para identificar se o modelo é um rascunho
  isLocalDraft?: boolean; // Adicionado para identificar rascunhos salvos apenas no localStorage
  projectId?: string; // Adicionado para vincular o modelo a um projeto específico
  createdAt: string;
  updatedAt: string;
}

class APIService {
  private readonly storageKey = 'sgid:mockdb:v1';
  private listeners: Set<{ event: string; callback: Function; filter?: any }> = new Set();
  // Em uma implementação real, esta classe seria um cliente HTTP que interage com um backend real.
  // A persistência de dados seria no banco de dados e não em memória (mock data).
  // A autenticação e autorização seriam tratadas por tokens JWT/OAuth com um servidor de autenticação.
  private dbConfig: DatabaseConfig | null = null;
  private aiConfig: AIConfig | null = null;
  private currentUser: User | null = null;
  
  // Mock data para demonstração
  private mockUsers: User[] = [
    {
      id: '1',
      email: 'admin@empresa.com',
      name: 'Admin Sistema',
      password: 'admin123',
      role: 'admin',
      createdAt: new Date().toISOString(),
      isActive: true,
      forcePasswordChange: false
    },
    {
      id: '2',
      email: 'diretor@empresa.com',
      name: 'Diretor Geral',
      password: 'diretor123',
      role: 'director',
      createdAt: new Date().toISOString(),
      isActive: true,
      forcePasswordChange: false
    },
    {
      id: '3',
      email: 'gerente@empresa.com',
      name: 'Gerente de Projeto',
      password: 'gerente123',
      role: 'manager',
      createdAt: new Date().toISOString(),
      isActive: true,
      forcePasswordChange: false
    },
    {
      id: '4',
      email: 'responsavel.tecnico@empresa.com',
      name: 'Responsável Técnico',
      password: 'tecnico123',
      role: 'technical_responsible',
      createdAt: new Date().toISOString(),
      isActive: true,
      forcePasswordChange: false
    },
    {
      id: '5',
      email: 'operacional@empresa.com',
      name: 'Designer UI',
      password: 'operacional123',
      role: 'operational',
      managerId: '3',
      createdAt: new Date().toISOString(),
      isActive: true,
      forcePasswordChange: false
    }
  ];

  private mockGroups: Group[] = [
    {
      id: 'g1',
      name: 'Engenharia de Software',
      description: 'Grupo responsável pelo desenvolvimento de software',
      memberIds: ['1', '2', '3', '4', '5'],
      responsibleId: '2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'g2',
      name: 'Infraestrutura',
      description: 'Grupo responsável pela infraestrutura e operações',
      parentId: 'g1',
      memberIds: ['1', '5'],
      responsibleId: '1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];

  private mockDocumentModels: DocumentModel[] = [
    {
      id: 'dm1',
      name: 'Modelo de Especificação de Requisitos',
      type: 'Especificação de Requisitos',
      templateContent: `<h1>1. Introdução</h1><p><!-- EDITABLE_SECTION_START:intro:Introdução --><!-- EDITABLE_SECTION_END --></p><h2>2. Visão Geral do Sistema</h2><p><!-- EDITABLE_SECTION_START:overview:Visão Geral --><!-- EDITABLE_SECTION_END --></p><h3>3. Requisitos Funcionais</h3><p><!-- EDITABLE_SECTION_START:functional:Requisitos Funcionais --><!-- EDITABLE_SECTION_END --></p><h4>4. Requisitos Não Funcionais</h4><p><!-- EDITABLE_SECTION_START:nonfunctional:Requisitos Não Funcionais --><!-- EDITABLE_SECTION_END --></p><h5>5. Regras de Negócio</h5><p><!-- EDITABLE_SECTION_START:business-rules:Regras de Negócio --><!-- EDITABLE_SECTION_END --></p><h6>6. Premissas e Restrições</h6><p><!-- EDITABLE_SECTION_START:constraints:Premissas e Restrições --><!-- EDITABLE_SECTION_END --></p>`,
      isGlobal: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'dm2',
      name: 'Modelo de Ata de Reunião',
      type: 'Ata',
      templateContent: `<p><strong>Participantes:</strong></p><p><!-- EDITABLE_SECTION_START:participantes:Participantes --><!-- EDITABLE_SECTION_END --></p><p><strong>Tópicos Discutidos:</strong></p><p><!-- EDITABLE_SECTION_START:topicos:Tópicos Discutidos --><!-- EDITABLE_SECTION_END --></p><p><strong>Próximas Ações:</strong></p><p><!-- EDITABLE_SECTION_START:acoes:Próximas Ações --><!-- EDITABLE_SECTION_END --></p>`,
      isGlobal: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];

  private mockProjects: Project[] = [
    {
      id: '1',
      name: 'Sistema de Gestão Financeira',
      description: 'Especificação de requisitos para o novo sistema de gestão financeira',
      creatorId: '3',
      creatorName: 'Usuário Padrão',
      status: 'in-progress',
      createdAt: new Date(2025, 11, 1).toISOString(),
      updatedAt: new Date(2025, 11, 10).toISOString(),
      documentIds: ['1']
    },
    {
      id: '2',
      name: 'Portal do Cliente',
      description: 'Documentação completa do portal de autoatendimento',
      creatorId: '2',
      creatorName: 'Gerente de Projeto',
      status: 'review',
      createdAt: new Date(2025, 10, 15).toISOString(),
      updatedAt: new Date(2025, 11, 12).toISOString(),
      documentIds: []
    }
  ];

  private mockDocuments: Map<string, Document> = new Map([
    ['1', {
      id: '1',
      projectId: '1',
      name: 'Especificação de Requisitos - v1',
      groupId: 'g1',
      securityLevel: 'confidential',
      templateId: 'dm1',
      creatorId: '3',
      creatorName: 'Usuário Padrão',
      currentVersionId: 'v1_3',
      createdAt: new Date(2025, 11, 1).toISOString(),
      updatedAt: new Date(2025, 11, 10).toISOString(),
      sharedWith: []
    }]
  ]);

  private mockDocumentVersions: Map<string, DocumentVersion[]> = new Map([
    ['1', [
      {
        id: 'v1_1',
        documentId: '1',
        versionNumber: 1,
        updatedAt: new Date(2025, 11, 1, 10, 0, 0).toISOString(),
        updatedBy: 'Usuário Padrão',
        content: {
          sections: [
            { id: 'intro', title: '1. Introdução', content: 'Conteúdo inicial da introdução.', isEditable: true },
            { id: 'overview', title: '2. Visão Geral do Sistema', content: 'Conteúdo inicial da visão geral.', isEditable: true },
            { id: 'functional', title: '3. Requisitos Funcionais', content: 'RF001: Requisito inicial 1.', isEditable: true },
          ]
        }
      },
      {
        id: 'v1_2',
        documentId: '1',
        versionNumber: 2,
        updatedAt: new Date(2025, 11, 1, 11, 30, 0).toISOString(),
        updatedBy: 'Gerente de Projeto',
        content: {
          sections: [
            { id: 'intro', title: '1. Introdução', content: 'Conteúdo da introdução após primeira edição.', isEditable: true },
            { id: 'overview', title: '2. Visão Geral do Sistema', content: 'Conteúdo da visão geral após primeira edição.', isEditable: true },
            { id: 'functional', title: '3. Requisitos Funcionais', content: 'RF001: Requisito editado 1.\nRF002: Novo requisito 2.', isEditable: true },
          ]
        }
      },
      {
        id: 'v1_3',
        documentId: '1',
        versionNumber: 3,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin Sistema',
        content: {
          sections: [
            { id: 'intro', title: '1. Introdução', content: 'Este documento especifica os requisitos para o Sistema de Gestão Financeira da empresa.', isEditable: true },
            { id: 'overview', title: '2. Visão Geral do Sistema', content: 'O sistema tem como objetivo automatizar processos financeiros, incluindo contas a pagar, contas a receber e conciliação bancária.', isEditable: true },
            { id: 'functional', title: '3. Requisitos Funcionais', content: 'RF001: O sistema deve permitir o cadastro de fornecedores.\nRF002: O sistema deve gerar relatórios de fluxo de caixa.\nRF003: O sistema deve integrar com bancos via API.',
              isEditable: true
            },
            { id: 'nonfunctional', title: '4. Requisitos Não Funcionais', content: 'RNF001: O sistema deve suportar 1000 usuários simultâneos.\nRNF002: Tempo de resposta inferior a 2 segundos.',
              isEditable: true
            },
            { id: 'business-rules', title: '5. Regras de Negócio', content: 'RN001: Pagamentos acima de R$ 10.000 requerem dupla aprovação.\nRN002: Conciliação bancária deve ser realizada diariamente.',
              isEditable: true
            },
            { id: 'constraints', title: '6. Premissas e Restrições', content: 'Premissa: API bancária estará disponível.\nRestrição: Sistema deve estar em conformidade com a LGPD.',
              isEditable: true
            }
          ]
        }
      },
    ]],
  ]);

  private mockFiles: Map<string, UploadedFile[]> = new Map();
  private mockAuditLogs: Map<string, AuditLog[]> = new Map();

  constructor() {
    this.hydrateFromLocalStorage();
  }

  private persistToLocalStorage(): void {
    try {
      const payload = {
        version: 1,
        savedAt: new Date().toISOString(),
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
      console.warn('[SGID] Falha ao persistir mockdb no localStorage:', error);
    }
  }

  private hydrateFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);

      if (!parsed || parsed.version !== 1) return;

      if (Array.isArray(parsed.users)) {
        // Restaura usuários do localStorage mas valida as senhas
        this.mockUsers = parsed.users;
        // Garante que os usuários padrão têm as senhas corretas
        this.ensureDefaultPasswords();
      }
      if (Array.isArray(parsed.groups)) this.mockGroups = parsed.groups;
      if (Array.isArray(parsed.documentModels)) this.mockDocumentModels = parsed.documentModels;
      if (Array.isArray(parsed.projects)) this.mockProjects = parsed.projects;

      if (Array.isArray(parsed.documents)) this.mockDocuments = new Map(parsed.documents);
      if (Array.isArray(parsed.documentVersions)) this.mockDocumentVersions = new Map(parsed.documentVersions);
      if (Array.isArray(parsed.files)) this.mockFiles = new Map(parsed.files);
      if (Array.isArray(parsed.auditLogs)) this.mockAuditLogs = new Map(parsed.auditLogs);
    } catch (error) {
      console.warn('[SGID] Falha ao hidratar mockdb do localStorage:', error);
    }
  }

  // Garante que os usuários padrão têm as senhas corretas
  private ensureDefaultPasswords(): void {
    const defaultPasswords: { [key: string]: string } = {
      'admin@empresa.com': 'admin123',
      'diretor@empresa.com': 'diretor123',
      'gerente@empresa.com': 'gerente123',
      'responsavel.tecnico@empresa.com': 'tecnico123',
      'operacional@empresa.com': 'operacional123',
    };

    for (const [email, password] of Object.entries(defaultPasswords)) {
      const user = this.mockUsers.find(u => u.email === email);
      if (user && user.password !== password) {
        console.warn(`[SGID] Corrigindo senha do usuário ${email}`);
        user.password = password;
      }
    }
  }

  // Configuração do banco de dados
  async configurarBancoDeDados(config: DatabaseConfig): Promise<boolean> {
    try {
      // Aqui seria feita a conexão real com o banco de dados
      // usando as credenciais fornecidas
      console.log('Configurando conexão com banco de dados:', {
        type: config.type,
        host: config.host,
        port: config.port,
        database: config.database
      });
      
      this.dbConfig = config;
      localStorage.setItem('db_config', JSON.stringify(config));
      return true;
    } catch (error) {
      console.error('Erro ao configurar banco de dados:', error);
      return false;
    }
  }

  getConfiguracao(): DatabaseConfig | null {
    if (this.dbConfig) return this.dbConfig;
    
    const stored = localStorage.getItem('db_config');
    if (stored) {
      this.dbConfig = JSON.parse(stored);
      return this.dbConfig;
    }
    
    return null;
  }

  // Configuração da IA
  async configurarIA(config: AIConfig): Promise<boolean> {
    try {
      // Aqui seria feita a configuração real da IA
      // usando as credenciais fornecidas
      console.log('Configurando IA:', {
        provider: config.provider,
        apiKey: config.apiKey
      });
      
      this.aiConfig = config;
      localStorage.setItem('ai_config', JSON.stringify(config));
      return true;
    } catch (error) {
      console.error('Erro ao configurar IA:', error);
      return false;
    }
  }

  getAIConfiguracao(): AIConfig | null {
    if (this.aiConfig) return this.aiConfig;
    
    const stored = localStorage.getItem('ai_config');
    if (stored) {
      this.aiConfig = JSON.parse(stored);
      return this.aiConfig;
    }
    
    return null;
  }

  // Autenticação
  // Em um ambiente de produção, este método faria uma chamada a um serviço de autenticação real,
  // que retornaria um token JWT ou OAuth após validar as credenciais.
  // O token seria armazenado no cliente e enviado em todas as requisições subsequentes para autorização.
  async login(email: string, password: string): Promise<User | null> {
    try {
      console.log(`[APIService] Tentando login Supabase para: ${email}`);
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!authError && authData.user) {
        console.log('[APIService] Login Supabase Auth bem-sucedido, buscando dados na tabela public.users');
        
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (!userError && userData) {
          const user: User = {
            id: userData.id,
            email: userData.email,
            name: userData.nome || 'Usuário',
            password: '', 
            role: (userData.role as any) || 'operational',
            createdAt: userData.created_at || new Date().toISOString(),
            isActive: userData.status === 'ATIVO',
            forcePasswordChange: userData.force_password_change || false
          };
          
          this.currentUser = user;
          localStorage.setItem('current_user', JSON.stringify(user));
          console.log('[APIService] Login completo com sucesso:', user);
          return user;
        } else {
          console.warn('[APIService] Usuário autenticado no Auth, mas não encontrado na tabela public.users:', userError);
          const fallbackUser: User = {
            id: authData.user.id,
            email: authData.user.email!,
            name: authData.user.user_metadata?.full_name || authData.user.email!.split('@')[0],
            password: '',
            role: 'operational',
            createdAt: authData.user.created_at,
            isActive: true,
            forcePasswordChange: false
          };
          this.currentUser = fallbackUser;
          localStorage.setItem('current_user', JSON.stringify(fallbackUser));
          return fallbackUser;
        }
      }
    } catch (err) {
      console.error('[APIService] Erro inesperado no login Supabase:', err);
    }

    console.log('[APIService] Tentando login via Mock Users (fallback)');
    let user = this.mockUsers.find(u => u.email === email);
    if (!user) return null;
    if (password !== user.password) return null;
    if (!user.isActive) throw new Error('Usuário inativo. Entre em contato com o administrador.');
    
    this.currentUser = user;
    localStorage.setItem('current_user', JSON.stringify(user));
    return user;
  }

  async register(email: string, password: string, name: string, role: User['role'] = 'operational', forcePasswordChange: boolean = true): Promise<User | null> {
    try {
      console.log(`[APIService] Tentando registro Supabase para: ${email}`);
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } }
      });

      if (authError) throw authError;

      if (authData.user) {
        console.log('[APIService] Registro Supabase Auth bem-sucedido, criando entrada na tabela public.users');
        
        const roleToTipo: Record<string, string> = {
          'admin': 'ADM',
          'director': 'DIRETOR',
          'manager': 'GERENTE',
          'technical_responsible': 'TECNICO',
          'operational': 'OPERACIONAL'
        };

        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email,
            nome: name,
            tipo: roleToTipo[role] || 'OPERACIONAL',
            role: role,
            status: 'ATIVO',
            force_password_change: forcePasswordChange,
            ai_preferences: {}
          });

        if (userError) console.error('[APIService] Erro ao salvar usuário na tabela public.users:', userError);

        const user: User = {
          id: authData.user.id,
          email,
          name,
          password: '',
          role,
          createdAt: new Date().toISOString(),
          isActive: true,
          forcePasswordChange
        };
        return user;
      }
    } catch (err: any) {
      console.error('[APIService] Erro inesperado no registro Supabase:', err);
    }

    const newUser: User = {
      id: Date.now().toString(),
      email,
      name,
      password,
      role,
      createdAt: new Date().toISOString(),
      isActive: true,
      forcePasswordChange
    };
    this.mockUsers.push(newUser);
    this.persistToLocalStorage();
    return newUser;
  }

  logout(): void {
    supabase.auth.signOut().catch(err => console.error('[APIService] Erro ao deslogar do Supabase:', err));
    this.currentUser = null;
    localStorage.removeItem('current_user');
  }

  getCurrentUser(): User | null {
    if (this.currentUser) return this.currentUser;
    
    const stored = localStorage.getItem('current_user');
    if (stored) {
      this.currentUser = JSON.parse(stored);
      return this.currentUser;
    }
    
    return null;
  }

  // Debug: Lista usuários disponíveis
  debugUsers(): void {
    console.log('[SGID] Usuários Disponíveis:', this.mockUsers.map(u => ({
      email: u.email,
      name: u.name,
      password: u.password,
      role: u.role
    })));
  }

  // Realtime Subscriptions (Mock & Supabase)
  subscribeToDocuments(projectId: string | null, callback: () => void) {
    console.log(`[APIService] Subscribing to documents for project: ${projectId}`);
    
    // Supabase Realtime (se as tabelas existirem)
    const channel = supabase
      .channel('public:documents')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'documents',
        filter: projectId ? `project_id=eq.${projectId}` : undefined 
      }, () => {
        callback();
      })
      .subscribe();

    // Mock local listener
    const listener = { event: 'documents_changed', callback, filter: projectId };
    this.listeners.add(listener);

    return {
      unsubscribe: () => {
        console.log(`[APIService] Unsubscribing from documents: ${projectId}`);
        supabase.removeChannel(channel);
        this.listeners.delete(listener);
      }
    };
  }

  subscribeToDocument(documentId: string, callback: (doc: Document) => void) {
    console.log(`[APIService] Subscribing to document: ${documentId}`);
    
    const channel = supabase
      .channel(`document:${documentId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'documents',
        filter: `id=eq.${documentId}` 
      }, (payload) => {
        callback(payload.new as Document);
      })
      .subscribe();

    const listener = { event: `document_changed:${documentId}`, callback };
    this.listeners.add(listener);

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
        this.listeners.delete(listener);
      }
    };
  }

  subscribeToLocks(documentId: string, callback: (locks: any[]) => void) {
    console.log(`[APIService] Subscribing to locks for document: ${documentId}`);
    
    // Em produção, isso usaria Supabase Presence ou uma tabela de locks
    const channel = supabase
      .channel(`locks:${documentId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const locks = Object.values(state).flat();
        callback(locks);
      })
      .subscribe();

    const listener = { event: `locks_changed:${documentId}`, callback };
    this.listeners.add(listener);

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
        this.listeners.delete(listener);
      }
    };
  }

  private notifyListeners(event: string, data?: any, filter?: any) {
    this.listeners.forEach(l => {
      if (l.event === event) {
        if (!l.filter || l.filter === filter) {
          l.callback(data);
        }
      }
    });
  }

  // Métodos de Bloqueio (Locks)
  async getActiveLocks(documentId: string): Promise<any[]> {
    // Mock: em produção usaria Supabase Presence
    return [];
  }

  async acquireSectionLock(documentId: string, sectionId: string): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) return;
    console.log(`[APIService] Usuário ${user.name} adquiriu lock na seção ${sectionId}`);
    // Notifica outros listeners locais (mock)
    this.notifyListeners(`locks_changed:${documentId}`, []);
  }

  async releaseSectionLock(documentId: string, sectionId: string): Promise<void> {
    console.log(`[APIService] Lock liberado na seção ${sectionId}`);
    // Notifica outros listeners locais (mock)
  }

  async updateDocumentSection(documentId: string, sectionId: string, content: string): Promise<void> {
    const doc = await this.getDocumentById(documentId);
    if (!doc || !doc.content) return;

    const updatedSections = doc.content.sections.map(s => 
      s.id === sectionId ? { ...s, content } : s
    );

    await this.updateDocument(documentId, { sections: updatedSections });
    this.notifyListeners(`document_changed:${documentId}`, { ...doc, content: { sections: updatedSections } });
    this.notifyListeners('documents_changed', null, doc.projectId);
  }

  async hasExistingSummary(projectId: string): Promise<boolean> {
    // Mock: verifica se existe algum log de IA ou se há documentos processados
    const files = await this.getProjectFiles(projectId);
    return files.some(f => f.status === 'processed');
  }

  isUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  // Reset: Limpa cache e restaura dados padrão
  resetToDefaults(): void {
    console.warn('[SGID] Resetando dados para valores padrão');
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem('current_user');
    window.location.reload();
  }

  // Busca rascunhos que foram salvos automaticamente pelo editor no localStorage
  getLocalModelDrafts(): DocumentModel[] {
    const drafts: DocumentModel[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Pega qualquer rascunho, inclusive o 'new' se tiver algo nele
      if (key?.startsWith('model_draft_')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const draft = JSON.parse(raw);
            // Só adiciona se tiver pelo menos um nome ou conteúdo
            if (draft.name || (draft.templateContent && draft.templateContent !== '<p><br></p>')) {
              drafts.push({
                ...draft,
                id: key, 
                name: draft.name || (key === 'model_draft_new' ? 'Novo Modelo (Rascunho)' : 'Modelo sem nome'),
                type: draft.type || 'Tipo não definido',
                aiGuidance: draft.aiGuidance || '',
                templateContent: draft.templateContent || '',
                isLocalDraft: true,
                isDraft: true,
                isGlobal: false,
                createdAt: draft.lastSaved || new Date().toISOString(),
                updatedAt: draft.lastSaved || new Date().toISOString()
              } as DocumentModel & { isLocalDraft: boolean });
            }
          }
        } catch (e) {
          console.warn('[SGID] Erro ao carregar rascunho local:', key);
        }
      }
    }
    return drafts;
  }


  async getProjects(): Promise<Project[]> {
    const user = this.getCurrentUser();
    if (!user) return [];

    try {
      console.log('[APIService] Buscando projetos do Supabase');
      const { data, error } = await supabase
        .from('projects')
        .select('*');

      if (error) throw error;

      if (data) {
        return data.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          creatorId: p.creator_id,
          creatorName: 'Usuário', // Join com admin_users omitido por simplicidade
          status: p.status as any,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          responsibleIds: p.responsible_id ? [p.responsible_id] : [],
          groupIds: [],
          documentIds: []
        }));
      }
    } catch (err) {
      console.error('[APIService] Erro ao buscar projetos do Supabase:', err);
    }

    if (user.role === 'admin') {
      return this.mockProjects;
    }
    return this.mockProjects.filter(p => p.creatorId === user.id);
  }

  async createProject(name: string, description?: string, responsibleIds?: string[], groupIds?: string[]): Promise<Project> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      console.log('[APIService] Criando projeto no Supabase (novo schema)');
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: name,
          description: description || '',
          status: 'draft',
          creator_id: user.id,
          responsible_id: responsibleIds && responsibleIds.length > 0 ? responsibleIds[0] : null
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newProject: Project = {
          id: data.id,
          name: data.name,
          description: data.description,
          creatorId: data.creator_id,
          creatorName: user.name,
          status: data.status as any,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          responsibleIds: data.responsible_id ? [data.responsible_id] : [],
          groupIds: groupIds || [],
          documentIds: []
        };
        this.addAuditLog(newProject.id, 'project_created', user.id, user.name, `Projeto "${name}" criado no Supabase`);
        return newProject;
      }
    } catch (err) {
      console.error('[APIService] Erro ao criar projeto no Supabase:', err);
    }

    // Fallback Mock
    const newProject: Project = {
      id: Date.now().toString(),
      name,
      description,
      creatorId: user.id,
      creatorName: user.name,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      responsibleIds: responsibleIds || [],
      groupIds: groupIds || [],
      documentIds: [],
    };

    this.mockProjects.push(newProject);
    this.addAuditLog(newProject.id, 'project_created', user.id, user.name, `Projeto "${name}" criado no mock`);
    this.persistToLocalStorage();

    return newProject;
  }

  private decodeHtmlEntities(input: string): string {
    try {
      const doc = new DOMParser().parseFromString(input, 'text/html');
      return doc.documentElement.textContent || input;
    } catch {
      return input;
    }
  }

  /**
   * Converte o templateContent (HTML) em seções.
   *
   * Compatibilidade:
   * - Novo: placeholders criados no editor como <div class="sgid-metadata-field" data-field-id="..." data-field-title="...">...</div>
   * - Antigo: comentários <!-- EDITABLE_SECTION_START:id:title -->...<!-- EDITABLE_SECTION_END -->
   */
  private parseTemplateContentToSections(templateContent: string): DocumentSection[] {
    const normalizeHtml = (html: string) => {
      try {
        return new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
      } catch {
        return html;
      }
    };

    const html = normalizeHtml(templateContent || '');
    // 1) Novo formato: sgid-metadata-field (gerado pelo editor de modelos)
    // Importante: NÃO usar regex aqui, porque o campo agora possui DIVs internos (header/textarea).
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const body = doc.body;

      const sections: DocumentSection[] = [];
      let fixedBuffer = '';
      let foundMetadataFields = false;

      const serializeNode = (node: ChildNode) => {
        // ignora apenas whitespace
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          return text.trim() ? text : '';
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
          return (node as HTMLElement).outerHTML || '';
        }
        return '';
      };

      for (const node of Array.from(body.childNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.classList.contains('sgid-metadata-field')) {
            foundMetadataFields = true;

            if (fixedBuffer.trim()) {
              sections.push({
                id: `fixed-${Date.now()}-${sections.length}`,
                title: '',
                content: fixedBuffer.trim(),
                isEditable: false,
              });
              fixedBuffer = '';
            }

            const fieldId = (el.getAttribute('data-field-id') || '').trim() || `field-${Date.now()}`;
            const fieldTitleRaw = (el.getAttribute('data-field-title') || '').trim();
            const fieldTitle = this.decodeHtmlEntities(fieldTitleRaw) || 'Campo';

            sections.push({
              id: fieldId,
              title: fieldTitle,
              content: '',
              isEditable: true,
            });
            continue;
          }
        }

        fixedBuffer += serializeNode(node);
      }

      if (foundMetadataFields) {
        if (fixedBuffer.trim()) {
          sections.push({
            id: `fixed-${Date.now()}-${sections.length}`,
            title: '',
            content: fixedBuffer.trim(),
            isEditable: false,
          });
        }
        return sections;
      }
    } catch {
      // Se falhar por qualquer motivo, segue para o parser legado abaixo.
    }

    // 2) Formato antigo: comentários EDITABLE_SECTION_START/END
    const legacySections: DocumentSection[] = [];
    const legacyRegex = /<!-- EDITABLE_SECTION_START:([^:]+):([^>]+) -->(.*?)<!-- EDITABLE_SECTION_END -->/gs;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = legacyRegex.exec(html)) !== null) {
      const fixedContentBefore = html.substring(lastIndex, match.index);

      if (fixedContentBefore.trim()) {
        legacySections.push({
          id: `fixed-${Date.now()}-${legacySections.length}`,
          title: '',
          content: fixedContentBefore.trim(),
          isEditable: false,
        });
      }

      const id = (match[1] || '').trim() || `field-${Date.now()}`;
      const title = this.decodeHtmlEntities((match[2] || '').trim());

      legacySections.push({
        id,
        title,
        content: '',
        isEditable: true,
      });
      lastIndex = legacyRegex.lastIndex;
    }

    const fixedContentAfter = html.substring(lastIndex);
    if (fixedContentAfter.trim()) {
      legacySections.push({
        id: `fixed-${Date.now()}-${legacySections.length}`,
        title: '',
        content: fixedContentAfter.trim(),
        isEditable: false,
      });
    }

    return legacySections;
  }

  async getProject(projectId: string): Promise<Project | null> {
    try {
      if (!this.isUUID(projectId)) {
        return this.mockProjects.find(p => p.id === projectId) || null;
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      if (data) {
        return {
          id: data.id,
          name: data.name,
          description: data.description,
          creatorId: data.creator_id,
          creatorName: 'Usuário',
          status: data.status as any,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          responsibleIds: data.responsible_id ? [data.responsible_id] : [],
          groupIds: [],
          documentIds: []
        };
      }
    } catch (err) {
      console.error('[APIService] Erro ao buscar projeto no Supabase:', err);
    }
    return this.mockProjects.find(p => p.id === projectId) || null;
  }

  async updateProject(updatedProject: Project): Promise<Project> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      if (this.isUUID(updatedProject.id)) {
        console.log('[APIService] Atualizando projeto no Supabase:', updatedProject.id);
        const { data, error } = await supabase
          .from('projects')
          .update({
            name: updatedProject.name,
            description: updatedProject.description,
            status: updatedProject.status,
            responsible_id: updatedProject.responsibleIds && updatedProject.responsibleIds.length > 0 ? updatedProject.responsibleIds[0] : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', updatedProject.id)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          return {
            ...updatedProject,
            updatedAt: data.updated_at
          };
        }
      }
    } catch (err) {
      console.error('[APIService] Erro ao atualizar projeto no Supabase:', err);
    }

    const index = this.mockProjects.findIndex(p => p.id === updatedProject.id);
    if (index === -1) {
      throw new Error('Projeto não encontrado');
    }

    // Lógica de permissão simplificada: apenas criador, gerente ou admin podem editar
    const existingProject = this.mockProjects[index];
    if (existingProject.creatorId !== user.id && user.role !== 'manager' && user.role !== 'admin') {
      throw new Error('Permissão negada: Você não tem permissão para editar este projeto.');
    }

    const projectToUpdate: Project = {
      ...updatedProject,
      updatedAt: new Date().toISOString() // Atualizar timestamp de atualização
    };

    this.mockProjects[index] = projectToUpdate;

    // Log de auditoria
    this.addAuditLog(projectToUpdate.id, 'project_updated', user.id, user.name, `Projeto "${projectToUpdate.name}" atualizado no mock`);
    this.persistToLocalStorage();

    return projectToUpdate;
  }

  // Documentos
  async getDocument(projectId: string): Promise<Document | null> {
    try {
      if (this.isUUID(projectId)) {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('project_id', projectId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          return {
            id: data.id,
            projectId: data.project_id,
            name: data.nome,
            templateId: data.template_id,
            securityLevel: data.nivel_sigilo as any,
            status: data.status as any,
            creatorId: data.created_by,
            creatorName: 'Usuário',
            currentVersionId: data.id,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            content: data.conteudo as any,
            version: 1
          } as Document;
        }
      }
    } catch (err) {
      console.error('[APIService] Erro ao buscar documento no Supabase:', err);
    }
    const doc = this.mockDocuments.get(projectId);
    if (!doc) return null;
    const versions = this.mockDocumentVersions.get(projectId);
    const currentVersion = versions?.find(v => v.id === doc.currentVersionId);
    if (!currentVersion) return null;
    return {
      ...doc,
      content: currentVersion.content,
      version: currentVersion.versionNumber,
      updatedAt: currentVersion.updatedAt,
      updatedBy: currentVersion.updatedBy,
    } as Document;
  }

  async getDocumentById(documentId: string): Promise<Document | null> {
    try {
      if (this.isUUID(documentId)) {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (error) throw error;
        if (data) {
          return {
            id: data.id,
            projectId: data.project_id,
            name: data.nome,
            templateId: data.template_id,
            securityLevel: data.nivel_sigilo as any,
            status: data.status as any,
            creatorId: data.created_by,
            creatorName: 'Usuário',
            currentVersionId: data.id,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            content: data.conteudo as any,
            version: 1
          } as Document;
        }
      }
    } catch (err) {
      console.error('[APIService] Erro ao buscar documento por ID no Supabase:', err);
    }
    const doc = this.mockDocuments.get(documentId);
    if (!doc) return null;
    const versions = this.mockDocumentVersions.get(documentId);
    const currentVersion = versions?.find(v => v.id === doc.currentVersionId);
    if (!currentVersion) return null;
    return {
      ...doc,
      content: currentVersion.content,
      version: currentVersion.versionNumber,
      updatedBy: currentVersion.updatedBy
    };
  }

  async updateDocument(projectIdOrDocumentId: string, content: DocumentContent): Promise<Document> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      if (this.isUUID(projectIdOrDocumentId)) {
        const { data, error } = await supabase
          .from('documents')
          .update({
            conteudo: content,
            updated_at: new Date().toISOString()
          })
          .eq('id', projectIdOrDocumentId)
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            projectId: data.project_id,
            name: data.nome,
            templateId: data.template_id,
            securityLevel: data.nivel_sigilo as any,
            status: data.status as any,
            creatorId: data.created_by,
            creatorName: user.name,
            currentVersionId: data.id,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            content: data.conteudo as any,
            version: 1
          } as Document;
        }
      }
    } catch (err) {
      console.error('[APIService] Erro ao atualizar documento no Supabase:', err);
    }

    const doc = this.mockDocuments.get(projectIdOrDocumentId);
    if (!doc) throw new Error('Documento não encontrado');

    const versions = this.mockDocumentVersions.get(projectIdOrDocumentId) || [];
    const newVersionNumber = versions.length > 0 ? Math.max(...versions.map(v => v.versionNumber)) + 1 : 1;
    const newVersionId = `v${projectIdOrDocumentId}_${newVersionNumber}`;

    const newVersion: DocumentVersion = {
      id: newVersionId,
      documentId: projectIdOrDocumentId,
      versionNumber: newVersionNumber,
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
      content,
    };

    versions.push(newVersion);
    this.mockDocumentVersions.set(projectIdOrDocumentId, versions);

    doc.currentVersionId = newVersionId;
    doc.updatedAt = new Date().toISOString();
    this.mockDocuments.set(projectIdOrDocumentId, doc);

    // Log de auditoria
    this.addAuditLog(doc.projectId, 'document_edited', user.id, user.name, `Documento editado manualmente (versão ${newVersionNumber})`);
    this.persistToLocalStorage();

    const updatedDoc = {
      id: doc.id,
      projectId: doc.projectId,
      currentVersionId: doc.currentVersionId,
      sharedWith: doc.sharedWith,
      content: newVersion.content, // Conteúdo vem da nova versão
      version: newVersion.versionNumber, // Versão vem da nova versão
      updatedAt: newVersion.updatedAt, // Data de atualização vem da nova versão
      updatedBy: newVersion.updatedBy, // Usuário que atualizou vem da nova versão
    } as Document;

    this.notifyListeners(`document_changed:${doc.id}`, updatedDoc);
    this.notifyListeners('documents_changed', null, doc.projectId);

    return updatedDoc;
  }

  /**
   * Salva uma cópia do documento atual e do modelo associado (se houver) no localStorage.
   * Observação: isto NÃO cria uma nova versão no histórico (não chama updateDocument).
   */
  async saveDocumentAndModelToLocalStorage(
    projectId: string,
    content: DocumentContent
  ): Promise<{ documentKey: string; modelKey?: string }> {
    const user = this.getCurrentUser();
    const project = await this.getProject(projectId);

    const documentKey = `sgid:savedDocument:${projectId}`;
    const payload = {
      projectId,
      savedAt: new Date().toISOString(),
      savedBy: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
      project: project || null,
      documentModelId: project?.documentModelId || null,
      content,
    };

    localStorage.setItem(documentKey, JSON.stringify(payload));

    let modelKey: string | undefined;
    const modelId = project?.documentModelId;
    if (modelId) {
      const model = this.mockDocumentModels.find(m => m.id === modelId);
      if (model) {
        modelKey = `sgid:savedDocumentModel:${modelId}`;
        localStorage.setItem(modelKey, JSON.stringify({ ...model, savedAt: payload.savedAt }));
      }
    }

    return { documentKey, modelKey };
  }

  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    // Lógica de permissão: Apenas usuários com permissão de visualização no documento podem ver as versões
    const document = this.mockDocuments.get(documentId);
    if (!document) throw new Error('Documento não encontrado');

    // Aqui, em um sistema real, checaríamos se o usuário tem permissão para ver o documento.
    // No mock, vamos assumir que se ele chamou a função, ele tem acesso.

    const versions = this.mockDocumentVersions.get(documentId) || [];
    return versions.sort((a, b) => b.versionNumber - a.versionNumber); // Mais recente primeiro
  }

  async createDocument(
    projectId: string,
    name: string,
    templateId: string | undefined,
    securityLevel: 'public' | 'restricted' | 'confidential' | 'secret',
    groupId?: string
  ): Promise<Document> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      if (this.isUUID(projectId)) {
        let initialSections: DocumentSection[] = [];
        if (templateId && this.isUUID(templateId)) {
          const { data: templateData } = await supabase
            .from('templates')
            .select('sections')
            .eq('id', templateId)
            .single();
          if (templateData?.sections) {
            initialSections = this.parseTemplateContentToSections((templateData.sections as any).html || '');
          }
        } else {
          initialSections = [{ id: 'section1', title: 'Seção 1', content: '', isEditable: true }];
        }

        const { data, error } = await supabase
          .from('documents')
          .insert({
            nome: name,
            project_id: projectId,
            template_id: templateId || null,
            status: 'RASCUNHO', // Ajustado para o padrão do banco
            nivel_sigilo: securityLevel,
            created_by: user.id,
            conteudo: { sections: initialSections }
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          const doc: Document = {
            id: data.id,
            projectId: data.project_id,
            name: data.nome,
            templateId: data.template_id,
            securityLevel: data.nivel_sigilo as any,
            status: data.status as any, // Adicionado mapeamento de status
            creatorId: data.created_by,
            creatorName: user.name,
            currentVersionId: data.id,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            content: data.conteudo as any,
            version: 1
          };
          this.addAuditLog(projectId, 'document_created', user.id, user.name, `Documento "${name}" criado no Supabase`);
          return doc;
        }
      }
    } catch (err) {
      console.error('[APIService] Erro ao criar documento no Supabase:', err);
    }

    const project = await this.getProject(projectId);
    if (!project) throw new Error('Projeto não encontrado');

    const newDocumentId = `doc_${Date.now()}`;
    
    // Determinar seções iniciais baseado no template
    let initialSections: DocumentSection[] = [];
    
    if (templateId) {
      const template = this.mockDocumentModels.find(m => m.id === templateId);
      if (template && template.templateContent) {
        initialSections = this.parseTemplateContentToSections(template.templateContent);
      }
    } else {
      // Seções padrão se nenhum template for selecionado
      initialSections = [
        { id: 'section1', title: 'Seção 1', content: '', isEditable: true },
        { id: 'section2', title: 'Seção 2', content: '', isEditable: true }
      ];
    }

    // Criar primeira versão
    const firstVersionId = `v${newDocumentId}_1`;
    const firstVersion: DocumentVersion = {
      id: firstVersionId,
      documentId: newDocumentId,
      versionNumber: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
      content: {
        sections: initialSections
      }
    };

    // Criar documento
    const newDocument: Document = {
      id: newDocumentId,
      projectId,
      name,
      groupId,
      securityLevel,
      status: 'RASCUNHO', // Inicializado como rascunho
      templateId,
      creatorId: user.id,
      creatorName: user.name,
      currentVersionId: firstVersionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sharedWith: []
    };

    // Adicionar documento aos dados
    this.mockDocuments.set(newDocumentId, newDocument);
    this.mockDocumentVersions.set(newDocumentId, [firstVersion]);

    // Adicionar documento à lista de documentos do projeto
    if (project.documentIds) {
      project.documentIds.push(newDocumentId);
    }
    project.updatedAt = new Date().toISOString();
    
    const projectIndex = this.mockProjects.findIndex(p => p.id === projectId);
    if (projectIndex !== -1) {
      this.mockProjects[projectIndex] = project;
    }

    // Log de auditoria
    this.addAuditLog(projectId, 'document_created', user.id, user.name, `Documento "${name}" criado no projeto mock`);
    this.persistToLocalStorage();

    return newDocument;
  }

  async listProjectDocuments(projectId: string): Promise<Document[]> {
    try {
      if (this.isUUID(projectId)) {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('project_id', projectId);

        if (error) throw error;
        if (data) {
          return data.map(d => ({
            id: d.id,
            projectId: d.project_id,
            name: d.nome,
            templateId: d.template_id,
            securityLevel: d.nivel_sigilo as any,
            status: d.status as any,
            creatorId: d.created_by,
            creatorName: 'Usuário',
            createdAt: d.created_at,
            updatedAt: d.updated_at,
            content: d.conteudo as any,
            version: 1
          })) as Document[];
        }
      }
    } catch (err) {
      console.error('[APIService] Erro ao listar documentos do projeto no Supabase:', err);
    }

    const project = await this.getProject(projectId);
    if (!project) throw new Error('Projeto não encontrado');

    const documents: Document[] = [];
    for (const docId of project.documentIds || []) {
      const doc = this.mockDocuments.get(docId);
      if (doc) {
        const versions = this.mockDocumentVersions.get(docId);
        const currentVersion = versions?.find(v => v.id === doc.currentVersionId);
        documents.push({
          ...doc,
          content: currentVersion?.content,
          version: currentVersion?.versionNumber,
          updatedBy: currentVersion?.updatedBy
        });
      }
    }
    return documents;
  }

  async deleteDocument(projectId: string, documentId: string): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      if (this.isUUID(documentId)) {
        const { error } = await supabase
          .from('documents')
          .delete()
          .eq('id', documentId);

        if (error) throw error;
        this.addAuditLog(projectId, 'document_deleted', user.id, user.name, `Documento "${documentId}" deletado no Supabase`);
        return;
      }
    } catch (err) {
      console.error('[APIService] Erro ao deletar documento no Supabase:', err);
    }

    const project = await this.getProject(projectId);
    if (!project) throw new Error('Projeto não encontrado');

    const document = this.mockDocuments.get(documentId);
    if (!document) throw new Error('Documento não encontrado');

    if (document.creatorId !== user.id && project.creatorId !== user.id && user.role !== 'admin') {
      throw new Error('Permissão negada: Você não tem permissão para deletar este documento.');
    }

    this.mockDocuments.delete(documentId);
    this.mockDocumentVersions.delete(documentId);
    if (project.documentIds) {
      project.documentIds = project.documentIds.filter(id => id !== documentId);
    }
    project.updatedAt = new Date().toISOString();
    
    const projectIndex = this.mockProjects.findIndex(p => p.id === projectId);
    if (projectIndex !== -1) {
      this.mockProjects[projectIndex] = project;
    }

    this.addAuditLog(projectId, 'document_deleted', user.id, user.name, `Documento "${documentId}" deletado no mock`);
    this.persistToLocalStorage();
  }

  // Compartilhamento de Documentos
  async shareDocument(documentId: string, userId: string, permissions: ('view' | 'edit' | 'comment')[]): Promise<Document> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) throw new Error('Usuário não autenticado');

    const document = this.mockDocuments.get(documentId);
    if (!document) throw new Error('Documento não encontrado');

    const targetUser = this.mockUsers.find(u => u.id === userId);
    if (!targetUser) throw new Error('Usuário para compartilhamento não encontrado');

    // Garante que o array sharedWith existe
    if (!document.sharedWith) {
      document.sharedWith = [];
    }

    // Verifica se o usuário já tem o documento compartilhado
    const existingShareIndex = document.sharedWith.findIndex(s => s.userId === userId);
    if (existingShareIndex !== -1) {
      // Atualiza as permissões se já existir
      document.sharedWith[existingShareIndex].permissions = permissions;
    } else {
      // Adiciona novo compartilhamento
      document.sharedWith.push({ userId, permissions });
    }

    this.mockDocuments.set(documentId, document);

    // Log de auditoria
    this.addAuditLog(
      document.projectId, 
      'document_shared', 
      currentUser.id, 
      currentUser.name, 
      `Documento "${document.id}" compartilhado com ${targetUser.name} com permissões: ${permissions.join(', ')}`
    );
    this.persistToLocalStorage();

    return document;
  }

  async getSharedDocuments(userId: string): Promise<Document[]> {
    // Retorna todos os documentos onde o userId é listado em sharedWith
    const sharedDocs: Document[] = [];
    for (const doc of this.mockDocuments.values()) {
      if (doc.sharedWith?.some(s => s.userId === userId)) {
        sharedDocs.push(doc);
      }
    }
    return sharedDocs;
  }

  async updateSharedPermissions(documentId: string, userId: string, permissions: ('view' | 'edit' | 'comment')[]): Promise<Document> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) throw new Error('Usuário não autenticado');

    const document = this.mockDocuments.get(documentId);
    if (!document) throw new Error('Documento não encontrado');

    if (!document.sharedWith) throw new Error('Documento não compartilhado com ninguém.');

    const shareIndex = document.sharedWith.findIndex(s => s.userId === userId);
    if (shareIndex === -1) throw new Error('Compartilhamento com este usuário não encontrado.');

    document.sharedWith[shareIndex].permissions = permissions;
    this.mockDocuments.set(documentId, document);

    // Log de auditoria
    this.addAuditLog(
      document.projectId, 
      'share_permissions_updated', 
      currentUser.id, 
      currentUser.name, 
      `Permissões de compartilhamento do documento "${document.id}" com o usuário ${userId} atualizadas para: ${permissions.join(', ')}`
    );
    this.persistToLocalStorage();

    return document;
  }

  async generateWithAI(projectId: string, sectionId: string, sectionTitle?: string, helpText?: string): Promise<string> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    console.log(`[IA] Iniciando geração de conteúdo para a seção "${sectionId}" (${sectionTitle}) no projeto "${projectId}"`);

    const aiConfig = this.getAIConfiguracao();
    if (!aiConfig || !aiConfig.apiKey) {
      throw new Error('Configure a API da IA nas configurações antes de gerar conteúdo');
    }

    // Simular leitura do modelo de documento e interpretação de referências
    await new Promise(resolve => setTimeout(resolve, 500)); // Simula tempo de processamento
    console.log('[IA] Modelo de documento lido e referências interpretadas.');

    // Se o provider for Manus, usar serviço específico
    if (aiConfig.provider === 'manus') {
      try {
        const response = await manusAPIService.generateSectionContent(
          projectId,
          sectionTitle || sectionId,
          sectionId
        );

        // Log de auditoria
        this.addAuditLog(projectId, 'ai_generation_manus', user.id, user.name, `Manus IA gerou conteúdo para seção "${sectionId}"`);

        return response;
      } catch (error: any) {
        console.error('Erro ao gerar com Manus:', error);
        throw error;
      }
    }

    // Fluxo normal para OpenAI/Anthropic
    const files = await this.getProjectFiles(projectId);
    const processedFiles = files.filter(f => f.status === 'processed');

    // Obter o tipo do modelo de documento, se houver
    const project = await this.getProject(projectId);
    const documentModel = project?.documentModelId ? this.mockDocumentModels.find(m => m.id === project.documentModelId) : undefined;
    const documentType = documentModel?.type || 'documento'; // Padrão para 'documento'

    // Preparar contexto para a IA
    const title = sectionTitle || sectionId;

    const prompt = `Você é um assistente especializado em Engenharia de Requisitos. \nVocê está gerando conteúdo para um **${documentType}**.\nAnalise os documentos fornecidos e gere conteúdo para a seção "${title}" deste ${documentType}.\n\n${helpText ? `INSTRUÇÕES ADICIONAIS: ${helpText}\n\n` : ''}IMPORTANTE:\n- Base-se APENAS nos documentos fornecidos\n- Se não encontrar informação relevante, escreva "Não identificado: [breve explicação]"\n- Para requisitos funcionais, use o formato: RF001, RF002, etc.\n- Para requisitos não funcionais, use: RNF001, RNF002, etc.\n- Para regras de negócio, use: RN001, RN002, etc.\n- Mantenha a linguagem e formalidade adequadas para um **${documentType}**.\n- Seja objetivo e técnico\n\nDocumentos disponíveis: ${processedFiles.map(f => f.name).join(', ') || 'Nenhum documento enviado ainda'}\n\nGere o conteúdo:`;

    try {
      console.log('[IA] Chamando API da IA para gerar conteúdo...', { provider: aiConfig.provider, sectionId });
      
      // Chamada real à API da IA
      const response = await this.callAIAPI(aiConfig, prompt);
      
      console.log('[IA] Resposta da IA recebida para geração de conteúdo.');

      // Log de auditoria
      this.addAuditLog(projectId, 'ai_generation', user.id, user.name, `IA gerou conteúdo para seção "${sectionId}"`);

      return response;
    } catch (error: any) {
      console.error('Erro ao chamar API da IA:', error);
      
      // Se a API falhar, retornar mensagem de erro informativa
      if (error.message?.includes('API key')) {
        throw new Error('Chave de API inválida. Verifique suas configurações.');
      } else if (error.message?.includes('rate limit')) {
        throw new Error('Limite de requisições excedido. Tente novamente em alguns minutos.');
      } else if (error.message?.includes('network')) {
        throw new Error('Erro de conexão. Verifique sua internet.');
      } else {
        throw new Error('Erro ao se comunicar com a IA: ' + (error.message || 'Erro desconhecido'));
      }
    }
  }

  // Método auxiliar para chamar a API da IA
  private async callAIAPI(config: AIConfig, prompt: string): Promise<string> {
    const provider = config.provider || 'openai';

    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Você é um especialista em Engenharia de Requisitos e Análise de Sistemas.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('Erro da API OpenAI:', error);
        
        if (response.status === 401) {
          throw new Error('API key inválida ou expirada');
        } else if (response.status === 429) {
          throw new Error('rate limit exceeded');
        } else {
          throw new Error(`Erro HTTP ${response.status}: ${error.error?.message || 'Erro desconhecido'}`);
        }
      }

      const data = await response.json();
      return data.choices[0].message.content;
      
    } else if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('Erro da API Anthropic:', error);
        
        if (response.status === 401) {
          throw new Error('API key inválida ou expirada');
        } else if (response.status === 429) {
          throw new Error('rate limit exceeded');
        } else {
          throw new Error(`Erro HTTP ${response.status}: ${error.error?.message || 'Erro desconhecido'}`);
        }
      }

      const data = await response.json();
      return data.content[0].text;
      
    } else if (provider === 'manus') {
      // Usar API Manus para chat/geração
      const manusConfig: ManusConfig = {
        apiKey: config.apiKey,
        endpoint: (config as any).endpoint
      };
      
      // Chamar API Manus através do serviço
      const result = await manusAPIService.chat({
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        maxTokens: 2000
      });
      
      return result;
      
    } else {
      // Para API customizada
      throw new Error('Provider de IA não suportado. Use "openai", "anthropic" ou "manus".');
    }
  }

  // Chat com IA
  async chatWithAI(projectId: string, message: string, context?: { sectionId?: string }): Promise<string> {
    console.log('chatWithAI chamado:', { projectId, message });
    
    const user = this.getCurrentUser();
    if (!user) {
      console.error('Usuário não autenticado');
      throw new Error('Usuário não autenticado');
    }

    console.log(`[IA] Iniciando chat com IA para o projeto "${projectId}"`);

    const aiConfig = this.getAIConfiguracao();
    if (!aiConfig || !aiConfig.apiKey) {
      throw new Error('Configure a API da IA nas configurações antes de usar o chat');
    }

    // Simular leitura do modelo de documento e interpretação de referências
    await new Promise(resolve => setTimeout(resolve, 500)); // Simula tempo de processamento
    console.log('[IA] Contexto do projeto e documentos lidos para o chat.');

    // Se for Manus, usar chat com contexto completo dos documentos
    if (aiConfig.provider === 'manus') {
      try {
        const manusDocuments = await manusAPIService.getProjectDocuments(projectId);
        const document = await this.getDocument(projectId); // Este getDocument já retorna o formato compatível
        
        // Preparar contexto do documento atual
        let documentContext = '';
        if (document && document.content) { // Adicionado verificação para document.content
          documentContext = document.content.sections
            .map(s => `${s.title}:\n${s.content || '[Vazio]'}`)
            .join('\n\n');
        }

        const response = await manusAPIService.chat({
          messages: [
            {
              role: 'user',
              content: message
            }
          ],
          context: {
            documents: manusDocuments,
            projectInfo: `DOCUMENTO ATUAL DO PROJETO:\n${documentContext}`
          },
          temperature: 0.7,
          maxTokens: 2000
        });

        // Log de auditoria
        this.addAuditLog(projectId, 'ai_chat_manus', user.id, user.name, `Chat Manus: "${message.substring(0, 50)}..."`);

        return response;
      } catch (error: any) {
        console.error('Erro no chat Manus:', error);
        throw error;
      }
    }

    // Fluxo normal para OpenAI/Anthropic
    const files = await this.getProjectFiles(projectId);
    const document = await this.getDocument(projectId); // Este getDocument já retorna o formato compatível
    const processedFiles = files.filter(f => f.status === 'processed');

    // Obter o tipo do modelo de documento, se houver
    const project = await this.getProject(projectId);
    const documentModel = project?.documentModelId ? this.mockDocumentModels.find(m => m.id === project.documentModelId) : undefined;
    const documentType = documentModel?.type || 'documento de especificação'; // Padrão para 'documento de especificação'

    console.log('Contexto do chat:', { 
      aiConfigPresent: !!aiConfig, 
      filesCount: files.length, 
      documentPresent: !!document 
    });

    // Preparar contexto do documento para a IA
    let documentContext = '';
    if (document && document.content) { // Adicionado verificação para document.content
      documentContext = document.content.sections
        .map(s => `${s.title}:\\n${s.content || '[Vazio]'}`)
        .join('\\n\\n');
    }

    const prompt = `Você é um assistente especializado em Engenharia de Requisitos trabalhando em um **${documentType}**.\n\nCONTEXTO DO PROJETO:\n- Documentos processados: ${processedFiles.map(f => f.name).join(', ') || 'Nenhum'}\n- Total de arquivos: ${files.length}\n\nDOCUMENTO ATUAL:\n${documentContext || 'Documento vazio'}\n\nMENSAGEM DO USUÁRIO: ${message}\n\nResponda de forma clara e objetiva, mantendo a linguagem e formalidade adequadas para um **${documentType}**. Se o usuário pedir para adicionar, editar ou revisar conteúdo, seja específico sobre o que você faria. Mantenha o tom profissional e técnico.`;

    try {
      console.log('[IA] Chamando API da IA para chat...');
      
      const response = await this.callAIAPI(aiConfig, prompt);
      
      console.log('[IA] Resposta do chat recebida.');

      // Log de auditoria
      this.addAuditLog(projectId, 'ai_chat', user.id, user.name, `Chat: \"${message.substring(0, 50)}...\"`);

      return response;
    } catch (error: any) {
      console.error('Erro ao chamar API da IA no chat:', error);
      
      // Mensagens de erro mais específicas
      if (error.message?.includes('API key')) {
        throw new Error('Chave de API inválida. Verifique suas configurações.');
      } else if (error.message?.includes('rate limit')) {
        throw new Error('Limite de requisições excedido. Aguarde alguns minutos.');
      } else if (error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
        throw new Error('Erro de conexão. Verifique sua internet.');
      } else {
        throw new Error('Erro ao se comunicar com a IA: ' + (error.message || 'Erro desconhecido'));
      }
    }
  }

  async applyAIEdit(projectId: string, sectionId: string, instruction: string): Promise<string> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    // Simula aplicação de edição pela IA
    const mockEdits: Record<string, string> = {
      'adicionar_requisito': 'RF004: O sistema deve permitir exportação de dados em formato CSV e PDF.',
      'melhorar_texto': 'Texto melhorado com mais detalhes e clareza baseado nos documentos analisados.',
      'expandir_secao': 'Conteúdo expandido com informações adicionais extraídas dos documentos do projeto.'
    };

    const edit = mockEdits['adicionar_requisito'] || 'Edição aplicada conforme solicitado.';

    // Log de auditoria
    this.addAuditLog(projectId, 'ai_edit', user.id, user.name, `IA editou seção "${sectionId}": ${instruction}`);

    return edit;
  }

  // Upload de arquivos
  async uploadFile(projectId: string, file: File, isDataSource: boolean = false): Promise<UploadedFile> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      // Proteção: Não tenta upload real se o projeto não for real (UUID)
      if (!this.isUUID(projectId)) {
        console.warn('[APIService] Tentativa de upload para projeto mock. Salvando apenas no mock local.');
        const mockUploadedFile: UploadedFile = {
          id: Date.now().toString(),
          projectId,
          name: file.name,
          type: 'other',
          size: file.size,
          status: 'processed',
          isDataSource,
          uploadedBy: user.name,
          uploadedAt: new Date().toISOString()
        };
        const projectFiles = this.mockFiles.get(projectId) || [];
        projectFiles.push(mockUploadedFile);
        this.mockFiles.set(projectId, projectFiles);
        return mockUploadedFile;
      }

      console.log(`[APIService] Iniciando upload Supabase para projeto ${projectId}: ${file.name}`);
      
      const filePath = `${projectId}/${file.name}`;
      
      // 1. Upload para o Storage (Bucket: Documentos)
      const { data: storageData, error: storageError } = await supabase.storage
        .from('Documentos')
        .upload(filePath, file, {
          upsert: true // Permite sobrescrever se o arquivo com mesmo nome já existir na pasta do projeto
        });

      if (storageError) throw storageError;

      // 2. Inserir metadados na tabela project_materials
      const fileType = file.name.endsWith('.pdf') ? 'pdf' :
                       file.name.endsWith('.docx') ? 'docx' :
                       file.name.endsWith('.doc') ? 'doc' :
                       file.name.endsWith('.txt') ? 'txt' :
                       file.type.startsWith('audio/') ? 'audio' : 'other';

      const { data: dbData, error: dbError } = await supabase
        .from('project_materials')
        .insert({
          project_id: projectId,
          file_name: file.name,
          file_path: filePath,
          file_type: fileType,
          file_size: file.size,
          is_data_source: isDataSource,
          uploaded_by: user.id,
          status: 'processed'
        })
        .select()
        .single();

      if (dbError) {
        console.warn('[APIService] Arquivo enviado ao storage, mas erro ao salvar metadados no banco. Verifique se a tabela project_materials existe.');
        throw dbError;
      }

      const uploadedFile: UploadedFile = {
        id: dbData.id,
        projectId: dbData.project_id,
        name: dbData.file_name,
        type: dbData.file_type as any,
        size: dbData.file_size,
        status: dbData.status as any,
        isDataSource: dbData.is_data_source,
        uploadedBy: user.name,
        uploadedAt: dbData.created_at
      };

      // Processar documento com Manus se configurado
      const aiConfig = this.getAIConfiguracao();
      if (aiConfig?.provider === 'manus' && aiConfig.apiKey) {
        try {
          const manusConfig: ManusConfig = { apiKey: aiConfig.apiKey, endpoint: (aiConfig as any).endpoint };
          await manusAPIService.processDocument(projectId, file);
          this.addAuditLog(projectId, 'file_processed_manus', user.id, user.name, `Documento "${file.name}" processado pela IA Manus`);
        } catch (error: any) {
          console.error('Erro ao processar com Manus:', error);
        }
      }

      this.addAuditLog(projectId, 'file_uploaded', user.id, user.name, `Arquivo "${file.name}" enviado para o Supabase`);
      return uploadedFile;

    } catch (err) {
      console.error('[APIService] Erro no upload Supabase:', err);
      // Fallback para Mock se falhar
      const fallbackFile: UploadedFile = {
        id: Date.now().toString(),
        projectId,
        name: file.name,
        type: 'other',
        size: file.size,
        status: 'processed',
        isDataSource,
        uploadedBy: user.name,
        uploadedAt: new Date().toISOString()
      };
      return fallbackFile;
    }
  }

  async getProjectFiles(projectId: string): Promise<UploadedFile[]> {
    try {
      // Proteção: se o ID não for um UUID, não consulta o Supabase (evita erro 400/22P02)
      if (!this.isUUID(projectId)) {
        return this.mockFiles.get(projectId) || [];
      }

      console.log('[APIService] Buscando arquivos do projeto no Supabase:', projectId);
      const { data, error } = await supabase
        .from('project_materials')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;

      if (data) {
        return data.map(f => ({
          id: f.id,
          projectId: f.project_id,
          name: f.file_name,
          type: f.file_type as any,
          size: f.file_size,
          status: f.status as any,
          isDataSource: f.is_data_source,
          uploadedBy: 'Usuário',
          uploadedAt: f.created_at
        }));
      }
    } catch (err) {
      console.error('[APIService] Erro ao buscar arquivos do Supabase:', err);
    }
    return this.mockFiles.get(projectId) || [];
  }

  private addAuditLog(entidadeId: string, acao: string, userId: string, userName: string, details: string): void {
    try {
      if (this.isUUID(entidadeId) && this.isUUID(userId)) {
        supabase
          .from('audit_logs')
          .insert({
            user_id: userId,
            acao: acao,
            entidade: 'desconhecido', // Pode ser refinado
            entidade_id: entidadeId,
            detalhes: { message: details, user_name: userName }
          })
          .then(({ error }) => {
            if (error) console.error('[APIService] Erro ao salvar log de auditoria no Supabase:', error);
          });
      }
    } catch (err) {
      console.error('[APIService] Erro ao processar log de auditoria:', err);
    }

    const log: AuditLog = {
      id: Date.now().toString(),
      projectId: entidadeId,
      action: acao,
      userId,
      userName,
      details,
      timestamp: new Date().toISOString()
    };

    const logs = this.mockAuditLogs.get(entidadeId) || [];
    logs.unshift(log);
    this.mockAuditLogs.set(entidadeId, logs);
    this.persistToLocalStorage();
  }

  async getAuditLogs(projectId: string): Promise<AuditLog[]> {
    try {
      if (this.isUUID(projectId)) {
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
            userName: (l.detalhes as any)?.user_name || 'Usuário',
            details: (l.detalhes as any)?.message || '',
            timestamp: l.created_at
          }));
        }
      }
    } catch (err) {
      console.error('[APIService] Erro ao buscar logs de auditoria no Supabase:', err);
    }
    return this.mockAuditLogs.get(projectId) || [];
  }

  async getTotalDocumentsCount(): Promise<number> {
    return this.mockDocuments.size;
  }

  // Colaboradores ativos (mock para simulação)
  getActiveUsers(projectId: string): User[] {
    // Em um sistema real, esta função consultaria um serviço de presença ou um banco de dados
    // para retornar os usuários realmente ativos no projeto ou com acesso a ele.
    // A escalabilidade aqui seria crucial para lidar com muitos usuários e projetos.
    // Mock: retorna alguns usuários como "ativos"
    return this.mockUsers.slice(0, 2);
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*');

      if (error) throw error;

      if (data) {
        return data.map(u => ({
          id: u.id,
          email: u.email,
          name: u.nome || 'Usuário',
          password: '',
          role: (u.role as any) || 'operational',
          createdAt: u.created_at || new Date().toISOString(),
          isActive: u.status === 'ATIVO',
          forcePasswordChange: false
        }));
      }
    } catch (err) {
      console.error('[APIService] Erro ao buscar todos os usuários do Supabase:', err);
    }
    return this.mockUsers;
  }

  async getUser(id: string): Promise<User | null> {
    try {
      if (this.isUUID(id)) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        if (data) {
          return {
            id: data.id,
            email: data.email,
            name: data.nome || 'Usuário',
            password: '',
            role: (data.role as any) || 'operational',
            createdAt: data.created_at || new Date().toISOString(),
            isActive: data.status === 'ATIVO',
            forcePasswordChange: false
          };
        }
      }
    } catch (err) {
      console.error('[APIService] Erro ao buscar usuário no Supabase:', err);
    }
    return this.mockUsers.find(user => user.id === id) || null;
  }

  async updateUser(updatedUser: User): Promise<User> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      if (this.isUUID(updatedUser.id)) {
        const roleToTipo: Record<string, string> = {
          'admin': 'ADM',
          'director': 'DIRETOR',
          'manager': 'GERENTE',
          'technical_responsible': 'TECNICO',
          'operational': 'OPERACIONAL'
        };

        const { data, error } = await supabase
          .from('users')
          .update({
            nome: updatedUser.name,
            role: updatedUser.role,
            tipo: roleToTipo[updatedUser.role] || 'OPERACIONAL',
            status: updatedUser.isActive ? 'ATIVO' : 'SUSPENSO',
            updated_at: new Date().toISOString()
          })
          .eq('id', updatedUser.id)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          if (this.currentUser?.id === updatedUser.id) {
            this.currentUser = updatedUser;
            localStorage.setItem('current_user', JSON.stringify(updatedUser));
          }
          return updatedUser;
        }
      }
    } catch (err) {
      console.error('[APIService] Erro ao atualizar usuário no Supabase:', err);
    }

    const index = this.mockUsers.findIndex(u => u.id === updatedUser.id);
    if (index === -1) throw new Error('Usuário não encontrado');

    this.mockUsers[index] = updatedUser;
    if (this.currentUser?.id === updatedUser.id) {
      this.currentUser = updatedUser;
      localStorage.setItem('current_user', JSON.stringify(updatedUser));
    }
    this.persistToLocalStorage();
    return updatedUser;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      if (this.isUUID(userId)) {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);

        if (error) throw error;
        return true;
      }
    } catch (err) {
      console.error('[APIService] Erro ao excluir usuário no Supabase:', err);
    }

    const initialLength = this.mockUsers.length;
    this.mockUsers = this.mockUsers.filter(u => u.id !== userId);
    if (this.mockUsers.length < initialLength) {
      this.persistToLocalStorage();
      return true;
    }
    return false;
  }

  // Métodos adicionais para compatibilidade com componentes
  async deleteDocumentModel(modelId: string): Promise<boolean> {
    const index = this.mockDocumentModels.findIndex(m => m.id === modelId);
    if (index !== -1) {
      this.mockDocumentModels.splice(index, 1);
      this.persistToLocalStorage();
      return true;
    }
    return false;
  }

  async analyzeProjectModels(projectId: string, onStatusChange?: (status: string) => void): Promise<void> {
    onStatusChange?.('Analisando modelos...');
    await new Promise(r => setTimeout(r, 1000));
    onStatusChange?.('Concluído');
  }

  async analyzeProjectMaterials(projectId: string, onStatusChange?: (status: string) => void, forceRefresh: boolean = false): Promise<string> {
    onStatusChange?.('Analisando materiais...');
    await new Promise(r => setTimeout(r, 1500));
    onStatusChange?.('Resumo gerado com sucesso');
    return 'Resumo automático dos materiais do projeto.';
  }

  async getFilePublicUrl(projectId: string, fileName: string): Promise<string> {
    try {
      if (!this.isUUID(projectId)) return '#';

      const { data, error } = await supabase
        .from('project_materials')
        .select('file_path')
        .eq('project_id', projectId)
        .eq('file_name', fileName)
        .single();

      if (data?.file_path) {
        const { data: urlData } = supabase.storage
          .from('Documentos')
          .getPublicUrl(data.file_path);
        
        return urlData.publicUrl;
      }
    } catch (err) {
      console.error('[APIService] Erro ao obter URL do arquivo:', err);
    }
    return '#';
  }

  async deleteFile(projectId: string, fileId: string): Promise<void> {
    try {
      if (this.isUUID(fileId)) {
        const { data: fileData } = await supabase
          .from('project_materials')
          .select('file_path')
          .eq('id', fileId)
          .single();

        if (fileData?.file_path) {
          await supabase.storage.from('Documentos').remove([fileData.file_path]);
          await supabase.from('project_materials').delete().eq('id', fileId);
          console.log('[APIService] Arquivo deletado com sucesso do Supabase');
        }
      }
    } catch (err) {
      console.error('[APIService] Erro ao deletar arquivo do Supabase:', err);
    }

    const files = this.mockFiles.get(projectId) || [];
    const updated = files.filter(f => f.id !== fileId);
    this.mockFiles.set(projectId, updated);
    this.persistToLocalStorage();
  }

  async setFileAsDataSource(projectId: string, fileId: string, isDataSource: boolean): Promise<void> {
    try {
      if (this.isUUID(fileId)) {
        await supabase
          .from('project_materials')
          .update({ is_data_source: isDataSource })
          .eq('id', fileId);
        
        console.log(`[APIService] Status de fonte de dados atualizado no Supabase para ${fileId}`);
      }
    } catch (err) {
      console.error('[APIService] Erro ao atualizar status de fonte de dados:', err);
    }
  }

  async uploadModelFile(projectId: string, file: File): Promise<void> {
    console.log(`[APIService] Upload de arquivo de modelo: ${file.name}`);
  }

  async deleteModelFile(projectId: string, fileName: string): Promise<void> {
    console.log(`[APIService] Arquivo de modelo deletado: ${fileName}`);
  }

  async listWikiDocuments(page: number, pageSize: number): Promise<{ data: Document[], total: number }> {
    try {
      const { data, error, count } = await supabase
        .from('documents')
        .select('*', { count: 'exact' })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (!error && data) {
        return {
          data: data.map(d => ({
            id: d.id,
            projectId: d.project_id,
            name: d.nome,
            content: d.conteudo as any,
            updatedAt: d.updated_at
          })) as Document[],
          total: count || 0
        };
      }
    } catch (err) {
      console.error('[APIService] Erro ao listar documentos da Wiki no Supabase:', err);
    }
    const allDocs = Array.from(this.mockDocuments.values());
    return {
      data: allDocs.slice((page - 1) * pageSize, page * pageSize),
      total: allDocs.length
    };
  }

  async updateUserPassword(userId: string, newPassword: string, forcePasswordChange?: boolean): Promise<User> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    if (user.id !== userId && user.role !== 'admin') {
      throw new Error('Permissão negada: Você só pode alterar sua própria senha.');
    }

    if (newPassword.length < 6) {
      throw new Error('A senha deve ter pelo menos 6 caracteres.');
    }

    try {
      if (this.isUUID(userId)) {
        // 1. Atualizar senha no Supabase Auth
        // Nota: updateUser só funciona para o usuário logado no momento.
        // Se for admin alterando de outro, o Supabase Auth requer o uso da Admin API (servidor).
        // Aqui assumimos que é o próprio usuário alterando (caso do forcePasswordChange).
        if (user.id === userId) {
          const { error: authError } = await supabase.auth.updateUser({
            password: newPassword
          });
          if (authError) throw authError;
        }

        // 2. Atualizar flag na tabela public.users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .update({
            force_password_change: forcePasswordChange === true,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
          .single();

        if (userError) throw userError;

        if (userData) {
          const updatedUser: User = {
            ...user,
            forcePasswordChange: userData.force_password_change,
          };
          if (this.currentUser?.id === userId) {
            this.currentUser = updatedUser;
            localStorage.setItem('current_user', JSON.stringify(updatedUser));
          }
          return updatedUser;
        }
      }
    } catch (err) {
      console.error('[APIService] Erro ao atualizar senha no Supabase:', err);
    }

    // Fallback Mock
    const targetUser = this.mockUsers.find(u => u.id === userId);
    if (!targetUser) throw new Error('Usuário não encontrado');

    targetUser.password = newPassword;
    targetUser.forcePasswordChange = forcePasswordChange === true;
    targetUser.updatedAt = new Date().toISOString();

    if (this.currentUser?.id === userId) {
      this.currentUser = targetUser;
      localStorage.setItem('current_user', JSON.stringify(targetUser));
    }

    this.persistToLocalStorage();
    return targetUser;
  }
  // Gerenciamento de Modelos de Documento
  async getDocumentModels(projectId?: string): Promise<DocumentModel[]> {
    try {
      console.log('[APIService] Buscando modelos do Supabase (tabela templates)');
      let query = supabase.from('templates').select('*');

      if (projectId) {
        // Busca modelos globais OU modelos vinculados a este projeto específico
        query = query.or(`global.eq.true,project_id.eq.${projectId}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        return data.map(t => ({
          id: t.id,
          name: t.nome,
          type: t.tipo_documento,
          aiGuidance: t.descricao || '',
          templateContent: (t.sections as any)?.html || '', // Recupera o HTML salvo no JSONB
          isGlobal: t.global,
          isDraft: false, // A tabela templates não tem coluna is_draft no schema fornecido
          projectId: t.project_id,
          createdAt: t.created_at,
          updatedAt: t.updated_at
        } as DocumentModel));
      }
    } catch (err) {
      console.error('[APIService] Erro ao buscar modelos do Supabase:', err);
    }

    console.log('[APIService] Fallback para modelos mock');
    let models = this.mockDocumentModels;
    if (projectId) {
      models = models.filter(m => m.isGlobal || m.projectId === projectId);
    }
    return models;
  }

  async createDocumentModel(name: string, type: string, templateContent: string, isGlobal: boolean = false, projectId?: string, isDraft: boolean = false, aiGuidance?: string): Promise<DocumentModel> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      console.log('[APIService] Criando modelo no Supabase (tabela templates)');
      
      const newTemplate = {
        nome: name,
        tipo_documento: type,
        descricao: aiGuidance || '',
        global: isGlobal,
        project_id: projectId || null,
        created_by: user.id,
        file_url: 'internal_template', // Campo NOT NULL, inserindo placeholder
        sections: { html: templateContent } // Salvando o HTML dentro do JSONB
      };

      const { data, error } = await supabase
        .from('templates')
        .insert(newTemplate)
        .select()
        .single();

      if (!error && data) {
        const model: DocumentModel = {
          id: data.id,
          name: data.nome,
          type: data.tipo_documento,
          aiGuidance: data.descricao,
          templateContent: (data.sections as any)?.html || '',
          isGlobal: data.global,
          isDraft: false,
          projectId: data.project_id,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
        console.log('[APIService] Modelo criado com sucesso no banco:', model.id);
        return model;
      } else {
        if (error) console.error('[APIService] Erro ao inserir no Supabase:', error.message);
      }
    } catch (err) {
      console.error('[APIService] Erro inesperado ao criar modelo no Supabase:', err);
    }

    // Fallback para Mock se o banco falhar ou não estiver configurado
    const newModel: DocumentModel = {
      id: Date.now().toString(),
      name,
      type,
      aiGuidance,
      templateContent, 
      isGlobal,
      isDraft, 
      projectId, 
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.mockDocumentModels.push(newModel);
    this.addAuditLog(projectId || 'system', 'document_model_created', user.id, user.name, `Modelo "${name}" criado no mock`);
    this.persistToLocalStorage();

    return newModel;
  }

  async updateDocumentModel(updatedModel: DocumentModel): Promise<DocumentModel> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      if (this.isUUID(updatedModel.id)) {
        console.log('[APIService] Atualizando modelo no Supabase:', updatedModel.id);
        
        const updateData = {
          nome: updatedModel.name,
          tipo_documento: updatedModel.type,
          descricao: updatedModel.aiGuidance || '',
          global: updatedModel.isGlobal,
          project_id: updatedModel.projectId || null,
          sections: { html: updatedModel.templateContent },
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('templates')
          .update(updateData)
          .eq('id', updatedModel.id)
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            name: data.nome,
            type: data.tipo_documento,
            aiGuidance: data.descricao,
            templateContent: (data.sections as any)?.html || '',
            isGlobal: data.global,
            isDraft: false,
            projectId: data.project_id,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };
        } else {
          if (error) console.error('[APIService] Erro ao atualizar no Supabase:', error.message);
        }
      }
    } catch (err) {
      console.error('[APIService] Erro inesperado ao atualizar modelo no Supabase:', err);
    }

    // Fallback Mock
    const index = this.mockDocumentModels.findIndex(m => m.id === updatedModel.id);
    if (index === -1) {
      throw new Error('Modelo de documento não encontrado');
    }

    const modelToUpdate: DocumentModel = {
      ...updatedModel,
      isDraft: updatedModel.isDraft,
      aiGuidance: updatedModel.aiGuidance,
      updatedAt: new Date().toISOString()
    };

    this.mockDocumentModels[index] = modelToUpdate;
    this.addAuditLog(modelToUpdate.projectId || 'system', 'document_model_updated', user.id, user.name, `Modelo "${modelToUpdate.name}" atualizado no mock`);
    this.persistToLocalStorage();

    return modelToUpdate;
  }

  // Gerenciamento de Grupos
  async getGroups(): Promise<Group[]> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      console.log('[APIService] Buscando grupos do Supabase');
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*');

      if (groupsError) throw groupsError;

      if (groupsData) {
        const groupsWithMembers = await Promise.all(groupsData.map(async (g) => {
          const { data: membersData } = await supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', g.id);
          
          return {
            id: g.id,
            name: g.nome,
            description: g.descricao,
            responsibleId: g.responsavel_id,
            memberIds: membersData?.map(m => m.user_id) || [],
            createdAt: g.created_at,
            updatedAt: g.updated_at,
            projectIds: g.project_id ? [g.project_id] : []
          } as Group;
        }));
        return groupsWithMembers;
      }
    } catch (err) {
      console.error('[APIService] Erro ao buscar grupos do Supabase:', err);
    }

    if (user.role === 'admin' || user.role === 'director') return this.mockGroups;
    return this.mockGroups.filter(g => g.responsibleId === user.id || g.memberIds.includes(user.id));
  }

  async createGroup(name: string, description?: string, parentId?: string, memberIds: string[] = [], responsibleId?: string, projectIds: string[] = []): Promise<Group> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      console.log('[APIService] Criando grupo no Supabase');
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
          nome: name,
          descricao: description || '',
          responsavel_id: responsibleId || user.id,
          project_id: projectIds && projectIds.length > 0 ? projectIds[0] : null
        })
        .select()
        .single();

      if (groupError) throw groupError;

      if (groupData) {
        if (memberIds.length > 0) {
          const membersToInsert = memberIds.map(uid => ({
            group_id: groupData.id,
            user_id: uid
          }));
          await supabase.from('group_members').insert(membersToInsert);
        }

        return {
          id: groupData.id,
          name: groupData.nome,
          description: groupData.descricao,
          responsibleId: groupData.responsavel_id,
          memberIds: memberIds,
          createdAt: groupData.created_at,
          updatedAt: groupData.updated_at,
          projectIds: projectIds
        };
      }
    } catch (err) {
      console.error('[APIService] Erro ao criar grupo no Supabase:', err);
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
      updatedAt: new Date().toISOString(),
    };
    this.mockGroups.push(newGroup);
    this.persistToLocalStorage();
    return newGroup;
  }

  async addSectionToDocument(documentId: string, title: string, index?: number): Promise<Document> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    const doc = this.mockDocuments.get(documentId);
    if (!doc) throw new Error('Documento não encontrado');

    const versions = this.mockDocumentVersions.get(documentId) || [];
    const currentVersion = versions.find(v => v.id === doc.currentVersionId);
    if (!currentVersion) throw new Error('Versão atual do documento não encontrada');

    const newSection: DocumentSection = {
      id: `sec-${Date.now()}`,
      title,
      content: '',
      isEditable: true,
    };

    const updatedSections = [...currentVersion.content.sections];

    // Determinar o número sequencial do tópico
    const lastSectionTitle = updatedSections[updatedSections.length - 1]?.title;
    let newSectionNumber = 1;
    if (lastSectionTitle) {
      const match = lastSectionTitle.match(/^(\d+)\.?\s/);
      if (match && match[1]) {
        newSectionNumber = parseInt(match[1]) + 1;
      }
    }

    newSection.title = `${newSectionNumber}. ${title}`;

    if (index !== undefined && index >= 0 && index <= updatedSections.length) {
      updatedSections.splice(index, 0, newSection);
    } else {
      updatedSections.push(newSection);
    }

    const newContent: DocumentContent = { sections: updatedSections };
    
    // Criar uma nova versão do documento
    const newVersionNumber = versions.length > 0 ? Math.max(...versions.map(v => v.versionNumber)) + 1 : 1;
    const newVersionId = `v${documentId}_${newVersionNumber}`;

    const newVersion: DocumentVersion = {
      id: newVersionId,
      documentId: documentId,
      versionNumber: newVersionNumber,
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
      content: newContent,
    };

    versions.push(newVersion);
    this.mockDocumentVersions.set(documentId, versions);

    doc.currentVersionId = newVersionId;
    this.mockDocuments.set(documentId, doc);

    // Log de auditoria
    this.addAuditLog(documentId, 'section_added', user.id, user.name, `Seção "${newSection.title}" adicionada ao documento`);
    this.persistToLocalStorage();

    return {
      id: doc.id,
      projectId: doc.projectId,
      currentVersionId: doc.currentVersionId,
      sharedWith: doc.sharedWith,
      content: newVersion.content,
      version: newVersion.versionNumber,
      updatedAt: newVersion.updatedAt,
      updatedBy: newVersion.updatedBy,
    } as Document;
  }

  async updateGroup(updatedGroup: Group): Promise<Group> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      if (this.isUUID(updatedGroup.id)) {
        const { data, error } = await supabase
          .from('groups')
          .update({
            nome: updatedGroup.name,
            descricao: updatedGroup.description,
            responsavel_id: updatedGroup.responsibleId,
            project_id: updatedGroup.projectIds && updatedGroup.projectIds.length > 0 ? updatedGroup.projectIds[0] : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', updatedGroup.id)
          .select()
          .single();

        if (error) throw error;

        await supabase.from('group_members').delete().eq('group_id', updatedGroup.id);
        if (updatedGroup.memberIds.length > 0) {
          const membersToInsert = updatedGroup.memberIds.map(uid => ({
            group_id: updatedGroup.id,
            user_id: uid
          }));
          await supabase.from('group_members').insert(membersToInsert);
        }

        return { ...updatedGroup, updatedAt: data.updated_at };
      }
    } catch (err) {
      console.error('[APIService] Erro ao atualizar grupo no Supabase:', err);
    }

    const index = this.mockGroups.findIndex(g => g.id === updatedGroup.id);
    if (index === -1) throw new Error('Grupo não encontrado');
    this.mockGroups[index] = { ...updatedGroup, updatedAt: new Date().toISOString() };
    this.persistToLocalStorage();
    return this.mockGroups[index];
  }

  async assignProjectToGroup(groupId: string, projectId: string): Promise<Group> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      if (this.isUUID(groupId) && this.isUUID(projectId)) {
        const { data, error } = await supabase
          .from('groups')
          .update({ project_id: projectId })
          .eq('id', groupId)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          return {
            id: data.id,
            name: data.nome,
            projectIds: [data.project_id]
          } as any;
        }
      }
    } catch (err) {
      console.error('[APIService] Erro ao atribuir projeto ao grupo no Supabase:', err);
    }

    const group = this.mockGroups.find(g => g.id === groupId);
    if (!group) throw new Error('Grupo não encontrado');
    if (!group.projectIds) group.projectIds = [];
    if (!group.projectIds.includes(projectId)) {
      group.projectIds.push(projectId);
      this.persistToLocalStorage();
    }
    return group;
  }

  async removeProjectFromGroup(groupId: string, projectId: string): Promise<Group> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      if (this.isUUID(groupId)) {
        const { data, error } = await supabase
          .from('groups')
          .update({ project_id: null })
          .eq('id', groupId)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          return {
            id: data.id,
            name: data.nome,
            projectIds: []
          } as any;
        }
      }
    } catch (err) {
      console.error('[APIService] Erro ao remover projeto do grupo no Supabase:', err);
    }

    const group = this.mockGroups.find(g => g.id === groupId);
    if (!group) throw new Error('Grupo não encontrado');
    if (group.projectIds) {
      group.projectIds = group.projectIds.filter(id => id !== projectId);
      this.persistToLocalStorage();
    }
    return group;
  }

  async getGroupProjects(groupId: string): Promise<Project[]> {
    try {
      if (this.isUUID(groupId)) {
        const { data: groupData } = await supabase
          .from('groups')
          .select('project_id')
          .eq('id', groupId)
          .single();

        if (groupData?.project_id) {
          const project = await this.getProject(groupData.project_id);
          return project ? [project] : [];
        }
      }
    } catch (err) {
      console.error('[APIService] Erro ao buscar projetos do grupo no Supabase:', err);
    }

    const group = this.mockGroups.find(g => g.id === groupId);
    if (!group || !group.projectIds) return [];
    return this.mockProjects.filter(p => group.projectIds?.includes(p.id));
  }

  async deleteGroup(groupId: string): Promise<boolean> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      if (this.isUUID(groupId)) {
        const { error } = await supabase
          .from('groups')
          .delete()
          .eq('id', groupId);
        if (error) throw error;
        return true;
      }
    } catch (err) {
      console.error('[APIService] Erro ao excluir grupo no Supabase:', err);
    }

    // Apenas admin pode excluir grupos
    if (user.role !== 'admin') {
      throw new Error('Permissão negada: Somente administradores podem excluir grupos.');
    }

    const initialLength = this.mockGroups.length;
    this.mockGroups = this.mockGroups.filter(g => g.id !== groupId);

    if (this.mockGroups.length < initialLength) {
      // Log de auditoria
      this.addAuditLog('system', 'group_deleted', user.id, user.name, `Grupo com ID "${groupId}" excluído`);
      this.persistToLocalStorage();
      return true;
    }
    return false;
  }

  async deleteProject(projectId: string): Promise<boolean> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    try {
      if (this.isUUID(projectId)) {
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', projectId);

        if (error) throw error;
        return true;
      }
    } catch (err) {
      console.error('[APIService] Erro ao excluir projeto no Supabase:', err);
    }

    // Apenas admin pode excluir projetos
    if (user.role !== 'admin') {
      throw new Error('Permissão negada: Somente administradores podem excluir projetos.');
    }

    const initialLength = this.mockProjects.length;
    this.mockProjects = this.mockProjects.filter(p => p.id !== projectId);

    if (this.mockProjects.length < initialLength) {
      // Log de auditoria
      this.addAuditLog('system', 'project_deleted', user.id, user.name, `Projeto com ID "${projectId}" excluído no mock`);
      this.persistToLocalStorage();
      return true;
    }
    return false;
  }
}

export const apiService = new APIService();