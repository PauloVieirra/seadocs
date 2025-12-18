// API Service - Configurável para qualquer banco de dados

import { manusAPIService, type ManusConfig } from './manus-api';

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
  role: 'admin' | 'director' | 'manager' | 'technical_responsible' | 'operational';
  managerId?: string;
  createdAt: string;
  isActive?: boolean; // Adicionado para indicar se o usuário está ativo/suspenso
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  parentId?: string; // Para hierarquia de grupos
  memberIds: string[]; // IDs dos usuários membros
  responsibleId?: string; // ID do usuário responsável pelo grupo
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
  currentVersionId: string; // ID da versão atual
  sharedWith?: { userId: string; permissions: ('view' | 'edit' | 'comment')[] }[]; // Adicionado para compartilhamento
  // Propriedades adicionadas para compatibilidade com a interface esperada pelo frontend
  content?: DocumentContent;
  version?: number;
  updatedAt?: string;
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
  type: 'pdf' | 'doc' | 'docx' | 'txt' | 'audio' | 'other'; // Adicionado txt e audio
  size: number;
  status: 'processing' | 'processed' | 'error';
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
  documentModelId?: string; // ID do modelo de documento associado ao projeto
}

export interface DocumentModel {
  id: string;
  name: string;
  type: string; // Ex: Ofício, Minuta, Especificação de Requisitos
  templateContent: string; // Conteúdo do template em formato HTML
  isGlobal: boolean; // Se o modelo está disponível para todos os projetos
  projectId?: string; // Adicionado para vincular o modelo a um projeto específico
  createdAt: string;
  updatedAt: string;
}

