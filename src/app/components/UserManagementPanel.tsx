import { useEffect, useState } from 'react';
import { apiService, type User } from '../../services/api';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus } from 'lucide-react';
import { Badge } from './ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

interface UserManagementPanelProps {
  currentUser: User;
}

export function UserManagementPanel({ currentUser }: UserManagementPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<User['role']>('operational');

  // Estados para edição de usuário
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedUserName, setEditedUserName] = useState('');
  const [editedUserEmail, setEditedUserEmail] = useState('');
  const [editedUserRole, setEditedUserRole] = useState<User['role']>('operational');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const allUsers = await apiService.getAllUsers();
    // Garante que isActive seja true por padrão se não definido
    setUsers(allUsers.map(u => ({ ...u, isActive: u.isActive === undefined ? true : u.isActive })));
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // No mock, a senha não é usada na criação direta
      await apiService.register(newUserEmail, "senha_padrao", newUserName, newUserRole);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('operational');
      setDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEditUserClick = (user: User) => {
    setEditingUser(user);
    setEditedUserName(user.name);
    setEditedUserEmail(user.email);
    setEditedUserRole(user.role);
    setEditDialogOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSaving(true);
    try {
      const updatedUser: User = {
        ...editingUser,
        name: editedUserName,
        email: editedUserEmail,
        role: editedUserRole,
      };
      const result = await apiService.updateUser(updatedUser);
      if (result) {
        loadUsers(); // Recarregar usuários para mostrar a atualização
        setEditDialogOpen(false);
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleUserStatus = async () => {
    if (!editingUser) return;
    setIsTogglingStatus(true);
    try {
      const updatedUser: User = {
        ...editingUser,
        isActive: !editingUser.isActive,
      };
      const result = await apiService.updateUser(updatedUser);
      if (result) {
        loadUsers();
        setEditDialogOpen(false);
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!editingUser) return;
    setIsDeleting(true);
    try {
      const result = await apiService.deleteUser(editingUser.id);
      if (result) {
        loadUsers(); // Recarregar usuários para remover o excluído
        setEditDialogOpen(false);
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleLabel = (role: User['role']) => {
    const labels: Record<User['role'], string> = {
      'admin': 'Administrador',
      'director': 'Diretor',
      'manager': 'Gerente',
      'technical_responsible': 'Responsável Técnico',
      'operational': 'Operacional',
      'user': 'Usuário' // Embora 'user' não seja um papel dos requisitos, mantemos aqui para consistência
    };
    return labels[role];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Gerenciamento de Usuários</h3>
        {(currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'technical_responsible') && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Criar Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Adicione um novo usuário ao sistema e defina seu papel.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="user-name">Nome Completo *</Label>
                  <Input
                    id="user-name"
                    placeholder="Ex: João Silva"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-email">E-mail *</Label>
                  <Input
                    id="user-email"
                    type="email"
                    placeholder="exemplo@empresa.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-role">Papel *</Label>
                  <Select value={newUserRole} onValueChange={(value: User['role']) => setNewUserRole(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="director">Diretor</SelectItem>
                      <SelectItem value="manager">Gerente</SelectItem>
                      <SelectItem value="technical_responsible">Responsável Técnico</SelectItem>
                      <SelectItem value="operational">Operacional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Criar Usuário</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
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
      ) : users.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <h3 className="text-lg mb-2">Nenhum usuário encontrado</h3>
            {currentUser.role === 'admin' && (
              <p className="text-sm text-gray-600 mb-4">
                Comece adicionando seu primeiro usuário.
              </p>
            )}
            {currentUser.role === 'admin' && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar primeiro usuário
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {users.map(userItem => (
            <Card key={userItem.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <CardTitle className="text-md">{userItem.name}</CardTitle>
                  <CardDescription>{userItem.email}</CardDescription>
                </div>
                <Badge variant="secondary">{getRoleLabel(userItem.role)}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para Editar/Excluir Usuário */}
      {editingUser && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Gerencie os detalhes do usuário selecionado.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateUser} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-user-name">Nome Completo *</Label>
                <Input
                  id="edit-user-name"
                  value={editedUserName}
                  onChange={(e) => setEditedUserName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-email">E-mail *</Label>
                <Input
                  id="edit-user-email"
                  type="email"
                  value={editedUserEmail}
                  onChange={(e) => setEditedUserEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-role">Papel *</Label>
                <Select value={editedUserRole} onValueChange={(value: User['role']) => setEditedUserRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="director">Diretor</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="technical_responsible">Responsável Técnico</SelectItem>
                    <SelectItem value="operational">Operacional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>

            {currentUser.role === 'admin' && ( // Apenas admin pode suspender/excluir outros usuários
              <div className="mt-6 pt-4 border-t space-y-4">
                <Button
                  variant={editingUser.isActive ? 'destructive' : 'default'}
                  onClick={handleToggleUserStatus}
                  disabled={isTogglingStatus || editingUser.id === currentUser.id}
                  className="w-full"
                >
                  {isTogglingStatus ? 'Processando...' : editingUser.isActive ? 'Suspender Usuário' : 'Ativar Usuário'}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive"
                      className="w-full"
                      disabled={isDeleting || editingUser.id === currentUser.id}
                    >
                      Excluir Usuário
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso excluirá permanentemente o usuário {editingUser.name} e removerá seus dados do sistema.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteUser} disabled={isDeleting}>
                        {isDeleting ? 'Excluindo...' : 'Excluir'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
