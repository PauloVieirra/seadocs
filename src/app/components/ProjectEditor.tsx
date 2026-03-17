import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ArrowLeft, Settings, Share, Eye, Edit3 } from 'lucide-react';
import { apiService, type Project, type Document, type User, type DocumentSection } from '../../services/api';
import { DocumentEditor } from './DocumentEditor';
import { AIChat } from './AIChat';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ShareDocumentDialog } from './ShareDocumentDialog';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';
import { useDocumentGeneration } from '../../contexts/DocumentGenerationContext';
import { toast } from 'sonner';

interface ProjectEditorProps {
  projectId: string;
  documentId: string;
  onBack: () => void;
}

export function ProjectEditor({ projectId, documentId, onBack }: ProjectEditorProps) {
  const location = useLocation();
  const scrollToActiveSection = (location.state as { scrollToActiveSection?: boolean })?.scrollToActiveSection ?? false;
  const currentUser = apiService.getCurrentUser();
  const isExternalUser = currentUser?.role === 'external';
  const { startGeneration, regenerateSection, regenerateAllWithInstruction, isGenerating, getJob } = useDocumentGeneration();

  const [project, setProject] = useState<Project | null>(null);
  const [document, setDocument] = useState<Document | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [generateRequest, setGenerateRequest] = useState<{
    documentId: string;
    projectId: string;
    sections: DocumentSection[];
  } | null>(null);

  const isGeneratingDocument = isGenerating(documentId);
  const generationJob = getJob(documentId);
  const sectionsBeingGeneratedByAI = generationJob?.sectionsBeingGenerated ?? new Set<string>();
  const prevGenStatusRef = useRef<string | undefined>();

  const loadProject = useCallback(async () => {
    const data = await apiService.getProject(projectId);
    setProject(data);
  }, [projectId]);

  const loadDocument = useCallback(async () => {
    const data = await apiService.getDocumentById(documentId);
    setDocument(data);
  }, [documentId]);

  const loadActiveUsers = useCallback(async () => {
    const users = apiService.getActiveUsers(projectId);
    setActiveUsers(users);
  }, [projectId]);

  useEffect(() => {
    if (isExternalUser) setViewMode(true);
  }, [isExternalUser]);

  // Recarrega documento quando geração em background termina (fallback se Realtime não disparar)
  useEffect(() => {
    const status = generationJob?.status;
    const wasRunning = prevGenStatusRef.current === 'running' || prevGenStatusRef.current === 'reviewing';
    if (wasRunning && status === 'completed' && generationJob?.documentId === documentId) {
      loadDocument();
    }
    prevGenStatusRef.current = status;
  }, [generationJob?.status, generationJob?.documentId, documentId, loadDocument]);

  useEffect(() => {
    loadProject();
    loadDocument();
    loadActiveUsers();

    // Inscreve para atualizações em tempo real do documento (refetch para garantir formato correto)
    const subscription = apiService.subscribeToDocument(documentId, () => {
      loadDocument();
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [projectId, documentId, loadProject, loadDocument, loadActiveUsers]);

  const handleSave = async (content: Document['content']) => {
    if (viewMode) return;
    setSaving(true);
    const updatedDoc = await apiService.updateDocument(documentId, content);
    setDocument(updatedDoc);
    setTimeout(() => setSaving(false), 1000);
  };

  const handleSuggestedGenerateDocument = useCallback(() => {
    if (!document?.content?.sections) return;
    const sections = document.content.sections.filter(s => s.isEditable);
    if (sections.length === 0) {
      toast.info('Nenhuma seção editável encontrada.');
      return;
    }
    setGenerateRequest({ documentId, projectId, sections });
  }, [document, documentId, projectId]);

  const triggerGeneration = useCallback((sections: DocumentSection[]) => {
    if (!document) return;
    startGeneration({
      documentId,
      projectId,
      documentTitle: document.title ?? document.name ?? 'Documento',
      sections,
      templateId: document.templateId ?? undefined,
    });
    setGenerateRequest(null);
  }, [document, documentId, projectId, startGeneration]);

  const handleConfirmGenerate = useCallback(() => {
    if (!generateRequest || !document) return;
    triggerGeneration(generateRequest.sections);
  }, [generateRequest, document, triggerGeneration]);

  const handleRequestCreateDocument = useCallback(() => {
    if (!document?.content?.sections) return;
    const sections = document.content.sections.filter(s => s.isEditable);
    if (sections.length === 0) {
      toast.info('Nenhuma seção editável encontrada.');
      return;
    }
    triggerGeneration(sections);
  }, [document, triggerGeneration]);

  const handleRequestRegenerateSection = useCallback(async (sectionIndex: number, instruction?: string) => {
    if (!document?.content?.sections) return;
    const sections = document.content.sections.filter(s => s.isEditable);
    const idx = sectionIndex - 1; // 1-based → 0-based
    if (idx < 0 || idx >= sections.length) {
      toast.error(`Seção ${sectionIndex} não encontrada. O documento tem ${sections.length} seção(ões) editável(is).`);
      return;
    }
    const section = sections[idx];
    const previousSections = sections.slice(0, idx);
    const previousSectionsHtml = previousSections
      .filter(s => (s.content || '').trim())
      .map(s => `<section data-title="${s.title}">\n${s.content}\n</section>`)
      .join('\n\n');
    const previousEvaluation = await apiService.getDocumentEvaluation(documentId);
    await regenerateSection({
      documentId,
      projectId,
      section,
      sections,
      sectionIndex: idx,
      totalSections: sections.length,
      previousSectionsHtml,
      instruction,
      templateId: document.templateId ?? undefined,
      previousEvaluation: previousEvaluation ? { rating: previousEvaluation.rating, comment: previousEvaluation.comment } : null,
    });
    loadDocument();
  }, [document, documentId, projectId, regenerateSection, loadDocument]);

  const handleRequestRegenerateAll = useCallback(async (instruction?: string) => {
    if (!document?.content?.sections) return;
    const sections = document.content.sections.filter(s => s.isEditable);
    if (sections.length === 0) {
      toast.info('Nenhuma seção editável encontrada.');
      return;
    }
    const previousEvaluation = await apiService.getDocumentEvaluation(documentId);
    regenerateAllWithInstruction({
      documentId,
      projectId,
      documentTitle: document.title ?? document.name ?? 'Documento',
      sections,
      instruction,
      templateId: document.templateId ?? undefined,
      previousEvaluation: previousEvaluation ? { rating: previousEvaluation.rating, comment: previousEvaluation.comment } : null,
    });
  }, [document, documentId, projectId, regenerateAllWithInstruction]);

  if (!project || !document) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando projeto...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className={`border-b border-gray-200 bg-white sticky top-0 z-10 ${viewMode ? 'print:hidden' : ''}`}>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-xl">{project.name}</h1>
                <p className="text-sm text-gray-600">
                  Versão {document.version} • Última edição: {new Date(document.updatedAt).toLocaleString('pt-BR')} por {document.updatedBy}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Usuários ativos */}
              {!viewMode && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Colaboradores:</span>
                  <div className="flex -space-x-2">
                    {activeUsers.map(user => (
                      <Avatar key={user.id} className="w-8 h-8 border-2 border-white">
                        <AvatarFallback className="bg-blue-600 text-white text-xs">
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </div>
              )}

              {saving && (
                <Badge variant="secondary" className="animate-pulse">
                  Salvando...
                </Badge>
              )}

              {isGeneratingDocument && (
                <Badge variant="secondary" className="animate-pulse bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping inline-block" />
                  {generationJob?.status === 'reviewing'
                    ? `Revisando documento, procurando erros, ajustando sessão ${generationJob?.reviewSectionIndex ?? 0}`
                    : 'IA gerando documento...'}
                </Badge>
              )}

              {!isExternalUser && (
                <Button 
                  variant={viewMode ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setViewMode(!viewMode)}
                >
                  {viewMode ? (
                    <>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Modo Edição
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Visualizar
                    </>
                  )}
                </Button>
              )}

              {!viewMode && !isExternalUser && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}>
                    <Share className="w-4 h-4 mr-2" />
                    Compartilhar
                  </Button>

                  <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Configurações
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Editor */}
      <main className={`flex-1 overflow-auto ${viewMode ? 'bg-gray-200 py-8' : ''}`}>
        <DocumentEditor
          document={document}
          onSave={handleSave}
          projectId={projectId}
          viewMode={viewMode}
          onExitViewMode={isExternalUser ? undefined : () => setViewMode(false)}
          onDocumentUpdated={loadDocument}
          sectionsBeingGeneratedByParent={sectionsBeingGeneratedByAI}
          isDocumentBeingGeneratedByParent={isGeneratingDocument}
          scrollToActiveSection={scrollToActiveSection}
          onRequestGenerateAll={(sections) => setGenerateRequest({ documentId, projectId, sections })}
        />
      </main>

      {/* Project Settings Dialog */}
      <ProjectSettingsDialog
        projectId={projectId}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onUpdateSuccess={loadProject}
      />

      {/* AI Chat Assistant - Ocultar no modo de visualização e para usuários externos */}
      {!viewMode && !isExternalUser && (
        <AIChat
          projectId={projectId}
          documentId={documentId}
          generateRequest={generateRequest}
          onConfirmGenerate={handleConfirmGenerate}
          onGenerateComplete={() => setGenerateRequest(null)}
          forceOpen={!!generateRequest}
          onSuggestedGenerateDocument={handleSuggestedGenerateDocument}
          onRequestCreateDocument={handleRequestCreateDocument}
          documentHasContent={document?.content?.sections?.some(s => (s.content || '').trim()) ?? false}
          documentSections={document?.content?.sections
            ?.filter(s => s.isEditable)
            .map((s, i) => ({ id: s.id, title: s.title, index: i + 1 }))}
          onRequestRegenerateSection={handleRequestRegenerateSection}
          onRequestRegenerateAll={handleRequestRegenerateAll}
        />
      )}

      {/* Diálogo de Compartilhamento */}
      {document && (
        <ShareDocumentDialog
          projectId={projectId}
          documentId={document.id}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
        />
      )}
    </div>
  );
}