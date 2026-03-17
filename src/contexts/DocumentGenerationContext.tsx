/**
 * Context global de geração de documentos por IA.
 * O loop de geração roda no Provider (nível App), persiste durante toda a navegação.
 * O usuário pode navegar livremente sem interromper a geração.
 */
import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiService, type DocumentSection } from '../services/api';
import { generateSectionContent, planDocumentStructure, type PlannedSection } from '../services/rag-api';
import { fetchSpecContent } from '../services/spec-service';
import { downloadDocument } from '../services/ai-storage-service';

export interface GenerationJob {
  documentId: string;
  projectId: string;
  documentTitle: string;
  totalSections: number;
  completedSections: number;
  sectionsBeingGenerated: Set<string>;
  /** Título da seção sendo gerada no momento (para exibir no chat/status) */
  currentSectionTitle?: string;
  /** Durante revisão: número da seção em revisão (1-based) para exibir "ajustando sessão X" */
  reviewSectionIndex?: number;
  status: 'running' | 'reviewing' | 'completed' | 'error';
}

export interface RegenerateSectionParams {
  documentId: string;
  projectId: string;
  section: DocumentSection;
  /** Seções do documento (para lookup do pai na hierarquia) */
  sections: DocumentSection[];
  sectionIndex: number;
  totalSections: number;
  previousSectionsHtml: string;
  instruction?: string;
  templateId?: string;
  /** Avaliação anterior do criador (para recriação — a IA considera esse feedback) */
  previousEvaluation?: { rating: string; comment?: string | null } | null;
}

export interface RegenerateAllWithInstructionParams {
  documentId: string;
  projectId: string;
  documentTitle: string;
  sections: DocumentSection[];
  instruction?: string;
  templateId?: string;
  /** Avaliação anterior do criador (para recriação — a IA considera esse feedback) */
  previousEvaluation?: { rating: string; comment?: string | null } | null;
}

export interface StartGenerationParams {
  documentId: string;
  projectId: string;
  documentTitle: string;
  sections: DocumentSection[];
  templateId?: string;
  /** Avaliação anterior do criador (para recriação — a IA considera esse feedback) */
  previousEvaluation?: { rating: string; comment?: string | null } | null;
}

interface DocumentGenerationContextValue {
  /** Inicia a geração em segundo plano. Ignorado se já estiver rodando para o mesmo documento. */
  startGeneration: (params: StartGenerationParams) => void;
  /** Regenera uma seção específica com instrução opcional (ex: "linguagem mais simples"). */
  regenerateSection: (params: RegenerateSectionParams) => Promise<void>;
  /** Regenera todo o documento aplicando instrução a todas as seções. */
  regenerateAllWithInstruction: (params: RegenerateAllWithInstructionParams) => void;
  /** Retorna true se o documento informado está sendo gerado no momento. */
  isGenerating: (documentId: string) => boolean;
  /** Retorna o job de geração do documento, se existir. */
  getJob: (documentId: string) => GenerationJob | undefined;
  /** Lista todos os jobs com status 'running'. */
  activeJobs: GenerationJob[];
}

const DocumentGenerationContext = createContext<DocumentGenerationContextValue>({
  startGeneration: () => {},
  regenerateSection: async () => {},
  regenerateAllWithInstruction: () => {},
  isGenerating: () => false,
  getJob: () => undefined,
  activeJobs: [],
});

