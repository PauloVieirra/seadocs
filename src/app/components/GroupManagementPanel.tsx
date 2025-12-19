import { useEffect, useState } from 'react';
import { apiService, type Group, type User, type Project } from '../../services/api';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Plus } from 'lucide-react';
import { MultiSelect } from './ui/multi-select';
import { UserSearchSelect } from './UserSearchSelect'; // Importar novo componente
import { ProjectSearchSelect } from './ProjectSearchSelect'; // Importar componente de busca de projetos
import { GroupEditDialog } from './GroupEditDialog'; // Importar GroupEditDialog

interface GroupManagementPanelProps {
  user: User;
}

export function GroupManagementPanel({ user }: GroupManagementPanelProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false); // Para o diálogo de criação
  const [editDialogOpen, setEditDialogOpen] = useState(false); // Para o diálogo de edição
  const [selectedGroupForEdit, setSelectedGroupForEdit] = useState<Group | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedResponsibleId, setSelectedResponsibleId] = useState<string | undefined>(undefined);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  useEffect(() => {
    loadGroups();
    loadUsers();
    loadProjects();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    const data = await apiService.getGroups();
    setGroups(data);
    setLoading(false);
  };

  const loadUsers = async () => {
    const users = await apiService.getAllUsers();
    setAllUsers(users);
  };

  const loadProjects = async () => {
    const projects = await apiService.getProjects();
    setAllProjects(projects);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Permissão para criar grupo: Apenas Admin, Gerente ou Técnico Responsável
      if (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'technical_responsible') {
        alert('Permissão negada: Somente administradores, gerentes ou técnicos responsáveis podem criar grupos.');
        return;
      }
      await apiService.createGroup(newGroupName, newGroupDescription, undefined, selectedMemberIds, selectedResponsibleId, selectedProjectIds);
      setNewGroupName('');
      setNewGroupDescription('');
      setSelectedMemberIds([]);
      setSelectedResponsibleId(undefined);
      setSelectedProjectIds([]);
      setDialogOpen(false);
      loadGroups();
    } catch (error: any) {
      alert(error.message); // Exibir erro de permissão, por exemplo
    }
  };

  const handleEditGroupClick = (group: Group) => {
    // Permissão para editar grupo: Apenas Admin, Gerente, Técnico Responsável ou responsável pelo grupo
    if (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'technical_responsible' && user.id !== group.responsibleId) {
      alert('Permissão negada: Você não tem permissão para editar este grupo.');
      return;
    }
    setSelectedGroupForEdit(group);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Gerenciamento de Grupos</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            {/* Apenas Admin, Gerente ou Técnico Responsável podem ver o botão de criar grupo */}
            {(user.role === 'admin' || user.role === 'manager' || user.role === 'technical_responsible') && (
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Criar Novo Grupo
              </Button>
            )}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Grupo</DialogTitle>
              <DialogDescription>
                Defina os detalhes e membros do seu novo grupo de trabalho.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateGroup} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="group-name">Nome do Grupo *</Label>
                <Input
                  id="group-name"
                  placeholder="Ex: Equipe de Back-end"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-description">Descrição (opcional)</Label>
                <Textarea
                  id="group-description"
                  placeholder="Descreva o objetivo do grupo..."
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-members">Membros</Label>
                <UserSearchSelect
                  users={allUsers}
                  selectedIds={selectedMemberIds}
                  onSelectedChange={setSelectedMemberIds}
                  placeholder="Busque por nome ou email..."
                  maxResults={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-responsible">Responsável pelo Grupo (opcional)</Label>
                <UserSearchSelect
                  users={allUsers}
                  selectedIds={selectedResponsibleId ? [selectedResponsibleId] : []}
                  onSelectedChange={(ids) => setSelectedResponsibleId(ids[0])}
                  placeholder="Busque por nome ou email..."
                  maxResults={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-projects">Projetos Atribuídos (opcional)</Label>
                <ProjectSearchSelect
                  projects={allProjects}
                  selectedIds={selectedProjectIds}
                  onSelectedChange={setSelectedProjectIds}
                  placeholder="Busque por nome do projeto..."
                  maxResults={8}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Criar Grupo</Button>
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
      ) : groups.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <h3 className="text-lg mb-2">Nenhum grupo encontrado</h3>
            <p className="text-sm text-gray-600 mb-4">
              Comece criando seu primeiro grupo de trabalho.
            </p>
            {/* Apenas Admin, Gerente ou Técnico Responsável podem ver o botão de criar primeiro grupo */}
            {(user.role === 'admin' || user.role === 'manager' || user.role === 'technical_responsible') && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Criar primeiro grupo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(group => (
            <Card
              key={group.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleEditGroupClick(group)} // Adicionar onClick para abrir o modal de edição
            >
              <CardHeader>
                <CardTitle>{group.name}</CardTitle>
                {group.description && (
                  <CardDescription>{group.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-2">
                {group.parentId && (
                  <div>
                    <span>Grupo Pai: </span>
                    <span className="font-medium">
                      {groups.find(g => g.id === group.parentId)?.name || 'N/A'}
                    </span>
                  </div>
                )}
                {group.responsibleId && (
                  <div>
                    <span>Responsável: </span>
                    <span className="font-medium">
                      {allUsers.find(u => u.id === group.responsibleId)?.name || 'N/A'}
                    </span>
                  </div>
                )}
                <div>
                  <span>Membros: </span>
                  <span className="font-medium">
                    {group.memberIds.length > 0
                      ? group.memberIds
                          .map(id => allUsers.find(u => u.id === id)?.name || '')
                          .filter(name => name !== '')
                          .join(', ')
                      : 'Nenhum'}
                  </span>
                </div>
                <div>
                  <span>Projetos: </span>
                  <span className="font-medium">
                    {group.projectIds && group.projectIds.length > 0
                      ? group.projectIds
                          .map(id => allProjects.find(p => p.id === id)?.name || '')
                          .filter(name => name !== '')
                          .join(', ')
                      : 'Nenhum'}
                  </span>
                </div>
                <div>
                  <span>Criado em: </span>
                  <span className="font-medium">{new Date(group.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedGroupForEdit && (
        <GroupEditDialog
          group={selectedGroupForEdit}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onUpdateSuccess={loadGroups}
          allUsers={allUsers}
          allGroups={groups}
          allProjects={allProjects}
        />
      )}
    </div>
  );
}