class APIService {
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
      role: 'admin',
      createdAt: new Date().toISOString(),
      isActive: true
    },
    {
      id: '2',
      email: 'diretor@empresa.com',
      name: 'Diretor Geral',
      role: 'director',
      createdAt: new Date().toISOString(),
      isActive: true
    },
    {
      id: '3',
      email: 'gerente@empresa.com',
      name: 'Gerente de Projeto',
      role: 'manager',
      createdAt: new Date().toISOString(),
      isActive: true
    },
    {
      id: '4',
      email: 'responsavel.tecnico@empresa.com',
      name: 'Responsável Técnico',
      role: 'technical_responsible',
      createdAt: new Date().toISOString(),
      isActive: true
    },
    {
      id: '5',
      email: 'operacional@empresa.com',
      name: 'Designer UI',
      role: 'operational',
      managerId: '3',
      createdAt: new Date().toISOString(),
      isActive: true
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
      updatedAt: new Date(2025, 11, 10).toISOString()
    },
    {
      id: '2',
      name: 'Portal do Cliente',
      description: 'Documentação completa do portal de autoatendimento',
      creatorId: '2',
      creatorName: 'Gerente de Projeto',
      status: 'review',
      createdAt: new Date(2025, 10, 15).toISOString(),
      updatedAt: new Date(2025, 11, 12).toISOString()
    }
  ];

  private mockDocuments: Map<string, Document> = new Map([
    ['1', {
      id: '1',
      projectId: '1',
      currentVersionId: 'v1_3',
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
    // Removido: Permite login sem cadastro - cria usuário automaticamente
    let user = this.mockUsers.find(u => u.email === email);
    
    if (!user) {
      // Se o usuário não existir, retorna null (falha no login)
      return null;
    }

    // Em um sistema real, a senha seria verificada aqui.
    // Para o mock, consideramos a senha '••••••••' como padrão para todos os usuários existentes.
    if (password !== '••••••••' && user.email !== 'admin@empresa.com') {
      // Apenas para admin@empresa.com, aceitamos qualquer senha no mock
      // Para outros usuários, a senha deve ser '••••••••'
      return null;
    }

    if (!user.isActive) {
      throw new Error('Usuário inativo. Entre em contato com o administrador.');
    }
    
    this.currentUser = user;
    localStorage.setItem('current_user', JSON.stringify(user));
    return user;
  }

  async register(email: string, password: string, name: string, role: User['role'] = 'operational'): Promise<User | null> {
    // Em um ambiente de produção, este método registraria o usuário em um banco de dados real
    // e aplicaria regras de validação de senha e unicidade de e-mail.
    // No mock, esta função será chamada apenas pelo UserManagementPanel, onde as regras de permissão são aplicadas.
    const newUser: User = {
      id: Date.now().toString(),
      email,
      name,
      role,
      createdAt: new Date().toISOString(),
      isActive: true // Novo usuário é sempre ativo por padrão
    };
    
    this.mockUsers.push(newUser);
    this.currentUser = newUser; // Se registrar, já loga
    localStorage.setItem('current_user', JSON.stringify(newUser));
    return newUser;
  }

  logout(): void {
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

  // Projetos
  async getProjects(): Promise<Project[]> {
    const user = this.getCurrentUser();
    if (!user) return [];

    // RBAC: Filtrar projetos baseado no papel do usuário
    if (user.role === 'admin') {
      return this.mockProjects;
    }

    if (user.role === 'manager') {
      // Gerente vê seus projetos + projetos de usuários sob supervisão
      return this.mockProjects.filter(p => 
        p.creatorId === user.id || 
        this.mockUsers.find(u => u.id === p.creatorId)?.managerId === user.id
      );
    }

    // Usuário padrão vê apenas seus projetos
    return this.mockProjects.filter(p => p.creatorId === user.id);
  }

  async createProject(name: string, description?: string, responsibleIds?: string[], groupIds?: string[], documentModelId?: string): Promise<Project> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

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
      documentModelId: documentModelId,
    };

    this.mockProjects.push(newProject);

    // Criar documento inicial com base no modelo selecionado ou padrão
    let initialSections: DocumentSection[] = [];

    if (documentModelId) {
      const selectedModel = this.mockDocumentModels.find(m => m.id === documentModelId);
      if (selectedModel && selectedModel.templateContent) {
        initialSections = this.parseTemplateContentToSections(selectedModel.templateContent);
      }
    } else {
      // Default sections if no model is selected
      initialSections = [
        { id: 'intro', title: '1. Introdução', content: '', isEditable: true },
        { id: 'overview', title: '2. Visão Geral do Sistema', content: '', isEditable: true },
        { id: 'functional', title: '3. Requisitos Funcionais', content: '', isEditable: true },
        { id: 'nonfunctional', title: '4. Requisitos Não Funcionais', content: '', isEditable: true },
        { id: 'business-rules', title: '5. Regras de Negócio', content: '', isEditable: true },
        { id: 'constraints', title: '6. Premissas e Restrições', content: '', isEditable: true }
      ];
    }

    const firstVersionId = `v${newProject.id}_1`;
    const firstVersion: DocumentVersion = {
      id: firstVersionId,
      documentId: newProject.id,
      versionNumber: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
      content: {
        sections: initialSections
      }
    };

    const newDocument: Document = {
      id: newProject.id,
      projectId: newProject.id,
      currentVersionId: firstVersionId,
      sharedWith: [],
    };

    this.mockDocuments.set(newProject.id, newDocument);
    this.mockDocumentVersions.set(newProject.id, [firstVersion]);

    // Log de auditoria
    this.addAuditLog(newProject.id, 'project_created', user.id, user.name, `Projeto "${name}" criado`);

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
    return this.mockProjects.find(p => p.id === projectId) || null;
  }

  async updateProject(updatedProject: Project): Promise<Project> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

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
    this.addAuditLog(projectToUpdate.id, 'project_updated', user.id, user.name, `Projeto "${projectToUpdate.name}" atualizado`);

    return projectToUpdate;
  }

  // Documentos
  async getDocument(projectId: string): Promise<Document | null> {
    const doc = this.mockDocuments.get(projectId);
    if (!doc) return null;

    const versions = this.mockDocumentVersions.get(projectId);
    const currentVersion = versions?.find(v => v.id === doc.currentVersionId);

    if (!currentVersion) return null;

    // Retornar um objeto que se pareça com a interface Document antiga para compatibilidade temporária
    // Os componentes serão atualizados posteriormente para usar DocumentVersion diretamente
    return {
      id: doc.id,
      projectId: doc.projectId,
      currentVersionId: doc.currentVersionId,
      sharedWith: doc.sharedWith,
      content: currentVersion.content, // Conteúdo vem da versão atual
      version: currentVersion.versionNumber, // Versão vem da versão atual
      updatedAt: currentVersion.updatedAt, // Data de atualização vem da versão atual
      updatedBy: currentVersion.updatedBy, // Usuário que atualizou vem da versão atual
    } as Document; // Adiciona o cast para incluir as propriedades de DocumentVersion que o frontend espera
  }

  async updateDocument(projectId: string, content: DocumentContent): Promise<Document> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    const doc = this.mockDocuments.get(projectId);
    if (!doc) throw new Error('Documento não encontrado');

    const versions = this.mockDocumentVersions.get(projectId) || [];
    const newVersionNumber = versions.length > 0 ? Math.max(...versions.map(v => v.versionNumber)) + 1 : 1;
    const newVersionId = `v${projectId}_${newVersionNumber}`;

    const newVersion: DocumentVersion = {
      id: newVersionId,
      documentId: projectId,
      versionNumber: newVersionNumber,
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
      content,
    };

    versions.push(newVersion);
    this.mockDocumentVersions.set(projectId, versions);

    doc.currentVersionId = newVersionId;
    this.mockDocuments.set(projectId, doc);

    // Log de auditoria
    this.addAuditLog(projectId, 'document_edited', user.id, user.name, `Documento editado manualmente (versão ${newVersionNumber})`);

    // Retornar o documento atualizado (formato compatível)
    return {
      id: doc.id,
      projectId: doc.projectId,
      currentVersionId: doc.currentVersionId,
      sharedWith: doc.sharedWith,
      content: newVersion.content, // Conteúdo vem da nova versão
      version: newVersion.versionNumber, // Versão vem da nova versão
      updatedAt: newVersion.updatedAt, // Data de atualização vem da nova versão
      updatedBy: newVersion.updatedBy, // Usuário que atualizou vem da nova versão
    } as Document;
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

    return document;
  }

  async generateWithAI(projectId: string, sectionId: string): Promise<string> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    console.log(`[IA] Iniciando geração de conteúdo para a seção "${sectionId}" no projeto "${projectId}"`);

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
        const sectionTitles: Record<string, string> = {
          'intro': 'Introdução',
          'overview': 'Visão Geral do Sistema',
          'functional': 'Requisitos Funcionais',
          'nonfunctional': 'Requisitos Não Funcionais',
          'business-rules': 'Regras de Negócio',
          'constraints': 'Premissas e Restrições'
        };

        const response = await manusAPIService.generateSectionContent(
          projectId,
          sectionTitles[sectionId] || sectionId,
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
    const sectionTitles: Record<string, string> = {
      'intro': 'Introdução',
      'overview': 'Visão Geral do Sistema',
      'functional': 'Requisitos Funcionais',
      'nonfunctional': 'Requisitos Não Funcionais',
      'business-rules': 'Regras de Negócio',
      'constraints': 'Premissas e Restrições'
    };

    const prompt = `Você é um assistente especializado em Engenharia de Requisitos. \nVocê está gerando conteúdo para um **${documentType}**.\nAnalise os documentos fornecidos e gere conteúdo para a seção "${sectionTitles[sectionId]}" deste ${documentType}.\n\nIMPORTANTE:\n- Base-se APENAS nos documentos fornecidos\n- Se não encontrar informação relevante, escreva "Não identificado: [breve explicação]"\n- Para requisitos funcionais, use o formato: RF001, RF002, etc.\n- Para requisitos não funcionais, use: RNF001, RNF002, etc.\n- Para regras de negócio, use: RN001, RN002, etc.\n- Mantenha a linguagem e formalidade adequadas para um **${documentType}**.\n- Seja objetivo e técnico\n\nDocumentos disponíveis: ${processedFiles.map(f => f.name).join(', ') || 'Nenhum documento enviado ainda'}\n\nGere o conteúdo:`;

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
  async uploadFile(projectId: string, file: File): Promise<UploadedFile> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    const uploadedFile: UploadedFile = {
      id: Date.now().toString(),
      projectId,
      name: file.name,
      type: file.name.endsWith('.pdf') ? 'pdf' :
            file.name.endsWith('.docx') ? 'docx' :
            file.name.endsWith('.doc') ? 'doc' :
            file.name.endsWith('.txt') ? 'txt' :
            file.type.startsWith('audio/') ? 'audio' : 'other',
      size: file.size,
      status: 'processing',
      uploadedBy: user.name,
      uploadedAt: new Date().toISOString()
    };

    const projectFiles = this.mockFiles.get(projectId) || [];
    projectFiles.push(uploadedFile);
    this.mockFiles.set(projectId, projectFiles);

    // Processar documento com Manus se configurado
    const aiConfig = this.getAIConfiguracao();
    if (aiConfig?.provider === 'manus' && aiConfig.apiKey) {
      try {
        console.log('Processando documento com Manus...', file.name);
        const manusConfig: ManusConfig = {
          apiKey: aiConfig.apiKey,
          endpoint: (aiConfig as any).endpoint
        };
        
        // Processar documento com Manus
        const manusDoc = await manusAPIService.processDocument(projectId, file);
        console.log('Documento processado com Manus:', manusDoc.id);
        
        // Atualizar status
        uploadedFile.status = 'processed';
        
        // Log de auditoria específico
        this.addAuditLog(
          projectId, 
          'file_processed_manus', 
          user.id, 
          user.name, 
          `Documento \"${file.name}\" processado pela IA Manus`
        );
      } catch (error: any) {
        console.error('Erro ao processar documento com Manus:', error);
        uploadedFile.status = 'error';
        this.addAuditLog(
          projectId, 
          'file_processing_error', 
          user.id, 
          user.name, 
          `Erro ao processar \"${file.name}\": ${error.message}`
        );
      }
    } else {
      // Simula processamento local se Manus não estiver configurado
      setTimeout(() => {
        uploadedFile.status = 'processed';
      }, 2000);
    }

    // Log de auditoria
    this.addAuditLog(projectId, 'file_uploaded', user.id, user.name, `Arquivo \"${file.name}\" enviado`);

    return uploadedFile;
  }

  async getProjectFiles(projectId: string): Promise<UploadedFile[]> {
    return this.mockFiles.get(projectId) || [];
  }

  // Auditoria
  private addAuditLog(projectId: string, action: string, userId: string, userName: string, details: string): void {
    const log: AuditLog = {
      id: Date.now().toString(),
      projectId,
      action,
      userId,
      userName,
      details,
      timestamp: new Date().toISOString()
    };

    const logs = this.mockAuditLogs.get(projectId) || [];
    logs.unshift(log);
    this.mockAuditLogs.set(projectId, logs);
  }

  async getAuditLogs(projectId: string): Promise<AuditLog[]> {
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
    return this.mockUsers;
  }

  async getTotalUsersCount(): Promise<number> {
    return this.mockUsers.length;
  }

  async getUser(id: string): Promise<User | null> {
    return this.mockUsers.find(user => user.id === id) || null;
  }

  async updateUser(updatedUser: User): Promise<User> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    const index = this.mockUsers.findIndex(u => u.id === updatedUser.id);
    if (index === -1) {
      throw new Error('Usuário não encontrado');
    }

    // Lógica de permissão simplificada: apenas admin pode editar usuários (exceto o próprio)
    if (user.role !== 'admin' && user.id !== updatedUser.id) {
      throw new Error('Permissão negada: Somente administradores podem editar usuários.');
    }

    this.mockUsers[index] = updatedUser;

    // Se o usuário logado está sendo atualizado, atualiza o localStorage
    if (this.currentUser?.id === updatedUser.id) {
      this.currentUser = updatedUser;
      localStorage.setItem('current_user', JSON.stringify(updatedUser));
    }

    // Log de auditoria
    this.addAuditLog('system', 'user_updated', user.id, user.name, `Usuário "${updatedUser.name}" (${updatedUser.email}) atualizado`);

    return updatedUser;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    // Apenas admin pode excluir usuários
    if (user.role !== 'admin') {
      throw new Error('Permissão negada: Somente administradores podem excluir usuários.');
    }

    // Não permite excluir o próprio usuário
    if (user.id === userId) {
      throw new Error('Você não pode excluir seu próprio usuário.');
    }

    const initialLength = this.mockUsers.length;
    this.mockUsers = this.mockUsers.filter(u => u.id !== userId);

    if (this.mockUsers.length < initialLength) {
      // Log de auditoria
      this.addAuditLog('system', 'user_deleted', user.id, user.name, `Usuário com ID "${userId}" excluído`);
      return true;
    }
    return false;
  }

  // Gerenciamento de Modelos de Documento
  async getDocumentModels(projectId?: string): Promise<DocumentModel[]> {
    const user = this.getCurrentUser();
    if (!user) return [];

    let models = this.mockDocumentModels;

    if (projectId) {
      // Retornar modelos globais e modelos específicos do projeto
      models = models.filter(m => m.isGlobal || m.projectId === projectId);
    }

    return models;
  }

  async createDocumentModel(name: string, type: string, templateContent: string, isGlobal: boolean = false, projectId?: string): Promise<DocumentModel> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    // Apenas ADM ou Gerente podem criar modelos (simplificado)
    // Se for um modelo específico de projeto, o criador do projeto também pode criar
    if (user.role !== 'admin' && user.role !== 'manager' && !projectId) {
      throw new Error('Permissão negada: Somente administradores ou gerentes podem criar modelos globais.');
    }

    const newModel: DocumentModel = {
      id: Date.now().toString(),
      name,
      type,
      templateContent, // Usar o novo campo templateContent
      isGlobal,
      projectId, // Atribuir o projectId
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.mockDocumentModels.push(newModel);

    // Log de auditoria
    this.addAuditLog(projectId || 'system', 'document_model_created', user.id, user.name, `Modelo de documento \"${name}\" criado`);

    return newModel;
  }

  async updateDocumentModel(updatedModel: DocumentModel): Promise<DocumentModel> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    const index = this.mockDocumentModels.findIndex(m => m.id === updatedModel.id);
    if (index === -1) {
      throw new Error('Modelo de documento não encontrado');
    }

    // Lógica de permissão: Apenas admin ou o criador do modelo podem editar (simplificado)
    // Em um cenário real, também verificaria permissões de projeto se projectId estiver presente
    const existingModel = this.mockDocumentModels[index];
    if (user.role !== 'admin') { // && user.id !== existingModel.creatorId (se tivéssemos creatorId no modelo)
      throw new Error('Permissão negada: Somente administradores ou gerentes podem editar modelos de documento.');
    }

    const modelToUpdate: DocumentModel = {
      ...updatedModel,
      updatedAt: new Date().toISOString() // Atualizar timestamp de atualização
    };

    this.mockDocumentModels[index] = modelToUpdate;

    // Log de auditoria
    this.addAuditLog(modelToUpdate.projectId || 'system', 'document_model_updated', user.id, user.name, `Modelo de documento \"${modelToUpdate.name}\" atualizado`);

    return modelToUpdate;
  }

  // Gerenciamento de Grupos
  async getGroups(): Promise<Group[]> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    // Lógica de permissão simplificada para grupos
    if (user.role === 'admin' || user.role === 'director') {
      return this.mockGroups; // Administradores e diretores veem todos os grupos
    }

    // Gerentes veem grupos que são responsáveis ou onde são membros
    if (user.role === 'manager') {
      return this.mockGroups.filter(g => 
        g.responsibleId === user.id || g.memberIds.includes(user.id)
      );
    }

    // Responsáveis técnicos e operacionais veem grupos onde são membros
    return this.mockGroups.filter(g => g.memberIds.includes(user.id));
  }

  async createGroup(name: string, description?: string, parentId?: string, memberIds: string[] = [], responsibleId?: string): Promise<Group> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');
    // Apenas ADM ou Gerente podem criar grupos no escopo deste mock
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new Error('Permissão negada: Somente administradores ou gerentes podem criar grupos.');
    }

    const newGroup: Group = {
      id: Date.now().toString(),
      name,
      description,
      parentId,
      memberIds,
      responsibleId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.mockGroups.push(newGroup);
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

    const index = this.mockGroups.findIndex(g => g.id === updatedGroup.id);
    if (index === -1) {
      throw new Error('Grupo não encontrado');
    }

    // Lógica de permissão: Apenas admin ou o responsável pelo grupo podem editar
    const existingGroup = this.mockGroups[index];
    if (user.role !== 'admin' && user.id !== existingGroup.responsibleId) {
      throw new Error('Permissão negada: Você não tem permissão para editar este grupo.');
    }

    const groupToUpdate: Group = {
      ...updatedGroup,
      updatedAt: new Date().toISOString() // Atualizar timestamp de atualização
    };

    this.mockGroups[index] = groupToUpdate;

    // Log de auditoria
    this.addAuditLog('system', 'group_updated', user.id, user.name, `Grupo "${groupToUpdate.name}" atualizado`);

    return groupToUpdate;
  }
}

export const apiService = new APIService();