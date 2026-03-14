import React, { useMemo, useRef, useState, useEffect } from 'react';
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DocumentModel, apiService } from '../../services/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Layout, Type, Save, X, PlusCircle, Database, Palette, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { HexColorPicker } from 'react-colorful';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { listSpecFiles, type SpecFile } from '../../services/spec-service';

let customBlotsRegistered = false;

/** Tamanhos de fonte em pixels (12 a 80) */
const FONT_SIZES_PX = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '40px', '48px', '56px', '64px', '72px', '80px'];

function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return '#000000';
  const r = parseInt(m[1], 10).toString(16).padStart(2, '0');
  const g = parseInt(m[2], 10).toString(16).padStart(2, '0');
  const b = parseInt(m[3], 10).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function ensureCustomBlotsRegistered() {
  if (customBlotsRegistered) return;

  const QuillAny: any = Quill;

  // Tamanhos de fonte customizados (12px a 80px) - sobrescrever whitelist
  const SizeClass = QuillAny.import('attributors/class/size');
  SizeClass.whitelist = FONT_SIZES_PX;
  QuillAny.register(SizeClass, true);
  const BlockEmbed = QuillAny.import('blots/block/embed');

  // Blot para Metadado (Campo Editável)
  class MetadataFieldBlot extends BlockEmbed {
    static blotName = 'metadataField';
    static tagName = 'div';
    static className = 'sgid-metadata-field';

    static create(value: { id?: string; title?: string; help?: string; topicId?: string; topicName?: string; repeatable?: boolean; planningInstruction?: string }) {
      const node: HTMLElement = super.create();
      const id = value?.id || `field-${Date.now()}`;
      const title = value?.title || 'Campo';
      const help = value?.help || '';
      const topicId = value?.topicId || '';
      const topicName = value?.topicName || (topicId.startsWith('cell:') ? `Célula ${topicId.split(':').pop()}` : topicId);
      const repeatable = value?.repeatable ?? false;
      const planningInstruction = value?.planningInstruction || '';

      node.setAttribute('contenteditable', 'false');
      node.setAttribute('data-field-id', id);
      node.setAttribute('data-field-title', title);
      node.setAttribute('data-field-help', help);
      node.setAttribute('data-topic-id', topicId);
      if (repeatable) node.setAttribute('data-repeatable', 'true');
      if (planningInstruction) node.setAttribute('data-planning-instruction', planningInstruction);

      const header = document.createElement('div');
      header.className = 'sgid-metadata-field__header';

      const titleEl = document.createElement('div');
      titleEl.className = 'sgid-metadata-field__title';
      titleEl.innerText = title;
      header.appendChild(titleEl);

      if (repeatable) {
        const badge = document.createElement('span');
        badge.className = 'text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2 font-semibold';
        badge.innerText = 'REPETÍVEL';
        titleEl.appendChild(badge);
      }

      if (topicId && !repeatable) {
        const topicTag = document.createElement('span');
        topicTag.className = 'text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2';
        topicTag.innerText = `Tópico: ${topicName}`;
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
      body.innerText = repeatable
        ? 'Campo dinâmico — a IA criará as instâncias necessárias ao gerar o documento.'
        : 'Digite aqui (campo editável no documento)...';

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
        repeatable: node.getAttribute('data-repeatable') === 'true',
        planningInstruction: node.getAttribute('data-planning-instruction') || '',
      };
    }
  }

  // Blot para Tópico (Container Pastel) - BlockEmbed para garantir estrutura com data-topic-id
  class TopicBlot extends BlockEmbed {
    static blotName = 'topic';
    static tagName = 'div';
    static className = 'sgid-topic';

    static create(value: { id?: string; name?: string } | string) {
      const node: HTMLElement = super.create();
      const id = (typeof value === 'object' && value?.id) || (typeof value === 'string' ? value : '') || `topic-${Date.now()}`;
      const name = (typeof value === 'object' && value?.name) || 'Novo Tópico';

      node.setAttribute('contenteditable', 'false');
      node.setAttribute('data-topic-id', id);

      const titleEl = document.createElement('p');
      titleEl.className = 'sgid-topic-title';
      titleEl.innerText = name;
      node.appendChild(titleEl);

      return node;
    }

    static value(node: HTMLElement) {
      const titleEl = node.querySelector('.sgid-topic-title') || node.querySelector('p') as HTMLElement | null;
      const name = (titleEl as HTMLElement)?.innerText?.trim() || 'Tópico sem nome';
      return {
        id: node.getAttribute('data-topic-id') || '',
        name,
      };
    }
  }

  QuillAny.register(MetadataFieldBlot);
  QuillAny.register(TopicBlot);
  customBlotsRegistered = true;
}

ensureCustomBlotsRegistered();

