import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { ArrowLeft, Plus, FileText, Trash2, Search, Settings, Rocket, Trash, Archive } from 'lucide-react';
import { apiService, type Project, type Document, type DocumentModel, type Group } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { permissionsService } from '../../services/permissions';
import { CreateDocumentDialog } from './CreateDocumentDialog';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';
import { PasswordConfirmationDialog } from './PasswordConfirmationDialog'; // Importar PasswordConfirmationDialog
import { toast } from 'sonner';

interface ProjectViewProps {
  projectId: string;
  onBack: () => void;
  onSelectDocument: (documentId: string) => void;
}

export function ProjectView({ projectId, onBack, onSelectDocument }: ProjectViewProps) {
  const user = apiService.getCurrentUser();
  const perms = usePermissions(user);
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [allDocumentModels, setAllDocumentModels] = useState<DocumentModel[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDialogMode, setPasswordDialogMode] = useState<'archive' | 'delete'>('delete');
  const [, setPermsRefresh] = useState(0);

  useEffect(() => {
    loadData();
    // Atualiza cache de permissões ao abrir o projeto (reflete alterações feitas pelo admin)
    const u = apiService.getCurrentUser();
    if (u) {
      permissionsService.getUserPermissions(u, true).then(() => setPermsRefresh(r => r + 1));
    }

    // Inscreve para mudanças nos documentos deste projeto específico
    const subscription = apiService.subscribeToDocuments(projectId, () => {
      loadData();
    });

    // Inscreve para mudanças nos modelos de documentos
    const modelSubscription = apiService.subscribeToDocumentModels(() => {
      loadData();
    });

    return () => {
      if (subscription) subscription.unsubscribe();
      if (modelSubscription) modelSubscription.unsubscribe();
    };
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const projectData = await apiService.getProject(projectId);
      setProject(projectData);
      
      const docsData = await apiService.listProjectDocuments(projectId);
      setDocuments(docsData);
      setFilteredDocuments(docsData);
      
      const models = await apiService.getDocumentModels();
      // Filtrar modelos que não são rascunhos para criação de documentos
      setAllDocumentModels(models.filter(m => !m.isDraft));
      
      const groups = await apiService.getGroups();
      setAllGroups(groups);
    } catch (error) {
      console.error('Erro ao carregar dados do projeto:', error);
      toast.error('Erro ao carregar projeto');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    // Filtrar apenas se tiver 3 ou mais caracteres
    if (value.length >= 3) {
      const filtered = documents.filter(doc =>
        doc.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredDocuments(filtered);
    } else if (value.length === 0) {
      // Se limpar a busca, mostrar todos os documentos
      setFilteredDocuments(documents);
    }
    // Se tiver 1-2 caracteres, manter o filtro anterior
  };

  const handleCreateDocument = async (data: {
    name: string;
    templateId: string;
    securityLevel: 'public' | 'restricted' | 'confidential';
    authorizedUsers?: string[];
  }) => {
    try {
      const newDocument = await apiService.createDocument(
        projectId,
        data.name,
        '', // groupId - não usado na criação
        data.templateId,
        data.securityLevel
      );

      // Para documentos restritos, compartilhar automaticamente com os usuários selecionados
      if (data.securityLevel === 'restricted' && data.authorizedUsers && data.authorizedUsers.length > 0) {
        for (const userId of data.authorizedUsers) {
          await apiService.shareDocument(newDocument.id, userId, ['view', 'edit']);
        }
      }

      toast.success('Documento criado com sucesso!');
      setCreateDialogOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar documento');
    }
  };

  const handlePublishProject = async () => {
    try {
      setLoading(true);
      const updatedProject = await apiService.publishProject(projectId);
      toast.success('Projeto publicado com sucesso!');
      if (updatedProject.id !== projectId) {
        onBack();
      } else {
        await loadData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao publicar projeto');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordConfirm = async (password: string) => {
    try {
      setLoading(true);
      if (passwordDialogMode === 'archive') {
        await apiService.archiveProjectWithPassword(projectId, password);
        toast.success('Projeto arquivado com sucesso!');
      } else {
        await apiService.deleteProjectWithPassword(projectId, password);
        toast.success('Projeto removido com sucesso!');
      }
      setPasswordDialogOpen(false);
      onBack();
    } catch (error: any) {
      toast.error(error?.message || 'Erro na operação');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Tem certeza que deseja deletar este documento?')) {
      return;
    }

    try {
      setDeleting(documentId);
      await apiService.deleteDocument(projectId, documentId);
      toast.success('Documento deletado com sucesso!');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao deletar documento');
    } finally {
      setDeleting(null);
    }
  };

  const getSecurityLevelBadge = (level: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'public': { label: 'Público', variant: 'outline' },
      'restricted': { label: 'Restrito', variant: 'secondary' },
      'confidential': { label: 'Confidencial', variant: 'default' },
      'secret': { label: 'Secreto', variant: 'destructive' }
    };

    const config = variants[level] || variants['public'];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando projeto...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Projeto não encontrado</p>
          <Button variant="outline" onClick={onBack} className="mt-4">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Button variant="ghost" size="sm" onClick={onBack} className="flex-shrink-0">
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold truncate">{project.name}</h1>
                {project.description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{project.description}</p>
                )}
              </div>
            </div>
            {(project.creatorId === user?.id || perms.canEditProjects() || perms.canCreateDocuments()) && (
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                {(project.creatorId === user?.id || perms.canEditProjects()) && (
                  <Button variant="outline" size="sm" onClick={() => setSettingsDialogOpen(true)}>
                    <Settings className="w-4 h-4 mr-1.5" />
                    Configurações
                  </Button>
                )}
                {perms.canCreateDocuments() && (
                  <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Novo Documento
                  </Button>
                )}
                {perms.canEditProjects() && project.status === 'draft' ? (
                  <Button 
                    size="sm"
                    onClick={handlePublishProject}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Rocket className="w-4 h-4 mr-1.5" />
                    Publicar
                  </Button>
                ) : perms.isAdmin() && project.estado === true ? (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPasswordDialogMode('archive');
                      setPasswordDialogOpen(true);
                    }}
                    className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  >
                    <Archive className="w-4 h-4 mr-1.5" />
                    Arquivar
                  </Button>
                ) : perms.isAdmin() && project.estado === false ? (
                  <Button 
                    size="sm"
                    onClick={handlePublishProject}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Rocket className="w-4 h-4 mr-1.5" />
                    Publicar
                  </Button>
                ) : perms.canDeleteProjects() ? (
                  <Button 
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setPasswordDialogMode('delete');
                      setPasswordDialogOpen(true);
                    }}
                  >
                    <Trash className="w-4 h-4 mr-1.5" />
                    Remover
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar documentos pelo título (mínimo 3 caracteres)..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 w-full"
          />
        </div>

        {documents.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg mb-2">Nenhum documento encontrado</h3>
              <p className="text-sm text-gray-600 mb-4">
                {perms.canCreateDocuments()
                  ? 'Comece criando seu primeiro documento neste projeto'
                  : 'Este projeto ainda não possui documentos.'}
              </p>
              {perms.canCreateDocuments() && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar primeiro documento
                </Button>
              )}
            </CardContent>
          </Card>
        ) : filteredDocuments.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg mb-2">Nenhum documento encontrado</h3>
              <p className="text-sm text-gray-600">
                Nenhum documento corresponde à sua busca.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map(doc => (
              <Card
                key={doc.id}
                className="hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
                onClick={() => onSelectDocument(doc.id)}
              >
                <CardHeader className="overflow-hidden">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <CardTitle className="text-lg break-words min-w-0 flex-1">{doc.name}</CardTitle>
                    {(doc.creatorId === apiService.getCurrentUser()?.id || 
                      ['admin', 'manager', 'technical_responsible'].includes(apiService.getCurrentUser()?.role || '')) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(doc.id);
                        }}
                        disabled={deleting === doc.id}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {getSecurityLevelBadge(doc.securityLevel)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>Criador:</span>
                      <span>{doc.creatorName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Criado em:</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Atualizado:</span>
                      <span>{new Date(doc.updatedAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {doc.templateId && (
                      <div className="flex items-center justify-between">
                        <span>Modelo:</span>
                        <span>
                          {allDocumentModels.find(m => m.id === doc.templateId)?.name || 'N/A'}
                        </span>
                      </div>
                    )}
                    {doc.groupId && (
                      <div className="flex items-center justify-between">
                        <span>Grupo:</span>
                        <span>
                          {allGroups.find(g => g.id === doc.groupId)?.name || 'N/A'}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Document Dialog */}
      <CreateDocumentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreateDocument={handleCreateDocument}
        documentModels={allDocumentModels}
      />

      {/* Project Settings Dialog */}
      <ProjectSettingsDialog
        projectId={projectId}
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        onUpdateSuccess={loadData}
      />

      <PasswordConfirmationDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        onConfirm={handlePasswordConfirm}
        title={passwordDialogMode === 'archive' ? 'Arquivar Projeto' : 'Remover Projeto'}
        description={passwordDialogMode === 'archive'
          ? 'Digite sua senha para confirmar o arquivamento do projeto.'
          : 'Esta ação requer sua senha para confirmar a remoção permanente do projeto.'}
        confirmLabel={passwordDialogMode === 'archive' ? 'Arquivar' : 'Confirmar Remoção'}
      />
    </div>
  );
}
