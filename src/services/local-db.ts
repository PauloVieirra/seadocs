/**
 * Serviço de armazenamento local usando IndexedDB (Dexie.js).
 * Mais seguro que localStorage - dados ficam em banco local do navegador.
 */

import Dexie, { type Table } from 'dexie';

export interface ModelDraft {
  id: string;
  name: string;
  type: string;
  templateContent: string;
  aiGuidance?: string;
  specPath?: string;
  isDraft: boolean;
  updatedAt: string;
}

export interface AppConfig {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface SessionData {
  key: string;
  value: unknown;
  updatedAt: string;
}

class LocalDB extends Dexie {
  modelDrafts!: Table<ModelDraft, string>;
  configs!: Table<AppConfig, string>;
  session!: Table<SessionData, string>;

  constructor() {
    super('seadocs_local');
    this.version(1).stores({
      modelDrafts: 'id, updatedAt',
      configs: 'key, updatedAt',
      session: 'key, updatedAt',
    });
  }
}

const db = new LocalDB();

// --- Rascunhos de modelos ---

export async function saveModelDraft(draft: Omit<ModelDraft, 'updatedAt'>): Promise<void> {
  const withTimestamp = { ...draft, updatedAt: new Date().toISOString() };
  await db.modelDrafts.put(withTimestamp);
}

export async function getModelDrafts(): Promise<ModelDraft[]> {
  return db.modelDrafts.toArray();
}

export async function getModelDraft(id: string): Promise<ModelDraft | undefined> {
  return db.modelDrafts.get(id);
}

export async function deleteModelDraft(id: string): Promise<void> {
  await db.modelDrafts.delete(id);
}

export async function clearAllModelDrafts(): Promise<void> {
  await db.modelDrafts.clear();
}

// --- Configurações (db, ai, manus) ---

export async function saveConfig(key: string, value: unknown): Promise<void> {
  await db.configs.put({ key, value, updatedAt: new Date().toISOString() });
}

export async function getConfig<T>(key: string): Promise<T | null> {
  const row = await db.configs.get(key);
  return row ? (row.value as T) : null;
}

// --- Sessão (current_user) ---

export async function saveSession(key: string, value: unknown): Promise<void> {
  await db.session.put({ key, value, updatedAt: new Date().toISOString() });
}

export async function getSession<T>(key: string): Promise<T | null> {
  const row = await db.session.get(key);
  return row ? (row.value as T) : null;
}

export async function removeSession(key: string): Promise<void> {
  await db.session.delete(key);
}

export async function clearSession(): Promise<void> {
  await db.session.clear();
}

// --- Cache de análise RAG (resumo e entendimento) ---

export interface RAGSummaryCache {
  summary: string;
  sources_count: number;
  dataSourceIds: string[];
  savedAt: string;
}

export interface RAGUnderstandingCache {
  summary: string;
  sources_count: number;
  savedAt: string;
}

const RAG_SUMMARY_PREFIX = 'rag_summary_';
const RAG_UNDERSTANDING_PREFIX = 'rag_understanding_';

export async function getRAGSummaryCache(projectId: string): Promise<RAGSummaryCache | null> {
  return getConfig<RAGSummaryCache>(`${RAG_SUMMARY_PREFIX}${projectId}`);
}

export async function saveRAGSummaryCache(projectId: string, data: Omit<RAGSummaryCache, 'savedAt'>): Promise<void> {
  await saveConfig(`${RAG_SUMMARY_PREFIX}${projectId}`, {
    ...data,
    savedAt: new Date().toISOString(),
  });
}

export async function getRAGUnderstandingCache(cacheKey: string): Promise<RAGUnderstandingCache | null> {
  return getConfig<RAGUnderstandingCache>(`${RAG_UNDERSTANDING_PREFIX}${cacheKey}`);
}

export async function saveRAGUnderstandingCache(cacheKey: string, data: Omit<RAGUnderstandingCache, 'savedAt'>): Promise<void> {
  await saveConfig(`${RAG_UNDERSTANDING_PREFIX}${cacheKey}`, {
    ...data,
    savedAt: new Date().toISOString(),
  });
}

/** Invalida o cache de resumo quando documentos são adicionados/removidos */
export async function invalidateRAGSummaryCache(projectId: string): Promise<void> {
  await db.configs.delete(`${RAG_SUMMARY_PREFIX}${projectId}`);
}
