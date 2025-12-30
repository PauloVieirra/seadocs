import { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { type DocumentModel, type Group } from '../../services/api';

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateDocument: (data: {
    name: string;
    templateId: string;
    securityLevel: 'public' | 'restricted' | 'confidential' | 'secret';
  }) => void;
  documentModels: DocumentModel[];
}

export function CreateDocumentDialog({
  open,
  onOpenChange,
  onCreateDocument,
  documentModels,
}: CreateDocumentDialogProps) {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [securityLevel, setSecurityLevel] = useState<'public' | 'restricted' | 'confidential' | 'secret'>('confidential');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Nome do documento é obrigatório');
      return;
    }

    if (!templateId) {
      alert('Modelo de documento é obrigatório');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateDocument({
        name: name.trim(),
        templateId,
        securityLevel
      });

      // Limpar formulário
      setName('');
      setTemplateId('');
      setSecurityLevel('confidential');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen === false) {
      // Limpar formulário ao fechar
      setName('');
      setTemplateId('');
      setSecurityLevel('confidential');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Novo Documento</DialogTitle>
          <DialogDescription>
            Preencha os detalhes do novo documento a ser criado neste projeto
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Nome do Documento */}
          <div className="space-y-2">
            <Label htmlFor="doc-name">Nome do Documento *</Label>
            <Input
              id="doc-name"
              placeholder="Ex: Especificação de Requisitos v1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Modelo/Template */}
          <div className="space-y-2">
            <Label htmlFor="template-select">Modelo de Documento *</Label>
            <Select value={templateId} onValueChange={setTemplateId} disabled={isSubmitting}>
              <SelectTrigger id="template-select">
                <SelectValue placeholder="Selecione um modelo..." />
              </SelectTrigger>
              <SelectContent>
                {documentModels.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nível de Sigilo */}
          <div className="space-y-2">
            <Label htmlFor="security-select">Nível de Sigilo *</Label>
            <Select value={securityLevel} onValueChange={(value) => setSecurityLevel(value as any)} disabled={isSubmitting}>
              <SelectTrigger id="security-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Público</SelectItem>
                <SelectItem value="restricted">Restrito</SelectItem>
                <SelectItem value="confidential">Confidencial</SelectItem>
                <SelectItem value="secret">Secreto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Criando...' : 'Criar Documento'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
