/**
 * Cliente do serviço RAG (ChromaDB + Ollama).
 * O serviço Python deve estar rodando em VITE_RAG_SERVICE_URL.
 */

const RAG_SERVICE_URL = import.meta.env.VITE_RAG_SERVICE_URL || 'http://localhost:8000';

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

export async function chatWithRAG(params: {
  projectId: string;
  message: string;
  documentId?: string;
}): Promise<{ response: string; suggested_action?: string }> {
  const res = await fetch(`${RAG_SERVICE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: params.projectId,
      message: params.message,
      document_id: params.documentId ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `RAG chat failed: ${res.status}`);
  }
  return res.json();
}

export async function generateSectionContent(params: {
  projectId: string;
  sectionTitle: string;
  helpText?: string;
  documentContext?: string;
}): Promise<{ content: string }> {
  const res = await fetch(`${RAG_SERVICE_URL}/generate-section-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: params.projectId,
      section_title: params.sectionTitle,
      help_text: params.helpText ?? null,
      document_context: params.documentContext ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `RAG generate-section-content failed: ${res.status}`);
  }
  return res.json();
}
