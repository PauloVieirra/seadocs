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
import { Layout, Type, Save, PlusCircle, Database, Trash2, AlertCircle } from 'lucide-react';

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

      // Botão de excluir
      const deleteBtn = document.createElement('div');
      deleteBtn.className = 'sgid-delete-btn';
      deleteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>
        </svg>
      `;
      deleteBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        node.dispatchEvent(new CustomEvent('sgid-delete-request', {
          detail: { id, type: 'metadata', title },
          bubbles: true
        }));
      };
      node.appendChild(deleteBtn);

      const header = document.createElement('div');
      header.className = 'sgid-metadata-field__header';

      if (help) {
        const helpEl = document.createElement('div');
        helpEl.className = 'sgid-metadata-field__help';
        helpEl.innerText = `💡 ${help}`;
        header.appendChild(helpEl);
      }

      const body = document.createElement('div');
      body.className = 'sgid-metadata-field__textarea';
      body.innerText = 'Este espaço será preenchido pela IA ou manualmente no documento final...';

      if (header.childNodes.length > 0) {
        node.appendChild(header);
      }
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
      const topicId = (value && typeof value === 'string') ? value : `topic-${Date.now()}`;
      node.setAttribute('data-topic-id', topicId);

      // Botão de excluir para o tópico
      const deleteBtn = document.createElement('div');
      deleteBtn.className = 'sgid-delete-btn';
      deleteBtn.setAttribute('contenteditable', 'false');
      deleteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>
        </svg>
      `;
      deleteBtn.onclick = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        const topicName = (e.target.closest('.sgid-topic') as HTMLElement)?.innerText || 'Tópico';
        node.dispatchEvent(new CustomEvent('sgid-delete-request', {
          detail: { id: topicId, type: 'topic', title: topicName },
          bubbles: true
        }));
      };
      node.appendChild(deleteBtn);

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

