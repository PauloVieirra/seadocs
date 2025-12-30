import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send, Bot, User, Loader2, Minimize2 } from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatProps {
  projectId: string;
  documentId?: string;
}

export function AIChat({ projectId, documentId }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Olá! Sou seu assistente de IA. Posso ajudá-lo a editar o documento, adicionar conteúdo, revisar seções e muito mais. Como posso ajudar?',
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
  const hasAnalyzedRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Iniciar análise ao abrir o chat se for um projeto novo ou recém aberto
  useEffect(() => {
    if (hasAnalyzedRef.current) return;
    
    const startAnalysis = async () => {
      try {
        hasAnalyzedRef.current = true;
        setIsAnalyzing(true);
        
        // 1. Tenta carregar o DNA de estilo já existente antes de analisar tudo
        setAnalysisStatus('Verificando modelos de escrita...');
        
        // Pequena pausa para o componente estabilizar
        await new Promise(resolve => setTimeout(resolve, 500));

        const placeholderId = 'analysis-placeholder-' + Date.now();
        setMessages(prev => [...prev, {
          id: placeholderId,
          role: 'assistant',
          content: '🔄 Iniciando análise da base de conhecimento...',
          timestamp: new Date()
        }]);

        const updateStatus = (status: string) => {
          setAnalysisStatus(status);
          setMessages(prev => prev.map(m => 
            m.id === placeholderId ? { ...m, content: `🔄 ${status}` } : m
          ));
        };

        // Analisa os modelos de estilo (Gera ou recupera o PADRAO_ESTILO_...txt)
        await apiService.analyzeProjectModels(projectId, updateStatus);

        // analyzeProjectMaterials já possui a lógica de recuperar do RAG se existir
        const summary = await apiService.analyzeProjectMaterials(projectId, updateStatus);
        
        setMessages(prev => prev.map(m => 
          m.id === placeholderId ? { ...m, content: summary } : m
        ));
      } catch (error) {
        console.error('Erro na análise inicial:', error);
      } finally {
        setIsAnalyzing(false);
      }
    };

    startAnalysis();
  }, [projectId]);

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
      console.log('Enviando mensagem para IA:', { projectId, documentId, message: input });
      const response = await apiService.chatWithAI(projectId, input, { documentId });
      console.log('Resposta recebida da IA:', response);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
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

  if (minimized) {
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
            <p className="text-xs opacity-90">Especialista em documentação</p>
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
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          
          {(loading || isAnalyzing) && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <Bot className="w-4 h-4 text-gray-700" />
              </div>
              <div className="bg-gray-100 p-3 rounded-lg flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                {isAnalyzing && (
                  <span className="text-xs text-gray-600 animate-pulse">
                    {analysisStatus}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-gray-50 rounded-b-lg">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          💡 Peça para adicionar, editar ou revisar qualquer parte do documento
        </p>
      </div>
    </div>
  );
}