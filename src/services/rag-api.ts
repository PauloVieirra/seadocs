/**
 * Cliente do serviço RAG (ChromaDB + Ollama).
 * O serviço Python deve estar rodando em VITE_RAG_SERVICE_URL.
 */

const RAG_SERVICE_URL = import.meta.env.VITE_RAG_SERVICE_URL || 'http://localhost:8000';

/** RAG em localhost só é acessível quando o app também está em localhost. Em produção (Vercel etc.) configure VITE_RAG_SERVICE_URL. */
function isRAGReachable(): boolean {
  if (typeof window === 'undefined') return true;
  const ragIsLocalhost = RAG_SERVICE_URL.includes('localhost') || RAG_SERVICE_URL.includes('127.0.0.1');
  const appOnLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return !ragIsLocalhost || appOnLocalhost;
}

/** Envia configuração de IA para o serviço RAG (provider + chave Groq). */
export async function updateAIConfig(params: {
  provider: 'ollama' | 'groq';
  groqApiKey?: string;
}): Promise<void> {
  if (!isRAGReachable()) return;
  const res = await fetch(`${RAG_SERVICE_URL}/ai-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: params.provider,
      groq_api_key: params.groqApiKey ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `RAG ai-config failed: ${res.status}`);
  }
}

export interface IndexResponse {
  document_id: string;
  chunk_count: number;
  file_hash: string;
  status: string;
}

export interface SearchResponse {
  query: string;
  documents: string[][];
  metadatas: Record<string, unknown>[][];
  distances: number[][];
}

export async function indexDocumentInRAG(params: {
  documentId: string;
  fileUrl: string;
  fileName: string;
  projectId: string;
  filePath?: string;
  reindex?: boolean;
}): Promise<IndexResponse> {
  const res = await fetch(`${RAG_SERVICE_URL}/index`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: params.documentId,
      file_url: params.fileUrl,
      file_name: params.fileName,
      project_id: params.projectId,
      file_path: params.filePath ?? null,
      reindex: params.reindex ?? false,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `RAG index failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteDocumentFromRAG(documentId: string): Promise<{ chunks_removed: number }> {
  const res = await fetch(`${RAG_SERVICE_URL}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: documentId }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `RAG delete failed: ${res.status}`);
  }
  return res.json();
}

/** Limpa toda a base RAG (ChromaDB). Será necessário reindexar os documentos. */
export async function clearAllRAG(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${RAG_SERVICE_URL}/clear-all`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `RAG clear-all failed: ${res.status}`);
  }
  return res.json();
}

export async function searchRAG(
  query: string,
  projectId?: string,
  nResults = 5
): Promise<SearchResponse> {
  const params = new URLSearchParams({ query, n_results: String(nResults) });
  if (projectId) params.set('project_id', projectId);
  const res = await fetch(`${RAG_SERVICE_URL}/search?${params}`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `RAG search failed: ${res.status}`);
  }
  return res.json();
}

