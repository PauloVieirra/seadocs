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
                <TabsTrigger value="models" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Modelos (Padrão IA)</TabsTrigger>
                <TabsTrigger value="association" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Associação</TabsTrigger>
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

                  <TabsContent value="models" className="m-0 space-y-4">
                    <ProjectModelsPanel projectId={projectId} />
                  </TabsContent>

                  <TabsContent value="association" className="m-0 space-y-4">
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                        <h4 className="text-sm font-semibold text-blue-900 mb-1">Grupo Associado</h4>
                        <p className="text-xs text-blue-700">Este projeto está vinculado ao seguinte grupo:</p>
                      </div>

                      <div className="space-y-4">
                        {project?.groupIds && project.groupIds.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {project.groupIds.map(id => {
                              const group = allGroups.find(g => g.id === id);
                              if (!group) return null;
                              return (
                                <Badge key={id} variant="secondary" className="px-4 py-2 text-sm">
                                  {group.name}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                            <p className="text-sm text-amber-800 font-medium">O projeto ainda não foi designado.</p>
                            <p className="text-xs text-amber-700 mt-1">
                              Apenas você (criador do projeto) pode visualizá-lo até que seja associado a um grupo.
                            </p>
                          </div>
                        )}
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



