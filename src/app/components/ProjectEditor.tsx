import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ArrowLeft, Settings, Users, Save, Sparkles, Share } from 'lucide-react';
import { apiService, type Project, type Document, type User, type Group, type DocumentModel } from '../../services/api';
import { DocumentEditor } from './DocumentEditor';
import { DataSourcesPanel } from './DataSourcesPanel';
import { AuditPanel } from './AuditPanel';
import { AIChat } from './AIChat';
import { Avatar, AvatarFallback } from './ui/avatar';
import { GroupManagementPanel } from './GroupManagementPanel'; // Importar GroupManagementPanel
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { MultiSelect } from './ui/multi-select';
import { ShareDocumentDialog } from './ShareDocumentDialog'; // Importar ShareDocumentDialog

interface ProjectEditorProps {
  projectId: string;
  onBack: () => void;
}

export function ProjectEditor({ projectId, onBack }: ProjectEditorProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [document, setDocument] = useState<Document | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null); // Adicionar estado para o usuário atual
  const [allUsers, setAllUsers] = useState<User[]>([]); // Para seleção de responsáveis
  const [allGroups, setAllGroups] = useState<Group[]>([]); // Para seleção de grupos
  const [allDocumentModels, setAllDocumentModels] = useState<DocumentModel[]>([]); // Para seleção de modelos de documento
  // Estados para edição do projeto
  const [editedProjectName, setEditedProjectName] = useState('');
  const [editedProjectDescription, setEditedProjectDescription] = useState('');
  const [editedResponsibleIds, setEditedResponsibleIds] = useState<string[]>([]);
  const [editedGroupIds, setEditedGroupIds] = useState<string[]>([]);
  const [editedDocumentModelId, setEditedDocumentModelId] = useState<string | undefined>(undefined); // ID do modelo de documento para edição
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false); // Estado para controlar o diálogo de compartilhamento

  useEffect(() => {
    loadProject();
    loadDocument();
    loadActiveUsers();
    setCurrentUser(apiService.getCurrentUser()); // Carregar usuário atual
    loadAllUsersAndGroups(); // Carregar todos os usuários e grupos
    loadDocumentModels(); // Carregar modelos de documento
  }, [projectId]);

  // Preencher os estados de edição quando o projeto for carregado
  useEffect(() => {
    if (project) {
      setEditedProjectName(project.name);
      setEditedProjectDescription(project.description || '');
      setEditedResponsibleIds(project.responsibleIds || []);
      setEditedGroupIds(project.groupIds || []);
      setEditedDocumentModelId(project.documentModelId); // Preencher com o modelo existente
    }
  }, [project]);

  const loadProject = async () => {
    const data = await apiService.getProject(projectId);
    setProject(data);
  };

  const loadAllUsersAndGroups = async () => {
    setAllUsers(await apiService.getAllUsers());
    setAllGroups(await apiService.getGroups());
  };

  const loadDocumentModels = async () => {
    setAllDocumentModels(await apiService.getDocumentModels());
  };

  const loadDocument = async () => {
    const data = await apiService.getDocument(projectId);
    setDocument(data);
  };

  const loadActiveUsers = async () => {
    const users = apiService.getActiveUsers(projectId);
    setActiveUsers(users);
  };

  const handleSave = async (content: Document['content']) => {
    setSaving(true);
    const updatedDoc = await apiService.updateDocument(projectId, content);
    setDocument(updatedDoc);
    setTimeout(() => setSaving(false), 1000);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    try {
      setIsEditingProject(true);
      const updatedProject = {
        ...project,
        name: editedProjectName,
        description: editedProjectDescription,
        responsibleIds: editedResponsibleIds,
        groupIds: editedGroupIds,
        documentModelId: editedDocumentModelId,
      };
      await apiService.updateProject(updatedProject);
      setProject(updatedProject); // Atualiza o estado do projeto com as novas informações
      setSettingsOpen(false); // Fecha a sidebar após salvar
    } catch (error: any) {
      alert(error.message); // Exibir erro de permissão, por exemplo
    } finally {
      setIsEditingProject(false);
    }
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
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
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

              {saving && (
                <Badge variant="secondary" className="animate-pulse">
                  Salvando...
                </Badge>
              )}

              <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}> {/* Botão Compartilhar */}
                <Share className="w-4 h-4 mr-2" />
                Compartilhar
              </Button>

              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Configurações
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Editor */}
      <main className="flex-1 overflow-auto">
        <DocumentEditor 
          document={document} 
          onSave={handleSave}
          projectId={projectId}
        />
      </main>

      {/* Settings Sidebar */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Configurações do Projeto</SheetTitle>
            <SheetDescription>
              Gerencie fontes de dados, participantes e histórico
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="datasources" className="mt-6">
            <TabsList className="grid w-full grid-cols-4"> {/* Alterado para 4 colunas */}
              <TabsTrigger value="details">Detalhes</TabsTrigger> {/* Nova aba */}
              <TabsTrigger value="datasources">Fontes de Dados</TabsTrigger>
              <TabsTrigger value="participants">Participantes</TabsTrigger>
              <TabsTrigger value="groups">Grupos</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4">
              <form onSubmit={handleUpdateProject} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-project-name">Nome do Projeto *</Label>
                  <Input
                    id="edit-project-name"
                    value={editedProjectName}
                    onChange={(e) => setEditedProjectName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-project-description">Descrição (opcional)</Label>
                  <Textarea
                    id="edit-project-description"
                    value={editedProjectDescription}
                    onChange={(e) => setEditedProjectDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-project-responsibles">Responsáveis (opcional)</Label>
                  <MultiSelect
                    options={allUsers.map(user => ({ label: user.name, value: user.id }))}
                    selected={editedResponsibleIds}
                    onSelectedChange={setEditedResponsibleIds}
                    placeholder="Selecione responsáveis..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-project-groups">Grupos (opcional)</Label>
                  <MultiSelect
                    options={allGroups.map(group => ({ label: group.name, value: group.id }))}
                    selected={editedGroupIds}
                    onSelectedChange={setEditedGroupIds}
                    placeholder="Selecione os grupos do projeto..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-project-document-model">Modelo de Documento (opcional)</Label>
                  <MultiSelect
                    options={allDocumentModels.map(model => ({ label: model.name, value: model.id }))}
                    selected={editedDocumentModelId ? [editedDocumentModelId] : []}
                    onSelectedChange={(ids) => setEditedDocumentModelId(ids[0])}
                    placeholder="Selecione um modelo de documento..."
                    maxSelected={1}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isEditingProject}>
                    {isEditingProject ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="datasources" className="mt-4">
              <DataSourcesPanel projectId={projectId} />
            </TabsContent>

            <TabsContent value="participants" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm">Membros do Projeto</h3>
                  <Button size="sm">
                    <Users className="w-4 h-4 mr-2" />
                    Adicionar Membro
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {activeUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-blue-100 text-blue-700">
                            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm">{user.name}</p>
                          <p className="text-xs text-gray-600">{user.email}</p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Gerente' : 'Membro'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="groups" className="mt-4">
              {currentUser && <GroupManagementPanel user={currentUser} />}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <AuditPanel projectId={projectId} />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* AI Chat Assistant */}
      <AIChat projectId={projectId} />

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