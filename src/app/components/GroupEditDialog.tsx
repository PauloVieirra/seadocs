import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { MultiSelect } from './ui/multi-select';
import { Group, User, apiService } from '../../services/api';
import { toast } from 'sonner';

interface GroupEditDialogProps {
  group: Group | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateSuccess: () => void; // Callback para recarregar grupos após sucesso
  allUsers: User[];
  allGroups: Group[];
}

export function GroupEditDialog({
  group,
  open,
  onOpenChange,
  onUpdateSuccess,
  allUsers,
  allGroups,
}: GroupEditDialogProps) {
  const [editedName, setEditedName] = useState(group?.name || '');
  const [editedDescription, setEditedDescription] = useState(group?.description || '');
  const [editedMemberIds, setEditedMemberIds] = useState<string[]>(group?.memberIds || []);
  const [editedResponsibleId, setEditedResponsibleId] = useState<string | undefined>(group?.responsibleId);
  const [editedParentId, setEditedParentId] = useState<string | undefined>(group?.parentId);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (group) {
      setEditedName(group.name);
      setEditedDescription(group.description || '');
      setEditedMemberIds(group.memberIds || []);
      setEditedResponsibleId(group.responsibleId);
      setEditedParentId(group.parentId);
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
      <DialogContent className="sm:max-w-[425px]">
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
            <MultiSelect
              options={allUsers.map(u => ({ label: u.name, value: u.id }))}
              selected={editedMemberIds}
              onSelectedChange={setEditedMemberIds}
              placeholder="Selecione os membros do grupo..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-group-responsible">Responsável pelo Grupo (opcional)</Label>
            <MultiSelect
              options={allUsers.map(u => ({ label: u.name, value: u.id }))}
              selected={editedResponsibleId ? [editedResponsibleId] : []}
              onSelectedChange={(ids) => setEditedResponsibleId(ids[0])}
              placeholder="Selecione o responsável pelo grupo..."
              maxSelected={1}
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
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



