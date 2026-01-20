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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Layout, Type, Save, X, PlusCircle, Database } from 'lucide-react';

let customBlotsRegistered = false;

function ensureCustomBlotsRegistered() {
  if (customBlotsRegistered) return;

  const QuillAny: any = Quill;
  const BlockEmbed = QuillAny.import('blots/block/embed');
  const Block = QuillAny.import('blots/block');

  // Blot para Metadado (Campo Editável)
  class MetadataFieldBlot extends BlockEmbed {
    static blotName = 'metadataField';
    static tagName = 'div';
    static className = 'sgid-metadata-field';

    static create(value: { id?: string; title?: string; help?: string; topicId?: string }) {
      const node: HTMLElement = super.create();
      const id = value?.id || `field-${Date.now()}`;
      const title = value?.title || 'Campo';
      const help = value?.help || '';
      const topicId = value?.topicId || '';

      node.setAttribute('contenteditable', 'false');
      node.setAttribute('data-field-id', id);
      node.setAttribute('data-field-title', title);
      node.setAttribute('data-field-help', help);
      node.setAttribute('data-topic-id', topicId);

      const header = document.createElement('div');
      header.className = 'sgid-metadata-field__header';

      const titleEl = document.createElement('div');
      titleEl.className = 'sgid-metadata-field__title';
      titleEl.innerText = title;
      header.appendChild(titleEl);

      if (topicId) {
        const topicTag = document.createElement('span');
        topicTag.className = 'text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2';
        topicTag.innerText = `Tópico: ${topicId}`;
        titleEl.appendChild(topicTag);
      }

      if (help) {
        const helpEl = document.createElement('div');
        helpEl.className = 'sgid-metadata-field__help';
        helpEl.innerText = help;
        helpEl.style.fontSize = '10px';
        helpEl.style.opacity = '0.7';
        header.appendChild(helpEl);
      }

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
        help: node.getAttribute('data-field-help') || '',
        topicId: node.getAttribute('data-topic-id') || '',
      };
    }
  }

  // Blot para Tópico (Container Pastel)
  class TopicBlot extends Block {
    static blotName = 'topic';
    static tagName = 'div';
    static className = 'sgid-topic';

    static create(value: any) {
      const node = super.create();
      if (value && typeof value === 'string') {
        node.setAttribute('data-topic-id', value);
      } else {
        node.setAttribute('data-topic-id', `topic-${Date.now()}`);
      }
      return node;
    }

    static formats(node: HTMLElement) {
      return node.getAttribute('data-topic-id');
    }

    format(name: string, value: any) {
      if (name === 'topic') {
        if (value) {
          this.domNode.setAttribute('data-topic-id', value);
        } else {
          this.domNode.removeAttribute('data-topic-id');
        }
      } else {
        super.format(name, value);
      }
    }
  }

  QuillAny.register(MetadataFieldBlot);
  QuillAny.register(TopicBlot);
  customBlotsRegistered = true;
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

  // Metadado State
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [fieldTitle, setFieldTitle] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [fieldHelp, setFieldHelp] = useState('');
  const [associatedTopic, setAssociatedTopic] = useState<string>('none');

  // Tópico State
  const [existingTopics, setExistingTopics] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setType(initialData.type);
      setEditorData(initialData.templateContent);
    }
  }, [initialData]);

  useEffect(() => {
    ensureCustomBlotsRegistered();
  }, []);

  // Extrair tópicos existentes no documento para associar metadados
  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(editorData, 'text/html');
    const topicNodes = doc.querySelectorAll('.sgid-topic');
    const topics = Array.from(topicNodes).map((node: any) => ({
      id: node.getAttribute('data-topic-id'),
      name: node.innerText.trim().substring(0, 30) || 'Tópico sem nome'
    }));
    setExistingTopics(topics);
  }, [editorData]);

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
    setAssociatedTopic('none');
    setFieldDialogOpen(true);
  };

  const insertTopic = () => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    const range = editor.getSelection(true);
    const topicId = `topic-${Date.now()}`;
    
    // Insere um bloco de tópico
    editor.insertText(range.index, '\n', 'user');
    editor.formatLine(range.index, 1, 'topic', topicId);
    editor.insertText(range.index, 'Novo Tópico', 'user');
    editor.setSelection(range.index, 11);
    
    toast.success('Tópico adicionado. Você pode editar o texto e estilo normalmente.');
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

    if (insertAt > 0) {
      const prevChar = editor.getText(insertAt - 1, 1);
      if (prevChar && prevChar !== '\n') {
        editor.insertText(insertAt, '\n', 'user');
        insertAt += 1;
      }
    }

    editor.insertEmbed(insertAt, 'metadataField', { 
      id: uniqueId, 
      title: fieldTitle.trim(),
      help: fieldHelp.trim(),
      topicId: associatedTopic !== 'none' ? associatedTopic : ''
    }, 'user');
    
    editor.insertText(insertAt + 1, '\n', 'user');
    editor.setSelection(insertAt + 2, 0, 'user');

    setFieldDialogOpen(false);
    toast.success(`Metadado "${fieldTitle.trim()}" adicionado.`);
  };

  return (
    <div className="sgid-model-editor-container h-full flex flex-col bg-white">
      {/* Header Info */}
      <div className="p-6 border-b bg-white shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1440px] mx-auto">
          <div className="space-y-2">
            <Label htmlFor="model-name" className="text-sm font-semibold text-gray-700">Nome do Modelo *</Label>
            <div className="relative">
              <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="model-name"
                className="pl-10 h-11 border-gray-200 focus:ring-blue-500 rounded-lg"
                placeholder="Ex: Contrato de Serviço"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="model-type" className="text-sm font-semibold text-gray-700">Tipo de Documento *</Label>
            <div className="relative">
              <Layout className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="model-type"
                className="pl-10 h-11 border-gray-200 focus:ring-blue-500 rounded-lg"
                placeholder="Ex: Jurídico, Técnico, Financeiro"
                value={type}
                onChange={(e) => setType(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-hidden relative bg-gray-50 flex flex-col">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-[900px] mx-auto bg-white shadow-xl rounded-xl border border-gray-100 min-h-[1000px]">
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
                  container: `#${toolbarId}`,
                },
              }}
              formats={[
                'header', 'size', 'bold', 'italic', 'underline', 'strike', 'blockquote',
                'list', 'bullet', 'indent', 'link', 'image', 'video',
                'color', 'background', 'align', 'metadataField', 'topic'
              ]}
              placeholder="Comece a criar seu modelo de documento..."
              className="h-full border-none"
            />
          </div>
        </div>

        {/* Floating Toolbar Bottom */}
        <div className="sgid-floating-toolbar shadow-2xl" >
          <div id={toolbarId} className="ql-toolbar ql-snow flex flex-row items-center flex-nowrap border-none bg-transparent">
            <span className="ql-formats">
              <select className="ql-header" defaultValue="">
                <option value="1" />
                <option value="2" />
                <option value="3" />
                <option value="" />
              </select>
              <select className="ql-size" defaultValue="">
                <option value="small" />
                <option value="" />
                <option value="large" />
                <option value="huge" />
              </select>
            </span>
            <span className="ql-formats">
              <button type="button" className="ql-bold" />
              <button type="button" className="ql-italic" />
              <button type="button" className="ql-underline" />
              <button type="button" className="ql-strike" />
            </span>
            <span className="ql-formats">
              <select className="ql-color" />
              <select className="ql-background" />
            </span>
            <span className="ql-formats">
              <button type="button" className="ql-list" value="ordered" />
              <button type="button" className="ql-list" value="bullet" />
              <button type="button" className="ql-indent" value="-1" />
              <button type="button" className="ql-indent" value="+1" />
              <select className="ql-align" />
            </span>
            <span className="ql-formats">
              <button type="button" className="ql-link" />
              <button type="button" className="ql-blockquote" />
              <button type="button" className="ql-clean" />
            </span>

            {/* Custom Buttons */}
            <div className="flex flex-row items-center gap-4 ml-4 border-l pl-4 border-gray-200">
              <button
                type="button"
                className="sgid-toolbar-custom-btn hover:bg-blue-50 hover:text-blue-600"
                onClick={insertTopic}
                disabled={isLoading}
                title="Adicionar Tópico (Seção Pastel)"
              >
                <PlusCircle className="w-4 h-4" />
                Tópicos
              </button>
              <button
                type="button"
                className="sgid-toolbar-custom-btn hover:bg-indigo-50 hover:text-indigo-600"
                onClick={openFieldDialog}
                disabled={isLoading}
                title="Inserir Metadado Editável"
              >
                <Database className="w-4 h-4" />
                Metadado
              </button>
              
              <div className="w-px h-6 bg-gray-200 mx-2"></div>

              <button
                type="button"
                className="sgid-toolbar-custom-btn primary"
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? <span className="animate-spin mr-2">...</span> : <Save className="w-4 h-4 mr-1.5" />}
                Salvar Modelo
              </button>


             
            </div>
          </div>
        </div>
      </div>

      {/* Metadado Dialog */}
      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              Criar Metadado
            </DialogTitle>
            <DialogDescription>
              Campos de metadados tornam-se seções editáveis no documento final.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="field-title" className="text-sm font-medium">Título do metadado *</Label>
              <Input
                id="field-title"
                value={fieldTitle}
                onChange={(e) => setFieldTitle(e.target.value)}
                placeholder='Ex: "Introdução do Projeto"'
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="associated-topic" className="text-sm font-medium">Associar a um Tópico (opcional)</Label>
              <Select value={associatedTopic} onValueChange={setAssociatedTopic}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Selecione um tópico..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum vínculo</SelectItem>
                  {existingTopics.map(topic => (
                    <SelectItem key={topic.id} value={topic.id}>{topic.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-help" className="text-sm font-medium">Instruções para o preenchimento</Label>
              <Textarea
                id="field-help"
                value={fieldHelp}
                onChange={(e) => setFieldHelp(e.target.value)}
                placeholder="Ex: Descreva aqui os objetivos principais..."
                className="rounded-lg min-h-[80px]"
              />
            </div>
            
            <div className="pt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setFieldDialogOpen(false)} className="rounded-lg px-6">
                Cancelar
              </Button>
              <Button onClick={insertMetadataField} className="rounded-lg px-6 bg-indigo-600 hover:bg-indigo-700">
                Inserir Metadado
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


