/**
 * Serviço para gerenciamento de documentos nos buckets specs, skill e examples do Supabase Storage.
 * Buckets: specs, skill (.md) | examples (.md, .docx)
 */
import { supabase } from './supabase';
import mammoth from 'mammoth';

export type BucketType = 'specs' | 'skill' | 'examples';

export interface BucketDocument {
  path: string;
  name: string;
  type: BucketType;
  bucket: string;
}

const EXTENSIONS_BY_BUCKET: Record<BucketType, string[]> = {
  specs: ['.md'],
  skill: ['.md'],
  examples: ['.md', '.docx'],
};

async function listRecursive(bucket: string, folderPath: string, extensions: string[]): Promise<{ path: string; name: string }[]> {
  const { data, error } = await supabase.storage.from(bucket).list(folderPath, {
    limit: 500,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) {
    console.warn(`[ai-storage] Erro ao listar bucket ${bucket}:`, error.message);
    return [];
  }
  if (!data || data.length === 0) return [];
  const files: { path: string; name: string }[] = [];
  const lower = (s: string) => s.toLowerCase();
  for (const item of data) {
    const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;
    const matches = extensions.some((ext) => lower(item.name).endsWith(lower(ext)));
    if (matches) {
      files.push({ path: fullPath, name: item.name });
    } else if (!item.name.includes('.')) {
      const subFiles = await listRecursive(bucket, fullPath, extensions);
      files.push(...subFiles);
    }
  }
  return files;
}

/** Lista documentos de um bucket conforme extensões permitidas */
async function listBucketDocuments(bucket: BucketType): Promise<BucketDocument[]> {
  const extensions = EXTENSIONS_BY_BUCKET[bucket];
  const files = await listRecursive(bucket, '', extensions);
  return files.map((f) => ({
    path: f.path,
    name: f.name.replace(/\.(md|docx)$/i, ''),
    type: bucket,
    bucket,
  }));
}

/** Lista documentos de todos os buckets (specs + skill + examples) */
export async function listAllDocuments(): Promise<BucketDocument[]> {
  const [specs, skills, examples] = await Promise.all([
    listBucketDocuments('specs'),
    listBucketDocuments('skill'),
    listBucketDocuments('examples'),
  ]);
  return [...specs, ...skills, ...examples];
}

async function downloadBlobAsText(blob: Blob, path: string, bucket: BucketType): Promise<string | null> {
  const lower = path.toLowerCase();
  if (bucket === 'examples' && lower.endsWith('.docx')) {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      return result.value || null;
    } catch (e) {
      console.warn('[ai-storage] Erro ao converter DOCX:', e);
      return null;
    }
  }
  return await blob.text();
}

/** Baixa o conteúdo de um documento como texto/HTML. Para .docx no bucket examples, converte com mammoth. Fallback com URL assinada se download direto falhar (ex.: 400). */
export async function downloadDocument(bucket: BucketType, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (!error && data) return downloadBlobAsText(data, path, bucket);
  const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (signed?.signedUrl) {
    try {
      const res = await fetch(signed.signedUrl);
      if (res.ok) {
        const blob = await res.blob();
        return downloadBlobAsText(blob, path, bucket);
      }
    } catch {
      /* ignora */
    }
  }
  return null;
}

/** Faz upload de um documento texto (cria ou sobrescreve) */
export async function uploadDocument(
  bucket: BucketType,
  path: string,
  content: string
): Promise<{ path: string } | null> {
  const blob = new Blob([content], { type: 'text/markdown' });
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: 'text/markdown', upsert: true });
  if (error) {
    console.warn('[ai-storage] Erro no upload:', error.message);
    return null;
  }
  return data ? { path: data.path } : null;
}

/** Faz upload de um arquivo binário (ex.: DOCX) no bucket examples */
export async function uploadDocumentBinary(
  bucket: BucketType,
  path: string,
  file: File
): Promise<{ path: string } | null> {
  const contentType = file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: true });
  if (error) {
    console.warn('[ai-storage] Erro no upload:', error.message);
    return null;
  }
  return data ? { path: data.path } : null;
}

/** Remove um documento do bucket */
export async function deleteDocument(bucket: BucketType, path: string): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.warn('[ai-storage] Erro ao excluir:', error.message);
    return false;
  }
  return true;
}
