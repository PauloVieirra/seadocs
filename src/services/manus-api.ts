// Serviço de integração com a API Manus
// Responsável por análise de documentos e chat contextual

export interface ManusConfig {
  apiKey: string;
  endpoint?: string; // URL base customizável
}

export interface ManusDocument {
  id: string;
  projectId: string;
  fileName: string;
  content: string; // Conteúdo extraído do documento
  metadata: {
    pages?: number;
    extractedAt: string;
    wordCount?: number;
  };
}

export interface ManusChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ManusChatRequest {
  messages: ManusChatMessage[];
  context?: {
    documents?: ManusDocument[];
    projectInfo?: string;
  };
  temperature?: number;
  maxTokens?: number;
}

class ManusAPIService {
  private config: ManusConfig | null = null;
  private documentsCache: Map<string, ManusDocument[]> = new Map();

  // Configurar a API Manus
  async configure(config: ManusConfig): Promise<boolean> {
    try {
      console.log('Configurando API Manus:', { endpoint: config.endpoint });
      
      // Validar a chave de API fazendo uma chamada de teste
      await this.validateApiKey(config);
      
      this.config = config;
      localStorage.setItem('manus_config', JSON.stringify(config));
      return true;
    } catch (error) {
      console.error('Erro ao configurar API Manus:', error);
      throw error;
    }
  }

  // Obter configuração atual
  getConfig(): ManusConfig | null {
    if (this.config) return this.config;
    
    const stored = localStorage.getItem('manus_config');
    if (stored) {
      this.config = JSON.parse(stored);
      return this.config;
    }
    
    return null;
  }

  // Validar chave de API
  private async validateApiKey(config: ManusConfig): Promise<boolean> {
    const endpoint = config.endpoint || 'https://api.manus.ai/v1';
    
    try {
      const response = await fetch(`${endpoint}/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Chave de API Manus inválida');
        }
        throw new Error(`Erro ao validar chave: ${response.status}`);
      }

      return true;
    } catch (error: any) {
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        console.warn('Não foi possível conectar ao Manus - modo offline habilitado');
        // Permite configuração mesmo offline para desenvolvimento
        return true;
      }
      throw error;
    }
  }

  // Processar documento (extrair conteúdo e alimentar base de conhecimento)
  async processDocument(
    projectId: string, 
    file: File
  ): Promise<ManusDocument> {
    const config = this.getConfig();
    if (!config || !config.apiKey) {
      throw new Error('Configure a chave de API do Manus antes de processar documentos');
    }

    const endpoint = config.endpoint || 'https://api.manus.ai/v1';
    
    try {
      console.log('Enviando documento ao Manus:', file.name);

      // Preparar FormData para upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);
      formData.append('extractText', 'true');
      formData.append('analyzeContent', 'true');

      const response = await fetch(`${endpoint}/documents/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('Erro ao processar documento no Manus:', error);
        
        if (response.status === 401) {
          throw new Error('Chave de API Manus inválida');
        } else if (response.status === 413) {
          throw new Error('Arquivo muito grande para processamento');
        } else if (response.status === 429) {
          throw new Error('Limite de processamento excedido. Aguarde alguns minutos.');
        }
        
        throw new Error(`Erro ao processar documento: ${error.message || response.statusText}`);
      }

      const data = await response.json();
      
      const manusDoc: ManusDocument = {
        id: data.id || Date.now().toString(),
        projectId,
        fileName: file.name,
        content: data.extractedText || data.content || '',
        metadata: {
          pages: data.pages,
          extractedAt: new Date().toISOString(),
          wordCount: data.wordCount
        }
      };

      // Adicionar ao cache local
      const projectDocs = this.documentsCache.get(projectId) || [];
      projectDocs.push(manusDoc);
      this.documentsCache.set(projectId, projectDocs);

      console.log('Documento processado com sucesso:', {
        fileName: manusDoc.fileName,
        contentLength: manusDoc.content.length,
        pages: manusDoc.metadata.pages
      });

      return manusDoc;
    } catch (error: any) {
      console.error('Erro ao processar documento:', error);
      
      // Se falhar, criar documento mock para desenvolvimento
      if (error.message?.includes('Failed to fetch')) {
        console.warn('API Manus indisponível - usando processamento local');
        
        // Processar localmente (simulado)
        const manusDoc: ManusDocument = {
          id: Date.now().toString(),
          projectId,
          fileName: file.name,
          content: await this.extractTextLocally(file),
          metadata: {
            extractedAt: new Date().toISOString(),
            wordCount: 0
          }
        };
        
        const projectDocs = this.documentsCache.get(projectId) || [];
        projectDocs.push(manusDoc);
        this.documentsCache.set(projectId, projectDocs);
        
        return manusDoc;
      }
      
      throw error;
    }
  }

  // Extrair texto localmente (fallback)
  private async extractTextLocally(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // Para PDFs, isso não funcionará perfeitamente, mas serve como fallback
        resolve(text || `Conteúdo do arquivo ${file.name} (processamento local)`);
      };
      
