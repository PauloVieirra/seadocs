import React, { useMemo, useRef, useState, useEffect } from 'react';
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { ensureCustomBlotsRegistered } from '../../lib/quill-blots';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DocumentModel, apiService } from '../../services/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Type, Save, X, PlusCircle, Database, Palette, Plus, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { HexColorPicker } from 'react-colorful';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { CreateDocumentTypeDialog } from './CreateDocumentTypeDialog';
import { listAllDocuments, type BucketDocument } from '../../services/ai-storage-service';

ensureCustomBlotsRegistered();

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

function slugify(input: string) {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Retorna o fieldId do próximo bloco de metadado após o dado, na ordem do DOM, ou null se for o último */
function getNextMetadataFieldId(root: HTMLElement, afterFieldId: string): string | null {
  const blocks = Array.from(root.querySelectorAll('.sgid-metadata-field'));
  const idx = blocks.findIndex((b) => b.getAttribute('data-field-id') === afterFieldId);
  if (idx < 0 || idx >= blocks.length - 1) return null;
  return (blocks[idx + 1] as HTMLElement).getAttribute('data-field-id');
}

/** Retorna o fieldId do primeiro metadado após o bloco dado (na ordem do DOM), ou null */
function getNextMetadataFieldIdAfterBlock(root: HTMLElement, blockEl: HTMLElement): string | null {
  const blocks = Array.from(root.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
  const idx = blocks.indexOf(blockEl);
  if (idx < 0) return null;
  for (let i = idx + 1; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.classList.contains('sgid-metadata-field')) return b.getAttribute('data-field-id');
  }
  return null;
}

/** Retorna o fieldId do primeiro metadado antes do bloco dado (na ordem do DOM), ou do primeiro metadado do doc se este for o primeiro bloco */
function getPreviousMetadataFieldIdBeforeBlock(root: HTMLElement, blockEl: HTMLElement): string | null {
  const blocks = Array.from(root.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
  const idx = blocks.indexOf(blockEl);
  if (idx < 0) return null;
  for (let i = idx - 1; i >= 0; i--) {
    const b = blocks[i];
    if (b.classList.contains('sgid-metadata-field')) return b.getAttribute('data-field-id');
  }
  return getFirstMetadataFieldId(root);
}

/** Retorna o fieldId do primeiro metadado no documento */
function getFirstMetadataFieldId(root: HTMLElement): string | null {
  const first = root.querySelector('.sgid-metadata-field');
  return first ? (first as HTMLElement).getAttribute('data-field-id') : null;
}

/** Retorna o elemento "bloco" que é filho direto do .ql-editor, ou o próprio el se for filho */
function getEditorBlockElement(el: HTMLElement, root: HTMLElement): HTMLElement | null {
  if (!el || !root.contains(el)) return null;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    if (node.parentElement === root) return node;
    node = node.parentElement;
  }
  return null;
}

/** Retorna todos os blocos do editor na ordem do DOM (filhos diretos de .ql-editor) */
function getEditorBlocksInOrder(root: HTMLElement): HTMLElement[] {
  return Array.from(root.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
}

/** Move bloco de metadado no editor via API Quill (delta) para garantir consistência */
function moveMetadataBlockInDelta(
  editor: { getContents: () => { ops?: unknown[] }; setContents: (delta: unknown) => void },
  fromFieldId: string,
  insertBeforeFieldId: string | null
): boolean {
  const delta = editor.getContents();
  const ops = (delta?.ops ? [...delta.ops] : []) as Array<{ insert?: string | Record<string, unknown>; retain?: number; attributes?: Record<string, unknown> }>;
  let fromOpIdx = -1;
  let toOpIdx = -1;
  const getMetadataIdFromOp = (op: { insert?: unknown }) => {
    const ins = op.insert;
    if (!ins || typeof ins !== 'object') return null;
    const obj = ins as Record<string, unknown>;
    const mf = obj.metadataField ?? obj.metadatafield;
    if (!mf) return null;
    const val = mf as { id?: string } | string;
    return typeof val === 'object' ? val?.id ?? null : (typeof val === 'string' ? val : null);
  };
  for (let i = 0; i < ops.length; i++) {
    const id = getMetadataIdFromOp(ops[i]);
    if (id === fromFieldId) fromOpIdx = i;
    if (id === insertBeforeFieldId) toOpIdx = i;
  }
  if (fromOpIdx < 0) return false;
  if (insertBeforeFieldId && fromFieldId === insertBeforeFieldId) return false; /* mesma posição */
  const insertIdx = insertBeforeFieldId ? (toOpIdx >= 0 ? toOpIdx : fromOpIdx) : ops.length;
  const [movedOp] = ops.splice(fromOpIdx, 1);
  const newInsertIdx = insertIdx > fromOpIdx ? insertIdx - 1 : insertIdx;
  ops.splice(newInsertIdx, 0, movedOp);
  editor.setContents({ ops });
  return true;
}

/** Retorna o índice onde inserir o metadado (logo após o metadado pai ou tópico) ou -1 se não encontrar */
function findParentInsertPosition(editor: { getContents: () => { ops?: unknown[] }; root?: HTMLElement }, parentId: string): number {
  const delta = editor.getContents();
  if (!delta?.ops) return -1;
  let index = 0;
  const getMetadataId = (op: { insert?: unknown }) => {
    const ins = op.insert;
    if (!ins || typeof ins !== 'object') return null;
    const obj = ins as Record<string, unknown>;
    const mf = obj.metadataField ?? obj.metadatafield;
    if (!mf) return null;
    const val = mf as { id?: string } | string;
    return typeof val === 'object' ? val?.id ?? null : (typeof val === 'string' ? val : null);
  };
  for (const op of delta.ops) {
    const o = op as { insert?: string | Record<string, unknown>; retain?: number };
    if (typeof o.insert === 'object' && o.insert !== null) {
      const metaId = getMetadataId(o);
      if (metaId === parentId) return index + 1;
      if ('topic' in o.insert) {
        const topicInsert = o.insert as { topic?: { id?: string } | string };
        const topicVal = topicInsert.topic;
        const id = typeof topicVal === 'object' ? topicVal?.id : topicVal;
        if (id === parentId) return index + 1;
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
  onSave: (name: string, type: string, templateContent: string, isDraft?: boolean, aiGuidance?: string, specPath?: string, skillPath?: string, exampleDocumentPath?: string) => Promise<void>;
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
  const syncEditorDataRef = useRef<(() => void) | null>(null);
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.type || '');
  const [editorData, setEditorData] = useState(initialData?.templateContent || '');
  const [specPath, setSpecPath] = useState(initialData?.specPath || '');
  const [skillPath, setSkillPath] = useState(initialData?.skillPath || '');
  const [exampleDocumentPath, setExampleDocumentPath] = useState(initialData?.exampleDocumentPath || '');
  const [specSearchQuery, setSpecSearchQuery] = useState('');
  const [skillSearchQuery, setSkillSearchQuery] = useState('');
  const [exampleSearchQuery, setExampleSearchQuery] = useState('');
  const [specsAndSkills, setSpecsAndSkills] = useState<BucketDocument[]>([]);
  const [specsSkillsLoading, setSpecsSkillsLoading] = useState(true);
  const [specSearchOpen, setSpecSearchOpen] = useState(false);
  const [skillSearchOpen, setSkillSearchOpen] = useState(false);
  const [exampleSearchOpen, setExampleSearchOpen] = useState(false);
  const specSearchRef = useRef<HTMLDivElement>(null);
  const skillSearchRef = useRef<HTMLDivElement>(null);
  const exampleSearchRef = useRef<HTMLDivElement>(null);

  // Tipos de documento (select + cadastro)
  const [documentTypes, setDocumentTypes] = useState<{ id: string; name: string }[]>([]);
  const [documentTypesLoading, setDocumentTypesLoading] = useState(true);
  const [createTypeDialogOpen, setCreateTypeDialogOpen] = useState(false);

  // Metadado State
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingMetadataId, setEditingMetadataId] = useState<string | null>(null);
  const [fieldTitle, setFieldTitle] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [fieldHelp, setFieldHelp] = useState('');
  const [fieldRepeatable, setFieldRepeatable] = useState(false);
  const [fieldPlanningInstruction, setFieldPlanningInstruction] = useState('');
  const [associatedParentField, setAssociatedParentField] = useState<string>('none');

  // Metadados existentes para associação pai-filho (e tópicos legados)
  const [existingMetadataFields, setExistingMetadataFields] = useState<{id: string, name: string}[]>([]);
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
      setSkillPath(initialData.skillPath || '');
      setExampleDocumentPath(initialData.exampleDocumentPath || '');
      setSpecSearchQuery(initialData.specPath ? initialData.specPath.split('/').pop()?.replace('.md', '') || '' : '');
      setSkillSearchQuery(initialData.skillPath ? initialData.skillPath.split('/').pop()?.replace('.md', '') || '' : '');
      setExampleSearchQuery(initialData.exampleDocumentPath ? initialData.exampleDocumentPath.split('/').pop()?.replace(/\.(md|docx)$/i, '') || '' : '');
    }
  }, [initialData]);

  useEffect(() => {
    listAllDocuments().then(setSpecsAndSkills).catch(() => []).finally(() => setSpecsSkillsLoading(false));
  }, []);

  const specs = specsAndSkills.filter(d => d.type === 'specs');
  const skills = specsAndSkills.filter(d => d.type === 'skill');
  const examples = specsAndSkills.filter(d => d.type === 'examples');
  const specFiltered = specSearchQuery.trim()
    ? specs.filter(s => s.name.toLowerCase().includes(specSearchQuery.toLowerCase()) || s.path.toLowerCase().includes(specSearchQuery.toLowerCase()))
    : specs;
  const skillFiltered = skillSearchQuery.trim()
    ? skills.filter(s => s.name.toLowerCase().includes(skillSearchQuery.toLowerCase()) || s.path.toLowerCase().includes(skillSearchQuery.toLowerCase()))
    : skills;
  const exampleFiltered = exampleSearchQuery.trim()
    ? examples.filter(s => s.name.toLowerCase().includes(exampleSearchQuery.toLowerCase()) || s.path.toLowerCase().includes(exampleSearchQuery.toLowerCase()))
    : examples;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (specSearchRef.current && !specSearchRef.current.contains(e.target as Node)) setSpecSearchOpen(false);
      if (skillSearchRef.current && !skillSearchRef.current.contains(e.target as Node)) setSkillSearchOpen(false);
      if (exampleSearchRef.current && !exampleSearchRef.current.contains(e.target as Node)) setExampleSearchOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Carregar tipos de documento
  const loadDocumentTypes = React.useCallback(async () => {
    setDocumentTypesLoading(true);
    const types = await apiService.listDocumentTypes();
    setDocumentTypes(types);
    setDocumentTypesLoading(false);
  }, []);
  useEffect(() => {
    loadDocumentTypes();
  }, [loadDocumentTypes]);

  // Fechar dropdown ao clicar fora
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
          setAssociatedParentField(metaEl.getAttribute('data-parent-field-id') || metaEl.getAttribute('data-topic-id') || 'none');
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
    let cleanupPointerListeners: (() => void) | null = null;

    const setup = () => {
      const editor = quillRef.current?.getEditor?.();
      if (!editor?.root) return false;

      const SVG_EDIT = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
      const SVG_DELETE = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
      const SVG_DRAG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';

      let draggedMetadataFieldId: string | null = null;
      let pointerDragState: { fieldId: string; startX: number; startY: number; active: boolean } | null = null;
      const DRAG_THRESHOLD_PX = 5;

      const clearAllDropIndicators = () => {
        editor.root.querySelectorAll('.sgid-drag-over-above, .sgid-drag-over-below').forEach((n) => {
          n.classList.remove('sgid-drag-over-above', 'sgid-drag-over-below');
        });
      };

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

        // Handle de arrastar (tracker) — usa pointer events em vez de HTML5 drag (evita conflito com contenteditable)
        const header = el.querySelector('.sgid-metadata-field__header') as HTMLElement;
        if (header && !header.querySelector('.sgid-metadata-drag-handle')) {
          const dragHandle = document.createElement('div');
          dragHandle.className = 'sgid-metadata-drag-handle';
          dragHandle.setAttribute('data-field-id', fieldId);
          dragHandle.setAttribute('title', 'Arrastar para reordenar');
          dragHandle.innerHTML = SVG_DRAG;
          header.insertBefore(dragHandle, header.firstChild);

          dragHandle.addEventListener('mousedown', (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            pointerDragState = { fieldId, startX: e.clientX, startY: e.clientY, active: false };
          });
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

      // Pointer-based drag: mousemove/mouseup no document para funcionar com contenteditable
      const performDrop = (srcId: string, clientX: number, clientY: number) => {
        const elAtPoint = document.elementFromPoint(clientX, clientY);
        if (!elAtPoint) return;
        const block = getEditorBlockElement(elAtPoint as HTMLElement, editor.root);
        if (!block) return;
        const rect = block.getBoundingClientRect();
        const insertAbove = clientY < rect.top + rect.height / 2;
        let targetFieldId: string | null;
        if (block.classList.contains('sgid-metadata-field')) {
          targetFieldId = insertAbove ? block.getAttribute('data-field-id') : getNextMetadataFieldId(editor.root, block.getAttribute('data-field-id') || '');
        } else {
          targetFieldId = insertAbove ? getPreviousMetadataFieldIdBeforeBlock(editor.root, block) : getNextMetadataFieldIdAfterBlock(editor.root, block);
        }
        if (moveMetadataBlockInDelta(editor, srcId, targetFieldId)) {
          syncEditorDataRef.current?.();
        } else {
          const srcEl = editor.root.querySelector(`.sgid-metadata-field[data-field-id="${srcId}"]`) as HTMLElement;
          if (srcEl) {
            let insertBeforeEl: HTMLElement | null = null;
            if (targetFieldId) {
              insertBeforeEl = editor.root.querySelector(`.sgid-metadata-field[data-field-id="${targetFieldId}"]`) as HTMLElement;
            }
            const blockToMove = getEditorBlockElement(srcEl, editor.root);
            if (blockToMove?.parentElement) {
              if (insertBeforeEl) {
                const targetBlock = getEditorBlockElement(insertBeforeEl, editor.root);
                if (targetBlock) blockToMove.parentElement.insertBefore(blockToMove, targetBlock);
              } else {
                blockToMove.parentElement.appendChild(blockToMove);
              }
              syncEditorDataRef.current?.();
            }
          }
        }
      };

      const onPointerMove = (e: MouseEvent) => {
        if (!pointerDragState) return;
        const dx = e.clientX - pointerDragState.startX;
        const dy = e.clientY - pointerDragState.startY;
        if (!pointerDragState.active && (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX)) {
          pointerDragState.active = true;
          draggedMetadataFieldId = pointerDragState.fieldId;
          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';
          const metaEl = editor.root.querySelector(`.sgid-metadata-field[data-field-id="${pointerDragState.fieldId}"]`) as HTMLElement;
          if (metaEl) metaEl.classList.add('sgid-metadata-dragging');
        }
        if (pointerDragState.active) {
          clearAllDropIndicators();
          const elAtPoint = document.elementFromPoint(e.clientX, e.clientY);
          const block = elAtPoint ? getEditorBlockElement(elAtPoint as HTMLElement, editor.root) : null;
          if (block && block.getAttribute?.('data-field-id') !== pointerDragState.fieldId) {
            const rect = block.getBoundingClientRect();
            block.classList.add(e.clientY < rect.top + rect.height / 2 ? 'sgid-drag-over-above' : 'sgid-drag-over-below');
          }
        }
      };

      const onPointerUp = (e: MouseEvent) => {
        if (!pointerDragState) return;
        if (pointerDragState.active) {
          performDrop(pointerDragState.fieldId, e.clientX, e.clientY);
          const metaEl = editor.root.querySelector(`.sgid-metadata-field[data-field-id="${pointerDragState.fieldId}"]`) as HTMLElement;
          if (metaEl) metaEl.classList.remove('sgid-metadata-dragging');
        }
        clearAllDropIndicators();
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        pointerDragState = null;
        draggedMetadataFieldId = null;
      };

      document.addEventListener('mousemove', onPointerMove, true);
      document.addEventListener('mouseup', onPointerUp, true);

      cleanupPointerListeners = () => {
        document.removeEventListener('mousemove', onPointerMove, true);
        document.removeEventListener('mouseup', onPointerUp, true);
      };

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

    return () => {
      observer?.disconnect();
      cleanupPointerListeners?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ref para sincronizar editorData após reordenação por drag-and-drop
  useEffect(() => {
    syncEditorDataRef.current = () => {
      const editor = quillRef.current?.getEditor?.();
      if (editor?.root) setEditorData(getCleanEditorHTML(editor.root));
    };
  });

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
          skillPath: skillPath || undefined,
          exampleDocumentPath: exampleDocumentPath || undefined,
          isDraft: true
        }).then(() => onDraftStatusChange?.(true, true));
      }
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [name, type, editorData, specPath, skillPath, exampleDocumentPath, isEditMode, isLoading, onDraftStatusChange, initialData?.aiGuidance]);

  // Extrair metadados existentes no documento para associação pai-filho (árvore organizacional)
  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(editorData, 'text/html');
    const fields: { id: string; name: string }[] = [];

    doc.querySelectorAll('.sgid-metadata-field').forEach((node: Element) => {
      const id = node.getAttribute('data-field-id');
      if (id) {
        const title = (node.getAttribute('data-field-title') || (node as HTMLElement).innerText?.trim() || '').substring(0, 50) || 'Campo';
        fields.push({ id, name: title });
      }
    });

    setExistingMetadataFields(fields);
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
    if (!savingAsDraft && (!specPath.trim() || !skillPath.trim())) {
      toast.error('Spec e Skill são obrigatórios ao salvar o modelo. Selecione ambos.');
      return;
    }
    await onSave(name, type, contentToSave, savingAsDraft, initialData?.aiGuidance ?? '', specPath.trim() || undefined, skillPath.trim() || undefined, exampleDocumentPath.trim() || undefined);
  };

  const openFieldDialog = () => {
    setEditingMetadataId(null);
    setFieldTitle('');
    setFieldId('');
    setFieldHelp('');
    setFieldRepeatable(false);
    setFieldPlanningInstruction('');
    setAssociatedParentField('none');
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

    // Atualizar referência em metadados filhos (tag exibida)
    const metaFields = editor.root.querySelectorAll(`.sgid-metadata-field[data-topic-id="${editingTopicId}"], .sgid-metadata-field[data-parent-field-id="${editingTopicId}"]`);
    metaFields.forEach((meta) => {
      const metaEl = meta as HTMLElement;
      const titleEl = metaEl.querySelector('.sgid-metadata-field__title');
      if (titleEl) {
        const fieldTitle = metaEl.getAttribute('data-field-title') || '';
        titleEl.innerHTML = fieldTitle.trim();
        const tag = document.createElement('span');
        tag.className = 'text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2';
        tag.innerText = `Filho de: ${topicName.trim()}`;
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

  // Retorna o HTML do editor sem os botões de UI dinâmicos (edit/delete/drag).
  // Esses elementos são injetados no DOM via addMetadataButtons/addTopicButtons e NÃO
  // devem ser persistidos em editorData — caso contrário ReactQuill os recebe como
  // parte do value, reconstrói os blots sem eles e quebra o segundo campo.
  const getCleanEditorHTML = (root: HTMLElement): string => {
    const tmp = document.createElement('div');
    tmp.innerHTML = root.innerHTML;
    tmp.querySelectorAll(
      '.sgid-metadata-edit-btn, .sgid-metadata-delete-btn, .sgid-metadata-drag-handle, .sgid-topic-edit-btn, .sgid-topic-delete-btn'
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
    if (target.closest('.sgid-topic-edit-btn, .sgid-topic-delete-btn, .sgid-metadata-edit-btn, .sgid-metadata-delete-btn, .sgid-metadata-drag-handle')) {
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
        editor.root.querySelectorAll(`.sgid-metadata-field[data-topic-id="${pending.topicId}"], .sgid-metadata-field[data-parent-field-id="${pending.topicId}"]`).forEach((meta) => {
          const metaEl = meta as HTMLElement;
          metaEl.removeAttribute('data-topic-id');
          metaEl.removeAttribute('data-parent-field-id');
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
        editor.root.querySelectorAll(`.sgid-metadata-field[data-parent-field-id="${pending.fieldId}"]`).forEach((child) => {
          const childEl = child as HTMLElement;
          childEl.removeAttribute('data-parent-field-id');
          const titleEl = childEl.querySelector('.sgid-metadata-field__title');
          if (titleEl) {
            const fieldTitle = childEl.getAttribute('data-field-title') || '';
            titleEl.innerHTML = fieldTitle.trim();
          }
        });
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

    const parentField = associatedParentField !== 'none' ? existingMetadataFields.find((f) => f.id === associatedParentField) : null;
    const parentFieldTitle = parentField?.name;

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
      metaEl.setAttribute('data-parent-field-id', associatedParentField !== 'none' ? associatedParentField : '');
      metaEl.removeAttribute('data-topic-id');
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
        } else if (associatedParentField !== 'none' && parentFieldTitle) {
          const tag = document.createElement('span');
          tag.className = 'text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2';
          tag.innerText = `Filho de: ${parentFieldTitle}`;
          titleEl.appendChild(tag);
        }
      }
      const helpEl = metaEl.querySelector('.sgid-metadata-field__help');
      if (helpEl) (helpEl as HTMLElement).innerText = fieldHelp.trim();
      const bodyEl = metaEl.querySelector('.sgid-metadata-field__textarea');
      if (bodyEl) (bodyEl as HTMLElement).innerText = fieldRepeatable
        ? 'Campo dinâmico — a IA criará as instâncias necessárias ao gerar o documento.'
        : 'Digite aqui (campo editável no documento)...';

      // Atualizar tag "Filho de" em metadados que têm este como pai
      editor.root.querySelectorAll(`.sgid-metadata-field[data-parent-field-id="${uniqueId}"]`).forEach((child) => {
        const childEl = child as HTMLElement;
        const childTitleEl = childEl.querySelector('.sgid-metadata-field__title');
        if (childTitleEl) {
          const childFieldTitle = childEl.getAttribute('data-field-title') || '';
          childTitleEl.innerHTML = childFieldTitle.trim();
          if (childEl.getAttribute('data-repeatable') === 'true') {
            const badge = document.createElement('span');
            badge.className = 'text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2 font-semibold';
            badge.innerText = 'REPETÍVEL';
            childTitleEl.appendChild(badge);
          } else {
            const tag = document.createElement('span');
            tag.className = 'text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2';
            tag.innerText = `Filho de: ${fieldTitle.trim()}`;
            childTitleEl.appendChild(tag);
          }
        }
      });

      setEditorData(getCleanEditorHTML(editor.root));
      setFieldDialogOpen(false);
      setEditingMetadataId(null);
      toast.success('Metadado atualizado.');
    } else {
      const baseId = fieldId.trim() ? slugify(fieldId.trim()) : slugify(fieldTitle.trim());
      const uniqueId = generateUniqueId(baseId);

      let insertAt: number;
      let parentInsertPos = -1;
      if (associatedParentField !== 'none') {
        parentInsertPos = findParentInsertPosition(editor, associatedParentField);
        if (parentInsertPos >= 0) {
          insertAt = parentInsertPos;
        } else {
          insertAt = editor.getLength();
        }
      } else {
        insertAt = editor.getLength();
      }

      const isAfterParent = parentInsertPos >= 0;
      if (insertAt > 0 && !isAfterParent) {
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
        parentFieldId: associatedParentField !== 'none' ? associatedParentField : '',
        parentFieldTitle: parentFieldTitle,
        topicId: associatedParentField !== 'none' ? associatedParentField : '',
        topicName: parentFieldTitle,
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
            <div className="flex gap-2">
              <Select
                value={type || '__none__'}
                onValueChange={(v) => setType(v === '__none__' ? '' : v)}
                disabled={isLoading || documentTypesLoading}
              >
                <SelectTrigger id="model-type" className="flex-1 h-11 border-gray-200 focus:ring-blue-500 rounded-lg">
                  <SelectValue placeholder="Selecione ou cadastre um tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-gray-400">Selecione um tipo...</span>
                  </SelectItem>
                  {documentTypes.map((dt) => (
                    <SelectItem key={dt.id} value={dt.name}>
                      {dt.name}
                    </SelectItem>
                  ))}
                  {type && !documentTypes.some((dt) => dt.name === type) && (
                    <SelectItem value={type}>{type}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => setCreateTypeDialogOpen(true)}
                disabled={isLoading}
                title="Cadastrar novo tipo de documento"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <CreateDocumentTypeDialog
              open={createTypeDialogOpen}
              onOpenChange={setCreateTypeDialogOpen}
              onCreated={async (newName) => {
                await apiService.createDocumentType(newName);
                await loadDocumentTypes();
                setType(newName);
                toast.success(`Tipo "${newName}" cadastrado e selecionado.`);
              }}
            />
          </div>
          <div className="space-y-2 md:col-span-2" ref={specSearchRef}>
            <Label htmlFor="model-spec" className="text-sm font-semibold text-gray-700">Spec * (obrigatório)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                id="model-spec"
                type="text"
                className="pl-10 h-11"
                placeholder="Buscar e selecionar Spec..."
                value={specSearchQuery}
                onChange={(e) => { setSpecSearchQuery(e.target.value); setSpecSearchOpen(true); }}
                onFocus={() => setSpecSearchOpen(true)}
                disabled={isLoading}
              />
              {specSearchOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  {specsSkillsLoading ? <div className="px-4 py-3 text-sm text-gray-500">Carregando...</div> :
                    specFiltered.length === 0 ? <div className="px-4 py-3 text-sm text-gray-500">Nenhum Spec encontrado.</div> :
                    specFiltered.map((s) => (
                      <button key={s.path} type="button" className="w-full text-left px-4 py-2.5 hover:bg-gray-100 text-sm"
                        onClick={() => { setSpecPath(s.path); setSpecSearchQuery(s.name); setSpecSearchOpen(false); }}>
                        <span className="font-medium">{s.name}</span>
                        <span className="text-gray-500 text-xs ml-2">{s.path}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2 md:col-span-2" ref={skillSearchRef}>
            <Label htmlFor="model-skill" className="text-sm font-semibold text-gray-700">Skill * (obrigatório)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                id="model-skill"
                type="text"
                className="pl-10 h-11"
                placeholder="Buscar e selecionar Skill..."
                value={skillSearchQuery}
                onChange={(e) => { setSkillSearchQuery(e.target.value); setSkillSearchOpen(true); }}
                onFocus={() => setSkillSearchOpen(true)}
                disabled={isLoading}
              />
              {skillSearchOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  {specsSkillsLoading ? <div className="px-4 py-3 text-sm text-gray-500">Carregando...</div> :
                    skillFiltered.length === 0 ? <div className="px-4 py-3 text-sm text-gray-500">Nenhum Skill encontrado.</div> :
                    skillFiltered.map((s) => (
                      <button key={s.path} type="button" className="w-full text-left px-4 py-2.5 hover:bg-gray-100 text-sm"
                        onClick={() => { setSkillPath(s.path); setSkillSearchQuery(s.name); setSkillSearchOpen(false); }}>
                        <span className="font-medium">{s.name}</span>
                        <span className="text-gray-500 text-xs ml-2">{s.path}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2 md:col-span-2" ref={exampleSearchRef}>
            <Label htmlFor="model-example" className="text-sm font-semibold text-gray-700">Documento de exemplo (opcional)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                id="model-example"
                type="text"
                className="pl-10 h-11"
                placeholder="Buscar e selecionar documento de exemplo..."
                value={exampleSearchQuery}
                onChange={(e) => { setExampleSearchQuery(e.target.value); setExampleSearchOpen(true); }}
                onFocus={() => setExampleSearchOpen(true)}
                disabled={isLoading}
              />
              {exampleSearchOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  {specsSkillsLoading ? <div className="px-4 py-3 text-sm text-gray-500">Carregando...</div> :
                    exampleFiltered.length === 0 ? <div className="px-4 py-3 text-sm text-gray-500">Nenhum exemplo encontrado. Faça upload em Gestão de IA.</div> :
                    <>
                      <button key="__clear__" type="button" className="w-full text-left px-4 py-2.5 hover:bg-gray-100 text-sm text-gray-500"
                        onClick={() => { setExampleDocumentPath(''); setExampleSearchQuery(''); setExampleSearchOpen(false); }}>
                        (Nenhum)
                      </button>
                      {exampleFiltered.map((s) => (
                        <button key={s.path} type="button" className="w-full text-left px-4 py-2.5 hover:bg-gray-100 text-sm"
                          onClick={() => { setExampleDocumentPath(s.path); setExampleSearchQuery(s.name); setExampleSearchOpen(false); }}>
                          <span className="font-medium">{s.name}</span>
                          <span className="text-gray-500 text-xs ml-2">{s.path}</span>
                        </button>
                      ))}
                    </>
                  }
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">A IA usa o exemplo para entender organização e formato esperado do documento.</p>
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

            <div className="space-y-2">
              <Label htmlFor="associated-parent" className="text-sm font-medium">Metadado pai (opcional)</Label>
              <Select value={associatedParentField || 'none'} onValueChange={setAssociatedParentField}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Selecione um metadado pai..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (raiz da árvore)</SelectItem>
                  {existingMetadataFields
                    .filter((f) => f.id !== editingMetadataId)
                    .map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Se selecionado, este metadado será filho do indicado. O texto gerado será exibido em árvore organizacional (indentado).</p>
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
    </div>
  );
}


