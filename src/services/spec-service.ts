/**
 * Serviço para gerenciamento de Specs armazenadas no bucket 'specs' do Supabase Storage.
 * Bucket: https://supabase.com/dashboard/project/gegneggumjbddpytzloj/storage/files/buckets/specs
 */
import { supabase } from './supabase';

const SPECS_BUCKET = 'specs';
const EXCLUDED = ['REGRAS_CONSTITUCIONAIS.md'];

export interface SpecFile {
  path: string;   // caminho no bucket (ex: Spec_Requisitos_Design.md ou Spec/Spac_Foo.md)
  label: string;  // nome de exibição sem extensão
}

/**
 * Lista recursivamente todos os arquivos .md no bucket 'specs' do Supabase Storage.
 * Suporta arquivos na raiz e em subpastas (ex: Spec/).
 * Exclui REGRAS_CONSTITUCIONAIS.md (regras internas, não selecionável como Spec).
 */
async function listRecursive(folderPath: string): Promise<SpecFile[]> {
  const { data, error } = await supabase.storage.from(SPECS_BUCKET).list(folderPath, {
    limit: 500,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) {
    console.warn('[spec-service] Erro ao listar bucket specs:', error.message);
    return [];
  }
  if (!data || data.length === 0) return [];
  const files: SpecFile[] = [];
  for (const item of data) {
    const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;
    if (item.name.endsWith('.md') && !EXCLUDED.includes(item.name)) {
      files.push({
        path: fullPath,
        label: item.name.replace(/\.md$/, ''),
      });
    } else if (!item.name.endsWith('.md')) {
      const subFiles = await listRecursive(fullPath);
      files.push(...subFiles);
    }
  }
  return files;
}

export async function listSpecFiles(): Promise<SpecFile[]> {
  const files = await listRecursive('');
  if (files.length === 0) {
    const { data: rootData, error: rootError } = await supabase.storage
      .from(SPECS_BUCKET)
      .list('', { limit: 500 });
    if (rootError) {
      console.warn('[spec-service] Bucket specs inacessível:', rootError.message);
    }
  }
  return files;
}

/**
 * Baixa e retorna o conteúdo de um Spec pelo seu caminho no bucket 'specs'.
 * Aceita caminhos da raiz ('Spec_Requisitos.md') ou com subpasta ('Spec/Spac_Foo.md').
 */
export async function fetchSpecContent(specPath: string): Promise<string | null> {
  const pathAtRoot = specPath.replace(/^Spec\//, '');
  const { data, error } = await supabase.storage.from(SPECS_BUCKET).download(pathAtRoot);
  if (!error && data) return await data.text();
  const pathWithSpec = specPath.startsWith('Spec/') ? specPath : `Spec/${specPath}`;
  const { data: altData, error: altError } = await supabase.storage.from(SPECS_BUCKET).download(pathWithSpec);
  if (altError || !altData) return null;
  return await altData.text();
}

/**
 * Faz upload de um Spec para o bucket.
 * Sobrescreve se já existir.
 */
export async function uploadSpec(fileName: string, content: string): Promise<{ path: string } | null> {
  const blob = new Blob([content], { type: 'text/markdown' });
  const { data, error } = await supabase.storage
    .from(SPECS_BUCKET)
    .upload(fileName, blob, { contentType: 'text/markdown', upsert: true });
  if (error || !data) return null;
  return { path: data.path };
}

/**
 * Remove um Spec do bucket.
 */
export async function deleteSpec(fileName: string): Promise<boolean> {
  const { error } = await supabase.storage.from(SPECS_BUCKET).remove([fileName]);
  return !error;
}