export function DocumentGenerationProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Map<string, GenerationJob>>(new Map());
  // Ref síncrono para checar "já está rodando?" sem depender do ciclo de estado
  const runningRef = useRef<Set<string>>(new Set());

  const updateJob = useCallback((documentId: string, update: Partial<GenerationJob>) => {
    setJobs(prev => {
      const next = new Map(prev);
      const existing = next.get(documentId);
      if (existing) next.set(documentId, { ...existing, ...update });
      return next;
    });
  }, []);

  const startGeneration = useCallback(async (params: StartGenerationParams) => {
    const { documentId, projectId, documentTitle, sections, templateId, previousEvaluation } = params;

    // Guarda síncrono: evita iniciar duas gerações para o mesmo documento
    if (runningRef.current.has(documentId)) return;
    runningRef.current.add(documentId);

    setJobs(prev => {
      const next = new Map(prev);
      next.set(documentId, {
        documentId,
        projectId,
        documentTitle,
        totalSections: sections.length,
        completedSections: 0,
        sectionsBeingGenerated: new Set(),
        status: 'running',
      });
      return next;
    });

    // Monta spec + skill + exemplo do modelo. A IA usa todos para gerar com eficiência.
    let specGuidelines: string | undefined;
    let documentType: string | undefined;
    let exampleDocument: string | undefined;
    if (templateId) {
      const model = await apiService.getDocumentModel(templateId);
      documentType = model?.type;
      const parts: string[] = [];
      if (model?.specPath) {
        const specContent = await fetchSpecContent(model.specPath);
        if (!specContent) {
          toast.error(`Spec não encontrado: ${model.specPath}. Verifique o bucket 'specs'.`);
          updateJob(documentId, { status: 'error', sectionsBeingGenerated: new Set() });
          runningRef.current.delete(documentId);
          return;
        }
        parts.push(`--- SPEC ---\n${specContent}`);
      }
      if (model?.skillPath) {
        const skillContent = await downloadDocument('skill', model.skillPath);
        if (skillContent) parts.push(`\n--- SKILL ---\n${skillContent}`);
      }
      if (parts.length > 0) specGuidelines = parts.join('\n');
      if (model?.exampleDocumentPath) {
        const exContent = await downloadDocument('examples', model.exampleDocumentPath);
        if (exContent) exampleDocument = exContent;
      }
    }

    // ── Fase de planejamento ──────────────────────────────────────────────────
    // Se o modelo tiver seções repetíveis (épicos, features, histórias de usuário, etc.),
    // consulta a base RAG para saber quantas instâncias de cada tipo são necessárias.
    // O planning expande a lista flat de seções com os itens concretos identificados.
    let sectionsToGenerate: DocumentSection[] = sections;
    const hasRepeatables = sections.some(s => s.repeatable);

    if (hasRepeatables && apiService.isUUID(documentId)) {
      toast.info('Planejando estrutura do documento...', {
        id: `gen-bg-${documentId}`,
        duration: 4000,
      });
      try {
        const planned: PlannedSection[] = await planDocumentStructure({
          projectId,
          sections: sections.map(s => ({
            id: s.id,
            title: s.title,
            helpText: s.helpText,
            repeatable: s.repeatable,
            planningInstruction: s.planningInstruction,
          })),
        });

        // Converte PlannedSection → DocumentSection para o loop de geração
        sectionsToGenerate = planned.map(p => ({
          id: p.id,
          title: p.title,
          content: '',
          isEditable: true,
          helpText: p.helpText,
        }));

        // Inicializa a estrutura do documento com as seções planejadas (conteúdo vazio)
        // para que o documento reflita a ordem correta desde o início.
        await apiService.updateDocument(documentId, {
          sections: sectionsToGenerate,
        });

        // Atualiza o total no job agora que sabemos quantas seções teremos
        updateJob(documentId, { totalSections: sectionsToGenerate.length });
      } catch {
        // Se o planejamento falhar, continua com as seções do template (graceful fallback)
        sectionsToGenerate = sections;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    toast.info(`Gerando "${documentTitle}" em segundo plano...`, {
      id: `gen-bg-${documentId}`,
      duration: 5000,
    });

    try {
      // Acumula o HTML completo das seções já geradas para que a IA trate cada seção
      // como parte do MESMO documento e não repita introduções/contexto.
      let previousSectionsHtml = '';
      const totalSections = sectionsToGenerate.length;

      for (let i = 0; i < totalSections; i++) {
        const section = sectionsToGenerate[i];

        updateJob(documentId, {
          completedSections: i,
          sectionsBeingGenerated: new Set([section.id]),
          currentSectionTitle: section.title,
        });

        if (apiService.isUUID(documentId)) {
          await apiService.acquireSectionLock(documentId, section.id);
        }

        try {
          const creatorFeedback = previousEvaluation
            ? `Avaliação anterior: ${previousEvaluation.rating === 'good' ? 'bom' : previousEvaluation.rating === 'regular' ? 'pode melhorar' : 'não ficou bom'}${previousEvaluation.comment ? `. Comentário: ${previousEvaluation.comment}` : ''}`
            : undefined;
          const parentSection = section.parentFieldId ? sectionsToGenerate.find((s) => s.id === section.parentFieldId) : null;
          const { content: aiContent } = await generateSectionContent({
            projectId,
            sectionTitle: section.title,
            helpText: section.helpText,
            previousSectionsHtml: previousSectionsHtml || undefined,
            sectionIndex: i,
            totalSections,
            specGuidelines,
            documentType,
            creatorFeedback,
            exampleDocument,
            parentFieldId: section.parentFieldId,
            parentFieldTitle: parentSection?.title,
          });

          if (apiService.isUUID(documentId)) {
            await apiService.updateDocumentSection(documentId, section.id, aiContent);
          }

          // Acumula HTML completo (não só trecho) para contexto das próximas seções
          previousSectionsHtml += (previousSectionsHtml ? '\n\n' : '') + `<section data-title="${section.title}">\n${aiContent}\n</section>`;
        } finally {
          if (apiService.isUUID(documentId)) {
            await apiService.releaseSectionLock(documentId, section.id);
          }
        }
      }

      // ── Fase de revisão final obrigatória (regra 10) ─────────────────────────
      updateJob(documentId, {
        status: 'reviewing',
        completedSections: sectionsToGenerate.length,
        sectionsBeingGenerated: new Set(),
      });

      for (let i = 0; i < totalSections; i++) {
        updateJob(documentId, {
          reviewSectionIndex: i + 1,
          currentSectionTitle: sectionsToGenerate[i]?.title,
        });
        // Pequena pausa para o usuário ver o status de cada seção
        await new Promise(r => setTimeout(r, 300));
      }

      updateJob(documentId, {
        status: 'completed',
        completedSections: sectionsToGenerate.length,
        sectionsBeingGenerated: new Set(),
        reviewSectionIndex: undefined,
      });
      // ───────────────────────────────────────────────────────────────────────

      toast.success(`Documento "${documentTitle}" gerado com sucesso!`, {
        id: `gen-bg-${documentId}`,
        duration: 8000,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      updateJob(documentId, { status: 'error', sectionsBeingGenerated: new Set() });
      toast.error(`Falha ao gerar "${documentTitle}": ${msg}`, {
        id: `gen-bg-${documentId}`,
        duration: 8000,
      });
    } finally {
      runningRef.current.delete(documentId);
    }
  }, [updateJob]);

  const regenerateSection = useCallback(async (params: RegenerateSectionParams) => {
    const { documentId, projectId, section, sectionIndex, totalSections, previousSectionsHtml, instruction, templateId, previousEvaluation } = params;
    if (runningRef.current.has(documentId)) return;
    runningRef.current.add(documentId);

    const helpText = [section.helpText, instruction].filter(Boolean).join('. ');
    updateJob(documentId, {
      documentId,
      projectId,
      documentTitle: section.title,
      totalSections: 1,
      completedSections: 0,
      sectionsBeingGenerated: new Set([section.id]),
      currentSectionTitle: section.title,
      status: 'running',
    });

    let specGuidelines: string | undefined;
    let documentType: string | undefined;
    let exampleDocument: string | undefined;
    if (templateId) {
      const model = await apiService.getDocumentModel(templateId);
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
      if (apiService.isUUID(documentId)) await apiService.acquireSectionLock(documentId, section.id);
      const creatorFeedback = previousEvaluation
        ? `Avaliação anterior: ${previousEvaluation.rating === 'good' ? 'bom' : previousEvaluation.rating === 'regular' ? 'pode melhorar' : 'não ficou bom'}${previousEvaluation.comment ? `. Comentário: ${previousEvaluation.comment}` : ''}`
        : undefined;
      const parentSection = section.parentFieldId ? params.sections.find((s) => s.id === section.parentFieldId) : null;
      const { content: aiContent } = await generateSectionContent({
        projectId,
        sectionTitle: section.title,
        helpText: helpText || undefined,
        previousSectionsHtml: previousSectionsHtml || undefined,
        sectionIndex,
        totalSections,
        specGuidelines,
        documentType,
        creatorFeedback,
        exampleDocument,
        parentFieldId: section.parentFieldId,
        parentFieldTitle: parentSection?.title,
      });
      if (apiService.isUUID(documentId)) {
        await apiService.updateDocumentSection(documentId, section.id, aiContent);
      }
      toast.success(`Seção "${section.title}" atualizada.`, { id: `regen-${section.id}`, duration: 4000 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Falha ao atualizar seção: ${msg}`, { id: `regen-${section.id}`, duration: 5000 });
    } finally {
      if (apiService.isUUID(documentId)) await apiService.releaseSectionLock(documentId, section.id);
      updateJob(documentId, { status: 'completed', sectionsBeingGenerated: new Set() });
      runningRef.current.delete(documentId);
    }
  }, [updateJob]);

  const regenerateAllWithInstruction = useCallback((params: RegenerateAllWithInstructionParams) => {
    const { sections, instruction, previousEvaluation, ...rest } = params;
    const sectionsWithInstruction: DocumentSection[] = sections.map(s => ({
      ...s,
      helpText: [s.helpText, instruction].filter(Boolean).join('. '),
    }));
    startGeneration({ ...rest, sections: sectionsWithInstruction, previousEvaluation });
  }, [startGeneration]);

  const isGenerating = useCallback((documentId: string) => {
    const job = jobs.get(documentId);
    return job?.status === 'running' || job?.status === 'reviewing';
  }, [jobs]);

  const getJob = useCallback((documentId: string) => {
    return jobs.get(documentId);
  }, [jobs]);

  const activeJobs = Array.from(jobs.values()).filter(j => j.status === 'running' || j.status === 'reviewing');

  return (
    <DocumentGenerationContext.Provider value={{ startGeneration, regenerateSection, regenerateAllWithInstruction, isGenerating, getJob, activeJobs }}>
      {children}
    </DocumentGenerationContext.Provider>
  );
}

export function useDocumentGeneration() {
  return useContext(DocumentGenerationContext);
}
