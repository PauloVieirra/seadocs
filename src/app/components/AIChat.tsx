import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send, Bot, User, Loader2, Minimize2, Paperclip, FileCheck } from 'lucide-react';
import { apiService } from '../../services/api';
import { invalidateRAGSummaryCache } from '../../services/local-db';
import { getDocumentationSummaryWithCache, getDocumentUnderstandingWithCache, chatWithRAG, type DocumentSectionInput } from '../../services/rag-api';
import { useDocumentGeneration } from '../../contexts/DocumentGenerationContext';
import { toast } from 'sonner';
import type { DocumentSection } from '../../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  /** Botão de ação no final da mensagem (ex: "correto, crie o documento") */
  action?: { label: string; onClick: () => void };
}

interface GenerateRequest {
  documentId: string;
  projectId: string;
  sections: DocumentSection[];
}

interface AIChatProps {
  projectId: string;
  documentId?: string;
  /** Pedido de geração: IA lê documento, mostra resumo, usuário confirma */
  generateRequest?: GenerateRequest | null;
  /** Chamado quando usuário clica em "correto, crie o documento" */
  onConfirmGenerate?: () => void;
  /** Chamado quando o fluxo de geração termina (sucesso ou cancelamento) */
  onGenerateComplete?: () => void;
  /** Força o chat aberto quando há um pedido de geração */
  forceOpen?: boolean;
  /** Chamado quando a IA sugere gerar o documento (ex: usuário pediu "gere o documento") */
  onSuggestedGenerateDocument?: () => void;
  /** Chamado quando o usuário confirma "criar documento" no fluxo pós-resumo (gera direto parágrafo a parágrafo) */
  onRequestCreateDocument?: () => void;
}