      reader.onerror = () => {
        resolve(`Arquivo: ${file.name}\nTipo: ${file.type}\nTamanho: ${file.size} bytes\n\n[Conteúdo não pode ser extraído localmente]`);
      };
      
      // Tentar ler como texto
      reader.readAsText(file);
    });
  }

  // Obter documentos processados de um projeto
  async getProjectDocuments(projectId: string): Promise<ManusDocument[]> {
    const config = this.getConfig();
    if (!config || !config.apiKey) {
      // Retornar cache local se não houver configuração
      return this.documentsCache.get(projectId) || [];
    }

    const endpoint = config.endpoint || 'https://api.manus.ai/v1';
    
    try {
      const response = await fetch(`${endpoint}/documents?projectId=${projectId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao buscar documentos: ${response.status}`);
      }

      const data = await response.json();
      const documents: ManusDocument[] = data.documents || [];
      
      // Atualizar cache
      this.documentsCache.set(projectId, documents);
      
      return documents;
    } catch (error) {
      console.warn('Erro ao buscar documentos do Manus, usando cache local:', error);
      return this.documentsCache.get(projectId) || [];
    }
  }

  // Chat com contexto dos documentos
  async chat(request: ManusChatRequest): Promise<string> {
    const config = this.getConfig();
    if (!config || !config.apiKey) {
      throw new Error('Configure a chave de API do Manus antes de usar o chat');
    }

    const endpoint = config.endpoint || 'https://api.manus.ai/v1';
    
    try {
      console.log('Enviando mensagem ao Manus Chat:', {
        messagesCount: request.messages.length,
        hasContext: !!request.context,
        documentsCount: request.context?.documents?.length || 0
      });

      const response = await fetch(`${endpoint}/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: request.messages,
          context: request.context,
          temperature: request.temperature || 0.7,
          maxTokens: request.maxTokens || 2000
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('Erro no chat Manus:', error);
        
        if (response.status === 401) {
          throw new Error('Chave de API Manus inválida');
        } else if (response.status === 429) {
          throw new Error('Limite de requisições excedido. Aguarde alguns minutos.');
        }
        
        throw new Error(`Erro no chat: ${error.message || response.statusText}`);
      }

      const data = await response.json();
      return data.response || data.message || data.text || 'Resposta vazia da API';
      
    } catch (error: any) {
      console.error('Erro ao chamar chat Manus:', error);
      
      if (error.message?.includes('Failed to fetch')) {
        throw new Error('Erro de conexão com a API Manus. Verifique sua internet.');
      }
      
      throw error;
    }
  }

  // Gerar conteúdo para uma seção específica baseado nos documentos
  async generateSectionContent(
    projectId: string,
    sectionTitle: string,
    sectionId: string
  ): Promise<string> {
    const documents = await this.getProjectDocuments(projectId);
    
    if (documents.length === 0) {
      throw new Error('Nenhum documento foi processado ainda. Envie documentos primeiro.');
    }

    // Preparar contexto com todos os documentos
    const documentsContext = documents.map(doc => ({
      fileName: doc.fileName,
      content: doc.content.substring(0, 10000) // Limitar para não exceder tokens
    }));

    // Prompt específico para geração de especificação
    const systemPrompt = `Você é um especialista em Engenharia de Requisitos e Análise de Sistemas.
Analise os documentos fornecidos e gere conteúdo profissional e técnico para a seção "${sectionTitle}" de uma especificação de requisitos.

REGRAS IMPORTANTES:
- Base-se EXCLUSIVAMENTE no conteúdo dos documentos fornecidos
- Se não encontrar informação relevante, escreva: "Não identificado nos documentos fornecidos"
- Para Requisitos Funcionais: use formato RF001, RF002, RF003...
- Para Requisitos Não Funcionais: use formato RNF001, RNF002, RNF003...
- Para Regras de Negócio: use formato RN001, RN002, RN003...
- Seja objetivo, técnico e estruturado
- Use listas numeradas ou com marcadores quando apropriado
- Mantenha linguagem formal e profissional

DOCUMENTOS DISPONÍVEIS:
${documentsContext.map((doc, i) => `\nDocumento ${i+1}: ${doc.fileName}\n${doc.content}`).join('\n---\n')}

Gere agora o conteúdo para a seção "${sectionTitle}":`;

    const request: ManusChatRequest = {
      messages: [
        {
          role: 'user',
          content: systemPrompt
        }
      ],
      context: {
        documents: documents,
        projectInfo: `Gerando conteúdo para: ${sectionTitle} (ID: ${sectionId})`
      },
      temperature: 0.7,
      maxTokens: 3000
    };

    return await this.chat(request);
  }

  // Limpar cache local
  clearCache(projectId?: string): void {
    if (projectId) {
      this.documentsCache.delete(projectId);
    } else {
      this.documentsCache.clear();
    }
  }
}

export const manusAPIService = new ManusAPIService();
