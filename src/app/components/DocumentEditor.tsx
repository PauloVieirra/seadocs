import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { RotateCw, Plus, Save, FileDown, Edit3, Lock, RefreshCw, PenLine, PenTool, Code, Type, Palette, AlignLeft, AlignCenter, AlignRight, AlignJustify, ThumbsUp, ThumbsDown } from 'lucide-react';
import 'react-quill-new/dist/quill.snow.css';
import ReactQuill, { Quill } from 'react-quill-new';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { HexColorPicker } from 'react-colorful';
import { apiService, type Document, type DocumentContent, type DocumentSection, type DocumentEvaluation } from '../../services/api';
import { generateSectionContent, indexPositiveFeedback, removePositiveFeedback } from '../../services/rag-api';
import { downloadDocument } from '../../services/ai-storage-service';
import { fetchSpecContent } from '../../services/spec-service';
import { getSignDocumentUrl, isGovBrConfigured } from '../../services/govbr-api';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { NewSectionDialog } from './NewSectionDialog';
import { TypingSectionContent } from './TypingSectionContent';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { ensureCustomBlotsRegistered } from '../../lib/quill-blots';

ensureCustomBlotsRegistered();

const FONT_SIZES_PX = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '40px', '48px', '56px', '64px', '72px', '80px'];

/* Paleta de cores para seleção rápida */
const COLOR_PALETTE = [
  '#000000', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#ffffff',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#7c3aed', '#db2777',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6',
];

/* Ícones Quill para toolbar - visíveis antes do editor focar */
const QUILL_ICONS = {
  bold: '<svg viewBox="0 0 18 18"><path class="ql-stroke" d="M5,4H9.5A2.5,2.5,0,0,1,12,6.5v0A2.5,2.5,0,0,1,9.5,9H5A0,0,0,0,1,5,9V4A0,0,0,0,1,5,4Z"/><path class="ql-stroke" d="M5,9h5.5A2.5,2.5,0,0,1,13,11.5v0A2.5,2.5,0,0,1,10.5,14H5a0,0,0,0,1,0,0V9A0,0,0,0,1,5,9Z"/></svg>',
  italic: '<svg viewBox="0 0 18 18"><line class="ql-stroke" x1="7" x2="13" y1="4" y2="4"/><line class="ql-stroke" x1="5" x2="11" y1="14" y2="14"/><line class="ql-stroke" x1="8" x2="10" y1="14" y2="4"/></svg>',
  underline: '<svg viewBox="0 0 18 18"><path class="ql-stroke" d="M5,3V9a4.012,4.012,0,0,0,4,4H9a4.012,4.012,0,0,0,4-4V3"/><rect class="ql-fill" height="1" rx="0.5" ry="0.5" width="12" x="3" y="15"/></svg>',
  strike: '<svg viewBox="0 0 18 18"><line class="ql-stroke ql-thin" x1="15.5" x2="2.5" y1="8.5" y2="9.5"/><path class="ql-fill" d="M9.007,8C6.542,7.791,6,7.519,6,6.5,6,5.792,7.283,5,9,5c1.571,0,2.765.679,2.969,1.309a1,1,0,0,0,1.9-.617C13.356,4.106,11.354,3,9,3,6.2,3,4,4.538,4,6.5a3.2,3.2,0,0,0,.5,1.843Z"/><path class="ql-fill" d="M8.984,10C11.457,10.208,12,10.479,12,11.5c0,0.708-1.283,1.5-3,1.5-1.571,0-2.765-.679-2.969-1.309a1,1,0,1,0-1.9.617C4.644,13.894,6.646,15,9,15c2.8,0,5-1.538,5-3.5a3.2,3.2,0,0,0-.5-1.843Z"/></svg>',
  link: '<svg viewBox="0 0 18 18"><line class="ql-stroke" x1="7" x2="11" y1="7" y2="11"/><path class="ql-even ql-stroke" d="M8.9,4.577a3.476,3.476,0,0,1,.36,4.679A3.476,3.476,0,0,1,4.577,8.9C3.185,7.5,2.035,6.4,4.217,4.217S7.5,3.185,8.9,4.577Z"/><path class="ql-even ql-stroke" d="M13.423,9.1a3.476,3.476,0,0,0-4.679-.36,3.476,3.476,0,0,0,.36,4.679c1.392,1.392,2.5,2.542,4.679.36S14.815,10.5,13.423,9.1Z"/></svg>',
  blockquote: '<svg viewBox="0 0 18 18"><rect class="ql-fill ql-stroke" height="3" width="3" x="4" y="5"/><rect class="ql-fill ql-stroke" height="3" width="3" x="11" y="5"/><path class="ql-even ql-fill ql-stroke" d="M7,8c0,4.031-3,5-3,5"/><path class="ql-even ql-fill ql-stroke" d="M14,8c0,4.031-3,5-3,5"/></svg>',
  clean: '<svg viewBox="0 0 18 18"><line class="ql-stroke" x1="5" x2="13" y1="3" y2="3"/><line class="ql-stroke" x1="6" x2="9.35" y1="12" y2="3"/><line class="ql-stroke" x1="11" x2="15" y1="11" y2="15"/><line class="ql-stroke" x1="15" x2="11" y1="11" y2="15"/><rect class="ql-fill" height="1" rx="0.5" ry="0.5" width="7" x="2" y="14"/></svg>',
  alignLeft: '<svg viewBox="0 0 18 18"><line class="ql-stroke" x1="3" x2="15" y1="9" y2="9"/><line class="ql-stroke" x1="3" x2="13" y1="14" y2="14"/><line class="ql-stroke" x1="3" x2="9" y1="4" y2="4"/></svg>',
};

function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return '#000000';
  const r = parseInt(m[1], 10).toString(16).padStart(2, '0');
  const g = parseInt(m[2], 10).toString(16).padStart(2, '0');
  const b = parseInt(m[3], 10).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

const QUILL_FORMATS = [
  'size', 'bold', 'italic', 'underline', 'strike',
  'color', 'list', 'align', 'link', 'blockquote',
];