export function AIChat({ projectId, documentId, generateRequest, onConfirmGenerate, onGenerateComplete, forceOpen, onSuggestedGenerateDocument, onRequestCreateDocument }: AIChatProps) {
  const isProjectContext = !documentId;
  const { getJob } = useDocumentGeneration();
  const generationJob = documentId ? getJob(documentId) : undefined;
  const isGeneratingFromChat = generationJob?.status === 'running';
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: '1',
      role: 'assistant',
      content: isProjectContext
        ? 'Olá! Sou seu assistente de IA. Posso responder perguntas sobre o projeto com base na documentação disponível. Como posso ajudar?'
        : 'Olá! Sou seu assistente de IA. Carregando resumo da documentação...',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [minimized, setMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasAnalyzedRef = useRef(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const lastGenerateRequestRef = useRef<string | null>(null);

  const isMinimized = forceOpen ? false : minimized;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fluxo "Gerar tudo com IA": lê documento, mostra resumo, botão "correto, crie o documento"
  useEffect(() => {
    if (!generateRequest || !documentId) return;
    const key = `${generateRequest.documentId}-${generateRequest.sections.length}`;
    if (lastGenerateRequestRef.current === key) return;

    lastGenerateRequestRef.current = key;
    const sectionsInput: DocumentSectionInput[] = generateRequest.sections.map(s => ({
      id: s.id,
      title: s.title,
      helpText: s.helpText,
    }));

    const runUnderstanding = async () => {
      try {
        setIsAnalyzing(true);
        setAnalysisStatus('Lendo documento e base de conhecimento...');

        const { summary: understanding } = await getDocumentUnderstandingWithCache({
          projectId: generateRequest.projectId,
          documentId: generateRequest.documentId,
          sections: sectionsInput,
        });

        const summaryMessage: Message = {
          id: 'understanding-' + Date.now(),
          role: 'assistant',
          content: understanding,
          timestamp: new Date(),
          action: onConfirmGenerate ? {
            label: 'Correto, crie o documento',
            onClick: () => {
              onConfirmGenerate();
              lastGenerateRequestRef.current = null;
              onGenerateComplete?.();
            },
          } : undefined,
        };

        setMessages(prev => [...prev, summaryMessage]);
      } catch (error) {
        console.error('Erro ao gerar entendimento:', error);
        const errMsg: Message = {
          id: 'understanding-err-' + Date.now(),
          role: 'assistant',
          content: '❌ Não foi possível analisar o documento. Verifique se o serviço RAG está rodando (localhost:8000) e se há documentos na base de conhecimento.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errMsg]);
        toast.error('Erro ao analisar documento');
        onGenerateComplete?.();
        lastGenerateRequestRef.current = null;
      } finally {
        setIsAnalyzing(false);
      }
    };

    runUnderstanding();
  }, [generateRequest, documentId, projectId, onConfirmGenerate, onGenerateComplete]);

  // Ao abrir o chat no nível do documento (com documentId), exibe resumo da documentação
  // No nível do projeto, não carrega resumo — o chat funciona como assistente para perguntas
  useEffect(() => {
    if (isProjectContext || hasAnalyzedRef.current || generateRequest) return;

    const loadSummary = async () => {
      try {
        hasAnalyzedRef.current = true;
        setIsAnalyzing(true);
        setAnalysisStatus('Carregando análise da documentação...');

        const files = await apiService.getProjectFiles(projectId);
        const dataSourceIds = files.filter(f => f.isDataSource).map(f => f.id);

        const { summary, sources_count } = await getDocumentationSummaryWithCache(projectId, dataSourceIds);

        const summaryMessage: Message = {
          id: 'summary-' + Date.now(),
          role: 'assistant',
          content: summary + (sources_count > 0 ? `\n\n📚 Base de conhecimento: ${sources_count} trecho(s) indexado(s).` : ''),
          timestamp: new Date()
        };

        const askCreateDocMessage: Message = {
          id: 'ask-create-doc-' + Date.now(),
          role: 'assistant',
          content: 'Deseja criar o documento?',
          timestamp: new Date(),
          action: onRequestCreateDocument ? {
            label: 'Sim, criar documento',
            onClick: onRequestCreateDocument,
          } : undefined,
        };

        setMessages([summaryMessage, askCreateDocMessage]);
      } catch (error) {
        console.error('Erro ao carregar resumo:', error);
        const fallbackMessage: Message = {
          id: 'summary-' + Date.now(),
          role: 'assistant',
          content: 'Olá! Sou seu assistente de IA. Não foi possível carregar o resumo da documentação. Verifique se o serviço RAG está rodando (localhost:8000) e se há documentos na base de conhecimento. Como posso ajudar?',
          timestamp: new Date()
        };
        setMessages([fallbackMessage]);
      } finally {
        setIsAnalyzing(false);
      }
    };

    loadSummary();
  }, [projectId, generateRequest, onRequestCreateDocument, isProjectContext]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const userInput = input;
      const { response, suggested_action } = await chatWithRAG({
        projectId,
        message: userInput,
        documentId,
      });
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        action: suggested_action === 'generate_document' && onSuggestedGenerateDocument ? {
          label: 'Gerar documento agora',
          onClick: onSuggestedGenerateDocument,
        } : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Erro ao processar mensagem:', error);
      
      // Mensagens de erro personalizadas
      const errorMessage = error.message || 'Erro desconhecido';
      
      if (errorMessage.includes('Configure a API')) {
        toast.error('⚙️ Configuração necessária', {
          description: 'Configure sua chave de IA nas configurações antes de usar o chat',
          duration: 6000
        });
      } else if (errorMessage.includes('API key inválida')) {
        toast.error('🔑 Chave de API inválida', {
          description: 'Verifique sua chave nas configurações',
          duration: 5000
        });
      } else if (errorMessage.includes('Limite de requisições')) {
        toast.error('⏱️ Limite excedido', {
          description: 'Aguarde alguns minutos antes de tentar novamente',
          duration: 5000
        });
      } else if (errorMessage.includes('conexão')) {
        toast.error('🌐 Erro de conexão', {
          description: 'Verifique sua conexão com a internet',
          duration: 5000
        });
      } else {
        toast.error('❌ Erro ao processar mensagem', {
          description: errorMessage,
          duration: 5000
        });
      }
      
      // Adicionar mensagem de erro no chat também
      const errorMessageObj: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ Desculpe, ocorreu um erro ao processar sua mensagem. ' + errorMessage,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessageObj]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreateTechnicalSummary = async () => {
    try {
      setIsAnalyzing(true);
      setAnalysisStatus('Gerando resumo técnico...');

      const files = await apiService.getProjectFiles(projectId);
      const dataSourceIds = files.filter(f => f.isDataSource).map(f => f.id);
      const { summary, sources_count } = await getDocumentationSummaryWithCache(projectId, dataSourceIds);

      const summaryMsg: Message = {
        id: 'tech-summary-' + Date.now(),
        role: 'assistant',
        content: summary + (sources_count > 0 ? `\n\n📚 Base de conhecimento: ${sources_count} trecho(s) indexado(s).` : ''),
        timestamp: new Date(),
      };
      setMessages(prev => {
        const next: Message[] = [...prev, summaryMsg];
        // "Deseja criar o documento?" só no nível do documento
        if (documentId && onRequestCreateDocument) {
          next.push({
            id: 'ask-create-doc-' + Date.now(),
            role: 'assistant',
            content: 'Deseja criar o documento?',
            timestamp: new Date(),
            action: { label: 'Sim, criar documento', onClick: onRequestCreateDocument },
          });
        }
        return next;
      });
    } catch (err) {
      console.error('Erro ao gerar resumo técnico:', err);
      toast.error('Erro ao gerar resumo técnico');
      const errMsg: Message = {
        id: 'tech-summary-err-' + Date.now(),
        role: 'assistant',
        content: '❌ Não foi possível gerar o resumo técnico. Verifique se o serviço RAG está rodando.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || uploadingFile || loading) return;

    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        toast.error(`${file.name}: formato não suportado. Use PDF, DOC, DOCX ou TXT.`);
        continue;
      }
      if (file.size > maxSize) {
        toast.error(`${file.name}: tamanho máximo 10MB.`);
        continue;
      }

      setUploadingFile(true);
      try {
        const uploaded = await apiService.uploadFile(projectId, file, true);
        const userMsg: Message = {
          id: 'attach-' + Date.now(),
          role: 'user',
          content: `📎 Anexei o documento: ${uploaded.name}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);
        const botMsg: Message = {
          id: 'attach-ack-' + Date.now(),
          role: 'assistant',
          content: `✅ Documento "${uploaded.name}" enviado ao bucket e indexado na base de conhecimento (RAG). O conteúdo já está disponível para consultas.`,
          timestamp: new Date()
        };
        setMessages(prev => {
          const next = [...prev, botMsg];
          // "Deseja criar o resumo técnico?" só no nível do documento
          if (!isProjectContext) {
            next.push({
              id: 'attach-ask-summary-' + Date.now(),
              role: 'assistant',
              content: 'Deseja criar o resumo técnico da documentação?',
              timestamp: new Date(),
              action: {
                label: 'Sim, criar resumo técnico',
                onClick: () => handleCreateTechnicalSummary(),
              },
            });
          }
          return next;
        });
        invalidateRAGSummaryCache(projectId).catch(() => {});
        toast.success(`"${uploaded.name}" adicionado e indexado!`);
      } catch (err: any) {
        toast.error(err.message || 'Erro ao enviar documento');
        const errMsg: Message = {
          id: 'attach-err-' + Date.now(),
          role: 'assistant',
          content: `❌ Não foi possível processar "${file.name}": ${err.message || 'Erro desconhecido'}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errMsg]);
      } finally {
        setUploadingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setMinimized(false)}
          className="rounded-full w-14 h-14 shadow-lg"
          size="icon"
        >
          <Bot className="w-6 h-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-50 flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <div>
            <h3 className="text-sm">Assistente de IA</h3>
            <p className="text-xs opacity-90">{isProjectContext ? 'Contexto do projeto' : 'Contexto do documento'}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={() => setMinimized(true)}
        >
          <Minimize2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}>
                {message.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block max-w-[85%] p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.action && (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        onClick={message.action.onClick}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        <FileCheck className="w-4 h-4 mr-2" />
                        {message.action.label}
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          
          {(loading || isAnalyzing || uploadingFile || isGeneratingFromChat) && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <Bot className="w-4 h-4 text-gray-700" />
              </div>
              <div className="bg-gray-100 p-3 rounded-lg flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                <span className="text-xs text-gray-600 animate-pulse">
                  {uploadingFile
                    ? 'Enviando e indexando documento...'
                    : isGeneratingFromChat
                    ? `Gerando documento: ${generationJob?.completedSections ?? 0}/${generationJob?.totalSections ?? 0} seções${generationJob?.currentSectionTitle ? ` — ${generationJob.currentSectionTitle}` : ''}`
                    : isAnalyzing
                    ? analysisStatus
                    : 'Processando...'}
                </span>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-gray-50 rounded-b-lg">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            multiple
            onChange={handleAttachFile}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploadingFile}
            title="Anexar documento (PDF, DOC, DOCX, TXT)"
            className="flex-shrink-0"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            disabled={loading || uploadingFile}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={loading || uploadingFile || !input.trim()}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {isProjectContext
            ? '💡 Pergunte sobre o projeto ou peça para criar um novo documento'
            : '💡 Anexe documentos ou peça para adicionar, editar ou revisar'}
        </p>
      </div>
    </div>
  );
}