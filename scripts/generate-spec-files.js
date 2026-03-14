/**
 * Gera spec-files.json a partir da pasta Spec (única fonte, na raiz do projeto).
 * Exclui REGRAS_CONSTITUCIONAIS.md (regras internas) da lista.
 * Executado durante copy-spec (build/dev).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const specDir = path.join(projectRoot, 'Spec');
const outputPath = path.join(projectRoot, 'public', 'spec-files.json');

const EXCLUDED = ['REGRAS_CONSTITUCIONAIS.md'];

function walkDir(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const rel = path.join(base, e.name);
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...walkDir(full, rel));
    } else if (e.isFile() && e.name.endsWith('.md')) {
      const specPath = path.join('Spec', rel).replace(/\\/g, '/');
      const fileName = e.name;
      if (!EXCLUDED.includes(fileName)) {
        files.push({
          path: specPath,
          label: fileName.replace(/\.md$/, ''),
        });
      }
    }
  }
  return files;
}

const specDirExists = fs.existsSync(specDir);
const files = specDirExists ? walkDir(specDir) : [];

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(files, null, 2), 'utf-8');
console.log(`spec-files.json gerado: ${files.length} arquivo(s) em Spec/`);
