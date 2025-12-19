import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ArrowLeft, Settings, Share, Eye, Edit3 } from 'lucide-react';
import { apiService, type Project, type Document, type User } from '../../services/api';
import { DocumentEditor } from './DocumentEditor';
import { AIChat } from './AIChat';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ShareDocumentDialog } from './ShareDocumentDialog'; // Importar ShareDocumentDialog
import { ProjectSettingsDialog } from './ProjectSettingsDialog'; // Importar ProjectSettingsDialog

interface ProjectEditorProps {
  projectId: string;
  documentId: string;
  onBack: () => void;
}

export function ProjectEditor({ projectId, documentId, onBack }: ProjectEditorProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [document, setDocument] = useState<Document | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false); // Estado para controlar o diálogo de compartilhamento
  const [viewMode, setViewMode] = useState(false); // Estado para o modo de visualização

  useEffect(() => {
    loadProject();
    loadDocument();
    loadActiveUsers();

    // Inscreve para atualizações em tempo real do documento
    const subscription = apiService.subscribeToDocument(documentId, (updatedDoc) => {
      // Atualiza o documento se:
      // 1. Não houver um documento carregado ainda
      // 2. A data de atualização do banco for maior que a data do estado local
      setDocument(prev => {
        if (!prev) return updatedDoc;
        
        const currentTs = new Date(prev.updatedAt).getTime();
        const incomingTs = new Date(updatedDoc.updatedAt).getTime();
        
        if (incomingTs > currentTs) {
          return updatedDoc;
        }
        return prev;
      });
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [projectId, documentId]);

  const loadProject = async () => {
    const data = await apiService.getProject(projectId);
    setProject(data);
  };

  const loadDocument = async () => {
    const data = await apiService.getDocumentById(documentId);
    setDocument(data);
  };

  const loadActiveUsers = async () => {
    const users = apiService.getActiveUsers(projectId);
    setActiveUsers(users);
  };

  const handleSave = async (content: Document['content']) => {
    if (viewMode) return; // Não salvar em modo de visualização
    setSaving(true);
    const updatedDoc = await apiService.updateDocument(documentId, content);
    setDocument(updatedDoc);
    setTimeout(() => setSaving(false), 1000);
  };

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

              {!viewMode && (
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
          onExitViewMode={() => setViewMode(false)}
        />
      </main>

      {/* Project Settings Dialog */}
      <ProjectSettingsDialog
        projectId={projectId}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onUpdateSuccess={loadProject}
      />

      {/* AI Chat Assistant - Ocultar no modo de visualização para foco total */}
      {!viewMode && <AIChat projectId={projectId} documentId={documentId} />}

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