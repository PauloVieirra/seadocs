import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Sparkles, RotateCw, Plus } from 'lucide-react'; // Adicionar Plus
import 'react-quill/dist/quill.snow.css'; // ES6
import { apiService, type Document, type DocumentContent, type DocumentSection } from '../../services/api';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { NewSectionDialog } from './NewSectionDialog'; // Importar NewSectionDialog

interface DocumentEditorProps {
  document: Document;
  onSave: (content: Document['content']) => void;
  projectId: string;
}

export function DocumentEditor({ document, onSave, projectId }: DocumentEditorProps) {
  const [content, setContent] = useState<DocumentContent>(document.content);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [newSectionDialogOpen, setNewSectionDialogOpen] = useState(false); // Estado para o modal de nova seção
  const [isAddingSection, setIsAddingSection] = useState(false); // Estado para o botão de adicionar seção
  const [aiProcessingStatus, setAiProcessingStatus] = useState<
    'reading_model' |
    'interpreting_references' |
    'generating_content' |
    null
  >(null);
  const [currentSectionProcessing, setCurrentSectionProcessing] = useState<string | null>(null);

  useEffect(() => {
    setContent(document.content);
  }, [document]);

  const handleSectionChange = (sectionId: string, newContent: string) => {
    const updatedContent = {
      ...content,
      sections: content.sections.map(section =>
        section.id === sectionId
          ? { ...section, content: newContent }
          : section
      )
    };
    setContent(updatedContent);

    // Limpa o timer anterior para evitar múltiplas chamadas rápidas
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Configura um novo timer para chamar onSave após um curto período de inatividade
    saveTimerRef.current = setTimeout(() => {
      onSave(updatedContent);
    }, 500); // Salva após 500ms de inatividade
  };

  const handleGenerateAllWithAI = async () => {
    setIsGeneratingAll(true);
    let updatedContent = { ...content };

    for (const section of updatedContent.sections) {
      if (section.isEditable) {
        setCurrentSectionProcessing(section.id);
        
        setAiProcessingStatus('reading_model');
        toast.info(`🤖 IA: Lendo modelo para "${section.title}"...`, { id: 'ai-status', duration: 1000 });
        await new Promise(resolve => setTimeout(resolve, 500)); 

        setAiProcessingStatus('interpreting_references');
        toast.info(`🤖 IA: Interpretando referências para "${section.title}"...`, { id: 'ai-status', duration: 1000 });
        await new Promise(resolve => setTimeout(resolve, 500)); 
        
        setAiProcessingStatus('generating_content');
        toast.info(`🤖 IA: Gerando conteúdo para "${section.title}"...`, { id: 'ai-status', duration: 1000 });

        try {
          const aiContent = await apiService.generateWithAI(projectId, section.id);
          updatedContent = {
            ...updatedContent,
            sections: updatedContent.sections.map(s =>
              s.id === section.id
                ? { ...s, content: aiContent }
                : s
            )
          };
          setContent(updatedContent);
          toast.success(`✅ Conteúdo para "${section.title}" gerado!`, {
            description: 'O conteúdo foi adicionado à seção',
            duration: 2000
          });
        } catch (error: any) {
          console.error(`Erro ao gerar conteúdo para ${section.title}:`, error);
          const errorMessage = error.message || 'Erro desconhecido ao gerar conteúdo';
          toast.error(`❌ Erro em "${section.title}"`, {
            description: errorMessage,
            duration: 5000
          });
        }
      }
    }
    
    onSave(updatedContent);
    setIsGeneratingAll(false);
    setAiProcessingStatus(null);
    setCurrentSectionProcessing(null);
    toast.success('🎉 Geração de IA concluída para todas as seções!', { duration: 3000 });
  };

  const handleAddNewSection = async (title: string) => {
    setIsAddingSection(true);
    try {
      const updatedDocument = await apiService.addSectionToDocument(document.id, title);
      setContent(updatedDocument.content); // Atualiza o conteúdo local com o documento atualizado
      setNewSectionDialogOpen(false);
      toast.success(`Tópico \"${title}\" adicionado com sucesso!`);
    } catch (error: any) {
      toast.error(`Erro ao adicionar tópico: ${error.message}`);
    } finally {
      setIsAddingSection(false);
    }
  };

  const getAiStatusLabel = (sectionId?: string) => {
    if (!aiProcessingStatus) return '';
    const sectionTitle = sectionId ? content.sections.find(s => s.id === sectionId)?.title : 'o documento';
    switch (aiProcessingStatus) {
      case 'reading_model':
        return `Lendo Modelo para ${sectionTitle}...`;
      case 'interpreting_references':
        return `Interpretando Referências para ${sectionTitle}...`;
      case 'generating_content':
        return `Gerando Conteúdo para ${sectionTitle}...`;
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 py-8 font-sans antialiased">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-md p-10 space-y-8">
        {/* Document Header with Global AI Button */}
        <div className="mb-8 pb-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Documento de Especificação</h1>
            <p className="text-gray-600 text-lg">
              Edite e gere conteúdo com IA para seu projeto: <span className="font-semibold">{document.projectId}</span>
            </p>
          </div>
          <Button
            onClick={handleGenerateAllWithAI}
            disabled={isGeneratingAll}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isGeneratingAll ? (
              <>
                <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                Gerando Tudo...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Gerar Tudo com IA
              </>
            )}
          </Button>
        </div>

        {isGeneratingAll && currentSectionProcessing && aiProcessingStatus && (
          <div className="mb-6 text-center text-indigo-600 flex items-center justify-center gap-2">
            <RotateCw className="w-5 h-5 animate-spin" />
            <span className="text-lg font-medium">{getAiStatusLabel(currentSectionProcessing)}</span>
          </div>
        )}

        {/* Document Sections */}
        <div className="space-y-6">
          {content.sections.map((section) => (
            <div key={section.id} className="group">
              {section.title && <h2 className="text-2xl font-bold text-gray-800 mb-2 mt-4">{section.title}</h2>}
              {section.isEditable ? (
                <Textarea
                  value={section.content || ''}
                  onChange={(e) => handleSectionChange(section.id, e.target.value)}
                  placeholder={`Digite aqui (ou gere com IA) para "${section.title}"...`}
                  className="min-h-[140px]"
                />
              ) : (
                <div
                  className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: section.content || '[Seção não editável ou vazia]' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Botão para adicionar novo tópico */}
        <div className="flex justify-center mt-8">
          <Button
            onClick={() => setNewSectionDialogOpen(true)}
            variant="outline"
            disabled={isAddingSection || isGeneratingAll}
          >
            <Plus className="w-4 h-4 mr-2" /> Novo Tópico
          </Button>
        </div>

        {/* Footer Info */}
        <div className="mt-12 p-6 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
          <h3 className="text-base font-semibold mb-3">ℹ️ Informações sobre a Geração de Conteúdo com IA</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>A IA utiliza os documentos de referência carregados para o projeto.</li>
            <li>Ela preenche as seções do documento com base nos títulos e placeholders definidos no modelo.</li>
            <li>O processo de geração da IA leva em consideração a estrutura do modelo e o estilo de linguagem esperado.</li>
            <li>Caso a IA não encontre informações relevantes para uma seção, ela indicará "Não identificado".</li>
            <li>Todas as interações de geração de conteúdo são registradas no histórico de auditoria.</li>
            <li>O conteúdo gerado pela IA pode ser editado manualmente a qualquer momento.</li>
          </ul>
        </div>
      </div>

      {/* Modal para adicionar nova seção */}
      <NewSectionDialog
        open={newSectionDialogOpen}
        onOpenChange={setNewSectionDialogOpen}
        onSave={handleAddNewSection}
        isSaving={isAddingSection}
      />
    </div>
  );
}