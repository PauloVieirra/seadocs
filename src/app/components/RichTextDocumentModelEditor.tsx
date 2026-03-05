import React, { useMemo, useRef, useState, useEffect } from 'react';
import ReactQuill, { Quill } from 'react-quill'; // ES6
import 'react-quill/dist/quill.snow.css'; // ES6
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DocumentModel, apiService } from '../../services/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Layout, Type, Save, X, PlusCircle, Database, Table2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';

let customBlotsRegistered = false;

/** Tamanhos de fonte em pixels (12 a 80) */
const FONT_SIZES_PX = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '40px', '48px', '56px', '64px', '72px', '80px'];

function ensureCustomBlotsRegistered() {
  if (customBlotsRegistered) return;

  const QuillAny: any = Quill;

  // Tamanhos de fonte customizados (12px a 80px) - sobrescrever whitelist
  const SizeClass = QuillAny.import('attributors/class/size');
  SizeClass.whitelist = FONT_SIZES_PX;
  QuillAny.register(SizeClass, true);
  const BlockEmbed = QuillAny.import('blots/block/embed');
  const Block = QuillAny.import('blots/block');

  // Blot para Metadado (Campo Editável)
  class MetadataFieldBlot extends BlockEmbed {
    static blotName = 'metadataField';
    static tagName = 'div';
    static className = 'sgid-metadata-field';

    static create(value: { id?: string; title?: string; help?: string; topicId?: string; topicName?: string }) {
      const node: HTMLElement = super.create();
      const id = value?.id || `field-${Date.now()}`;
      const title = value?.title || 'Campo';
      const help = value?.help || '';
      const topicId = value?.topicId || '';
      const topicName = value?.topicName || (topicId.startsWith('cell:') ? `Célula ${topicId.split(':').pop()}` : topicId);

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

  // Blot para Tabela (células e colunas identificáveis)
  class TableBlot extends BlockEmbed {
    static blotName = 'tableBlock';
    static tagName = 'div';
    static className = 'sgid-table';

    static create(value: { rows?: number; cols?: number; tableId?: string; borderColor?: string; rowHeight?: number; colWidth?: number }) {
      const node: HTMLElement = super.create();
      const rows = Math.max(1, Math.min(20, value?.rows ?? 3));
      const cols = Math.max(1, Math.min(10, value?.cols ?? 4));
      const tableId = value?.tableId || `table-${Date.now()}`;
      const borderColor = value?.borderColor || '#e2e8f0';
      const rowHeight = Math.max(20, Math.min(200, value?.rowHeight ?? 40));
      const colWidth = Math.max(40, Math.min(500, value?.colWidth ?? 120));

      node.setAttribute('contenteditable', 'false');
      node.setAttribute('data-table-id', tableId);
      node.setAttribute('data-rows', String(rows));
      node.setAttribute('data-cols', String(cols));
      node.setAttribute('data-border-color', borderColor);
      node.setAttribute('data-row-height', String(rowHeight));
      node.setAttribute('data-col-width', String(colWidth));

      node.style.setProperty('--sgid-border-color', borderColor);
      node.style.setProperty('--sgid-row-height', `${rowHeight}px`);
      node.style.setProperty('--sgid-col-width', `${colWidth}px`);

      const table = document.createElement('table');
      table.className = 'sgid-table-grid';
      const tbody = document.createElement('tbody');

      const colLetters = 'ABCDEFGHIJ'.slice(0, cols);
      for (let r = 0; r < rows; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < cols; c++) {
          const td = document.createElement('td');
          const cellId = `${colLetters[c]}${r + 1}`;
          td.className = 'sgid-table-cell';
          td.setAttribute('data-cell-id', cellId);
          td.setAttribute('data-row', String(r));
          td.setAttribute('data-col', String(c));
          td.setAttribute('contenteditable', 'true');
          td.style.height = `${rowHeight}px`;
          td.style.minWidth = `${colWidth}px`;
          td.style.borderColor = borderColor;
          td.innerHTML = '';
          td.setAttribute('data-placeholder', 'Digite aqui...');
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      node.appendChild(table);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'sgid-table-edit-btn';
      editBtn.setAttribute('data-table-id', tableId);
      editBtn.setAttribute('title', 'Editar tabela');
      editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
      node.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'sgid-table-delete-btn';
      deleteBtn.setAttribute('data-table-id', tableId);
      deleteBtn.setAttribute('title', 'Excluir tabela');
      deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
      node.appendChild(deleteBtn);

      return node;
    }

    static value(node: HTMLElement) {
      const rows = parseInt(node.getAttribute('data-rows') || '3', 10);
      const cols = parseInt(node.getAttribute('data-cols') || '4', 10);
      const tableId = node.getAttribute('data-table-id') || '';
      const borderColor = node.getAttribute('data-border-color') || '#e2e8f0';
      const rowHeight = parseInt(node.getAttribute('data-row-height') || '40', 10);
      const colWidth = parseInt(node.getAttribute('data-col-width') || '120', 10);
      return { rows, cols, tableId, borderColor, rowHeight, colWidth };
    }
  }

  QuillAny.register(MetadataFieldBlot);
  QuillAny.register(TopicBlot);
  QuillAny.register(TableBlot);
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
  onSave: (name: string, type: string, templateContent: string, isDraft?: boolean, aiGuidance?: string) => Promise<void>;
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
  const pendingDeleteRef = useRef<{ type: 'topic' | 'metadata' | 'table'; topicId?: string; fieldId?: string; tableId?: string } | null>(null);
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.type || '');
  const [editorData, setEditorData] = useState(initialData?.templateContent || '');

  // Metadado State
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingMetadataId, setEditingMetadataId] = useState<string | null>(null);
  const [fieldTitle, setFieldTitle] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [fieldHelp, setFieldHelp] = useState('');
  const [associatedTopic, setAssociatedTopic] = useState<string>('none');

  // Tópico State
  const [existingTopics, setExistingTopics] = useState<{id: string, name: string}[]>([]);
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicName, setTopicName] = useState('');

  // Tamanho de fonte atual (para o controle customizado): px ou '__normal__'
  const [fontSize, setFontSize] = useState<string>('__normal__');

  // Tabela
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(4);
  const [tableBorderColor, setTableBorderColor] = useState('#e2e8f0');
  const [tableRowHeight, setTableRowHeight] = useState(40);
  const [tableColWidth, setTableColWidth] = useState(120);

  // Confirmação de exclusão de elementos
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    type: 'topic' | 'metadata' | 'table';
    topicId?: string;
    fieldId?: string;
    tableId?: string;
  } | null>(null);

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

  // Handler para botões editar e excluir (tabela, tópico, metadado) - event delegation
  useEffect(() => {
    const editor = quillRef.current?.getEditor?.();
    if (!editor?.root) return;
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
          setTopicName(topicEl.innerText.trim() || '');
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
          setAssociatedTopic(metaEl.getAttribute('data-topic-id') || 'none');
          setEditingMetadataId(metaEl.getAttribute('data-field-id') || '');
          setFieldDialogOpen(true);
        }
        return;
      }

      // Tabela - editar e excluir
      const tableEditBtn = target.closest('.sgid-table-edit-btn');
      const tableDeleteBtn = target.closest('.sgid-table-delete-btn');
      const tableBtn = tableEditBtn || tableDeleteBtn;
      if (tableBtn) {
        e.preventDefault();
        e.stopPropagation();
        const tableEl = tableBtn.closest('.sgid-table') as HTMLElement;
        if (!tableEl) return;

        if (tableDeleteBtn) {
          const tableId = tableEl.getAttribute('data-table-id') || '';
          pendingDeleteRef.current = { type: 'table', tableId };
          setPendingDelete({ type: 'table', tableId });
          setDeleteConfirmOpen(true);
          return;
        }

        if (tableEditBtn) {
          const tableId = tableBtn.getAttribute('data-table-id');
          if (!tableId) return;
          setTableRows(parseInt(tableEl.getAttribute('data-rows') || '3', 10));
          setTableCols(parseInt(tableEl.getAttribute('data-cols') || '4', 10));
          setTableBorderColor(tableEl.getAttribute('data-border-color') || '#e2e8f0');
          setTableRowHeight(parseInt(tableEl.getAttribute('data-row-height') || '40', 10));
          setTableColWidth(parseInt(tableEl.getAttribute('data-col-width') || '120', 10));
          setEditingTableId(tableId);
          setTableDialogOpen(true);
        }
      }
    };
    const root = editor.root;
    root.addEventListener('click', handleElementButtonClick, true);
    return () => root.removeEventListener('click', handleElementButtonClick, true);
  }, [editorData]);

  // Adicionar botões editar/excluir em tópicos e metadados
  useEffect(() => {
    const editor = quillRef.current?.getEditor?.();
    if (!editor?.root) return;

    const addTopicButtons = (el: HTMLElement) => {
      const topicId = el.getAttribute('data-topic-id');
      if (!topicId || el.querySelector('.sgid-topic-edit-btn')) return;
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'sgid-topic-edit-btn';
      editBtn.setAttribute('data-topic-id', topicId);
      editBtn.setAttribute('title', 'Editar tópico');
      editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
      el.appendChild(editBtn);
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'sgid-topic-delete-btn';
      deleteBtn.setAttribute('data-topic-id', topicId);
      deleteBtn.setAttribute('title', 'Excluir tópico');
      deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
      el.appendChild(deleteBtn);
    };

    const addMetadataButtons = (el: HTMLElement) => {
      const fieldId = el.getAttribute('data-field-id');
      if (!fieldId || el.querySelector('.sgid-metadata-edit-btn')) return;
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'sgid-metadata-edit-btn';
      editBtn.setAttribute('data-field-id', fieldId);
      editBtn.setAttribute('title', 'Editar metadado');
      editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
      el.appendChild(editBtn);
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'sgid-metadata-delete-btn';
      deleteBtn.setAttribute('data-field-id', fieldId);
      deleteBtn.setAttribute('title', 'Excluir metadado');
      deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
      el.appendChild(deleteBtn);
    };

    editor.root.querySelectorAll('.sgid-topic').forEach((el) => addTopicButtons(el as HTMLElement));
    editor.root.querySelectorAll('.sgid-metadata-field').forEach((el) => addMetadataButtons(el as HTMLElement));
  }, [editorData]);

  // Aplicar estilos e botão editar em tabelas ao carregar conteúdo (ex: após reload)
  useEffect(() => {
    if (!editorData.includes('sgid-table')) return;
    const editor = quillRef.current?.getEditor?.();
    if (!editor?.root) return;
    editor.root.querySelectorAll('.sgid-table').forEach((el) => {
      const node = el as HTMLElement;
      const borderColor = node.getAttribute('data-border-color') || '#e2e8f0';
      const rowHeight = node.getAttribute('data-row-height') || '40';
      const colWidth = node.getAttribute('data-col-width') || '120';
      const tableId = node.getAttribute('data-table-id') || '';
      node.style.setProperty('--sgid-border-color', borderColor);
      node.style.setProperty('--sgid-row-height', `${rowHeight}px`);
      node.style.setProperty('--sgid-col-width', `${colWidth}px`);
      node.querySelectorAll('.sgid-table-cell').forEach((td) => {
        const cell = td as HTMLElement;
        cell.style.borderColor = borderColor;
        cell.style.height = `${rowHeight}px`;
        cell.style.minWidth = `${colWidth}px`;
      });
      if (!node.querySelector('.sgid-table-edit-btn') && tableId) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'sgid-table-edit-btn';
        editBtn.setAttribute('data-table-id', tableId);
        editBtn.setAttribute('title', 'Editar tabela');
        editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
        node.appendChild(editBtn);
      }
      if (!node.querySelector('.sgid-table-delete-btn') && tableId) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'sgid-table-delete-btn';
        deleteBtn.setAttribute('data-table-id', tableId);
        deleteBtn.setAttribute('title', 'Excluir tabela');
        deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
        node.appendChild(deleteBtn);
      }
    });
  }, [editorData]);

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
          isDraft: true
        }).then(() => onDraftStatusChange?.(true, true));
      }
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [name, type, editorData, isEditMode, isLoading, onDraftStatusChange, initialData?.aiGuidance]);

  // Extrair tópicos existentes no documento para associar metadados (inclui blocos Tópico e células de tabela)
  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(editorData, 'text/html');
    const topics: { id: string; name: string }[] = [];

    // Tópicos (blocos sgid-topic)
    doc.querySelectorAll('.sgid-topic').forEach((node: Element) => {
      const id = node.getAttribute('data-topic-id');
      if (id) {
        topics.push({
          id,
          name: (node as HTMLElement).innerText.trim().substring(0, 30) || 'Tópico sem nome',
        });
      }
    });

    // Células de tabela (cada célula é um tópico)
    doc.querySelectorAll('.sgid-table .sgid-table-cell').forEach((node: Element) => {
      const cellId = node.getAttribute('data-cell-id');
      const table = node.closest('.sgid-table');
      const tableId = table?.getAttribute('data-table-id');
      if (cellId && tableId) {
        const topicId = `cell:${tableId}:${cellId}`;
        topics.push({
          id: topicId,
          name: `Célula ${cellId}`,
        });
      }
    });

    setExistingTopics(topics);
  }, [editorData]);

  const toolbarId = useMemo(() => `model-toolbar-${Math.random().toString(16).slice(2)}`, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !type.trim() || !editorData.trim()) {
      toast.error('Por favor, preencha todos os campos obrigatórios e o conteúdo do template.');
      return;
    }
    await onSave(name, type, editorData, initialData?.isDraft ?? true, initialData?.aiGuidance ?? '');
  };

  const openFieldDialog = () => {
    setEditingMetadataId(null);
    setFieldTitle('');
    setFieldId('');
    setFieldHelp('');
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
    topicEl.innerHTML = `<p>${topicName.trim()}</p>`;
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

    setEditorData(editor.root.innerHTML);
    setTopicDialogOpen(false);
    setEditingTopicId(null);
    setTopicName('');
    toast.success('Tópico atualizado.');
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

  const focusEditorOnDocumentClick = () => {
    if (isLoading) return;
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
    } else if (pending.type === 'table' && pending.tableId) {
      const tableEl = editor.root.querySelector(`.sgid-table[data-table-id="${pending.tableId}"]`) as HTMLElement;
      if (tableEl) {
        tableEl.remove();
        toast.success('Tabela excluída.');
      }
    }
    setEditorData(editor.root.innerHTML);
    pendingDeleteRef.current = null;
    setPendingDelete(null);
    setDeleteConfirmOpen(false);
  };

  const saveTable = () => {
    if (isLoading) return;
    const editor = quillRef.current?.getEditor?.();
    if (!editor?.root) return;

    if (editingTableId) {
      const tableEl = editor.root.querySelector(`.sgid-table[data-table-id="${editingTableId}"]`) as HTMLElement;
      if (!tableEl) {
        toast.error('Tabela não encontrada.');
        setTableDialogOpen(false);
        setEditingTableId(null);
        return;
      }
      const cellContent: Record<string, string> = {};
      tableEl.querySelectorAll('.sgid-table-cell').forEach((td) => {
        const cellId = td.getAttribute('data-cell-id');
        if (cellId) cellContent[cellId] = (td as HTMLElement).innerHTML;
      });

      const colLetters = 'ABCDEFGHIJ'.slice(0, tableCols);
      let tbodyHtml = '';
      for (let r = 0; r < tableRows; r++) {
        let rowHtml = '<tr>';
        for (let c = 0; c < tableCols; c++) {
          const cellId = `${colLetters[c]}${r + 1}`;
          const content = cellContent[cellId] || '';
          rowHtml += `<td class="sgid-table-cell" data-cell-id="${cellId}" data-row="${r}" data-col="${c}" contenteditable="true" data-placeholder="Digite aqui..." style="height:${tableRowHeight}px;min-width:${tableColWidth}px;border-color:${tableBorderColor}">${content}</td>`;
        }
        rowHtml += '</tr>';
        tbodyHtml += rowHtml;
      }

      tableEl.setAttribute('data-rows', String(tableRows));
      tableEl.setAttribute('data-cols', String(tableCols));
      tableEl.setAttribute('data-border-color', tableBorderColor);
      tableEl.setAttribute('data-row-height', String(tableRowHeight));
      tableEl.setAttribute('data-col-width', String(tableColWidth));
      tableEl.style.setProperty('--sgid-border-color', tableBorderColor);
      tableEl.style.setProperty('--sgid-row-height', `${tableRowHeight}px`);
      tableEl.style.setProperty('--sgid-col-width', `${tableColWidth}px`);

      const grid = tableEl.querySelector('.sgid-table-grid');
      if (grid) {
        const tbody = grid.querySelector('tbody');
        if (tbody) {
          tbody.innerHTML = tbodyHtml;
          tbody.querySelectorAll('.sgid-table-cell').forEach((td) => {
            const cell = td as HTMLElement;
            cell.style.borderColor = tableBorderColor;
            cell.style.height = `${tableRowHeight}px`;
            cell.style.minWidth = `${tableColWidth}px`;
          });
        }
      }

      setEditorData(editor.root.innerHTML);
      setTableDialogOpen(false);
      setEditingTableId(null);
      toast.success('Tabela atualizada.');
    } else {
      const range = editor.getSelection(true);
      let insertAt = range ? range.index : editor.getLength();
      if (insertAt > 0) {
        const prevChar = editor.getText(insertAt - 1, 1);
        if (prevChar && prevChar !== '\n') {
          editor.insertText(insertAt, '\n', 'user');
          insertAt += 1;
        }
      }
      editor.insertEmbed(insertAt, 'tableBlock', {
        rows: tableRows,
        cols: tableCols,
        tableId: `table-${Date.now()}`,
        borderColor: tableBorderColor,
        rowHeight: tableRowHeight,
        colWidth: tableColWidth,
      }, 'user');
      editor.insertText(insertAt + 1, '\n', 'user');
      editor.setSelection(insertAt + 2, 0, 'user');
      setTableDialogOpen(false);
      toast.success(`Tabela ${tableRows}x${tableCols} inserida.`);
    }
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

      const titleEl = metaEl.querySelector('.sgid-metadata-field__title');
      if (titleEl) {
        titleEl.innerHTML = fieldTitle.trim();
        if (associatedTopic !== 'none' && topicName) {
          const tag = document.createElement('span');
          tag.className = 'text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2';
          tag.innerText = `Tópico: ${topicName}`;
          titleEl.appendChild(tag);
        }
      }
      const helpEl = metaEl.querySelector('.sgid-metadata-field__help');
      if (helpEl) (helpEl as HTMLElement).innerText = fieldHelp.trim();

      setEditorData(editor.root.innerHTML);
      setFieldDialogOpen(false);
      setEditingMetadataId(null);
      toast.success('Metadado atualizado.');
    } else {
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
        topicId: associatedTopic !== 'none' ? associatedTopic : '',
        topicName,
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
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 min-h-0 overflow-hidden relative bg-gray-50 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto p-8 pb-28">
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
                onChange={setEditorData}
                readOnly={isLoading}
                modules={{
                  toolbar: {
                    container: `#${toolbarId}`,
                  },
                }}
              formats={[
                'size', 'bold', 'italic', 'underline', 'strike', 'blockquote',
                'list', 'bullet', 'indent', 'link', 'image', 'video',
                'color', 'background', 'align', 'metadataField', 'topic', 'tableBlock'
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
                onClick={() => { setEditingTableId(null); setTableDialogOpen(true); }}
                disabled={isLoading}
                title="Inserir Tabela (células identificadas por coluna e linha)"
              >
                <Table2 className="w-4 h-4" />
                Tabela
              </button>
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
              {pendingDelete?.type === 'table' && 'Tem certeza que deseja excluir esta tabela? Esta ação não pode ser desfeita.'}
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
      <Dialog open={tableDialogOpen} onOpenChange={(open) => {
        setTableDialogOpen(open);
        if (!open) setEditingTableId(null);
      }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Table2 className="w-5 h-5 text-blue-600" />
              {editingTableId ? 'Editar Tabela' : 'Inserir Tabela'}
            </DialogTitle>
            <DialogDescription>
              Células identificadas por coluna (A, B, C...) e linha (1, 2, 3...).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="table-rows">Linhas</Label>
                <Input
                  id="table-rows"
                  type="number"
                  min={1}
                  max={20}
                  value={tableRows}
                  onChange={(e) => setTableRows(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-cols">Colunas</Label>
                <Input
                  id="table-cols"
                  type="number"
                  min={1}
                  max={10}
                  value={tableCols}
                  onChange={(e) => setTableCols(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
                  className="rounded-lg"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="table-border-color">Cor das bordas</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="table-border-color"
                  type="color"
                  value={tableBorderColor}
                  onChange={(e) => setTableBorderColor(e.target.value)}
                  className="w-14 h-10 p-1 cursor-pointer rounded-lg"
                />
                <Input
                  type="text"
                  value={tableBorderColor}
                  onChange={(e) => setTableBorderColor(e.target.value)}
                  className="flex-1 rounded-lg font-mono text-sm"
                  placeholder="#e2e8f0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="table-row-height">Altura da linha (px)</Label>
                <Input
                  id="table-row-height"
                  type="number"
                  min={20}
                  max={200}
                  value={tableRowHeight}
                  onChange={(e) => setTableRowHeight(Math.max(20, Math.min(200, parseInt(e.target.value, 10) || 40)))}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-col-width">Largura da coluna (px)</Label>
                <Input
                  id="table-col-width"
                  type="number"
                  min={40}
                  max={500}
                  value={tableColWidth}
                  onChange={(e) => setTableColWidth(Math.max(40, Math.min(500, parseInt(e.target.value, 10) || 120)))}
                  className="rounded-lg"
                />
              </div>
            </div>
            <div className="pt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setTableDialogOpen(false); setEditingTableId(null); }} className="rounded-lg px-6">
                Cancelar
              </Button>
              <Button onClick={saveTable} className="rounded-lg px-6 bg-blue-600 hover:bg-blue-700">
                {editingTableId ? 'Salvar Alterações' : 'Inserir Tabela'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


