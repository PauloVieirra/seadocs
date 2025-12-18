import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Plus, FileText } from 'lucide-react'; // Removido LogOut, Settings
import { apiService, type Project, type User, type Group, type DocumentModel } from '../../services/api';
import { DatabaseConfigDialog } from './DatabaseConfigDialog';
import { MultiSelect } from './ui/multi-select'; // Importar MultiSelect
// Removido Tabs, TabsContent, TabsList, TabsTrigger, UserManagementPanel, DocumentModelManagementPanel

interface DashboardProps {
  user: User;
  onProjectSelect: (projectId: string) => void;
  // onLogout: () => void; // Removido, GlobalNav agora lida com o logout
}

export function Dashboard({ user, onProjectSelect }: DashboardProps) { // Removido onLogout
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false); // Manter configDialogOpen para o dialog
  const [allUsers, setAllUsers] = useState<User[]>([]); // Novo estado para todos os usuários
  const [selectedResponsibleIds, setSelectedResponsibleIds] = useState<string[]>([]); // Novo estado para IDs de responsáveis selecionados
  const [allGroups, setAllGroups] = useState<Group[]>([]); // Novo estado para todos os grupos
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]); // Novo estado para IDs de grupos selecionados
  const [allDocumentModels, setAllDocumentModels] = useState<DocumentModel[]>([]); // Novo estado para todos os modelos de documento
  const [selectedDocumentModelId, setSelectedDocumentModelId] = useState<string | undefined>(undefined); // Novo estado para o ID do modelo de documento selecionado

  useEffect(() => {
    loadProjects();
    loadUsers(); // Carregar usuários ao montar
    loadGroups(); // Carregar grupos ao montar
    loadDocumentModels(); // Carregar modelos de documento ao montar
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    const data = await apiService.getProjects();
    setProjects(data);
    setLoading(false);
  };

  const loadUsers = async () => {
    const users = await apiService.getAllUsers(); // Supondo que apiService.getAllUsers() exista
    setAllUsers(users);
  };

  const loadGroups = async () => {
    const groups = await apiService.getGroups(); // Supondo que apiService.getGroups() exista
    setAllGroups(groups);
  };

  const loadDocumentModels = async () => {
    const models = await apiService.getDocumentModels();
    setAllDocumentModels(models);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await apiService.createProject(newProjectName, newProjectDescription, selectedResponsibleIds, selectedGroupIds, selectedDocumentModelId);
    setNewProjectName('');
    setNewProjectDescription('');
    setSelectedResponsibleIds([]); // Limpar seleção após criar projeto
    setSelectedGroupIds([]); // Limpar seleção de grupos após criar projeto
    setSelectedDocumentModelId(undefined); // Limpar seleção de modelo de documento
    setDialogOpen(false);
    loadProjects();
  };

  const getStatusBadge = (status: Project['status']) => {
    const variants: Record<Project['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'draft': { label: 'Rascunho', variant: 'secondary' },
      'in-progress': { label: 'Em andamento', variant: 'default' },
      'review': { label: 'Em revisão', variant: 'outline' },
      'approved': { label: 'Aprovado', variant: 'default' }
    };

    const { label, variant } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getRoleBadge = (role: User['role']) => {
    const labels: Record<User['role'], string> = {
      'user': 'Usuário',
      'manager': 'Gerente',
      'admin': 'Administrador',
      'director': 'Diretor',
      'technical_responsible': 'Responsável Técnico',
      'operational': 'Operacional',
    };
    return labels[role];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl">Gerenciamento Interno de Documentos</h1>
              <p className="text-sm text-gray-600 mt-1">
                {user.name} • {getRoleBadge(user.role)}
              </p>
            </div>
            <div className="flex items-center gap-2">
             {user.role === 'admin' && ( /* Apenas admin tem permissão para configurar API/Banco de Dados */
              <Button variant="outline" size="sm" onClick={() => setConfigDialogOpen(true)}>
                {/* <Settings className="w-4 h-4 mr-2" /> */}
                Configurar API
              </Button>
            )}
             
              {/* <Button variant="outline" size="sm" onClick={onLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button> */}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Meus Projetos</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Criar novo projeto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Projeto</DialogTitle>
                <DialogDescription>
                  Crie um novo projeto de especificação de requisitos
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProject} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Nome do Projeto *</Label>
                  <Input
                    id="project-name"
                    placeholder="Ex: Sistema de Gestão Financeira"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-description">Descrição (opcional)</Label>
                  <Textarea
                    id="project-description"
                    placeholder="Descreva brevemente o objetivo do projeto..."
                    rows={3}
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-responsibles">Responsáveis (opcional)</Label>
                  <MultiSelect
                    options={allUsers.map(user => ({ label: user.name, value: user.id }))}
                    selected={selectedResponsibleIds}
                    onSelectedChange={setSelectedResponsibleIds}
                    placeholder="Selecione responsáveis..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-groups">Grupos (opcional)</Label>
                  <MultiSelect
                    options={allGroups.map(group => ({ label: group.name, value: group.id }))}
                    selected={selectedGroupIds}
                    onSelectedChange={setSelectedGroupIds}
                    placeholder="Selecione os grupos do projeto..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-document-model">Modelo de Documento (opcional)</Label>
                  <MultiSelect
                    options={allDocumentModels.map(model => ({ label: model.name, value: model.id }))}
                    selected={selectedDocumentModelId ? [selectedDocumentModelId] : []}
                    onSelectedChange={(ids) => setSelectedDocumentModelId(ids[0])}
                    placeholder="Selecione um modelo de documento..."
                    maxSelected={1}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Criar Projeto</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
            
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg mb-2">Nenhum projeto encontrado</h3>
              <p className="text-sm text-gray-600 mb-4">
                Comece criando seu primeiro projeto de especificação
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar primeiro projeto
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <Card 
                key={project.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => onProjectSelect(project.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    {getStatusBadge(project.status)}
                  </div>
                  {project.description && (
                    <CardDescription className="line-clamp-2">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>Criador:</span>
                      <span>{project.creatorName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Criado em:</span>
                      <span>{new Date(project.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Atualizado:</span>
                      <span>{new Date(project.updatedAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {project.responsibleIds && project.responsibleIds.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span>Responsáveis:</span>
                        <span className="font-medium">
                          {project.responsibleIds
                            .map(id => allUsers.find(u => u.id === id)?.name || '')
                            .filter(name => name !== '')
                            .join(', ')}
                        </span>
                      </div>
                    )}
                    {project.groupIds && project.groupIds.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span>Grupos:</span>
                        <span className="font-medium">
                          {project.groupIds
                            .map(id => allGroups.find(g => g.id === id)?.name || '')
                            .filter(name => name !== '')
                            .join(', ')}
                        </span>
                      </div>
                    )}
                    {project.documentModelId && (
                      <div className="flex items-center justify-between">
                        <span>Modelo:</span>
                        <span>
                          {allDocumentModels.find(m => m.id === project.documentModelId)?.name || 'N/A'}
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

      <DatabaseConfigDialog open={configDialogOpen} onOpenChange={setConfigDialogOpen} />
    </div>
  );
}
