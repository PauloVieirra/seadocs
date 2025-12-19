import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { MultiSelect } from './ui/multi-select';
import { apiService, type Project, type User, type Group } from '../../services/api';
import { DataSourcesPanel } from './DataSourcesPanel';
import { AuditPanel } from './AuditPanel';
import { GroupManagementPanel } from './GroupManagementPanel';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Users, Save, Trash2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { UserSearchSelect } from './UserSearchSelect';

interface ProjectSettingsDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateSuccess?: () => void;
}

export function ProjectSettingsDialog({
  projectId,
  open,
  onOpenChange,
  onUpdateSuccess
}: ProjectSettingsDialogProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Estados do formulário
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedResponsibleIds, setEditedResponsibleIds] = useState<string[]>([]);
  const [editedGroupIds, setEditedGroupIds] = useState<string[]>([]);

  // Dados auxiliares
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);

  useEffect(() => {
    if (open && projectId) {
      loadProjectData();
      setCurrentUser(apiService.getCurrentUser());
    }
  }, [open, projectId]);

  const loadProjectData = async () => {
    setLoading(true);
    try {
      const [projectData, users, groups] = await Promise.all([
        apiService.getProject(projectId),
        apiService.getAllUsers(),
        apiService.getGroups()
      ]);

      if (projectData) {
        setProject(projectData);
        setEditedName(projectData.name);
        setEditedDescription(projectData.description || '');
        setEditedResponsibleIds(projectData.responsibleIds || []);
        setEditedGroupIds(projectData.groupIds || []);
      }
      setAllUsers(users);
      setAllGroups(groups);
    } catch (error) {
      console.error('Erro ao carregar dados do projeto:', error);
      toast.error('Erro ao carregar dados do projeto');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    setSaving(true);
    try {
      const updatedProject = {
        ...project,
        name: editedName,
        description: editedDescription,
        responsibleIds: editedResponsibleIds,
        groupIds: editedGroupIds,
      };
      await apiService.updateProject(updatedProject);
      toast.success('Projeto atualizado com sucesso!');
      if (onUpdateSuccess) onUpdateSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar projeto');
    } finally {
      setSaving(false);
    }
  };

  if (!project && !loading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 border-b shrink-0">
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            Configurações Gerais: {project?.name}
          </DialogTitle>
          <DialogDescription>
            Gerencie dados, participantes, grupos e fontes de informação deste projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex">
          <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 border-b bg-gray-50/50 shrink-0">
              <TabsList className="w-full justify-start h-12 bg-transparent gap-6">
                <TabsTrigger value="details" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Detalhes</TabsTrigger>
                <TabsTrigger value="participants" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Pessoas</TabsTrigger>
                <TabsTrigger value="groups" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Grupos</TabsTrigger>
                <TabsTrigger value="datasources" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Fontes de Dados</TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Auditoria</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  <TabsContent value="details" className="m-0 space-y-4">
                    <form onSubmit={handleUpdateProject} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-project-name">Nome do Projeto *</Label>
                        <Input
                          id="edit-project-name"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-project-description">Descrição (opcional)</Label>
                        <Textarea
                          id="edit-project-description"
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
                          rows={4}
                          placeholder="Objetivos e escopo do projeto..."
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={saving}>
                          {saving ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="participants" className="m-0 space-y-4">
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                        <h4 className="text-sm font-semibold text-blue-900 mb-1">Responsáveis Técnicos</h4>
                        <p className="text-xs text-blue-700">Defina quem tem permissão de edição e supervisão técnica.</p>
                      </div>
                      
                      <div className="space-y-4">
                        <Label>Gerenciar Responsáveis</Label>
                        <UserSearchSelect
                          users={allUsers}
                          selectedIds={editedResponsibleIds}
                          onSelectedChange={setEditedResponsibleIds}
                          placeholder="Adicionar novos responsáveis..."
                        />
                      </div>

                      <div className="mt-6 border-t pt-4">
                        <h4 className="text-sm font-medium mb-4">Lista de Participantes Atuais</h4>
                        <div className="grid grid-cols-1 gap-2">
                          {editedResponsibleIds.map(id => {
                            const user = allUsers.find(u => u.id === id);
                            if (!user) return null;
                            return (
                              <div key={id} className="flex items-center justify-between p-3 bg-white border rounded-lg hover:border-blue-200 transition-colors">
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-8 h-8">
                                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                                      {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-sm font-medium">{user.name}</p>
                                    <p className="text-xs text-gray-500">{user.email}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px]">Responsável</Badge>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0 text-red-500"
                                    onClick={() => setEditedResponsibleIds(prev => prev.filter(rid => rid !== id))}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="groups" className="m-0 space-y-4">
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-100 p-4 rounded-lg">
                        <h4 className="text-sm font-semibold text-green-900 mb-1">Alocação de Grupos</h4>
                        <p className="text-xs text-green-700">Relacione este projeto a grupos de trabalho específicos.</p>
                      </div>

                      <div className="space-y-4">
                        <Label>Vincular Grupos</Label>
                        <MultiSelect
                          options={allGroups.map(group => ({ label: group.name, value: group.id }))}
                          selected={editedGroupIds}
                          onSelectedChange={setEditedGroupIds}
                          placeholder="Selecione os grupos..."
                        />
                      </div>

                      <div className="mt-6 border-t pt-4">
                        <h4 className="text-sm font-medium mb-4">Grupos Relacionados</h4>
                        <div className="flex flex-wrap gap-2">
                          {editedGroupIds.map(id => {
                            const group = allGroups.find(g => g.id === id);
                            if (!group) return null;
                            return (
                              <Badge key={id} variant="secondary" className="px-3 py-1 flex items-center gap-2">
                                {group.name}
                                <button 
                                  onClick={() => setEditedGroupIds(prev => prev.filter(gid => gid !== id))}
                                  className="hover:text-red-500"
                                >
                                  ×
                                </button>
                              </Badge>
                            );
                          })}
                          {editedGroupIds.length === 0 && (
                            <p className="text-sm text-gray-500">Nenhum grupo vinculado.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="datasources" className="m-0">
                    <DataSourcesPanel projectId={projectId} />
                  </TabsContent>

                  <TabsContent value="history" className="m-0">
                    <AuditPanel projectId={projectId} />
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </div>
        
        <DialogFooter className="p-6 border-t bg-gray-50 shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button 
            onClick={handleUpdateProject} 
            disabled={saving || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? 'Salvando...' : 'Aplicar Todas as Configurações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



