import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Sparkles, RotateCw, Plus, Save, FileDown, Edit3, Lock, RefreshCw, PenLine, PenTool } from 'lucide-react';
import 'react-quill-new/dist/quill.snow.css';
import { apiService, type Document, type DocumentContent, type DocumentSection } from '../../services/api';
import { generateSectionContent } from '../../services/rag-api';
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

interface DocumentEditorProps {
  document: Document;
  onSave: (content: Document['content']) => void;
  projectId: string;
  viewMode?: boolean; // Propriedade opcional para modo de visualização
  onExitViewMode?: () => void; // Callback para sair do modo de visualização
  /** Quando fornecido, "Gerar tudo com IA" dispara o fluxo no chat (resumo + confirmação) em vez de gerar direto */
  onRequestGenerateAll?: (sections: DocumentSection[]) => void;
  /** Callback quando documento é assinado ou revisado (para recarregar dados) */
  onDocumentUpdated?: () => void;
  /** IDs das seções que estão sendo geradas pelo pai (ex: chat IA) - bloqueia edição */
  sectionsBeingGeneratedByParent?: Set<string>;
  /** Quando true, faz scroll para centralizar a seção sendo gerada (ex.: ao clicar no botão "IA gerando") */
  scrollToActiveSection?: boolean;
}

export function DocumentEditor({ document, onSave, projectId, viewMode = false, onExitViewMode, onRequestGenerateAll, onDocumentUpdated, sectionsBeingGeneratedByParent, scrollToActiveSection }: DocumentEditorProps) {
  const [content, setContent] = useState<DocumentContent>(document.content);
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

    setContent(prev => {
      let hasChanges = false;
      const newSections = document.content.sections.map(incomingSection => {
        // Se esta é a seção que EU estou editando, mantenho meu estado local TOTALMENTE
        // para não perder o cursor ou caracteres enquanto digito.
        if (incomingSection.id === editingSectionId) {
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
      return { ...document.content, sections: newSections };
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
      const activeEl = document.activeElement;
      
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
        <div className="w-full max-w-[21cm] bg-white shadow-2xl p-4 md:p-[2.5cm] min-h-[29.7cm] flex flex-col print:shadow-none print:p-0 print:w-full">
          <div className="space-y-8">
            {content.sections.map((section) => (
              <div key={section.id} className="break-inside-avoid">
                <div 
                  className="max-w-none text-gray-700 leading-relaxed text-justify space-y-4"
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

    let specGuidelines: string | undefined;
    if (document.templateId) {
      const model = await apiService.getDocumentModel(document.templateId);
      if (model?.specPath) {
        specGuidelines = await fetchSpecContent(model.specPath) ?? undefined;
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

      const { content: aiContent } = await generateSectionContent({
        projectId,
        sectionTitle: section.title,
        helpText: section.helpText,
        previousSectionsHtml: previousSectionsHtml || undefined,
        sectionIndex,
        totalSections: content.sections.length,
        specGuidelines,
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

    let specGuidelines: string | undefined;
    if (document.templateId) {
      const model = await apiService.getDocumentModel(document.templateId);
      if (model?.specPath) {
        specGuidelines = await fetchSpecContent(model.specPath) ?? undefined;
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
            
            const { content: aiContent } = await generateSectionContent({
              projectId,
              sectionTitle: section.title,
              helpText: section.helpText,
              previousSectionsHtml: previousSectionsHtml || undefined,
              sectionIndex: i,
              totalSections: updatedSections.length,
              specGuidelines,
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
    <div className="flex flex-col items-center min-h-screen bg-gray-100 py-8 font-sans antialiased px-4 md:px-0">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-md p-4 md:p-10 space-y-8">
        {/* Document Header */}
        <div className="mb-8 pb-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <p className="text-gray-600 text-lg">
              Projeto: <span className="font-semibold">{document.projectId}</span>
            </p>
          </div>
          <Button
            onClick={handleGenerateAllWithAI}
            disabled={isGeneratingAll || !isSummaryReady}
            className={`${
              isSummaryReady 
                ? 'bg-indigo-600 hover:bg-indigo-700' 
                : 'bg-gray-400 cursor-not-allowed opacity-70'
            } text-white transition-all duration-300`}
          >
            {isGeneratingAll ? (
              <>
                <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                Gerando Tudo...
              </>
            ) : !isSummaryReady ? (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Aguardando IA...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Gerar Tudo com IA
              </>
            )}
          </Button>
        </div>

        {/* Document Sections */}
        <div className="space-y-6">
          {content.sections.map((section) => {
            const lock = getSectionLock(section.id);
            
            return (
              <div
                key={section.id}
                ref={(el) => { sectionRefsMap.current.set(section.id, el); }}
                className="group relative"
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

                    {isSectionBeingGenerated(section.id) ? (
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
                            className="min-h-[140px] transition-all bg-indigo-50/30 border-indigo-300"
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
                        className={`min-h-[140px] transition-all ${
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
                    className="max-w-none text-gray-700 leading-relaxed bg-gray-50 p-4 rounded border border-gray-100 space-y-4"
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
    </div>
  );
}