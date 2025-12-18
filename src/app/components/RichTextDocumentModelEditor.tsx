import React, { useMemo, useRef, useState, useEffect } from 'react';
import ReactQuill, { Quill } from 'react-quill'; // ES6
import 'react-quill/dist/quill.snow.css'; // ES6
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DocumentModel } from '../../services/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';

let metadataFieldBlotRegistered = false;

function ensureMetadataFieldBlotRegistered() {
  if (metadataFieldBlotRegistered) return;

  // Quill typings can be a bit loose around custom blots; keep this localized.
  const QuillAny: any = Quill;
  const BlockEmbed = QuillAny.import('blots/block/embed');

  class MetadataFieldBlot extends BlockEmbed {
    static blotName = 'metadataField';
    static tagName = 'div';
    static className = 'sgid-metadata-field';

    static create(value: { id?: string; title?: string }) {
      const node: HTMLElement = super.create();
      const id = value?.id || `field-${Date.now()}`;
      const title = value?.title || 'Campo';

      node.setAttribute('contenteditable', 'false');
      node.setAttribute('data-field-id', id);
      node.setAttribute('data-field-title', title);
      node.setAttribute('draggable', 'true');
      node.setAttribute('role', 'group');
      node.setAttribute('aria-label', `Campo de metadado: ${title}`);

      // Estrutura visual: "frame" + um pseudo textarea dentro (placeholder).
      const header = document.createElement('div');
      header.className = 'sgid-metadata-field__header';

      const titleEl = document.createElement('div');
      titleEl.className = 'sgid-metadata-field__title';
      titleEl.innerText = title;
      header.appendChild(titleEl);

      const body = document.createElement('div');
      body.className = 'sgid-metadata-field__textarea';
      body.innerText = 'Digite aqui (campo editável no documento)...';

      node.appendChild(header);
      node.appendChild(body);

      return node;
    }

    static value(node: HTMLElement) {
      return {
        id: node.getAttribute('data-field-id') || '',
        title: node.getAttribute('data-field-title') || '',
      };
    }
  }

  QuillAny.register(MetadataFieldBlot);
  metadataFieldBlotRegistered = true;
}

