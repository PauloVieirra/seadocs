const RAG_SERVICE_URL = import.meta.env.VITE_RAG_SERVICE_URL || 'http://localhost:8000';

export interface TemplateSection {
  id: string;
  title: string;
  helpText: string;
}

export interface AnalyzedTemplate {
  template_html: string;
  sections: TemplateSection[];
  suggested_name: string;
}

export async function listTemplateExamples(): Promise<string[]> {
  const res = await fetch(`${RAG_SERVICE_URL}/list-template-examples`);
  if (!res.ok) throw new Error('Falha ao listar exemplos de modelos');
  const data = await res.json();
  return data.files as string[];
}

export async function analyzeDocumentTemplate(fileName: string): Promise<AnalyzedTemplate> {
  const res = await fetch(`${RAG_SERVICE_URL}/analyze-document-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: fileName }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail || 'Falha ao analisar documento');
  }
  return res.json();
}
