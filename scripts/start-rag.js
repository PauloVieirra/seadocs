#!/usr/bin/env node
/**
 * Inicia o serviço RAG (FastAPI) de forma cross-platform.
 * Usa 'python' no Windows e 'python3' no macOS/Linux.
 * Libera a porta 8000 se já estiver em uso (processo anterior).
 */
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ragDir = join(__dirname, '..', 'rag_service');

// Libera porta 8000 se estiver em uso (evita "Address already in use")
try {
  execSync('npx --yes kill-port 8000', { stdio: 'ignore', cwd: join(__dirname, '..') });
} catch {
  /* ignora se não houver processo na porta */
}
await new Promise((r) => setTimeout(r, 300));

const py = process.platform === 'win32' ? 'python' : 'python3';
const proc = spawn(py, ['-m', 'uvicorn', 'api:app', '--reload', '--host', '0.0.0.0', '--port', '8000'], {
  cwd: ragDir,
  stdio: 'inherit',
});

proc.on('error', (err) => {
  console.error('[RAG] Erro ao iniciar:', err.message);
  console.error('[RAG] Verifique se Python está instalado e as dependências: pip install -r rag_service/requirements.txt');
  process.exit(1);
});
proc.on('exit', (code) => process.exit(code ?? 0));
