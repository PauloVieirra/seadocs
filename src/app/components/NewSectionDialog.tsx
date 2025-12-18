import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface NewSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string) => void;
  isSaving: boolean;
}

export function NewSectionDialog({
  open,
  onOpenChange,
  onSave,
  isSaving,
}: NewSectionDialogProps) {
  const [newSectionTitle, setNewSectionTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSectionTitle.trim()) {
      onSave(newSectionTitle);
      setNewSectionTitle(''); // Limpa o campo após salvar
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Tópico</DialogTitle>
          <DialogDescription>
            Insira o título para o novo tópico do documento.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-section-title">Título do Tópico *</Label>
            <Input
              id="new-section-title"
              placeholder="Ex: Requisitos de Segurança"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              required
            />
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Criando...' : 'Criar Tópico'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



