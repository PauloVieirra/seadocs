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
import { Layout, Type, Save, X, PlusCircle, Database, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';

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

  // Extrair a estrutura (tópicos e metadados) na ordem em que aparecem
  const [structure, setStructure] = useState<{type: 'topic' | 'field', id: string, name: string}[]>([]);

  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(editorData, 'text/html');
    const nodes = doc.querySelectorAll('.sgid-topic, .sgid-metadata-field');
    const items = Array.from(nodes).map((node: any) => {
      const isTopic = node.classList.contains('sgid-topic');
      return {
        type: isTopic ? 'topic' : 'field' as 'topic' | 'field',
        id: isTopic ? node.getAttribute('data-topic-id') : node.getAttribute('data-field-id'),
        name: isTopic ? node.innerText.trim().substring(0, 50) || 'Tópico sem nome' : node.getAttribute('data-field-title') || 'Campo sem título'
      };
    });
    setStructure(items);
    setExistingTopics(items.filter(i => i.type === 'topic').map(i => ({ id: i.id, name: i.name })));
  }, [editorData]);

  const removeItem = (id: string, type: 'topic' | 'field') => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    const selector = type === 'topic' ? `[data-topic-id="${id}"]` : `[data-field-id="${id}"]`;
    const element = editor.root.querySelector(selector);
    if (element) {
      const blot = Quill.find(element) as any;
      if (blot && typeof blot.getIndex === 'function' || blot) {
        const index = editor.getIndex(blot);
        const length = blot.length();
        editor.deleteText(index, length, 'user');
        toast.success('Item removido.');
      }
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= structure.length) return;

    const itemA = structure[index];
    const itemB = structure[targetIndex];

    const selA = itemA.type === 'topic' ? `[data-topic-id="${itemA.id}"]` : `[data-field-id="${itemA.id}"]`;
    const selB = itemB.type === 'topic' ? `[data-topic-id="${itemB.id}"]` : `[data-field-id="${itemB.id}"]`;

    const elA = editor.root.querySelector(selA);
    const elB = editor.root.querySelector(selB);

    if (elA && elB) {
      const blotA = Quill.find(elA) as any;
      const blotB = Quill.find(elB) as any;
      
      if (blotA && blotB) {
        const indexA = editor.getIndex(blotA);
        const lenA = blotA.length();
        
        const indexB = editor.getIndex(blotB);
        const lenB = blotB.length();

        const deltaA = editor.getContents(indexA, lenA);

        // Remover A primeiro
        editor.deleteText(indexA, lenA, 'user');

        let insertAt = indexB;
        if (direction === 'down') {
          // Se A estava antes de B, B recuou lenA posições após a deleção
          insertAt = indexB - lenA + lenB;
        }

        // Inserir A na nova posição usando updateContents com retain
        editor.updateContents({ ops: [{ retain: insertAt }, ...deltaA.ops] } as any, 'user');
        
        toast.success('Posição alterada.');
      }
    }
  };

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
    if (!editor) {
      toast.error('Editor não carregado completamente.');
      return;
    }

    const range = editor.getSelection(true);
    const topicId = `topic-${Date.now()}`;
    
    // 1. Garantir que estamos em uma nova linha
    let insertAt = range ? range.index : editor.getLength();
    if (insertAt > 0) {
      const prevChar = editor.getText(insertAt - 1, 1);
      if (prevChar !== '\n') {
        editor.insertText(insertAt, '\n', 'user');
        insertAt += 1;
      }
    }

    // 2. Inserir o texto do tópico
    editor.insertText(insertAt, 'Novo Tópico', 'user');
    
    // 3. Aplicar o formato de tópico na linha inteira
    editor.formatLine(insertAt, 1, 'topic', topicId);
    
    // 4. Mover o cursor para o final do texto inserido e selecionar para facilitar a edição
    editor.setSelection(insertAt, 11, 'user');
    
    toast.success('Tópico adicionado.');
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
      <div className="flex-1 overflow-hidden relative bg-gray-100 flex flex-row">
        {/* Sidebar de Estrutura */}
        <div className="w-80 border-r bg-white flex flex-col shrink-0">
          <div className="p-4 border-b font-bold flex items-center gap-2 bg-gray-50/50 text-gray-800">
            <Layout className="w-4 h-4 text-blue-600" />
            Estrutura do Modelo
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {structure.map((item, index) => (
              <div key={item.id} className="group p-3 rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        item.type === 'topic' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {item.type === 'topic' ? 'Tópico' : 'Metadado'}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 truncate" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600" 
                        onClick={() => moveItem(index, 'up')} 
                        disabled={index === 0}
                        title="Mover para cima"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600" 
                        onClick={() => moveItem(index, 'down')} 
                        disabled={index === structure.length - 1}
                        title="Mover para baixo"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" 
                      onClick={() => removeItem(item.id, item.type)}
                      title="Remover item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {structure.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center opacity-60">
                <Layout className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">Nenhum elemento inserido</p>
              </div>
            )}
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center">
          <div className="w-full max-w-[950px] bg-white shadow-2xl rounded-sm border border-gray-200 min-h-[1200px]">
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


