import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { MultiSelect } from './ui/multi-select';
import { UserSearchSelect } from './UserSearchSelect'; // Importar novo componente
import { ProjectSearchSelect } from './ProjectSearchSelect'; // Importar componente de busca de projetos
import { Group, User, Project, apiService } from '../../services/api';
import { toast } from 'sonner';

interface GroupEditDialogProps {
  group: Group | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateSuccess: () => void; // Callback para recarregar grupos após sucesso
  allUsers: User[];
  allGroups: Group[];
  allProjects?: Project[];
}

export function GroupEditDialog({
  group,
  open,
  onOpenChange,
  onUpdateSuccess,
  allUsers,
  allGroups,
  allProjects = [],
}: GroupEditDialogProps) {
  const [editedName, setEditedName] = useState(group?.name || '');
  const [editedDescription, setEditedDescription] = useState(group?.description || '');
  const [editedMemberIds, setEditedMemberIds] = useState<string[]>(group?.memberIds || []);
  const [editedResponsibleId, setEditedResponsibleId] = useState<string | undefined>(group?.responsibleId);
  const [editedParentId, setEditedParentId] = useState<string | undefined>(group?.parentId);
  const [editedProjectIds, setEditedProjectIds] = useState<string[]>(group?.projectIds || []);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (group) {
      setEditedName(group.name);
      setEditedDescription(group.description || '');
      setEditedMemberIds(group.memberIds || []);
      setEditedResponsibleId(group.responsibleId);
      setEditedParentId(group.parentId);
      setEditedProjectIds(group.projectIds || []);
    }
  }, [group]);

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;

    setLoading(true);
    try {
      const updatedGroup: Group = {
        ...group,
        name: editedName,
        description: editedDescription,
        memberIds: editedMemberIds,
        responsibleId: editedResponsibleId,
        parentId: editedParentId,
        projectIds: editedProjectIds,
      };
      await apiService.updateGroup(updatedGroup);
      toast.success('Grupo atualizado com sucesso!');
      onUpdateSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Erro ao atualizar grupo: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group) return;
    setIsDeleting(true);
    try {
      const result = await apiService.deleteGroup(group.id);
      if (result) {
        toast.success('Grupo deletado com sucesso!');
        onUpdateSuccess();
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error(`Erro ao deletar grupo: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtrar grupos pai para não incluir o próprio grupo que está sendo editado ou seus subgrupos
  const availableParentGroups = allGroups.filter(
    (g) => g.id !== group?.id && !isDescendant(group?.id, g.id, allGroups)
  );

  // Função auxiliar para verificar se um grupo é descendente de outro
  // Isso evita loops na hierarquia de grupos
  function isDescendant(potentialParentId: string | undefined, childId: string, allGroups: Group[]): boolean {
    if (!potentialParentId) return false;
    let currentGroup = allGroups.find(g => g.id === childId);
    while (currentGroup) {
      if (currentGroup.parentId === potentialParentId) {
        return true;
      }
      currentGroup = allGroups.find(g => g.id === currentGroup?.parentId);
    }
    return false;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Grupo</DialogTitle>
          <DialogDescription>
            Modifique as informações do grupo {group?.name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpdateGroup} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-group-name">Nome do Grupo *</Label>
            <Input
              id="edit-group-name"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-group-description">Descrição (opcional)</Label>
            <Textarea
              id="edit-group-description"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="Descreva o objetivo do grupo..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-group-members">Membros</Label>
            <UserSearchSelect
              users={allUsers}
              selectedIds={editedMemberIds}
              onSelectedChange={setEditedMemberIds}
              placeholder="Busque por nome ou email..."
              maxResults={8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-group-responsible">Responsável pelo Grupo (opcional)</Label>
            <UserSearchSelect
              users={allUsers}
              selectedIds={editedResponsibleId ? [editedResponsibleId] : []}
              onSelectedChange={(ids) => setEditedResponsibleId(ids[0])}
              placeholder="Busque por nome ou email..."
              maxResults={8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-group-parent">Grupo Pai (opcional)</Label>
            <MultiSelect
              options={availableParentGroups.map(g => ({ label: g.name, value: g.id }))}
              selected={editedParentId ? [editedParentId] : []}
              onSelectedChange={(ids) => setEditedParentId(ids[0])}
              placeholder="Selecione um grupo pai..."
              maxSelected={1}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-group-projects">Projetos Atribuídos (opcional)</Label>
            <ProjectSearchSelect
              projects={allProjects}
              selectedIds={editedProjectIds}
              onSelectedChange={setEditedProjectIds}
              placeholder="Busque por nome do projeto..."
              maxResults={8}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </form>
        <div className="mt-6 pt-4 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={isDeleting}>
                Deletar Grupo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso excluirá permanentemente o grupo "{group?.name}".
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteGroup} disabled={isDeleting}>
                  {isDeleting ? 'Deletando...' : 'Deletar'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}



