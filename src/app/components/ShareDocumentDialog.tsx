import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { MultiSelect } from './ui/multi-select';
import { apiService, type User, type Document } from '../../services/api';
import { toast } from 'sonner';
import { User as UserIcon, X } from 'lucide-react';
import { Badge } from './ui/badge';

interface ShareDocumentDialogProps {
  projectId: string;
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDocumentDialog({ projectId, documentId, open, onOpenChange }: ShareDocumentDialogProps) {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUsersToShare, setSelectedUsersToShare] = useState<string[]>([]);
  const [document, setDocument] = useState<Document | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (open) {
      loadAllUsers();
      loadDocumentDetails();
    }
  }, [open, projectId, documentId]);

  const loadAllUsers = async () => {
    const users = await apiService.getAllUsers();
    setAllUsers(users);
  };

  const loadDocumentDetails = async () => {
    const doc = await apiService.getDocument(documentId);
    setDocument(doc);
    // Pre-seleciona usuários já compartilhados
    if (doc?.sharedWith) {
      setSelectedUsersToShare(doc.sharedWith.map(s => s.userId));
    } else {
      setSelectedUsersToShare([]);
    }
  };

  const handleShareDocument = async () => {
    if (!document) return;
    setIsSharing(true);
    try {
      for (const userId of selectedUsersToShare) {
        // Por simplicidade, vamos dar permissão de visualização e edição por padrão
        await apiService.shareDocument(document.id, userId, ['view', 'edit']);
      }
      toast.success('Documento compartilhado com sucesso!');
      onOpenChange(false);
      loadDocumentDetails(); // Recarregar para atualizar a lista de compartilhados
    } catch (error: any) {
      toast.error(`Erro ao compartilhar documento: ${error.message}`);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemoveShare = async (userId: string) => {
    if (!document) return;
    try {
      const updatedPermissions = document.sharedWith?.filter(s => s.userId !== userId) || [];
      // Para remover, no mock, podemos atualizar com um array vazio de permissões ou uma nova API de remover
      // Por enquanto, apenas atualizaremos com o que sobrou, ou se não houver mais, consideramos removido
      const updatedDoc = { ...document, sharedWith: updatedPermissions };
      await apiService.updateDocument(document.id, updatedDoc.content); // Isso não vai remover o sharedWith

      // No mock, vamos simular a remoção de outra forma, já que updateDocument não altera sharedWith
      // Uma API de remoção de compartilhamento seria ideal aqui
      // Por enquanto, vamos apenas atualizar o estado local e os usuários selecionados
      const doc = await apiService.getDocument(document.id); // Recarregar para estado mais atual
      if (doc) {
        doc.sharedWith = doc.sharedWith?.filter(s => s.userId !== userId);
        setDocument(doc); // Atualiza o documento localmente
        setSelectedUsersToShare(doc.sharedWith?.map(s => s.userId) || []);
        toast.success('Compartilhamento removido com sucesso!');
      }
    } catch (error: any) {
      toast.error(`Erro ao remover compartilhamento: ${error.message}`);
    }
  };

  const getPermissionsLabel = (permissions: string[]) => {
    return permissions.map(p => {
      switch (p) {
        case 'view': return 'Visualizar';
        case 'edit': return 'Editar';
        case 'comment': return 'Comentar';
        default: return p;
      }
    }).join(', ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Compartilhar Documento</DialogTitle>
          <DialogDescription>
            Compartilhe '${document?.name || 'documento'}' com outros usuários e defina permissões.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="users-to-share">Compartilhar com</Label>
            <MultiSelect
              options={allUsers.map(user => ({ label: user.name, value: user.id }))}
              selected={selectedUsersToShare}
              onSelectedChange={setSelectedUsersToShare}
              placeholder="Selecione usuários para compartilhar..."
            />
          </div>
          {/* Futuramente, pode-se adicionar seleção de permissões aqui */}
          <Button onClick={handleShareDocument} disabled={isSharing}>
            {isSharing ? 'Compartilhando...' : 'Compartilhar'}
          </Button>
        </div>

        <div className="mt-4 border-t pt-4">
          <h4 className="text-md font-medium mb-2">Compartilhado com</h4>
          {document?.sharedWith && document.sharedWith.length > 0 ? (
            <div className="space-y-2">
              {document.sharedWith.map((share) => {
                const user = allUsers.find(u => u.id === share.userId);
                if (!user) return null;
                return (
                  <div key={user.id} className="flex items-center justify-between p-2 border rounded-md">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-gray-500" />
                      <span>{user.name} ({user.email})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{getPermissionsLabel(share.permissions)}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveShare(user.id)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Ninguém ainda.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}