export async function getDocumentationSummary(projectId: string): Promise<{
  summary: string;
  sources_count: number;
}> {
  if (!isRAGReachable()) {
    throw new Error('RAG_SERVICE_OFFLINE');
  }
  const res = await fetch(
    `${RAG_SERVICE_URL}/summary?project_id=${encodeURIComponent(projectId)}`
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `RAG summary failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Obtém o resumo da documentação usando cache local.
 * Se já existir análise anterior e os documentos da base não mudaram, retorna o cache.
 */
export async function getDocumentationSummaryWithCache(
  projectId: string,
  dataSourceIds: string[]
): Promise<{ summary: string; sources_count: number }> {
  const { getRAGSummaryCache, saveRAGSummaryCache } = await import('./local-db');
  const cached = await getRAGSummaryCache(projectId);
  const currentIds = [...dataSourceIds].sort();
  const cachedIds = cached?.dataSourceIds ? [...cached.dataSourceIds].sort() : [];
  const idsMatch = currentIds.length === cachedIds.length && currentIds.every((id, i) => id === cachedIds[i]);
  if (cached && idsMatch) {
    return { summary: cached.summary, sources_count: cached.sources_count };
  }
  const result = await getDocumentationSummary(projectId);
  await saveRAGSummaryCache(projectId, {
    summary: result.summary,
    sources_count: result.sources_count,
    dataSourceIds: currentIds,
  });
  return result;
}

export async function checkRAGHealth(): Promise<{ chroma_ready: boolean }> {
  const res = await fetch(`${RAG_SERVICE_URL}/health`);
  if (!res.ok) return { chroma_ready: false };
  const data = await res.json();
  return { chroma_ready: data.chroma_ready === true };
}

export interface DocumentSectionInput {
  id: string;
  title: string;
  helpText?: string;
}

export async function getDocumentUnderstanding(params: {
  projectId: string;
  documentId: string;
  sections: DocumentSectionInput[];
}): Promise<{ summary: string; sources_count: number }> {
  if (!isRAGReachable()) throw new Error('RAG_SERVICE_OFFLINE');
  const res = await fetch(`${RAG_SERVICE_URL}/generate-document-understanding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: params.projectId,
      document_id: params.documentId,
      sections: params.sections.map(s => ({
        id: s.id,
        title: s.title,
        helpText: s.helpText ?? null,
      })),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `RAG generate-document-understanding failed: ${res.status}`);
  }
  return res.json();
}

function sectionsHash(sections: DocumentSectionInput[]): string {
  const str = sections
    .map(s => `${s.id}|${s.title}|${s.helpText ?? ''}`)
    .sort()
    .join(';');
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0;
  return String(h >>> 0);
}

/**
 * Obtém o entendimento do documento usando cache local.
 * Se já existir análise anterior para o mesmo documento e seções, retorna o cache.
 */
export async function getDocumentUnderstandingWithCache(params: {
  projectId: string;
  documentId: string;
  sections: DocumentSectionInput[];
}): Promise<{ summary: string; sources_count: number }> {
  const { getRAGUnderstandingCache, saveRAGUnderstandingCache } = await import('./local-db');
  const cacheKey = `${params.projectId}_${params.documentId}_${sectionsHash(params.sections)}`;
  const cached = await getRAGUnderstandingCache(cacheKey);
  if (cached) {
    return { summary: cached.summary, sources_count: cached.sources_count };
  }
  const result = await getDocumentUnderstanding(params);
  await saveRAGUnderstandingCache(cacheKey, {
    summary: result.summary,
    sources_count: result.sources_count,
  });
  return result;
}

/** Ação sugerida pelo chat: gerar documento ou ação estruturada no documento */
export type ChatSuggestedAction =
  | 'generate_document'
  | { type: 'regenerate_section'; section_index: number; instruction?: string | null }
  | { type: 'regenerate_all'; instruction?: string | null };

export async function chatWithRAG(params: {
  projectId: string;
  message: string;
  documentId?: string;
  /** Seções editáveis do documento (para o chat entender ações como "corrija a seção 2") */
  documentSections?: Array<{ id: string; title: string; index: number }>;
}): Promise<{ response: string; suggested_action?: ChatSuggestedAction }> {
  if (!isRAGReachable()) throw new Error('RAG_SERVICE_OFFLINE');
  const res = await fetch(`${RAG_SERVICE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: params.projectId,
      message: params.message,
      document_id: params.documentId ?? null,
      document_sections: params.documentSections?.map(s => ({
        id: s.id,
        title: s.title,
        index: s.index,
      })) ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `RAG chat failed: ${res.status}`);
  }
  return res.json();
}

export interface PlannedSection {
  id: string;
  title: string;
  helpText: string;
  templateSectionId: string;
}

/**
 * Quando o modelo não tem campos de metadados, analisa a base de conhecimento
 * e propõe as seções necessárias para construir o documento completo.
 */
export async function proposeSectionsFromKnowledgeBase(params: {
  projectId: string;
  documentType?: string;
  specGuidelines?: string;
}): Promise<{ sections: Array<{ id: string; title: string; helpText?: string }> }> {
  const res = await fetch(`${RAG_SERVICE_URL}/propose-sections-from-knowledge-base`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: params.projectId,
      document_type: params.documentType ?? null,
      spec_guidelines: params.specGuidelines ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'RAG propose-sections failed');
  }
  return res.json();
}

/**
 * Fase de planejamento: consulta a base RAG e expande seções repetíveis
 * (épicos, features, histórias de usuário, etc.) em instâncias concretas.
 */
export async function planDocumentStructure(params: {
  projectId: string;
  sections: Array<{
    id: string;
    title: string;
    helpText?: string;
    repeatable?: boolean;
    planningInstruction?: string;
  }>;
}): Promise<PlannedSection[]> {
  const res = await fetch(`${RAG_SERVICE_URL}/plan-document-structure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: params.projectId,
      sections: params.sections,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `RAG plan-document-structure failed: ${res.status}`);
  }
  const data = await res.json();
  return data.planned_sections as PlannedSection[];
}

