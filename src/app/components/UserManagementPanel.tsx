import { useEffect, useState } from 'react';
import { apiService, type User } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { permissionsService, type UserPermissions } from '../../services/permissions';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Plus, Settings, KeyRound, Pencil } from 'lucide-react';
import { Badge } from './ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './ui/pagination';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

interface UserManagementPanelProps {
  currentUser: User;
}

export function UserManagementPanel({ currentUser }: UserManagementPanelProps) {
  const perms = usePermissions(currentUser);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [editedUserRole, setEditedUserRole] = useState<User['role']>('operational');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Estados para modal de permissões
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [localPerms, setLocalPerms] = useState<Partial<UserPermissions>>({});
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  // Paginação
  const pageSize = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(users.length / pageSize);
  const paginatedUsers = users.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /** Labels das permissões para exibição */
  const PERMISSION_LABELS: Record<keyof Omit<UserPermissions, 'userId'>, string> = {
    gerenciar_usuarios: 'Gerenciar usuários',
    gerenciar_grupos: 'Gerenciar grupos',
    criar_projetos: 'Criar projetos',
    editar_projetos: 'Editar projetos',
    excluir_projetos: 'Excluir projetos',
    visualizar_todos_projetos: 'Visualizar todos os projetos',
    visualizar_documentos: 'Visualizar documentos',
    criar_documentos: 'Criar documento',
    editar_documentos: 'Editar documentos',
    excluir_documentos: 'Excluir documentos',
    download_documentos: 'Download de documentos',
    compartilhar_documentos: 'Compartilhar documentos',
    criar_templates: 'Criar modelos de documento',
    editar_templates: 'Editar modelos de documento',
    excluir_templates: 'Excluir modelos de documento',
    assinar_documentos: 'Assinar documentos',
    solicitar_assinatura: 'Solicitar assinatura',
    alimentar_ia: 'Alimentar IA',
    gerenciar_ia: 'Gerenciar IA',
    acesso_total: 'Acesso total',
  };

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
      // Validação da senha
      if (!newUserPassword) {
        alert('A senha é obrigatória');
        return;
      }
      if (newUserPassword.length < 6) {
        alert('A senha deve ter pelo menos 6 caracteres');
        return;
      }
      await apiService.register(newUserEmail, newUserPassword, newUserName, newUserRole);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('operational');
      setDialogOpen(false);
      loadUsers();
      alert('Usuário criado com sucesso! Ele terá que alterar a senha no primeiro login.');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      alert(msg || 'Erro ao criar usuário');
    }
  };

  const handleEditUserClick = (user: User) => {
    setEditingUser(user);
    setEditedUserName(user.name);
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
        email: editingUser.email, // E-mail não pode ser alterado
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

  const handleResetPasswordClick = (user: User) => {
    setResetPasswordUser(user);
    setNewPassword('');
    setNewPasswordConfirm('');
    setResetPasswordDialogOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;

    // Validação da senha
    if (!newPassword) {
      alert('A nova senha é obrigatória');
      return;
    }
    if (newPassword.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      alert('As senhas não coincidem');
      return;
    }

    setIsResettingPassword(true);
    try {
      // Atualizar senha e marcar como forcePasswordChange
      await apiService.updateUserPassword(resetPasswordUser.id, newPassword, true);
      setResetPasswordDialogOpen(false);
      setResetPasswordUser(null);
      loadUsers();
      alert('Senha resetada com sucesso! O usuário será obrigado a alterar na próxima login.');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handlePermissionsClick = async (user: User) => {
    setPermissionsUser(user);
    setPermissionsDialogOpen(true);
    setLoadingPerms(true);
    try {
      const perms = await permissionsService.getUserPermissions(user);
      setLocalPerms({
        gerenciar_usuarios: perms.gerenciar_usuarios,
        gerenciar_grupos: perms.gerenciar_grupos,
        criar_projetos: perms.criar_projetos,
        editar_projetos: perms.editar_projetos,
        excluir_projetos: perms.excluir_projetos,
        visualizar_todos_projetos: perms.visualizar_todos_projetos,
        visualizar_documentos: perms.visualizar_documentos,
        criar_documentos: perms.criar_documentos,
        editar_documentos: perms.editar_documentos,
        excluir_documentos: perms.excluir_documentos,
        download_documentos: perms.download_documentos,
        compartilhar_documentos: perms.compartilhar_documentos,
        criar_templates: perms.criar_templates,
        editar_templates: perms.editar_templates,
        excluir_templates: perms.excluir_templates,
        assinar_documentos: perms.assinar_documentos,
        solicitar_assinatura: perms.solicitar_assinatura,
        alimentar_ia: perms.alimentar_ia,
        gerenciar_ia: perms.gerenciar_ia,
        acesso_total: perms.acesso_total,
      });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoadingPerms(false);
    }
  };

  const handleSavePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissionsUser) return;
    setSavingPerms(true);
    try {
      await apiService.updateUserPermissions(permissionsUser.id, localPerms);
      setPermissionsDialogOpen(false);
      setPermissionsUser(null);
      alert('Permissões salvas com sucesso! O usuário pode recarregar a página para que as alterações tenham efeito.');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingPerms(false);
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getRoleLabel = (role: User['role']) => {
    const labels: Record<string, string> = {
      'admin': 'Administrador',
      'director': 'Diretor',
      'manager': 'Gerente',
      'technical_responsible': 'Responsável Técnico',
      'operational': 'Operacional',
      'external': 'Usuário Externo',
      'user': 'Usuário'
    };
    return labels[role] || role;
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (name[0] || '?').toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Gerenciamento de Usuários</h2>
        {perms.canManageUsers() && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#1e3a5f] hover:bg-[#2d4a73] text-white shadow-sm rounded-xl px-6">
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
                  <Label htmlFor="user-password">Senha Inicial *</Label>
                  <Input
                    id="user-password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    O usuário será obrigado a alterar esta senha no primeiro login.
                  </p>
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
                      <SelectItem value="external">Usuário Externo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={!newUserName || !newUserEmail || !newUserPassword || newUserPassword.length < 6}>
                    Criar Usuário
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-8 animate-pulse">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-4 h-14">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
                <div className="h-6 bg-gray-200 rounded-full w-24" />
              </div>
            ))}
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-12 text-center">
          <h3 className="text-lg font-medium text-gray-800 mb-2">Nenhum usuário encontrado</h3>
          {perms.canManageUsers() && (
            <>
              <p className="text-sm text-gray-500 mb-4">Comece adicionando seu primeiro usuário.</p>
              <Button onClick={() => setDialogOpen(true)} className="bg-[#1e3a5f] hover:bg-[#2d4a73] text-white rounded-xl">
                <Plus className="mr-2 h-4 w-4" /> Adicionar primeiro usuário
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuário</th>
                <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Perfil</th>
                <th className="text-right py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((userItem) => (
                <tr key={userItem.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600 shrink-0">
                        {getInitials(userItem.name)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{userItem.name}</p>
                        <p className="text-sm text-gray-500">{userItem.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <Badge variant="secondary" className="rounded-full px-3 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 border-0">
                      {getRoleLabel(userItem.role).toUpperCase()}
                    </Badge>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {perms.canManageUsers() && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePermissionsClick(userItem)}
                          title="Gerenciar permissões"
                          className="rounded-lg bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700"
                        >
                          <Settings className="h-4 w-4 mr-1.5" />
                          Permissões
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResetPasswordClick(userItem)}
                        className="rounded-lg bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700"
                      >
                        <KeyRound className="h-4 w-4 mr-1.5" />
                        Resetar Senha
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditUserClick(userItem)}
                        className="rounded-lg bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700"
                      >
                        <Pencil className="h-4 w-4 mr-1.5" />
                        Editar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="border-t border-gray-100 px-6 py-4 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => { e.preventDefault(); handlePageChange(Math.max(1, currentPage - 1)); }}
                      className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => { e.preventDefault(); handlePageChange(page); }}
                        isActive={page === currentPage}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => { e.preventDefault(); handlePageChange(Math.min(totalPages, currentPage + 1)); }}
                      className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}

      {/* Dialog para Resetar Senha */}
      {resetPasswordUser && (
        <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
          <DialogContent>
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
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isResettingPassword || !newPassword || !newPasswordConfirm || newPassword.length < 6}>
                  {isResettingPassword ? 'Salvando...' : 'Resetar Senha'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de Gerenciamento de Permissões */}
      {permissionsUser && (
        <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gerenciar Permissões</DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">{permissionsUser.name}</span>
                <br />
                <span className="text-muted-foreground">{permissionsUser.email}</span>
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSavePermissions} className="space-y-4 py-4">
              {loadingPerms ? (
                <div className="py-8 text-center text-muted-foreground">Carregando permissões...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.keys(PERMISSION_LABELS) as (keyof Omit<UserPermissions, 'userId'>)[]).map(key => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`perm-${key}`}
                        checked={localPerms[key] ?? false}
                        onCheckedChange={(checked) =>
                          setLocalPerms(prev => ({ ...prev, [key]: checked === true }))
                        }
                      />
                      <Label
                        htmlFor={`perm-${key}`}
                        className="text-sm font-normal cursor-pointer leading-tight"
                      >
                        {PERMISSION_LABELS[key]}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                O usuário precisará sair e entrar novamente no sistema para que as alterações tenham efeito.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setPermissionsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={savingPerms || loadingPerms}>
                  {savingPerms ? 'Salvando...' : 'Salvar Permissões'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
                <Label htmlFor="edit-user-email">E-mail</Label>
                <Input
                  id="edit-user-email"
                  type="email"
                  value={editingUser.email}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-role">Papel *</Label>
                {editingUser.role === 'external' ? (
                  <p className="text-sm text-muted-foreground py-2 px-3 bg-muted rounded-md">
                    {getRoleLabel(editingUser.role)} — o papel não pode ser modificado
                  </p>
                ) : (
                  <Select key={editingUser.id} value={editedUserRole} onValueChange={(value: User['role']) => setEditedUserRole(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um papel">
                        {getRoleLabel(editedUserRole)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="director">Diretor</SelectItem>
                      <SelectItem value="manager">Gerente</SelectItem>
                      <SelectItem value="technical_responsible">Responsável Técnico</SelectItem>
                      <SelectItem value="operational">Operacional</SelectItem>
                    </SelectContent>
                  </Select>
                )}
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