function slugify(input: string) {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Retorna o índice onde inserir o metadado (logo após o tópico) ou -1 se não encontrar */
function findTopicInsertPosition(editor: { getContents: () => { ops?: unknown[] }; root?: HTMLElement }, topicId: string): number {
  const delta = editor.getContents();
  if (!delta?.ops) return -1;
  let index = 0;
  for (const op of delta.ops) {
    const o = op as { insert?: string | Record<string, unknown>; retain?: number };
    if (typeof o.insert === 'object' && o.insert !== null) {
      if ('topic' in o.insert) {
        const topicInsert = o.insert as { topic?: { id?: string } | string };
        const topicVal = topicInsert.topic;
        const id = typeof topicVal === 'object' ? topicVal?.id : topicVal;
        if (id === topicId) return index + 1;
      }
      index += 1;
    } else if (typeof o.insert === 'string') {
      index += o.insert.length;
    } else if (typeof o.retain === 'number') {
      index += o.retain;
    }
  }
  return -1;
}


interface RichTextDocumentModelEditorProps {
  onSave: (name: string, type: string, templateContent: string, isDraft?: boolean, aiGuidance?: string, specPath?: string) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  initialData?: DocumentModel;
  onDraftStatusChange?: (draft: boolean, saved: boolean) => void;
}

const DRAFT_DEBOUNCE_MS = 1500;
const DRAFT_NEW_ID = 'model_draft_new';

export function RichTextDocumentModelEditor({
  onSave,
  onCancel,
  isLoading,
  initialData,
  onDraftStatusChange,
}: RichTextDocumentModelEditorProps) {
  const quillRef = useRef<ReactQuill | null>(null);
  const pendingDeleteRef = useRef<{ type: 'topic' | 'metadata'; topicId?: string; fieldId?: string } | null>(null);
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.type || '');
  const [editorData, setEditorData] = useState(initialData?.templateContent || '');
  const [specPath, setSpecPath] = useState(initialData?.specPath || '');
  const [specSearchQuery, setSpecSearchQuery] = useState('');
  const [specFiles, setSpecFiles] = useState<SpecFile[]>([]);
  const [specFilesLoading, setSpecFilesLoading] = useState(true);
  const [specSearchOpen, setSpecSearchOpen] = useState(false);
  const specSearchRef = useRef<HTMLDivElement>(null);

  // Metadado State
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingMetadataId, setEditingMetadataId] = useState<string | null>(null);
  const [fieldTitle, setFieldTitle] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [fieldHelp, setFieldHelp] = useState('');
  const [fieldRepeatable, setFieldRepeatable] = useState(false);
  const [fieldPlanningInstruction, setFieldPlanningInstruction] = useState('');
  const [associatedTopic, setAssociatedTopic] = useState<string>('none');

  // Tópico State
  const [existingTopics, setExistingTopics] = useState<{id: string, name: string}[]>([]);
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicName, setTopicName] = useState('');

  // Tamanho de fonte atual (para o controle customizado): px ou '__normal__'
  const [fontSize, setFontSize] = useState<string>('__normal__');
  const [fontColor, setFontColor] = useState<string>('#000000');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  // Tabela
  // Confirmação de exclusão de elementos
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    type: 'topic' | 'metadata';
    topicId?: string;
    fieldId?: string;
  } | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setType(initialData.type);
      setEditorData(initialData.templateContent);
      setSpecPath(initialData.specPath || '');
      setSpecSearchQuery(initialData.specPath || '');
    }
  }, [initialData]);

  // Atualizar display do Spec selecionado quando a lista carrega (path → label)
  useEffect(() => {
    if (specFiles.length && specPath && specSearchQuery === specPath) {
      const found = specFiles.find((f) => f.path === specPath);
      if (found) setSpecSearchQuery(found.label);
    }
  }, [specFiles, specPath, specSearchQuery]);

  // Carregar lista de Specs do bucket 'specs' no Supabase Storage
  useEffect(() => {
    setSpecFilesLoading(true);
    listSpecFiles()
      .then((data) => setSpecFiles(data))
      .catch(() => setSpecFiles([]))
      .finally(() => setSpecFilesLoading(false));
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (specSearchRef.current && !specSearchRef.current.contains(e.target as Node)) {
        setSpecSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const specFilteredResults = specSearchQuery.trim()
    ? specFiles.filter(
        (f) =>
          f.label.toLowerCase().includes(specSearchQuery.toLowerCase()) ||
          f.path.toLowerCase().includes(specSearchQuery.toLowerCase())
      )
    : specFiles;
  const showSpecResults = specSearchOpen && !specFilesLoading;

  // Handler para botões editar e excluir (tabela, tópico, metadado) - event delegation
  // Usa retry para garantir que o handler seja anexado quando o editor estiver pronto
  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | null = null;
    const attachHandler = () => {
      const editor = quillRef.current?.getEditor?.();
      if (!editor?.root || !mounted) return false;
      const handleElementButtonClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;

      // Tópico - excluir (abre confirmação)
      const topicDeleteBtn = target.closest('.sgid-topic-delete-btn');
      if (topicDeleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const topicEl = topicDeleteBtn.closest('.sgid-topic') as HTMLElement;
        if (topicEl) {
          const topicId = topicEl.getAttribute('data-topic-id') || '';
          pendingDeleteRef.current = { type: 'topic', topicId };
          setPendingDelete({ type: 'topic', topicId });
          setDeleteConfirmOpen(true);
        }
        return;
      }

      // Tópico - editar
      const topicEditBtn = target.closest('.sgid-topic-edit-btn');
      if (topicEditBtn) {
        e.preventDefault();
        e.stopPropagation();
        const topicEl = topicEditBtn.closest('.sgid-topic') as HTMLElement;
        if (topicEl) {
          const topicId = topicEl.getAttribute('data-topic-id') || '';
          const titleEl = topicEl.querySelector('.sgid-topic-title') || topicEl.querySelector('p') as HTMLElement | null;
          setTopicName((titleEl as HTMLElement)?.innerText?.trim() || '');
          setEditingTopicId(topicId);
          setTopicDialogOpen(true);
        }
        return;
      }

      // Metadado - excluir (abre confirmação)
      const metaDeleteBtn = target.closest('.sgid-metadata-delete-btn');
      if (metaDeleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const metaEl = metaDeleteBtn.closest('.sgid-metadata-field') as HTMLElement;
        if (metaEl) {
          const fieldId = metaEl.getAttribute('data-field-id') || '';
          const fieldTitle = metaEl.getAttribute('data-field-title') || '';
          pendingDeleteRef.current = { type: 'metadata', fieldId };
          setPendingDelete({ type: 'metadata', fieldId }); // fieldTitle para mensagem
          setDeleteConfirmOpen(true);
        }
        return;
      }

      // Metadado - editar
      const metaEditBtn = target.closest('.sgid-metadata-edit-btn');
      if (metaEditBtn) {
        e.preventDefault();
        e.stopPropagation();
        const metaEl = metaEditBtn.closest('.sgid-metadata-field') as HTMLElement;
        if (metaEl) {
          setFieldTitle(metaEl.getAttribute('data-field-title') || '');
          setFieldId(metaEl.getAttribute('data-field-id') || '');
          setFieldHelp(metaEl.getAttribute('data-field-help') || '');
          setFieldRepeatable(metaEl.getAttribute('data-repeatable') === 'true');
          setFieldPlanningInstruction(metaEl.getAttribute('data-planning-instruction') || '');
          setAssociatedTopic(metaEl.getAttribute('data-topic-id') || 'none');
          setEditingMetadataId(metaEl.getAttribute('data-field-id') || '');
          setFieldDialogOpen(true);
        }
        return;
      }
      };
      const root = editor.root;
      root.addEventListener('click', handleElementButtonClick, true);
      cleanup = () => root.removeEventListener('click', handleElementButtonClick, true);
      return true;
    };
    if (!attachHandler()) {
      const raf = requestAnimationFrame(() => {
        if (mounted) attachHandler();
      });
      return () => {
        mounted = false;
        cancelAnimationFrame(raf);
        cleanup?.();
      };
    }
    return () => {
      mounted = false;
      cleanup?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Adicionar botões editar/excluir em tópicos e metadados via MutationObserver.
  //
  // NÃO depende de [editorData]: o efeito roda uma única vez e o MutationObserver
  // fica ativo durante toda a vida do componente. Assim, quando o Quill reconstrói
  // qualquer blot (ao carregar conteúdo, inserir novo campo, etc.), os botões são
  // adicionados imediatamente ao nó inserido — sem depender do ciclo React.
  useEffect(() => {
    // Espera o editor estar disponível (pode não estar ainda na primeira execução)
    let observer: MutationObserver | null = null;

    const setup = () => {
      const editor = quillRef.current?.getEditor?.();
      if (!editor?.root) return false;

      const SVG_EDIT = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
      const SVG_DELETE = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';

      const addTopicButtons = (el: HTMLElement) => {
        if (el.querySelector('.sgid-topic-edit-btn')) return;
        let topicId = el.getAttribute('data-topic-id');
        if (!topicId) {
          topicId = `topic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          el.setAttribute('data-topic-id', topicId);
        }
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'sgid-topic-edit-btn';
        editBtn.setAttribute('data-topic-id', topicId);
        editBtn.setAttribute('title', 'Editar tópico');
        editBtn.innerHTML = SVG_EDIT;
        el.appendChild(editBtn);
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'sgid-topic-delete-btn';
        deleteBtn.setAttribute('data-topic-id', topicId);
        deleteBtn.setAttribute('title', 'Excluir tópico');
        deleteBtn.innerHTML = SVG_DELETE;
        el.appendChild(deleteBtn);
      };

      const addMetadataButtons = (el: HTMLElement) => {
        if (el.querySelector('.sgid-metadata-edit-btn')) return;
        let fieldId = el.getAttribute('data-field-id');
        if (!fieldId) {
          fieldId = `field-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          el.setAttribute('data-field-id', fieldId);
        }
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'sgid-metadata-edit-btn';
        editBtn.setAttribute('data-field-id', fieldId);
        editBtn.setAttribute('title', 'Editar metadado');
        editBtn.innerHTML = SVG_EDIT;
        el.appendChild(editBtn);
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'sgid-metadata-delete-btn';
        deleteBtn.setAttribute('data-field-id', fieldId);
        deleteBtn.setAttribute('title', 'Excluir metadado');
        deleteBtn.innerHTML = SVG_DELETE;
        el.appendChild(deleteBtn);
      };

      const scanNode = (node: Node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.classList.contains('sgid-topic')) addTopicButtons(node);
        if (node.classList.contains('sgid-metadata-field')) addMetadataButtons(node);
        node.querySelectorAll('.sgid-topic').forEach(el => addTopicButtons(el as HTMLElement));
        node.querySelectorAll('.sgid-metadata-field').forEach(el => addMetadataButtons(el as HTMLElement));
      };

      // Scan inicial: cobre campos já presentes quando o effect monta
      editor.root.querySelectorAll('.sgid-topic').forEach(el => addTopicButtons(el as HTMLElement));
      editor.root.querySelectorAll('.sgid-metadata-field').forEach(el => addMetadataButtons(el as HTMLElement));

      // MutationObserver: adiciona botões em qualquer nó que o Quill inserir depois
      observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach(scanNode);
        }
      });
      observer.observe(editor.root, { childList: true, subtree: true });
      return true;
    };

    // Tenta setup imediato; se o editor ainda não estiver pronto, aguarda um frame
    if (!setup()) {
      const raf = requestAnimationFrame(() => setup());
      return () => { cancelAnimationFrame(raf); observer?.disconnect(); };
    }

    return () => observer?.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronizar tamanho de fonte com a seleção do editor
  useEffect(() => {
    const editor = quillRef.current?.getEditor?.();
    if (!editor) return;
    const handler = () => {
      const range = editor.getSelection();
      if (range != null) {
        const format = editor.getFormat(range.index);
        const size = format?.size;
        setFontSize(typeof size === 'string' ? size : '__normal__');
      }
    };
    editor.on('selection-change', handler);
    return () => { editor.off('selection-change', handler); };
  }, [editorData]);

  // Auto-save rascunho local (IndexedDB) no modo criar novo (sem modelo do banco)
  const isEditMode = initialData && !initialData.isLocalDraft;
  useEffect(() => {
    if (isEditMode || isLoading) return;
    const timer = setTimeout(() => {
      if (name.trim() || type.trim() || editorData.trim()) {
        apiService.saveLocalModelDraft({
          id: DRAFT_NEW_ID,
          name: name || 'Sem título',
          type: type || 'Sem tipo',
          templateContent: editorData || '',
          aiGuidance: initialData?.aiGuidance ?? '',
          specPath: specPath || undefined,
          isDraft: true
        }).then(() => onDraftStatusChange?.(true, true));
      }
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [name, type, editorData, specPath, isEditMode, isLoading, onDraftStatusChange, initialData?.aiGuidance]);

  // Extrair tópicos existentes no documento para associar metadados (inclui blocos Tópico e células de tabela)
  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(editorData, 'text/html');
    const topics: { id: string; name: string }[] = [];

    // Tópicos (blocos sgid-topic)
    doc.querySelectorAll('.sgid-topic').forEach((node: Element) => {
      const id = node.getAttribute('data-topic-id');
      if (id) {
        const titleEl = node.querySelector('.sgid-topic-title') || node.querySelector('p') as HTMLElement | null;
        const name = ((titleEl as HTMLElement)?.innerText?.trim() || (node as HTMLElement).innerText.trim() || '').substring(0, 30) || 'Tópico sem nome';
        topics.push({ id, name });
      }
    });

    setExistingTopics(topics);
  }, [editorData]);

  const toolbarId = useMemo(() => `model-toolbar-${Math.random().toString(16).slice(2)}`, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const editor = quillRef.current?.getEditor?.();
    const contentToSave = editor?.root ? editor.root.innerHTML : editorData;
    if (!name.trim() || !type.trim() || !contentToSave.trim()) {
      toast.error('Por favor, preencha todos os campos obrigatórios e o conteúdo do template.');
      return;
    }
    const savingAsDraft = initialData?.isDraft ?? true;
    if (!savingAsDraft && !specPath.trim()) {
      toast.error('Documento Spec é obrigatório ao salvar o modelo. Selecione um Spec na lista.');
      return;
    }
    await onSave(name, type, contentToSave, savingAsDraft, initialData?.aiGuidance ?? '', specPath.trim() || undefined);
  };

  const openFieldDialog = () => {
    setEditingMetadataId(null);
    setFieldTitle('');
    setFieldId('');
    setFieldHelp('');
    setFieldRepeatable(false);
    setFieldPlanningInstruction('');
    setAssociatedTopic('none');
    setFieldDialogOpen(true);
  };

  const saveTopic = () => {
    if (!editingTopicId || !topicName.trim()) return;
    const editor = quillRef.current?.getEditor?.();
    if (!editor?.root) return;
    const topicEl = editor.root.querySelector(`.sgid-topic[data-topic-id="${editingTopicId}"]`) as HTMLElement;
    if (!topicEl) {
      toast.error('Tópico não encontrado.');
      setTopicDialogOpen(false);
      setEditingTopicId(null);
      return;
    }
    const editBtn = topicEl.querySelector('.sgid-topic-edit-btn');
    const deleteBtn = topicEl.querySelector('.sgid-topic-delete-btn');
    topicEl.innerHTML = `<p class="sgid-topic-title">${topicName.trim()}</p>`;
    if (editBtn) topicEl.appendChild(editBtn);
    if (deleteBtn) topicEl.appendChild(deleteBtn);

    // Atualizar referência do tópico em metadados associados (tag exibida)
    const metaFields = editor.root.querySelectorAll(`.sgid-metadata-field[data-topic-id="${editingTopicId}"]`);
    metaFields.forEach((meta) => {
      const metaEl = meta as HTMLElement;
      const titleEl = metaEl.querySelector('.sgid-metadata-field__title');
      if (titleEl) {
        const fieldTitle = metaEl.getAttribute('data-field-title') || '';
        titleEl.innerHTML = fieldTitle.trim();
        const tag = document.createElement('span');
        tag.className = 'text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2';
        tag.innerText = `Tópico: ${topicName.trim()}`;
        titleEl.appendChild(tag);
      }
    });

    setEditorData(getCleanEditorHTML(editor.root));
    setTopicDialogOpen(false);
    setEditingTopicId(null);
    setTopicName('');
    toast.success('Tópico atualizado.');
  };

  const insertTopic = () => {
    const editor = quillRef.current?.getEditor?.();
    if (!editor) {
      toast.error('Editor não disponível. Clique na área do documento primeiro.');
      return;
    }

    editor.focus();
    const range = editor.getSelection(true);
    const topicId = `topic-${Date.now()}`;
    let insertAt = range != null ? range.index : editor.getLength();

    if (insertAt > 0) {
      const prevChar = editor.getText(insertAt - 1, 1);
      if (prevChar && prevChar !== '\n') {
        editor.insertText(insertAt, '\n', 'user');
        insertAt += 1;
      }
    }

    try {
      const value = { id: topicId, name: 'Novo Tópico' };
      editor.insertEmbed(insertAt, 'topic', value, 'user');
      editor.insertText(insertAt + 1, '\n', 'user');
      editor.setSelection(insertAt + 2, 0, 'user');
      setEditorData(getCleanEditorHTML(editor.root));
      toast.success('Tópico adicionado. Use o botão de editar para alterar o título.');
    } catch (err) {
      console.error('[insertTopic]', err);
      try {
        const topicHtml = `<div class="sgid-topic" data-topic-id="${topicId}" contenteditable="false"><p class="sgid-topic-title">Novo Tópico</p></div>`;
        editor.clipboard?.dangerouslyPasteHTML?.(insertAt, topicHtml + '<p><br></p>', 'user');
        editor.setSelection(insertAt + 2, 0, 'user');
        setEditorData(getCleanEditorHTML(editor.root));
        toast.success('Tópico adicionado. Use o botão de editar para alterar o título.');
      } catch (fallbackErr) {
        console.error('[insertTopic fallback]', fallbackErr);
        toast.error(`Erro ao inserir tópico: ${err instanceof Error ? err.message : 'Tente novamente.'}`);
      }
    }
  };

  // Retorna o HTML do editor sem os botões de UI dinâmicos (edit/delete).
  // Esses botões são injetados no DOM via addMetadataButtons/addTopicButtons e NÃO
  // devem ser persistidos em editorData — caso contrário ReactQuill os recebe como
  // parte do value, reconstrói os blots sem eles e quebra o segundo campo.
  const getCleanEditorHTML = (root: HTMLElement): string => {
    const tmp = document.createElement('div');
    tmp.innerHTML = root.innerHTML;
    tmp.querySelectorAll(
      '.sgid-metadata-edit-btn, .sgid-metadata-delete-btn, .sgid-topic-edit-btn, .sgid-topic-delete-btn'
    ).forEach((el) => el.remove());
    return tmp.innerHTML;
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

  const focusEditorOnDocumentClick = (e: React.MouseEvent) => {
    if (isLoading) return;
    // Ignorar cliques nos botões de ação (editar/excluir) para evitar scroll e permitir abertura do modal
    const target = e.target as HTMLElement;
    if (target.closest('.sgid-topic-edit-btn, .sgid-topic-delete-btn, .sgid-metadata-edit-btn, .sgid-metadata-delete-btn')) {
      return;
    }
    const editor = quillRef.current?.getEditor?.();
    if (editor) editor.focus();
  };

  const executePendingDelete = () => {
    const pending = pendingDeleteRef.current;
    const editor = quillRef.current?.getEditor?.();
    if (!pending || !editor?.root) return;
    if (pending.type === 'topic' && pending.topicId) {
      const topicEl = editor.root.querySelector(`.sgid-topic[data-topic-id="${pending.topicId}"]`) as HTMLElement;
      if (topicEl) {
        editor.root.querySelectorAll(`.sgid-metadata-field[data-topic-id="${pending.topicId}"]`).forEach((meta) => {
          const metaEl = meta as HTMLElement;
          metaEl.setAttribute('data-topic-id', '');
          const titleEl = metaEl.querySelector('.sgid-metadata-field__title');
          if (titleEl) {
            const fieldTitle = metaEl.getAttribute('data-field-title') || '';
            titleEl.innerHTML = fieldTitle.trim();
          }
        });
        topicEl.remove();
        toast.success('Tópico excluído.');
      }
    } else if (pending.type === 'metadata' && pending.fieldId) {
      const metaEl = editor.root.querySelector(`.sgid-metadata-field[data-field-id="${pending.fieldId}"]`) as HTMLElement;
      if (metaEl) {
        metaEl.remove();
        toast.success('Metadado excluído.');
      }
    }
    setEditorData(getCleanEditorHTML(editor.root));
    pendingDeleteRef.current = null;
    setPendingDelete(null);
    setDeleteConfirmOpen(false);
  };

  const saveMetadataField = () => {
    if (isLoading) return;
    if (!fieldTitle.trim()) {
      toast.error('Informe o título do campo (ex: Introdução).');
      return;
    }

    const editor = quillRef.current?.getEditor?.();
    if (!editor?.root) {
      toast.error('Editor não disponível.');
      return;
    }

    const topic = associatedTopic !== 'none' ? existingTopics.find((t) => t.id === associatedTopic) : null;
    const topicName = topic?.name;

    if (editingMetadataId) {
      const metaEl = editor.root.querySelector(`.sgid-metadata-field[data-field-id="${editingMetadataId}"]`) as HTMLElement;
      if (!metaEl) {
        toast.error('Metadado não encontrado.');
        setFieldDialogOpen(false);
        setEditingMetadataId(null);
        return;
      }
      const baseId = fieldId.trim() ? slugify(fieldId.trim()) : slugify(fieldTitle.trim());
      const uniqueId = editingMetadataId === baseId ? editingMetadataId : generateUniqueId(baseId);

      metaEl.setAttribute('data-field-id', uniqueId);
      metaEl.setAttribute('data-field-title', fieldTitle.trim());
      metaEl.setAttribute('data-field-help', fieldHelp.trim());
      metaEl.setAttribute('data-topic-id', associatedTopic !== 'none' ? associatedTopic : '');
      if (fieldRepeatable) {
        metaEl.setAttribute('data-repeatable', 'true');
        if (fieldPlanningInstruction.trim()) metaEl.setAttribute('data-planning-instruction', fieldPlanningInstruction.trim());
        else metaEl.removeAttribute('data-planning-instruction');
      } else {
        metaEl.removeAttribute('data-repeatable');
        metaEl.removeAttribute('data-planning-instruction');
      }

      const titleEl = metaEl.querySelector('.sgid-metadata-field__title');
      if (titleEl) {
        titleEl.innerHTML = fieldTitle.trim();
        if (fieldRepeatable) {
          const badge = document.createElement('span');
          badge.className = 'text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2 font-semibold';
          badge.innerText = 'REPETÍVEL';
          titleEl.appendChild(badge);
        } else if (associatedTopic !== 'none' && topicName) {
          const tag = document.createElement('span');
          tag.className = 'text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2';
          tag.innerText = `Tópico: ${topicName}`;
          titleEl.appendChild(tag);
        }
      }
      const helpEl = metaEl.querySelector('.sgid-metadata-field__help');
      if (helpEl) (helpEl as HTMLElement).innerText = fieldHelp.trim();
      const bodyEl = metaEl.querySelector('.sgid-metadata-field__textarea');
      if (bodyEl) (bodyEl as HTMLElement).innerText = fieldRepeatable
        ? 'Campo dinâmico — a IA criará as instâncias necessárias ao gerar o documento.'
        : 'Digite aqui (campo editável no documento)...';

      setEditorData(getCleanEditorHTML(editor.root));
      setFieldDialogOpen(false);
      setEditingMetadataId(null);
      toast.success('Metadado atualizado.');
    } else {
      const baseId = fieldId.trim() ? slugify(fieldId.trim()) : slugify(fieldTitle.trim());
      const uniqueId = generateUniqueId(baseId);

      let insertAt: number;
      let topicInsertPos = -1;
      if (associatedTopic !== 'none') {
        topicInsertPos = findTopicInsertPosition(editor, associatedTopic);
        if (topicInsertPos >= 0) {
          insertAt = topicInsertPos;
        } else {
          const range = editor.getSelection(true);
          insertAt = range ? range.index : editor.getLength();
        }
      } else {
        const range = editor.getSelection(true);
        insertAt = range ? range.index : editor.getLength();
      }

      const isAfterTopic = topicInsertPos >= 0;
      if (insertAt > 0 && !isAfterTopic) {
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
        topicId: associatedTopic !== 'none' ? associatedTopic : '',
        topicName,
        repeatable: fieldRepeatable,
        planningInstruction: fieldPlanningInstruction.trim(),
      }, 'user');
      editor.insertText(insertAt + 1, '\n', 'user');
      editor.setSelection(insertAt + 2, 0, 'user');

      setFieldDialogOpen(false);
      toast.success(`Metadado "${fieldTitle.trim()}" adicionado.`);
    }
  };

  return (
    <div className="sgid-model-editor-container h-full min-h-[70vh] flex flex-col bg-white">
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
          <div className="space-y-2 md:col-span-2" ref={specSearchRef}>
            <Label htmlFor="model-spec" className="text-sm font-semibold text-gray-700">Documento Spec * (obrigatório por regra constitucional)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                id="model-spec"
                type="text"
                className="pl-10 h-11 border-gray-200 focus:ring-blue-500 rounded-lg"
                placeholder="Clique para ver os Specs disponíveis ou digite para filtrar..."
                value={specSearchQuery}
                onChange={(e) => {
                  setSpecSearchQuery(e.target.value);
                  setSpecSearchOpen(true);
                }}
                onFocus={() => setSpecSearchOpen(true)}
                disabled={isLoading}
              />
              {showSpecResults && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  {specFilesLoading ? (
                    <div className="px-4 py-3 text-sm text-gray-500">Carregando Specs do bucket...</div>
                  ) : specFilteredResults.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">
                      {specFiles.length === 0
                        ? 'Nenhum Spec no bucket. Faça upload de arquivos .md no bucket "specs" do Supabase Storage.'
                        : 'Nenhum Spec encontrado para esta busca.'}
                    </div>
                  ) : (
                    specFilteredResults.map((f) => (
                      <button
                        key={f.path}
                        type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg text-sm"
                        onClick={() => {
                          setSpecPath(f.path);
                          setSpecSearchQuery(f.label);
                          setSpecSearchOpen(false);
                        }}
                      >
                        <span className="font-medium">{f.label}</span>
                        <span className="text-gray-500 text-xs ml-2">{f.path}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">Specs carregados do bucket Supabase Storage. A IA seguirá rigorosamente as diretrizes do Spec selecionado ao gerar documentos.</p>
          </div>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 min-h-0 overflow-hidden relative bg-gray-50 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 pb-28">
          <div
            className="max-w-[900px] mx-auto bg-white shadow-xl rounded-xl border border-gray-100 min-h-[1000px] relative z-10"
            onMouseDown={focusEditorOnDocumentClick}
          >
            <div className="sgid-quill-wrapper min-h-[600px] [&_.ql-container]:min-h-[600px] [&_.ql-editor]:min-h-[600px]">
              <ReactQuill
                ref={(instance) => {
                  quillRef.current = instance;
                }}
                theme="snow"
                value={editorData}
                onChange={(html) => {
                  // Armazena sempre sem os botões de ação (eles são adicionados via DOM
                  // pelo MutationObserver e não devem entrar no estado persistido).
                  const tmp = document.createElement('div');
                  tmp.innerHTML = html;
                  tmp.querySelectorAll(
                    '.sgid-metadata-edit-btn,.sgid-metadata-delete-btn,.sgid-topic-edit-btn,.sgid-topic-delete-btn'
                  ).forEach(el => el.remove());
                  setEditorData(tmp.innerHTML);
                }}
                useSemanticHTML={false}
                readOnly={isLoading}
                modules={{
                  toolbar: { container: `#${toolbarId}` },
                }}
              formats={[
                'size', 'bold', 'italic', 'underline', 'strike', 'blockquote',
                'list', 'indent', 'link', 'image', 'video',
                'color', 'background', 'align', 'metadataField', 'topic'
              ]}
                placeholder="Comece a criar seu modelo de documento..."
                className="h-full min-h-[600px] border-none"
              />
            </div>
          </div>
        </div>

        {/* Floating Toolbar Bottom */}
        <div className="sgid-floating-toolbar shadow-2xl" >

          <div id={toolbarId} className="ql-toolbar ql-snow flex flex-row items-center flex-nowrap border-none bg-transparent">
         
         
            <span className="ql-formats flex items-center flex-shrink-0">
              <Select
                value={fontSize}
                onValueChange={(value) => {
                  const editor = quillRef.current?.getEditor?.();
                  if (editor) {
                    const range = editor.getSelection();
                    const sizeValue = value === '__normal__' ? false : value;
                    if (range) {
                      editor.format('size', sizeValue, 'user');
                    }
                    setFontSize(value);
                  }
                }}
              >
                <SelectTrigger
                  className="h-8 w-[80px] min-w-[80px] max-w-[80px] border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 shrink-0 overflow-hidden"
                  title="Tamanho da fonte (px)"
                >
                  <SelectValue>{fontSize === '__normal__' ? 'Normal' : fontSize}</SelectValue>
                </SelectTrigger>
                <SelectContent side="top" className="max-h-[280px]">
                  <SelectItem value="__normal__">Normal</SelectItem>
                  {FONT_SIZES_PX.map((px) => (
                    <SelectItem key={px} value={px}>{px}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </span>

            
            <span className="ql-formats">
              <button type="button" className="ql-bold" />
              <button type="button" className="ql-italic" />
              <button type="button" className="ql-underline" />
              <button type="button" className="ql-strike" />
            </span>
            <span className="ql-formats flex items-center">
              <Popover open={colorPickerOpen} onOpenChange={(open) => {
                setColorPickerOpen(open);
                if (open) {
                  const editor = quillRef.current?.getEditor?.();
                  const range = editor?.getSelection?.(true);
                  if (editor && range) {
                    const format = editor.getFormat?.(range.index, range.length) || editor.getFormat?.();
                    const currentColor = typeof format?.color === 'string' ? format.color : null;
                    if (currentColor && /^#[0-9A-Fa-f]{6}$/.test(currentColor)) {
                      setFontColor(currentColor);
                    } else if (currentColor && /^#[0-9A-Fa-f]{3}$/.test(currentColor)) {
                      setFontColor(`#${currentColor[1]}${currentColor[1]}${currentColor[2]}${currentColor[2]}${currentColor[3]}${currentColor[3]}`);
                    } else if (currentColor && currentColor.startsWith('rgb')) {
                      setFontColor(rgbToHex(currentColor));
                    }
                  }
                }
              }}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="ql-color flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100"
                    title="Cor da fonte"
                    disabled={isLoading}
                  >
                    <Palette className="w-4 h-4 text-gray-600" />
                    <span className="sr-only">Cor da fonte</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-auto p-3">
                  <HexColorPicker
                    color={fontColor}
                    onChange={(hex) => {
                      setFontColor(hex);
                      const editor = quillRef.current?.getEditor?.();
                      const range = editor?.getSelection();
                      if (editor && range) {
                        editor.format('color', hex, 'user');
                      }
                    }}
                    style={{ width: 220, height: 180 }}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="text"
                      value={fontColor}
                      onChange={(e) => setFontColor(e.target.value)}
                      onBlur={() => {
                        if (/^#[0-9A-Fa-f]{6}$/.test(fontColor)) {
                          const editor = quillRef.current?.getEditor?.();
                          const range = editor?.getSelection();
                          if (editor && range) editor.format('color', fontColor, 'user');
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && /^#[0-9A-Fa-f]{6}$/.test(fontColor)) {
                          const editor = quillRef.current?.getEditor?.();
                          const range = editor?.getSelection();
                          if (editor && range) editor.format('color', fontColor, 'user');
                          setColorPickerOpen(false);
                        }
                      }}
                      className="flex-1 h-8 text-xs font-mono"
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </span>
            <span className="ql-formats ql-align-group">
              <select className="ql-align" title="Alinhamento" defaultValue="">
                <option value="">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
                <option value="justify">Justificar</option>
              </select>
            </span>
            <span className="ql-formats">
              <button type="button" className="ql-link" />
              <button type="button" className="ql-blockquote" />
              <button type="button" className="ql-clean" />
            </span>

            {/* Custom Buttons - flex-shrink-0 evita sobreposição */}
            <div className="sgid-toolbar-custom-buttons flex flex-row items-center gap-2 ml-4 border-l pl-4 border-gray-200 flex-shrink-0">
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
              <div className="w-px h-6 bg-gray-200 flex-shrink-0" aria-hidden="true" />
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

      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={(open) => {
        setDeleteConfirmOpen(open);
        if (!open) {
          pendingDeleteRef.current = null;
          setPendingDelete(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.type === 'topic' && 'Tem certeza que deseja excluir este tópico? Esta ação não pode ser desfeita.'}
              {pendingDelete?.type === 'metadata' && 'Tem certeza que deseja excluir este metadado? Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executePendingDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Metadado Dialog */}
      <Dialog open={fieldDialogOpen} onOpenChange={(open) => {
        setFieldDialogOpen(open);
        if (!open) setEditingMetadataId(null);
      }}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              {editingMetadataId ? 'Editar Metadado' : 'Criar Metadado'}
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

            {/* Campo Repetível */}
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <input
                type="checkbox"
                id="field-repeatable"
                checked={fieldRepeatable}
                onChange={(e) => setFieldRepeatable(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-blue-400 accent-blue-600 cursor-pointer"
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="field-repeatable" className="text-sm font-semibold text-blue-900 cursor-pointer select-none">
                  Campo Repetível
                </label>
                <p className="text-xs text-blue-700">
                  A IA decide quantas instâncias criar com base na base de conhecimento do projeto
                  (ex: Épicos, Features, Histórias de Usuário).
                </p>
              </div>
            </div>

            {fieldRepeatable && (
              <div className="space-y-2">
                <Label htmlFor="field-planning-instruction" className="text-sm font-medium text-blue-800">
                  Instrução de planejamento
                </Label>
                <Textarea
                  id="field-planning-instruction"
                  value={fieldPlanningInstruction}
                  onChange={(e) => setFieldPlanningInstruction(e.target.value)}
                  placeholder='Ex: "Liste todos os épicos/módulos do projeto identificados na documentação"'
                  className="rounded-lg min-h-[60px] border-blue-300 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500">Dica para a IA identificar quantos itens deste tipo existem no projeto.</p>
              </div>
            )}

            {!fieldRepeatable && (
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
            )}

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
              <Button variant="outline" onClick={() => { setFieldDialogOpen(false); setEditingMetadataId(null); }} className="rounded-lg px-6">
                Cancelar
              </Button>
              <Button onClick={saveMetadataField} className="rounded-lg px-6 bg-indigo-600 hover:bg-indigo-700">
                {editingMetadataId ? 'Salvar Alterações' : 'Inserir Metadado'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Tópico */}
      <Dialog open={topicDialogOpen} onOpenChange={(open) => {
        setTopicDialogOpen(open);
        if (!open) setEditingTopicId(null);
      }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-blue-600" />
              Editar Tópico
            </DialogTitle>
            <DialogDescription>
              Altere o título da seção.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="topic-name">Título do tópico</Label>
              <Input
                id="topic-name"
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                placeholder="Ex: Introdução"
                className="rounded-lg"
              />
            </div>
            <div className="pt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setTopicDialogOpen(false); setEditingTopicId(null); }} className="rounded-lg px-6">
                Cancelar
              </Button>
              <Button onClick={saveTopic} disabled={!topicName.trim()} className="rounded-lg px-6 bg-blue-600 hover:bg-blue-700">
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Tabela */}
    </div>
  );
}


