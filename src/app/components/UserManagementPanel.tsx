import { useEffect, useState, useMemo } from 'react';
import { apiService, type User, type UserPermissions } from '../../services/api';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Search, Filter, MoreHorizontal, User as UserIcon, Mail, ShieldCheck, Calendar, Trash2, Key, UserMinus, UserCheck, CheckCircle2, AlertCircle, Shield, Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Checkbox } from './ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { toast } from 'sonner';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

interface UserManagementPanelProps {
  currentUser: User;
}

export function UserManagementPanel({ currentUser }: UserManagementPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<User['role']>('operational');

  // Estados para reset de senha
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedUserName, setEditedUserName] = useState('');
  const [editedUserEmail, setEditedUserEmail] = useState('');
  const [editedUserRole, setEditedUserRole] = useState<User['role']>('operational');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Estados de Permissões
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<Omit<UserPermissions, 'id' | 'userId'> | null>(null);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
    const allUsers = await apiService.getAllUsers();
    setUsers(allUsers.map(u => ({ ...u, isActive: u.isActive === undefined ? true : u.isActive })));
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Falha ao carregar lista de usuários');
    } finally {
    setLoading(false);
    }
  };

  const handleRowClick = async (user: User) => {
    setSelectedUserForPermissions(user);
    setPermissionsDialogOpen(true);
    
    try {
      const perms = await apiService.getUserPermissions(user.id);
      if (perms) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, userId, ...rest } = perms;
        setUserPermissions(rest);
      }
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
      toast.error('Erro ao carregar permissões do usuário');
    }
  };

  const handlePermissionChange = (field: keyof Omit<UserPermissions, 'id' | 'userId'>, value: boolean) => {
    if (!userPermissions) return;
    
    // Se acesso_total for marcado, marca tudo como true. Se desmarcado, não faz nada (mantém os outros)
    if (field === 'acesso_total' && value === true) {
      const allTrue = Object.keys(userPermissions).reduce((acc, key) => {
        acc[key as keyof Omit<UserPermissions, 'id' | 'userId'>] = true;
        return acc;
      }, {} as any);
      setUserPermissions(allTrue);
    } else {
      setUserPermissions(prev => prev ? ({ ...prev, [field]: value }) : null);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedUserForPermissions || !userPermissions) return;
    
    setIsSavingPermissions(true);
    try {
      const success = await apiService.saveUserPermissions(selectedUserForPermissions.id, userPermissions);
      if (success) {
        toast.success('Permissões atualizadas com sucesso!');
        setPermissionsDialogOpen(false);
      } else {
        toast.error('Falha ao salvar permissões');
      }
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      toast.error('Erro ao salvar permissões');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!newUserPassword) {
        toast.error('A senha é obrigatória');
        return;
      }
      if (newUserPassword.length < 6) {
        toast.error('A senha deve ter pelo menos 6 caracteres');
        return;
      }
      await apiService.register(newUserEmail, newUserPassword, newUserName, newUserRole);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('operational');
      setDialogOpen(false);
      loadUsers();
      toast.success('Usuário criado com sucesso!');
    } catch (error: any) {
      toast.error(error.message);
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
      await apiService.updateUser(updatedUser);
      loadUsers();
        setEditDialogOpen(false);
      toast.success('Usuário atualizado com sucesso');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    setIsTogglingStatus(true);
    try {
      const updatedUser: User = {
        ...user,
        isActive: !user.isActive,
      };
      await apiService.updateUser(updatedUser);
        loadUsers();
      toast.success(`Usuário ${updatedUser.isActive ? 'ativado' : 'suspenso'} com sucesso`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setIsDeleting(true);
    try {
      await apiService.deleteUser(userId);
      loadUsers();
      toast.success('Usuário excluído permanentemente');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;

    if (!newPassword || newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsResettingPassword(true);
    try {
      await apiService.updateUserPassword(resetPasswordUser.id, newPassword, true);
      setResetPasswordDialogOpen(false);
      setResetPasswordUser(null);
      toast.success('Senha resetada! O usuário deverá alterá-la no próximo login.');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const getRoleLabel = (role: User['role']) => {
    const labels: Record<User['role'], string> = {
      'admin': 'Administrador',
      'manager': 'Gerente',
      'technical_responsible': 'Técnico Operacional',
      'operational': 'Operacional',
      'external': 'Usuário Externo'
    };
    return labels[role];
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar (Matching Image) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          <Button variant="ghost" size="sm" className="text-gray-600 font-normal">
            <UserIcon className="w-4 h-4 mr-2" /> Action
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-600 font-normal">
            <Calendar className="w-4 h-4 mr-2" /> Action
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-600 font-normal">
            <ShieldCheck className="w-4 h-4 mr-2" /> Action
          </Button>
          
          <div className="w-px h-6 bg-gray-200 mx-2" />
          
          {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4">
                  <Plus className="mr-2 h-4 w-4" /> Novo Usuário
              </Button>
            </DialogTrigger>
              <DialogContent className="sm:max-w-[450px]">
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
                  <Label htmlFor="user-password">Senha Inicial *</Label>
                  <Input
                    id="user-password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
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
                      <SelectItem value="manager">Gerente</SelectItem>
                      <SelectItem value="technical_responsible">Técnico Operacional</SelectItem>
                      <SelectItem value="operational">Operacional</SelectItem>
                      <SelectItem value="external">Usuário Externo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-lg">
                    Cancelar
                  </Button>
                    <Button type="submit" disabled={!newUserName || !newUserEmail || !newUserPassword || newUserPassword.length < 6} className="bg-blue-600 hover:bg-blue-700 rounded-lg">
                    Criar Usuário
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-9 text-gray-600 font-normal border-gray-200">
            <Filter className="w-4 h-4 mr-2" /> Filter
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Find"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9 w-[200px] md:w-[250px] bg-white border-gray-200 focus:ring-blue-500 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Table (Matching Image) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow className="hover:bg-transparent border-b border-gray-200">
              <TableHead className="text-gray-600 font-medium text-xs uppercase tracking-wider h-12 pl-6">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-3.5 h-3.5" /> Name
                </div>
              </TableHead>
              <TableHead className="text-gray-600 font-medium text-xs uppercase tracking-wider h-12">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" /> Email
                </div>
              </TableHead>
              <TableHead className="text-gray-600 font-medium text-xs uppercase tracking-wider h-12">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5" /> Role
                </div>
              </TableHead>
              <TableHead className="text-gray-600 font-medium text-xs uppercase tracking-wider h-12">
                Status
              </TableHead>
              <TableHead className="w-[50px] pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />
                      <div className="h-4 w-32 bg-gray-100 animate-pulse rounded" />
                    </div>
                  </TableCell>
                  <TableCell><div className="h-4 w-48 bg-gray-100 animate-pulse rounded" /></TableCell>
                  <TableCell><div className="h-4 w-24 bg-gray-100 animate-pulse rounded" /></TableCell>
                  <TableCell><div className="h-4 w-16 bg-gray-100 animate-pulse rounded" /></TableCell>
                  <TableCell className="pr-6" />
                </TableRow>
              ))
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-gray-500">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow 
                  key={user.id} 
                  className="group hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0 cursor-pointer"
                  onClick={() => handleRowClick(user)}
                >
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-gray-200">
                        <AvatarImage src="" />
                        <AvatarFallback className={user.isActive ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-400"}>
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className={`font-medium text-sm truncate ${user.isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                          {user.name}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600 text-sm">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-200 font-normal border-0 px-2 py-0">
                      {getRoleLabel(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <div className="flex items-center gap-1.5 text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-medium uppercase tracking-wider">Ativo</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <UserMinus className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-medium uppercase tracking-wider">Suspenso</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="pr-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
              </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[180px] rounded-xl shadow-lg border-gray-200">
                        <DropdownMenuLabel className="text-xs text-gray-500 font-normal px-3 py-2">Gerenciar Usuário</DropdownMenuLabel>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditUserClick(user); }} className="cursor-pointer gap-2 py-2">
                          <UserIcon className="w-4 h-4 text-gray-500" /> Editar Perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleResetPasswordClick(user); }} className="cursor-pointer gap-2 py-2">
                          <Key className="w-4 h-4 text-gray-500" /> Resetar Senha
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); handleToggleUserStatus(user); }} 
                          className={`cursor-pointer gap-2 py-2 ${user.isActive ? 'text-orange-600 focus:text-orange-600 focus:bg-orange-50' : 'text-green-600 focus:text-green-600 focus:bg-green-50'}`}
                          disabled={user.id === currentUser.id}
                        >
                          {user.isActive ? (
                            <><UserMinus className="w-4 h-4" /> Suspender</>
                          ) : (
                            <><UserCheck className="w-4 h-4" /> Ativar</>
                          )}
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer gap-2 py-2 text-red-600 focus:text-red-600 focus:bg-red-50" disabled={user.id === currentUser.id}>
                              <Trash2 className="w-4 h-4" /> Excluir permanentemente
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl" onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-2">
                                <AlertCircle className="w-6 h-6 text-red-600" />
                              </div>
                              <AlertDialogTitle className="text-center">Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription className="text-center">
                                Tem certeza que deseja excluir <strong>{user.name}</strong>? Esta ação é irreversível e removerá todos os acessos deste usuário.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="sm:justify-center gap-2 mt-4">
                              <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteUser(user.id)} 
                                className="bg-red-600 hover:bg-red-700 rounded-lg text-white"
                              >
                                Sim, excluir usuário
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
                </div>

      {/* Pagination Footer (Optional extra to match style) */}
      <div className="flex items-center justify-between px-2 py-2 text-xs text-gray-500">
        <div>Mostrando {filteredUsers.length} de {users.length} usuários</div>
        <div className="flex items-center gap-4">
          <span>Página 1 de 1</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7 rounded border-gray-200" disabled>
              &lt;
                  </Button>
            <Button variant="outline" size="icon" className="h-7 w-7 rounded border-gray-200" disabled>
              &gt;
                  </Button>
                </div>
        </div>
      </div>

      {/* Modals moved from old list to clean up */}

      {/* Dialog para Resetar Senha */}
      {resetPasswordUser && (
        <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Resetar Senha</DialogTitle>
              <DialogDescription>
                Defina uma nova senha para {resetPasswordUser.name}. O usuário será obrigado a alterar na próxima login.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleResetPassword} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reset-password">Nova Senha *</Label>
                <Input
                  id="reset-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-password-confirm">Confirmar Senha *</Label>
                <Input
                  id="reset-password-confirm"
                  type="password"
                  placeholder="Repita a senha"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setResetPasswordDialogOpen(false)} className="rounded-lg">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isResettingPassword || !newPassword || !newPasswordConfirm || newPassword.length < 6} className="bg-blue-600 hover:bg-blue-700 rounded-lg">
                  {isResettingPassword ? 'Salvando...' : 'Resetar Senha'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog para Editar Usuário */}
      {editingUser && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="rounded-2xl">
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
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="technical_responsible">Técnico Operacional</SelectItem>
                    <SelectItem value="operational">Operacional</SelectItem>
                    <SelectItem value="external">Usuário Externo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-lg">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 rounded-lg">
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de Permissões do Sistema */}
      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle>Permissões do Sistema</DialogTitle>
                <DialogDescription>
                  Defina o que <strong>{selectedUserForPermissions?.name}</strong> pode acessar e gerenciar.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6">
            {!userPermissions ? (
              <div className="py-12 text-center text-gray-500 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                Carregando permissões...
              </div>
            ) : (
              <div className="space-y-6 py-4 pb-8">
                {/* Acesso Total */}
                <div className="flex items-center justify-between p-4 bg-orange-50 border border-orange-100 rounded-xl">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold text-orange-900">Acesso Total (Superusuário)</Label>
                    <p className="text-xs text-orange-700">Habilita todas as permissões do sistema automaticamente.</p>
                  </div>
                  <Checkbox 
                    checked={userPermissions.acesso_total} 
                    onCheckedChange={(v) => handlePermissionChange('acesso_total', !!v)}
                    className="border-orange-300 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                  />
                </div>

                <Separator />

                {/* Gestão Administrativa */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Gestão Administrativa</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <PermissionItem 
                      label="Gerenciar Usuários" 
                      description="Criar, editar e excluir contas"
                      checked={userPermissions.gerenciar_usuarios}
                      onChange={(v) => handlePermissionChange('gerenciar_usuarios', v)}
                    />
                    <PermissionItem 
                      label="Gerenciar Grupos" 
                      description="Criar e organizar equipes"
                      checked={userPermissions.gerenciar_grupos}
                      onChange={(v) => handlePermissionChange('gerenciar_grupos', v)}
                    />
                  </div>
                </div>

                {/* Gestão de Projetos */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Gestão de Projetos</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <PermissionItem 
                      label="Criar Projetos" 
                      checked={userPermissions.criar_projetos}
                      onChange={(v) => handlePermissionChange('criar_projetos', v)}
                    />
                    <PermissionItem 
                      label="Editar Projetos" 
                      checked={userPermissions.editar_projetos}
                      onChange={(v) => handlePermissionChange('editar_projetos', v)}
                    />
                    <PermissionItem 
                      label="Excluir Projetos" 
                      checked={userPermissions.excluir_projetos}
                      onChange={(v) => handlePermissionChange('excluir_projetos', v)}
                    />
                    <PermissionItem 
                      label="Visualizar Tudo" 
                      description="Ver todos os projetos do sistema"
                      checked={userPermissions.visualizar_todos_projetos}
                      onChange={(v) => handlePermissionChange('visualizar_todos_projetos', v)}
                    />
                  </div>
                </div>

                {/* Gestão de Documentos */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Gestão de Documentos</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <PermissionItem 
                      label="Visualizar Documentos" 
                      checked={userPermissions.visualizar_documentos}
                      onChange={(v) => handlePermissionChange('visualizar_documentos', v)}
                    />
                    <PermissionItem 
                      label="Criar Documentos" 
                      checked={userPermissions.criar_documentos}
                      onChange={(v) => handlePermissionChange('criar_documentos', v)}
                    />
                    <PermissionItem 
                      label="Editar Documentos" 
                      checked={userPermissions.editar_documentos}
                      onChange={(v) => handlePermissionChange('editar_documentos', v)}
                    />
                    <PermissionItem 
                      label="Excluir Documentos" 
                      checked={userPermissions.excluir_documentos}
                      onChange={(v) => handlePermissionChange('excluir_documentos', v)}
                    />
                    <PermissionItem 
                      label="Download de Arquivos" 
                      checked={userPermissions.download_documentos}
                      onChange={(v) => handlePermissionChange('download_documentos', v)}
                    />
                    <PermissionItem 
                      label="Compartilhar" 
                      checked={userPermissions.compartilhar_documentos}
                      onChange={(v) => handlePermissionChange('compartilhar_documentos', v)}
                    />
                  </div>
                </div>

                {/* Modelos e IA */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Modelos e IA</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <PermissionItem 
                      label="Criar Templates" 
                      checked={userPermissions.criar_templates}
                      onChange={(v) => handlePermissionChange('criar_templates', v)}
                    />
                    <PermissionItem 
                      label="Alimentar IA (RAG)" 
                      description="Subir documentos de contexto"
                      checked={userPermissions.alimentar_ia}
                      onChange={(v) => handlePermissionChange('alimentar_ia', v)}
                    />
                    <PermissionItem 
                      label="Gerenciar IA" 
                      description="Configurações globais da IA"
                      checked={userPermissions.gerenciar_ia}
                      onChange={(v) => handlePermissionChange('gerenciar_ia', v)}
                    />
                  </div>
                </div>

                {/* Assinaturas */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Assinaturas</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <PermissionItem 
                      label="Assinar Documentos" 
                      checked={userPermissions.assinar_documentos}
                      onChange={(v) => handlePermissionChange('assinar_documentos', v)}
                    />
                    <PermissionItem 
                      label="Solicitar Assinatura" 
                      checked={userPermissions.solicitar_assinatura}
                      onChange={(v) => handlePermissionChange('solicitar_assinatura', v)}
                    />
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>

          <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
            <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)} className="rounded-lg">
              Cancelar
            </Button>
            <Button 
              onClick={handleSavePermissions} 
              disabled={isSavingPermissions || !userPermissions} 
              className="bg-blue-600 hover:bg-blue-700 rounded-lg px-8"
            >
              {isSavingPermissions ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Permissões'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PermissionItem({ 
  label, 
  description, 
  checked, 
  onChange 
}: { 
  label: string; 
  description?: string; 
  checked: boolean; 
  onChange: (v: boolean) => void 
}) {
  return (
    <div className="flex items-start justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium leading-none cursor-pointer">{label}</Label>
        {description && <p className="text-[11px] text-gray-500 leading-tight">{description}</p>}
      </div>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
    </div>
  );
}