function slugify(input: string) {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

interface RichTextDocumentModelEditorProps {
  onSave: (name: string, type: string, templateContent: string) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  initialData?: DocumentModel; // Para edição de modelo existente
}

export function RichTextDocumentModelEditor({
  onSave,
  onCancel,
  isLoading,
  initialData,
}: RichTextDocumentModelEditorProps) {
  const quillRef = useRef<ReactQuill | null>(null);
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.type || '');
  const [editorData, setEditorData] = useState(initialData?.templateContent || '');

  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [fieldTitle, setFieldTitle] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [fieldHelp, setFieldHelp] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setType(initialData.type);
      setEditorData(initialData.templateContent);
    }
  }, [initialData]);

  useEffect(() => {
    ensureMetadataFieldBlotRegistered();
  }, []);

  const toolbarId = useMemo(() => `model-toolbar-${Math.random().toString(16).slice(2)}`, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !type.trim() || !editorData.trim()) {
      toast.error('Por favor, preencha todos os campos obrigatórios e o conteúdo do template.');
      return;
    }
    await onSave(name, type, editorData);
  };

  const openFieldDialog = () => {
    setFieldTitle('');
    setFieldId('');
    setFieldHelp('');
    setFieldDialogOpen(true);
  };

  const generateUniqueId = (baseId: string) => {
    const normalizedBase = baseId || `campo-${Date.now()}`;
    let candidate = normalizedBase;
    let i = 2;
    while (new RegExp(`data-field-id="${candidate.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}"`, 'i').test(editorData)) {
      candidate = `${normalizedBase}-${i}`;
      i += 1;
    }
    return candidate;
  };

  const insertMetadataField = () => {
    if (isLoading) return;
    if (!fieldTitle.trim()) {
      toast.error('Informe o título do campo (ex: Introdução).');
      return;
    }

    const editor = quillRef.current?.getEditor?.();
    if (!editor) {
      toast.error('Editor não disponível.');
      return;
    }

    const baseId = fieldId.trim() ? slugify(fieldId.trim()) : slugify(fieldTitle.trim());
    const uniqueId = generateUniqueId(baseId);

    const range = editor.getSelection(true);
    let insertAt = range ? range.index : editor.getLength();

    // Garante que o campo entra como um "bloco" bem separado, permitindo inserir um novo título em seguida.
    // Se não estivermos no início de linha, insere uma quebra antes.
    if (insertAt > 0) {
      const prevChar = editor.getText(insertAt - 1, 1);
      if (prevChar && prevChar !== '\n') {
        editor.insertText(insertAt, '\n', 'user');
        insertAt += 1;
      }
    }

    editor.insertEmbed(insertAt, 'metadataField', { id: uniqueId, title: fieldTitle.trim() }, 'user');
    // Quebra depois do bloco para o próximo título/linha
    editor.insertText(insertAt + 1, '\n', 'user');
    editor.setSelection(insertAt + 2, 0, 'user');

    setFieldDialogOpen(false);
    toast.success(`Campo "${fieldTitle.trim()}" adicionado ao modelo.`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="model-name">Nome do Modelo *</Label>
        <Input
          id="model-name"
          placeholder="Ex: Contrato de Serviço"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="model-type">Tipo de Documento *</Label>
        <Input
          id="model-type"
          placeholder="Ex: Jurídico, Técnico, Financeiro"
          value={type}
          onChange={(e) => setType(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label>Conteúdo do Modelo *</Label>
        {/* Toolbar customizada (inclui o botão de Campo/metadado) */}
        <div id={toolbarId} className="border border-input rounded-t-md bg-white">
          <div className="ql-toolbar ql-snow border-0">
            <span className="ql-formats">
              <select className="ql-header" defaultValue="">
                <option value="1" />
                <option value="2" />
                <option value="3" />
                <option value="4" />
                <option value="5" />
                <option value="6" />
                <option value="" />
              </select>
            </span>
            <span className="ql-formats">
              <button type="button" className="ql-bold" />
              <button type="button" className="ql-italic" />
              <button type="button" className="ql-underline" />
              <button type="button" className="ql-strike" />
              <button type="button" className="ql-blockquote" />
            </span>
            <span className="ql-formats">
              <button type="button" className="ql-list" value="ordered" />
              <button type="button" className="ql-list" value="bullet" />
              <button type="button" className="ql-indent" value="-1" />
              <button type="button" className="ql-indent" value="+1" />
            </span>
            <span className="ql-formats">
              <button type="button" className="ql-link" />
              <button type="button" className="ql-image" />
              <button type="button" className="ql-video" />
            </span>
            <span className="ql-formats">
              <select className="ql-color" />
              <select className="ql-background" />
            </span>
            <span className="ql-formats">
              <select className="ql-align" />
            </span>
            <span className="ql-formats">
              <button type="button" className="ql-clean" />
            </span>

            <span className="ql-formats">
              <button
                type="button"
                className="sgid-toolbar-btn"
                onClick={openFieldDialog}
                disabled={isLoading}
                title="Inserir Campo (metadado) editável"
              >
                Campo
              </button>
            </span>
          </div>
        </div>
        <ReactQuill
          ref={(instance) => {
            quillRef.current = instance;
          }}
          theme="snow"
          value={editorData}
          onChange={setEditorData}
          readOnly={isLoading}
          modules={{
            toolbar: {
              container: `#${toolbarId} .ql-toolbar`,
            },
          }}
          formats={[
            'header',
            'bold', 'italic', 'underline', 'strike', 'blockquote',
            'list', 'bullet', 'indent',
            'link', 'image', 'video',
            'color', 'background', 'align',
            'metadataField',
          ]}
          placeholder="Comece a criar seu modelo de documento..."
        />
        <p className="text-xs text-gray-600">
          Dica: use os títulos (H1/H2/...) e clique em <strong>Campo</strong> para inserir um espaço editável logo abaixo.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : 'Salvar Modelo'}
        </Button>
      </div>

      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Inserir Campo (metadado)</DialogTitle>
            <DialogDescription>
              Este campo vira uma seção editável quando o modelo for usado em um projeto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="field-title">Título do campo *</Label>
              <Input
                id="field-title"
                value={fieldTitle}
                onChange={(e) => setFieldTitle(e.target.value)}
                placeholder='Ex: "Introdução"'
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-id">ID do campo (opcional)</Label>
              <Input
                id="field-id"
                value={fieldId}
                onChange={(e) => setFieldId(e.target.value)}
                placeholder='Ex: "intro" (se vazio, será gerado a partir do título)'
                disabled={isLoading}
              />
              <p className="text-xs text-gray-600">
                O ID é usado para a IA e para identificar a seção (ex.: <code>intro</code>, <code>overview</code>).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-help">Instruções/observações (opcional)</Label>
              <Textarea
                id="field-help"
                value={fieldHelp}
                onChange={(e) => setFieldHelp(e.target.value)}
                placeholder="Opcional: descreva o que o usuário/IA deve escrever aqui..."
                disabled={isLoading}
                rows={3}
              />
              <p className="text-xs text-gray-600">
                (Por enquanto isso não é usado no documento final; fica pronto para evoluirmos depois.)
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFieldDialogOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="button" onClick={insertMetadataField} disabled={isLoading}>
                Inserir campo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}