interface DocumentEditorProps {
  document: Document;
  onSave: (content: Document['content']) => void;
  projectId: string;
  viewMode?: boolean; // Propriedade opcional para modo de visualização
  onExitViewMode?: () => void; // Callback para sair do modo de visualização
  /** Callback quando documento é assinado ou revisado (para recarregar dados) */
  onDocumentUpdated?: () => void;
  /** IDs das seções que estão sendo geradas pelo pai (ex: chat IA) - bloqueia edição */
  sectionsBeingGeneratedByParent?: Set<string>;
  /** Quando true, documento está sendo gerado pelo pai (ex: chat) - esconde barra imediatamente ao clicar "Sim, criar documento" */
  isDocumentBeingGeneratedByParent?: boolean;
  /** Quando true, faz scroll para centralizar a seção sendo gerada (ex.: ao clicar no botão "IA gerando") */
  scrollToActiveSection?: boolean;
  /** Callback para delegar geração ao pai (ex: chat IA) em vez de fluxo local */
  onRequestGenerateAll?: (sections: DocumentSection[]) => void;
}

export function DocumentEditor({ document, onSave, projectId, viewMode = false, onExitViewMode, onDocumentUpdated, sectionsBeingGeneratedByParent, isDocumentBeingGeneratedByParent, scrollToActiveSection, onRequestGenerateAll }: DocumentEditorProps) {
  const [content, setContent] = useState<DocumentContent>(document.content ?? { sections: [] });
  const [editorMode, setEditorMode] = useState<'text' | 'html'>('text');
  const [activeEditSection, setActiveEditSection] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<string>('__normal__');
  const [fontColor, setFontColor] = useState<string>('#000000');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [alignPickerOpen, setAlignPickerOpen] = useState(false);
  const [currentAlign, setCurrentAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const activeQuillRef = useRef<ReactQuill | null>(null);
  const toolbarId = React.useMemo(() => `doc-editor-toolbar-${Math.random().toString(16).slice(2)}`, []);
  const quillModules = React.useMemo(() => ({ toolbar: { container: `#${toolbarId}` } }), [toolbarId]);
  const [activeLocks, setActiveLocks] = useState<{ section_id: string; user_id: string; user_name?: string }[]>([]);
  const [updatingSections, setUpdatingSections] = useState<Set<string>>(new Set()); // Seções que estão sendo atualizadas via Realtime
  const currentUser = apiService.getCurrentUser();
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [sectionsBeingGeneratedByAI, setSectionsBeingGeneratedByAI] = useState<Set<string>>(new Set());
  const [isSummaryReady, setIsSummaryReady] = useState(false);
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);
  const [regenTarget, setRegenTarget] = useState<'all' | string | null>(null);
  const [isSavingToLocalStorage, setIsSavingToLocalStorage] = useState(false);
  const [newSectionDialogOpen, setNewSectionDialogOpen] = useState(false); 
  const [isAddingSection, setIsAddingSection] = useState(false); 
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRefsMap = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const hasScrolledToActiveRef = useRef(false);

  // Revisar / Assinar (mobile, viewMode)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewJustification, setReviewJustification] = useState(document.reviewJustification || '');
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signConfirmOpen, setSignConfirmOpen] = useState(false);

  // Avaliação do criador (visível apenas ao criador)
  const [evaluation, setEvaluation] = useState<DocumentEvaluation | null>(null);
  const [evaluationLoading, setEvaluationLoading] = useState(true);
  const [evaluationSubmitting, setEvaluationSubmitting] = useState(false);
  const [evaluationComment, setEvaluationComment] = useState('');

  const isCreator = document.creatorId && currentUser?.id && document.creatorId === currentUser.id;

  useEffect(() => {
    if (!isCreator || !document.id) {
      setEvaluationLoading(false);
      return;
    }
    apiService.getDocumentEvaluation(document.id).then((ev) => {
      setEvaluation(ev ?? null);
      if (ev?.comment) setEvaluationComment(ev.comment);
    }).finally(() => setEvaluationLoading(false));
  }, [document.id, isCreator]);

  const handleSubmitEvaluation = async (rating: 'good' | 'regular' | 'bad') => {
    if (!isCreator || evaluationSubmitting) return;
    if (rating === 'regular' && !evaluationComment.trim()) {
      toast.error('Para "Pode melhorar", a descrição é obrigatória.');
      return;
    }
    setEvaluationSubmitting(true);
    try {
      const ev = await apiService.saveDocumentEvaluation(document.id, rating, evaluationComment.trim() || undefined);
      setEvaluation(ev);
      if (rating === 'good') {
        const sections = (content.sections || [])
          .filter(s => (s.content || '').trim())
          .map(s => ({ title: s.title, content: s.content || '' }));
        if (sections.length > 0) {
          await indexPositiveFeedback({ projectId, documentId: document.id, sections });
        }
      } else if (rating === 'bad') {
        await removePositiveFeedback(document.id);
      }
      toast.success(
        rating === 'good' ? 'Obrigado! Sua avaliação ajuda a IA a melhorar.' :
        rating === 'regular' ? 'Feedback registrado. A IA considerará sua descrição na próxima recriação.' :
        'Feedback registrado.'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar avaliação.');
    } finally {
      setEvaluationSubmitting(false);
    }
  };

  // Sincronizar ícone de alinhamento com a seleção atual do editor
  useEffect(() => {
    const quill = activeQuillRef.current?.getEditor?.();
    if (!quill) return;
    const handler = () => {
      const range = quill.getSelection();
      if (!range) return;
      const format = quill.getFormat(range.index, range.length);
      const align = format?.align;
      if (align === 'center') setCurrentAlign('center');
      else if (align === 'right') setCurrentAlign('right');
      else if (align === 'justify') setCurrentAlign('justify');
      else setCurrentAlign('left');
    };
    quill.on('selection-change', handler);
    handler(); // sync inicial
    return () => {
      quill.off('selection-change', handler);
    };
  }, [activeEditSection]);

  // Scroll para centralizar a seção sendo gerada (ao clicar no botão "IA gerando")
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!scrollToActiveSection || !sectionsBeingGeneratedByParent?.size) return;
    const sectionId = Array.from(sectionsBeingGeneratedByParent)[0];
    if (!sectionId) return;
    const tryScroll = () => {
      const el = sectionRefsMap.current.get(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        hasScrolledToActiveRef.current = true;
        navigate(location.pathname, { replace: true, state: {} });
        return true;
      }
      return false;
    };
    if (!tryScroll()) {
      const t = setTimeout(tryScroll, 300);
      return () => clearTimeout(t);
    }
  }, [scrollToActiveSection, sectionsBeingGeneratedByParent, navigate, location.pathname, content.sections.length]);

  // Verificar se o resumo da IA está pronto para habilitar o botão de geração
  useEffect(() => {
    const checkSummary = async () => {
      try {
        const hasSummary = await apiService.hasExistingSummary(projectId);
        setIsSummaryReady(hasSummary);
      } catch (err) {
        setIsSummaryReady(false);
      }
    };

    checkSummary();
    
    // Polling opcional para detectar quando a análise termina no AIChat
    const interval = setInterval(checkSummary, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  // 1. Sincronização Inteligente do Conteúdo
  useEffect(() => {
    // Identifica qual seção o usuário atual está editando localmente
    const locksArray = Array.isArray(activeLocks) ? activeLocks : [];
    const userLock = locksArray.find(l => l.user_id === currentUser?.id);
    const editingSectionId = userLock?.section_id;

    const isSectionBeingGeneratedCheck = (sectionId: string) =>
      sectionsBeingGeneratedByAI.has(sectionId) || (sectionsBeingGeneratedByParent?.has(sectionId) ?? false);

    setContent(prev => {
      let hasChanges = false;
      const sections = document.content?.sections ?? [];
      const newSections = sections.map(incomingSection => {
        // Se esta é a seção que EU estou editando, mantenho meu estado local TOTALMENTE
        // para não perder o cursor ou caracteres enquanto digito.
        // EXCEÇÃO: se a seção está sendo gerada pela IA, aceitar o conteúdo do servidor
        // para evitar exibir conteúdo desatualizado ou repetido.
        if (incomingSection.id === editingSectionId) {
          if (isSectionBeingGeneratedCheck(incomingSection.id)) {
            return incomingSection;
          }
          return prev.sections.find(s => s.id === editingSectionId) || incomingSection;
        }
        
        // Para seções que NÃO estou editando:
        const localSection = prev.sections.find(s => s.id === incomingSection.id);
        
        // Se o conteúdo que veio do banco é diferente do que tenho na tela, atualizo.
        if (localSection && localSection.content !== incomingSection.content) {
          hasChanges = true;
          // Ativa o loading visual para esta seção
          setUpdatingSections(prevSet => {
            const next = new Set(prevSet);
            next.add(incomingSection.id);
            setTimeout(() => {
              setUpdatingSections(s => {
                const n = new Set(s);
                n.delete(incomingSection.id);
                return n;
              });
            }, 1000);
            return next;
          });
          return incomingSection;
        }

        return localSection || incomingSection;
      });

      if (!hasChanges && prev.sections.length === newSections.length) return prev;
      return { ...(document.content ?? {}), sections: newSections };
    });
  }, [document.content, activeLocks, currentUser?.id]);

  // 2. Inscrição de Bloqueios e Gestão de Foco Global
  useEffect(() => {
    apiService.getActiveLocks(document.id).then(setActiveLocks);

    const lockSub = apiService.subscribeToLocks(document.id, (locks) => {
      setActiveLocks(locks);
    });

    // Função para forçar o desbloqueio ao clicar fora de qualquer área de edição
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const activeEl = window.document.activeElement;
      
      // Se estamos editando um campo
      if (activeEl instanceof HTMLElement && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        // Se clicar em algo que NÃO é o campo atual E NÃO é um botão
        if (target !== activeEl && !target.closest('button')) {
          console.log('[Editor] Clique fora reforçado. Forçando perda de foco para liberar lock.');
          activeEl.blur();
        }
      }
    };

    // Evento para liberar locks ao fechar a aba ou atualizar a página
    const handleBeforeUnload = () => {
      apiService.releaseAllMyLocks(document.id);
    };

    window.addEventListener('mousedown', handleGlobalClick);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup: Libera qualquer lock que este usuário tenha deixado para trás ao sair do documento
    return () => {
      if (lockSub) lockSub.unsubscribe();
      window.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Limpa todos os locks deste usuário para este documento específico
      apiService.releaseAllMyLocks(document.id);
    };
  }, [document.id, currentUser?.id]);

  const handleSectionFocus = async (sectionId: string) => {
    if (viewMode) return;
    await apiService.acquireSectionLock(document.id, sectionId);
  };

  const handleSectionBlur = async (sectionId: string) => {
    if (viewMode) return;
    
    // Identifica o conteúdo da seção que está perdendo o foco
    const sectionToSave = content.sections.find(s => s.id === sectionId);
    if (!sectionToSave) return;

    console.log(`[Editor] Perda de foco na seção ${sectionId}. Liberando lock...`);

    try {
      // Cancela auto-salvamento pendente
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      // Libera o lock AGUARDANDO a confirmação para garantir que não fique preso
      await apiService.releaseSectionLock(document.id, sectionId);

      // Salva APENAS esta seção no banco
      await apiService.updateDocumentSection(document.id, sectionId, sectionToSave.content);
      
      // Notifica o componente pai
      onSave(content);
    } catch (err) {
      console.error('Erro ao salvar seção ou liberar lock:', err);
    }
  };

  const getSectionLock = (sectionId: string) => {
    const locksArray = Array.isArray(activeLocks) ? activeLocks : [];
    return locksArray.find(l => l.section_id === sectionId && l.user_id !== currentUser?.id);
  };

  const isSectionBeingGenerated = (sectionId: string) =>
    sectionsBeingGeneratedByAI.has(sectionId) || (sectionsBeingGeneratedByParent?.has(sectionId) ?? false);

  const isAnySectionBeingGenerated =
    isGeneratingAll ||
    (isDocumentBeingGeneratedByParent ?? false) ||
    sectionsBeingGeneratedByAI.size > 0 ||
    (sectionsBeingGeneratedByParent?.size ?? 0) > 0;

  const handleSectionChange = (sectionId: string, newContent: string) => {
    if (viewMode || getSectionLock(sectionId)) return; 
    
    const updatedContent = {
      ...content,
      sections: content.sections.map(section =>
        section.id === sectionId
          ? { ...section, content: newContent }
          : section
      )
    };
    setContent(updatedContent);

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      try {
        // Auto-save frequente para manter os outros usuários atualizados
        // mesmo antes de clicar fora (blur)
        await apiService.updateDocumentSection(document.id, sectionId, newContent);
        onSave({ ...content, sections: content.sections.map(s => s.id === sectionId ? { ...s, content: newContent } : s) });
      } catch (err) {
        console.error('Erro no auto-save da seção:', err);
      }
    }, 1500); // 1.5 segundos de inatividade enquanto digita
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleSaveReview = async () => {
    setIsSavingReview(true);
    try {
      await apiService.saveReviewJustification(document.id, reviewJustification);
      toast.success('Justificativa de revisão salva.');
      setReviewDialogOpen(false);
      onDocumentUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar justificativa.');
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleSign = async () => {
    setSignConfirmOpen(false);
    const govBrUrl = getSignDocumentUrl(document.id);
    if (govBrUrl && isGovBrConfigured()) {
      window.location.href = govBrUrl;
      toast.info('Redirecionando para assinatura Gov.br...');
      return;
    }
    setIsSigning(true);
    try {
      await apiService.signDocument(document.id);
      toast.success('Documento assinado com sucesso.');
      onDocumentUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao assinar documento.');
    } finally {
      setIsSigning(false);
    }
  };

  if (viewMode) {
    return (
      <>
      <div className="flex flex-col items-center min-h-full font-sans antialiased px-4 md:px-0">
        {/* ... código existente ... */}
        <div className="w-full max-w-4xl mb-4 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white px-3 py-1 text-blue-600 border-blue-200">
              Modo de Visualização
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="bg-white">
              <FileDown className="w-4 h-4 mr-2" />
              Baixar PDF
            </Button>
            {onExitViewMode && (
              <Button variant="default" size="sm" onClick={onExitViewMode}>
                <Edit3 className="w-4 h-4 mr-2" />
                Voltar a Editar
              </Button>
            )}
          </div>
        </div>

        {/* Document Page */}
        <div className="w-full max-w-[21cm] bg-white shadow-2xl p-4 md:p-[2.5cm] min-h-[29.7cm] flex flex-col print:shadow-none print:p-0 print:w-full overflow-hidden">
          <div className="space-y-8 overflow-hidden min-w-0">
            {content.sections.map((section, idx) => (
              <div
                key={`doc-${document.id}-sec-${idx}-${section.id}`}
                className={`break-inside-avoid min-w-0 overflow-hidden ${section.parentFieldId ? 'doc-section-child ml-6 pl-4 border-l-2 border-gray-200' : ''}`}
              >
                <div 
                  className={`doc-view-mode-content text-gray-700 leading-relaxed space-y-4 ${section.parentFieldId ? 'doc-section-child-content' : ''}`}
                  dangerouslySetInnerHTML={{ __html: section.content || '<p class="text-gray-400 italic">Conteúdo pendente...</p>' }}
                />
              </div>
            ))}
          </div>

          <div className="mt-auto pt-10 text-center text-xs text-gray-400 border-t border-gray-100 print:fixed print:bottom-8 print:w-full">
            <p>Gerado pelo SGID - {new Date().toLocaleDateString('pt-BR')}</p>
            <p>Página 1 de 1</p>
          </div>
        </div>

        {/* Botões Revisar e Assinar - mobile, fora do texto */}
        <div className="w-full max-w-4xl mt-6 flex flex-col gap-3 md:hidden print:hidden">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setReviewJustification(document.reviewJustification || '');
                setReviewDialogOpen(true);
              }}
            >
              <PenLine className="w-4 h-4 mr-2" />
              Revisar
            </Button>
            <Button
              variant="default"
              className="flex-1"
              onClick={() => setSignConfirmOpen(true)}
              disabled={!!document.signedAt || isSigning}
            >
              <PenTool className="w-4 h-4 mr-2" />
              {document.signedAt ? 'Assinado' : isSigning ? 'Assinando...' : 'Assinar'}
            </Button>
          </div>
          {document.signedAt && (
            <p className="text-xs text-green-600 text-center">
              Assinado em {new Date(document.signedAt).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      </div>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Justificativa da Revisão</DialogTitle>
            <DialogDescription>
              Descreva os motivos ou observações da revisão deste documento.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reviewJustification}
            onChange={(e) => setReviewJustification(e.target.value)}
            placeholder="Ex: Ajustes de redação, correções técnicas..."
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveReview} disabled={isSavingReview}>
              {isSavingReview ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={signConfirmOpen} onOpenChange={setSignConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar assinatura</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja assinar o documento &quot;{document.name}&quot;? Essa ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSign} className="bg-blue-600 hover:bg-blue-700">
              Sim, Assinar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
    );
  }

  const handleGenerateAllWithAI = async () => {
    if (!isSummaryReady) {
      toast.warning('Aguarde a IA finalizar a análise dos documentos antes de gerar.');
      return;
    }

    const targetSections = content.sections.filter(s => s.isEditable);
    if (targetSections.length === 0) {
      toast.info('Nenhuma seção editável encontrada.');
      return;
    }

    // Novo fluxo: IA lê documento, mostra resumo no chat, usuário confirma e só então gera
    if (onRequestGenerateAll) {
      onRequestGenerateAll(targetSections);
      return;
    }

    // Fallback: fluxo antigo com confirmação direta
    setRegenTarget('all');
    setConfirmRegenOpen(true);
  };

  const executeRegeneration = async () => {
    setConfirmRegenOpen(false);
    
    if (regenTarget === 'all') {
      await performFullRegeneration();
    } else if (typeof regenTarget === 'string') {
      await performSectionRegeneration(regenTarget);
    }
    
    setRegenTarget(null);
  };

  const performSectionRegeneration = async (sectionId: string) => {
    const section = content.sections.find(s => s.id === sectionId);
    if (!section || !section.isEditable) return;

    const sectionIndex = content.sections.findIndex(s => s.id === sectionId);
    const previousSections = content.sections.slice(0, sectionIndex);
    const previousSectionsHtml = previousSections
      .filter(s => s.content?.trim())
      .map(s => `<section data-title="${s.title}">\n${s.content}\n</section>`)
      .join('\n\n');

    const previousEvaluation = await apiService.getDocumentEvaluation(document.id);
    const creatorFeedback = previousEvaluation
      ? `Avaliação anterior: ${previousEvaluation.rating === 'good' ? 'bom' : previousEvaluation.rating === 'regular' ? 'pode melhorar' : 'não ficou bom'}${previousEvaluation.comment ? `. Comentário: ${previousEvaluation.comment}` : ''}`
      : undefined;

    let specGuidelines: string | undefined;
    let documentType: string | undefined;
    let exampleDocument: string | undefined;
    if (document.templateId) {
      const model = await apiService.getDocumentModel(document.templateId);
      documentType = model?.type;
      const parts: string[] = [];
      if (model?.specPath) {
        const c = await fetchSpecContent(model.specPath);
        if (c) parts.push(`--- SPEC ---\n${c}`);
      }
      if (model?.skillPath) {
        const c = await downloadDocument('skill', model.skillPath);
        if (c) parts.push(`\n--- SKILL ---\n${c}`);
      }
      if (parts.length > 0) specGuidelines = parts.join('\n');
      if (model?.exampleDocumentPath) {
        const exContent = await downloadDocument('examples', model.exampleDocumentPath);
        if (exContent) exampleDocument = exContent;
      }
    }

    try {
      setSectionsBeingGeneratedByAI(prev => {
        const next = new Set(prev);
        next.add(sectionId);
        return next;
      });

      if (apiService.isUUID(document.id)) {
        await apiService.acquireSectionLock(document.id, sectionId);
      }

      toast.loading(`Refazendo conteúdo para: ${section.title}...`, { id: 'regen-section' });

      const parentSection = section.parentFieldId ? content.sections.find((s) => s.id === section.parentFieldId) : null;
      const { content: aiContent } = await generateSectionContent({
        projectId,
        sectionTitle: section.title,
        helpText: section.helpText,
        previousSectionsHtml: previousSectionsHtml || undefined,
        sectionIndex,
        totalSections: content.sections.length,
        specGuidelines,
        documentType,
        creatorFeedback,
        exampleDocument,
        parentFieldId: section.parentFieldId,
        parentFieldTitle: parentSection?.title,
      });

      const updatedSections = content.sections.map(s =>
        s.id === sectionId ? { ...s, content: aiContent } : s
      );

      if (apiService.isUUID(document.id)) {
        await apiService.updateDocumentSection(document.id, sectionId, aiContent);
        await apiService.releaseSectionLock(document.id, sectionId);
      }

      setContent({ ...content, sections: updatedSections });
      onSave({ ...content, sections: updatedSections });
      toast.success(`Seção "${section.title}" recriada com sucesso!`, { id: 'regen-section' });

    } catch (err: any) {
      console.error(`Erro ao refazer seção ${section.title}:`, err);
      toast.error(`Falha ao refazer ${section.title}: ${err.message}`, { id: 'regen-section' });
    } finally {
      setSectionsBeingGeneratedByAI(prev => {
        const next = new Set(prev);
        next.delete(sectionId);
        return next;
      });
      if (apiService.isUUID(document.id)) {
        await apiService.releaseSectionLock(document.id, sectionId);
      }
    }
  };

  const performFullRegeneration = async () => {
    // Identifica seções editáveis
    const targetSections = content.sections.filter(s => s.isEditable);

    if (targetSections.length === 0) {
      toast.info('Nenhuma seção editável encontrada.');
      return;
    }

    const previousEvaluation = await apiService.getDocumentEvaluation(document.id);
    const creatorFeedback = previousEvaluation
      ? `Avaliação anterior: ${previousEvaluation.rating === 'good' ? 'bom' : previousEvaluation.rating === 'regular' ? 'pode melhorar' : 'não ficou bom'}${previousEvaluation.comment ? `. Comentário: ${previousEvaluation.comment}` : ''}`
      : undefined;

    let specGuidelines: string | undefined;
    let documentType: string | undefined;
    let exampleDocument: string | undefined;
    if (document.templateId) {
      const model = await apiService.getDocumentModel(document.templateId);
      documentType = model?.type;
      const parts: string[] = [];
      if (model?.specPath) {
        const c = await fetchSpecContent(model.specPath);
        if (c) parts.push(`--- SPEC ---\n${c}`);
      }
      if (model?.skillPath) {
        const c = await downloadDocument('skill', model.skillPath);
        if (c) parts.push(`\n--- SKILL ---\n${c}`);
      }
      if (parts.length > 0) specGuidelines = parts.join('\n');
      if (model?.exampleDocumentPath) {
        const exContent = await downloadDocument('examples', model.exampleDocumentPath);
        if (exContent) exampleDocument = exContent;
      }
    }

    setIsGeneratingAll(true);
    toast.info(`Iniciando recriação completa: ${targetSections.length} seções.`);

    try {
      const updatedSections = [...content.sections];
      let previousSectionsHtml = '';

      for (let i = 0; i < updatedSections.length; i++) {
        const section = updatedSections[i];
        
        if (section.isEditable) {
          try {
            setSectionsBeingGeneratedByAI(prev => {
              const next = new Set(prev);
              next.add(section.id);
              return next;
            });

            if (apiService.isUUID(document.id)) {
              await apiService.acquireSectionLock(document.id, section.id);
            }

            toast.loading(`Gerando conteúdo para: ${section.title}...`, { id: 'gen-progress' });
            
            const parentSection = section.parentFieldId ? updatedSections.find((s) => s.id === section.parentFieldId) : null;
            const { content: aiContent } = await generateSectionContent({
              projectId,
              sectionTitle: section.title,
              helpText: section.helpText,
              exampleDocument,
              previousSectionsHtml: previousSectionsHtml || undefined,
              sectionIndex: i,
              totalSections: updatedSections.length,
              specGuidelines,
              documentType,
              creatorFeedback,
              parentFieldId: section.parentFieldId,
              parentFieldTitle: parentSection?.title,
            });

            updatedSections[i] = { ...section, content: aiContent };
            previousSectionsHtml += (previousSectionsHtml ? '\n\n' : '') + `<section data-title="${section.title}">\n${aiContent}\n</section>`;
            
            if (apiService.isUUID(document.id)) {
              await apiService.updateDocumentSection(document.id, section.id, aiContent);
              await apiService.releaseSectionLock(document.id, section.id);
            }
            
            setContent({ ...content, sections: [...updatedSections] });
            
            setSectionsBeingGeneratedByAI(prev => {
              const next = new Set(prev);
              next.delete(section.id);
              return next;
            });

          } catch (err: any) {
            console.error(`Erro ao gerar seção ${section.title}:`, err);
            toast.error(`Falha ao gerar ${section.title}: ${err.message}`);
            setSectionsBeingGeneratedByAI(prev => {
              const next = new Set(prev);
              next.delete(section.id);
              return next;
            });
            if (apiService.isUUID(document.id)) {
              await apiService.releaseSectionLock(document.id, section.id);
            }
          }
        }
      }

      toast.success('Recriação concluída!', { id: 'gen-progress' });
      onSave({ ...content, sections: updatedSections });
      
    } catch (error) {
      console.error('Erro na recriação em massa:', error);
      toast.error('Ocorreu um erro durante a recriação automática.');
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const handleAddNewSection = async (title: string) => {
    // ...
  };

  const handleSaveDocument = async () => {
    // ...
  };

  return (
    <div className={`flex flex-col items-center min-h-screen bg-gray-100 py-8 font-sans antialiased px-4 md:px-0 ${editorMode === 'text' ? 'pb-24' : ''}`}>
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-md p-4 md:p-10 space-y-8">
        {/* Document Header */}
        <div className="mb-8 pb-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <p className="text-gray-600 text-lg">
              Projeto: <span className="font-semibold">{document.projectId}</span>
            </p>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1" title="Alternar modo de edição">
            <button
              type="button"
              onClick={() => setEditorMode('text')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all ${
                editorMode === 'text'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              Editor
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('html')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all ${
                editorMode === 'html'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              HTML
            </button>
          </div>
        </div>

        {/* Document Sections */}
        <div className="space-y-6">
          {content.sections.map((section, idx) => {
            const lock = getSectionLock(section.id);
            
            return (
              <div
                key={`doc-${document.id}-sec-${idx}-${section.id}`}
                ref={(el) => { sectionRefsMap.current.set(section.id, el); }}
                className={`group relative ${section.parentFieldId ? 'doc-section-child ml-6 pl-4 border-l-2 border-gray-200' : ''}`}
              >
                <div className="flex gap-2 items-center mb-2 justify-end">
                  {section.helpText && (
                    <Badge variant="outline" className="text-[10px] font-normal opacity-50">
                      Instruções IA
                    </Badge>
                  )}
                </div>
                
                {section.isEditable ? (
                  <div className="relative">
                    <div className="flex gap-2 absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs bg-white/80 hover:bg-white border shadow-sm"
                        onClick={() => {
                          setRegenTarget(section.id);
                          setConfirmRegenOpen(true);
                        }}
                        disabled={isGeneratingAll || isSectionBeingGenerated(section.id) || !!lock}
                      >
                        <RefreshCw className={`w-3 h-3 mr-1.5 ${isSectionBeingGenerated(section.id) ? 'animate-spin' : ''}`} />
                        Refazer
                      </Button>
                    </div>

                    {editorMode === 'text' ? (
                      activeEditSection === section.id ? (
                        // Seção ativa: editor ReactQuill conectado à toolbar flutuante
                        <div
                          onBlur={(e) => {
                            if (colorPickerOpen || alignPickerOpen) return; /* manter seção ativa enquanto pickers abertos */
                            const toolbar = window.document.getElementById(toolbarId);
                            const related = e.relatedTarget as Node | null;
                            if (related && (e.currentTarget.contains(related) || toolbar?.contains(related))) return;
                            /* relatedTarget pode estar no portal do dropdown (body) */
                            if (related && typeof (related as Element).closest === 'function' && (related as Element).closest?.('[data-slot="dropdown-menu-content"]')) return;
                            setActiveEditSection(null);
                            handleSectionBlur(section.id);
                          }}
                          className={`doc-editor-quill overflow-hidden transition-all rounded border-2 ${
                            updatingSections.has(section.id)
                              ? 'border-blue-400'
                              : 'border-indigo-400 ring-2 ring-indigo-100'
                          }`}
                        >
                          <ReactQuill
                            key={`doc-${document.id}-sec-${idx}-${section.id}`}
                            ref={activeQuillRef}
                            value={section.content || ''}
                            onChange={(html) => handleSectionChange(section.id, html)}
                            readOnly={!!lock || isSectionBeingGenerated(section.id)}
                            modules={quillModules}
                            formats={QUILL_FORMATS}
                            theme="snow"
                            placeholder={`Digite aqui para "${section.title}"...`}
                            className="min-h-[140px] [&_.ql-toolbar]:hidden"
                          />
                        </div>
                      ) : (
                        // Seção inativa: preview clicável
                        <div
                          onClick={() => {
                            if (lock || isSectionBeingGenerated(section.id)) return;
                            setActiveEditSection(section.id);
                            handleSectionFocus(section.id);
                          }}
                          className={`min-h-[80px] p-4 rounded border transition-all overflow-hidden ${
                            lock
                              ? 'border-red-200 opacity-60 cursor-not-allowed'
                              : isSectionBeingGenerated(section.id)
                              ? 'border-indigo-200 bg-indigo-50/30 cursor-default'
                              : updatingSections.has(section.id)
                              ? 'border-blue-300 bg-blue-50/20 cursor-text'
                              : 'border-transparent hover:border-gray-200 hover:bg-gray-50/40 cursor-text'
                          }`}
                        >
                          {section.content ? (
                            <div
                              className="doc-view-mode-content max-w-full text-gray-800 leading-relaxed prose prose-sm break-words overflow-hidden [&_*]:max-w-full [&_*]:break-words"
                              dangerouslySetInnerHTML={{ __html: section.content }}
                            />
                          ) : (
                            <p className="text-gray-400 italic text-sm">
                              {isSectionBeingGenerated(section.id)
                                ? 'Gerando conteúdo com IA...'
                                : `Clique para editar "${section.title}"...`}
                            </p>
                          )}
                        </div>
                      )
                    ) : isSectionBeingGenerated(section.id) ? (
                      <TypingSectionContent
                        content={section.content || ''}
                        isGenerating={isSectionBeingGenerated(section.id)}
                      >
                        {(displayValue) => (
                          <Textarea
                            value={displayValue}
                            onChange={(e) => handleSectionChange(section.id, e.target.value)}
                            onFocus={() => handleSectionFocus(section.id)}
                            onBlur={() => handleSectionBlur(section.id)}
                            placeholder={lock ? `Bloqueado por ${lock.user_name}` : `Digite aqui para "${section.title}"...`}
                            disabled
                            readOnly
                            className="min-h-[140px] transition-all bg-indigo-50/30 border-indigo-300 overflow-hidden resize-none"
                          />
                        )}
                      </TypingSectionContent>
                    ) : (
                      <Textarea
                        value={section.content || ''}
                        onChange={(e) => handleSectionChange(section.id, e.target.value)}
                        onFocus={() => handleSectionFocus(section.id)}
                        onBlur={() => handleSectionBlur(section.id)}
                        placeholder={lock ? `Bloqueado por ${lock.user_name}` : `Digite aqui para "${section.title}"...`}
                        disabled={!!lock}
                        className={`min-h-[140px] transition-all font-mono text-sm overflow-hidden resize-none ${
                          lock ? 'bg-gray-50 border-red-200 cursor-not-allowed opacity-60' :
                          updatingSections.has(section.id) ? 'border-blue-400 bg-blue-50/30' : ''
                        }`}
                      />
                    )}

                    {/* Tag de edição interna */}
                    {(lock || isSectionBeingGenerated(section.id)) && (
                      <div className="absolute top-3 left-3 flex items-center pointer-events-none">
                        <Badge
                          variant={isSectionBeingGenerated(section.id) ? "default" : "destructive"}
                          className={`flex items-center gap-1.5 text-[11px] font-medium animate-pulse py-1 px-2 ${
                            isSectionBeingGenerated(section.id) ? 'bg-indigo-600' : ''
                          }`}
                        >
                          <Lock className="w-3 h-3" />
                          {isSectionBeingGenerated(section.id)
                            ? 'Tópico em edição por IA'
                            : `Tópico em edição por ${lock?.user_name || 'outro usuário'}`
                          }
                        </Badge>
                      </div>
                    )}

                    {lock && !isSectionBeingGenerated(section.id) && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50/20"
                           onClick={() => toast.warning(`Este campo está sendo editado por ${lock.user_name}`)}>
                      </div>
                    )}
                    {updatingSections.has(section.id) && !isSectionBeingGenerated(section.id) && (
                      <div className="absolute right-3 bottom-3 flex items-center gap-1.5 text-[10px] text-blue-600 font-medium animate-pulse">
                        <RotateCw className="w-3 h-3 animate-spin" />
                        Atualizando...
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="doc-view-mode-content max-w-full text-gray-700 leading-relaxed bg-gray-50 p-4 rounded border border-gray-100 space-y-4 overflow-hidden break-words [&_*]:max-w-full [&_*]:break-words"
                    dangerouslySetInnerHTML={{ __html: section.content || '[Seção não editável]' }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Botão para adicionar novo tópico */}
        <div className="flex justify-center mt-8">
          <Button
            onClick={() => setNewSectionDialogOpen(true)}
            variant="outline"
            disabled={isAddingSection || isGeneratingAll}
          >
            <Plus className="w-4 h-4 mr-2" /> Novo Tópico
          </Button>
        </div>

        {/* Botão de salvar */}
        <div className="pt-2 flex justify-end">
          <Button onClick={handleSaveDocument} disabled={isSavingToLocalStorage || isGeneratingAll}>
            <Save className="w-4 h-4 mr-2" />
            {isSavingToLocalStorage ? 'Salvando...' : 'Salvar Documento'}
          </Button>
        </div>

        {/* Avaliação do criador — visível apenas ao criador, ajuda a IA a refinar gerações futuras */}
        {isCreator && !viewMode && (
          <div className="mt-10 pt-8 border-t border-gray-200 print:hidden">
            <p className="text-sm font-medium text-gray-700 mb-2">Como foi o resultado da IA neste documento?</p>
            <p className="text-xs text-gray-500 mb-4">Sua avaliação ajuda a refinar a criação dos próximos documentos.</p>
            {evaluationLoading ? (
              <div className="text-sm text-gray-500">Carregando...</div>
            ) : evaluation ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {evaluation.rating === 'good' && <ThumbsUp className="w-5 h-5 text-green-600" />}
                  {evaluation.rating === 'regular' && <span className="text-blue-600 font-medium">~</span>}
                  {evaluation.rating === 'bad' && <ThumbsDown className="w-5 h-5 text-amber-600" />}
                  <span className={
                    evaluation.rating === 'good' ? 'text-green-700' :
                    evaluation.rating === 'regular' ? 'text-blue-700' : 'text-amber-700'
                  }>
                    {evaluation.rating === 'good' ? 'Documento ficou bom' :
                     evaluation.rating === 'regular' ? 'Pode melhorar' : 'Não ficou bom'}
                  </span>
                  {evaluation.comment && (
                    <span className="text-gray-600">— {evaluation.comment}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEvaluation(null)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Alterar avaliação
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSubmitEvaluation('good')}
                    disabled={evaluationSubmitting}
                    className="text-green-700 border-green-200 hover:bg-green-50"
                  >
                    <ThumbsUp className="w-4 h-4 mr-1.5" />
                    Bom
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSubmitEvaluation('regular')}
                    disabled={evaluationSubmitting}
                    className="text-blue-700 border-blue-200 hover:bg-blue-50"
                  >
                    Pode melhorar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSubmitEvaluation('bad')}
                    disabled={evaluationSubmitting}
                    className="text-amber-700 border-amber-200 hover:bg-amber-50"
                  >
                    <ThumbsDown className="w-4 h-4 mr-1.5" />
                    Não ficou bom
                  </Button>
                </div>
                <Textarea
                  placeholder="Comentário (obrigatório para 'Pode melhorar'). Ex: o que melhorou ou faltou."
                  value={evaluationComment}
                  onChange={(e) => setEvaluationComment(e.target.value)}
                  className="text-sm min-h-[60px]"
                  disabled={evaluationSubmitting}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <NewSectionDialog
        open={newSectionDialogOpen}
        onOpenChange={setNewSectionDialogOpen}
        onSave={handleAddNewSection}
        isSaving={isAddingSection}
      />

      <AlertDialog open={confirmRegenOpen} onOpenChange={setConfirmRegenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar recriação de conteúdo</AlertDialogTitle>
            <AlertDialogDescription>
              {regenTarget === 'all'
                ? "Tem certeza que deseja recriar TODO o documento? O conteúdo atual de todas as seções editáveis será substituído por uma nova versão gerada pela IA, corrigindo escrita e contexto."
                : "Tem certeza que deseja recriar esta seção? O conteúdo atual será substituído por uma nova versão gerada pela IA, corrigindo escrita e contexto."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRegenTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeRegeneration} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Sim, Recriar com IA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toolbar Flutuante — visível no modo Editor de Texto, oculta durante geração pela IA (badge ocupa o espaço) */}
      {editorMode === 'text' && !isAnySectionBeingGenerated && (
        <div className="sgid-floating-toolbar shadow-2xl print:hidden">
          <div
            id={toolbarId}
            className="ql-toolbar ql-snow flex flex-row items-center flex-nowrap border-none bg-transparent"
          >
            <span className="ql-formats flex items-center flex-shrink-0">
              <Select
                value={fontSize}
                onValueChange={(value) => {
                  const editor = activeQuillRef.current?.getEditor?.();
                  if (editor) {
                    const range = editor.getSelection();
                    const sizeValue = value === '__normal__' ? false : value;
                    if (range) editor.format('size', sizeValue, 'user');
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
              <button type="button" className="ql-bold" title="Negrito" dangerouslySetInnerHTML={{ __html: QUILL_ICONS.bold }} />
              <button type="button" className="ql-italic" title="Itálico" dangerouslySetInnerHTML={{ __html: QUILL_ICONS.italic }} />
              <button type="button" className="ql-underline" title="Sublinhado" dangerouslySetInnerHTML={{ __html: QUILL_ICONS.underline }} />
              <button type="button" className="ql-strike" title="Riscado" dangerouslySetInnerHTML={{ __html: QUILL_ICONS.strike }} />
            </span>

            <span className="ql-formats flex items-center">
              <DropdownMenu modal={false} open={colorPickerOpen} onOpenChange={(open) => {
                setColorPickerOpen(open);
                if (open) {
                  const editor = activeQuillRef.current?.getEditor?.();
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
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="doc-editor-color-btn flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100"
                    title="Cor da fonte"
                  >
                    <Palette className="w-4 h-4 text-gray-600" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" sideOffset={12} className="w-auto p-3 z-[9999] min-w-[260px]">
                  <div className="space-y-3">
                    <div className="grid grid-cols-7 gap-1.5">
                      {COLOR_PALETTE.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          className={`w-7 h-7 rounded border-2 transition-all hover:scale-110 ${
                            fontColor.toLowerCase() === hex.toLowerCase()
                              ? 'border-indigo-600 ring-2 ring-indigo-200'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          style={{ backgroundColor: hex }}
                          title={hex}
                          onClick={() => {
                            setFontColor(hex);
                            const editor = activeQuillRef.current?.getEditor?.();
                            const range = editor?.getSelection();
                            if (editor && range) editor.format('color', hex, 'user');
                            setColorPickerOpen(false);
                          }}
                        />
                      ))}
                    </div>
                    <div className="border-t pt-3">
                      <p className="text-xs text-gray-500 mb-2">Cor personalizada</p>
                      <HexColorPicker
                        color={fontColor}
                        onChange={(hex) => {
                          setFontColor(hex);
                          const editor = activeQuillRef.current?.getEditor?.();
                          const range = editor?.getSelection();
                          if (editor && range) editor.format('color', hex, 'user');
                        }}
                        onMouseUp={() => setColorPickerOpen(false)}
                        style={{ width: 220, height: 140 }}
                      />
                      <div className="mt-2">
                        <Input
                          type="text"
                          value={fontColor}
                          onChange={(e) => setFontColor(e.target.value)}
                          onBlur={() => {
                            if (/^#[0-9A-Fa-f]{6}$/.test(fontColor)) {
                              const editor = activeQuillRef.current?.getEditor?.();
                              const range = editor?.getSelection();
                              if (editor && range) editor.format('color', fontColor, 'user');
                            }
                            setColorPickerOpen(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && /^#[0-9A-Fa-f]{6}$/.test(fontColor)) {
                              const editor = activeQuillRef.current?.getEditor?.();
                              const range = editor?.getSelection();
                              if (editor && range) editor.format('color', fontColor, 'user');
                              setColorPickerOpen(false);
                            }
                          }}
                          className="w-full h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>

            <span className="ql-formats flex items-center">
              <DropdownMenu modal={false} open={alignPickerOpen} onOpenChange={setAlignPickerOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="doc-editor-align-btn flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100"
                    title="Alinhamento"
                  >
                    {currentAlign === 'center' && <AlignCenter className="w-4 h-4 text-gray-600" />}
                    {currentAlign === 'right' && <AlignRight className="w-4 h-4 text-gray-600" />}
                    {currentAlign === 'justify' && <AlignJustify className="w-4 h-4 text-gray-600" />}
                    {(currentAlign === 'left' || !currentAlign) && <AlignLeft className="w-4 h-4 text-gray-600" />}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" sideOffset={8} className="z-[9999] min-w-[140px]">
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-gray-100 rounded cursor-pointer"
                    onClick={() => {
                      const editor = activeQuillRef.current?.getEditor?.();
                      const range = editor?.getSelection();
                      if (editor && range) editor.format('align', false, 'user');
                      setCurrentAlign('left');
                      setAlignPickerOpen(false);
                    }}
                  >
                    <AlignLeft className="w-4 h-4" /> Esquerda
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-gray-100 rounded cursor-pointer"
                    onClick={() => {
                      const editor = activeQuillRef.current?.getEditor?.();
                      const range = editor?.getSelection();
                      if (editor && range) editor.format('align', 'center', 'user');
                      setCurrentAlign('center');
                      setAlignPickerOpen(false);
                    }}
                  >
                    <AlignCenter className="w-4 h-4" /> Centro
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-gray-100 rounded cursor-pointer"
                    onClick={() => {
                      const editor = activeQuillRef.current?.getEditor?.();
                      const range = editor?.getSelection();
                      if (editor && range) editor.format('align', 'right', 'user');
                      setCurrentAlign('right');
                      setAlignPickerOpen(false);
                    }}
                  >
                    <AlignRight className="w-4 h-4" /> Direita
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-gray-100 rounded cursor-pointer"
                    onClick={() => {
                      const editor = activeQuillRef.current?.getEditor?.();
                      const range = editor?.getSelection();
                      if (editor && range) editor.format('align', 'justify', 'user');
                      setCurrentAlign('justify');
                      setAlignPickerOpen(false);
                    }}
                  >
                    <AlignJustify className="w-4 h-4" /> Justificar
                  </button>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>

            <span className="ql-formats">
              <button type="button" className="ql-link" title="Link" dangerouslySetInnerHTML={{ __html: QUILL_ICONS.link }} />
              <button type="button" className="ql-blockquote" title="Citação" dangerouslySetInnerHTML={{ __html: QUILL_ICONS.blockquote }} />
              <button type="button" className="ql-clean" title="Limpar formatação" dangerouslySetInnerHTML={{ __html: QUILL_ICONS.clean }} />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}