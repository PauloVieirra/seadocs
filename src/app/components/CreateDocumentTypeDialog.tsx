import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface CreateDocumentTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (name: string) => void | Promise<void>;
}

export function CreateDocumentTypeDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateDocumentTypeDialogProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await Promise.resolve(onCreated(trimmed));
      setName('');
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) setName('');
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Tipo de Documento</DialogTitle>
          <DialogDescription>
            Cadastre um novo tipo de documento. Ex.: Especificação de Requisitos, Contrato, Relatório Técnico.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-type-name">Nome do tipo *</Label>
            <Input
              id="doc-type-name"
              placeholder="Ex: Especificação de Requisitos"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