// Registro imediato fora do componente
ensureCustomBlotsRegistered();

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
  const editorContentRef = useRef<string>(initialData?.templateContent || '');
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.type || '');
  // editorData agora é usado apenas para extrair tópicos e salvar, não para controlar o input
  const [editorData, setEditorData] = useState(initialData?.templateContent || '');

  // ... (states de metadado e delete) ...

  // Sincroniza o editorContentRef com as mudanças do editor sem causar re-renders
  const handleEditorChange = (content: string) => {
    editorContentRef.current = content;
    // Debounce ou atualização lenta do editorData apenas para fins de UI (lista de tópicos)
    setEditorData(content);
  };

  // Metadado State
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [fieldId, setFieldId] = useState('');
  const [fieldHelp, setFieldHelp] = useState('');
  const [associatedTopic, setAssociatedTopic] = useState<string>('');

  // Tópico State
  const [existingTopics, setExistingTopics] = useState<{id: string, name: string}[]>([]);

  // Delete Confirmation State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, type: 'topic' | 'metadata', title: string} | null>(null);

  useEffect(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    const handleDeleteRequest = (e: any) => {
      const { id, type, title } = e.detail;
      setItemToDelete({ id, type, title });
      setDeleteConfirmOpen(true);
    };

    editor.root.addEventListener('sgid-delete-request', handleDeleteRequest);
    return () => {
      editor.root.removeEventListener('sgid-delete-request', handleDeleteRequest);
    };
  }, []);

  const confirmDelete = () => {
    if (!itemToDelete) return;

    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    if (itemToDelete.type === 'metadata') {
      const fieldNode = editor.root.querySelector(`[data-field-id="${itemToDelete.id}"]`);
      if (fieldNode) {
        const blot = Quill.find(fieldNode) as any;
        if (blot && typeof blot.remove === 'function') {
          blot.remove();
          toast.success('Metadado removido.');
        }
      }
    } else {
      const topicNode = editor.root.querySelector(`[data-topic-id="${itemToDelete.id}"]`);
      if (topicNode) {
        const blot = Quill.find(topicNode) as any;
        if (blot && typeof blot.remove === 'function') {
          blot.remove();
          toast.success('Tópico removido.');
        }
      }
    }

    setDeleteConfirmOpen(false);
    setItemToDelete(null);
  };

  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(editorData, 'text/html');
    const nodes = doc.querySelectorAll('.sgid-topic');
    const topics = Array.from(nodes).map((node: any) => ({
      id: node.getAttribute('data-topic-id') || '',
      name: node.innerText.trim().substring(0, 50) || 'Tópico sem nome'
    }));
    setExistingTopics(topics);
  }, [editorData]);

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

  const toolbarId = useMemo(() => `model-toolbar-${Math.random().toString(16).slice(2)}`, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentContent = editorContentRef.current;
    if (!name.trim() || !type.trim() || !currentContent.trim()) {
      toast.error('Por favor, preencha todos os campos obrigatórios e o conteúdo do template.');
      return;
    }
    await onSave(name, type, currentContent);
  };

  const openFieldDialog = () => {
    setFieldId('');
    setFieldHelp('');
    setAssociatedTopic('');
    setFieldDialogOpen(true);
  };

  const insertTopic = () => {
    const editor = quillRef.current?.getEditor();
    if (!editor) {
      toast.error('Editor não carregado completamente.');
      return;
    }

    editor.focus();
    const range = editor.getSelection(true);
    let index = range ? range.index : editor.getLength();

    // Se estivermos no final do editor ou meio do texto, garante nova linha antes
    if (index > 0 && editor.getText(index - 1, 1) !== '\n') {
      editor.insertText(index, '\n', 'user');
      index++;
    }

    const topicId = `topic-${Date.now()}`;
    const text = 'Novo Tópico';

    // Inserir o texto e a quebra de linha subsequente
    editor.insertText(index, text + '\n', 'user');
    
    // Aplicar o formato de tópico (formatLine atua no bloco/parágrafo)
    editor.formatLine(index, 1, 'topic', topicId);
    
    // Feedback imediato
    toast.success('Tópico adicionado.');

    // Seleção simplificada - sem loops de renderização do React interferindo
    setTimeout(() => {
      try {
        editor.setSelection(index, text.length, 'user');
      } catch (err) {
        // Silencioso se o browser ainda estiver ocupado
      }
    }, 100);
  };

  const generateUniqueId = (baseId: string) => {
    const normalizedBase = baseId || `campo-${Date.now()}`;
    let candidate = normalizedBase;
    let i = 2;
    const currentHTML = editorContentRef.current;
    while (new RegExp(`data-field-id="${candidate.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}"`, 'i').test(currentHTML)) {
      candidate = `${normalizedBase}-${i}`;
      i += 1;
    }
    return candidate;
  };

  const insertMetadataField = () => {
    if (isLoading) return;
    if (!associatedTopic) {
      toast.error('Por favor, associe este metadado a um tópico.');
      return;
    }

    const editor = quillRef.current?.getEditor?.();
    if (!editor) {
      toast.error('Editor não disponível.');
      return;
    }

    const topic = existingTopics.find(t => t.id === associatedTopic);
    const titleToUse = topic ? topic.name : 'Campo';
    const baseId = slugify(titleToUse);
    const uniqueId = generateUniqueId(baseId);

    editor.focus();
    const range = editor.getSelection(true);
    let insertAt = range ? range.index : editor.getLength();

    // Garante que o embed comece em uma nova linha
    if (insertAt > 0 && editor.getText(insertAt - 1, 1) !== '\n') {
      editor.insertText(insertAt, '\n', 'user');
      insertAt += 1;
    }

    // Inserir o Blot de Metadado
    editor.insertEmbed(insertAt, 'metadataField', { 
      id: uniqueId, 
      title: titleToUse,
      help: fieldHelp.trim(),
      topicId: associatedTopic
    }, 'user');
    
    // Remove parágrafos vazios duplicados entre tópico e metadado
    const contents = editor.getContents(insertAt - 1, 2);
    if (contents.ops.length > 1 && contents.ops[0].insert === '\n' && contents.ops[1].insert === '\n') {
       editor.deleteText(insertAt, 1, 'user');
    }

    // Garante linha vazia após o embed para o usuário continuar escrevendo
    editor.insertText(insertAt + 1, '\n', 'user');
    
    // Mover o cursor para após o metadado
    setTimeout(() => {
      try {
        editor.setSelection(insertAt + 2, 0, 'user');
      } catch (e) {
        // Silencioso
      }
    }, 100);

    setFieldDialogOpen(false);
    toast.success(`Metadado para "${titleToUse}" adicionado.`);
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
      <div className="flex-1 overflow-hidden relative bg-gray-100 flex flex-row">
        {/* Editor Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center">
          <div className="w-full max-w-[950px] bg-white shadow-2xl rounded-sm border border-gray-200 min-h-[1200px]">
            <ReactQuill
              ref={(instance) => {
                quillRef.current = instance;
              }}
              theme="snow"
              defaultValue={editorContentRef.current}
              onChange={handleEditorChange}
              readOnly={isLoading}
              modules={{
                toolbar: {
                  container: `#${toolbarId}`,
                },
              }}
              formats={[
                'header', 'bold', 'italic', 'underline', 'strike', 'blockquote',
                'list', 'bullet', 'indent', 'link', 'image', 'video',
                'color', 'background', 'align', 'metadataField', 'topic'
              ]}
              placeholder="Comece a criar seu modelo de documento..."
              className="h-full border-none"
            />
          </div>
        </div>

        {/* Floating Toolbar Bottom */}
        <div className="sgid-floating-toolbar shadow-2xl">
          {/* Ferramentas Padrão (Interno 1) */}
          <div id={toolbarId} className="ql-toolbar ql-snow flex flex-row items-center flex-nowrap border-none bg-transparent">
            <span className="ql-formats">
              <select className="ql-header" defaultValue="">
                <option value="1" />
                <option value="2" />
                <option value="3" />
                <option value="" />
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
          </div>

          {/* Botões Customizados (Interno 2) */}
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
              <Label htmlFor="associated-topic" className="text-sm font-medium">Associar a um Tópico *</Label>
              <Select value={associatedTopic} onValueChange={setAssociatedTopic}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Selecione o tópico que este campo preenche..." />
                </SelectTrigger>
                <SelectContent>
                  {existingTopics.map(topic => (
                    <SelectItem key={topic.id} value={topic.id}>{topic.name}</SelectItem>
                  ))}
                  {existingTopics.length === 0 && (
                    <div className="p-2 text-xs text-red-500 italic">Nenhum tópico criado ainda. Adicione um tópico primeiro.</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-help" className="text-sm font-medium">Instruções para a IA ou preenchimento</Label>
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

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <DialogTitle className="text-red-900">Confirmar Exclusão</DialogTitle>
            </div>
            <DialogDescription className="text-gray-600 pt-2">
              Tem certeza que deseja remover este {itemToDelete?.type === 'topic' ? 'tópico' : 'metadado'}?
              {itemToDelete?.title && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100 italic text-sm text-gray-700">
                  "{itemToDelete.title.substring(0, 100)}{itemToDelete.title.length > 100 ? '...' : ''}"
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setItemToDelete(null);
              }}
              disabled={isLoading}
              className="rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isLoading}
              className="rounded-lg px-6 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


