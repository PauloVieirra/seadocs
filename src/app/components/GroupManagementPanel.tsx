import { useEffect, useState } from 'react';
import { apiService, type Group, type User } from '../../services/api';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Plus } from 'lucide-react';
import { MultiSelect } from './ui/multi-select';
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
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedResponsibleId, setSelectedResponsibleId] = useState<string | undefined>(undefined);
  const [parentGroups, setParentGroups] = useState<Group[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadGroups();
    loadUsers();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    const data = await apiService.getGroups();
    setGroups(data);
    setParentGroups(data); // Grupos existentes podem ser pais
    setLoading(false);
  };

  const loadUsers = async () => {
    const users = await apiService.getAllUsers();
    setAllUsers(users);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Permissão para criar grupo: Apenas Admin ou Gerente
      if (user.role !== 'admin' && user.role !== 'manager') {
        alert('Permissão negada: Somente administradores ou gerentes podem criar grupos.');
        return;
      }
      await apiService.createGroup(newGroupName, newGroupDescription, selectedParentId, selectedMemberIds, selectedResponsibleId);
      setNewGroupName('');
      setNewGroupDescription('');
      setSelectedMemberIds([]);
      setSelectedResponsibleId(undefined);
      setSelectedParentId(undefined);
      setDialogOpen(false);
      loadGroups();
    } catch (error: any) {
      alert(error.message); // Exibir erro de permissão, por exemplo
    }
  };

  const handleEditGroupClick = (group: Group) => {
    // Permissão para editar grupo: Apenas Admin ou responsável pelo grupo
    if (user.role !== 'admin' && user.id !== group.responsibleId) {
      alert('Permissão negada: Somente administradores ou o responsável pelo grupo podem editar.');
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
            {/* Apenas Admin ou Gerente podem ver o botão de criar grupo */}
            {(user.role === 'admin' || user.role === 'manager') && (
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
                <MultiSelect
                  options={allUsers.map(u => ({ label: u.name, value: u.id }))}
                  selected={selectedMemberIds}
                  onSelectedChange={setSelectedMemberIds}
                  placeholder="Selecione os membros do grupo..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-responsible">Responsável pelo Grupo (opcional)</Label>
                <MultiSelect
                  options={allUsers.map(u => ({ label: u.name, value: u.id }))}
                  selected={selectedResponsibleId ? [selectedResponsibleId] : []}
                  onSelectedChange={(ids) => setSelectedResponsibleId(ids[0])}
                  placeholder="Selecione o responsável pelo grupo..."
                  maxSelected={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-parent">Grupo Pai (opcional)</Label>
                <MultiSelect
                  options={parentGroups.filter(g => g.id !== selectedParentId).map(g => ({ label: g.name, value: g.id }))}
                  selected={selectedParentId ? [selectedParentId] : []}
                  onSelectedChange={(ids) => setSelectedParentId(ids[0])}
                  placeholder="Selecione um grupo pai..."
                  maxSelected={1}
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
            {/* Apenas Admin ou Gerente podem ver o botão de criar primeiro grupo */}
            {(user.role === 'admin' || user.role === 'manager') && (
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
          allGroups={groups} // Passar todos os grupos para a lógica de grupo pai
        />
      )}
    </div>
  );
}