/** Indexa documento avaliado como "bom" no RAG para refinar gerações futuras */
export async function indexPositiveFeedback(params: {
  projectId: string;
  documentId: string;
  sections: Array<{ title: string; content: string }>;
}): Promise<{ status: string }> {
  const res = await fetch(`${RAG_SERVICE_URL}/index-positive-feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: params.projectId,
      document_id: params.documentId,
      sections: params.sections,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `RAG index-positive-feedback failed: ${res.status}`);
  }
  return res.json();
}

export async function removePositiveFeedback(documentId: string): Promise<{ chunks_removed: number }> {
  const res = await fetch(`${RAG_SERVICE_URL}/remove-positive-feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: documentId }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `RAG remove-positive-feedback failed: ${res.status}`);
  }
  return res.json();
}

export async function generateSectionContent(params: {
  projectId: string;
  sectionTitle: string;
  helpText?: string;
  /** Contexto textual (legado) - preferir previousSectionsHtml */
  documentContext?: string;
  /** HTML completo das seções já geradas - a IA vê como partes do mesmo documento */
  previousSectionsHtml?: string;
  /** Índice desta seção (0-based) */
  sectionIndex?: number;
  /** Total de seções do documento */
  totalSections?: number;
  /** Conteúdo do documento Spec associado ao modelo. Obrigatório para seguir as diretrizes. */
  specGuidelines?: string;
  /** Tipo documental do modelo (ex.: Requisito) — a IA usa tipo + spec para montar a estrutura */
  documentType?: string;
  /** Avaliação anterior do criador (rating + comment) para recriação — a IA considera esse feedback */
  creatorFeedback?: string;
  /** Conteúdo do documento de exemplo — a IA usa para entender organização e formato esperado */
  exampleDocument?: string;
  /** ID do metadado pai — seção filha na árvore organizacional */
  parentFieldId?: string;
  /** Título do metadado pai — a IA formata como item filho */
  parentFieldTitle?: string;
}): Promise<{ content: string }> {
  const res = await fetch(`${RAG_SERVICE_URL}/generate-section-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: params.projectId,
      section_title: params.sectionTitle,
      help_text: params.helpText ?? null,
      document_context: params.documentContext ?? null,
      previous_sections_html: params.previousSectionsHtml ?? null,
      section_index: params.sectionIndex ?? null,
      total_sections: params.totalSections ?? null,
      spec_guidelines: params.specGuidelines ?? null,
      document_type: params.documentType ?? null,
      creator_feedback: params.creatorFeedback ?? null,
      example_document: params.exampleDocument ?? null,
      parent_field_id: params.parentFieldId ?? null,
      parent_field_title: params.parentFieldTitle ?? null,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const json = JSON.parse(text);
      if (typeof json?.detail === 'string') msg = json.detail;
    } catch {
      /* usar text como está */
    }
    throw new Error(msg || `RAG generate-section-content failed: ${res.status}`);
  }
  return res.json();
}
