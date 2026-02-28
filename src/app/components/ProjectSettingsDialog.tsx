import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { apiService, type Project, type User, type Group } from '../../services/api';
import { DataSourcesPanel } from './DataSourcesPanel';
import { ProjectDocumentsPanel } from './ProjectDocumentsPanel'; 
import { ProjectModelsPanel } from './ProjectModelsPanel';
import { AuditPanel } from './AuditPanel';
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
                <TabsTrigger value="participants" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Participantes</TabsTrigger>
                <TabsTrigger value="models" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Modelos (Padrão IA)</TabsTrigger>
                <TabsTrigger value="groups" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Grupos</TabsTrigger>
                <TabsTrigger value="documents" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Documentos do projeto</TabsTrigger>
                <TabsTrigger value="datasources" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Fonte de dados</TabsTrigger>
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
                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">Responsáveis Técnicos</h4>
                        <p className="text-xs text-gray-600">Gerencie quem são os responsáveis pela execução técnica deste projeto.</p>
                      </div>

                      <div className="space-y-4">
                        <Label>Adicionar/Remover Responsáveis</Label>
                        <UserSearchSelect
                          users={allUsers}
                          selectedIds={editedResponsibleIds}
                          onSelectedChange={setEditedResponsibleIds}
                          placeholder="Busque por nome ou email..."
                          maxResults={8}
                        />
                      </div>

                      <div className="space-y-3 pt-2">
                        <Label className="text-xs text-gray-500 uppercase font-semibold">Lista de Acesso</Label>
                        <div className="grid grid-cols-1 gap-2">
                          {editedResponsibleIds.length > 0 ? (
                            editedResponsibleIds.map(id => {
                              const user = allUsers.find(u => u.id === id);
                              if (!user) return null;
                              return (
                                <div key={id} className="flex items-center justify-between p-2 border rounded-md bg-white">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                      <AvatarFallback className="text-[10px] bg-slate-100">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="text-sm font-medium">{user.name}</p>
                                      <p className="text-[10px] text-gray-500">{user.email}</p>
                                    </div>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                                    onClick={() => setEditedResponsibleIds(prev => prev.filter(uid => uid !== id))}
                                  >
                                    Remover
                                  </Button>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-gray-500 italic py-2 text-center border border-dashed rounded-md">Nenhum responsável técnico atribuído.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="models" className="m-0 space-y-4">
                    <ProjectModelsPanel projectId={projectId} />
                  </TabsContent>

                  <TabsContent value="groups" className="m-0 space-y-4">
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                        <h4 className="text-sm font-semibold text-blue-900 mb-1">Associação de Grupos</h4>
                        <p className="text-xs text-blue-700">Vincule este projeto a grupos específicos. Membros destes grupos terão acesso automático ao projeto.</p>
                      </div>

                      <div className="space-y-4">
                        <Label>Selecionar Grupos</Label>
                        <div className="grid grid-cols-1 gap-2">
                          {allGroups.map(group => (
                            <div key={group.id} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-gray-50">
                              <input
                                type="checkbox"
                                id={`group-${group.id}`}
                                checked={editedGroupIds.includes(group.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditedGroupIds(prev => [...prev, group.id]);
                                  } else {
                                    setEditedGroupIds(prev => prev.filter(id => id !== group.id));
                                  }
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <Label htmlFor={`group-${group.id}`} className="text-sm font-medium cursor-pointer flex-1">
                                {group.name}
                              </Label>
                              {group.description && <span className="text-xs text-gray-500">{group.description}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="documents" className="m-0">
                    <ProjectDocumentsPanel projectId={projectId} />
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



