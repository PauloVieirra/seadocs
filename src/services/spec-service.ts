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
 * Aceita caminhos da raiz ('spec_requisitos.md') ou com subpasta ('Spec/spec_requisitos.md').
 * Tenta download direto; se falhar (ex.: 400 em bucket privado), usa URL assinada.
 */
export async function fetchSpecContent(specPath: string): Promise<string | null> {
  const pathsToTry = [
    specPath,
    specPath.replace(/^Spec\//, ''),
    specPath.startsWith('Spec/') ? specPath : `Spec/${specPath}`,
  ].filter((p, i, arr) => arr.indexOf(p) === i);

  for (const path of pathsToTry) {
    const { data, error } = await supabase.storage.from(SPECS_BUCKET).download(path);
    if (!error && data) return await data.text();
    const { data: signed } = await supabase.storage.from(SPECS_BUCKET).createSignedUrl(path, 60);
    if (signed?.signedUrl) {
      try {
        const res = await fetch(signed.signedUrl);
        if (res.ok) return await res.text();
      } catch {
        /* ignora */
      }
    }
  }
  return null;
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
