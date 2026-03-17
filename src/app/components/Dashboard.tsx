import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Plus, FileText, Search, Trash2, Settings, Rocket, Trash, Archive } from 'lucide-react';
import { apiService, type Project, type User, type Group } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { AIConfigDialog } from './AIConfigDialog';
import { MultiSelect } from './ui/multi-select'; // Importar MultiSelect
import { UserSearchSelect } from './UserSearchSelect'; // Importar novo componente
import { ProjectSettingsDialog } from './ProjectSettingsDialog'; // Importar ProjectSettingsDialog
import { PasswordConfirmationDialog } from './PasswordConfirmationDialog'; // Importar novo componente
import { toast } from 'sonner';
// Removido Tabs, TabsContent, TabsList, TabsTrigger, UserManagementPanel, DocumentModelManagementPanel

interface DashboardProps {
  user: User;
  onProjectSelect: (projectId: string) => void;
  // onLogout: () => void; // Removido, GlobalNav agora lida com o logout
}

export function Dashboard({ user, onProjectSelect }: DashboardProps) { // Removido onLogout
  const perms = usePermissions(user);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false); // Manter configDialogOpen para o dialog
  const [allUsers, setAllUsers] = useState<User[]>([]); // Novo estado para todos os usuários
  const [selectedResponsibleIds, setSelectedResponsibleIds] = useState<string[]>([]); // Novo estado para IDs de responsáveis selecionados
  const [allGroups, setAllGroups] = useState<Group[]>([]); // Novo estado para todos os grupos
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]); // Novo estado para IDs de grupos selecionados
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDialogMode, setPasswordDialogMode] = useState<'archive' | 'delete'>('delete');
  const [projectForPasswordAction, setProjectForPasswordAction] = useState<string | null>(null);
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  useEffect(() => {
    loadProjects();
    loadUsers(); // Carregar usuários ao montar
    loadGroups(); // Carregar grupos ao montar
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    const data = await apiService.getProjects();
    setProjects(data);
    setFilteredProjects(data);
    setLoading(false);
  };

  const handlePublishProject = async (projectId: string) => {
    try {
      setLoading(true);
      await apiService.publishProject(projectId);
      const updated = await apiService.getProject(projectId);
      if (updated) {
        setProjects(prev => prev.map(p => p.id === projectId ? updated : p));
        setFilteredProjects(prev => prev.map(p => p.id === projectId ? updated : p));
      }
      toast.success('Projeto publicado com sucesso!');
      await loadProjects();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao publicar projeto');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordConfirm = async (password: string) => {
    if (!projectForPasswordAction) return;
    const projectId = projectForPasswordAction;

    if (passwordDialogMode === 'archive') {
      try {
        setLoading(true);
        await apiService.archiveProjectWithPassword(projectId, password);
        const updated = await apiService.getProject(projectId);
        if (updated) {
          setProjects(prev => prev.map(p => p.id === projectId ? updated : p));
          setFilteredProjects(prev => prev.map(p => p.id === projectId ? updated : p));
        }
        setPasswordDialogOpen(false);
        setProjectForPasswordAction(null);
        toast.success('Projeto arquivado com sucesso!');
        await loadProjects();
      } catch (error: any) {
        toast.error(error?.message || 'Erro ao arquivar projeto');
        throw error;
      } finally {
        setLoading(false);
      }
    } else {
      try {
        setDeletingProjectId(projectId);
        await apiService.deleteProjectWithPassword(projectId, password);
        setProjects(prev => prev.filter(p => p.id !== projectId));
        setFilteredProjects(prev => prev.filter(p => p.id !== projectId));
        setPasswordDialogOpen(false);
        setProjectForPasswordAction(null);
        toast.success('Projeto removido com sucesso!');
        await loadProjects();
      } catch (error: any) {
        toast.error(error?.message || 'Erro ao remover projeto');
        throw error;
      } finally {
        setDeletingProjectId(null);
      }
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    // Filtrar apenas se tiver 3 ou mais caracteres
    if (value.length >= 3) {
      const filtered = projects.filter(project =>
        project.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredProjects(filtered);
    } else if (value.length === 0) {
      // Se limpar a busca, mostrar todos os projetos
      setFilteredProjects(projects);
    }
    // Se tiver 1-2 caracteres, manter o filtro anterior
  };

  const loadUsers = async () => {
    const users = await apiService.getAllUsers(); // Supondo que apiService.getAllUsers() exista
    setAllUsers(users);
  };

  const loadGroups = async () => {
    const groups = await apiService.getGroups(); // Supondo que apiService.getGroups() exista
    setAllGroups(groups);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const project = await apiService.createProject(newProjectName, newProjectDescription, selectedResponsibleIds, selectedGroupIds);
      setProjects(prev => [...prev, project]);
      setFilteredProjects(prev => [...prev, project]);
      toast.success('Projeto criado com sucesso!');
      setNewProjectName('');
      setNewProjectDescription('');
      setSelectedResponsibleIds([]);
      setSelectedGroupIds([]);
      setDialogOpen(false);
      await loadProjects();
    } catch (error: any) {
      console.error('Erro ao criar projeto:', error);
      toast.error('Erro ao criar projeto: ' + error.message);
    }
  };


  const getStatusBadge = (project: Project) => {
    if (project.estado === false) return <Badge variant="outline">Arquivado</Badge>;
    const variants: Record<Project['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'draft': { label: 'Não publicado', variant: 'secondary' },
      'published': { label: 'Publicado', variant: 'default' },
      'archived': { label: 'Arquivado', variant: 'outline' },
      'in-progress': { label: 'Em andamento', variant: 'default' },
      'review': { label: 'Em revisão', variant: 'outline' },
      'approved': { label: 'Aprovado', variant: 'default' }
    };
    const { label, variant } = variants[project.status] ?? variants['draft'];
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
             {perms.canConfigureSystem() && (
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
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Meus Projetos</h2>
            {perms.canCreateProjects() && (
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
                      <UserSearchSelect
                        users={allUsers}
                        selectedUsers={selectedResponsibleIds}
                        onSelectionChange={setSelectedResponsibleIds}
                        placeholder="Busque por nome ou email..."
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
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">Criar Projeto</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar projetos pelo título (mínimo 3 caracteres)..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
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
                {perms.canCreateProjects() 
                  ? 'Comece criando seu primeiro projeto de especificação' 
                  : 'Você ainda não foi incluído em nenhum projeto.'}
              </p>
              {perms.canCreateProjects() && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar primeiro projeto
                    </Button>
                  </DialogTrigger>
                </Dialog>
              )}
            </CardContent>
          </Card>
        ) : filteredProjects.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg mb-2">Nenhum projeto encontrado</h3>
              <p className="text-sm text-gray-600">
                Nenhum projeto corresponde à sua busca.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(project => (
              <Card 
                key={project.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer group relative overflow-hidden"
                onClick={() => onProjectSelect(project.id)}
              >
                <CardHeader className="!flex flex-col space-y-3">
                  {/* Título em linha única, truncado */}
                  <CardTitle className="text-lg truncate pr-1" title={project.name}>
                    {project.name}
                  </CardTitle>
                  {project.description && (
                    <CardDescription className="line-clamp-2">
                      {project.description}
                    </CardDescription>
                  )}
                  {project.groupIds && project.groupIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {project.groupIds
                        .map(id => allGroups.find(g => g.id === id)?.name || '')
                        .filter(name => name !== '')
                        .map(name => (
                          <Badge key={name} variant="outline" className="text-[10px] py-0 px-1 font-normal bg-blue-50 text-blue-700 border-blue-200">
                            {name}
                          </Badge>
                        ))
                      }
                    </div>
                  )}
                  {/* Status e ações em linha que pode quebrar */}
                  <div className="flex flex-wrap items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    {getStatusBadge(project)}
                    {(perms.canEditProjects() || perms.canDeleteProjects()) && (
                      <>
                        {perms.canEditProjects() && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-blue-600 hover:bg-blue-50 shrink-0"
                          onClick={() => {
                            setSettingsProjectId(project.id);
                            setSettingsDialogOpen(true);
                          }}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        )}
                        {perms.canEditProjects() && project.status === 'draft' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 h-8 text-xs shrink-0"
                            onClick={() => handlePublishProject(project.id)}
                          >
                            <Rocket className="w-3 h-3 mr-1" />
                            Publicar
                          </Button>
                        ) : perms.isAdmin() && project.estado === true ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 h-8 text-xs shrink-0"
                            onClick={() => {
                              setProjectForPasswordAction(project.id);
                              setPasswordDialogMode('archive');
                              setPasswordDialogOpen(true);
                            }}
                          >
                            <Archive className="w-3 h-3 mr-1" />
                            Arquivar
                          </Button>
                        ) : perms.isAdmin() && project.estado === false ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 h-8 text-xs shrink-0"
                            onClick={() => handlePublishProject(project.id)}
                          >
                            <Rocket className="w-3 h-3 mr-1" />
                            Publicar
                          </Button>
                        ) : null}
                        {perms.canDeleteProjects() && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                            disabled={deletingProjectId === project.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectForPasswordAction(project.id);
                              setPasswordDialogMode('delete');
                              setPasswordDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <AIConfigDialog open={configDialogOpen} onOpenChange={setConfigDialogOpen} />
      
      <PasswordConfirmationDialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open);
          if (!open) setProjectForPasswordAction(null);
        }}
        onConfirm={handlePasswordConfirm}
        title={passwordDialogMode === 'archive' ? 'Arquivar Projeto' : 'Remover Projeto'}
        description={passwordDialogMode === 'archive'
          ? 'Digite sua senha para confirmar o arquivamento do projeto. O projeto ficará visível apenas para administradores.'
          : 'Esta ação requer sua senha para confirmar a remoção permanente do projeto e todos os seus documentos.'}
        confirmLabel={passwordDialogMode === 'archive' ? 'Arquivar' : 'Remover do Banco de Dados'}
      />
      
      {settingsProjectId && (
        <ProjectSettingsDialog
          projectId={settingsProjectId}
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
          onUpdateSuccess={loadProjects}
        />
      )}
    </div>
  );
}
